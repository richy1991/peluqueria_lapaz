import Link from "next/link";
import { redirect } from "next/navigation";
import { Bell, CalendarDays, PackageCheck, UserRound } from "lucide-react";
import { Brand } from "@/components/brand";
import { ModeSwitcher } from "@/components/mode-switcher";
import { createClient } from "@/lib/supabase/server";
import { getUserCapabilities } from "@/lib/user-capabilities";
import { CancelAppointmentButton, ConfirmReassignmentButton } from "./appointment-actions";

export const dynamic = "force-dynamic";

export default async function ClientAccountPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/admin/login");
  const capabilities = await getUserCapabilities(user.id);
  const [profile, appointments, reservations, notifications] = await Promise.all([
    supabase.from("profiles").select("full_name,email,phone,status,no_show_count,is_blacklisted,is_blocked").eq("id", user.id).single(),
    supabase.from("appointments").select("id,starts_at,status,price_snapshot,service_name_snapshot,barber_profiles(display_name)").eq("client_id", user.id).order("starts_at", { ascending: false }).limit(20),
    supabase.from("product_reservations").select("id,quantity,status,expires_at,products(name)").eq("client_id", user.id).order("created_at", { ascending: false }).limit(10),
    supabase.from("notifications").select("id,title,body,read_at,created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(10),
  ]);
  const person = profile.data;
  return <main className="portal-shell">
    <header className="portal-header"><Brand /><ModeSwitcher current="client" isAdmin={capabilities.isAdmin} hasBarber={Boolean(capabilities.barber)} /><Link href="/">Sitio público</Link></header>
    <section className="portal-hero"><p className="eyebrow">MODO CLIENTE</p><h1>Hola, {person?.full_name ?? user.email?.split("@")[0]}</h1><p>Consulta tus citas, apartados y avisos de LEGEND CLUB.</p></section>
    <div className="portal-grid">
      <section className="portal-card"><div className="portal-title"><UserRound /><h2>Mi perfil</h2></div><dl><div><dt>Correo</dt><dd>{person?.email}</dd></div><div><dt>Teléfono</dt><dd>{person?.phone ?? "Pendiente de registrar"}</dd></div><div><dt>Estado</dt><dd>{person?.status}</dd></div></dl>{person?.is_blacklisted && <p className="portal-warning">La cuenta tiene una alerta por inasistencias.</p>}{person?.is_blocked && <p className="portal-error">Las nuevas reservas están bloqueadas. Contacta al negocio.</p>}</section>
      <section className="portal-card portal-wide"><div className="portal-title"><CalendarDays /><h2>Mis citas</h2><Link href="/reservar">Nueva reserva</Link></div><div className="portal-list">{appointments.data?.length ? appointments.data.map((item) => { const canCancel = ["requested","confirmed","pending_client_confirmation"].includes(item.status); return <article key={item.id}><div><strong>{item.service_name_snapshot}</strong><span>{new Intl.DateTimeFormat("es-BO", { dateStyle: "medium", timeStyle: "short", timeZone: "America/La_Paz" }).format(new Date(item.starts_at))} · {item.status}</span></div><b>Bs {item.price_snapshot}</b>{item.status === "pending_client_confirmation" && <ConfirmReassignmentButton id={item.id} />}{canCancel && <CancelAppointmentButton id={item.id} />}</article>; }) : <p className="portal-empty">Aún no tienes citas registradas.</p>}</div></section>
      <section className="portal-card"><div className="portal-title"><PackageCheck /><h2>Productos apartados</h2></div><div className="portal-list">{reservations.data?.length ? reservations.data.map((item) => <article key={item.id}><div><strong>{(item.products as unknown as { name?: string } | null)?.name ?? "Producto"}</strong><span>{item.quantity} unidad(es) · {item.status}</span></div></article>) : <p className="portal-empty">No tienes productos apartados.</p>}</div></section>
      <section className="portal-card"><div className="portal-title"><Bell /><h2>Notificaciones</h2></div><div className="portal-list">{notifications.data?.length ? notifications.data.map((item) => <article key={item.id}><div><strong>{item.title}</strong><span>{item.body}</span></div></article>) : <p className="portal-empty">No tienes avisos nuevos.</p>}</div></section>
    </div>
  </main>;
}
