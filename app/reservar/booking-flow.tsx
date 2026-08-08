"use client";

import { useMemo, useState } from "react";
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
import { barbers, services } from "@/lib/demo-data";

const times = ["09:00", "09:45", "10:30", "11:15", "14:00", "14:45", "16:30", "18:00"];

function availableDays() {
  const formatter = new Intl.DateTimeFormat("es-BO", { weekday: "short" });
  return Array.from({ length: 6 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() + index + 1);
    return {
      id: date.toISOString().slice(0, 10),
      day: formatter.format(date).replace(".", ""),
      number: date.getDate(),
    };
  });
}

export function BookingFlow() {
  const params = useSearchParams();
  const initialService = params.get("servicio") ?? "";
  const initialBarber = params.get("peluquero") ?? "any";
  const [step, setStep] = useState(initialService ? 2 : 1);
  const [serviceId, setServiceId] = useState(initialService);
  const [barberId, setBarberId] = useState(initialBarber);
  const [day, setDay] = useState("");
  const [time, setTime] = useState("");
  const [signedIn, setSignedIn] = useState(false);
  const [phone, setPhone] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const days = useMemo(() => availableDays(), []);

  const service = services.find((item) => item.id === serviceId);
  const barber = barbers.find((item) => item.id === barberId);
  const selectedDay = days.find((item) => item.id === day);

  function chooseService(id: string) {
    setServiceId(id);
    setStep(2);
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
        <div className="booking-topbar"><Brand /><span className="demo-badge">MODO DEMOSTRACIÓN</span></div>
        <section className="success-card">
          <span className="success-icon"><CalendarCheck size={35} /></span>
          <p className="eyebrow">RESERVA REGISTRADA</p>
          <h1>¡Nos vemos pronto!</h1>
          <p className="success-copy">Esta confirmación es una simulación visual. Se conectará a Supabase para guardar citas reales.</p>
          <div className="ticket">
            <div><span>Servicio</span><strong>{service?.name}</strong></div>
            <div><span>Profesional</span><strong>{barber?.name ?? "Primero disponible"}</strong></div>
            <div><span>Fecha</span><strong>{selectedDay?.day} {selectedDay?.number} · {time}</strong></div>
            <div><span>Total</span><strong>Bs {service?.price}</strong></div>
          </div>
          <Link className="button button-dark" href="/">Volver al inicio</Link>
        </section>
      </main>
    );
  }

  return (
    <main className="booking-shell">
      <div className="booking-topbar">
        <Brand />
        <Link href="/" className="close-booking">Cerrar <span>×</span></Link>
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
                <button className={`barber-choice any-choice ${barberId === "any" ? "selected" : ""}`} onClick={() => setBarberId("any")}>
                  <span className="any-icon"><Scissors /></span>
                  <strong>Primero disponible</strong>
                  <small>Más opciones de horario</small>
                  <i>{barberId === "any" && <Check size={14} />}</i>
                </button>
                {barbers.map((item) => (
                  <button className={`barber-choice ${barberId === item.id ? "selected" : ""}`} onClick={() => setBarberId(item.id)} key={item.id}>
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
              <p className="panel-copy">Los horarios mostrados son demostrativos hasta conectar la agenda real.</p>
              <div className="date-strip">
                {days.map((item) => (
                  <button className={day === item.id ? "selected" : ""} key={item.id} onClick={() => { setDay(item.id); setTime(""); }}>
                    <span>{item.day}</span><strong>{item.number}</strong>
                  </button>
                ))}
              </div>
              {day ? (
                <div className="time-area">
                  <p>Horarios disponibles</p>
                  <div className="time-grid">
                    {times.map((item, index) => (
                      <button disabled={index === 2 || index === 5} className={time === item ? "selected" : ""} key={item} onClick={() => setTime(item)}>{item}</button>
                    ))}
                  </div>
                </div>
              ) : <div className="empty-times">Selecciona un día para ver sus horarios.</div>}
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
                  <button className="google-button" onClick={() => setSignedIn(true)}>
                    <b>G</b> Continuar con Google
                  </button>
                  <small>Demostración: el acceso real se activará al configurar Supabase.</small>
                </div>
              ) : (
                <div className="contact-form">
                  <div className="signed-user"><span>DR</span><p><strong>Diego Rojas</strong><small>diego@example.com · cuenta demo</small></p><Check size={18} /></div>
                  <label>Teléfono de contacto<input type="tel" placeholder="Ej. 720 12345" value={phone} onChange={(event) => setPhone(event.target.value)} /></label>
                  <label className="check-label"><input type="checkbox" defaultChecked /> <span>Acepto las condiciones de reserva y cancelación.</span></label>
                  <button disabled={phone.trim().length < 7} className="button button-dark confirm-button" onClick={() => setConfirmed(true)}>Confirmar reserva <CalendarCheck size={17} /></button>
                </div>
              )}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
