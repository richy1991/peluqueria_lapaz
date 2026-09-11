import type { Metadata } from "next";
import { Suspense } from "react";
import { BookingFlow } from "./booking-flow";
import { getPublicData } from "@/lib/public-data";

export const metadata: Metadata = {
  title: "Reservar cita",
  description: "Elige servicio, profesional y horario para tu próxima visita.",
};

export const dynamic = "force-dynamic";

export default async function BookingPage() {
  const { services, barbers, business } = await getPublicData();

  return (
    <Suspense fallback={<div className="booking-loading">Preparando horarios…</div>}>
      <BookingFlow services={services} barbers={barbers} timezone={business.timezone} />
    </Suspense>
  );
}
