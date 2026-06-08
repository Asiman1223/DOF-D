// api/send-test-push.js — Test-Benachrichtigung senden

const SUPABASE_URL     = "https://rgyunvmdsqglrvivxhrs.supabase.co";
const SUPABASE_SERVICE = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJneXVudm1kc3FnbHJ2aXZ4aHJzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDUyMzE4OCwiZXhwIjoyMDk2MDk5MTg4fQ.HSlE9j188Utnq_odXBBrvks7NjmExbsgSzbE0JlXh4Q";
const VAPID_PUBLIC  = "BG42RaTg1Cp1ri6OoGjfQPWTijPN6RJdcK_Gs4YmPbyAkFePPymYjckYyBNRtXHJ06XXhwhkz7zsLpS5EmoNg3A";
const VAPID_PRIVATE = "4zle_bJJuvQFa9iQHbOOqyG8zabeAcG-F3YWxH7_RkQ";
const VAPID_EMAIL   = "mailto:info@dofclothes.de";
const WEBHOOK_SECRET = "Qbingo10";

const HEADERS = { apikey: SUPABASE_SERVICE, Authorization: `Bearer ${SUPABASE_SERVICE}` };

module.exports = async function handler(req, res) {
  if (req.query.secret !== WEBHOOK_SECRET) return res.status(401).json({ error: "Unauthorized" });

  let webpush;
  try {
    webpush = require("web-push");
    webpush.setVapidDetails(VAPID_EMAIL, VAPID_PUBLIC, VAPID_PRIVATE);
  } catch(e) {
    return res.status(500).json({ error: "web-push nicht verfügbar: " + e.message });
  }

  const r = await fetch(`${SUPABASE_URL}/rest/v1/app_data?key=like.push_sub_%25&select=key,value`, { headers: HEADERS });
  const subs = await r.json();

  if (!subs?.length) {
    return res.status(200).json({ ok: false, message: "Keine Subscriber — bitte zuerst 'APP INSTALLIEREN' im Dashboard tippen und Benachrichtigungen erlauben." });
  }

  const results = await Promise.allSettled(
    subs.map(row => webpush.sendNotification(row.value, JSON.stringify({
      title: "🔔 DOFClothes Test",
      body:  "Push-Benachrichtigungen funktionieren! ✓",
      url:   "/",
    })))
  );

  const ok  = results.filter(r => r.status === "fulfilled").length;
  const err = results.filter(r => r.status === "rejected").length;
  return res.status(200).json({ ok: true, sent: ok, failed: err, total: subs.length });
};
