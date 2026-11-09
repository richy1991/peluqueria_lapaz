"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function PushNotificationSetup({ userId }: { userId: string }) {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function enable() {
    if (!("Notification" in window) || !("serviceWorker" in navigator) || !("PushManager" in window)) {
      setMessage("Este dispositivo no admite notificaciones push.");
      return;
    }
    setBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setMessage("Permiso de notificaciones no concedido.");
        return;
      }
      const registration = await navigator.serviceWorker.ready;
      const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!vapidKey) {
        setMessage("La aplicación aún no tiene configuradas las notificaciones push.");
        return;
      }
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: Uint8Array.from(atob(vapidKey.replace(/-/g, "+").replace(/_/g, "/")), character => character.charCodeAt(0)),
      });
      const { error } = await createClient().from("push_subscriptions").upsert({
        user_id: userId,
        endpoint: subscription.endpoint,
        subscription: subscription.toJSON(),
        user_agent: navigator.userAgent,
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id,endpoint" });
      setMessage(error ? "No se pudo guardar el dispositivo." : "Notificaciones push activadas.");
    } finally {
      setBusy(false);
    }
  }

  return <div className="push-notification-setup"><button type="button" onClick={enable} disabled={busy}>{busy ? "Activando…" : "Activar notificaciones push"}</button>{message && <small>{message}</small>}</div>;
}
