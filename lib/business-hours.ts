export type BusinessHour = {
  weekday: number;
  opens_at: string;
  closes_at: string;
  afternoon_opens_at: string | null;
  afternoon_closes_at: string | null;
  active: boolean;
};

export const DEFAULT_BUSINESS_TIMEZONE = "America/La_Paz";
export type EffectiveBusinessStatus = "open" | "appointment_only" | "closed" | "emergency_closed" | "schedule_closed";

const dayNames = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const shortWeekdayToNumber: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

function minutesFromTime(value: string) {
  const [hours = "0", minutes = "0"] = value.split(":");
  return Number(hours) * 60 + Number(minutes);
}

function shortTime(value: string) {
  return value.slice(0, 5);
}

export function getBusinessHourError(day: BusinessHour): { field: "opens_at" | "closes_at" | "afternoon_opens_at" | "afternoon_closes_at"; message: string } | null {
  const validTime = (value: string | null): value is string => Boolean(value && /^(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(value));
  if (!validTime(day.opens_at)) return { field: "opens_at", message: "Completa la apertura del turno mañana." };
  if (!validTime(day.closes_at)) return { field: "closes_at", message: "Completa el cierre del turno mañana." };
  if (minutesFromTime(day.opens_at) >= minutesFromTime(day.closes_at)) {
    return { field: "closes_at", message: "El cierre de la mañana debe ser posterior a su apertura." };
  }
  if (!day.afternoon_opens_at && !day.afternoon_closes_at) return null;
  if (!validTime(day.afternoon_opens_at)) return { field: "afternoon_opens_at", message: "Completa la apertura del turno tarde o deja ambas horas de la tarde vacías." };
  if (!validTime(day.afternoon_closes_at)) return { field: "afternoon_closes_at", message: "Completa el cierre del turno tarde o deja ambas horas de la tarde vacías." };
  if (minutesFromTime(day.afternoon_opens_at) <= minutesFromTime(day.closes_at)) {
    return { field: "afternoon_opens_at", message: "La tarde debe comenzar después del cierre de la mañana para dejar un descanso." };
  }
  if (minutesFromTime(day.afternoon_closes_at) <= minutesFromTime(day.afternoon_opens_at)) {
    return { field: "afternoon_closes_at", message: "El cierre de la tarde debe ser posterior a su apertura." };
  }
  return null;
}

export function prepareBusinessHourForSave(day: BusinessHour, saved?: BusinessHour): BusinessHour {
  // Un borrador incompleto de un día cerrado no debe impedir guardar los demás días.
  const source = !day.active && getBusinessHourError(day)
    ? saved && !getBusinessHourError(saved)
      ? saved
      : { opens_at: "09:00", closes_at: "20:00", afternoon_opens_at: null, afternoon_closes_at: null }
    : day;
  return {
    weekday: day.weekday,
    active: day.active,
    opens_at: shortTime(source.opens_at),
    closes_at: shortTime(source.closes_at),
    afternoon_opens_at: source.afternoon_opens_at ? shortTime(source.afternoon_opens_at) : null,
    afternoon_closes_at: source.afternoon_closes_at ? shortTime(source.afternoon_closes_at) : null,
  };
}

function windowsForDay(day: BusinessHour) {
  const windows = [{ opens_at: day.opens_at, closes_at: day.closes_at }];
  if (day.afternoon_opens_at && day.afternoon_closes_at) {
    windows.push({ opens_at: day.afternoon_opens_at, closes_at: day.afternoon_closes_at });
  }
  return windows;
}

export function isBusinessOpenNow(
  hours: BusinessHour[],
  timezone = DEFAULT_BUSINESS_TIMEZONE,
  now = new Date(),
) {
  if (!hours.length) return false;

  const options: Intl.DateTimeFormatOptions = {
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  };
  let parts: Intl.DateTimeFormatPart[];
  try {
    parts = new Intl.DateTimeFormat("en-US", { ...options, timeZone: timezone }).formatToParts(now);
  } catch {
    parts = new Intl.DateTimeFormat("en-US", { ...options, timeZone: DEFAULT_BUSINESS_TIMEZONE }).formatToParts(now);
  }
  const weekday = shortWeekdayToNumber[parts.find((part) => part.type === "weekday")?.value ?? ""];
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? 0);
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? 0);
  const today = hours.find((item) => item.weekday === weekday && item.active);
  if (!today) return false;

  const currentMinutes = hour * 60 + minute;
  return windowsForDay(today).some((window) =>
    currentMinutes >= minutesFromTime(window.opens_at) && currentMinutes < minutesFromTime(window.closes_at),
  );
}

export function resolveBusinessStatus(
  configuredStatus: string,
  hours: BusinessHour[],
  timezone = DEFAULT_BUSINESS_TIMEZONE,
  now = new Date(),
): EffectiveBusinessStatus {
  if (configuredStatus === "closed" || configuredStatus === "emergency_closed") return configuredStatus;
  const scheduledStatus = configuredStatus === "appointment_only" ? "appointment_only" : "open";
  return isBusinessOpenNow(hours, timezone, now) ? scheduledStatus : "schedule_closed";
}

export function formatBusinessHours(hours: BusinessHour[]) {
  const orderedDays = [1, 2, 3, 4, 5, 6, 0];
  const active = orderedDays
    .map((weekday) => hours.find((item) => item.weekday === weekday && item.active))
    .filter((item): item is BusinessHour => Boolean(item));

  if (!active.length) return "Cerrado todos los días";

  const groups: BusinessHour[][] = [];
  active.forEach((item) => {
    const current = groups.at(-1);
    const previousDay = current?.at(-1)?.weekday;
    const isConsecutive = previousDay !== undefined
      && orderedDays.indexOf(item.weekday) === orderedDays.indexOf(previousDay) + 1;
    const sameHours = current?.[0]?.opens_at === item.opens_at
      && current?.[0]?.closes_at === item.closes_at
      && current?.[0]?.afternoon_opens_at === item.afternoon_opens_at
      && current?.[0]?.afternoon_closes_at === item.afternoon_closes_at;
    if (current && isConsecutive && sameHours) current.push(item);
    else groups.push([item]);
  });

  return groups.map((group) => {
    const first = dayNames[group[0].weekday];
    const last = dayNames[group[group.length - 1].weekday];
    const days = group.length === 1 ? first : group.length === 2 ? `${first} y ${last}` : `${first} a ${last}`;
    const day = group[0];
    const morning = `${shortTime(day.opens_at)}–${shortTime(day.closes_at)}`;
    const afternoon = day.afternoon_opens_at && day.afternoon_closes_at
      ? ` y ${shortTime(day.afternoon_opens_at)}–${shortTime(day.afternoon_closes_at)} (descanso: ${shortTime(day.closes_at)}–${shortTime(day.afternoon_opens_at)})`
      : "";
    return `${days[0].toUpperCase()}${days.slice(1)} · ${morning}${afternoon}`;
  }).join("; ");
}
