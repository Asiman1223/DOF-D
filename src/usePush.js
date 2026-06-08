// src/usePush.js
import { useState, useEffect } from "react";

const VAPID_PUBLIC = "BG42RaTg1Cp1ri6OoGjfQPWTijPN6RJdcK_Gs4YmPbyAkFePPymYjckYyBNRtXHJ06XXhwhkz7zsLpS5EmoNg3A";

const SUPABASE_URL  = "https://rgyunvmdsqglrvivxhrs.supabase.co";
const SUPABASE_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJneXVudm1kc3FnbHJ2aXZ4aHJzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDUyMzE4OCwiZXhwIjoyMDk2MDk5MTg4fQ.HSlE9j188Utnq_odXBBrvks7NjmExbsgSzbE0JlXh4Q";

function urlBase64ToUint8(base64String) {
  const pad = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + pad).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)));
}

async function saveSubToSupabase(sub) {
  const key = `push_sub_${Date.now()}_${Math.random().toString(36).slice(2,6)}`;
  await fetch(`${SUPABASE_URL}/rest/v1/app_data`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_ANON,
      Authorization: `Bearer ${SUPABASE_ANON}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates",
    },
    body: JSON.stringify({ key, value: sub.toJSON(), updated_at: new Date().toISOString() }),
  });
}

export function usePush() {
  const [status, setStatus] = useState("idle"); // idle | requesting | granted | denied | unsupported

  useEffect(() => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setStatus("unsupported");
      return;
    }
    const perm = Notification.permission;
    if (perm === "granted")  setStatus("granted");
    if (perm === "denied")   setStatus("denied");
  }, []);

  const registerSW = async () => {
    try {
      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      return reg;
    } catch (e) {
      console.error("SW register error:", e);
      return null;
    }
  };

  const subscribe = async () => {
    if (!("Notification" in window)) { setStatus("unsupported"); return; }
    setStatus("requesting");
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") { setStatus("denied"); return; }

      const reg = await registerSW();
      if (!reg) { setStatus("idle"); return; }

      // Bestehende Subscription prüfen
      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8(VAPID_PUBLIC),
        });
      }

      await saveSubToSupabase(sub);
      setStatus("granted");
    } catch (e) {
      console.error("Push subscribe error:", e);
      setStatus("idle");
    }
  };

  const unsubscribe = async () => {
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) await sub.unsubscribe();
      setStatus("idle");
    } catch (e) {
      console.error("Unsubscribe error:", e);
    }
  };

  return { status, subscribe, unsubscribe };
}
