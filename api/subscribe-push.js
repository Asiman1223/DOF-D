const { requireAuth } = require("./_auth");
const crypto = require("crypto");

function readBody(req) {
  if (!req.body) return {};
  if (typeof req.body === "string") {
    try { return JSON.parse(req.body); } catch { return {}; }
  }
  return req.body;
}

module.exports = async function handler(req, res) {
  if (!requireAuth(req, res)) return;
  if (req.method !== "POST") return res.status(405).end();

  const { subscription } = readBody(req);
  if (!subscription) return res.status(400).json({ error: "subscription fehlt" });

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_KEY;
  if (!supabaseUrl || !serviceKey) return res.status(500).json({ error: "Supabase Env fehlt" });

  const endpoint = subscription.endpoint || `${Date.now()}_${Math.random()}`;
  const id = crypto.createHash("sha256").update(endpoint).digest("hex").slice(0, 24);
  const key = `push_sub_${id}`;
  const r = await fetch(`${supabaseUrl}/rest/v1/app_data`, {
    method: "POST",
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates",
    },
    body: JSON.stringify({ key, value: subscription, updated_at: new Date().toISOString() }),
  });

  if (!r.ok) return res.status(500).json({ error: await r.text() });
  return res.status(200).json({ ok: true });
};
