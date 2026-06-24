const { requireAuth } = require("./_auth");
const { ImapFlow } = require("imapflow");
const { simpleParser } = require("mailparser");
const nodemailer = require("nodemailer");

function pickEnv(names, fallback = "") {
  for (const name of names) {
    if (process.env[name]) return process.env[name];
  }
  return fallback;
}

function mailConfig() {
  const user = pickEnv(["SUPPORT_IMAP_USER", "SUPPORT_MAIL_USER", "SMTP_USER"]);
  const pass = pickEnv(["SUPPORT_IMAP_PASS", "SUPPORT_MAIL_PASS", "SMTP_PASS"]);

  if (!user || !pass) {
    throw new Error("SUPPORT_IMAP_USER oder SUPPORT_IMAP_PASS fehlt in Vercel.");
  }

  return {
    imap: {
      host: pickEnv(["SUPPORT_IMAP_HOST"], "imap.strato.de"),
      port: Number(pickEnv(["SUPPORT_IMAP_PORT"], "993")),
      secure: String(pickEnv(["SUPPORT_IMAP_SECURE"], "true")) !== "false",
      auth: { user, pass },
      logger: false,
    },
    smtp: {
      host: pickEnv(["SUPPORT_SMTP_HOST", "SMTP_HOST"], "smtp.strato.de"),
      port: Number(pickEnv(["SUPPORT_SMTP_PORT", "SMTP_PORT"], "465")),
      secure: Number(pickEnv(["SUPPORT_SMTP_PORT", "SMTP_PORT"], "465")) === 465,
      auth: {
        user: pickEnv(["SUPPORT_SMTP_USER", "SUPPORT_MAIL_USER", "SMTP_USER"], user),
        pass: pickEnv(["SUPPORT_SMTP_PASS", "SUPPORT_MAIL_PASS", "SMTP_PASS"], pass),
      },
    },
    fromEmail: pickEnv(["SUPPORT_MAIL_FROM", "MAIL_FROM", "SMTP_USER"], user),
    fromName: pickEnv(["SUPPORT_MAIL_FROM_NAME", "MAIL_FROM_NAME"], "DOF Support"),
  };
}

function readBody(req) {
  if (!req.body) return {};
  if (typeof req.body === "string") {
    try {
      return JSON.parse(req.body);
    } catch {
      return {};
    }
  }
  return req.body;
}

function addressText(value) {
  if (!value) return "";
  if (typeof value.text === "string") return value.text;
  if (Array.isArray(value.value)) {
    return value.value.map(item => item.name ? `${item.name} <${item.address}>` : item.address).filter(Boolean).join(", ");
  }
  return String(value || "");
}

function firstAddress(value) {
  if (!value) return "";
  if (Array.isArray(value.value) && value.value[0]?.address) return value.value[0].address;
  const text = addressText(value);
  const match = text.match(/<([^>]+)>/);
  if (match?.[1]) return match[1];
  const email = text.match(/[^\s<>"]+@[^\s<>"]+\.[^\s<>"]+/);
  return email?.[0] || text;
}

function stripHtml(html = "") {
  return String(html)
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

async function withImap(fn) {
  const config = mailConfig();
  const client = new ImapFlow(config.imap);

  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.logout().catch(() => {});
  }
}

async function listMessages(req, res) {
  const mailbox = String(req.query.mailbox || "INBOX");
  const limit = Math.min(Math.max(Number(req.query.limit || 100), 1), 200);

  const data = await withImap(async client => {
    const lock = await client.getMailboxLock(mailbox);
    try {
      const exists = client.mailbox.exists || 0;
      if (!exists) return { mailbox, exists, messages: [] };

      const start = Math.max(1, exists - limit + 1);
      const messages = [];

      for await (const msg of client.fetch(`${start}:*`, {
        uid: true,
        flags: true,
        internalDate: true,
        envelope: true,
        source: true,
      })) {
        const parsed = await simpleParser(msg.source);
        const text = (parsed.text || stripHtml(parsed.html || "") || "").trim();
        const flags = Array.from(msg.flags || []);

        messages.push({
          id: `${mailbox}:${msg.uid}`,
          uid: msg.uid,
          mailbox,
          messageId: parsed.messageId || msg.envelope?.messageId || "",
          subject: parsed.subject || msg.envelope?.subject || "(Kein Betreff)",
          from: addressText(parsed.from),
          fromEmail: firstAddress(parsed.from),
          replyTo: addressText(parsed.replyTo) || addressText(parsed.from),
          replyToEmail: firstAddress(parsed.replyTo) || firstAddress(parsed.from),
          to: addressText(parsed.to),
          date: (parsed.date || msg.internalDate || new Date()).toISOString(),
          unseen: !flags.includes("\\Seen"),
          flags,
          preview: text.slice(0, 220),
          text: text.slice(0, 30000),
        });
      }

      messages.sort((a, b) => new Date(b.date) - new Date(a.date));
      return { mailbox, exists, messages };
    } finally {
      lock.release();
    }
  });

  return res.status(200).json({ ok: true, ...data });
}

async function sendReply(req, res) {
  const body = readBody(req);
  const to = String(body.to || "").trim();
  const subject = String(body.subject || "").trim();
  const text = String(body.text || "").trim();

  if (!to) return res.status(400).json({ ok: false, error: "Empfaenger fehlt." });
  if (!subject) return res.status(400).json({ ok: false, error: "Betreff fehlt." });
  if (!text) return res.status(400).json({ ok: false, error: "Nachricht fehlt." });

  const config = mailConfig();
  const transporter = nodemailer.createTransport(config.smtp);
  const result = await transporter.sendMail({
    from: `"${config.fromName}" <${config.fromEmail}>`,
    to,
    subject,
    text,
    html: text.replace(/\n/g, "<br>"),
    inReplyTo: body.messageId || undefined,
    references: body.messageId || undefined,
  });

  return res.status(200).json({ ok: true, messageId: result.messageId });
}

module.exports = async function handler(req, res) {
  if (!requireAuth(req, res)) return;

  try {
    if (req.method === "GET") return await listMessages(req, res);

    if (req.method === "POST") {
      const body = readBody(req);
      if (body.action === "reply") return await sendReply(req, res);
      return res.status(400).json({ ok: false, error: "Unbekannte Aktion." });
    }

    return res.status(405).end();
  } catch (error) {
    console.error("Support-Mail Fehler:", error);
    return res.status(500).json({ ok: false, error: error.message });
  }
};
