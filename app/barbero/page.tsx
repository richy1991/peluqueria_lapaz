import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Activity, Banknote, CalendarClock, Clock3, History, Images, ReceiptText, Sparkles, UserRoundPen } from "lucide-react";
import { Brand } from "@/components/brand";
import { ModeSwitcher } from "@/components/mode-switcher";
import { PanelExperience, PanelMobileLogout, PanelMobileMenuButton, PanelMobileScrim, PanelMobileSidebarClose, PanelThemeSelector } from "@/components/panel-experience";
import { createClient } from "@/lib/supabase/server";
import { getUserCapabilities } from "@/lib/user-capabilities";
import { AppointmentStatusActions } from "./appointment-status-actions";
import { ExpenseForm } from "./expense-form";
import { PublicProfileManager } from "./public-profile-manager";

export const dynamic = "force-dynamic";

export type BarberSection = "agenda" | "perfil" | "balance" | "trabajos";

const sectionInfo: Record<BarberSection, { eyebrow: string; title: string; description: string }> = {
  agenda: { eyebrow: "OPERACIÓN DIARIA", title: "Agenda del día", description: "Consulta tus citas asignadas y actualiza su estado." },
  perfil: { eyebrow: "PRESENCIA PÚBLICA", title: "Mi perfil", description: "Mantén actualizada la información que ven los clientes." },
  balance: { eyebrow: "CONTROL PERSONAL", title: "Balance económico", description: "Revisa comisiones, incentivos, gastos y liquidaciones." },
  trabajos: { eyebrow: "PORTAFOLIO", title: "Mis trabajos", description: "Publica trabajos autorizados o referencias con su fuente." },
};

export default function BarberPage() {
  return <BarberView section="agenda" />;
}

export async function BarberView({ section }: { section: BarberSection }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/admin/login");
  const capabilities = await getUserCapabilities(user.id);
  if (!capabilities.barber) notFound();

  const start = new Date(); start.setHours(0, 0, 0, 0);
  const end = new Date(start); end.setDate(end.getDate() + 1);
  const [appointmentsResult, earnings, expenses, payouts, profileResult, galleryResult] = await Promise.all([
    supabase.from("appointments").select("id,starts_at,ends_at,status,service_name_snapshot,notes,reference_image_path,profiles!appointments_client_id_fkey(full_name,phone,is_blacklisted)").eq("barber_id", capabilities.barber.id).gte("starts_at", start.toISOString()).lt("starts_at", end.toISOString()).order("starts_at"),
    supabase.from("barber_earnings").select("id,kind,amount,status,created_at,sale_items(name_snapshot)").eq("barber_id", capabilities.barber.id).order("created_at", { ascending: false }).limit(50),
    supabase.from("barber_expenses").select("id,concept,amount,status,created_at").eq("barber_id", capabilities.barber.id).order("created_at", { ascending: false }).limit(20),
    supabase.from("payouts").select("id,period_start,period_end,total_amount,status,paid_at").eq("barber_id", capabilities.barber.id).order("created_at", { ascending: false }).limit(20),
    supabase.from("barber_profiles").select("id,display_name,bio,specialties,photo_path").eq("id", capabilities.barber.id).single(),
    supabase.from("gallery_posts").select("id,title,status,source_type,created_at").eq("barber_id", capabilities.barber.id).order("created_at", { ascending: false }).limit(12),
  ]);

  const appointments = appointmentsResult.data ?? [];
  const active = appointments.filter((item) => !["canceled", "completed", "no_show"].includes(item.status));
  const pendingTotal = (earnings.data ?? []).filter((item) => ["pending", "approved"].includes(item.status)).reduce((sum, item) => sum + Number(item.amount), 0);
  const info = sectionInfo[section];

  return <PanelExperience><main className="admin-shell dash-workspace barber-portal">
    <header className="admin-header dash-header">
      <PanelMobileMenuButton />
      <div className="dash-brand"><Brand linked={false} /><span className="dash-live"><i /> AGENDA SINCRONIZADA</span></div>
      <ModeSwitcher current="barber" isAdmin={capabilities.isAdmin} hasBarber isCashier={capabilities.isCashier} showClient={false} />
      <div className="dash-user"><span className="dash-avatar">{(user.email ?? "LC").slice(0, 2).toUpperCase()}</span><span>{user.email}<small>Peluquero · {capabilities.barber.display_name}</small></span></div>
    </header>
    <div className="admin-layout barber-layout">
      <aside className="admin-nav dash-sidebar">
        <div className="dash-sidebar-head"><p>MI ESTACIÓN</p><PanelMobileSidebarClose /></div>
        <nav>
          <Link className={section === "agenda" ? "active" : ""} href="/barbero"><CalendarClock /><span>Agenda</span>{section === "agenda" && <i />}</Link>
          <Link className={section === "perfil" ? "active" : ""} href="/barbero/perfil"><UserRoundPen /><span>Editar perfil</span>{section === "perfil" && <i />}</Link>
          <Link className={section === "balance" ? "active" : ""} href="/barbero/balance"><Banknote /><span>Balance económico</span>{section === "balance" && <i />}</Link>
          <Link className={section === "trabajos" ? "active" : ""} href="/barbero/trabajos"><Images /><span>Publicar trabajos</span>{section === "trabajos" && <i />}</Link>
        </nav>
        <div className="dash-sidebar-foot"><PanelThemeSelector /><Link href="/"><Sparkles /><span>Web pública</span></Link><PanelMobileLogout /></div>
      </aside>
      <PanelMobileScrim />
      <section className="barber-content">
        <section className="portal-hero dash-role-hero"><div><p className="eyebrow">{info.eyebrow}</p><h1>{info.title}</h1><p>{info.description}</p></div><div className="barber-pulse"><span><i />{active.length} citas activas</span>{section === "agenda" ? <Clock3 /> : section === "balance" ? <Banknote /> : section === "trabajos" ? <Images /> : <UserRoundPen />}</div></section>
        <div className="portal-grid dash-portal-grid">
          {section === "agenda" && <>
            <section className="portal-card"><div className="portal-title"><Activity /><h2>Resumen de hoy</h2></div><strong className="streak-number">{active.length}</strong><p>cita(s) pendientes o en proceso.</p></section>
            <section className="portal-card"><div className="portal-title"><Clock3 /><h2>Próxima cita</h2></div>{active[0] ? <div className="next-appointment"><strong>{active[0].service_name_snapshot}</strong><span>{new Intl.DateTimeFormat("es-BO", { timeStyle: "short", timeZone: "America/La_Paz" }).format(new Date(active[0].starts_at))}</span></div> : <p className="portal-empty">No quedan citas pendientes hoy.</p>}</section>
            <section className="portal-card portal-wide"><div className="portal-title"><CalendarClock /><h2>Agenda del día</h2></div><div className="portal-list agenda-list">{appointments.length ? appointments.map((item) => { const client = item.profiles as unknown as { full_name?: string; phone?: string; is_blacklisted?: boolean } | null; return <article key={item.id}><span className="agenda-time">{new Intl.DateTimeFormat("es-BO", { timeStyle: "short", timeZone: "America/La_Paz" }).format(new Date(item.starts_at))}</span><div><strong>{item.service_name_snapshot}</strong><span>{client?.full_name ?? "Cliente"} · {client?.phone ?? "Sin teléfono"} · {item.status}</span>{client?.is_blacklisted && <small className="portal-warning">Alerta de inasistencias</small>}</div><AppointmentStatusActions id={item.id} status={item.status} /></article>; }) : <p className="portal-empty">No hay citas asignadas para hoy.</p>}</div></section>
          </>}

          {section === "perfil" && profileResult.data && <section className="portal-card portal-wide"><PublicProfileManager userId={user.id} profile={profileResult.data} gallery={galleryResult.data ?? []} view="profile" /></section>}

          {section === "trabajos" && profileResult.data && <section className="portal-card portal-wide"><PublicProfileManager userId={user.id} profile={profileResult.data} gallery={galleryResult.data ?? []} view="gallery" /></section>}

          {section === "balance" && <>
            <section className="portal-card"><div className="portal-title"><Banknote /><h2>Ganancia pendiente</h2></div><strong className="streak-number">Bs {pendingTotal.toFixed(2)}</strong><p>Comisiones e incentivos aún no pagados.</p></section>
            <section className="portal-card"><div className="portal-title"><ReceiptText /><h2>Registrar insumo</h2></div><p>Solicita la revisión de gastos vinculados a tu trabajo.</p><ExpenseForm /></section>
            <section className="portal-card portal-wide"><div className="portal-title"><Banknote /><h2>Comisiones e incentivos</h2></div><div className="portal-list">{earnings.data?.length ? earnings.data.map((item) => <article key={item.id}><div><strong>{(item.sale_items as unknown as { name_snapshot?: string } | null)?.name_snapshot ?? item.kind}</strong><span>{item.kind} · {item.status} · {new Intl.DateTimeFormat("es-BO", { dateStyle: "medium", timeZone: "America/La_Paz" }).format(new Date(item.created_at))}</span></div><b>Bs {Number(item.amount).toFixed(2)}</b></article>) : <p className="portal-empty">Aún no existen comisiones registradas.</p>}</div></section>
            <section className="portal-card"><div className="portal-title"><ReceiptText /><h2>Mis gastos</h2></div><div className="portal-list">{expenses.data?.length ? expenses.data.map((item) => <article key={item.id}><div><strong>{item.concept}</strong><span>{item.status}</span></div><b>Bs {Number(item.amount).toFixed(2)}</b></article>) : <p className="portal-empty">No registraste gastos.</p>}</div></section>
            <section className="portal-card"><div className="portal-title"><History /><h2>Liquidaciones</h2></div><div className="portal-list">{payouts.data?.length ? payouts.data.map((item) => <article key={item.id}><div><strong>{item.period_start}</strong><span>{item.status}</span></div><b>Bs {Number(item.total_amount).toFixed(2)}</b></article>) : <p className="portal-empty">Aún no existen liquidaciones.</p>}</div></section>
          </>}
        </div>
      </section>
    </div>
  </main></PanelExperience>;
}
