import Link from "next/link";
import { redirect } from "next/navigation";
import { Bell, CalendarDays, Gift, Globe2, Home, PackageCheck, Scissors, Star, UserRound } from "lucide-react";
import { Brand } from "@/components/brand";
import { BusinessStatus } from "@/components/business-status";
import { ModeSwitcher } from "@/components/mode-switcher";
import { ProductCatalog } from "@/components/product-catalog";
import { createClient } from "@/lib/supabase/server";
import { getUserCapabilities } from "@/lib/user-capabilities";
import { getPublicGallery, getPublicProducts, type PublicGalleryItem } from "@/lib/public-data";
import { DEFAULT_BUSINESS_TIMEZONE, resolveBusinessStatus, type BusinessHour } from "@/lib/business-hours";
import { CancelAppointmentButton, ConfirmReassignmentButton } from "./appointment-actions";
import { ClaimVisitForm } from "./loyalty-actions";
import { PreferencesForm } from "./preferences-form";
import { PushNotificationSetup } from "@/components/push-notification-setup";
import { ReferralCode } from "./referral-code";
import {
  PanelExperience,
  PanelMobileLogout,
  PanelThemeSelector,
  PanelViewportPortal,
} from "@/components/panel-experience";
import { CLIENT_NAVIGATION, type ClientSection } from "./contracts";

const sectionCopy: Record<ClientSection, { eyebrow: string; title: string; description: string }> = {
  inicio: { eyebrow: "MODO CLIENTE", title: "Inicio", description: "Tu actividad, beneficios y próximos pasos en un solo lugar." },
  puntos: { eyebrow: "FIDELIZACIÓN", title: "Puntos y recompensas", description: "Consulta tus puntos con cada peluquero, metas y canjes activos." },
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
  const activeReservationCutoff = new Date().toISOString();
  const [profile, appointments, reservations, notifications, loyalty, transactions, preferences, availableProducts, businessSettings, businessHours, gallery] = await Promise.all([
    supabase.from("profiles").select("full_name,email,phone,avatar_url,status,no_show_count,is_blacklisted,is_blocked,referral_code").eq("id", user.id).single(),
    section === "inicio" ? supabase.from("appointments").select("id,starts_at,status,price_snapshot,service_name_snapshot,barber_name_snapshot,barber_profiles(display_name)").eq("client_id", user.id).order("starts_at", { ascending: false }).limit(5) : Promise.resolve({ data: [] }),
    ["inicio", "productos"].includes(section) ? supabase.from("product_reservations").select("id,quantity,status,expires_at,products(name)").eq("client_id", user.id).eq("status", "reserved").gt("expires_at", activeReservationCutoff).order("created_at", { ascending: false }).limit(10) : Promise.resolve({ data: [] }),
    supabase.from("notifications").select("id,title,body,read_at,created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(10),
    ["inicio", "puntos"].includes(section) ? supabase.from("customer_barber_loyalty_accounts").select("barber_id,balance,lifetime_earned,lifetime_redeemed,barber_profiles(display_name)").eq("user_id", user.id).order("balance", { ascending: false }) : Promise.resolve({ data: [] }),
    section === "puntos" ? supabase.from("loyalty_transactions").select("id,points,reason,created_at,barber_id_snapshot,barber_profiles(display_name)").eq("user_id", user.id).or("barber_id.not.is.null,barber_id_snapshot.not.is.null").order("created_at", { ascending: false }).limit(20) : Promise.resolve({ data: [] }),
    section === "notificaciones" ? supabase.from("notification_preferences").select("appointment_notifications,promotion_notifications,chat_notifications,system_notifications,muted_all").eq("user_id", user.id).maybeSingle() : Promise.resolve({ data: null }),
    section === "productos" ? getPublicProducts() : Promise.resolve([]),
    supabase.from("business_settings").select("business_status,status_message,timezone").eq("id", true).maybeSingle(),
    supabase.from("business_hours").select("*").order("weekday"),
    section === "inicio" ? getPublicGallery() : Promise.resolve([]),
  ]);

  const person = profile.data;
  const barberBalances = (loyalty.data ?? []).map(item => ({ barberId: item.barber_id, barberName: (item.barber_profiles as unknown as { display_name?: string } | null)?.display_name ?? "Peluquero", balance: item.balance, lifetimeEarned: item.lifetime_earned }));
  const maxBalance = Math.max(0, ...barberBalances.map(item => Number(item.balance)));
  const activeAppointments = (appointments.data ?? []).filter(item => !["canceled", "completed", "no_show"].includes(item.status));
  const activeReservations = reservations.data ?? [];
  const copy = sectionCopy[section];
  const displayName = String(person?.full_name ?? user.email?.split("@")[0] ?? "Cliente");
  const avatarStyle = person?.avatar_url ? { backgroundImage: `url(${JSON.stringify(person.avatar_url)})` } : undefined;
  const initials = displayName.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join("").toUpperCase() || "LC";
  const replaceNavigation = section !== "inicio";
  const clientBusinessHours = (businessHours.data ?? []) as BusinessHour[];
  const clientBusinessTimezone = String(businessSettings.data?.timezone ?? DEFAULT_BUSINESS_TIMEZONE);
  const clientConfiguredStatus = String(businessSettings.data?.business_status ?? "open");
  const clientInitialStatus = resolveBusinessStatus(clientConfiguredStatus, clientBusinessHours, clientBusinessTimezone);

  return <PanelExperience chatInHeader><main className="portal-shell panel-client-shell">
    <section className="client-page-hero">
      <div className="client-hero-shade" />
      <div className="client-hero-top"><Brand linked={false} /><div className="client-hero-actions"><PanelThemeSelector compact /><ModeSwitcher current="client" isAdmin={capabilities.isAdmin} hasBarber={Boolean(capabilities.barber)} isCashier={capabilities.isCashier} /></div></div>
      <div className="client-hero-content"><BusinessStatus configuredStatus={clientConfiguredStatus} initialStatus={clientInitialStatus} statusMessage={String(businessSettings.data?.status_message ?? "")} timezone={clientBusinessTimezone} hours={clientBusinessHours} variant="client" /><p className="eyebrow">{copy.eyebrow}</p><h1>{section === "inicio" ? `Hola, ${displayName}` : copy.title}</h1><p>{section === "inicio" ? "Tu próxima visita, tus beneficios y tu estilo en un solo lugar." : copy.description}</p></div>
      <Link className="client-hero-public-link" href="/sitio"><Globe2 /><span>Ver sitio público</span></Link>
    </section>

    {section === "inicio" && <div className="portal-grid client-home-dashboard">
      <section className="portal-card portal-wide client-home-overview">
        <div className="client-home-heading"><div><small>MI CUENTA</small><h2>¿Qué necesitas hacer?</h2></div><Link href="/reservar?return=%2Fmi-cuenta">Reservar <Scissors /></Link></div>
        <div className="client-home-kpis">
          <Link href="/mi-cuenta/puntos"><Star /><span><strong>{maxBalance}</strong> puntos disponibles</span></Link>
          <Link href="/mi-cuenta/productos"><PackageCheck /><span><strong>{activeReservations.length}</strong> {activeReservations.length === 1 ? "producto apartado" : "productos apartados"}</span></Link>
        </div>
      </section>
      <section className="portal-card portal-wide client-next-appointment">
        <div className="portal-title"><CalendarDays /><div><small>MI PRÓXIMA VISITA</small><h2>{activeAppointments[0] ? "Cita confirmada" : "Aún no tienes una cita"}</h2></div></div>
        {activeAppointments[0] ? (() => { const appointment = activeAppointments[0]; const barberName = (appointment.barber_profiles as unknown as { display_name?: string } | null)?.display_name ?? appointment.barber_name_snapshot; const canCancel = ["requested", "confirmed", "pending_client_confirmation"].includes(appointment.status); return <div className="client-appointment-summary"><div><strong>{appointment.service_name_snapshot}</strong><span>{new Intl.DateTimeFormat("es-BO", { dateStyle: "full", timeStyle: "short", timeZone: clientBusinessTimezone }).format(new Date(appointment.starts_at))}{barberName ? ` · ${barberName}` : ""}</span></div><b>Bs {appointment.price_snapshot}</b><div className="client-appointment-actions">{appointment.status === "pending_client_confirmation" && <ConfirmReassignmentButton id={appointment.id} />}{canCancel && <CancelAppointmentButton id={appointment.id} />}</div></div>; })() : <div className="client-empty-appointment"><p>Agenda tu próximo corte y lo verás aquí.</p><Link className="button button-dark" href="/reservar?return=%2Fmi-cuenta">Reservar cita <Scissors /></Link></div>}
      </section>
      <ClientWorkShowcase items={gallery as PublicGalleryItem[]} />
    </div>}

    {section === "puntos" && <div className="portal-grid client-section-grid">
      <section className="portal-card portal-wide"><div className="portal-title"><Star /><h2>Puntos por peluquero</h2></div><div className="barber-loyalty-grid">{barberBalances.length ? barberBalances.map(account => <article key={account.barberId}><span>{account.barberName}</span><strong>{account.balance}</strong><small>disponibles</small></article>) : <p className="portal-empty">Aún no tienes puntos.</p>}</div></section>
      <section className="portal-card"><div className="portal-title"><Gift /><h2>Recomendar</h2></div>{person?.referral_code && <ReferralCode code={person.referral_code} />}</section>
      <section className="portal-card"><div className="portal-title"><PackageCheck /><h2>Agregar una visita</h2></div><ClaimVisitForm /></section>
      <section className="portal-card"><div className="portal-title"><Star /><h2>Historial de puntos</h2></div><div className="portal-list">{transactions.data?.length ? transactions.data.map(item => <article key={item.id}><div><strong>{item.reason}</strong><span>{(item.barber_profiles as unknown as { display_name?: string } | null)?.display_name ?? (item.barber_id_snapshot ? "Peluquero eliminado" : "Peluquero")} · {new Intl.DateTimeFormat("es-BO", { dateStyle: "medium", timeZone: clientBusinessTimezone }).format(new Date(item.created_at))}</span></div><b className={item.points > 0 ? "points-positive" : "points-negative"}>{item.points > 0 ? "+" : ""}{item.points}</b></article>) : <p className="portal-empty">Aún no tienes movimientos.</p>}</div></section>
    </div>}

    {section === "productos" && <div className="portal-grid client-section-grid client-products-page">
      <section className="portal-card portal-wide client-reservations-card"><div className="portal-title"><PackageCheck /><h2>Mis productos apartados</h2></div><div className="portal-list">{reservations.data?.length ? reservations.data.map(item => <article key={item.id}><div><strong>{(item.products as unknown as { name?: string } | null)?.name ?? "Producto"}</strong><span>{item.quantity} unidad(es) · {item.status === "reserved" ? "apartado" : item.status}</span></div><b>Vence {new Intl.DateTimeFormat("es-BO", { dateStyle: "short", timeStyle: "short", timeZone: clientBusinessTimezone }).format(new Date(item.expires_at))}</b></article>) : <p className="portal-empty">No tienes productos apartados.</p>}</div></section>
      <section className="portal-card portal-wide client-catalog-card"><div className="portal-title"><PackageCheck /><h2>Catálogo</h2></div><ProductCatalog products={availableProducts} variant="catalog" /></section>
    </div>}

    {section === "notificaciones" && <div className="portal-grid client-section-grid">
      <section className="portal-card portal-wide"><div className="portal-title"><Bell /><h2>Avisos recientes</h2></div><div className="portal-list">{notifications.data?.length ? notifications.data.map(item => <article key={item.id}><div><strong>{item.title}</strong><span>{item.body}</span></div></article>) : <p className="portal-empty">No tienes avisos nuevos.</p>}</div></section>
      <section className="portal-card portal-wide"><div className="portal-title"><Bell /><h2>Preferencias</h2></div><PreferencesForm userId={user.id} current={preferences.data} /><PushNotificationSetup userId={user.id} /></section>
    </div>}

    {section === "perfil" && <div className="portal-grid client-section-grid"><section className="portal-card portal-wide client-profile-card">
      <div className="client-profile-identity"><div className={`client-profile-avatar ${person?.avatar_url ? "has-photo" : ""}`} style={avatarStyle}>{!person?.avatar_url && initials}</div><div><small>CLIENTE LEGEND</small><h2>{displayName}</h2><p>{person?.email}</p></div></div>
      <dl><div><dt>Correo</dt><dd>{person?.email}</dd></div><div><dt>Teléfono</dt><dd>{person?.phone ?? "Pendiente de registrar"}</dd></div><div><dt>Estado</dt><dd>{person?.status === "active" ? "Activo" : person?.status}</dd></div><div><dt>Inasistencias</dt><dd>{person?.no_show_count ?? 0}</dd></div></dl>
      {person?.is_blacklisted && <p className="portal-warning">La cuenta tiene una alerta por inasistencias.</p>}{person?.is_blocked && <p className="portal-error">Las nuevas reservas están bloqueadas. Contacta al negocio.</p>}
      <div className="client-profile-actions"><PanelThemeSelector /><Link href="/sitio"><Globe2 /><span>Sitio público</span></Link><PanelMobileLogout /></div>
    </section></div>}
  </main>
  <PanelViewportPortal>
    <ClientMainNavigation section={section} replaceNavigation={replaceNavigation} variant="mobile" />
  </PanelViewportPortal></PanelExperience>;
}

const clientNavigationIcons = { inicio: Home, productos: PackageCheck, puntos: Star, perfil: UserRound } as const;

function ClientMainNavigation({ section, replaceNavigation, variant }: { section: ClientSection; replaceNavigation: boolean; variant: "desktop" | "mobile" }) {
  return <nav className={variant === "mobile" ? "panel-bottom-nav client-bottom-nav" : "client-desktop-nav"} aria-label={variant === "mobile" ? "Navegación principal" : "Páginas de mi cuenta"}>
    {CLIENT_NAVIGATION.map(item => { const Icon = clientNavigationIcons[item.id]; const active = section === item.id; return <Link key={item.id} href={item.href} replace={replaceNavigation} aria-label={item.label} aria-current={active ? "page" : undefined} className={active ? "active" : ""}><Icon /><span>{item.label}</span><i /></Link>; })}
  </nav>;
}

function ClientWorkShowcase({ items }: { items: PublicGalleryItem[] }) {
  return <section className="portal-card portal-wide client-work-showcase" aria-labelledby="client-work-title">
    <div className="portal-title"><div><small>INSPIRACIÓN LEGEND</small><h2 id="client-work-title">Trabajos con firma propia</h2></div><Link href="/galeria">Ver galería</Link></div>
    <div className="client-work-track">
      {items.slice(0, 6).map((item, index) => <Link href="/galeria" className={`client-work-card client-work-card-${index + 1}`} key={item.id} style={{ backgroundImage: `linear-gradient(180deg,transparent 30%,rgba(5,12,29,.88)),url(${JSON.stringify(item.image)})` }}><span>{item.title}</span><strong>Ver trabajo</strong></Link>)}
    </div>
  </section>;
}
