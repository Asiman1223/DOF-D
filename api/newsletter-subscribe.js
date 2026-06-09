const { dbGet, dbSet, normalizeEmail, readBody, tokenFor, validEmail } = require("./newsletter-utils");

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).end();

  try {
    const body = readBody(req);
    const email = normalizeEmail(body.email);
    if (!validEmail(email)) return res.status(400).json({ ok:false, error:"Ungueltige E-Mail" });

    const subscribers = (await dbGet("dof_newsletter_subscribers")) || [];
    const now = new Date().toISOString();
    const exists = subscribers.find(s => s.email === email);
    const next = exists
      ? subscribers.map(s => s.email === email ? { ...s, status:"active", source:body.source || s.source || "shopify", updatedAt:now, unsubscribedAt:"", token:s.token || tokenFor(email) } : s)
      : [{ id:`sub_${Date.now()}`, email, status:"active", source:body.source || "shopify", createdAt:now, updatedAt:now, token:tokenFor(email) }, ...subscribers];

    await dbSet("dof_newsletter_subscribers", next);
    return res.status(200).json({ ok:true, message:"Du bist im DOF Newsletter eingetragen." });
  } catch(e) {
    return res.status(500).json({ ok:false, error:e.message });
  }
};
