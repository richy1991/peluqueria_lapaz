"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowRight,
  CalendarDays,
  CalendarCheck,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Scissors,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { Brand } from "@/components/brand";
import { GoogleSignInCard } from "@/components/google-sign-in-card";
import { Button, Card } from "@/components/ui";
import { businessDateKey, formatBookingDateTime, zonedDateTimeToDate } from "@/lib/business-time";
import type { BusinessHour } from "@/lib/business-hours";
import { createClient } from "@/lib/supabase/client";
import { googleSignInPath } from "@/lib/supabase/google-redirect";
import type { PublicBarber, PublicService } from "@/lib/public-data";
import { BookingContentHeight } from "./booking-content-height";
import { BookingSuccess, type ConfirmedBooking } from "./booking-success";
import { BookingTimeChoices } from "./booking-time-choices";

const pendingBookingKey = "legend_club_pending_booking";
const daysPerPage = 7;

type SignedUser = {
  name: string;
  email: string;
  initials: string;
};

type SlotChoice = { starts_at: string; time: string; is_available: boolean };

function availableDays(timezone: string) {
  const [year, month, day] = businessDateKey(new Date(), timezone).split("-").map(Number);
  const weekdayFormatter = new Intl.DateTimeFormat("es-BO", { weekday: "short", timeZone: "UTC" });
  const monthFormatter = new Intl.DateTimeFormat("es-BO", { month: "short", timeZone: "UTC" });
  return Array.from({ length: 14 }, (_, index) => {
    const date = new Date(Date.UTC(year, month - 1, day + index, 12));
    const itemYear = date.getUTCFullYear();
    const itemMonth = String(date.getUTCMonth() + 1).padStart(2, "0");
    const dayOfMonth = String(date.getUTCDate()).padStart(2, "0");
    return {
      id: `${itemYear}-${itemMonth}-${dayOfMonth}`,
      day: index === 0 ? "Hoy" : index === 1 ? "Mañana" : weekdayFormatter.format(date).replace(".", ""),
      number: date.getUTCDate(),
      month: monthFormatter.format(date).replace(".", ""),
    };
  });
}

type BookingFlowProps = {
  services: PublicService[];
  barbers: PublicBarber[];
  timezone: string;
  businessHours: BusinessHour[];
  businessStatus: string;
};

export function BookingFlow({ services, barbers, timezone, businessHours, businessStatus }: BookingFlowProps) {
  const params = useSearchParams();
  const requestedService = params.get("servicio") ?? "";
  const initialService = services.some((item) => item.id === requestedService) ? requestedService : "";
  const requestedBarber = params.get("peluquero") ?? "";
  const initialBarber = barbers.some((item) => item.id === requestedBarber) ? requestedBarber : "";
  const requestedReturn = params.get("return") ?? "/";
  const returnPath = requestedReturn.startsWith("/") && !requestedReturn.startsWith("//") ? requestedReturn : "/";
  const [step, setStep] = useState(initialService ? 2 : 1);
  const [serviceIds, setServiceIds] = useState<string[]>(() => initialService ? [initialService] : []);
  const [barberId, setBarberId] = useState(initialBarber);
  const [reservedDayKeys, setReservedDayKeys] = useState<string[]>([]);
  const [day, setDay] = useState("");
  const [datePage, setDatePage] = useState<{ index: number; direction: "next" | "previous" } | null>(null);
  const [time, setTime] = useState("");
  const [signedIn, setSignedIn] = useState(false);
  const [signedUser, setSignedUser] = useState<SignedUser | null>(null);
  const authError = params.get("auth_error") ?? "";
  const [authLoading, setAuthLoading] = useState(false);
  const [phone, setPhone] = useState("");
  const [hasRegisteredPhone, setHasRegisteredPhone] = useState(false);
  const [confirmedBooking, setConfirmedBooking] = useState<ConfirmedBooking | null>(null);
  const [availableTimes, setAvailableTimes] = useState<SlotChoice[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [availabilityVersion, setAvailabilityVersion] = useState(0);
  const [bookingError, setBookingError] = useState("");
  const [bookingLoading, setBookingLoading] = useState(false);
  const selectedTimeRef = useRef("");
  const stepTitle = useRef<HTMLHeadingElement>(null);
  const previousStep = useRef(step);
  const days = useMemo(() => availableDays(timezone), [timezone]);

  const selectedServices = serviceIds.map((id) => services.find((item) => item.id === id)).filter((item): item is PublicService => Boolean(item));
  const serviceName = selectedServices.map((item) => item.name).join(" + ");
  const serviceDuration = selectedServices.reduce((total, item) => total + item.duration, 0);
  const servicePrice = selectedServices.reduce((total, item) => total + item.price, 0);
  const bookableBarbers = selectedServices.length
    ? barbers.filter((item) => item.serviceSlugs === undefined || selectedServices.every((service) => item.serviceSlugs?.includes(service.id)))
    : barbers;
  const barber = bookableBarbers.find((item) => item.id === barberId);
  const selectedDay = days.find((item) => item.id === day);
  const selectedDatePage = Math.max(0, Math.floor(days.findIndex((item) => item.id === day) / daysPerPage));
  const firstShownDay = (datePage?.index ?? selectedDatePage) * daysPerPage;
  const shownDays = days.slice(firstShownDay, firstShownDay + daysPerPage);
  const firstDate = shownDays[0];
  const lastDate = shownDays[shownDays.length - 1];
  const dateRange = `${firstDate.number}${firstDate.month === lastDate.month ? "" : ` ${firstDate.month}`}–${lastDate.number} ${lastDate.month}`;
  const localWeekday = selectedDay ? new Date(`${selectedDay.id}T12:00:00Z`).getUTCDay() : -1;
  const selectedBusinessDay = businessHours.find((item) => item.weekday === localWeekday);
  const bookingClosed = businessStatus === "closed" || businessStatus === "emergency_closed";
  const canContinueFromSchedule = Boolean(day) && !slotsLoading && availableTimes.some((slot) => slot.time === time && slot.is_available);

  useEffect(() => {
    selectedTimeRef.current = time;
  }, [time]);

  useEffect(() => {
    if (previousStep.current === step) return;
    previousStep.current = step;
    window.scrollTo({ top: 0, behavior: "instant" });
    stepTitle.current?.focus({ preventScroll: true });
  }, [step]);

  useEffect(() => {
    const supabase = createClient();

    async function restoreSession() {
      const { data } = await supabase.auth.getUser();
      const user = data.user;

      if (params.get("auth") === "complete") {
        const stored = window.sessionStorage.getItem(pendingBookingKey);
        if (stored) {
          try {
            const pending = JSON.parse(stored) as { serviceId?: string; serviceIds?: string[]; barberId: string; day: string; time: string };
            const pendingServiceIds = Array.isArray(pending.serviceIds) ? pending.serviceIds : pending.serviceId ? [pending.serviceId] : [];
            if (pendingServiceIds.length && pendingServiceIds.every((id) => services.some((item) => item.id === id))) {
              setServiceIds(pendingServiceIds);
              const savedBarber = barbers.find((item) => item.id === pending.barberId
                && (item.serviceSlugs === undefined || pendingServiceIds.every((id) => item.serviceSlugs?.includes(id))));
              if (savedBarber) {
                setBarberId(savedBarber.id);
                if (days.some((item) => item.id === pending.day) && /^\d{2}:\d{2}$/.test(pending.time)) {
                  setDay(pending.day);
                  setTime(pending.time);
                  setStep(4);
                } else {
                  setStep(3);
                }
              } else {
                setStep(2);
              }
            }
          } catch {
            window.sessionStorage.removeItem(pendingBookingKey);
          }
        }
      }

      if (user) {
        const name = user.user_metadata?.full_name ?? user.email?.split("@")[0] ?? "Cliente";
        const initials = name
          .split(" ")
          .slice(0, 2)
          .map((part: string) => part[0])
          .join("")
          .toUpperCase();

        setSignedUser({ name, email: user.email ?? "", initials });
        setSignedIn(true);

        const firstDay = days[0]?.id;
        const lastDay = days[days.length - 1]?.id;
        if (firstDay && lastDay) {
          const nextDay = new Date(`${lastDay}T00:00:00.000Z`);
          nextDay.setUTCDate(nextDay.getUTCDate() + 1);
          const endDay = nextDay.toISOString().slice(0, 10);
          const { data: appointments } = await supabase
            .from("appointments")
            .select("starts_at")
            .eq("client_id", user.id)
            .neq("status", "canceled")
            .gte("starts_at", zonedDateTimeToDate(`${firstDay}T00:00:00`, timezone).toISOString())
            .lt("starts_at", zonedDateTimeToDate(`${endDay}T00:00:00`, timezone).toISOString());
          setReservedDayKeys([...new Set((appointments ?? []).map(item => businessDateKey(new Date(item.starts_at), timezone)))]);
        }

        const { data: profile } = await supabase
          .from("profiles")
          .select("phone")
          .eq("id", user.id)
          .maybeSingle();
        if (profile?.phone) {
          setPhone(profile.phone);
          setHasRegisteredPhone(profile.phone.replace(/\D/g, "").length >= 7);
        }
      }

    }

    void restoreSession();
  }, [barbers, days, params, services, timezone]);

  useEffect(() => {
    if (!day || !reservedDayKeys.includes(day)) return;
    let active = true;
    void Promise.resolve().then(() => {
      if (!active) return;
    setDay("");
    setTime("");
    setAvailableTimes([]);
    setStep(3);
    setBookingError("Ya tienes una cita para esta fecha. Solo puedes reservar una por día.");
    });
    return () => { active = false; };
  }, [day, reservedDayKeys]);

  useEffect(() => {
    if (!day || !serviceIds.length || !barberId) return;
    if (bookingClosed || !selectedBusinessDay?.active) {
      let active = true;
      void Promise.resolve().then(() => {
        if (!active) return;
      setAvailableTimes([]);
      setSlotsLoading(false);
      setBookingError("");
      if (selectedTimeRef.current) {
        setTime("");
        setStep(3);
        setBookingError(bookingClosed
          ? "El negocio pausó las reservas. Elige otra fecha más adelante."
          : "El local no atiende en esta fecha. Elige otro día.");
      }
      });
      return () => { active = false; };
    }
    let active = true;

    async function loadAvailability() {
      setSlotsLoading(true);
      const supabase = createClient();
      const { data, error } = await supabase.rpc("get_booking_slots_for_services", {
        p_service_slugs: serviceIds,
        p_barber_slug: barberId,
        p_date: day,
      });

      if (!active) return;
      if (error) {
        setAvailableTimes([]);
        setBookingError("La agenda todavía no está disponible. Intenta nuevamente en unos minutos.");
        if (selectedTimeRef.current) {
          setTime("");
          setStep(3);
        }
      } else {
        const formatter = new Intl.DateTimeFormat("es-BO", {
          hour: "2-digit",
          minute: "2-digit",
          hourCycle: "h23",
          timeZone: timezone,
        });
        const slots = (data ?? []) as Array<{ starts_at: string; is_available: boolean }>;
        const uniqueTimes = [...new Map(slots.map((slot) => [formatter.format(new Date(slot.starts_at)), {
          starts_at: slot.starts_at,
          time: formatter.format(new Date(slot.starts_at)),
          is_available: slot.is_available,
        }])).values()];
        setAvailableTimes(uniqueTimes);
        const selectedTime = selectedTimeRef.current;
        if (selectedTime && !uniqueTimes.some((slot) => slot.time === selectedTime && slot.is_available)) {
          setTime("");
          setBookingError("Ese horario ya no está disponible. Elige otro para continuar.");
          setStep(3);
        }
      }
      setSlotsLoading(false);
    }

    void loadAvailability();
    return () => {
      active = false;
    };
  }, [availabilityVersion, barberId, bookingClosed, day, selectedBusinessDay?.active, serviceIds, timezone]);

  async function signInWithGoogle() {
    setAuthLoading(true);
    window.sessionStorage.setItem(
      pendingBookingKey,
      JSON.stringify({ serviceIds, barberId, day, time }),
    );

    const bookingReturn = returnPath === "/" ? "/reservar?auth=complete" : `/reservar?auth=complete&return=${encodeURIComponent(returnPath)}`;
    window.location.replace(googleSignInPath(bookingReturn));
  }

  async function confirmAppointment() {
    if (!selectedServices.length || !barber || !day || !time || !availableTimes.some((slot) => slot.time === time && slot.is_available)) {
      setBookingError("Vuelve a elegir un horario disponible para continuar.");
      setStep(3);
      return;
    }
    if (phone.trim().replace(/\D/g, "").length < 7) return;
    setBookingLoading(true);
    setBookingError("");

    const supabase = createClient();
    const startsAt = zonedDateTimeToDate(`${day}T${time}:00`, timezone).toISOString();
    const { data: appointmentId, error } = await supabase.rpc("create_appointment_with_services", {
      p_service_slugs: selectedServices.map((item) => item.id),
      p_barber_slug: barberId,
      p_starts_at: startsAt,
      p_phone: phone,
    });

    if (error) {
      const errorMessage = error.message || "No pudimos guardar la cita. Revisa el horario e inténtalo nuevamente.";
      setBookingError(errorMessage);
      if (/horario|negocio no está recibiendo/i.test(errorMessage)) {
        setTime("");
        setStep(3);
        setAvailabilityVersion((current) => current + 1);
      }
      setBookingLoading(false);
      return;
    }

    window.sessionStorage.removeItem(pendingBookingKey);
    setConfirmedBooking({
      id: typeof appointmentId === "string" ? appointmentId : undefined,
      serviceName,
      barberName: barber.name,
      dateAndTime: formatBookingDateTime(new Date(startsAt), timezone),
      price: servicePrice,
    });
    setBookingLoading(false);
  }

  function chooseService(id: string) {
    const alreadySelected = serviceIds.includes(id);
    if (!alreadySelected) {
      const service = services.find((item) => item.id === id);
      if (serviceIds.length >= 12) {
        setBookingError("Puedes combinar hasta 12 servicios en una reserva.");
        return;
      }
      if (service && serviceDuration + service.duration > 480) {
        setBookingError("La duración total de una cita no puede superar 8 horas.");
        return;
      }
    }
    setServiceIds((current) => current.includes(id) ? current.filter((serviceId) => serviceId !== id) : [...current, id]);
    setBarberId("");
    clearSchedule();
    setBookingError("");
  }

  function chooseBarber(id: string) {
    if (id === barberId) return;
    setBarberId(id);
    clearSchedule();
    setBookingError("");
  }

  function clearSchedule() {
    setDay("");
    setDatePage(null);
    setTime("");
    setAvailableTimes([]);
    setSlotsLoading(false);
  }

  function chooseDate(id: string) {
    if (id === day) return;
    setDay(id);
    setTime("");
    setAvailableTimes([]);
    setSlotsLoading(true);
    setBookingError("");
  }

  function turnDatePage(offset: -1 | 1) {
    setDatePage({ index: firstShownDay / daysPerPage + offset, direction: offset > 0 ? "next" : "previous" });
  }

  function nextFromBarber() {
    if (!barberId) return;
    setStep(3);
  }

  function nextFromSchedule() {
    if (canContinueFromSchedule) setStep(4);
  }

  const backButton = (
    <Button variant="ghost" className="booking-back" onClick={() => setStep((current) => current - 1)}>
      <ChevronLeft size={18} aria-hidden="true" /> Atrás
    </Button>
  );

  if (confirmedBooking) return <BookingSuccess booking={confirmedBooking} />;

  return (
    <main className="booking-shell" data-booking-step={step}>
      <header className="booking-topbar">
        <Brand />
        <strong className="booking-mobile-step-title">Reserva tu cita</strong>
        <Link replace href={returnPath} className="close-booking">Cerrar <span aria-hidden="true">×</span></Link>
      </header>

      <div className="booking-layout">
        <aside className="booking-aside">
          <p className="eyebrow light">RESERVA EN LÍNEA</p>
          <h1>Tu próxima<br /><em>visita.</em></h1>
          <ol className="booking-steps">
            {[
              { number: 1, label: "Servicios", copy: "Elige uno o varios" },
              { number: 2, label: "Barbero", copy: "Elige con quién ir" },
              { number: 3, label: "Fecha y hora", copy: "Encuentra tu momento" },
              { number: 4, label: "Confirmar", copy: "Revisa los datos de tu cita" },
            ].map(({ number, label, copy }) => (
              <li aria-current={step === number ? "step" : undefined} className={step === number ? "active" : step > number ? "done" : ""} key={number}>
                <span>{step > number ? <Check size={15} /> : number}</span>
                <div><strong>{label}</strong><small>{copy}</small></div>
              </li>
            ))}
          </ol>
          <div className="booking-help">
            <ShieldCheck size={20} />
            <p><strong>Reserva segura</strong><span>No necesitas pagar en línea.</span></p>
          </div>
        </aside>

        <section className="booking-main">
          {step === 1 && (
            <Card className="booking-panel">
              <div className="panel-heading"><span><Scissors /></span><div><p>PASO 1 DE 4</p><h2 ref={stepTitle} tabIndex={-1}>¿Qué servicios necesitas?</h2></div></div>
              <p className="panel-copy">Selecciona uno o varios servicios. Sumaremos su duración para mostrar horarios donde quepa toda la cita.</p>
              {bookingError && <p className="booking-error" role="alert">{bookingError}</p>}
              <div className="choice-list">
                {services.map((item) => (
                  <Button variant="unstyled" key={item.id} aria-pressed={serviceIds.includes(item.id)} onClick={() => chooseService(item.id)} className={`choice-card${serviceIds.includes(item.id) ? " selected" : ""}`}>
                    <div><span>{item.category}</span><h3>{item.name}</h3><p>{item.description}</p></div>
                    <div className="choice-price"><strong>Bs {item.price}</strong><span>{item.duration} min</span>{serviceIds.includes(item.id) ? <Check size={18} aria-hidden="true" /> : <span className="booking-service-add">Agregar</span>}</div>
                  </Button>
                ))}
              </div>
              {selectedServices.length > 0 && <div className="booking-selection-summary"><Scissors size={15} aria-hidden="true" /><strong>{selectedServices.length} servicio(s) · {serviceDuration} min</strong><i aria-hidden="true" /><span>Total Bs {servicePrice.toFixed(2)}</span></div>}
              <div className="panel-actions">
                <Button className="button button-dark" disabled={!selectedServices.length} onClick={() => setStep(2)}>Elegir peluquero <ArrowRight size={17} /></Button>
              </div>
            </Card>
          )}

          {step === 2 && (
            <Card className="booking-panel">
              <div className="panel-heading"><span><UserRound /></span><div><p>PASO 2 DE 4</p><h2 ref={stepTitle} tabIndex={-1}>Elige a tu barbero</h2></div></div>
              <div className="barber-choice-grid">
                {bookableBarbers.map((item) => (
                  <Button variant="unstyled" aria-pressed={barberId === item.id} className={`barber-choice ${barberId === item.id ? "selected" : ""}`} onClick={() => chooseBarber(item.id)} key={item.id}>
                    <span className="barber-choice-photo" aria-hidden="true" style={{ backgroundImage: `url(${JSON.stringify(item.image)})` }} />
                    <span className="barber-choice-copy">
                      <strong>{item.name}</strong>
                      {item.specialties && <small>{item.specialties}</small>}
                    </span>
                    <i aria-hidden="true">{barberId === item.id && <Check size={14} />}</i>
                  </Button>
                ))}
                {selectedServices.length > 0 && bookableBarbers.length === 0 && <p className="booking-error">Ningún peluquero tiene asignados todos los servicios seleccionados. Cambia tu selección.</p>}
              </div>
              <div className="panel-actions">
                {backButton}
                <Button className="button button-dark" disabled={!barberId} onClick={nextFromBarber}>Ver horarios <ArrowRight size={17} /></Button>
              </div>
            </Card>
          )}

          {step === 3 && (
            <Card className="booking-panel">
              <div className="panel-heading"><span><Clock3 /></span><div><p>PASO 3 DE 4</p><h2 ref={stepTitle} tabIndex={-1}>¿Cuándo te queda bien?</h2></div></div>
              <div className="booking-selection-summary"><Scissors size={15} aria-hidden="true" /><strong>{serviceName}</strong><span>{serviceDuration} min en total</span><i aria-hidden="true" /><span>{barber?.name}</span></div>
              <div className="booking-schedule-grid">
                <section className="booking-schedule-block" aria-labelledby="booking-date-title">
                  <div className="booking-schedule-heading">
                    <div>
                      <h3 id="booking-date-title"><CalendarDays size={16} aria-hidden="true" /> Elige un día</h3>
                      <span aria-live="polite">{dateRange}</span>
                    </div>
                    <div className="booking-page-actions">
                      <Button variant="unstyled" aria-label="Días anteriores" disabled={firstShownDay === 0} onClick={() => turnDatePage(-1)}><ChevronLeft size={17} aria-hidden="true" /></Button>
                      <Button variant="unstyled" aria-label="Días siguientes" disabled={firstShownDay + daysPerPage >= days.length} onClick={() => turnDatePage(1)}><ChevronRight size={17} aria-hidden="true" /></Button>
                    </div>
                  </div>

                  <div key={firstShownDay} className="date-strip booking-schedule-enter" data-slide={datePage?.direction} role="group" aria-label="Fechas de reserva">
                    {shownDays.map((item) => {
                      const alreadyBooked = reservedDayKeys.includes(item.id);
                      return (
                        <Button variant="unstyled" disabled={alreadyBooked} aria-pressed={day === item.id} aria-label={`${item.day} ${item.number} ${item.month}${alreadyBooked ? ", ya tienes una cita" : ""}`} className={`${day === item.id ? "selected" : ""}${alreadyBooked ? " reserved" : ""}`} key={item.id} onClick={() => chooseDate(item.id)}>
                          <span>{item.day === "Mañana" ? "Mañ." : item.day}</span>
                          <strong>{item.number}</strong>
                        </Button>
                      );
                    })}
                  </div>

                  <BookingContentHeight>
                    {selectedBusinessDay?.active && (
                      <div className="booking-opening-hours">
                        <p><strong>Jornada continua</strong> {selectedBusinessDay.opens_at.slice(0, 5)}–{selectedBusinessDay.closes_at.slice(0, 5)}</p>
                      </div>
                    )}
                  </BookingContentHeight>
                </section>

                <section className="booking-schedule-block" aria-labelledby="booking-time-title">
                  <div className="booking-schedule-heading">
                    <div>
                      <h3 id="booking-time-title"><Clock3 size={16} aria-hidden="true" /> Elige una hora</h3>
                      <span>Bloques de {serviceDuration} min · hora de {timezone.split("/").at(-1)?.replaceAll("_", " ") ?? timezone}</span>
                    </div>
                    <span aria-live="polite">
                      {time && <strong key={time} className="booking-chosen-time"><Check size={14} aria-hidden="true" /> {time}</strong>}
                    </span>
                  </div>

                  <BookingContentHeight>
                    {bookingClosed ? (
                      <div className="empty-times schedule-closed" role="status"><strong>Reservas pausadas</strong><span>Intenta más tarde.</span></div>
                    ) : !day ? (
                      <div className="empty-times"><span>Elige una fecha para ver las horas disponibles.</span></div>
                    ) : !selectedBusinessDay?.active ? (
                      <div className="empty-times schedule-closed" role="status"><strong>El local está cerrado este día</strong><span>Prueba otra fecha.</span></div>
                    ) : slotsLoading ? (
                      <div className="empty-times" role="status"><span className="booking-spinner" aria-hidden="true" /> Consultando horarios…</div>
                    ) : availableTimes.length ? (
                      <BookingTimeChoices key={`${day}-${serviceIds.join("|")}`} times={availableTimes} value={time} onChange={(value) => { setTime(value); setBookingError(""); }} />
                    ) : !bookingError && (
                      <div className="empty-times" role="status">
                        <strong>{day === days[0].id ? "No hay horarios disponibles para hoy" : "No hay horarios disponibles para esta fecha"}</strong>
                        <span>Elige otra fecha o cambia de barbero.</span>
                      </div>
                    )}
                    {bookingError && <p className="booking-error" role="alert">{bookingError}</p>}
                  </BookingContentHeight>
                </section>
              </div>
              <div className="panel-actions">
                {backButton}
                <Button disabled={!canContinueFromSchedule} className="button button-dark" onClick={nextFromSchedule}>Continuar <ArrowRight size={17} /></Button>
              </div>
            </Card>
          )}

          {step === 4 && (
            <Card className="booking-panel">
              <div className="panel-heading"><span><ShieldCheck /></span><div><p>PASO 4 DE 4</p><h2 ref={stepTitle} tabIndex={-1}>Revisa tu cita</h2></div></div>
              <div className="booking-summary">
                <div><span>Servicios</span><strong>{serviceName}</strong><Button variant="unstyled" className="booking-edit" onClick={() => setStep(1)}>Cambiar servicios</Button></div>
                <div><span>Barbero</span><strong>{barber?.name}</strong><Button variant="unstyled" className="booking-edit" onClick={() => setStep(2)}>Cambiar barbero</Button></div>
                <div><span>Horario</span><strong>{selectedDay?.day} {selectedDay?.number} {selectedDay?.month} · {time}</strong><Button variant="unstyled" className="booking-edit" onClick={() => setStep(3)}>Cambiar horario</Button></div>
                <div><span>Duración total</span><strong>{serviceDuration} min</strong></div>
                <div><span>Precio total</span><strong>Bs {servicePrice.toFixed(2)}</strong></div>
              </div>
              {!signedIn ? (
                <GoogleSignInCard
                  heading="h3"
                  title="Tu cita, casi lista."
                  description="Tu selección queda guardada en esta pestaña. Cuando regreses de Google, pulsa «Confirmar reserva» para agendar tu cita."
                  loading={authLoading}
                  error={authLoading ? "" : authError}
                  onSignIn={signInWithGoogle}
                  secondaryAction={backButton}
                  actionsClassName="panel-actions booking-auth-actions"
                />
              ) : (
                <div className="contact-form">
                  <div className="signed-user"><span>{signedUser?.initials ?? "OK"}</span><p><strong>{signedUser?.name ?? "Cliente"}</strong><small>{signedUser?.email}</small></p><Check size={18} /></div>
                  {!hasRegisteredPhone && <label>Teléfono de contacto<input type="tel" autoComplete="tel" placeholder="Ej. 720 12345" value={phone} onChange={(event) => setPhone(event.target.value)} /></label>}
                  {hasRegisteredPhone && <p className="booking-saved-phone">Usaremos el teléfono registrado en tu perfil.</p>}
                  {bookingError && <p className="booking-error">{bookingError}</p>}
                  <div className="panel-actions booking-confirm-actions">
                    {backButton}
                    <Button disabled={!selectedServices.length || !barber || !day || !time || phone.trim().replace(/\D/g, "").length < 7 || bookingLoading} className="button button-dark confirm-button" onClick={confirmAppointment}>{bookingLoading ? "Confirmando…" : "Confirmar reserva"} <CalendarCheck size={17} /></Button>
                  </div>
                </div>
              )}
            </Card>
          )}
        </section>
      </div>
    </main>
  );
}
