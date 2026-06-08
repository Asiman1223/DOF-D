const { requireAuth } = require("./_auth");

function env(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} fehlt`);
  return value;
}

module.exports = async function handler(req, res) {
  if (!requireAuth(req, res)) return;
  if (req.method !== "POST") return res.status(405).end();

  try {
    const supabaseUrl = env("SUPABASE_URL");
    const serviceKey = env("SUPABASE_SERVICE_KEY");
    const vapidPublic = env("VAPID_PUBLIC_KEY");
    const vapidPrivate = env("VAPID_PRIVATE_KEY");
    const vapidEmail = process.env.VAPID_EMAIL || "mailto:info@dofclothes.de";

    const webpush = require("web-push");
    webpush.setVapidDetails(vapidEmail, vapidPublic, vapidPrivate);

    const headers = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` };
    const r = await fetch(`${supabaseUrl}/rest/v1/app_data?key=like.push_sub_%25&select=key,value`, { headers });
    const subs = await r.json();

    if (!subs?.length) {
      return res.status(200).json({
        ok: false,
        message: "Keine Subscriber - bitte zuerst APP INSTALLIEREN im Dashboard tippen und Benachrichtigungen erlauben.",
      });
    }

    const results = await Promise.allSettled(
      subs.map(row => webpush.sendNotification(row.value, JSON.stringify({
        title: "DOFClothes Test",
        body: "Push-Benachrichtigungen funktionieren.",
        url: "/",
      })))
    );

    const ok = results.filter(r => r.status === "fulfilled").length;
    const err = results.filter(r => r.status === "rejected").length;
    return res.status(200).json({ ok: true, sent: ok, failed: err, total: subs.length });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};
