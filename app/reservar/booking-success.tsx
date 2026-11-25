"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, CalendarDays } from "lucide-react";
import { Brand } from "@/components/brand";
import { PublicHomeLink } from "@/components/public-home-link";

const confirmationDuration = 1600;

const statusLabels: Record<string, string> = {
  requested: "Solicitada",
  confirmed: "Confirmada",
  in_progress: "En curso",
  pending_payment: "Pendiente de pago",
  pending_client_confirmation: "Confirma el cambio",
  needs_reschedule: "Por reprogramar",
  completed: "Completada",
  canceled: "Cancelada",
  no_show: "Inasistencia",
};

export type ConfirmedBooking = {
  id?: string;
  serviceName: string;
  barberName: string;
  dateAndTime: string;
  price: number;
};

export function BookingSuccess({ booking }: { booking: ConfirmedBooking }) {
  const [showConfirmation, setShowConfirmation] = useState(true);
  const router = useRouter();
  const appointmentPath = booking.id ? `/mi-cuenta/citas/${encodeURIComponent(booking.id)}` : undefined;

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
    const timeout = window.setTimeout(() => {
      setShowConfirmation(false);
      if (appointmentPath) router.replace(appointmentPath);
    }, confirmationDuration);
    return () => window.clearTimeout(timeout);
  }, [appointmentPath, router]);

  if (!showConfirmation) return <BookingReceipt booking={booking} appointmentPath={appointmentPath} />;

  return (
    <main className="booking-shell success-shell">
      <header className="booking-topbar"><Brand /></header>
      <div className="booking-confirmation" role="status" style={{ animationDuration: `${confirmationDuration}ms` }}>
        <span className="booking-confirmation-mark" aria-hidden="true"><Check strokeWidth={2.5} /></span>
        <p>Reserva confirmada</p>
      </div>
    </main>
  );
}

export function BookingReceipt({
  booking,
  appointmentPath,
  status = "confirmed",
}: {
  booking: ConfirmedBooking;
  appointmentPath?: string;
  status?: string;
}) {
  const reference = booking.id?.slice(0, 8).toUpperCase();

  return (
    <main className="booking-shell success-shell booking-receipt-shell">
      <div className="booking-receipt">
        <article className="booking-receipt-paper" aria-labelledby="booking-receipt-title">
          <header className="booking-receipt-brand">
            <Brand />
            <CalendarDays size={22} aria-hidden="true" />
          </header>
          <div className="booking-receipt-heading">
            <h1 id="booking-receipt-title" tabIndex={-1} ref={(title) => title?.focus({ preventScroll: true })}>Ticket de reserva</h1>
            <span className="booking-receipt-status" data-status={status}>
              {status === "confirmed" && <Check size={14} aria-hidden="true" />}
              {statusLabels[status] ?? "Registrada"}
            </span>
          </div>
          {reference && <p className="booking-receipt-reference">Folio <span>{reference}</span></p>}
          <dl className="booking-receipt-details">
            <div>
              <dt>Servicio</dt>
              <dd>{booking.serviceName}</dd>
            </div>
            <div>
              <dt>Fecha y hora</dt>
              <dd>{booking.dateAndTime}</dd>
            </div>
            <div>
              <dt>Barbero</dt>
              <dd>{booking.barberName}</dd>
            </div>
          </dl>
          <div className="booking-receipt-total">
            <div>
              <p>Importe del servicio</p>
              {status === "confirmed" && <span>Pago en el local</span>}
            </div>
            <strong><small>Bs</small> {booking.price.toFixed(2)}</strong>
          </div>
        </article>
        <div className="booking-receipt-actions">
          <Link replace className="button button-dark" href={appointmentPath ?? "/mi-cuenta/historial#citas"}>
            {appointmentPath ? "Ver mi cita" : "Ver mis citas"} <ArrowRight size={17} aria-hidden="true" />
          </Link>
          <PublicHomeLink />
        </div>
      </div>
    </main>
  );
}
