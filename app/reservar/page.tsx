import type { Metadata } from "next";
import { Suspense } from "react";
import { BookingFlow } from "./booking-flow";

export const metadata: Metadata = {
  title: "Reservar cita",
  description: "Elige servicio, profesional y horario para tu próxima visita.",
};

export default function BookingPage() {
  return (
    <Suspense fallback={<div className="booking-loading">Preparando horarios…</div>}>
      <BookingFlow />
    </Suspense>
  );
}
