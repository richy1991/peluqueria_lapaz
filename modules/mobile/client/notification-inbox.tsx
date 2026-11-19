"use client";

import { useRef, useState } from "react";
import { CheckCheck, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type NotificationItem = { id: string; title: string; body: string; read_at: string | null; created_at: string };

export function ClientNotificationInbox({ userId, items: initialItems }: { userId: string; items: NotificationItem[] }) {
  const [items, setItems] = useState(initialItems);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function markRead(id: string) {
    const item = items.find(candidate => candidate.id === id);
    if (!item || item.read_at || busy) return;
    setBusy(true);
    const readAt = new Date().toISOString();
    const { error } = await createClient().from("notifications").update({ read_at: readAt }).eq("id", id).eq("user_id", userId);
    if (error) setMessage("No se pudo marcar el aviso como leído.");
    else {
      setItems(current => current.map(candidate => candidate.id === id ? { ...candidate, read_at: readAt } : candidate));
      setMessage("Aviso marcado como leído.");
    }
    setBusy(false);
  }

  async function markAllRead() {
    if (busy || !items.some(item => !item.read_at)) return;
    setBusy(true);
    const readAt = new Date().toISOString();
    const { error } = await createClient().from("notifications").update({ read_at: readAt }).eq("user_id", userId).is("read_at", null);
    if (error) setMessage("No se pudieron marcar todos los avisos como leídos.");
    else {
      setItems(current => current.map(item => ({ ...item, read_at: item.read_at ?? readAt })));
      setMessage("Todos los avisos quedaron marcados como leídos.");
    }
    setBusy(false);
  }

  async function deleteAll() {
    if (busy || !items.length || !window.confirm("¿Eliminar todas tus notificaciones? Esta acción no se puede deshacer.")) return;
    setBusy(true);
    const { error } = await createClient().from("notifications").delete().eq("user_id", userId);
    if (error) setMessage("No se pudieron eliminar los avisos.");
    else { setItems([]); setMessage("Se eliminaron tus notificaciones."); }
    setBusy(false);
  }

  if (!items.length) return <p className="portal-empty">{initialItems.length ? "No tienes avisos." : "No tienes avisos nuevos. Cuando haya novedades, aparecerán aquí."}</p>;

  return <div className="client-notification-inbox">
    <div className="client-notification-actions">
      <button type="button" onClick={() => void markAllRead()} disabled={busy}><CheckCheck /> Marcar todas</button>
      <button type="button" onClick={() => void deleteAll()} disabled={busy}><Trash2 /> Eliminar todas</button>
    </div>
    {items.map(item => <article key={item.id} className={!item.read_at ? "is-unread" : ""}
      onPointerDown={() => { if (!item.read_at) timer.current = setTimeout(() => void markRead(item.id), 500); }}
      onPointerUp={() => { if (timer.current) clearTimeout(timer.current); }}
      onPointerLeave={() => { if (timer.current) clearTimeout(timer.current); }}
      onContextMenu={event => { event.preventDefault(); void markRead(item.id); }}>
      <div><strong>{item.title}</strong><span>{item.body}</span><time dateTime={item.created_at}>{new Intl.DateTimeFormat("es-BO", { dateStyle: "medium", timeZone: "America/La_Paz" }).format(new Date(item.created_at))}</time></div>
      {!item.read_at && <button type="button" className="client-notification-read" disabled={busy} onClick={() => void markRead(item.id)}>Leído</button>}
    </article>)}
    {message && <small role="status">{message}</small>}
  </div>;
}
