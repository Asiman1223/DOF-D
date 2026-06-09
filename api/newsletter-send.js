const { requireAuth } = require("./_auth");
const { dbGet, dbSet, env, normalizeEmail, readBody, tokenFor, validEmail } = require("./newsletter-utils");

function escapeHtml(s) {
  return String(s || "").replace(/[&<>"']/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#039;" }[c]));
}

function renderHtml({ subject, body, unsubscribeUrl }) {
  const safeBody = escapeHtml(body).replace(/\n/g, "<br>");
  return `<!doctype html><html><body style="margin:0;background:#080808;color:#f5f5f5;font-family:Arial,sans-serif">
  <div style="max-width:620px;margin:0 auto;padding:28px 20px">
    <div style="font-size:28px;letter-spacing:5px;font-weight:800">DOFCLOTHES</div>
    <div style="color:#e11d48;font-size:11px;letter-spacing:2px;margin-bottom:24px">DISCIPLINE OVER FEELINGS</div>
    <div style="background:#111;border:1px solid #222;border-radius:10px;padding:22px">
      <h1 style="font-size:24px;margin:0 0 16px;color:#fff">${escapeHtml(subject)}</h1>
      <div style="font-size:15px;line-height:1.65;color:#ddd">${safeBody}</div>
    </div>
    <div style="font-size:11px;color:#777;line-height:1.6;margin-top:22px">
      Du bekommst diese Mail, weil du dich fuer den DOF Newsletter eingetragen hast.<br>
      <a href="${unsubscribeUrl}" style="color:#999">Vom Newsletter abmelden</a>
    </div>
  </div></body></html>`;
}

async function sendOne({ to, subject, body, host }) {
  const apiKey = env("BREVO_API_KEY");
  const senderName = process.env.NEWSLETTER_FROM_NAME || "DOFClothes";
  const senderEmail = process.env.NEWSLETTER_FROM_EMAIL || "support@dofclothes.de";
  const replyTo = process.env.NEWSLETTER_REPLY_TO || senderEmail;
  const unsubscribeUrl = `https://${host}/api/newsletter-unsubscribe?email=${encodeURIComponent(to)}&token=${tokenFor(to)}`;
  const r = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "api-key": apiKey, accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({
      sender: { name: senderName, email: senderEmail },
      to: [{ email: to }],
      subject,
      htmlContent: renderHtml({ subject, body, unsubscribeUrl }),
      textContent: `${subject}\n\n${body}\n\nAbmelden: ${unsubscribeUrl}`,
      replyTo: { email: replyTo, name: senderName },
    }),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.message || data.code || JSON.stringify(data));
  return data.messageId || (Array.isArray(data.messageIds) ? data.messageIds[0] : undefined);
}

module.exports = async function handler(req, res) {
  if (!requireAuth(req, res)) return;
  if (req.method !== "POST") return res.status(405).end();

  try {
    const { subject, body, testEmail } = readBody(req);
    if (!subject || !body) return res.status(400).json({ ok:false, error:"Betreff und Text erforderlich" });

    const subscribers = (await dbGet("dof_newsletter_subscribers")) || [];
    const recipients = testEmail
      ? [normalizeEmail(testEmail)].filter(validEmail)
      : subscribers.filter(s => s.status === "active" && validEmail(s.email)).map(s => s.email);

    if (!recipients.length) return res.status(400).json({ ok:false, error:"Keine aktiven Empfaenger" });

    const host = req.headers.host || "dof-d.vercel.app";
    const results = await Promise.allSettled(recipients.map(to => sendOne({ to, subject, body, host })));
    const sent = results.filter(r => r.status === "fulfilled").length;
    const failed = results.filter(r => r.status === "rejected").length;

    const campaigns = (await dbGet("dof_newsletter_campaigns")) || [];
    const nextCampaigns = [{
      id:`camp_${Date.now()}`, subject, body, sent, failed, test:!!testEmail,
      recipients: recipients.length, createdAt:new Date().toISOString(),
      errors: results.filter(r => r.status === "rejected").slice(0, 5).map(r => r.reason.message),
    }, ...campaigns].slice(0, 100);
    await dbSet("dof_newsletter_campaigns", nextCampaigns);

    return res.status(200).json({ ok:true, sent, failed, campaigns:nextCampaigns });
  } catch(e) {
    return res.status(500).json({ ok:false, error:e.message });
  }
};
