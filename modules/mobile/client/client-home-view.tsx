import Link from "next/link";
import { ArrowRight, CalendarDays, ChevronRight, Clock3, History, PackageCheck, Settings2, Star, UserRound, UserRoundPen } from "lucide-react";
import type { ReactNode } from "react";
import { Brand } from "@/components/brand";
import { PublicHomeLink } from "@/components/public-home-link";
import { CancelAppointmentButton, ConfirmReassignmentButton } from "./appointment-actions";
import { ClientProfileDetails, type ClientProfile } from "./client-profile-view";
import { ProfileCardMotion } from "./profile-card-motion";

type Appointment = {
  id: string;
  starts_at: string;
  status: string;
  price_snapshot: number | string;
  service_name_snapshot: string;
  barber_name_snapshot: string | null;
  barber_profiles: unknown;
};

const labels: Record<string, string> = {
  requested: "Solicitada",
  confirmed: "Confirmada",
  pending_client_confirmation: "Confirma el cambio",
  pending_payment: "Pendiente de pago",
  in_progress: "En curso",
  needs_reschedule: "Por reprogramar",
};

const shortcuts = [
  { href: "/mi-cuenta/historial", label: "Mi historial", icon: History },
  { href: "/mi-cuenta/productos", label: "Productos", icon: PackageCheck },
  { href: "/mi-cuenta/puntos", label: "Puntos", icon: Star },
  { href: "/mi-cuenta/configuracion-avisos", label: "Configurar avisos", icon: Settings2 },
] as const;

export function ClientHomeView({ profile, accountEmail, appointment, timezone, businessStatus }: {
  profile: ClientProfile | null;
  accountEmail?: string;
  appointment?: Appointment;
  timezone: string;
  businessStatus: ReactNode;
}) {
  const name = profile?.full_name?.trim() || (profile?.email || accountEmail)?.split("@")[0] || "Cliente";
  const initials = name.split(/\s+/).slice(0, 2).map(part => part[0]).join("").toUpperCase();

  return (
    <main className="portal-shell panel-client-shell client-account-home">
      <header className="client-account-bar">
        <div className="client-account-width">
          <Brand linked={false} />
          <div className="client-header-actions">
            <Link className="client-booking-link" href="/reservar?return=%2Fmi-cuenta" aria-label="Reservar cita">
              <CalendarDays size={15} aria-hidden="true" /> Reservar
            </Link>
            <PublicHomeLink className="client-account-public" />
          </div>
        </div>
      </header>

      <ProfileCardMotion className="client-account-width client-account-content">
        <h1 className="client-account-heading">Mi perfil</h1>
        <section className="account-profile-identity" aria-labelledby="account-profile-name">
          <div className="account-profile-avatar" aria-hidden="true">
            {initials}
            {profile?.avatar_url && <span style={{ backgroundImage: `url(${JSON.stringify(profile.avatar_url)})` }} />}
          </div>
          <div className="account-profile-identity-copy">
            <h2 id="account-profile-name">Hola, {name}</h2>
            {businessStatus}
          </div>
          <Link className="account-profile-edit" href="/mi-cuenta/editar-perfil">
            <UserRoundPen size={18} aria-hidden="true" /> Editar perfil
          </Link>
        </section>

        <div className="client-account-columns">
          <section className="client-account-card client-account-appointment" aria-labelledby="client-account-appointment-title" data-profile-card>
            <div className="client-account-card-title">
              <span><CalendarDays size={20} aria-hidden="true" /></span>
              <h2 id="client-account-appointment-title">Próxima cita</h2>
              {appointment && <span className="client-account-status" data-status={appointment.status}>{labels[appointment.status] ?? "Registrada"}</span>}
            </div>
            {appointment
              ? <UpcomingAppointment appointment={appointment} timezone={timezone} />
              : <p className="client-account-empty">Aún no tienes una cita próxima.</p>}
          </section>

          <section className="client-account-card" aria-labelledby="client-account-shortcuts" data-profile-card>
            <h2 id="client-account-shortcuts">Accesos</h2>
            <nav className="client-account-shortcuts" aria-labelledby="client-account-shortcuts">
              {shortcuts.map(({ href, label, icon: Icon }) => (
                <Link key={href} href={href}>
                  <span><Icon size={17} aria-hidden="true" /></span>
                  {label} <ChevronRight size={15} aria-hidden="true" />
                </Link>
              ))}
            </nav>
          </section>
        </div>

        <ClientProfileDetails profile={profile} accountEmail={accountEmail} />
      </ProfileCardMotion>
    </main>
  );
}

function UpcomingAppointment({ appointment, timezone }: { appointment: Appointment; timezone: string }) {
  const date = new Date(appointment.starts_at);
  const time = new Intl.DateTimeFormat("es-BO", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: timezone }).format(date);
  const dayLabel = new Intl.DateTimeFormat("es-BO", { day: "numeric", month: "long", weekday: "long", timeZone: timezone }).format(date);
  const dateTileDay = new Intl.DateTimeFormat("es-BO", { day: "2-digit", timeZone: timezone }).format(date);
  const dateTileMonth = new Intl.DateTimeFormat("es-BO", { month: "short", timeZone: timezone }).format(date).replace(".", "");
  const relation = appointment.barber_profiles as { display_name?: string } | { display_name?: string }[] | null;
  const barber = (Array.isArray(relation) ? relation[0] : relation)?.display_name ?? appointment.barber_name_snapshot;
  const canCancel = ["requested", "confirmed", "pending_client_confirmation"].includes(appointment.status);

  return <>
    <div className="client-account-appointment-info">
      <div className="client-account-date" aria-hidden="true"><strong>{dateTileDay}</strong><span>{dateTileMonth}</span></div>
      <div>
        <h3>{appointment.service_name_snapshot}</h3>
        <time dateTime={appointment.starts_at}><Clock3 size={15} aria-hidden="true" /> {dayLabel} · {time}</time>
        <p><UserRound size={15} aria-hidden="true" /> {barber ?? "Barbero por asignar"}</p>
      </div>
    </div>
    <div className="client-account-appointment-footer">
      <strong>Bs {appointment.price_snapshot}</strong>
      <Link href={`/mi-cuenta/citas/${encodeURIComponent(appointment.id)}`}>Ver detalle <ArrowRight size={16} aria-hidden="true" /></Link>
    </div>
    {canCancel && (
      <div className="client-account-appointment-actions">
        {appointment.status === "pending_client_confirmation" && <ConfirmReassignmentButton id={appointment.id} />}
        {canCancel && <CancelAppointmentButton id={appointment.id} />}
      </div>
    )}
  </>;
}
