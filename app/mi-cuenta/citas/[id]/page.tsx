import { notFound, redirect } from "next/navigation";
import { formatBookingDateTime } from "@/lib/business-time";
import { createClient } from "@/lib/supabase/server";
import { BookingReceipt } from "@/app/reservar/booking-success";
import "@/app/reservar/booking.css";

export default async function AppointmentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id)) notFound();

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/mi-cuenta/citas/${id}`)}`);

  const [appointment, settings] = await Promise.all([
    supabase.from("appointments")
      .select("starts_at,status,service_name_snapshot,barber_name_snapshot,price_snapshot,barber_profiles!appointments_barber_id_fkey(display_name)")
      .eq("id", id)
      .eq("client_id", user.id)
      .maybeSingle(),
    supabase.from("business_settings").select("timezone").eq("id", true).maybeSingle(),
  ]);

  if (appointment.error) throw appointment.error;
  if (!appointment.data) notFound();

  const item = appointment.data;
  const barber = item.barber_profiles as unknown as { display_name: string } | null;
  const dateAndTime = formatBookingDateTime(new Date(item.starts_at), settings.data?.timezone ?? undefined);

  return <BookingReceipt status={item.status} booking={{
    id,
    serviceName: item.service_name_snapshot,
    barberName: item.barber_name_snapshot ?? barber?.display_name ?? "Barbero por asignar",
    dateAndTime,
    price: Number(item.price_snapshot),
  }} />;
}
