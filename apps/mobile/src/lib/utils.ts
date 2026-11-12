import { useCallback, useEffect, useRef, useState } from 'react';

export function useRemoteData<T>(loader: () => Promise<T>, watch: string) {
  const latestLoader = useRef(loader);
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState('');
  const [generation, setGeneration] = useState(0);
  const requestKey = JSON.stringify([watch, generation]);
  const [completedKey, setCompletedKey] = useState<string | null>(null);

  useEffect(() => { latestLoader.current = loader; }, [loader]);

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => {
      if (active) setError('');
      return latestLoader.current();
    }).then((result) => {
      if (active) setData(result);
    }).catch((reason: unknown) => {
      if (active) setError(reason instanceof Error ? reason.message : String(reason));
    }).finally(() => {
      if (active) setCompletedKey(requestKey);
    });
    return () => { active = false; };
  }, [requestKey]);

  const refresh = useCallback(() => setGeneration((value) => value + 1), []);
  return { data, loading: completedKey !== requestKey, error, refresh, generation };
}

export function requireData<T>(result: { data: T | null; error: { message: string } | null }): T {
  if (result.error) throw new Error(result.error.message);
  if (result.data === null) throw new Error('No se encontraron datos.');
  return result.data;
}

export function formatMoney(value: number | string | null | undefined) {
  const amount = Number(value ?? 0);
  return `Bs ${amount.toFixed(2)}`;
}

export function formatDate(value: string, options: Intl.DateTimeFormatOptions = {}) {
  const hasDateStyle = Object.prototype.hasOwnProperty.call(options, 'dateStyle');
  const hasTimeStyle = Object.prototype.hasOwnProperty.call(options, 'timeStyle');
  const defaults = hasDateStyle || hasTimeStyle ? {} : { dateStyle: 'medium' as const, timeStyle: 'short' as const };
  return new Intl.DateTimeFormat('es-BO', { ...defaults, ...options }).format(new Date(value));
}

export function publicMediaUrl(path: string | null | undefined) {
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;
  const base = process.env.EXPO_PUBLIC_SUPABASE_URL ?? 'https://ggiajbauxczmqkylvjow.supabase.co';
  return `${base}/storage/v1/object/public/public-media/${path.split('/').map(encodeURIComponent).join('/')}`;
}

export function errorMessage(reason: unknown) {
  return reason instanceof Error ? reason.message : String(reason);
}

export function businessDayStart(timezone: string, date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).formatToParts(date);
  const part = (type: string) => Number(parts.find((item) => item.type === type)?.value ?? 0);
  const localAsUtc = Date.UTC(part('year'), part('month') - 1, part('day'), part('hour'), part('minute'), part('second'));
  const offset = localAsUtc - Math.floor(date.getTime() / 1000) * 1000;
  return new Date(Date.UTC(part('year'), part('month') - 1, part('day')) - offset);
}

export function businessMonthStart(timezone: string, date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
  const year = Number(parts.find((part) => part.type === 'year')?.value ?? date.getUTCFullYear());
  const month = Number(parts.find((part) => part.type === 'month')?.value ?? date.getUTCMonth() + 1);
  const localNoon = new Date(Date.UTC(year, month - 1, 1, 12));
  const offsetParts = new Intl.DateTimeFormat('en-US', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).formatToParts(localNoon);
  const part = (type: string) => Number(offsetParts.find((item) => item.type === type)?.value ?? 0);
  const localAsUtc = Date.UTC(part('year'), part('month') - 1, part('day'), part('hour'), part('minute'), part('second'));
  const offset = localAsUtc - localNoon.getTime();
  return new Date(Date.UTC(year, month - 1, 1) - offset);
}
