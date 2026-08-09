import Link from "next/link";
import { redirect } from "next/navigation";
import { Bell, CalendarDays, Flame, Gift, MessageSquareText, PackageCheck, Star, UserRound } from "lucide-react";
import { Brand } from "@/components/brand";
import { ModeSwitcher } from "@/components/mode-switcher";
import { createClient } from "@/lib/supabase/server";
import { getUserCapabilities } from "@/lib/user-capabilities";
import { CancelAppointmentButton, ConfirmReassignmentButton } from "./appointment-actions";
import { CancelRedemptionButton, ClaimVisitForm, RewardButton } from "./loyalty-actions";
import { PreferencesForm } from "./preferences-form";
import { ReferralCode } from "./referral-code";

export const dynamic = "force-dynamic";

export default async function ClientAccountPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/admin/login");
  const capabilities = await getUserCapabilities(user.id);
  await supabase.rpc("refresh_my_loyalty");
  const [profile, appointments, reservations, notifications,loyalty,transactions,rewards,redemptions,streak,preferences] = await Promise.all([
    supabase.from("profiles").select("full_name,email,phone,status,no_show_count,is_blacklisted,is_blocked,referral_code").eq("id", user.id).single(),
    supabase.from("appointments").select("id,starts_at,status,price_snapshot,service_name_snapshot,barber_profiles(display_name)").eq("client_id", user.id).order("starts_at", { ascending: false }).limit(20),
    supabase.from("product_reservations").select("id,quantity,status,expires_at,products(name)").eq("client_id", user.id).order("created_at", { ascending: false }).limit(10),
    supabase.from("notifications").select("id,title,body,read_at,created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(10),
    supabase.from("loyalty_accounts").select("balance,lifetime_earned,lifetime_redeemed").eq("user_id",user.id).maybeSingle(),
    supabase.from("loyalty_transactions").select("id,points,reason,created_at").eq("user_id",user.id).order("created_at",{ascending:false}).limit(20),
    supabase.from("rewards").select("id,name,description,points_cost,reward_type,reward_value").eq("active",true).order("points_cost"),
    supabase.from("reward_redemptions").select("id,code,status,expires_at,rewards(name)").eq("user_id",user.id).order("created_at",{ascending:false}).limit(10),
    supabase.from("customer_streaks").select("current_visits,best_visits,last_visit_at").eq("user_id",user.id).maybeSingle(),
    supabase.from("notification_preferences").select("appointment_notifications,promotion_notifications,chat_notifications,system_notifications,muted_all").eq("user_id",user.id).maybeSingle(),
  ]);
  const person = profile.data;
  return <main className="portal-shell">
    <header className="portal-header"><Brand /><ModeSwitcher current="client" isAdmin={capabilities.isAdmin} hasBarber={Boolean(capabilities.barber)} isCashier={capabilities.isCashier} /><Link href="/">Sitio público</Link></header>
    <section className="portal-hero"><p className="eyebrow">MODO CLIENTE</p><h1>Hola, {person?.full_name ?? user.email?.split("@")[0]}</h1><p>Consulta tus citas, puntos, recompensas y avisos de LEGEND CLUB.</p><Link className="portal-chat-link" href="/mensajes"><MessageSquareText/> Hablar con LEGEND CLUB</Link></section>
    <div className="portal-grid">
      <section className="portal-card loyalty-balance"><div className="portal-title"><Star/><h2>Mis puntos</h2></div><strong>{loyalty.data?.balance??0}</strong><span>puntos disponibles</span><p>Ganados históricamente: {loyalty.data?.lifetime_earned??0}</p></section>
      <section className="portal-card"><div className="portal-title"><Flame/><h2>Mi racha</h2></div><strong className="streak-number">{streak.data?.current_visits??0}</strong><p>visitas consecutivas · mejor racha: {streak.data?.best_visits??0}</p></section>
      <section className="portal-card"><div className="portal-title"><UserRound /><h2>Mi perfil</h2></div><dl><div><dt>Correo</dt><dd>{person?.email}</dd></div><div><dt>Teléfono</dt><dd>{person?.phone ?? "Pendiente de registrar"}</dd></div><div><dt>Estado</dt><dd>{person?.status}</dd></div></dl>{person?.is_blacklisted && <p className="portal-warning">La cuenta tiene una alerta por inasistencias.</p>}{person?.is_blocked && <p className="portal-error">Las nuevas reservas están bloqueadas. Contacta al negocio.</p>}</section>
      <section className="portal-card"><div className="portal-title"><Gift/><h2>Recomienda a un amigo</h2></div><p>Comparte tu código o QR. Los puntos se activan cuando tu referido completa y paga su primera atención.</p>{person?.referral_code&&<ReferralCode code={person.referral_code}/>}</section>
      <section className="portal-card portal-wide"><div className="portal-title"><Gift/><h2>Recompensas</h2></div><div className="reward-grid">{rewards.data?.map(item=><article key={item.id}><div><strong>{item.name}</strong><span>{item.description}</span></div><RewardButton id={item.id} cost={item.points_cost} disabled={(loyalty.data?.balance??0)<item.points_cost}/></article>)}</div></section>
      <section className="portal-card"><div className="portal-title"><PackageCheck/><h2>Vincular atención</h2></div><p>¿Te atendiste sin cuenta? Introduce el código de tu comprobante.</p><ClaimVisitForm/></section>
      <section className="portal-card"><div className="portal-title"><Star/><h2>Historial de puntos</h2></div><div className="portal-list">{transactions.data?.length?transactions.data.map(item=><article key={item.id}><div><strong>{item.reason}</strong><span>{new Intl.DateTimeFormat("es-BO",{dateStyle:"medium",timeZone:"America/La_Paz"}).format(new Date(item.created_at))}</span></div><b className={item.points>0?"points-positive":"points-negative"}>{item.points>0?"+":""}{item.points}</b></article>):<p className="portal-empty">Aún no tienes movimientos.</p>}</div></section>
      <section className="portal-card"><div className="portal-title"><Gift/><h2>Canjes activos</h2></div><div className="portal-list">{redemptions.data?.length?redemptions.data.map(item=><article key={item.id}><div><strong>{(item.rewards as unknown as {name?:string}|null)?.name}</strong><span>{item.status} · vence {new Intl.DateTimeFormat("es-BO",{dateStyle:"medium",timeZone:"America/La_Paz"}).format(new Date(item.expires_at))}</span></div><b>{item.code}</b>{item.status==="pending"&&<CancelRedemptionButton id={item.id}/>}</article>):<p className="portal-empty">No tienes canjes pendientes.</p>}</div></section>
      <section className="portal-card portal-wide"><div className="portal-title"><CalendarDays /><h2>Mis citas</h2><Link href="/reservar">Nueva reserva</Link></div><div className="portal-list">{appointments.data?.length ? appointments.data.map((item) => { const canCancel = ["requested","confirmed","pending_client_confirmation"].includes(item.status); return <article key={item.id}><div><strong>{item.service_name_snapshot}</strong><span>{new Intl.DateTimeFormat("es-BO", { dateStyle: "medium", timeStyle: "short", timeZone: "America/La_Paz" }).format(new Date(item.starts_at))} · {item.status}</span></div><b>Bs {item.price_snapshot}</b>{item.status === "pending_client_confirmation" && <ConfirmReassignmentButton id={item.id} />}{canCancel && <CancelAppointmentButton id={item.id} />}</article>; }) : <p className="portal-empty">Aún no tienes citas registradas.</p>}</div></section>
      <section className="portal-card"><div className="portal-title"><PackageCheck /><h2>Productos apartados</h2></div><div className="portal-list">{reservations.data?.length ? reservations.data.map((item) => <article key={item.id}><div><strong>{(item.products as unknown as { name?: string } | null)?.name ?? "Producto"}</strong><span>{item.quantity} unidad(es) · {item.status}</span></div></article>) : <p className="portal-empty">No tienes productos apartados.</p>}</div></section>
      <section className="portal-card"><div className="portal-title"><Bell /><h2>Notificaciones</h2></div><div className="portal-list">{notifications.data?.length ? notifications.data.map((item) => <article key={item.id}><div><strong>{item.title}</strong><span>{item.body}</span></div></article>) : <p className="portal-empty">No tienes avisos nuevos.</p>}</div></section>
      <section className="portal-card"><div className="portal-title"><Bell/><h2>Preferencias</h2></div><PreferencesForm userId={user.id} current={preferences.data}/></section>
    </div>
  </main>;
}
