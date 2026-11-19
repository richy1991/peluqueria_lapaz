import { redirect } from "next/navigation";
import { Bell, Smartphone } from "lucide-react";
import { PushNotificationSetup } from "@/components/push-notification-setup";
import { createClient } from "@/lib/supabase/server";
import { ClientSecondaryPage } from "@/modules/mobile/client/client-secondary-page";
import { PreferencesForm } from "@/modules/mobile/client/preferences-form";

export const dynamic = "force-dynamic";

export default async function ClientNotificationSettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=%2Fmi-cuenta%2Fconfiguracion-avisos");
  const { data: preferences } = await supabase.from("notification_preferences").select("appointment_notifications,promotion_notifications,chat_notifications,system_notifications,muted_all").eq("user_id", user.id).maybeSingle();

  return <ClientSecondaryPage title="Configuración de avisos">
    <div className="client-history-list">
      <section className="portal-card client-secondary-card"><div className="portal-title"><Bell /><div><small>PERSONALIZACIÓN</small><h2>Tipos de avisos</h2></div></div><p>Elige qué novedades quieres recibir en tu cuenta.</p><PreferencesForm userId={user.id} current={preferences} /></section>
      <section className="portal-card client-secondary-card"><div className="portal-title"><Smartphone /><div><small>ESTE NAVEGADOR</small><h2>Avisos en este dispositivo</h2></div></div><p>Permite avisos push para recibir novedades aunque cierres la página. Puedes desactivarlos aquí; el permiso del navegador se revoca desde sus ajustes.</p><PushNotificationSetup userId={user.id} /></section>
    </div>
  </ClientSecondaryPage>;
}
