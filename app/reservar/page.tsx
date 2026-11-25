import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { BookingFlow } from "./booking-flow";
import { getBookingData } from "@/lib/public-data";

export const metadata: Metadata = {
  title: "Reservar cita",
  description: "Elige qué hacerte, con quién y a qué hora en LEGEND CLUB.",
};

export default async function BookingPage() {
  await connection();
  const booking = await getBookingData();

  if (!booking || !booking.services.length || !booking.barbers.length) {
    return (
      <main className="booking-loading">
        <div>
          <p>{booking ? "Por ahora no hay opciones de reserva en línea." : "No pudimos cargar la agenda en este momento."}</p>
          <a className="text-link" href="/reservar">Intentar de nuevo</a>
        </div>
      </main>
    );
  }

  return (
    <Suspense fallback={<div className="booking-loading">Preparando horarios…</div>}>
      <BookingFlow {...booking} />
    </Suspense>
  );
}
