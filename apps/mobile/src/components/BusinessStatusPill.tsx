import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { palette } from '@/components/ui';

export type BusinessHour = {
  weekday: number;
  opens_at: string;
  closes_at: string;
  afternoon_opens_at: string | null;
  afternoon_closes_at: string | null;
  active: boolean;
};

type BusinessStatus = 'open' | 'appointment_only' | 'closed' | 'emergency_closed' | 'schedule_closed';

function resolveStatus(configured: string, hours: BusinessHour[], timezone: string): BusinessStatus {
  if (configured === 'closed' || configured === 'emergency_closed') return configured;
  let parts: Intl.DateTimeFormatPart[];
  try {
    parts = new Intl.DateTimeFormat('en-US', {
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
      timeZone: timezone,
    }).formatToParts(new Date());
  } catch {
    parts = new Intl.DateTimeFormat('en-US', {
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
      timeZone: 'America/La_Paz',
    }).formatToParts(new Date());
  }
  const weekday = ({ Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 } as Record<string, number>)[parts.find((part) => part.type === 'weekday')?.value ?? ''];
  const hour = Number(parts.find((part) => part.type === 'hour')?.value ?? 0);
  const minute = Number(parts.find((part) => part.type === 'minute')?.value ?? 0);
  const current = hour * 60 + minute;
  const today = hours.find((item) => item.weekday === weekday && item.active);
  if (!today) return 'schedule_closed';
  const minutes = (value: string) => {
    const [h = '0', m = '0'] = value.split(':');
    return Number(h) * 60 + Number(m);
  };
  const openNow = current >= minutes(today.opens_at) && current < minutes(today.closes_at)
    || Boolean(today.afternoon_opens_at && today.afternoon_closes_at
      && current >= minutes(today.afternoon_opens_at) && current < minutes(today.afternoon_closes_at));
  if (!openNow) return 'schedule_closed';
  return configured === 'appointment_only' ? 'appointment_only' : 'open';
}

export function BusinessStatusPill({ configuredStatus, statusMessage, timezone, hours }: {
  configuredStatus: string;
  statusMessage: string;
  timezone: string;
  hours: BusinessHour[];
}) {
  const [status, setStatus] = useState<BusinessStatus>(() => resolveStatus(configuredStatus, hours, timezone));

  useEffect(() => {
    const update = () => setStatus(resolveStatus(configuredStatus, hours, timezone));
    update();
    const timer = setInterval(update, 30_000);
    return () => clearInterval(timer);
  }, [configuredStatus, hours, timezone]);

  const open = status === 'open' || status === 'appointment_only';
  const label = open
    ? status === 'appointment_only' ? 'Atención solo con reserva' : 'Abierto ahora'
    : status === 'emergency_closed' ? 'Cerrado por emergencia' : status === 'schedule_closed' ? 'Cerrado ahora' : 'Cerrado temporalmente';
  const detail = status === 'schedule_closed' ? 'Fuera del horario de atención' : statusMessage;

  return (
    <View style={[styles.pill, !open && styles.pillClosed]} accessibilityLabel={detail ? label + ': ' + detail : label} accessibilityRole="text">
      <View style={[styles.dot, !open && styles.dotClosed]} />
      <Text numberOfLines={1} style={[styles.label, !open && styles.labelClosed]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: { alignSelf: 'flex-start', minHeight: 31, maxWidth: '100%', flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 11, borderRadius: 99, borderWidth: 1, borderColor: '#48c29255', backgroundColor: '#13362c' },
  pillClosed: { borderColor: '#d9ad5d55', backgroundColor: '#34291f' },
  dot: { width: 7, height: 7, borderRadius: 99, backgroundColor: palette.green },
  dotClosed: { backgroundColor: palette.gold },
  label: { color: '#87e0bc', fontSize: 10, fontWeight: '800' },
  labelClosed: { color: '#e4c27e' },
});
