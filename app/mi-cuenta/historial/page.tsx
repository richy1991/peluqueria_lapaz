import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, ArrowRight, CalendarDays, ChevronRight, Clock3, PackageCheck, Scissors, UserRound } from "lucide-react";
import type { ReactNode } from "react";
import { PublicHomeLink } from "@/components/public-home-link";
import { ClientSecondaryPage } from "@/modules/mobile/client/client-secondary-page";
import { DEFAULT_BUSINESS_TIMEZONE } from "@/lib/business-hours";
import { createClient } from "@/lib/supabase/server";
import "./history.css";

export const dynamic = "force-dynamic";

const title = "Mi historial";
const upcomingStatuses = new Set(["requested", "confirmed", "in_progress", "pending_payment", "pending_client_confirmation", "needs_reschedule"]);

export default async function ClientHistoryPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=%2Fmi-cuenta%2Fhistorial");
  const [appointments, sales, reservations, settings] = await Promise.all([
    loadAllPages(from => supabase.from("appointments").select("id,starts_at,status,price_snapshot,service_name_snapshot,barber_name_snapshot,barber_profiles!appointments_barber_id_fkey(display_name)").eq("client_id", user.id).order("starts_at", { ascending: false }).range(from, from + 499)),
    loadAllPages(from => supabase.from("sales").select("id,status,created_at,sale_items(id,item_type,name_snapshot,quantity,unit_price_snapshot)").eq("client_id", user.id).order("created_at", { ascending: false }).range(from, from + 499)),
    loadAllPages(from => supabase.from("product_reservations").select("id,status,quantity,price_snapshot,created_at,expires_at,products(name)").eq("client_id", user.id).order("created_at", { ascending: false }).range(from, from + 499)),
    supabase.from("business_settings").select("timezone").eq("id", true).maybeSingle(),
  ]);
  if (settings.error) throw new Error(settings.error.message);
  const timeZone = settings.data?.timezone ?? DEFAULT_BUSINESS_TIMEZONE;
  const requestTime = new Date().getTime();
  const appointmentDate = new Intl.DateTimeFormat("es-BO", { dateStyle: "medium", timeZone });
  const appointmentTime = new Intl.DateTimeFormat("es-BO", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone });
  const calendarDay = new Intl.DateTimeFormat("es-BO", { day: "2-digit", timeZone });
  const calendarMonth = new Intl.DateTimeFormat("es-BO", { month: "short", timeZone });
  const nextAppointment = appointments.findLast((item) => upcomingStatuses.has(item.status) && Date.parse(item.starts_at) >= requestTime);
  const otherAppointments = appointments.filter((item) => item.id !== nextAppointment?.id);
  const nextDate = nextAppointment ? new Date(nextAppointment.starts_at) : null;
  const serviceSales = sales.flatMap(sale => (sale.sale_items ?? []).filter(item => item.item_type === "service").map(item => ({ sale, item })));

  const header = (
    <header className="history-hero">
      <div className="history-header-links client-header-actions">
        <Link className="history-back" href="/mi-cuenta"><ArrowLeft size={17} aria-hidden="true" /> Mi perfil</Link>
        <PublicHomeLink />
      </div>
      <h1>{title}</h1>
      <Link className="client-booking-link" href="/reservar?return=%2Fmi-cuenta%2Fhistorial" aria-label="Reservar cita">
        <CalendarDays size={15} aria-hidden="true" /> Reservar
      </Link>
    </header>
  );

  return <ClientSecondaryPage title={title} className="client-booking-history" header={header}>
    <div className="history-layout">
      <section id="citas" className="history-section" aria-labelledby="history-appointments-title">
        <div className="history-section-heading">
          <span><CalendarDays size={20} aria-hidden="true" /></span>
          <h2 id="history-appointments-title">Citas</h2>
        </div>
        {nextAppointment && nextDate && (
          <article className="history-next">
            <div className="history-next-caption">
              <h3>Próxima cita</h3>
              <HistoryStatus status={nextAppointment.status} />
            </div>
            <div className="history-next-main">
              <time className="history-date-tile" dateTime={nextAppointment.starts_at} aria-label={appointmentDate.format(nextDate)}>
                <strong>{calendarDay.format(nextDate)}</strong>
                <span>{calendarMonth.format(nextDate).replace(".", "")}</span>
              </time>
              <div className="history-next-copy">
                <p>{nextAppointment.service_name_snapshot}</p>
                <span><Clock3 size={15} aria-hidden="true" /> {appointmentTime.format(nextDate)}</span>
                <span><UserRound size={15} aria-hidden="true" /> {barberName(nextAppointment)}</span>
              </div>
            </div>
            <div className="history-next-footer">
              <strong>Bs {nextAppointment.price_snapshot}</strong>
              <Link href={appointmentPath(nextAppointment.id)}>Ver detalle <ArrowRight size={16} aria-hidden="true" /></Link>
            </div>
          </article>
        )}
        {otherAppointments.length > 0 && (
          <ul className="history-entries">
            {otherAppointments.map((item) => {
              const date = new Date(item.starts_at);
              return <HistoryEntry key={item.id} label={item.service_name_snapshot} dateTime={item.starts_at} status={item.status} amount={item.price_snapshot} href={appointmentPath(item.id)} description={barberName(item)}>
                {appointmentDate.format(date)} · {appointmentTime.format(date)}
              </HistoryEntry>;
            })}
          </ul>
        )}
        {appointments.length === 0 && <p className="history-empty">Aún no tienes citas.</p>}
      </section>
      <div className="history-activity">
        <section className="history-section" aria-labelledby="history-services-title">
          <div className="history-section-heading">
            <span><Scissors size={20} aria-hidden="true" /></span>
            <h2 id="history-services-title">Servicios cobrados</h2>
          </div>
          {serviceSales.length > 0 ? (
            <ul className="history-entries">
              {serviceSales.map(({ sale, item }) => (
                <HistoryEntry key={`${sale.id}-${item.id}`} label={quantityLabel(item.name_snapshot, item.quantity)} dateTime={sale.created_at} status={sale.status} amount={(Number(item.unit_price_snapshot) * item.quantity).toFixed(2)}>
                  {appointmentDate.format(new Date(sale.created_at))}
                </HistoryEntry>
              ))}
            </ul>
          ) : <p className="history-empty">Aún no tienes servicios cobrados.</p>}
        </section>
        <section className="history-section" aria-labelledby="history-products-title">
          <div className="history-section-heading">
            <span><PackageCheck size={20} aria-hidden="true" /></span>
            <h2 id="history-products-title">Apartados</h2>
          </div>
          {reservations.length > 0 ? (
            <ul className="history-entries">
              {reservations.map((item) => {
                const product = firstRelated(item.products as { name: string } | { name: string }[] | null);
                const status = item.status === "reserved" && Date.parse(item.expires_at) < requestTime ? "expired" : item.status;
                return <HistoryEntry key={item.id} label={quantityLabel(product?.name ?? "Producto", item.quantity)} dateTime={item.created_at} status={status} amount={(Number(item.price_snapshot) * item.quantity).toFixed(2)}>
                  {appointmentDate.format(new Date(item.created_at))}
                </HistoryEntry>;
              })}
            </ul>
          ) : <p className="history-empty">Aún no tienes apartados.</p>}
        </section>
      </div>
    </div>
  </ClientSecondaryPage>;
}

function HistoryStatus({ status }: { status: string }) {
  return <span className="history-status" data-status={status}>{statusLabel(status)}</span>;
}

function HistoryEntry({ label, dateTime, status, amount, href, description, children }: {
  label: string;
  dateTime: string;
  status: string;
  amount: string | number;
  href?: string;
  description?: string;
  children: ReactNode;
}) {
  return <li className="history-entry">
    <div className="history-entry-copy">
      {href ? <Link href={href} prefetch={false}>{label} <ChevronRight size={15} aria-hidden="true" /></Link> : <strong>{label}</strong>}
      <time dateTime={dateTime}>{children}</time>
      {description && <span>{description}</span>}
    </div>
    <div className="history-entry-meta">
      <HistoryStatus status={status} />
      <strong>Bs {amount}</strong>
    </div>
  </li>;
}

function firstRelated<T>(relation: T | T[] | null) {
  return Array.isArray(relation) ? relation[0] : relation;
}

function barberName(item: { barber_profiles: unknown; barber_name_snapshot: string | null }) {
  const profile = firstRelated(item.barber_profiles as { display_name: string } | { display_name: string }[] | null);
  return profile?.display_name ?? item.barber_name_snapshot ?? "Barbero por asignar";
}

function appointmentPath(id: string) {
  return `/mi-cuenta/citas/${encodeURIComponent(id)}`;
}

function quantityLabel(label: string, quantity: number) {
  return quantity > 1 ? `${label} ×${quantity}` : label;
}

async function loadAllPages<T>(load: (from: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>) {
  const rows: T[] = [];
  for (let from = 0; ; from += 500) {
    const result = await load(from);
    if (result.error) throw new Error(result.error.message);
    const page = result.data ?? [];
    rows.push(...page);
    if (page.length < 500) return rows;
  }
}

function statusLabel(status: string) {
  return ({ requested: "Solicitada", confirmed: "Confirmada", in_progress: "En curso", pending_payment: "En caja", pending_client_confirmation: "Confirma cambio", needs_reschedule: "Reprogramar", completed: "Completada", canceled: "Cancelada", no_show: "Inasistencia", paid: "Pagado", refunded: "Reembolsado", reserved: "Apartado", collected: "Retirado", expired: "Vencido", draft: "En proceso" } as Record<string, string>)[status] ?? status;
}
