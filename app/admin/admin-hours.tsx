"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition, type FormEvent } from "react";
import { Check, ChevronDown, CircleAlert, Clock3, Save } from "lucide-react";
import { BusinessStatus } from "@/components/business-status";
import { getBusinessHourError, prepareBusinessHourForSave, type BusinessHour, type EffectiveBusinessStatus } from "@/lib/business-hours";
import { dispatchDashboardSuccess, reportFormError } from "@/lib/form-feedback";
import { createClient } from "@/lib/supabase/client";
import "./admin-hours.css";

const dayNames = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const orderedDays = [1, 2, 3, 4, 5, 6, 0];
const noTime = "—";

type Day = BusinessHour;
type Validation = NonNullable<ReturnType<typeof getBusinessHourError>>;
type DayError = Validation & { weekday: number };
type Props = {
  hours: BusinessHour[];
  initialStatus: EffectiveBusinessStatus;
  configuredStatus: string;
  timezone: string;
  loadError: boolean;
};

function editableWeek(hours: BusinessHour[]): Day[] {
  return orderedDays.map(weekday => {
    const saved = hours.find(hour => hour.weekday === weekday);
    const row = prepareBusinessHourForSave(saved ?? {
      weekday, active: weekday !== 1, opens_at: "09:00", closes_at: "20:00",
      afternoon_opens_at: null, afternoon_closes_at: null,
    });
    return row;
  });
}

function sameDay(a: Day, b: Day) {
  return a.active === b.active && a.opens_at === b.opens_at && a.closes_at === b.closes_at;
}

function validateDay(day: Day): Validation | null {
  if (!day.active) return null;
  const error = getBusinessHourError(day);
  if (error) return error;
  return null;
}

function range(start: string | null, end: string | null) {
  return start && end ? `${start}–${end}` : null;
}

function DayRow({ day, open, saving, error, onToggle, onChange }: {
  day: Day;
  open: boolean;
  saving: boolean;
  error?: DayError;
  onToggle: () => void;
  onChange: (changes: Partial<Day>) => void;
}) {
  const label = dayNames[day.weekday];
  const detailsId = `hours-editor-${day.weekday}`;
  const errorId = `hours-error-${day.weekday}`;
  const morning = day.active ? range(day.opens_at, day.closes_at) : null;
  function timeField(field: Validation["field"], caption: string) {
    return <label className="hours-time-field">{caption}
      <input type="time" name={`${field}_${day.weekday}`}
        aria-label={`${label}, ${caption.toLowerCase()} de la jornada`}
        aria-invalid={error?.field === field || undefined}
        aria-describedby={error?.field === field ? errorId : undefined}
        value={day[field] ?? ""}
        required
        onChange={event => onChange({ [field]: event.target.value })}
      />
    </label>;
  }

  return <li className="hours-day" data-expanded={open}>
    <div className="hours-row hours-grid" data-active={day.active}>
      <div className="hours-day-name"><strong>{label}</strong><span data-active={day.active}>{day.active ? "Atención" : "Cerrado"}</span></div>
      <div className="hours-range hours-continuous"><small>Jornada</small>{morning ?? noTime}</div>
      <button className="hours-edit" type="button" aria-label={`${open ? "Cerrar edición del" : "Editar horario del"} ${label.toLowerCase()}`} aria-expanded={open} aria-controls={detailsId} onClick={onToggle}>
        {open ? "Cerrar" : "Editar"} <ChevronDown size={16} aria-hidden="true" />
      </button>
    </div>
    <div className="hours-disclosure" id={detailsId} data-open={open} inert={!open}>
      <div className="hours-disclosure-clip">
        <fieldset className="hours-day-fields" disabled={saving || !open}>
          <legend className="hours-sr-only">Horario del {label.toLowerCase()}</legend>
          <label className="hours-switch">
            <input type="checkbox" role="switch" checked={day.active} aria-label={`Abrir el ${label.toLowerCase()}`} onChange={event => onChange({ active: event.target.checked })} />
            <span className="hours-switch-track" aria-hidden="true" /> Atender este día
          </label>
          {day.active && <div className="hours-shifts">
            <div className="hours-shift" role="group" aria-label="Jornada de atención">
              <h2>Jornada continua</h2>
              <div className="hours-clock-fields">
                {timeField("opens_at", "Apertura")}
                {timeField("closes_at", "Cierre")}
              </div>
            </div>
          </div>}
          {error && <p id={errorId} className="hours-error" role="alert"><CircleAlert size={16} aria-hidden="true" />{error.message}</p>}
        </fieldset>
      </div>
    </div>
  </li>;
}

function HoursEditor({ hours, initialStatus, configuredStatus, timezone }: Omit<Props, "loadError">) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const pending = useRef(false);
  const [days, setDays] = useState(() => editableWeek(hours));
  const [openDay, setOpenDay] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [refreshing, startTransition] = useTransition();
  const [error, setError] = useState<DayError>();
  const [saveError, setSaveError] = useState("");
  const savedWeek = editableWeek(hours);
  const changedDays = days.filter((day, index) => !sameDay(day, savedWeek[index]) || !hours.some(saved => saved.weekday === day.weekday));

  useEffect(() => {
    if (!error) return;
    const input = formRef.current?.elements.namedItem(`${error.field}_${error.weekday}`);
    if (input instanceof HTMLInputElement) {
      input.focus({ preventScroll: true });
      input.closest(".hours-day")?.scrollIntoView({ block: "nearest" });
    }
  }, [error]);

  function updateDay(weekday: number, changes: Partial<Day>) {
    setDays(current => current.map(day => day.weekday === weekday ? { ...day, ...changes } : day));
    if (error?.weekday === weekday) setError(undefined);
    setSaveError("");
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending.current || refreshing || !changedDays.length) return;
    setSaveError("");
    const rows: BusinessHour[] = [];
    for (const day of changedDays) {
      const row = prepareBusinessHourForSave(day, hours.find(saved => saved.weekday === day.weekday));
      const invalid = validateDay(day) ?? getBusinessHourError(row);
      if (invalid) {
        setOpenDay(day.weekday);
        setError({ ...invalid, weekday: day.weekday });
        return;
      }
      rows.push(row);
    }
    pending.current = true;
    setError(undefined);
    setSaving(true);
    try {
      const updatedAt = new Date().toISOString();
      const { error: writeError } = await createClient().from("business_hours").upsert(
        rows.map(row => ({ ...row, updated_at: updatedAt })),
        { onConflict: "weekday" },
      );
      if (writeError) throw writeError;
      startTransition(() => router.refresh());
      dispatchDashboardSuccess("Horarios guardados.");
    } catch (cause) {
      setSaveError(reportFormError(undefined, cause));
    } finally {
      pending.current = false;
      setSaving(false);
    }
  }

  const busy = saving || refreshing;
  return <>
    <div className="hours-context">
      <BusinessStatus hours={hours} timezone={timezone} configuredStatus={configuredStatus} initialStatus={initialStatus} statusMessage="" variant="client" />
      <span><Clock3 size={15} aria-hidden="true" /> Hora de {timezone.replaceAll("_", " ").split("/").at(-1)}</span>
    </div>
    {(configuredStatus === "closed" || configuredStatus === "emergency_closed") && <p className="hours-note hours-override">El cierre configurado en <Link href="/admin/negocio">Negocio</Link> tiene prioridad sobre estos horarios.</p>}
    <form ref={formRef} className="hours-form" noValidate onSubmit={save} aria-busy={busy}>
      <div className="hours-columns hours-grid" aria-hidden="true"><span>Día</span><span>Jornada continua</span><span /></div>
      <ul className="hours-week" aria-label="Horario semanal">
        {days.map((day) => <DayRow key={day.weekday} day={day} open={openDay === day.weekday} saving={busy}
          error={error?.weekday === day.weekday ? error : undefined}
          onToggle={() => setOpenDay(current => current === day.weekday ? null : day.weekday)}
          onChange={changes => updateDay(day.weekday, changes)} />)}
      </ul>
      <footer className="hours-save" data-dirty={changedDays.length > 0}>
        {saveError && <p className="hours-error" role="alert"><CircleAlert size={16} aria-hidden="true" />{saveError}</p>}
        <span className="hours-save-status" role="status" data-dirty={changedDays.length > 0}>
          {changedDays.length ? "Cambios sin guardar" : <><Check size={16} aria-hidden="true" /> Horario publicado</>}
        </span>
        <button className="hours-button hours-primary" type="submit" disabled={busy || !changedDays.length}><Save size={16} aria-hidden="true" />{busy ? "Guardando…" : "Guardar horarios"}</button>
      </footer>
    </form>
  </>;
}

export function AdminHours({ loadError, ...props }: Props) {
  const router = useRouter();
  const [retrying, retry] = useTransition();

  return <div className="admin-hours">
    <header className="hours-heading"><h1>Horarios de atención</h1></header>
    {loadError ? <div className="hours-empty">
      <CircleAlert size={22} aria-hidden="true" />
      <h2 role="alert">No pudimos cargar los horarios</h2>
      <button className="hours-button" type="button" disabled={retrying} onClick={() => retry(() => router.refresh())}>
        {retrying ? "Cargando…" : "Volver a intentar"}
      </button>
    </div> : <HoursEditor key={JSON.stringify(props.hours)} {...props} />}
  </div>;
}
