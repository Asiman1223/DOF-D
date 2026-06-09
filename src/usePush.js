import { useState, useEffect } from "react";

const VAPID_PUBLIC = import.meta.env.VITE_VAPID_PUBLIC_KEY || "";

function urlBase64ToUint8(base64String) {
  const pad = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + pad).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)));
}

async function saveSubscription(sub) {
  const res = await fetch("/api/subscribe-push", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ subscription: sub.toJSON() }),
  });
  if (!res.ok) throw new Error("Push subscription konnte nicht gespeichert werden");
}

export function usePush() {
  const [status, setStatus] = useState("idle");

  useEffect(() => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setStatus("unsupported");
      return;
    }
    const perm = Notification.permission;
    if (perm === "granted") setStatus("granted");
    if (perm === "denied") setStatus("denied");
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

      let sub = await reg.pushManager.getSubscription();
      if (sub) await sub.unsubscribe();
      if (!VAPID_PUBLIC) throw new Error("VITE_VAPID_PUBLIC_KEY fehlt");
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8(VAPID_PUBLIC),
      });

      await saveSubscription(sub);
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
