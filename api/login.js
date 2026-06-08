const { safeEqual, setSessionCookie } = require("./_auth");

function readBody(req) {
  if (!req.body) return {};
  if (typeof req.body === "string") {
    try { return JSON.parse(req.body); } catch { return {}; }
  }
  return req.body;
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const expected = process.env.DASHBOARD_PASSWORD;
  if (!expected) return res.status(500).json({ error: "DASHBOARD_PASSWORD fehlt" });

  const { password } = readBody(req);
  if (!password || !safeEqual(password, expected)) {
    return res.status(401).json({ error: "Falsches Passwort" });
  }

  setSessionCookie(req, res);
  return res.status(200).json({ ok: true });
};
