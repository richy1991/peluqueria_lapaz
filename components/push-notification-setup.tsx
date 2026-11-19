"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function PushNotificationSetup({ userId }: { userId: string }) {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [supported, setSupported] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("unsupported");
  const [subscribed, setSubscribed] = useState(false);

  useEffect(() => {
    const available = "Notification" in window && "serviceWorker" in navigator && "PushManager" in window;
    setSupported(available);
    if (!available) return;
    setPermission(Notification.permission);
    void navigator.serviceWorker.getRegistration().then(registration => registration?.pushManager.getSubscription()).then(subscription => setSubscribed(Boolean(subscription)));
  }, []);

  async function enable() {
    if (!("Notification" in window) || !("serviceWorker" in navigator) || !("PushManager" in window)) {
      setMessage("Este dispositivo no admite notificaciones push.");
      return;
    }
    setBusy(true);
    try {
      const permission = await Notification.requestPermission();
      setPermission(permission);
      if (permission !== "granted") {
        setMessage("No se concedió el permiso. Puedes habilitarlo desde los ajustes del navegador.");
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
      if (error) {
        await subscription.unsubscribe();
        setMessage("No se pudo guardar este dispositivo.");
      } else {
        setSubscribed(true);
        setMessage("Notificaciones activadas en este navegador.");
      }
    } catch {
      setMessage("No se pudo activar las notificaciones. Revisa los permisos del navegador.");
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    try {
      const registration = await navigator.serviceWorker.getRegistration();
      const subscription = await registration?.pushManager.getSubscription();
      if (subscription) {
        const { error } = await createClient().from("push_subscriptions").delete().eq("user_id", userId).eq("endpoint", subscription.endpoint);
        if (error) throw error;
        await subscription.unsubscribe();
      }
      setSubscribed(false);
      setMessage("Se detuvieron los avisos push en este navegador. Para revocar el permiso, hazlo desde los ajustes del navegador.");
    } catch {
      setMessage("No se pudo desactivar el envío en este navegador.");
    } finally {
      setBusy(false);
    }
  }

  return <div className="push-notification-setup">
    {!supported ? <p>Este navegador no admite notificaciones push.</p> : <>
      <label><input type="checkbox" checked={subscribed} disabled={busy} onChange={event => void (event.target.checked ? enable() : disable())} /> Avisos en este dispositivo</label>
      <small>{permission === "denied" ? "Permiso bloqueado. Cámbialo desde los ajustes del navegador." : subscribed ? "Este dispositivo recibirá avisos importantes." : "Actívalo para recibir avisos aunque no estés usando la página."}</small>
      {permission === "denied" && <button type="button" className="push-settings-hint" onClick={() => setMessage("Abre el candado o los permisos del sitio en tu navegador y permite las notificaciones.")}>Cómo habilitarlo</button>}
    </>}
    {message && <small role="status">{message}</small>}
  </div>;
}
