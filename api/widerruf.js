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

function normalizePayload(body = {}) {
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
  if (payload.website) return "Spam erkannt.";
  if (!payload.name) return "Name fehlt.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email)) return "E-Mail ist ungültig.";
  if (!payload.orderNumber) return "Bestellnummer fehlt.";
  if (!payload.confirm) return "Widerruf muss bestätigt werden.";
  return null;
}

function buildEmail(payload) {
  const submittedAt = new Date().toLocaleString("de-DE", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/Berlin",
  });

  const rows = [
    ["Name", payload.name],
    ["E-Mail", payload.email],
    ["Bestellnummer", payload.orderNumber],
    ["Artikel", payload.items || "-"],
    ["Grund", payload.reason || "-"],
    ["Nachricht", payload.message || "-"],
    ["Abgesendet", submittedAt],
  ];

  const htmlRows = rows
    .map(([label, value]) => `
      <tr>
        <td style="padding:10px 12px;border:1px solid #272727;color:#9f9f9f;font-weight:700;width:170px;">${escapeHtml(label)}</td>
        <td style="padding:10px 12px;border:1px solid #272727;color:#ffffff;">${escapeHtml(value).replace(/\n/g, "<br>")}</td>
      </tr>
    `)
    .join("");

  const textContent = rows
    .map(([label, value]) => `${label}: ${value}`)
    .join("\n");

  return {
    subject: `Neuer Widerruf ${payload.orderNumber}`,
    htmlContent: `
      <div style="background:#050505;color:#ffffff;font-family:Arial,sans-serif;padding:24px;">
        <p style="margin:0 0 8px;color:#ff304f;font-size:12px;font-weight:800;letter-spacing:1.5px;text-transform:uppercase;">DOF Widerrufsformular</p>
        <h1 style="margin:0 0 22px;font-size:26px;line-height:1.15;">Neuer Widerruf eingegangen</h1>
        <table style="border-collapse:collapse;width:100%;max-width:720px;background:#101010;border:1px solid #272727;">
          ${htmlRows}
        </table>
      </div>
    `,
    textContent: `DOF Widerrufsformular\n\n${textContent}`,
  };
}

async function sendBrevoEmail(payload) {
  const apiKey = process.env.BREVO_API_KEY;
  const senderEmail = process.env.BREVO_SENDER_EMAIL || "support@dofclothes.de";
  const senderName = process.env.BREVO_SENDER_NAME || "DOF Support";
  const toEmail = process.env.WIDERRUF_TO_EMAIL || "support@dofclothes.de";
  const toName = process.env.WIDERRUF_TO_NAME || "DOF Support";

  if (!apiKey) {
    throw new Error("BREVO_API_KEY fehlt in Vercel.");
  }

  const email = buildEmail(payload);
  const response = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "api-key": apiKey,
    },
    body: JSON.stringify({
      sender: { email: senderEmail, name: senderName },
      to: [{ email: toEmail, name: toName }],
      replyTo: { email: payload.email, name: payload.name },
      subject: email.subject,
      htmlContent: email.htmlContent,
      textContent: email.textContent,
    }),
  });

  const resultText = await response.text();

  if (!response.ok) {
    throw new Error(`Brevo Fehler: ${resultText || response.statusText}`);
  }

  return resultText ? JSON.parse(resultText) : {};
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

    const brevo = await sendBrevoEmail(payload);
    return sendJson(req, res, 200, { ok: true, brevo });
  } catch (error) {
    console.error("Widerruf API Fehler:", error);
    return sendJson(req, res, 500, {
      ok: false,
      error: "Widerruf konnte nicht gesendet werden.",
      detail: error.message,
    });
  }
};
