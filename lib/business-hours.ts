export type BusinessHour = {
  weekday: number;
  opens_at: string;
  closes_at: string;
  active: boolean;
};

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

export function isBusinessOpenNow(
  hours: BusinessHour[],
  timezone = "America/La_Paz",
  now = new Date(),
) {
  if (!hours.length) return true;

  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const weekday = shortWeekdayToNumber[parts.find((part) => part.type === "weekday")?.value ?? ""];
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? 0);
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? 0);
  const today = hours.find((item) => item.weekday === weekday && item.active);
  if (!today) return false;

  const currentMinutes = hour * 60 + minute;
  return currentMinutes >= minutesFromTime(today.opens_at) && currentMinutes < minutesFromTime(today.closes_at);
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
    const sameHours = current?.[0]?.opens_at === item.opens_at && current?.[0]?.closes_at === item.closes_at;
    if (current && isConsecutive && sameHours) current.push(item);
    else groups.push([item]);
  });

  return groups.map((group) => {
    const first = dayNames[group[0].weekday];
    const last = dayNames[group[group.length - 1].weekday];
    const days = group.length === 1 ? first : group.length === 2 ? `${first} y ${last}` : `${first} a ${last}`;
    return `${days[0].toUpperCase()}${days.slice(1)} · ${shortTime(group[0].opens_at)}–${shortTime(group[0].closes_at)}`;
  }).join("; ");
}
