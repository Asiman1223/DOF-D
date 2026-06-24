const { requireAuth } = require("./_auth");
const { ImapFlow } = require("imapflow");
const { simpleParser } = require("mailparser");

function pickEnv(names, fallback = "") {
  for (const name of names) {
    if (process.env[name]) return process.env[name];
  }
  return fallback;
}

function vapidSubject(value) {
  const subject = value || "mailto:info@dofclothes.de";
  if (subject.startsWith("mailto:") || subject.startsWith("https://")) return subject;
  if (subject.includes("@")) return `mailto:${subject}`;
  return subject;
}

function requireCronOrAuth(req, res) {
  const secret = process.env.MAIL_CHECK_SECRET || process.env.CRON_SECRET;
  const auth = String(req.headers.authorization || "");
  const querySecret = String(req.query.secret || "");

  if (secret && (auth === `Bearer ${secret}` || querySecret === secret)) return true;
  return requireAuth(req, res);
}

function supportImapConfig() {
  const user = pickEnv(["SUPPORT_IMAP_USER", "SUPPORT_MAIL_USER", "SMTP_USER"]);
  const pass = pickEnv(["SUPPORT_IMAP_PASS", "SUPPORT_MAIL_PASS", "SMTP_PASS"]);

  if (!user || !pass) throw new Error("SUPPORT_IMAP_USER oder SUPPORT_IMAP_PASS fehlt.");

  return {
    host: pickEnv(["SUPPORT_IMAP_HOST"], "imap.strato.de"),
    port: Number(pickEnv(["SUPPORT_IMAP_PORT"], "993")),
    secure: String(pickEnv(["SUPPORT_IMAP_SECURE"], "true")) !== "false",
    auth: { user, pass },
    logger: false,
  };
}

function supabaseConfig() {
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !serviceKey) throw new Error("Supabase Env fehlt.");
  return {
    url,
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
    },
  };
}

async function dbGet(key) {
  const { url, headers } = supabaseConfig();
  const res = await fetch(`${url}/rest/v1/app_data?key=eq.${encodeURIComponent(key)}&select=value`, { headers });
  const rows = await res.json();
  return rows?.[0]?.value ?? null;
}

async function dbSet(key, value) {
  const { url, headers } = supabaseConfig();
  const res = await fetch(`${url}/rest/v1/app_data`, {
    method: "POST",
    headers: { ...headers, Prefer: "resolution=merge-duplicates" },
    body: JSON.stringify({ key, value, updated_at: new Date().toISOString() }),
  });
  if (!res.ok) throw new Error(await res.text());
}

async function dbGetPushSubs() {
  const { url, headers } = supabaseConfig();
  const res = await fetch(`${url}/rest/v1/app_data?key=like.push_sub_%25&select=key,value`, { headers });
  const rows = await res.json();
  return Array.isArray(rows) ? rows : [];
}

async function dbDelete(key) {
  const { url, headers } = supabaseConfig();
  await fetch(`${url}/rest/v1/app_data?key=eq.${encodeURIComponent(key)}`, { method: "DELETE", headers });
}

async function getLatestMessages() {
  const client = new ImapFlow(supportImapConfig());
  await client.connect();

  try {
    const lock = await client.getMailboxLock("INBOX");
    try {
      const exists = client.mailbox.exists || 0;
      if (!exists) return { exists: 0, latestUid: 0, messages: [] };

      const start = Math.max(1, exists - 12 + 1);
      const messages = [];
      let latestUid = 0;

      for await (const msg of client.fetch(`${start}:*`, {
        uid: true,
        internalDate: true,
        envelope: true,
        source: true,
      })) {
        latestUid = Math.max(latestUid, Number(msg.uid || 0));
        const parsed = await simpleParser(msg.source);
        messages.push({
          uid: Number(msg.uid || 0),
          subject: parsed.subject || msg.envelope?.subject || "(Kein Betreff)",
          from: parsed.from?.text || "",
          date: (parsed.date || msg.internalDate || new Date()).toISOString(),
        });
      }

      messages.sort((a, b) => a.uid - b.uid);
      return { exists, latestUid, messages };
    } finally {
      lock.release();
    }
  } finally {
    await client.logout().catch(() => {});
  }
}

async function sendPush(payload) {
  const vapidPublic = process.env.VAPID_PUBLIC_KEY;
  const vapidPrivate = process.env.VAPID_PRIVATE_KEY;
  if (!vapidPublic || !vapidPrivate) throw new Error("VAPID Keys fehlen.");

  const webpush = require("web-push");
  webpush.setVapidDetails(vapidSubject(process.env.VAPID_EMAIL), vapidPublic, vapidPrivate);

  const subs = await dbGetPushSubs();
  if (!subs.length) return { sent: 0, failed: 0, total: 0 };

  const msg = JSON.stringify(payload);
  const results = await Promise.allSettled(subs.map(async row => {
    try {
      await webpush.sendNotification(row.value, msg);
    } catch (error) {
      if ([401, 403, 404, 410].includes(error.statusCode)) await dbDelete(row.key);
      throw error;
    }
  }));

  return {
    sent: results.filter(r => r.status === "fulfilled").length,
    failed: results.filter(r => r.status === "rejected").length,
    total: subs.length,
  };
}

module.exports = async function handler(req, res) {
  if (!requireCronOrAuth(req, res)) return;
  if (!["GET", "POST"].includes(req.method)) return res.status(405).end();

  try {
    const stateKey = "dof_support_mail_last_uid";
    const previousUid = Number(await dbGet(stateKey) || 0);
    const { latestUid, messages } = await getLatestMessages();

    if (!latestUid) {
      await dbSet("dof_support_mail_last_check", new Date().toISOString());
      return res.status(200).json({ ok: true, newCount: 0, latestUid: 0 });
    }

    if (!previousUid) {
      await dbSet(stateKey, latestUid);
      await dbSet("dof_support_mail_last_check", new Date().toISOString());
      return res.status(200).json({ ok: true, initialized: true, newCount: 0, latestUid });
    }

    const fresh = messages.filter(message => message.uid > previousUid);
    const newest = fresh[fresh.length - 1];
    let push = { sent: 0, failed: 0, total: 0 };

    if (fresh.length && newest) {
      push = await sendPush({
        title: fresh.length === 1 ? "Neue Support-Mail" : `${fresh.length} neue Support-Mails`,
        body: fresh.length === 1 ? `${newest.from || "Unbekannt"} - ${newest.subject}` : `Neueste: ${newest.subject}`,
        url: "/",
      });
    }

    await dbSet(stateKey, Math.max(previousUid, latestUid));
    await dbSet("dof_support_mail_last_check", new Date().toISOString());

    return res.status(200).json({ ok: true, newCount: fresh.length, latestUid, previousUid, push });
  } catch (error) {
    console.error("Support-Mail-Check Fehler:", error);
    return res.status(500).json({ ok: false, error: error.message });
  }
};
