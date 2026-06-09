const { dbGet, dbSet, normalizeEmail, tokenFor } = require("./newsletter-utils");

module.exports = async function handler(req, res) {
  try {
    const email = normalizeEmail(req.query.email);
    const token = String(req.query.token || "");
    if (!email || token !== tokenFor(email)) return res.status(400).send("Ungueltiger Abmeldelink.");

    const subscribers = (await dbGet("dof_newsletter_subscribers")) || [];
    const now = new Date().toISOString();
    await dbSet("dof_newsletter_subscribers", subscribers.map(s => s.email === email ? { ...s, status:"unsubscribed", unsubscribedAt:now, updatedAt:now } : s));
    return res.status(200).send("Du wurdest vom DOF Newsletter abgemeldet.");
  } catch(e) {
    return res.status(500).send(e.message);
  }
};
