"use client";

import { useEffect, useId, useRef, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, ArrowRight, CalendarCheck, CalendarClock, CalendarDays, CalendarX, ChevronRight,
  CircleAlert, Clock3, Search, X,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { zonedDateTimeToDate } from "@/lib/business-time";
import { dispatchDashboardSuccess, reportFormError } from "@/lib/form-feedback";
import "./admin-agenda.css";

export type AgendaAppointment = {
  id: string;
  barberId: string | null;
  startsAt: string;
  dateKey: string;
  dateLabel: string;
  timeLabel: string;
  service: string;
  clientName: string;
  phone: string | null;
  flagged: boolean;
  barberName: string;
  status: string;
};

type AgendaBarber = { id: string; name: string };

const filters = [
  ["all", "Todas"],
  ["pending", "Por confirmar"],
  ["confirmed", "Confirmadas"],
  ["reschedule", "Por reprogramar"],
  ["history", "Historial"],
] as const;

type Filter = typeof filters[number][0];

const statuses: Record<string, { label: string; filter?: Filter; tone?: string }> = {
  requested: { label: "Solicitada", filter: "pending", tone: "amber" },
  confirmed: { label: "Confirmada", filter: "confirmed", tone: "green" },
  in_progress: { label: "En atención", tone: "amber" },
  pending_payment: { label: "Pendiente de pago", tone: "amber" },
  completed: { label: "Completada", filter: "history", tone: "green" },
  canceled: { label: "Cancelada", filter: "history", tone: "red" },
  no_show: { label: "Inasistencia", filter: "history", tone: "red" },
  needs_reschedule: { label: "Por reprogramar", filter: "reschedule", tone: "amber" },
  pending_client_confirmation: { label: "Espera al cliente", filter: "pending", tone: "amber" },
};

const actions = {
  confirmed: {
    label: "Confirmar cita",
    icon: CalendarCheck,
    description: "La reserva quedará confirmada con el barbero y el horario actuales.",
    success: "Cita confirmada.",
  },
  needs_reschedule: {
    label: "Marcar para reprogramar",
    icon: CalendarClock,
    description: "La cita quedará pendiente de un nuevo horario y el cliente recibirá un aviso.",
    success: "Cita marcada para reprogramar.",
  },
  propose: {
    label: "Cambiar barbero u horario",
    icon: CalendarDays,
    description: "El cliente recibirá la propuesta y deberá confirmarla.",
    success: "Propuesta enviada al cliente.",
  },
  canceled: {
    label: "Cancelar cita",
    icon: CalendarX,
    description: "Se liberará el horario y el cliente recibirá un aviso de cancelación.",
    success: "Cita cancelada.",
  },
} as const;

type Action = keyof typeof actions;

function AgendaStatus({ status }: { status: string }) {
  const state = statuses[status];
  return <span className="agenda-status" data-tone={state?.tone}>{state?.label ?? "Estado sin clasificar"}</span>;
}

function AppointmentDialog({ appointment, barbers, timezone, onClose, onSaved }: {
  appointment: AgendaAppointment;
  barbers: AgendaBarber[];
  timezone: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const title = useRef<HTMLHeadingElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  const [action, setAction] = useState<Action | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const current = action ? actions[action] : null;
  const TitleIcon = current?.icon ?? CalendarClock;

  useEffect(() => {
    if (dialog.current && !dialog.current.open) dialog.current.showModal();
    title.current?.focus();
  }, [action]);

  function chooseAction(next: Action | null) {
    setAction(next);
    setError("");
  }

  function close() {
    dialog.current?.close();
    onClose();
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!action || pending) return;

    const data = new FormData(event.currentTarget);
    setPending(true);
    setError("");
    try {
      const supabase = createClient();
      const result = action === "propose"
        ? await supabase.rpc("admin_reassign_appointment", {
          target_appointment_id: appointment.id,
          target_barber_id: String(data.get("barber_id")),
          target_starts_at: zonedDateTimeToDate(`${data.get("date")}T${data.get("time")}`, timezone).toISOString(),
        })
        : await supabase.rpc("admin_set_appointment_status", {
          target_appointment_id: appointment.id,
          next_status: action,
          reason: null,
        });
      if (result.error) throw result.error;
      dispatchDashboardSuccess(actions[action].success);
      close();
      onSaved();
    } catch (reason) {
      setError(reportFormError(undefined, reason));
    } finally {
      setPending(false);
    }
  }

  return (
    <dialog
      className="agenda-dialog"
      ref={dialog}
      aria-labelledby={titleId}
      aria-describedby={current ? descriptionId : undefined}
      onCancel={event => {
        event.preventDefault();
        if (!pending) close();
      }}
      onClick={event => { if (!pending && event.target === event.currentTarget) close(); }}
    >
      <div className="agenda-dialog-inner">
        <header className="agenda-dialog-header">
          <span className="agenda-dialog-icon" data-danger={action === "canceled"}>
            <TitleIcon size={21} aria-hidden="true" />
          </span>
          <h2 id={titleId} tabIndex={-1} ref={title}>{current?.label ?? "Gestionar cita"}</h2>
          <button type="button" className="agenda-icon-button" aria-label="Cerrar ventana" disabled={pending} onClick={close}>
            <X size={19} aria-hidden="true" />
          </button>
        </header>
        <div className="agenda-dialog-summary">
          <div><strong>{appointment.clientName}</strong><span>{appointment.service} · {appointment.barberName}</span></div>
          <div><time dateTime={appointment.startsAt}>{appointment.timeLabel}</time><span>{appointment.dateLabel}</span></div>
        </div>
        {action && current ? (
          <form className="agenda-dialog-step" key={action} onSubmit={save} aria-busy={pending}>
            <p id={descriptionId}>{current.description}</p>
            {action === "propose" && (barbers.length ? (
              <fieldset className="agenda-fields" disabled={pending}>
                <label>Barbero
                  <select name="barber_id" required defaultValue={barbers.find(barber => barber.id === appointment.barberId)?.id ?? ""}>
                    <option value="" disabled>Elige un barbero</option>
                    {barbers.map(barber => <option value={barber.id} key={barber.id}>{barber.name}</option>)}
                  </select>
                </label>
                <label>Fecha<input name="date" type="date" required defaultValue={appointment.dateKey} /></label>
                <label>Hora local<input name="time" type="time" required defaultValue={appointment.timeLabel} /></label>
              </fieldset>
            ) : <p className="agenda-dialog-notice">No hay barberos activos disponibles para la propuesta.</p>)}
            {error && <p className="agenda-dialog-error" role="alert"><CircleAlert size={16} aria-hidden="true" />{error}</p>}
            <div className="agenda-dialog-footer">
              <button type="button" className="agenda-button" disabled={pending} onClick={() => chooseAction(null)}>
                <ArrowLeft size={16} aria-hidden="true" /> Atrás
              </button>
              <button type="submit" className="agenda-button agenda-button-primary" data-danger={action === "canceled"} disabled={pending || (action === "propose" && !barbers.length)}>
                {pending ? "Guardando…" : action === "propose" ? "Enviar propuesta" : current.label}
              </button>
            </div>
          </form>
        ) : (
          <div className="agenda-dialog-options">
            {(Object.entries(actions) as [Action, typeof actions[Action]][]).map(([key, item]) => (
              <button type="button" key={key} data-danger={key === "canceled"} onClick={() => chooseAction(key)}>
                <item.icon size={18} aria-hidden="true" /> {item.label} <ChevronRight size={17} aria-hidden="true" />
              </button>
            ))}
          </div>
        )}
      </div>
    </dialog>
  );
}

export function AdminAgenda({ appointments, barbers, timezone, loadError }: {
  appointments: AgendaAppointment[];
  barbers: AgendaBarber[];
  timezone: string;
  loadError: boolean;
}) {
  const router = useRouter();
  const [refreshing, startTransition] = useTransition();
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<AgendaAppointment | null>(null);
  const term = search.trim().toLocaleLowerCase("es-BO");
  const totals = { all: 0, pending: 0, confirmed: 0, reschedule: 0, history: 0 };
  const groups = new Map<string, AgendaAppointment[]>();
  let count = 0;

  for (const appointment of appointments) {
    const category = statuses[appointment.status]?.filter;
    totals.all += 1;
    if (category) totals[category] += 1;
    if (filter !== "all" && filter !== category) continue;
    if (term && ![appointment.clientName, appointment.barberName, appointment.service, appointment.phone].some(value => value?.toLocaleLowerCase("es-BO").includes(term))) continue;
    count += 1;
    const group = groups.get(appointment.dateKey);
    if (group) group.push(appointment);
    else groups.set(appointment.dateKey, [appointment]);
  }

  function refresh() {
    startTransition(() => router.refresh());
  }

  return (
    <div className="admin-agenda">
      <header className="agenda-heading">
        <h1>Agenda de citas</h1>
        <span className="agenda-local-time"><Clock3 size={15} aria-hidden="true" /> Hora de {timezone.replaceAll("_", " ").split("/").at(-1)}</span>
      </header>
      <section className="agenda-board" aria-label="Reservas">
        <div className="agenda-filters" role="group" aria-label="Filtrar por estado">
          {filters.map(([value, label]) => (
            <button type="button" key={value} aria-pressed={filter === value} onClick={() => setFilter(value)}>
              {label} <span>{totals[value]}</span>
            </button>
          ))}
        </div>
        <div className="agenda-toolbar">
          <label className="agenda-filter-select">
            Estado
            <select value={filter} onChange={event => setFilter(event.target.value as Filter)}>
              {filters.map(([value, label]) => <option key={value} value={value}>{label} ({totals[value]})</option>)}
            </select>
          </label>
          <label className="agenda-search">
            <Search size={17} aria-hidden="true" />
            <input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Buscar citas" aria-label="Buscar citas por cliente, barbero o servicio" />
          </label>
          {!loadError && <p className="agenda-result-count" role="status">{count} {count === 1 ? "cita" : "citas"}</p>}
        </div>
        {!loadError && count > 0 && <div className="agenda-columns" aria-hidden="true">
          <span>Hora</span><span>Cliente</span><span>Servicio / Barbero</span><span>Estado</span><span />
        </div>}
        <div className="agenda-results" key={filter} aria-busy={refreshing}>
          {loadError && <div className="agenda-empty" role="alert">
            <CircleAlert size={24} aria-hidden="true" /><h2>No pudimos cargar la agenda</h2>
            <button type="button" className="agenda-button" disabled={refreshing} onClick={refresh}>{refreshing ? "Cargando…" : "Volver a intentar"}</button>
          </div>}
          {!loadError && !count && <div className="agenda-empty">
            <CalendarDays size={26} aria-hidden="true" /><h2>{appointments.length ? "No encontramos citas" : "Todavía no hay reservas"}</h2>
            {appointments.length > 0 && <button type="button" className="agenda-button" onClick={() => { setSearch(""); setFilter("all"); }}>Limpiar filtros</button>}
          </div>}
          {!loadError && Array.from(groups, ([date, items]) => (
            <section className="agenda-day" key={date} aria-label={items[0].dateLabel}>
              <h2><time dateTime={date}>{items[0].dateLabel}</time></h2>
              <ul>
                {items.map(item => <li className="agenda-row" key={item.id}>
                  <time className="agenda-row-time" dateTime={item.startsAt}>{item.timeLabel}</time>
                  <div className="agenda-client">
                    <strong>{item.clientName}</strong>
                    {item.phone && <span>{item.phone}</span>}
                    {item.flagged && <span className="agenda-client-alert"><CircleAlert size={14} aria-hidden="true" /> Alerta por inasistencias</span>}
                  </div>
                  <div className="agenda-service">
                    <strong>{item.service}</strong>
                    <span>{item.barberName}</span>
                  </div>
                  <AgendaStatus status={item.status} />
                  <button type="button" className="agenda-button agenda-manage" aria-haspopup="dialog" aria-label={`Gestionar cita de ${item.clientName}`} disabled={refreshing} onClick={event => {
                    event.currentTarget.focus();
                    setSelected(item);
                  }}>
                    <span>Gestionar</span><ArrowRight size={16} aria-hidden="true" />
                  </button>
                </li>)}
              </ul>
            </section>
          ))}
        </div>
      </section>
      {selected && <AppointmentDialog
        appointment={selected}
        barbers={barbers}
        timezone={timezone}
        onClose={() => setSelected(null)}
        onSaved={refresh}
      />}
    </div>
  );
}
