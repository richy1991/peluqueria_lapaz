import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CalendarClock, Clock3, Scissors } from "lucide-react";
import { Brand } from "@/components/brand";
import { ModeSwitcher } from "@/components/mode-switcher";
import { createClient } from "@/lib/supabase/server";
import { getUserCapabilities } from "@/lib/user-capabilities";
import { AppointmentStatusActions } from "./appointment-status-actions";

export const dynamic = "force-dynamic";

export default async function BarberPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/admin/login");
  const capabilities = await getUserCapabilities(user.id);
  if (!capabilities.barber) notFound();
  const start = new Date(); start.setHours(0,0,0,0);
  const end = new Date(start); end.setDate(end.getDate()+1);
  const { data: appointments } = await supabase.from("appointments")
    .select("id,starts_at,ends_at,status,service_name_snapshot,notes,reference_image_path,profiles!appointments_client_id_fkey(full_name,phone,is_blacklisted)")
    .eq("barber_id", capabilities.barber.id).gte("starts_at", start.toISOString()).lt("starts_at", end.toISOString()).order("starts_at");
  const active = appointments?.filter((item) => !["canceled","completed","no_show"].includes(item.status)) ?? [];
  return <main className="portal-shell barber-portal">
    <header className="portal-header"><Brand /><ModeSwitcher current="barber" isAdmin={capabilities.isAdmin} hasBarber /><Link href="/">Sitio público</Link></header>
    <section className="portal-hero"><p className="eyebrow">MODO PELUQUERO</p><h1>Agenda de {capabilities.barber.display_name}</h1><p>{active.length} cita(s) pendiente(s) para hoy.</p></section>
    <div className="portal-grid">
      <section className="portal-card"><div className="portal-title"><Clock3 /><h2>Próxima cita</h2></div>{active[0] ? <div className="next-appointment"><strong>{active[0].service_name_snapshot}</strong><span>{new Intl.DateTimeFormat("es-BO",{timeStyle:"short",timeZone:"America/La_Paz"}).format(new Date(active[0].starts_at))}</span></div> : <p className="portal-empty">No quedan citas pendientes hoy.</p>}</section>
      <section className="portal-card portal-wide"><div className="portal-title"><CalendarClock /><h2>Agenda del día</h2></div><div className="portal-list agenda-list">{appointments?.length ? appointments.map((item) => { const client=item.profiles as unknown as {full_name?:string;phone?:string;is_blacklisted?:boolean}|null; return <article key={item.id}><span className="agenda-time">{new Intl.DateTimeFormat("es-BO",{timeStyle:"short",timeZone:"America/La_Paz"}).format(new Date(item.starts_at))}</span><div><strong>{item.service_name_snapshot}</strong><span>{client?.full_name ?? "Cliente"} · {client?.phone ?? "Sin teléfono"} · {item.status}</span>{client?.is_blacklisted && <small className="portal-warning">Alerta de inasistencias</small>}</div><AppointmentStatusActions id={item.id} status={item.status} /></article>; }) : <p className="portal-empty">No hay citas asignadas para hoy.</p>}</div></section>
      <section className="portal-card"><div className="portal-title"><Scissors /><h2>Acciones permitidas</h2></div><p>Solo puedes consultar tus citas asignadas y cambiar su estado operativo. Los servicios, usuarios y agenda general pertenecen al administrador.</p></section>
    </div>
  </main>;
}
