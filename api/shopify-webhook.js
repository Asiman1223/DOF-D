// api/shopify-webhook.js
// Kein externes Paket nötig — nutzt fetch direkt

// ✏️ DEINE WERTE:
const WEBHOOK_SECRET   = "Qbingo10";
const SUPABASE_URL     = "https://rgyunvmdsqglrvivxhrs.supabase.co";
const SUPABASE_SERVICE = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJneXVudm1kc3FnbHJ2aXZ4aHJzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDUyMzE4OCwiZXhwIjoyMDk2MDk5MTg4fQ.HSlE9j188Utnq_odXBBrvks7NjmExbsgSzbE0JlXh4Q";

// ── Supabase direkt via REST API (kein SDK nötig) ─────────────────────
async function dbGet(key) {
  const r = await fetch(
    `${SUPABASE_URL}/rest/v1/app_data?key=eq.${key}&select=value`,
    { headers: { apikey: SUPABASE_SERVICE, Authorization: `Bearer ${SUPABASE_SERVICE}` } }
  );
  const rows = await r.json();
  return rows?.[0]?.value ?? null;
}

async function dbSet(key, value) {
  await fetch(`${SUPABASE_URL}/rest/v1/app_data`, {
    method:  "POST",
    headers: {
      apikey: SUPABASE_SERVICE,
      Authorization:  `Bearer ${SUPABASE_SERVICE}`,
      "Content-Type": "application/json",
      Prefer:         "resolution=merge-duplicates",
    },
    body: JSON.stringify({ key, value, updated_at: new Date().toISOString() }),
  });
}

// ── Handler ───────────────────────────────────────────────────────────
module.exports = async function handler(req, res) {
  // GET → Test ob Funktion läuft
  if (req.method === "GET") {
    return res.status(200).json({
      status:  "Webhook aktiv ✓",
      secret:  WEBHOOK_SECRET !== "HIER_SECRET" ? "gesetzt ✓" : "FEHLT!",
      supabase: SUPABASE_SERVICE !== "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJneXVudm1kc3FnbHJ2aXZ4aHJzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDUyMzE4OCwiZXhwIjoyMDk2MDk5MTg4fQ.HSlE9j188Utnq_odXBBrvks7NjmExbsgSzbE0JlXh4Q" ? "gesetzt ✓" : "FEHLT!",
    });
  }

  if (req.method !== "POST") return res.status(405).end();

  // Secret prüfen
  if (req.query.secret !== WEBHOOK_SECRET) {
    return res.status(401).json({ error: "Falsches Secret" });
  }

  const topic = req.headers["x-shopify-topic"] || "";
  const order = req.body;
  console.log("Webhook:", topic, "Order:", order?.order_number);

  try {
    if (topic.includes("orders/")) await handleOrder(order);
    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error("Fehler:", e.message);
    return res.status(500).json({ error: e.message });
  }
};

// ── Produkt-Matching ──────────────────────────────────────────────────
function matchProduct(title, products) {
  const t = (title || "").toLowerCase().trim();
  return (
    products.find(p => p.name.toLowerCase().trim() === t) ||
    products.find(p => p.name.toLowerCase().split(" ").filter(w=>w.length>3).every(w=>t.includes(w))) ||
    products.find(p => t.includes(p.name.toLowerCase().split(" ").slice(0,3).join(" "))) ||
    null
  );
}

// ── Bestellung verarbeiten ────────────────────────────────────────────
async function handleOrder(order) {
  const date     = (order.created_at || new Date().toISOString()).slice(0,10);
  const custName = order.customer ? `${order.customer.first_name||""} ${order.customer.last_name||""}`.trim() : "";
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
      id:                 `shopify_${order.id}_${item.id}`,
      productId:          product?.id || "shopify",
      productName:        item.title,
      size, quantity, price,
      total:              price * quantity,
      profit:             (price - (product?.buyPrice || 0)) * quantity,
      payment, customerName: custName, date,
      status:             order.financial_status === "paid" ? "paid" : "open",
      source:             "shopify",
      shopifyOrderNumber: order.order_number,
    });
  }

  if (!newSales.length) return;

  // Duplikate vermeiden
  const existing = (await dbGet("dof_sales")) || [];
  const ids      = new Set(existing.map(s => s.id));
  const fresh    = newSales.filter(s => !ids.has(s.id));
  if (!fresh.length) { console.log("Duplikat — skip"); return; }

  // Verkäufe speichern
  await dbSet("dof_sales", [...fresh, ...existing]);

  // Lager anpassen
  if (products.length) {
    let updated = products.map(p => {
      const sale = fresh.find(s => s.productId === p.id);
      if (!sale) return p;
      const ns = { ...p.sizes, [sale.size]: Math.max(0,(p.sizes[sale.size]||0)-sale.quantity) };
      return { ...p, sizes:ns, status: Object.values(ns).reduce((a,b)=>a+b,0)===0 ? "sold_out" : p.status };
    });
    await dbSet("dof_products", updated);
  }

  // Kunden anlegen
  if (custName || custMail) {
    const customers = (await dbGet("dof_customers")) || [];
    const exists = customers.find(c =>
      (custMail && c.email?.toLowerCase()===custMail.toLowerCase()) ||
      (custName && c.name?.toLowerCase()===custName.toLowerCase())
    );
    if (!exists) {
      await dbSet("dof_customers", [...customers, {
        id: `shopify_${order.customer?.id||Date.now()}`,
        name: custName, email: custMail,
        phone: order.customer?.phone || "",
        notes: "Shopify-Kunde", createdAt: date,
      }]);
    }
  }

  console.log(`✓ Order #${order.order_number} gespeichert (${fresh.length} Artikel)`);
}
