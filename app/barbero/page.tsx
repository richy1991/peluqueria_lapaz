import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Banknote, CalendarClock, Clock3, MessageSquareText, ReceiptText, Scissors } from "lucide-react";
import { Brand } from "@/components/brand";
import { ModeSwitcher } from "@/components/mode-switcher";
import { createClient } from "@/lib/supabase/server";
import { getUserCapabilities } from "@/lib/user-capabilities";
import { AppointmentStatusActions } from "./appointment-status-actions";
import { ExpenseForm } from "./expense-form";

export const dynamic = "force-dynamic";

export default async function BarberPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/admin/login");
  const capabilities = await getUserCapabilities(user.id);
  if (!capabilities.barber) notFound();
  const start = new Date(); start.setHours(0,0,0,0);
  const end = new Date(start); end.setDate(end.getDate()+1);
  const [appointmentsResult,earnings,expenses,payouts]=await Promise.all([
    supabase.from("appointments").select("id,starts_at,ends_at,status,service_name_snapshot,notes,reference_image_path,profiles!appointments_client_id_fkey(full_name,phone,is_blacklisted)").eq("barber_id", capabilities.barber.id).gte("starts_at", start.toISOString()).lt("starts_at", end.toISOString()).order("starts_at"),
    supabase.from("barber_earnings").select("id,kind,amount,status,created_at,sale_items(name_snapshot)").eq("barber_id",capabilities.barber.id).order("created_at",{ascending:false}).limit(50),
    supabase.from("barber_expenses").select("id,concept,amount,status,created_at").eq("barber_id",capabilities.barber.id).order("created_at",{ascending:false}).limit(20),
    supabase.from("payouts").select("id,period_start,period_end,total_amount,status,paid_at").eq("barber_id",capabilities.barber.id).order("created_at",{ascending:false}).limit(20),
  ]);
  const appointments=appointmentsResult.data;
  const active = appointments?.filter((item) => !["canceled","completed","no_show"].includes(item.status)) ?? [];
  const pendingTotal=(earnings.data??[]).filter(item=>["pending","approved"].includes(item.status)).reduce((sum,item)=>sum+Number(item.amount),0);
  return <main className="portal-shell barber-portal">
    <header className="portal-header"><Brand /><ModeSwitcher current="barber" isAdmin={capabilities.isAdmin} hasBarber isCashier={capabilities.isCashier} /><Link href="/mensajes">Mensajes</Link><Link href="/">Sitio público</Link></header>
    <section className="portal-hero"><p className="eyebrow">MODO PELUQUERO</p><h1>Agenda de {capabilities.barber.display_name}</h1><p>{active.length} cita(s) pendiente(s) para hoy.</p><Link className="portal-chat-link" href="/mensajes"><MessageSquareText/> Abrir conversaciones</Link></section>
    <div className="portal-grid">
      <section className="portal-card"><div className="portal-title"><Banknote/><h2>Ganancia pendiente</h2></div><strong className="streak-number">Bs {pendingTotal.toFixed(2)}</strong><p>Comisiones e incentivos aún no pagados.</p></section>
      <section className="portal-card"><div className="portal-title"><Clock3 /><h2>Próxima cita</h2></div>{active[0] ? <div className="next-appointment"><strong>{active[0].service_name_snapshot}</strong><span>{new Intl.DateTimeFormat("es-BO",{timeStyle:"short",timeZone:"America/La_Paz"}).format(new Date(active[0].starts_at))}</span></div> : <p className="portal-empty">No quedan citas pendientes hoy.</p>}</section>
      <section className="portal-card portal-wide"><div className="portal-title"><CalendarClock /><h2>Agenda del día</h2></div><div className="portal-list agenda-list">{appointments?.length ? appointments.map((item) => { const client=item.profiles as unknown as {full_name?:string;phone?:string;is_blacklisted?:boolean}|null; return <article key={item.id}><span className="agenda-time">{new Intl.DateTimeFormat("es-BO",{timeStyle:"short",timeZone:"America/La_Paz"}).format(new Date(item.starts_at))}</span><div><strong>{item.service_name_snapshot}</strong><span>{client?.full_name ?? "Cliente"} · {client?.phone ?? "Sin teléfono"} · {item.status}</span>{client?.is_blacklisted && <small className="portal-warning">Alerta de inasistencias</small>}</div><AppointmentStatusActions id={item.id} status={item.status} /></article>; }) : <p className="portal-empty">No hay citas asignadas para hoy.</p>}</div></section>
      <section className="portal-card"><div className="portal-title"><Scissors /><h2>Acciones permitidas</h2></div><p>Solo puedes consultar tus citas asignadas y cambiar su estado operativo. Los servicios, usuarios y agenda general pertenecen al administrador.</p></section>
      <section className="portal-card portal-wide"><div className="portal-title"><Banknote/><h2>Comisiones e incentivos</h2></div><div className="portal-list">{earnings.data?.length?earnings.data.map(item=><article key={item.id}><div><strong>{(item.sale_items as unknown as {name_snapshot?:string}|null)?.name_snapshot??item.kind}</strong><span>{item.kind} · {item.status} · {new Intl.DateTimeFormat("es-BO",{dateStyle:"medium",timeZone:"America/La_Paz"}).format(new Date(item.created_at))}</span></div><b>Bs {Number(item.amount).toFixed(2)}</b></article>):<p className="portal-empty">Aún no existen comisiones registradas.</p>}</div></section>
      <section className="portal-card"><div className="portal-title"><ReceiptText/><h2>Insumos</h2></div><ExpenseForm/><div className="portal-list">{expenses.data?.map(item=><article key={item.id}><div><strong>{item.concept}</strong><span>{item.status}</span></div><b>Bs {Number(item.amount).toFixed(2)}</b></article>)}</div></section>
      <section className="portal-card"><div className="portal-title"><Banknote/><h2>Liquidaciones</h2></div><div className="portal-list">{payouts.data?.length?payouts.data.map(item=><article key={item.id}><div><strong>{item.period_start} — {item.period_end}</strong><span>{item.status}</span></div><b>Bs {Number(item.total_amount).toFixed(2)}</b></article>):<p className="portal-empty">Aún no existen liquidaciones.</p>}</div></section>
    </div>
  </main>;
}
