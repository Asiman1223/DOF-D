const { clearSessionCookie } = require("./_auth");

module.exports = async function handler(req, res) {
  clearSessionCookie(req, res);
  return res.status(200).json({ ok: true });
};
