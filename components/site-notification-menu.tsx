import { Suspense } from "react";
import { Inbox } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { ClientNotificationInbox } from "@/modules/mobile/client/notification-inbox";

const clientNotificationTypes = [
  "promotion", "points", "reward", "chat", "message", "appointment",
  "appointment_confirmed", "appointment_rescheduled", "appointment_no_show", "appointment_update",
];

export function SiteNotificationMenu({ userId }: { userId: string }) {
  return <details id="notificaciones" className="site-notification-menu" name="legend-header-actions" suppressHydrationWarning>
    <summary aria-label="Notificaciones" title="Notificaciones"><Inbox size={20} strokeWidth={1.8} aria-hidden="true" /></summary>
    <section className="site-notification-popover" aria-labelledby="site-notifications">
      <h2 id="site-notifications">Notificaciones</h2>
      <Suspense fallback={<p role="status">Cargando notificaciones…</p>}>
        <SiteNotificationList userId={userId} />
      </Suspense>
    </section>
  </details>;
}

async function SiteNotificationList({ userId }: { userId: string }) {
  const supabase = await createClient();
  const { data, error } = await supabase.from("notifications")
    .select("id,title,body,read_at,created_at")
    .eq("user_id", userId)
    .in("type", clientNotificationTypes)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) return <p role="alert">No pudimos cargar tus notificaciones.</p>;
  return <ClientNotificationInbox userId={userId} items={data ?? []} />;
}
