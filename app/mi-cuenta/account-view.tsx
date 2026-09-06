import type { ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Bell, CalendarDays, ChevronRight, Flame, Gift, Globe2, PackageCheck, Star, UserRound } from "lucide-react";
import { Brand } from "@/components/brand";
import { ModeSwitcher } from "@/components/mode-switcher";
import { createClient } from "@/lib/supabase/server";
import { getUserCapabilities } from "@/lib/user-capabilities";
import { CancelAppointmentButton, ConfirmReassignmentButton } from "./appointment-actions";
import { CancelRedemptionButton, ClaimVisitForm, RewardButton } from "./loyalty-actions";
import { PreferencesForm } from "./preferences-form";
import { ReferralCode } from "./referral-code";
import {
  PanelExperience,
  PanelMobileLogout,
  PanelMobileMenuButton,
  PanelMobileScrim,
  PanelMobileSidebarClose,
  PanelThemeSelector,
} from "@/components/panel-experience";

export type ClientSection = "resumen" | "puntos" | "citas" | "productos" | "notificaciones" | "perfil";

const sectionCopy: Record<ClientSection, { eyebrow: string; title: string; description: string }> = {
  resumen: { eyebrow: "MODO CLIENTE", title: "Mi cuenta", description: "Todo lo importante, organizado en accesos rápidos." },
  puntos: { eyebrow: "FIDELIZACIÓN", title: "Puntos y recompensas", description: "Consulta tus puntos con cada peluquero, metas y canjes activos." },
  citas: { eyebrow: "AGENDA PERSONAL", title: "Mis citas", description: "Revisa próximas atenciones y gestiona cambios pendientes." },
  productos: { eyebrow: "COMPRAS", title: "Mis productos", description: "Consulta productos apartados o vincula una atención reciente." },
  notificaciones: { eyebrow: "CENTRO DE AVISOS", title: "Notificaciones", description: "Revisa novedades y decide qué comunicaciones quieres recibir." },
  perfil: { eyebrow: "CUENTA PERSONAL", title: "Mi perfil", description: "Consulta los datos asociados a tu cuenta LEGEND CLUB." },
};

export async function ClientAccountView({ section }: { section: ClientSection }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/mi-cuenta");
  const capabilities = await getUserCapabilities(user.id);
  if (capabilities.isAdmin) redirect("/admin");
  if (capabilities.isCashier) redirect("/caja");
  if (capabilities.barber) redirect("/barbero");

  await supabase.rpc("release_expired_reward_reservations");
  await supabase.rpc("refresh_my_barber_loyalty");
  const [profile, appointments, reservations, notifications, loyalty, transactions, rewards, redemptions, streak, preferences] = await Promise.all([
    supabase.from("profiles").select("full_name,email,phone,avatar_url,status,no_show_count,is_blacklisted,is_blocked,referral_code").eq("id", user.id).single(),
    supabase.from("appointments").select("id,starts_at,status,price_snapshot,service_name_snapshot,barber_profiles(display_name)").eq("client_id", user.id).order("starts_at", { ascending: false }).limit(20),
    supabase.from("product_reservations").select("id,quantity,status,expires_at,products(name)").eq("client_id", user.id).order("created_at", { ascending: false }).limit(10),
    supabase.from("notifications").select("id,title,body,read_at,created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(10),
    supabase.from("customer_barber_loyalty_accounts").select("barber_id,balance,lifetime_earned,lifetime_redeemed,barber_profiles(display_name)").eq("user_id", user.id).order("balance", { ascending: false }),
    supabase.from("loyalty_transactions").select("id,points,reason,created_at,barber_profiles(display_name)").eq("user_id", user.id).not("barber_id", "is", null).order("created_at", { ascending: false }).limit(20),
    supabase.from("rewards").select("id,name,description,points_cost,reward_type,reward_value").eq("active", true).order("points_cost"),
    supabase.from("reward_redemptions").select("id,code,status,expires_at,reward_name_snapshot,rewards(name),barber_profiles(display_name)").eq("user_id", user.id).eq("status", "pending").order("created_at", { ascending: false }).limit(10),
    supabase.from("customer_barber_streaks").select("barber_id,current_visits,best_visits,last_visit_at,barber_profiles(display_name)").eq("user_id", user.id).order("current_visits", { ascending: false }),
    supabase.from("notification_preferences").select("appointment_notifications,promotion_notifications,chat_notifications,system_notifications,muted_all").eq("user_id", user.id).maybeSingle(),
  ]);

  const person = profile.data;
  const barberBalances = (loyalty.data ?? []).map(item => ({ barberId: item.barber_id, barberName: (item.barber_profiles as unknown as { display_name?: string } | null)?.display_name ?? "Peluquero", balance: item.balance, lifetimeEarned: item.lifetime_earned }));
  const maxBalance = Math.max(0, ...barberBalances.map(item => Number(item.balance)));
  const allRewards = rewards.data ?? [];
  const affordableRewards = allRewards.filter(item => Number(item.points_cost) <= maxBalance);
  const nextReward = allRewards.find(item => Number(item.points_cost) > maxBalance);
  const visibleRewards = nextReward && !affordableRewards.some(item => item.id === nextReward.id) ? [...affordableRewards, nextReward] : affordableRewards;
  const activeAppointments = (appointments.data ?? []).filter(item => !["canceled", "completed", "no_show"].includes(item.status));
  const activeReservations = (reservations.data ?? []).filter(item => ["pending", "reserved"].includes(item.status));
  const unreadNotifications = (notifications.data ?? []).filter(item => !item.read_at).length;
  const copy = sectionCopy[section];
  const displayName = String(person?.full_name ?? user.email?.split("@")[0] ?? "Cliente");
  const avatarStyle = person?.avatar_url ? { backgroundImage: `url(${JSON.stringify(person.avatar_url)})` } : undefined;
  const initials = displayName.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join("").toUpperCase() || "LC";

  return <PanelExperience><main className="portal-shell panel-client-shell">
    <header className="portal-header">
      <PanelMobileMenuButton />
      <Brand linked={false} />
      <ModeSwitcher current="client" isAdmin={capabilities.isAdmin} hasBarber={Boolean(capabilities.barber)} isCashier={capabilities.isCashier} />
      <div className="client-desktop-actions"><PanelThemeSelector compact /><Link replace className="portal-public-link" href="/"><Globe2 /><span>Sitio público</span></Link></div>
    </header>
    <aside className="dash-sidebar client-mobile-sidebar" aria-label="Menú de mi cuenta">
      <div className="dash-sidebar-head"><p>MI CUENTA</p><PanelMobileSidebarClose /></div>
      <nav aria-label="Secciones de mi cuenta">
        <Link replace className={section === "resumen" ? "active" : ""} href="/mi-cuenta"><UserRound /><span>Resumen</span></Link>
        <Link replace className={section === "puntos" ? "active" : ""} href="/mi-cuenta/puntos"><Star /><span>Puntos y recompensas</span></Link>
        <Link replace className={section === "citas" ? "active" : ""} href="/mi-cuenta/citas"><CalendarDays /><span>Mis citas</span></Link>
        <Link replace className={section === "productos" ? "active" : ""} href="/mi-cuenta/productos"><PackageCheck /><span>Mis productos</span></Link>
        <Link replace className={section === "notificaciones" ? "active" : ""} href="/mi-cuenta/notificaciones"><Bell /><span>Notificaciones</span></Link>
        <Link replace className={section === "perfil" ? "active" : ""} href="/mi-cuenta/perfil"><UserRound /><span>Mi perfil</span></Link>
      </nav>
      <div className="dash-sidebar-foot"><PanelThemeSelector /><Link replace href="/"><Globe2 /><span>Sitio público</span></Link><PanelMobileLogout /></div>
    </aside>
    <PanelMobileScrim />
    <section className="portal-hero client-page-hero"><p className="eyebrow">{copy.eyebrow}</p><h1>{section === "resumen" ? `Hola, ${displayName}` : copy.title}</h1><p>{section === "resumen" ? "Elige una sección para consultar solo la información que necesitas." : copy.description}</p></section>

    {section === "resumen" && <div className="portal-grid client-app-menu">
      <ClientMenuCard href="/mi-cuenta/puntos" icon={<Star />} eyebrow="FIDELIZACIÓN" title="Puntos y recompensas" detail="Saldos por peluquero, beneficios y canjes." value={`${maxBalance} pts`} />
      <ClientMenuCard href="/mi-cuenta/citas" icon={<CalendarDays />} eyebrow="AGENDA" title="Mis citas" detail="Próximas atenciones y confirmaciones." value={`${activeAppointments.length}`} />
      <ClientMenuCard href="/mi-cuenta/productos" icon={<PackageCheck />} eyebrow="COMPRAS" title="Mis productos" detail="Apartados y vinculación de atenciones." value={`${activeReservations.length}`} />
      <ClientMenuCard href="/mi-cuenta/notificaciones" icon={<Bell />} eyebrow="AVISOS" title="Notificaciones" detail="Mensajes y preferencias de comunicación." value={`${unreadNotifications}`} />
      <ClientMenuCard href="/mi-cuenta/perfil" icon={<UserRound />} eyebrow="CUENTA" title="Mi perfil" detail="Datos personales y estado de tu cuenta." value={person?.phone ? "Completo" : "Revisar"} />
    </div>}

    {section === "puntos" && <div className="portal-grid client-section-grid">
      <section className="portal-card portal-wide"><div className="portal-title"><Star /><h2>Mis puntos por peluquero</h2></div><p>Cada atención suma únicamente con el profesional que realizó el servicio.</p><div className="barber-loyalty-grid">{barberBalances.length ? barberBalances.map(account => <article key={account.barberId}><span>{account.barberName}</span><strong>{account.balance}</strong><small>puntos disponibles · {account.lifetimeEarned} históricos</small></article>) : <p className="portal-empty">Aún no tienes puntos. Se acreditarán con el peluquero que te atienda.</p>}</div></section>
      <section className="portal-card"><div className="portal-title"><Flame /><h2>Rachas por peluquero</h2></div><div className="portal-list">{streak.data?.length ? streak.data.map(item => <article key={item.barber_id}><div><strong>{(item.barber_profiles as unknown as { display_name?: string } | null)?.display_name ?? "Peluquero"}</strong><span>Mejor racha: {item.best_visits}</span></div><b>{item.current_visits}</b></article>) : <p className="portal-empty">Aún no tienes rachas activas.</p>}</div></section>
      <section className="portal-card"><div className="portal-title"><Gift /><h2>Recomienda a un amigo</h2></div><p>Comparte tu código o QR. Los puntos se activan cuando tu referido completa y paga su primera atención.</p>{person?.referral_code && <ReferralCode code={person.referral_code} />}</section>
      <section className="portal-card portal-wide"><div className="portal-title"><Gift /><h2>Recompensas</h2></div><p>Mostramos las que ya puedes usar y la siguiente meta. Los puntos de distintos peluqueros no se mezclan.</p><div className="reward-grid">{visibleRewards.length ? visibleRewards.map(item => <article key={item.id}><div><strong>{item.name}</strong><span>{item.description}</span></div><RewardButton id={item.id} cost={item.points_cost} accounts={barberBalances} /></article>) : <p className="portal-empty">Las recompensas aparecerán aquí cuando el programa esté activo.</p>}</div></section>
      <section className="portal-card"><div className="portal-title"><Star /><h2>Historial de puntos</h2></div><div className="portal-list">{transactions.data?.length ? transactions.data.map(item => <article key={item.id}><div><strong>{item.reason}</strong><span>{(item.barber_profiles as unknown as { display_name?: string } | null)?.display_name ?? "Peluquero"} · {new Intl.DateTimeFormat("es-BO", { dateStyle: "medium", timeZone: "America/La_Paz" }).format(new Date(item.created_at))}</span></div><b className={item.points > 0 ? "points-positive" : "points-negative"}>{item.points > 0 ? "+" : ""}{item.points}</b></article>) : <p className="portal-empty">Aún no tienes movimientos.</p>}</div></section>
      <section className="portal-card"><div className="portal-title"><Gift /><h2>Canjes activos</h2></div><div className="portal-list">{redemptions.data?.length ? redemptions.data.map(item => <article key={item.id}><div><strong>{item.reward_name_snapshot || (item.rewards as unknown as { name?: string } | null)?.name}</strong><span>Con {(item.barber_profiles as unknown as { display_name?: string } | null)?.display_name ?? "el peluquero asignado"} · vence {new Intl.DateTimeFormat("es-BO", { dateStyle: "short", timeStyle: "short", timeZone: "America/La_Paz" }).format(new Date(item.expires_at))}</span></div><b>{item.code}</b><CancelRedemptionButton id={item.id} /></article>) : <p className="portal-empty">No tienes canjes pendientes.</p>}</div></section>
    </div>}

    {section === "citas" && <div className="portal-grid client-section-grid"><section className="portal-card portal-wide"><div className="portal-title"><CalendarDays /><h2>Atenciones registradas</h2><Link href="/reservar?return=%2Fmi-cuenta%2Fcitas">Nueva reserva</Link></div><div className="portal-list">{appointments.data?.length ? appointments.data.map(item => { const canCancel = ["requested", "confirmed", "pending_client_confirmation"].includes(item.status); return <article key={item.id}><div><strong>{item.service_name_snapshot}</strong><span>{new Intl.DateTimeFormat("es-BO", { dateStyle: "medium", timeStyle: "short", timeZone: "America/La_Paz" }).format(new Date(item.starts_at))} · {item.status}</span></div><b>Bs {item.price_snapshot}</b>{item.status === "pending_client_confirmation" && <ConfirmReassignmentButton id={item.id} />}{canCancel && <CancelAppointmentButton id={item.id} />}</article>; }) : <p className="portal-empty">Aún no tienes citas registradas.</p>}</div></section></div>}

    {section === "productos" && <div className="portal-grid client-section-grid">
      <section className="portal-card"><div className="portal-title"><PackageCheck /><h2>Vincular atención</h2></div><p>¿Te atendiste sin cuenta? Introduce el código de tu comprobante.</p><ClaimVisitForm /></section>
      <section className="portal-card"><div className="portal-title"><PackageCheck /><h2>Productos apartados</h2></div><div className="portal-list">{reservations.data?.length ? reservations.data.map(item => <article key={item.id}><div><strong>{(item.products as unknown as { name?: string } | null)?.name ?? "Producto"}</strong><span>{item.quantity} unidad(es) · {item.status}</span></div></article>) : <p className="portal-empty">No tienes productos apartados.</p>}</div></section>
    </div>}

    {section === "notificaciones" && <div className="portal-grid client-section-grid">
      <section className="portal-card portal-wide"><div className="portal-title"><Bell /><h2>Avisos recientes</h2></div><div className="portal-list">{notifications.data?.length ? notifications.data.map(item => <article key={item.id}><div><strong>{item.title}</strong><span>{item.body}</span></div></article>) : <p className="portal-empty">No tienes avisos nuevos.</p>}</div></section>
      <section className="portal-card portal-wide"><div className="portal-title"><Bell /><h2>Preferencias</h2></div><PreferencesForm userId={user.id} current={preferences.data} /></section>
    </div>}

    {section === "perfil" && <div className="portal-grid client-section-grid"><section className="portal-card portal-wide client-profile-card">
      <div className="client-profile-identity"><div className={`client-profile-avatar ${person?.avatar_url ? "has-photo" : ""}`} style={avatarStyle}>{!person?.avatar_url && initials}</div><div><small>CLIENTE LEGEND</small><h2>{displayName}</h2><p>{person?.email}</p></div></div>
      <dl><div><dt>Correo</dt><dd>{person?.email}</dd></div><div><dt>Teléfono</dt><dd>{person?.phone ?? "Pendiente de registrar"}</dd></div><div><dt>Estado</dt><dd>{person?.status === "active" ? "Activo" : person?.status}</dd></div><div><dt>Inasistencias</dt><dd>{person?.no_show_count ?? 0}</dd></div></dl>
      {person?.is_blacklisted && <p className="portal-warning">La cuenta tiene una alerta por inasistencias.</p>}{person?.is_blocked && <p className="portal-error">Las nuevas reservas están bloqueadas. Contacta al negocio.</p>}
    </section></div>}
  </main></PanelExperience>;
}

function ClientMenuCard({ href, icon, eyebrow, title, detail, value }: { href: string; icon: ReactNode; eyebrow: string; title: string; detail: string; value: string }) {
  return <Link replace className="client-menu-card" href={href}>{icon}<span><small>{eyebrow}</small><h2>{title}</h2><p>{detail}</p></span><b>{value}</b><ChevronRight /></Link>;
}
