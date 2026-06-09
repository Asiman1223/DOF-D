// api/shopify-webhook.js

const WEBHOOK_SECRET   = process.env.SHOPIFY_WEBHOOK_SECRET;
const SUPABASE_URL     = process.env.SUPABASE_URL;
const SUPABASE_SERVICE = process.env.SUPABASE_SERVICE_KEY;

const VAPID_PUBLIC  = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY;
const VAPID_EMAIL   = vapidSubject(process.env.VAPID_EMAIL);

function vapidSubject(value) {
  const subject = value || "mailto:info@dofclothes.de";
  if (subject.startsWith("mailto:") || subject.startsWith("https://")) return subject;
  if (subject.includes("@")) return `mailto:${subject}`;
  return subject;
}

// ── Supabase REST ─────────────────────────────────────────────────────
const HEADERS = { apikey: SUPABASE_SERVICE, Authorization: `Bearer ${SUPABASE_SERVICE}`, "Content-Type": "application/json" };

async function dbGet(key) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/app_data?key=eq.${key}&select=value`, { headers: HEADERS });
  const rows = await r.json();
  return rows?.[0]?.value ?? null;
}

async function dbSet(key, value) {
  await fetch(`${SUPABASE_URL}/rest/v1/app_data`, {
    method: "POST",
    headers: { ...HEADERS, Prefer: "resolution=merge-duplicates" },
    body: JSON.stringify({ key, value, updated_at: new Date().toISOString() }),
  });
}

async function dbGetPushSubs() {
  // Alle push_sub_* keys laden
  const r = await fetch(`${SUPABASE_URL}/rest/v1/app_data?key=like.push_sub_%25&select=key,value`, { headers: HEADERS });
  const rows = await r.json();
  return Array.isArray(rows) ? rows : [];
}

// ── Push senden ───────────────────────────────────────────────────────
async function sendPushToAll(payload) {
  let webpush;
  try {
    webpush = require("web-push");
    webpush.setVapidDetails(VAPID_EMAIL, VAPID_PUBLIC, VAPID_PRIVATE);
  } catch(e) {
    console.error("web-push nicht verfügbar:", e.message);
    return;
  }
  const subs = await dbGetPushSubs();
  console.log(`Push an ${subs.length} Subscriber(s)`);
  if (!subs.length) return;

  const msg = JSON.stringify(payload);
  await Promise.allSettled(subs.map(async row => {
    try {
      await webpush.sendNotification(row.value, msg);
    } catch(e) {
      console.error("Push-Fehler für sub:", e.statusCode, e.message);
      if ([401, 403, 404, 410].includes(e.statusCode)) {
        // Abgelaufene Sub löschen
        await fetch(`${SUPABASE_URL}/rest/v1/app_data?key=eq.${row.key}`, { method: "DELETE", headers: HEADERS });
      }
    }
  }));
}

// ── Produkt-Matching ──────────────────────────────────────────────────
function matchProduct(title, products) {
  const t = (title || "").toLowerCase().trim();
  return (
    products.find(p => p.name.toLowerCase().trim() === t) ||
    products.find(p => p.name.toLowerCase().split(" ").filter(w => w.length > 3).every(w => t.includes(w))) ||
    products.find(p => t.includes(p.name.toLowerCase().split(" ").slice(0, 3).join(" "))) ||
    null
  );
}

// ── Bestellung verarbeiten ────────────────────────────────────────────
async function handleOrder(order) {
  const date     = (order.created_at || new Date().toISOString()).slice(0, 10);
  const custName = order.customer ? `${order.customer.first_name || ""} ${order.customer.last_name || ""}`.trim() : "";
  const custMail = order.customer?.email || order.email || "";
  const payMap   = { paypal:"paypal", shopify_payments:"kreditkarte", klarna:"klarna", bank_transfer:"ueberweisung" };
  const payment  = payMap[order.payment_gateway] || order.payment_gateway || "shopify";

  const products = (await dbGet("dof_products")) || [];
  const newSales = [];

  for (const item of order.line_items || []) {
    const price    = parseFloat(item.price) || 0;
    const quantity = parseInt(item.quantity) || 1;
    const size     = item.variant_title || "M";
    const product  = matchProduct(item.title, products);
    console.log(`  "${item.title}" Gr.${size} → ${product?.name || "KEIN MATCH"}`);
    newSales.push({
      id: `shopify_${order.id}_${item.id}`,
      productId: product?.id || "shopify", productName: item.title,
      size, quantity, price, total: price * quantity,
      profit: (price - (product?.buyPrice || 0)) * quantity,
      payment, customerName: custName, date,
      status: order.financial_status === "paid" ? "paid" : "open",
      source: "shopify", shopifyOrderNumber: order.order_number,
    });
  }

  if (!newSales.length) return;

  const existing = (await dbGet("dof_sales")) || [];
  const ids      = new Set(existing.map(s => s.id));
  const fresh    = newSales.filter(s => !ids.has(s.id));
  if (!fresh.length) { console.log("Duplikat — skip"); return; }

  await dbSet("dof_sales", [...fresh, ...existing]);

  if (products.length) {
    const updated = products.map(p => {
      const sale = fresh.find(s => s.productId === p.id);
      if (!sale) return p;
      const ns = { ...p.sizes, [sale.size]: Math.max(0, (p.sizes[sale.size] || 0) - sale.quantity) };
      return { ...p, sizes: ns, status: Object.values(ns).reduce((a,b)=>a+b,0) === 0 ? "sold_out" : p.status };
    });
    await dbSet("dof_products", updated);
  }

  if (custName || custMail) {
    const customers = (await dbGet("dof_customers")) || [];
    const exists = customers.find(c =>
      (custMail && c.email?.toLowerCase() === custMail.toLowerCase()) ||
      (custName && c.name?.toLowerCase() === custName.toLowerCase())
    );
    if (!exists) {
      await dbSet("dof_customers", [...customers, {
        id: `shopify_${order.customer?.id || Date.now()}`,
        name: custName, email: custMail,
        phone: order.customer?.phone || "",
        notes: "Shopify-Kunde", createdAt: date,
      }]);
    }
  }

  // 🔔 Push-Benachrichtigung
  const total = fresh.reduce((a,s) => a + s.total, 0).toFixed(2).replace(".", ",");
  const items = fresh.map(s => `${s.productName.split(" ").slice(0,3).join(" ")} (${s.size})`).join(", ");
  await sendPushToAll({
    title: `🛍️ Neue Bestellung #${order.order_number}`,
    body:  `${custName || "Kunde"} · ${total} € · ${items}`,
    url:   "/",
  });

  console.log(`✓ Order #${order.order_number} gespeichert & Push gesendet`);
}

// ── Main Handler ──────────────────────────────────────────────────────
module.exports = async function handler(req, res) {
  if (req.method === "GET") {
    const subs = await dbGetPushSubs();
    return res.status(200).json({ status: "aktiv ✓", push_subscribers: subs.length });
  }
  if (req.method !== "POST") return res.status(405).end();
  if (req.query.secret !== WEBHOOK_SECRET) return res.status(401).json({ error: "Unauthorized" });

  const topic = req.headers["x-shopify-topic"] || "";
  const order = req.body;
  console.log("Webhook:", topic, "| Order:", order?.order_number);

  try {
    if (topic.includes("orders/")) await handleOrder(order);
    return res.status(200).json({ ok: true });
  } catch(e) {
    console.error("Fehler:", e.message);
    return res.status(500).json({ error: e.message });
  }
};
