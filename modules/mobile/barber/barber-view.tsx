import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Activity, Banknote, CalendarClock, Clock3, History, Images, PackageOpen, ReceiptText, Sparkles, UserRoundPen } from "lucide-react";
import { Brand } from "@/components/brand";
import { ModeSwitcher } from "@/components/mode-switcher";
import { PanelExperience, PanelMobileLogout, PanelMobileMenuButton, PanelMobileScrim, PanelMobileSidebarClose, PanelResponsiveSidebar, PanelThemeSelector, PanelViewportPortal } from "@/components/panel-experience";
import { ProductCatalog } from "@/components/product-catalog";
import { getPublicProducts } from "@/lib/public-data";
import { createClient } from "@/lib/supabase/server";
import { getUserCapabilities } from "@/lib/user-capabilities";
import { DEFAULT_BUSINESS_TIMEZONE } from "@/lib/business-hours";
import { businessDayRange, zonedDateTimeToDate } from "@/lib/business-time";
import { AppointmentStatusActions } from "./appointment-status-actions";
import { PublicProfileManager } from "./public-profile-manager";
import { InstallAppButton } from "@/components/install-app-button";
import { BARBER_NAVIGATION, type BarberSection } from "./contracts";
import { StaggerContainer } from "@/components/stagger-animations";
import { PanelBottomNavigation, type PanelNavigationItem } from "@/components/panel-bottom-navigation";

export const dynamic = "force-dynamic";

const sectionInfo: Record<BarberSection, { eyebrow: string; title: string; description: string }> = {
  agenda: { eyebrow: "OPERACIÓN DIARIA", title: "Agenda del día", description: "Consulta tus citas asignadas y actualiza su estado." },
  productos: { eyebrow: "CATÁLOGO", title: "Productos", description: "Consulta el catálogo completo, revisa cada detalle y aparta productos para recogerlos en el local." },
  perfil: { eyebrow: "PRESENCIA PÚBLICA", title: "Mi perfil", description: "Mantén actualizada la información que ven los clientes." },
  balance: { eyebrow: "CONTROL PERSONAL", title: "Balance económico", description: "Revisa tus comisiones, incentivos y liquidaciones." },
  trabajos: { eyebrow: "PORTAFOLIO", title: "Mis trabajos", description: "Publica trabajos autorizados o referencias con su fuente." },
};

const barberNavigationIcons = { agenda: CalendarClock, productos: PackageOpen, perfil: UserRoundPen, balance: Banknote, trabajos: Images } as const;

function BarberMobileNavigation({ section }: { section: BarberSection }) {
  const replaceNavigation = section !== "agenda";
  const items: PanelNavigationItem[] = BARBER_NAVIGATION.map(item => {
    const Icon = barberNavigationIcons[item.id];
    return { ...item, icon: <Icon /> };
  });
  return <PanelViewportPortal><PanelBottomNavigation items={items} activeId={section} replace={replaceNavigation} className="barber-bottom-nav" ariaLabel="Accesos rápidos de peluquero" /></PanelViewportPortal>;
}

function groupAppointmentsByBusinessDay<T extends { starts_at: string }>(appointments: T[], timezone: string) {
  const groups = new Map<string, T[]>();
  const keyFormatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  for (const appointment of appointments) {
    const parts = keyFormatter.formatToParts(new Date(appointment.starts_at));
    const part = (type: Intl.DateTimeFormatPartTypes) => parts.find(item => item.type === type)?.value ?? "";
    const key = `${part("year")}-${part("month")}-${part("day")}`;
    const dayAppointments = groups.get(key) ?? [];
    dayAppointments.push(appointment);
    groups.set(key, dayAppointments);
  }

  return [...groups.entries()].map(([key, dayAppointments]) => ({
    key,
    label: new Intl.DateTimeFormat("es-BO", {
      weekday: "long",
      day: "numeric",
      month: "long",
      timeZone: timezone,
    }).format(new Date(dayAppointments[0].starts_at)),
    appointments: dayAppointments,
  }));
}

function appointmentStatusLabel(status: string) {
  return ({
    requested: "Solicitada",
    confirmed: "Confirmada",
    in_progress: "En atención",
    pending_payment: "Pendiente de pago",
    pending_client_confirmation: "Cambio pendiente de confirmar",
  } as Record<string, string>)[status] ?? status;
}

export async function BarberView({ section }: { section: BarberSection }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/admin/login");
  const capabilities = await getUserCapabilities(user.id);
  if (!capabilities.barber) notFound();

  const { data: businessSettings } = await supabase.from("business_settings").select("timezone").eq("id", true).maybeSingle();
  const businessTimezone = String(businessSettings?.timezone ?? DEFAULT_BUSINESS_TIMEZONE);
  const now = new Date();
  const requestTime = now.toISOString();
  const { date: workDate, start, end } = businessDayRange(now, businessTimezone);
  const weekEnd = new Date(end.getTime() + 6 * 24 * 60 * 60 * 1000);
  const monthStart = zonedDateTimeToDate(`${workDate.slice(0, 8)}01T00:00:00`, businessTimezone);
  const [appointmentsResult, weekAppointmentsResult, earnings, payouts, profileResult, galleryResult, servicesResult, productsResult, monthlyEarnings, discounts, availableProducts] = await Promise.all([
    supabase.from("appointments").select("id,service_id,starts_at,ends_at,status,service_name_snapshot,client_name_snapshot,notes,reference_image_path").eq("barber_id", capabilities.barber.id).gte("starts_at", start.toISOString()).lt("starts_at", end.toISOString()).order("starts_at"),
    section === "agenda" ? supabase.from("appointments").select("id,starts_at,status,service_name_snapshot,client_name_snapshot").eq("barber_id", capabilities.barber.id).gte("starts_at", requestTime).lt("starts_at", weekEnd.toISOString()).order("starts_at") : Promise.resolve({ data: [] }),
    section === "balance" ? supabase.from("barber_earnings").select("id,kind,amount,status,created_at,sale_items(name_snapshot,unit_price_snapshot,discount_amount,barber_discount_share)").eq("barber_id", capabilities.barber.id).order("created_at", { ascending: false }).limit(50) : Promise.resolve({ data: [] }),
    section === "balance" ? supabase.from("payouts").select("id,period_start,period_end,commission_amount,incentive_amount,deduction_amount,total_amount,status,paid_at").eq("barber_id", capabilities.barber.id).order("created_at", { ascending: false }).limit(20) : Promise.resolve({ data: [] }),
    ["perfil", "trabajos"].includes(section) ? supabase.from("barber_profiles").select("id,display_name,bio,specialties,photo_path").eq("id", capabilities.barber.id).single() : Promise.resolve({ data: null }),
    ["perfil", "trabajos"].includes(section) ? supabase.from("gallery_posts").select("id,title,status,source_type,created_at").eq("barber_id", capabilities.barber.id).order("created_at", { ascending: false }).limit(12) : Promise.resolve({ data: [] }),
    section === "agenda" ? supabase.from("services").select("id,name,price").eq("status", "active").order("name") : Promise.resolve({ data: [] }),
    section === "agenda" ? supabase.from("products").select("id,name,price,stock").eq("status", "active").gt("stock", 0).order("name") : Promise.resolve({ data: [] }),
    section === "balance" ? supabase.from("barber_earnings").select("id,kind,base_amount,rate_percent,amount,status,created_at,sale_items(name_snapshot)").eq("barber_id", capabilities.barber.id).gte("created_at", monthStart.toISOString()).order("created_at", { ascending: false }) : Promise.resolve({ data: [] }),
    section === "balance" ? supabase.from("discount_applications").select("id,name_snapshot,eligible_base,discount_amount,barber_discount_share,business_discount_share,created_at").eq("barber_id",capabilities.barber.id).gte("created_at",monthStart.toISOString()).order("created_at",{ascending:false}).limit(30) : Promise.resolve({ data: [] }),
    section === "productos" ? getPublicProducts() : Promise.resolve([]),
  ]);

  const appointments = appointmentsResult.data ?? [];
  const weekAppointmentsResultData = weekAppointmentsResult.data ?? [];
  const appointmentIds = [...new Set([...appointments, ...weekAppointmentsResultData].map(item => item.id))];
  const appointmentClientsResult = section === "agenda" && appointmentIds.length
    ? await supabase.rpc("get_barber_appointment_clients", { target_appointment_ids: appointmentIds })
    : { data: [] };
  const appointmentClientRows = (appointmentClientsResult.data ?? []) as Array<{ appointment_id: string; full_name: string | null; phone: string | null; is_blacklisted: boolean }>;
  const clientByAppointmentId = new Map(appointmentClientRows.map(item => [item.appointment_id, item] as const));
  const active = appointments.filter((item) => !["canceled", "completed", "no_show", "needs_reschedule"].includes(item.status));
  const weekAppointments = weekAppointmentsResultData.filter(item => !["canceled", "completed", "no_show", "needs_reschedule"].includes(item.status));
  const weekAppointmentGroups = groupAppointmentsByBusinessDay(weekAppointments, businessTimezone);
  const nextAppointment = weekAppointments.find(item => new Date(item.starts_at).getTime() >= now.getTime());
  const pendingTotal = (earnings.data ?? []).filter((item) => ["pending", "approved"].includes(item.status)).reduce((sum, item) => sum + Number(item.amount), 0);
  const monthProductEarnings=(monthlyEarnings.data??[]).filter(item=>item.kind==="product_incentive");
  const monthProductSales=monthProductEarnings.reduce((sum,item)=>sum+Number(item.base_amount),0);
  const monthProductCommission=monthProductEarnings.reduce((sum,item)=>sum+Number(item.amount),0);
  const info = sectionInfo[section];
  const replaceNavigation = section !== "agenda";

  return <PanelExperience chatInHeader><main className="admin-shell dash-workspace barber-portal">
    <header className="admin-header dash-header">
      <PanelMobileMenuButton />
      <div className="dash-brand"><Brand linked={false} /><span className="dash-live"><i /> AGENDA SINCRONIZADA</span></div>
      <ModeSwitcher current="barber" isAdmin={capabilities.isAdmin} hasBarber isCashier={capabilities.isCashier} showClient={false} />
      <div className="dash-user"><span className="dash-avatar">{(user.email ?? "LC").slice(0, 2).toUpperCase()}</span><span>{user.email}<small>Peluquero · {capabilities.barber.display_name}</small></span></div>
    </header>
    <div className="admin-layout barber-layout">
      <PanelResponsiveSidebar>
      <aside className="admin-nav dash-sidebar">
        <div className="dash-sidebar-head"><p>MI ESTACIÓN</p><PanelMobileSidebarClose /></div>
        <nav>
          <Link replace={replaceNavigation} className={section === "agenda" ? "active" : ""} href="/barbero"><CalendarClock /><span>Agenda</span>{section === "agenda" && <i />}</Link>
          <Link replace={replaceNavigation} className={section === "productos" ? "active" : ""} href="/barbero/productos"><PackageOpen /><span>Productos</span>{section === "productos" && <i />}</Link>
          <Link replace={replaceNavigation} className={section === "perfil" ? "active" : ""} href="/barbero/perfil"><UserRoundPen /><span>Editar perfil</span>{section === "perfil" && <i />}</Link>
          <Link replace={replaceNavigation} className={section === "balance" ? "active" : ""} href="/barbero/balance"><Banknote /><span>Balance económico</span>{section === "balance" && <i />}</Link>
          <Link replace={replaceNavigation} className={section === "trabajos" ? "active" : ""} href="/barbero/trabajos"><Images /><span>Publicar trabajos</span>{section === "trabajos" && <i />}</Link>
        </nav>
        <div className="dash-sidebar-foot"><PanelThemeSelector /><Link href="/sitio"><Sparkles /><span>Web pública</span></Link><PanelMobileLogout /></div>
      </aside>
      <PanelMobileScrim />
      </PanelResponsiveSidebar>
      <section className="barber-content">
        <section className="portal-hero dash-role-hero"><div><p className="eyebrow">{info.eyebrow}</p><h1>{info.title}</h1><p>{info.description}</p><InstallAppButton compact /></div><div className="barber-pulse"><span><i />{active.length} citas activas</span>{section === "agenda" ? <Clock3 /> : section === "productos" ? <PackageOpen /> : section === "balance" ? <Banknote /> : section === "trabajos" ? <Images /> : <UserRoundPen />}</div></section>
        <StaggerContainer className="portal-grid dash-portal-grid">
          {section === "agenda" && <>
            <section className="portal-card"><div className="portal-title"><Activity /><h2>Resumen de hoy</h2></div><strong className="daily-appointment-count">{active.length}</strong><p>cita(s) pendientes o en proceso.</p></section>
            <section className="portal-card"><div className="portal-title"><Clock3 /><h2>Próxima cita</h2></div>{nextAppointment ? <div className="next-appointment"><strong>{nextAppointment.service_name_snapshot}</strong><span>{new Intl.DateTimeFormat("es-BO", { weekday: "short", day: "numeric", month: "short", timeStyle: "short", timeZone: businessTimezone }).format(new Date(nextAppointment.starts_at))}</span></div> : <p className="portal-empty">No tienes citas próximas en los siguientes 7 días.</p>}</section>
            <section className="portal-card portal-wide"><div className="portal-title"><CalendarClock /><div><small>HOY</small><h2>Cola de clientes</h2></div></div><div className="portal-list agenda-list">{active.length ? active.map((item) => { const client = clientByAppointmentId.get(item.id); return <article key={item.id}><span className="agenda-time">{new Intl.DateTimeFormat("es-BO", { timeStyle: "short", timeZone: businessTimezone }).format(new Date(item.starts_at))}</span><div><strong>{client?.full_name ?? item.client_name_snapshot ?? "Cliente"}</strong><span>{item.service_name_snapshot} · {appointmentStatusLabel(item.status)}</span>{client?.phone && <small>{client.phone}</small>}{client?.is_blacklisted && <small className="portal-warning">Alerta de inasistencias</small>}</div><AppointmentStatusActions id={item.id} status={item.status} defaultServiceId={item.service_id ?? ""} services={servicesResult.data ?? []} products={productsResult.data ?? []} /></article>; }) : <p className="portal-empty">No hay citas activas para hoy.</p>}</div></section>
            <section className="portal-card portal-wide"><div className="portal-title"><History /><div><small>PRÓXIMOS 7 DÍAS</small><h2>Agenda semanal</h2></div></div>{weekAppointmentGroups.length ? <div className="agenda-week">{weekAppointmentGroups.map(group => <section className="agenda-day-group" key={group.key}><header className="agenda-day-heading"><h3>{group.label}</h3><span>{group.appointments.length} {group.appointments.length === 1 ? "cita" : "citas"}</span></header><div className="portal-list agenda-list agenda-day-list">{group.appointments.map(item => { const client = clientByAppointmentId.get(item.id); return <article key={item.id}><span className="agenda-time">{new Intl.DateTimeFormat("es-BO", { timeStyle: "short", timeZone: businessTimezone }).format(new Date(item.starts_at))}</span><div><strong>{client?.full_name ?? item.client_name_snapshot ?? "Cliente"}</strong><span>{item.service_name_snapshot} · {appointmentStatusLabel(item.status)}</span>{client?.phone && <small>{client.phone}</small>}</div></article>; })}</div></section>)}</div> : <p className="portal-empty">No tienes citas próximas esta semana.</p>}</section>
          </>}

          {section === "productos" && <section className="portal-card portal-wide barber-product-catalog"><div className="portal-title"><PackageOpen /><div><small>DISPONIBLES AHORA</small><h2>Catálogo de productos</h2></div></div><p>Selecciona un producto para ver sus fotos, presentación, existencias y precio. Puedes apartarlo durante 24 horas y pagarlo en el local.</p><ProductCatalog products={availableProducts} variant="catalog" /></section>}

          {section === "perfil" && profileResult.data && <section className="portal-card portal-wide"><PublicProfileManager userId={user.id} profile={profileResult.data} gallery={galleryResult.data ?? []} view="profile" timezone={businessTimezone} /></section>}

          {section === "trabajos" && profileResult.data && <section className="portal-card portal-wide"><PublicProfileManager userId={user.id} profile={profileResult.data} gallery={galleryResult.data ?? []} view="gallery" timezone={businessTimezone} /></section>}

          {section === "balance" && <>
            <section className="portal-card portal-wide barber-money-summary"><article><span>Liquidación pendiente</span><strong>Bs {pendingTotal.toFixed(2)}</strong><small>Saldo por recibir</small></article><article><span>Productos vendidos</span><strong>Bs {monthProductSales.toFixed(2)}</strong><small>Este mes</small></article><article><span>Incentivo por productos</span><strong>Bs {monthProductCommission.toFixed(2)}</strong><small>Bs 5 por unidad vendida</small></article></section>
            <section className="portal-card portal-wide"><div className="portal-title"><Banknote /><h2>Comisiones económicas</h2></div><p>Este registro monetario es independiente de los puntos de fidelidad de clientes.</p><div className="portal-list">{earnings.data?.length ? earnings.data.map((item) => <article key={item.id}><div><strong>{(item.sale_items as unknown as { name_snapshot?: string } | null)?.name_snapshot ?? item.kind}</strong><span>{item.kind === "product_incentive" ? "Venta de producto" : "Servicio"} · {item.status} · {new Intl.DateTimeFormat("es-BO", { dateStyle: "medium", timeZone: businessTimezone }).format(new Date(item.created_at))}</span></div><b>Bs {Number(item.amount).toFixed(2)}</b></article>) : <p className="portal-empty">Aún no existen comisiones registradas.</p>}</div></section>
            <section className="portal-card portal-wide"><div className="portal-title"><Sparkles /><h2>Descuentos compartidos</h2></div><p>Cada registro muestra cuánto asumiste tú y cuánto asumió el local.</p><div className="portal-list">{discounts.data?.length?discounts.data.map(item=><article key={item.id}><div><strong>{item.name_snapshot}</strong><span>Base Bs {Number(item.eligible_base).toFixed(2)} · descuento total Bs {Number(item.discount_amount).toFixed(2)} · {new Intl.DateTimeFormat("es-BO",{dateStyle:"medium",timeZone:businessTimezone}).format(new Date(item.created_at))}</span></div><b>Tú: Bs {Number(item.barber_discount_share).toFixed(2)} · Local: Bs {Number(item.business_discount_share).toFixed(2)}</b></article>):<p className="portal-empty">Este mes todavía no asumiste descuentos.</p>}</div></section>
            <section className="portal-card"><div className="portal-title"><History /><h2>Liquidaciones</h2></div><div className="portal-list">{payouts.data?.length ? payouts.data.map((item) => <article key={item.id}><div><strong>{item.period_start}</strong><span>Servicios Bs {Number(item.commission_amount).toFixed(2)} · incentivo Bs {Number(item.incentive_amount).toFixed(2)} · {item.status === "paid" ? "pagada" : "preparada"}</span></div><b>Bs {Number(item.total_amount).toFixed(2)}</b></article>) : <p className="portal-empty">Aún no existen liquidaciones.</p>}</div></section>
          </>}
        </StaggerContainer>
      </section>
    </div>
    <BarberMobileNavigation section={section} />
  </main></PanelExperience>;
}

function expenseStatus(status: string) {
  return ({ pending: "Pendiente de revisión", approved: "Aprobado para descuento", rejected: "Rechazado", deducted: "Descontado", reimbursed: "Reembolsado (histórico)" } as Record<string, string>)[status] ?? status;
}
