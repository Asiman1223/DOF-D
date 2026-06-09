const { requireAuth } = require("./_auth");

const ALLOWED_KEYS = new Set([
  "dof_products",
  "dof_sales",
  "dof_expenses",
  "dof_customers",
  "dof_settings",
  "dof_invoices",
  "dof_influencers",
  "dof_tasks",
]);

function env(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} fehlt`);
  return value;
}

function headers() {
  const serviceKey = env("SUPABASE_SERVICE_KEY");
  return {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    "Content-Type": "application/json",
  };
}

function readBody(req) {
  if (!req.body) return {};
  if (typeof req.body === "string") {
    try { return JSON.parse(req.body); } catch { return {}; }
  }
  return req.body;
}

function assertKey(key) {
  if (!ALLOWED_KEYS.has(key)) throw new Error("Ungueltiger Daten-Key");
}

module.exports = async function handler(req, res) {
  if (!requireAuth(req, res)) return;

  try {
    const supabaseUrl = env("SUPABASE_URL");

    if (req.method === "GET") {
      const key = String(req.query.key || "");
      assertKey(key);
      const r = await fetch(`${supabaseUrl}/rest/v1/app_data?key=eq.${encodeURIComponent(key)}&select=value`, {
        headers: headers(),
      });
      const rows = await r.json();
      return res.status(200).json({ value: rows?.[0]?.value ?? null });
    }

    if (req.method === "PUT") {
      const { key, value } = readBody(req);
      assertKey(key);
      const r = await fetch(`${supabaseUrl}/rest/v1/app_data`, {
        method: "POST",
        headers: { ...headers(), Prefer: "resolution=merge-duplicates" },
        body: JSON.stringify({ key, value, updated_at: new Date().toISOString() }),
      });
      if (!r.ok) throw new Error(await r.text());
      return res.status(200).json({ ok: true });
    }

    return res.status(405).end();
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};
