import Link from "next/link";
import { redirect } from "next/navigation";
import { Bell, CalendarDays, Flame, Gift, Globe2, Home, PackageCheck, Scissors, Star, UserRound } from "lucide-react";
import { Brand } from "@/components/brand";
import { ModeSwitcher } from "@/components/mode-switcher";
import { ProductCatalog } from "@/components/product-catalog";
import { createClient } from "@/lib/supabase/server";
import { getUserCapabilities } from "@/lib/user-capabilities";
import { getPublicProducts, type PublicProduct } from "@/lib/public-data";
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
  PanelViewportPortal,
} from "@/components/panel-experience";

export type ClientSection = "inicio" | "puntos" | "citas" | "productos" | "notificaciones" | "perfil";

const sectionCopy: Record<ClientSection, { eyebrow: string; title: string; description: string }> = {
  inicio: { eyebrow: "MODO CLIENTE", title: "Inicio", description: "Tu actividad, beneficios y próximos pasos en un solo lugar." },
  puntos: { eyebrow: "FIDELIZACIÓN", title: "Puntos y recompensas", description: "Consulta tus puntos con cada peluquero, metas y canjes activos." },
  citas: { eyebrow: "AGENDA PERSONAL", title: "Mis citas", description: "Revisa próximas atenciones y gestiona cambios pendientes." },
  productos: { eyebrow: "CATÁLOGO", title: "Mis productos", description: "Explora el catálogo disponible y aparta tus productos para recogerlos en el local." },
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

  if (section === "inicio" || section === "puntos") await supabase.rpc("refresh_my_barber_loyalty");
  if (section === "puntos") await supabase.rpc("release_expired_reward_reservations");
  const activeReservationCutoff = new Date().toISOString();
  const [profile, appointments, reservations, notifications, loyalty, transactions, rewards, redemptions, streak, preferences, availableProducts] = await Promise.all([
    supabase.from("profiles").select("full_name,email,phone,avatar_url,status,no_show_count,is_blacklisted,is_blocked,referral_code").eq("id", user.id).single(),
    ["inicio", "citas"].includes(section) ? supabase.from("appointments").select("id,starts_at,status,price_snapshot,service_name_snapshot,barber_profiles(display_name)").eq("client_id", user.id).order("starts_at", { ascending: false }).limit(20) : Promise.resolve({ data: [] }),
    ["inicio", "productos"].includes(section) ? supabase.from("product_reservations").select("id,quantity,status,expires_at,products(name)").eq("client_id", user.id).eq("status", "reserved").gt("expires_at", activeReservationCutoff).order("created_at", { ascending: false }).limit(10) : Promise.resolve({ data: [] }),
    supabase.from("notifications").select("id,title,body,read_at,created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(10),
    ["inicio", "puntos"].includes(section) ? supabase.from("customer_barber_loyalty_accounts").select("barber_id,balance,lifetime_earned,lifetime_redeemed,barber_profiles(display_name)").eq("user_id", user.id).order("balance", { ascending: false }) : Promise.resolve({ data: [] }),
    section === "puntos" ? supabase.from("loyalty_transactions").select("id,points,reason,created_at,barber_profiles(display_name)").eq("user_id", user.id).not("barber_id", "is", null).order("created_at", { ascending: false }).limit(20) : Promise.resolve({ data: [] }),
    section === "puntos" ? supabase.from("rewards").select("id,name,description,points_cost,reward_type,reward_value").eq("active", true).order("points_cost") : Promise.resolve({ data: [] }),
    section === "puntos" ? supabase.from("reward_redemptions").select("id,code,status,expires_at,reward_name_snapshot,rewards(name),barber_profiles(display_name)").eq("user_id", user.id).eq("status", "pending").order("created_at", { ascending: false }).limit(10) : Promise.resolve({ data: [] }),
    section === "puntos" ? supabase.from("customer_barber_streaks").select("barber_id,current_visits,best_visits,last_visit_at,barber_profiles(display_name)").eq("user_id", user.id).order("current_visits", { ascending: false }) : Promise.resolve({ data: [] }),
    section === "notificaciones" ? supabase.from("notification_preferences").select("appointment_notifications,promotion_notifications,chat_notifications,system_notifications,muted_all").eq("user_id", user.id).maybeSingle() : Promise.resolve({ data: null }),
    getPublicProducts(section === "productos" ? undefined : 3),
  ]);

  const person = profile.data;
  const barberBalances = (loyalty.data ?? []).map(item => ({ barberId: item.barber_id, barberName: (item.barber_profiles as unknown as { display_name?: string } | null)?.display_name ?? "Peluquero", balance: item.balance, lifetimeEarned: item.lifetime_earned }));
  const maxBalance = Math.max(0, ...barberBalances.map(item => Number(item.balance)));
  const allRewards = rewards.data ?? [];
  const affordableRewards = allRewards.filter(item => Number(item.points_cost) <= maxBalance);
  const nextReward = allRewards.find(item => Number(item.points_cost) > maxBalance);
  const visibleRewards = nextReward && !affordableRewards.some(item => item.id === nextReward.id) ? [...affordableRewards, nextReward] : affordableRewards;
  const activeAppointments = (appointments.data ?? []).filter(item => !["canceled", "completed", "no_show"].includes(item.status));
  const activeReservations = reservations.data ?? [];
  const unreadNotifications = (notifications.data ?? []).filter(item => !item.read_at).length;
  const copy = sectionCopy[section];
  const displayName = String(person?.full_name ?? user.email?.split("@")[0] ?? "Cliente");
  const avatarStyle = person?.avatar_url ? { backgroundImage: `url(${JSON.stringify(person.avatar_url)})` } : undefined;
  const initials = displayName.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join("").toUpperCase() || "LC";
  const replaceNavigation = section !== "inicio";

  return <PanelExperience clientChatInHeader><main className="portal-shell panel-client-shell">
    <header className="portal-header">
      <PanelMobileMenuButton />
      <Brand linked={false} />
      <ClientMainNavigation section={section} replaceNavigation={replaceNavigation} variant="desktop" />
      <ModeSwitcher current="client" isAdmin={capabilities.isAdmin} hasBarber={Boolean(capabilities.barber)} isCashier={capabilities.isCashier} />
      <div className="client-desktop-actions"><PanelThemeSelector compact /><Link replace className="portal-public-link" href="/"><Globe2 /><span>Sitio público</span></Link></div>
    </header>
    <aside className="dash-sidebar client-mobile-sidebar" aria-label="Menú de mi cuenta">
      <div className="dash-sidebar-head"><p>MI CUENTA</p><PanelMobileSidebarClose /></div>
      <nav aria-label="Opciones adicionales">
        <Link replace={replaceNavigation} className={section === "notificaciones" ? "active" : ""} href="/mi-cuenta/notificaciones"><Bell /><span>Notificaciones</span>{unreadNotifications > 0 && <b className="client-nav-badge">{unreadNotifications}</b>}</Link>
      </nav>
      <div className="dash-sidebar-foot"><PanelThemeSelector /><Link replace href="/"><Globe2 /><span>Sitio público</span></Link><PanelMobileLogout /></div>
    </aside>
    <PanelMobileScrim />
    <section className="portal-hero client-page-hero"><p className="eyebrow">{copy.eyebrow}</p><h1>{section === "inicio" ? `Hola, ${displayName}` : copy.title}</h1><p>{copy.description}</p></section>

    {section === "inicio" && <div className="portal-grid client-home-dashboard">
      <section className="portal-card portal-wide client-home-overview">
        <div className="client-home-heading"><div><small>RESUMEN DE HOY</small><h2>Todo listo para tu próxima visita.</h2><p>Reserva una atención, revisa tus beneficios o aparta un producto desde tu cuenta.</p></div><Link href="/reservar?return=%2Fmi-cuenta">Reservar cita <Scissors /></Link></div>
        <div className="client-home-kpis">
          <Link href="/mi-cuenta/puntos"><Star /><span><strong>{maxBalance}</strong> puntos disponibles</span></Link>
          <Link href="/mi-cuenta/citas"><CalendarDays /><span><strong>{activeAppointments.length}</strong> {activeAppointments.length === 1 ? "cita activa" : "citas activas"}</span></Link>
          <Link href="/mi-cuenta/productos"><PackageCheck /><span><strong>{activeReservations.length}</strong> {activeReservations.length === 1 ? "producto apartado" : "productos apartados"}</span></Link>
        </div>
      </section>
    </div>}

    {section === "puntos" && <div className="portal-grid client-section-grid">
      <section className="portal-card portal-wide"><div className="portal-title"><Star /><h2>Mis puntos por peluquero</h2></div><p>Cada atención suma únicamente con el profesional que realizó el servicio.</p><div className="barber-loyalty-grid">{barberBalances.length ? barberBalances.map(account => <article key={account.barberId}><span>{account.barberName}</span><strong>{account.balance}</strong><small>puntos disponibles · {account.lifetimeEarned} históricos</small></article>) : <p className="portal-empty">Aún no tienes puntos. Se acreditarán con el peluquero que te atienda.</p>}</div></section>
      <section className="portal-card"><div className="portal-title"><Flame /><h2>Rachas por peluquero</h2></div><div className="portal-list">{streak.data?.length ? streak.data.map(item => <article key={item.barber_id}><div><strong>{(item.barber_profiles as unknown as { display_name?: string } | null)?.display_name ?? "Peluquero"}</strong><span>Mejor racha: {item.best_visits}</span></div><b>{item.current_visits}</b></article>) : <p className="portal-empty">Aún no tienes rachas activas.</p>}</div></section>
      <section className="portal-card"><div className="portal-title"><Gift /><h2>Recomienda a un amigo</h2></div><p>Comparte tu código o QR. Los puntos se activan cuando tu referido completa y paga su primera atención.</p>{person?.referral_code && <ReferralCode code={person.referral_code} />}</section>
      <section className="portal-card"><div className="portal-title"><PackageCheck /><h2>Vincular atención</h2></div><p>¿Te atendiste sin cuenta? Introduce el código de tu comprobante para incorporar esa visita.</p><ClaimVisitForm /></section>
      <section className="portal-card portal-wide"><div className="portal-title"><Gift /><h2>Recompensas</h2></div><p>Mostramos las que ya puedes usar y la siguiente meta. Los puntos de distintos peluqueros no se mezclan.</p><div className="reward-grid">{visibleRewards.length ? visibleRewards.map(item => <article key={item.id}><div><strong>{item.name}</strong><span>{item.description}</span></div><RewardButton id={item.id} cost={item.points_cost} accounts={barberBalances} /></article>) : <p className="portal-empty">Las recompensas aparecerán aquí cuando el programa esté activo.</p>}</div></section>
      <section className="portal-card"><div className="portal-title"><Star /><h2>Historial de puntos</h2></div><div className="portal-list">{transactions.data?.length ? transactions.data.map(item => <article key={item.id}><div><strong>{item.reason}</strong><span>{(item.barber_profiles as unknown as { display_name?: string } | null)?.display_name ?? "Peluquero"} · {new Intl.DateTimeFormat("es-BO", { dateStyle: "medium", timeZone: "America/La_Paz" }).format(new Date(item.created_at))}</span></div><b className={item.points > 0 ? "points-positive" : "points-negative"}>{item.points > 0 ? "+" : ""}{item.points}</b></article>) : <p className="portal-empty">Aún no tienes movimientos.</p>}</div></section>
      <section className="portal-card"><div className="portal-title"><Gift /><h2>Canjes activos</h2></div><div className="portal-list">{redemptions.data?.length ? redemptions.data.map(item => <article key={item.id}><div><strong>{item.reward_name_snapshot || (item.rewards as unknown as { name?: string } | null)?.name}</strong><span>Con {(item.barber_profiles as unknown as { display_name?: string } | null)?.display_name ?? "el peluquero asignado"} · vence {new Intl.DateTimeFormat("es-BO", { dateStyle: "short", timeStyle: "short", timeZone: "America/La_Paz" }).format(new Date(item.expires_at))}</span></div><b>{item.code}</b><CancelRedemptionButton id={item.id} /></article>) : <p className="portal-empty">No tienes canjes pendientes.</p>}</div></section>
    </div>}

    {section === "citas" && <div className="portal-grid client-section-grid"><section className="portal-card portal-wide"><div className="portal-title"><CalendarDays /><h2>Atenciones registradas</h2><Link href="/reservar?return=%2Fmi-cuenta%2Fcitas">Nueva reserva</Link></div><div className="portal-list">{appointments.data?.length ? appointments.data.map(item => { const canCancel = ["requested", "confirmed", "pending_client_confirmation"].includes(item.status); return <article key={item.id}><div><strong>{item.service_name_snapshot}</strong><span>{new Intl.DateTimeFormat("es-BO", { dateStyle: "medium", timeStyle: "short", timeZone: "America/La_Paz" }).format(new Date(item.starts_at))} · {item.status}</span></div><b>Bs {item.price_snapshot}</b>{item.status === "pending_client_confirmation" && <ConfirmReassignmentButton id={item.id} />}{canCancel && <CancelAppointmentButton id={item.id} />}</article>; }) : <p className="portal-empty">Aún no tienes citas registradas.</p>}</div></section></div>}

    {section === "productos" && <div className="portal-grid client-section-grid client-products-page">
      <section className="portal-card portal-wide client-reservations-card"><div className="portal-title"><PackageCheck /><h2>Mis productos apartados</h2></div><div className="portal-list">{reservations.data?.length ? reservations.data.map(item => <article key={item.id}><div><strong>{(item.products as unknown as { name?: string } | null)?.name ?? "Producto"}</strong><span>{item.quantity} unidad(es) · {item.status === "reserved" ? "apartado" : item.status}</span></div><b>Vence {new Intl.DateTimeFormat("es-BO", { dateStyle: "short", timeStyle: "short", timeZone: "America/La_Paz" }).format(new Date(item.expires_at))}</b></article>) : <p className="portal-empty">No tienes productos apartados.</p>}</div></section>
      <section className="portal-card portal-wide client-catalog-card"><div className="portal-title"><PackageCheck /><div><small>DISPONIBLES AHORA</small><h2>Todos los productos</h2></div></div><p>Selecciona un producto para ver sus fotos y detalles. Puedes apartarlo durante 24 horas y pagarlo al recogerlo.</p><ProductCatalog products={availableProducts} variant="catalog" /></section>
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
    {section !== "productos" && <ClientPromoRail products={availableProducts} replaceNavigation={replaceNavigation} />}
  </main><PanelViewportPortal><ClientMainNavigation section={section} replaceNavigation={replaceNavigation} variant="mobile" /></PanelViewportPortal></PanelExperience>;
}

const clientMainNavigation = [
  { id: "inicio", href: "/mi-cuenta", label: "Inicio", icon: Home },
  { id: "productos", href: "/mi-cuenta/productos", label: "Mis productos", icon: PackageCheck },
  { id: "puntos", href: "/mi-cuenta/puntos", label: "Mis puntos", icon: Star },
  { id: "citas", href: "/mi-cuenta/citas", label: "Mis citas", icon: CalendarDays },
  { id: "perfil", href: "/mi-cuenta/perfil", label: "Mi perfil", icon: UserRound },
] as const;

function ClientMainNavigation({ section, replaceNavigation, variant }: { section: ClientSection; replaceNavigation: boolean; variant: "desktop" | "mobile" }) {
  return <nav className={variant === "mobile" ? "client-bottom-nav" : "client-desktop-nav"} aria-label={variant === "mobile" ? "Navegación principal" : "Páginas de mi cuenta"}>
    {clientMainNavigation.map(item => { const Icon = item.icon; const active = section === item.id; return <Link key={item.id} href={item.href} replace={replaceNavigation} aria-label={item.label} aria-current={active ? "page" : undefined} className={active ? "active" : ""}><Icon /><span>{item.label}</span><i /></Link>; })}
  </nav>;
}

function ClientPromoRail({ products, replaceNavigation }: { products: PublicProduct[]; replaceNavigation: boolean }) {
  const featured = products.filter(product => product.image).slice(0, 3);
  return <section className="client-promo-shell" aria-labelledby="client-promo-title">
    <div className="client-promo-heading"><div><small>SELECCIÓN LEGEND</small><h2 id="client-promo-title">Productos para tu estilo</h2></div><Link href="/mi-cuenta/productos" replace={replaceNavigation}>Ver catálogo</Link></div>
    <div className="client-promo-grid">
      {featured.length ? featured.map(product => <Link href="/mi-cuenta/productos" replace={replaceNavigation} key={product.id} className="client-promo-card" style={{ backgroundImage: `linear-gradient(180deg,transparent 35%,rgba(5,12,29,.9)),url(${JSON.stringify(product.image)})` }}><span>{product.category}</span><strong>{product.name}</strong><small>Bs {product.price}</small></Link>) : <Link href="/mi-cuenta/productos" replace={replaceNavigation} className="client-promo-card client-promo-fallback"><span>LEGEND CLUB</span><strong>Cuida tu estilo también en casa</strong><small>Explorar productos</small></Link>}
    </div>
  </section>;
}
