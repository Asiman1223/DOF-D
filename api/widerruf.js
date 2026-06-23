const DEFAULT_ALLOWED_ORIGINS = [
  "https://dofclothes.de",
  "https://www.dofclothes.de",
];

function getAllowedOrigins() {
  const configured = process.env.WIDERRUF_ALLOWED_ORIGIN;
  if (!configured) return DEFAULT_ALLOWED_ORIGINS;
  return configured
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function setCorsHeaders(req, res) {
  const allowedOrigins = getAllowedOrigins();
  const requestOrigin = req.headers.origin;
  const origin = allowedOrigins.includes(requestOrigin)
    ? requestOrigin
    : allowedOrigins[0];

  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function sendJson(req, res, status, data) {
  setCorsHeaders(req, res);
  res.status(status).json(data);
}

function escapeHtml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function parseBody(body = {}) {
  if (typeof body !== "string") return body || {};

  try {
    return JSON.parse(body);
  } catch {
    return {};
  }
}

function normalizePayload(rawBody = {}) {
  const body = parseBody(rawBody);

  return {
    name: String(body.name || "").trim(),
    email: String(body.email || "").trim(),
    orderNumber: String(body.orderNumber || "").trim(),
    items: String(body.items || "").trim(),
    reason: String(body.reason || "Kein Grund angegeben").trim(),
    message: String(body.message || "").trim(),
    confirm: Boolean(body.confirm),
    website: String(body.website || "").trim(),
  };
}

function validatePayload(payload) {
  if (!payload.name) return "Name fehlt.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email)) return "E-Mail ist ungueltig.";
  if (!payload.orderNumber) return "Bestellnummer fehlt.";
  if (!payload.confirm) return "Widerruf muss bestaetigt werden.";
  return null;
}

function buildRows(payload) {
  const submittedAt = new Date().toLocaleString("de-DE", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/Berlin",
  });

  return [
    ["Name", payload.name],
    ["E-Mail", payload.email],
    ["Bestellnummer", payload.orderNumber],
    ["Artikel", payload.items || "-"],
    ["Grund", payload.reason || "-"],
    ["Nachricht", payload.message || "-"],
    ["Abgesendet", submittedAt],
  ];
}

function rowsToText(rows) {
  return rows.map(([label, value]) => `${label}: ${value}`).join("\n");
}

function buildSupportEmail(payload) {
  const rows = buildRows(payload);
  const htmlRows = rows
    .map(([label, value]) => `
      <tr>
        <td style="padding:10px 12px;border:1px solid #272727;color:#9f9f9f;font-weight:700;width:170px;">${escapeHtml(label)}</td>
        <td style="padding:10px 12px;border:1px solid #272727;color:#ffffff;">${escapeHtml(value).replace(/\n/g, "<br>")}</td>
      </tr>
    `)
    .join("");

  const text = rowsToText(rows);

  return {
    subject: `Neuer Widerruf ${payload.orderNumber}`,
    text: `DOF Widerrufsformular\n\n${text}`,
    html: `
      <div style="background:#050505;color:#ffffff;font-family:Arial,sans-serif;padding:24px;">
        <p style="margin:0 0 8px;color:#ff304f;font-size:12px;font-weight:800;letter-spacing:1.5px;text-transform:uppercase;">DOF Widerrufsformular</p>
        <h1 style="margin:0 0 22px;font-size:26px;line-height:1.15;">Neuer Widerruf eingegangen</h1>
        <table style="border-collapse:collapse;width:100%;max-width:720px;background:#101010;border:1px solid #272727;">
          ${htmlRows}
        </table>
      </div>
    `,
  };
}

function buildCustomerEmail(payload) {
  const rows = buildRows(payload);
  const details = rowsToText(rows);

  return {
    subject: `Bestaetigung deines Widerrufs ${payload.orderNumber}`,
    text: [
      `Hallo ${payload.name},`,
      "",
      `wir bestaetigen den Eingang deines Widerrufs zu deiner Bestellung ${payload.orderNumber}.`,
      "Deine Anfrage wurde an unseren Support weitergeleitet.",
      "",
      details,
      "",
      "Bitte bewahre diese E-Mail als Nachweis auf. Wir melden uns bei dir, falls wir weitere Informationen benoetigen.",
      "",
      "DOF Support",
    ].join("\n"),
    html: `
      <div style="background:#050505;color:#ffffff;font-family:Arial,sans-serif;padding:24px;">
        <p style="margin:0 0 8px;color:#ff304f;font-size:12px;font-weight:800;letter-spacing:1.5px;text-transform:uppercase;">DOF Support</p>
        <h1 style="margin:0 0 18px;font-size:24px;line-height:1.15;">Dein Widerruf ist eingegangen</h1>
        <p style="margin:0 0 16px;color:#f5f1ea;line-height:1.6;">Hallo ${escapeHtml(payload.name)},</p>
        <p style="margin:0 0 16px;color:#d6d0c9;line-height:1.6;">
          wir bestaetigen den Eingang deines Widerrufs zu deiner Bestellung ${escapeHtml(payload.orderNumber)}.
          Deine Anfrage wurde an unseren Support weitergeleitet.
        </p>
        <div style="margin:22px 0;padding:16px;border:1px solid #272727;background:#101010;color:#f5f1ea;line-height:1.7;white-space:pre-line;">${escapeHtml(details)}</div>
        <p style="margin:0;color:#b8b0a8;line-height:1.6;">
          Bitte bewahre diese E-Mail als Nachweis auf. Wir melden uns bei dir, falls wir weitere Informationen benoetigen.
        </p>
      </div>
    `,
  };
}

function getSmtpTransport() {
  const nodemailer = require("nodemailer");
  const host = process.env.SMTP_HOST || "smtp.strato.de";
  const port = Number(process.env.SMTP_PORT || 465);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!user || !pass) {
    throw new Error("SMTP_USER oder SMTP_PASS fehlt in Vercel.");
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
}

async function sendWithdrawalEmails(payload) {
  const senderEmail = process.env.MAIL_FROM || process.env.SMTP_USER || "support@dofclothes.de";
  const senderName = process.env.MAIL_FROM_NAME || "DOF Support";
  const toEmail = process.env.WIDERRUF_TO_EMAIL || "support@dofclothes.de";
  const toName = process.env.WIDERRUF_TO_NAME || "DOF Support";
  const bccEmail = process.env.WIDERRUF_BCC_EMAIL || toEmail;

  const transporter = getSmtpTransport();
  const supportEmail = buildSupportEmail(payload);
  const customerEmail = buildCustomerEmail(payload);

  const supportResult = await transporter.sendMail({
    from: `"${senderName}" <${senderEmail}>`,
    to: `"${toName}" <${toEmail}>`,
    replyTo: `"${payload.name}" <${payload.email}>`,
    subject: supportEmail.subject,
    text: supportEmail.text,
    html: supportEmail.html,
    priority: "high",
  });

  const customerResult = await transporter.sendMail({
    from: `"${senderName}" <${senderEmail}>`,
    to: `"${payload.name}" <${payload.email}>`,
    bcc: `"${toName}" <${bccEmail}>`,
    replyTo: `"${toName}" <${toEmail}>`,
    subject: customerEmail.subject,
    text: customerEmail.text,
    html: customerEmail.html,
  });

  return {
    supportMessageId: supportResult.messageId,
    customerMessageId: customerResult.messageId,
  };
}

module.exports = async function handler(req, res) {
  setCorsHeaders(req, res);

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") {
    return sendJson(req, res, 405, { ok: false, error: "Method not allowed" });
  }

  try {
    const payload = normalizePayload(req.body);
    const validationError = validatePayload(payload);

    if (validationError) {
      return sendJson(req, res, 400, { ok: false, error: validationError });
    }

    const mail = await sendWithdrawalEmails(payload);
    return sendJson(req, res, 200, { ok: true, mail });
  } catch (error) {
    console.error("Widerruf API Fehler:", error);
    return sendJson(req, res, 500, {
      ok: false,
      error: "Widerruf konnte nicht gesendet werden.",
      detail: error.message,
    });
  }
};
