import { DEFAULT_BUSINESS_TIMEZONE } from "@/lib/business-hours";

type ZonedParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

function safeTimezone(timezone: string) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone }).format();
    return timezone;
  } catch {
    return DEFAULT_BUSINESS_TIMEZONE;
  }
}

function partsInTimezone(value: Date, timezone: string): ZonedParts {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: safeTimezone(timezone),
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(value);
  const number = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value ?? 0);
  return {
    year: number("year"),
    month: number("month"),
    day: number("day"),
    hour: number("hour"),
    minute: number("minute"),
    second: number("second"),
  };
}

export function businessDateKey(value = new Date(), timezone = DEFAULT_BUSINESS_TIMEZONE) {
  const { year, month, day } = partsInTimezone(value, timezone);
  return [year, String(month).padStart(2, "0"), String(day).padStart(2, "0")].join("-");
}

export function zonedDateTimeToDate(localValue: string, timezone = DEFAULT_BUSINESS_TIMEZONE) {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(localValue);
  if (!match) throw new Error("La fecha y hora no tienen un formato válido.");
  const desired: ZonedParts = {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
    hour: Number(match[4]),
    minute: Number(match[5]),
    second: Number(match[6] ?? 0),
  };
  const desiredTimestamp = Date.UTC(desired.year, desired.month - 1, desired.day, desired.hour, desired.minute, desired.second);
  let timestamp = desiredTimestamp;

  // Dos iteraciones resuelven el desplazamiento IANA incluso al cruzar cambios
  // estacionales. La comprobacion final rechaza horas locales inexistentes.
  for (let iteration = 0; iteration < 2; iteration += 1) {
    const actual = partsInTimezone(new Date(timestamp), timezone);
    const actualTimestamp = Date.UTC(actual.year, actual.month - 1, actual.day, actual.hour, actual.minute, actual.second);
    timestamp += desiredTimestamp - actualTimestamp;
  }

  const result = new Date(timestamp);
  const confirmed = partsInTimezone(result, timezone);
  if (Object.keys(desired).some((key) => confirmed[key as keyof ZonedParts] !== desired[key as keyof ZonedParts])) {
    throw new Error("La hora seleccionada no existe en la zona horaria del negocio.");
  }
  return result;
}

export function businessDayRange(value = new Date(), timezone = DEFAULT_BUSINESS_TIMEZONE) {
  const date = businessDateKey(value, timezone);
  const [year, month, day] = date.split("-").map(Number);
  const nextDay = new Date(Date.UTC(year, month - 1, day + 1));
  const nextDate = [nextDay.getUTCFullYear(), String(nextDay.getUTCMonth() + 1).padStart(2, "0"), String(nextDay.getUTCDate()).padStart(2, "0")].join("-");
  return {
    date,
    start: zonedDateTimeToDate(`${date}T00:00:00`, timezone),
    end: zonedDateTimeToDate(`${nextDate}T00:00:00`, timezone),
  };
}
