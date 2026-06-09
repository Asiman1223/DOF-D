const crypto = require("crypto");

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

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function validEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function tokenFor(email) {
  const secret = process.env.NEWSLETTER_SECRET || process.env.DASHBOARD_SESSION_SECRET || process.env.DASHBOARD_PASSWORD;
  if (!secret) throw new Error("NEWSLETTER_SECRET fehlt");
  return crypto.createHmac("sha256", secret).update(email).digest("hex");
}

function readBody(req) {
  if (!req.body) return {};
  if (typeof req.body === "string") {
    try { return JSON.parse(req.body); } catch { return {}; }
  }
  return req.body;
}

async function dbGet(key) {
  const r = await fetch(`${env("SUPABASE_URL")}/rest/v1/app_data?key=eq.${encodeURIComponent(key)}&select=value`, { headers: headers() });
  const rows = await r.json();
  return rows?.[0]?.value ?? null;
}

async function dbSet(key, value) {
  const r = await fetch(`${env("SUPABASE_URL")}/rest/v1/app_data`, {
    method: "POST",
    headers: { ...headers(), Prefer: "resolution=merge-duplicates" },
    body: JSON.stringify({ key, value, updated_at: new Date().toISOString() }),
  });
  if (!r.ok) throw new Error(await r.text());
}

module.exports = { dbGet, dbSet, env, normalizeEmail, readBody, tokenFor, validEmail };
