const crypto = require("crypto");

const COOKIE_NAME = "dof_session";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

function getSecret() {
  const secret = process.env.DASHBOARD_SESSION_SECRET || process.env.DASHBOARD_PASSWORD;
  if (!secret) throw new Error("DASHBOARD_SESSION_SECRET fehlt");
  return secret;
}

function parseCookies(req) {
  return Object.fromEntries(
    String(req.headers.cookie || "")
      .split(";")
      .map(part => part.trim())
      .filter(Boolean)
      .map(part => {
        const i = part.indexOf("=");
        return [part.slice(0, i), decodeURIComponent(part.slice(i + 1))];
      })
  );
}

function sign(value) {
  return crypto.createHmac("sha256", getSecret()).update(value).digest("hex");
}

function safeEqual(a, b) {
  const ab = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  return ab.length === bb.length && crypto.timingSafeEqual(ab, bb);
}

function createSessionValue() {
  const issuedAt = String(Date.now());
  return `${issuedAt}.${sign(issuedAt)}`;
}

function verifySession(req) {
  try {
    const token = parseCookies(req)[COOKIE_NAME];
    if (!token) return false;
    const [issuedAt, mac] = token.split(".");
    if (!issuedAt || !mac) return false;
    if (Date.now() - Number(issuedAt) > MAX_AGE_SECONDS * 1000) return false;
    return safeEqual(mac, sign(issuedAt));
  } catch {
    return false;
  }
}

function cookieSecurity(req) {
  const host = String(req?.headers?.host || "");
  return host.includes("localhost") || host.includes("127.0.0.1") ? "" : "; Secure";
}

function setSessionCookie(req, res) {
  res.setHeader(
    "Set-Cookie",
    `${COOKIE_NAME}=${encodeURIComponent(createSessionValue())}; Path=/; HttpOnly${cookieSecurity(req)}; SameSite=Strict; Max-Age=${MAX_AGE_SECONDS}`
  );
}

function clearSessionCookie(req, res) {
  res.setHeader("Set-Cookie", `${COOKIE_NAME}=; Path=/; HttpOnly${cookieSecurity(req)}; SameSite=Strict; Max-Age=0`);
}

function requireAuth(req, res) {
  if (verifySession(req)) return true;
  res.status(401).json({ error: "Unauthorized" });
  return false;
}

module.exports = {
  clearSessionCookie,
  requireAuth,
  safeEqual,
  setSessionCookie,
  verifySession,
};
