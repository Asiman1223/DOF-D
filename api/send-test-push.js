const { requireAuth } = require("./_auth");

function env(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} fehlt`);
  return value;
}

function vapidSubject(value) {
  const subject = value || "mailto:info@dofclothes.de";
  if (subject.startsWith("mailto:") || subject.startsWith("https://")) return subject;
  if (subject.includes("@")) return `mailto:${subject}`;
  return subject;
}

module.exports = async function handler(req, res) {
  if (!requireAuth(req, res)) return;
  if (req.method !== "POST") return res.status(405).end();

  try {
    const supabaseUrl = env("SUPABASE_URL");
    const serviceKey = env("SUPABASE_SERVICE_KEY");
    const vapidPublic = env("VAPID_PUBLIC_KEY");
    const vapidPrivate = env("VAPID_PRIVATE_KEY");
    const vapidEmail = vapidSubject(process.env.VAPID_EMAIL);

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

    const payload = JSON.stringify({
      title: "DOFClothes Test",
      body: "Push-Benachrichtigungen funktionieren.",
      url: "/",
    });
    const results = await Promise.allSettled(
      subs.map(row => webpush.sendNotification(row.value, payload).catch(async error => {
        if ([401, 403, 404, 410].includes(error.statusCode)) {
          await fetch(`${supabaseUrl}/rest/v1/app_data?key=eq.${row.key}`, { method: "DELETE", headers });
        }
        throw error;
      }))
    );

    const ok = results.filter(r => r.status === "fulfilled").length;
    const err = results.filter(r => r.status === "rejected").length;
    const cleaned = results.filter(r => [401, 403, 404, 410].includes(r.reason?.statusCode)).length;
    return res.status(200).json({ ok: true, sent: ok, failed: err, cleaned, total: subs.length });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};
