"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowRight,
  CalendarCheck,
  Check,
  ChevronLeft,
  Clock3,
  Scissors,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { Brand } from "@/components/brand";
import { businessDateKey, zonedDateTimeToDate } from "@/lib/business-time";
import { createClient } from "@/lib/supabase/client";
import type { PublicBarber, PublicService } from "@/lib/public-data";

const pendingBookingKey = "legend_club_pending_booking";

type SignedUser = {
  name: string;
  email: string;
  initials: string;
};

function availableDays(timezone: string) {
  const [year, month, day] = businessDateKey(new Date(), timezone).split("-").map(Number);
  const formatter = new Intl.DateTimeFormat("es-BO", { weekday: "short", timeZone: "UTC" });
  return Array.from({ length: 6 }, (_, index) => {
    const date = new Date(Date.UTC(year, month - 1, day + index + 1, 12));
    const itemYear = date.getUTCFullYear();
    const itemMonth = String(date.getUTCMonth() + 1).padStart(2, "0");
    const dayOfMonth = String(date.getUTCDate()).padStart(2, "0");
    return {
      id: `${itemYear}-${itemMonth}-${dayOfMonth}`,
      day: formatter.format(date).replace(".", ""),
      number: date.getUTCDate(),
    };
  });
}

type BookingFlowProps = {
  services: PublicService[];
  barbers: PublicBarber[];
  timezone: string;
};

export function BookingFlow({ services, barbers, timezone }: BookingFlowProps) {
  const params = useSearchParams();
  const initialService = params.get("servicio") ?? "";
  const initialBarber = params.get("peluquero") ?? "any";
  const requestedReturn = params.get("return") ?? "/";
  const returnPath = requestedReturn.startsWith("/") && !requestedReturn.startsWith("//") ? requestedReturn : "/";
  const [step, setStep] = useState(initialService ? 2 : 1);
  const [serviceId, setServiceId] = useState(initialService);
  const [barberId, setBarberId] = useState(initialBarber);
  const [day, setDay] = useState("");
  const [time, setTime] = useState("");
  const [signedIn, setSignedIn] = useState(false);
  const [signedUser, setSignedUser] = useState<SignedUser | null>(null);
  const [authError, setAuthError] = useState(params.get("auth_error") ?? "");
  const [authLoading, setAuthLoading] = useState(false);
  const [phone, setPhone] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [availableTimes, setAvailableTimes] = useState<string[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [bookingError, setBookingError] = useState("");
  const [bookingLoading, setBookingLoading] = useState(false);
  const days = useMemo(() => availableDays(timezone), [timezone]);

  const service = services.find((item) => item.id === serviceId);
  const barber = barbers.find((item) => item.id === barberId);
  const selectedDay = days.find((item) => item.id === day);

  useEffect(() => {
    const supabase = createClient();

    async function restoreSession() {
      const { data } = await supabase.auth.getUser();
      const user = data.user;

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

        const { data: profile } = await supabase
          .from("profiles")
          .select("phone")
          .eq("id", user.id)
          .maybeSingle();
        if (profile?.phone) setPhone(profile.phone);
      }

      if (params.get("auth") === "complete") {
        const stored = window.sessionStorage.getItem(pendingBookingKey);
        if (stored) {
          const pending = JSON.parse(stored) as {
            serviceId: string;
            barberId: string;
            day: string;
            time: string;
          };
          setServiceId(pending.serviceId);
          setBarberId(pending.barberId);
          setDay(pending.day);
          setTime(pending.time);
          setStep(4);
          window.sessionStorage.removeItem(pendingBookingKey);
        }
      }
    }

    void restoreSession();
  }, [params]);

  useEffect(() => {
    if (!day || !serviceId) return;
    let active = true;

    async function loadAvailability() {
      setSlotsLoading(true);
      setBookingError("");
      const supabase = createClient();
      const { data, error } = await supabase.rpc("get_available_slots", {
        p_service_slug: serviceId,
        p_barber_slug: barberId || "any",
        p_date: day,
      });

      if (!active) return;
      if (error) {
        setAvailableTimes([]);
        setBookingError("La agenda todavía no está disponible. Intenta nuevamente en unos minutos.");
      } else {
        const formatter = new Intl.DateTimeFormat("es-BO", {
          hour: "2-digit",
          minute: "2-digit",
          hourCycle: "h23",
          timeZone: timezone,
        });
        const slots = (data ?? []) as Array<{ starts_at: string }>;
        const uniqueTimes = [...new Set<string>(
          slots.map((slot) => formatter.format(new Date(slot.starts_at))),
        )];
        setAvailableTimes(uniqueTimes);
        setTime((current) => current && !uniqueTimes.includes(current) ? "" : current);
      }
      setSlotsLoading(false);
    }

    void loadAvailability();
    return () => {
      active = false;
    };
  }, [barberId, day, serviceId, timezone]);

  async function signInWithGoogle() {
    setAuthLoading(true);
    setAuthError("");
    window.sessionStorage.setItem(
      pendingBookingKey,
      JSON.stringify({ serviceId, barberId, day, time }),
    );

    const supabase = createClient();
    const bookingReturn = returnPath === "/" ? "/reservar?auth=complete" : `/reservar?auth=complete&return=${encodeURIComponent(returnPath)}`;
    const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(bookingReturn)}`;
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo, skipBrowserRedirect: true },
    });

    if (error) {
      setAuthError(error.message);
      setAuthLoading(false);
      return;
    }
    if (data.url) window.location.replace(data.url);
    else { setAuthError("No pudimos abrir el acceso con Google."); setAuthLoading(false); }
  }

  async function confirmAppointment() {
    if (!service || !day || !time || phone.trim().length < 7 || !acceptedTerms) return;
    setBookingLoading(true);
    setBookingError("");

    const supabase = createClient();
    const startsAt = zonedDateTimeToDate(`${day}T${time}:00`, timezone).toISOString();
    const { error } = await supabase.rpc("create_appointment", {
      p_service_slug: service.id,
      p_barber_slug: barberId || "any",
      p_starts_at: startsAt,
      p_phone: phone,
    });

    if (error) {
      setBookingError(error.message || "No pudimos guardar la cita. Revisa el horario e inténtalo nuevamente.");
      setBookingLoading(false);
      return;
    }

    setConfirmed(true);
    setBookingLoading(false);
  }

  function chooseService(id: string) {
    setServiceId(id);
    setDay("");
    setTime("");
    setStep(2);
  }

  function chooseBarber(id: string) {
    setBarberId(id);
    setDay("");
    setTime("");
  }

  function nextFromBarber() {
    setStep(3);
  }

  function nextFromSchedule() {
    if (day && time) setStep(4);
  }

  if (confirmed) {
    return (
      <main className="booking-shell success-shell">
        <div className="booking-topbar"><Brand /><span className="demo-badge">RESERVA CONFIRMADA</span></div>
        <section className="success-card">
          <span className="success-icon"><CalendarCheck size={35} /></span>
          <p className="eyebrow">RESERVA REGISTRADA</p>
          <h1>¡Nos vemos pronto!</h1>
          <p className="success-copy">Tu cita quedó registrada. Puedes consultarla, recibir avisos o cancelarla desde tu cuenta.</p>
          <div className="ticket">
            <div><span>Servicio</span><strong>{service?.name}</strong></div>
            <div><span>Profesional</span><strong>{barber?.name ?? "Primero disponible"}</strong></div>
            <div><span>Fecha</span><strong>{selectedDay?.day} {selectedDay?.number} · {time}</strong></div>
            <div><span>Total</span><strong>Bs {service?.price}</strong></div>
          </div>
          <Link replace className="button button-dark" href="/mi-cuenta/citas">Ver mis citas</Link>
        </section>
      </main>
    );
  }

  return (
    <main className="booking-shell">
      <div className="booking-topbar">
        <Brand />
        <Link replace href={returnPath} className="close-booking">Cerrar <span>×</span></Link>
      </div>

      <div className="booking-layout">
        <aside className="booking-aside">
          <p className="eyebrow light">RESERVA EN LÍNEA</p>
          <h1>Tu próxima<br /><em>visita.</em></h1>
          <ol className="booking-steps">
            {[
              { number: 1, label: "Servicio", copy: "¿Qué necesitas?" },
              { number: 2, label: "Profesional", copy: "Elige quién te atiende" },
              { number: 3, label: "Fecha y hora", copy: "Encuentra tu momento" },
              { number: 4, label: "Tus datos", copy: "Confirma la reserva" },
            ].map(({ number, label, copy }) => (
              <li className={step === number ? "active" : step > number ? "done" : ""} key={number}>
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
          {step > 1 && (
            <button className="back-button" onClick={() => setStep((current) => current - 1)}>
              <ChevronLeft size={18} /> Atrás
            </button>
          )}

          {step === 1 && (
            <div className="booking-panel">
              <div className="panel-heading"><span><Scissors /></span><div><p>PASO 1 DE 4</p><h2>Elige un servicio</h2></div></div>
              <p className="panel-copy">Selecciona lo que necesitas. Verás únicamente horarios con tiempo suficiente para atenderte.</p>
              <div className="choice-list">
                {services.map((item) => (
                  <button key={item.id} onClick={() => chooseService(item.id)} className="choice-card">
                    <div><span>{item.category}</span><h3>{item.name}</h3><p>{item.description}</p></div>
                    <div className="choice-price"><strong>Bs {item.price}</strong><span>{item.duration} min</span><ArrowRight size={18} /></div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="booking-panel">
              <div className="panel-heading"><span><UserRound /></span><div><p>PASO 2 DE 4</p><h2>Elige profesional</h2></div></div>
              <p className="panel-copy">Puedes elegir a alguien en particular o encontrar el primer horario disponible.</p>
              <div className="barber-choice-grid">
                <button className={`barber-choice any-choice ${barberId === "any" ? "selected" : ""}`} onClick={() => chooseBarber("any")}>
                  <span className="any-icon"><Scissors /></span>
                  <strong>Primero disponible</strong>
                  <small>Más opciones de horario</small>
                  <i>{barberId === "any" && <Check size={14} />}</i>
                </button>
                {barbers.map((item) => (
                  <button className={`barber-choice ${barberId === item.id ? "selected" : ""}`} onClick={() => chooseBarber(item.id)} key={item.id}>
                    <span className="barber-choice-photo" style={{ backgroundImage: `url(${item.image})` }} />
                    <strong>{item.name}</strong>
                    <small>{item.specialties}</small>
                    <i>{barberId === item.id && <Check size={14} />}</i>
                  </button>
                ))}
              </div>
              <div className="panel-actions"><button className="button button-dark" onClick={nextFromBarber}>Ver horarios <ArrowRight size={17} /></button></div>
            </div>
          )}

          {step === 3 && (
            <div className="booking-panel">
              <div className="panel-heading"><span><Clock3 /></span><div><p>PASO 3 DE 4</p><h2>Fecha y hora</h2></div></div>
              <p className="panel-copy">La agenda considera la duración del servicio, los horarios del equipo y las citas existentes.</p>
              <div className="date-strip">
                {days.map((item) => (
                  <button className={day === item.id ? "selected" : ""} key={item.id} onClick={() => { setDay(item.id); setTime(""); }}>
                    <span>{item.day}</span><strong>{item.number}</strong>
                  </button>
                ))}
              </div>
              {day && slotsLoading ? (
                <div className="empty-times">Consultando agenda disponible…</div>
              ) : day ? (
                <div className="time-area">
                  <p>Horarios disponibles</p>
                  {availableTimes.length ? <div className="time-grid">
                    {availableTimes.map((item) => (
                      <button className={time === item ? "selected" : ""} key={item} onClick={() => setTime(item)}>{item}</button>
                    ))}
                  </div> : <div className="empty-times small-empty">No quedan horarios disponibles para este día.</div>}
                </div>
              ) : <div className="empty-times">Selecciona un día para ver sus horarios.</div>}
              {bookingError && <p className="booking-error">{bookingError}</p>}
              <div className="panel-actions"><button disabled={!day || !time} className="button button-dark" onClick={nextFromSchedule}>Continuar <ArrowRight size={17} /></button></div>
            </div>
          )}

          {step === 4 && (
            <div className="booking-panel">
              <div className="panel-heading"><span><ShieldCheck /></span><div><p>PASO 4 DE 4</p><h2>Confirma tu cita</h2></div></div>
              <div className="booking-summary">
                <div><span>Servicio</span><strong>{service?.name}</strong></div>
                <div><span>Profesional</span><strong>{barber?.name ?? "Primero disponible"}</strong></div>
                <div><span>Horario</span><strong>{selectedDay?.day} {selectedDay?.number} · {time}</strong></div>
                <div><span>Precio</span><strong>Bs {service?.price}</strong></div>
              </div>
              {!signedIn ? (
                <div className="login-box">
                  <h3>Inicia sesión para reservar</h3>
                  <p>Usaremos tu cuenta únicamente para identificar tus citas y mantenerte informado.</p>
                  <button className="google-button" disabled={authLoading} onClick={signInWithGoogle}>
                    <b>G</b> {authLoading ? "Conectando…" : "Continuar con Google"}
                  </button>
                  {authError ? <small className="auth-error">{authError}</small> : <small>Acceso protegido mediante Supabase Auth.</small>}
                </div>
              ) : (
                <div className="contact-form">
                  <div className="signed-user"><span>{signedUser?.initials ?? "OK"}</span><p><strong>{signedUser?.name ?? "Cliente"}</strong><small>{signedUser?.email}</small></p><Check size={18} /></div>
                  <label>Teléfono de contacto<input type="tel" placeholder="Ej. 720 12345" value={phone} onChange={(event) => setPhone(event.target.value)} /></label>
                  <label className="check-label"><input type="checkbox" checked={acceptedTerms} onChange={(event) => setAcceptedTerms(event.target.checked)} /> <span>Acepto las condiciones de reserva y cancelación.</span></label>
                  {bookingError && <p className="booking-error">{bookingError}</p>}
                  <button disabled={phone.trim().length < 7 || !acceptedTerms || bookingLoading} className="button button-dark confirm-button" onClick={confirmAppointment}>{bookingLoading ? "Confirmando…" : "Confirmar reserva"} <CalendarCheck size={17} /></button>
                </div>
              )}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
