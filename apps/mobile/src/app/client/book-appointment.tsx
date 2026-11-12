import { useEffect, useMemo, useRef, useState } from 'react';
import { router } from 'expo-router';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { CalendarCheck, CalendarDays, Check, ChevronLeft, Clock3, Mail, Scissors, ShieldCheck, Sun, Sunset, UserRound } from 'lucide-react-native';

import { AppShell } from '@/components/AppShell';
import { ActionButton, Card, CardTitle, EmptyState, InlineMessage, PageHeading, TextField, palette } from '@/components/ui';
import { clientTabs } from '@/lib/navigation';
import { businessDateKey, zonedDateTimeToDate } from '@/lib/business-time';
import { useSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';
import { publicMediaUrl, requireData, useRemoteData } from '@/lib/utils';

type Service = { slug: string; name: string; description: string | null; category: string | null; price: number; duration_minutes: number };
type Barber = { slug: string; display_name: string; bio: string | null; photo_path: string | null; specialties: string[] | null };
type BusinessHour = { weekday: number; opens_at: string; closes_at: string; afternoon_opens_at: string | null; afternoon_closes_at: string | null; active: boolean };
type BookingDay = { id: string; label: string; number: string; month: string; weekday: number };
type BookingData = { services: Service[]; barbers: Barber[]; timezone: string; businessStatus: string; hours: BusinessHour[]; reservedDayKeys: string[]; phone: string };

function datesFor(timezone: string): BookingDay[] {
  const [year, month, day] = businessDateKey(new Date(), timezone).split('-').map(Number);
  const weekdayFormatter = new Intl.DateTimeFormat('es-BO', { weekday: 'short', timeZone: 'UTC' });
  const monthFormatter = new Intl.DateTimeFormat('es-BO', { month: 'short', timeZone: 'UTC' });
  return Array.from({ length: 14 }, (_, index) => {
    const date = new Date(Date.UTC(year, month - 1, day + index, 12));
    const id = [date.getUTCFullYear(), String(date.getUTCMonth() + 1).padStart(2, '0'), String(date.getUTCDate()).padStart(2, '0')].join('-');
    return {
      id,
      label: index === 0 ? 'Hoy' : index === 1 ? 'Mañana' : weekdayFormatter.format(date).replace('.', ''),
      number: String(date.getUTCDate()),
      month: monthFormatter.format(date).replace('.', ''),
      weekday: date.getUTCDay(),
    };
  });
}

function formatSlot(value: string, timezone: string) {
  return new Intl.DateTimeFormat('es-BO', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: timezone }).format(new Date(value));
}

function displayDate(day: BookingDay | undefined) {
  return day ? day.label + ' ' + day.number + ' ' + day.month : 'Horario seleccionado';
}

export default function ClientBookingScreen() {
  const { session } = useSession();
  const userId = session?.user.id ?? '';
  const [step, setStep] = useState(1);
  const [serviceSlug, setServiceSlug] = useState('');
  const [barberSlug, setBarberSlug] = useState('any');
  const [dayKey, setDayKey] = useState('');
  const [selectedTime, setSelectedTime] = useState('');
  const [phone, setPhone] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [availableTimes, setAvailableTimes] = useState<string[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [availabilityVersion, setAvailabilityVersion] = useState(0);
  const [bookingError, setBookingError] = useState('');
  const [bookingLoading, setBookingLoading] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState('');
  const [authEmail, setAuthEmail] = useState('');
  const [authCode, setAuthCode] = useState('');
  const [authCodeSent, setAuthCodeSent] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const selectedTimeRef = useRef('');
  const phonePrefilled = useRef(false);

  const query = useRemoteData<BookingData>(async () => {
    const settingsResult = await supabase.from('business_settings').select('timezone,business_status').eq('id', true).maybeSingle();
    const servicesResult = await supabase.from('services').select('slug,name,description,category,price,duration_minutes').eq('status', 'active').order('price');
    const barbersResult = await supabase.from('barber_profiles').select('slug,display_name,bio,photo_path,specialties').eq('active', true).order('display_name');
    if (settingsResult.error) throw new Error(settingsResult.error.message);
    const services = requireData(servicesResult) as Service[];
    const barbers = requireData(barbersResult) as Barber[];
    const settings = settingsResult.data;
    const timezone = settings?.timezone ?? 'America/La_Paz';
    const days = datesFor(timezone);
    const afterLastDay = new Date(days[days.length - 1].id + 'T00:00:00.000Z');
    afterLastDay.setUTCDate(afterLastDay.getUTCDate() + 1);
    const rangeStart = zonedDateTimeToDate(days[0].id + 'T00:00:00', timezone).toISOString();
    const rangeEnd = zonedDateTimeToDate(afterLastDay.toISOString().slice(0, 10) + 'T00:00:00', timezone).toISOString();
    const [hoursResult, appointmentsResult, profileResult] = await Promise.all([
      supabase.from('business_hours').select('weekday,opens_at,closes_at,afternoon_opens_at,afternoon_closes_at,active').order('weekday'),
      userId ? supabase.from('appointments').select('starts_at').eq('client_id', userId).neq('status', 'canceled').gte('starts_at', rangeStart).lt('starts_at', rangeEnd) : Promise.resolve({ data: [], error: null }),
      userId ? supabase.from('profiles').select('phone').eq('id', userId).maybeSingle() : Promise.resolve({ data: null, error: null }),
    ]);
    const hours = requireData(hoursResult) as BusinessHour[];
    const appointments = requireData(appointmentsResult) as Array<{ starts_at: string }>;
    if (profileResult.error) throw new Error(profileResult.error.message);
    return {
      services,
      barbers,
      timezone,
      businessStatus: settings?.business_status ?? 'open',
      hours,
      reservedDayKeys: [...new Set(appointments.map((item) => businessDateKey(new Date(item.starts_at), timezone)))],
      phone: profileResult.data?.phone ?? '',
    };
  }, userId);

  const data = query.data;
  const days = useMemo(() => datesFor(data?.timezone ?? 'America/La_Paz'), [data?.timezone]);
  const selectedService = data?.services.find((item) => item.slug === serviceSlug);
  const selectedBarber = data?.barbers.find((item) => item.slug === barberSlug);
  const selectedDay = days.find((item) => item.id === dayKey);
  const selectedHours = data?.hours.find((item) => item.weekday === selectedDay?.weekday);
  const bookingClosed = data?.businessStatus === 'closed' || data?.businessStatus === 'emergency_closed';
  const hasAfternoon = Boolean(selectedHours?.afternoon_opens_at && selectedHours.afternoon_closes_at);
  const morningTimes = hasAfternoon ? availableTimes.filter((item) => item < (selectedHours?.afternoon_opens_at ?? '')) : availableTimes;
  const afternoonTimes = hasAfternoon ? availableTimes.filter((item) => item >= (selectedHours?.afternoon_opens_at ?? '')) : [];

  useEffect(() => { selectedTimeRef.current = selectedTime; }, [selectedTime]);

  useEffect(() => {
    if (data && userId && !query.loading && !phonePrefilled.current) {
      setPhone(data.phone);
      phonePrefilled.current = true;
    }
  }, [data, query.loading, userId]);

  useEffect(() => {
    if (!data || !dayKey || !serviceSlug) return;
    const reserved = data.reservedDayKeys.includes(dayKey);
    const unavailable = reserved || bookingClosed || !selectedHours?.active;
    if (unavailable) {
      let active = true;
      void Promise.resolve().then(() => {
        if (!active) return;
        setAvailableTimes([]);
        setSelectedTime('');
        setSlotsLoading(false);
        setBookingError(reserved ? 'Ya tienes una cita para esta fecha. Solo puedes reservar una por día.' : '');
      });
      return () => { active = false; };
    }
    if (!selectedHours?.active) {
      return;
    }
    let active = true;
    const timezone = data.timezone;
    async function loadAvailability() {
      setSlotsLoading(true);
      setBookingError('');
      const { data: result, error } = await supabase.rpc('get_available_slots', {
        p_service_slug: serviceSlug,
        p_barber_slug: barberSlug || 'any',
        p_date: dayKey,
      });
      if (!active) return;
      if (error) {
        setAvailableTimes([]);
        setBookingError('No se pudo consultar la agenda. Intenta de nuevo en unos minutos.');
      } else {
        const times = [...new Set(((result ?? []) as Array<{ starts_at: string }>).map((slot) => formatSlot(slot.starts_at, timezone)))];
        setAvailableTimes(times);
        if (selectedTimeRef.current && !times.includes(selectedTimeRef.current)) {
          setSelectedTime('');
          setBookingError('Ese horario ya no está disponible. Elige otro para continuar.');
          setStep(3);
        }
      }
      setSlotsLoading(false);
    }
    void loadAvailability();
    return () => { active = false; };
  }, [availabilityVersion, barberSlug, bookingClosed, data, dayKey, selectedHours?.active, serviceSlug]);

  function selectService(slug: string) {
    setServiceSlug(slug);
    setDayKey('');
    setSelectedTime('');
    setAvailableTimes([]);
    setBookingError('');
    setStep(2);
  }

  function selectBarber(slug: string) {
    setBarberSlug(slug);
    setDayKey('');
    setSelectedTime('');
    setAvailableTimes([]);
    setBookingError('');
  }

  async function confirmBooking() {
    if (!data || !selectedService || !dayKey || !selectedTime) {
      setBookingError('Vuelve a elegir un horario disponible para continuar.');
      setStep(3);
      return;
    }
    if (phone.trim().length < 7 || !acceptedTerms) return;
    setBookingLoading(true);
    setBookingError('');
    let startsAt: string;
    try {
      startsAt = zonedDateTimeToDate(dayKey + 'T' + selectedTime + ':00', data.timezone).toISOString();
    } catch (reason) {
      setBookingError(reason instanceof Error ? reason.message : 'Revisa la fecha y hora seleccionadas.');
      setBookingLoading(false);
      return;
    }
    const { error } = await supabase.rpc('create_appointment', {
      p_service_slug: selectedService.slug,
      p_barber_slug: barberSlug || 'any',
      p_starts_at: startsAt,
      p_phone: phone,
    });
    if (error) {
      setBookingError(error.message || 'No pudimos guardar la cita. Revisa el horario e inténtalo nuevamente.');
      if (/horario|disponible|reservas/i.test(error.message)) {
        setSelectedTime('');
        setStep(3);
        setAvailabilityVersion((value) => value + 1);
      }
      setBookingLoading(false);
      return;
    }
    setConfirmed(true);
    setBookingLoading(false);
    query.refresh();
  }

  async function signInToReserve() {
    setAuthLoading(true);
    setAuthError('');
    try {
      if (!authCodeSent) {
        const normalized = authEmail.trim().toLowerCase();
        if (!normalized) { setAuthError('Escribe tu correo electrónico.'); return; }
        const { error } = await supabase.auth.signInWithOtp({ email: normalized, options: { shouldCreateUser: true } });
        if (error) throw error;
        setAuthEmail(normalized); setAuthCodeSent(true);
      } else {
        const { error } = await supabase.auth.verifyOtp({ email: authEmail.trim().toLowerCase(), token: authCode.trim(), type: 'email' });
        if (error) throw error;
      }
    } catch (reason) {
      setAuthError(reason instanceof Error ? reason.message : 'No se pudo validar el código.');
    } finally {
      setAuthLoading(false);
    }
  }

  const onBack = () => {
    if (step === 1) router.replace(userId ? '/client' : '/sign-in');
    else setStep((value) => Math.max(1, value - 1));
  };

  return (
    <AppShell title="Reservar cita" roleLabel="RESERVAS" tabs={userId ? clientTabs : []} backHref={userId ? '/client' : '/sign-in'} showChat={Boolean(userId)}>
      {confirmed && selectedService ? (
        <>
          <PageHeading eyebrow="Reserva registrada" title="¡Nos vemos pronto!" description="Tu cita quedó registrada. Puedes consultarla o cancelarla desde tu cuenta." />
          <Card>
            <CardTitle icon={CalendarCheck} title="Reserva confirmada" subtitle="No necesitas pagar en línea." />
            <SummaryRow label="Servicio" value={selectedService.name} />
            <SummaryRow label="Peluquero" value={selectedBarber?.display_name ?? 'Primero disponible'} />
            <SummaryRow label="Fecha y hora" value={displayDate(selectedDay) + ' · ' + selectedTime} />
            <SummaryRow label="Precio" value={'Bs ' + Number(selectedService.price).toFixed(2)} />
            <ActionButton label="Ver mi cuenta" icon={CalendarDays} onPress={() => router.replace('/client')} />
          </Card>
        </>
      ) : (
        <>
          <PageHeading eyebrow="Reserva en línea" title="Tu próxima visita" description="Elige el servicio, profesional y horario que mejor te convengan." />
          <View style={styles.steps}>
            {['Servicio', 'Profesional', 'Fecha y hora', 'Tus datos'].map((label, index) => (
              <View key={label} style={[styles.stepPill, step === index + 1 && styles.stepPillActive, step > index + 1 && styles.stepPillDone]}>
                <Text style={[styles.stepNumber, (step === index + 1 || step > index + 1) && styles.stepNumberActive]}>{step > index + 1 ? '✓' : String(index + 1)}</Text>
                <Text numberOfLines={1} style={[styles.stepLabel, step === index + 1 && styles.stepLabelActive]}>{label}</Text>
              </View>
            ))}
          </View>
          {query.error ? <InlineMessage>{query.error}</InlineMessage> : null}
          {query.loading && !data ? <Card><EmptyState title="Cargando horarios y servicios…" description="Estamos consultando la agenda del local." /></Card> : null}
          {!query.loading && data && step === 1 ? (
            <Card>
              <CardTitle icon={Scissors} title="Elige un servicio" subtitle="Se mostrarán horarios con tiempo suficiente para atenderte." />
              {data.services.length ? data.services.map((service) => (
                <Pressable key={service.slug} onPress={() => selectService(service.slug)} style={styles.choiceCard}>
                  <View style={styles.choiceCopy}>
                    <Text style={styles.choiceEyebrow}>{service.category || 'Servicio'}</Text>
                    <Text style={styles.choiceTitle}>{service.name}</Text>
                    <Text style={styles.muted}>{service.description || 'Servicio profesional personalizado.'}</Text>
                  </View>
                  <View style={styles.choiceMeta}><Text style={styles.price}>Bs {Number(service.price).toFixed(2)}</Text><Text style={styles.muted}>{service.duration_minutes} min</Text></View>
                </Pressable>
              )) : <EmptyState title="No hay servicios disponibles" description="Consulta el sitio público o intenta nuevamente más tarde." />}
            </Card>
          ) : null}
          {!query.loading && data && step === 2 ? (
            <Card>
              <CardTitle icon={UserRound} title="Elige profesional" subtitle="También puedes elegir el primer horario disponible." />
              <ChoiceRow title="Primero disponible" detail="Más opciones de horario" selected={barberSlug === 'any'} onPress={() => selectBarber('any')} />
              {data.barbers.map((barber) => (
                <Pressable key={barber.slug} onPress={() => selectBarber(barber.slug)} style={[styles.barberChoice, barberSlug === barber.slug && styles.choiceSelected]}>
                  {publicMediaUrl(barber.photo_path) ? <Image source={{ uri: publicMediaUrl(barber.photo_path)! }} alt={barber.display_name} style={styles.barberImage} /> : <View style={styles.barberPlaceholder}><Scissors size={18} color={palette.gold} /></View>}
                  <View style={styles.choiceCopy}><Text style={styles.choiceTitle}>{barber.display_name}</Text><Text style={styles.muted}>{(barber.specialties ?? []).join(', ') || barber.bio || 'Barbero LEGEND CLUB'}</Text></View>
                  {barberSlug === barber.slug ? <Check size={18} color={palette.gold} /> : null}
                </Pressable>
              ))}
              <ActionButton label="Ver horarios" icon={CalendarDays} onPress={() => { setBookingError(''); setStep(3); }} />
            </Card>
          ) : null}
          {!query.loading && data && step === 3 ? (
            <Card>
              <CardTitle icon={Clock3} title="Fecha y hora" subtitle="Solo puedes reservar una cita por día." />
              <View style={styles.selectionSummary}><Scissors size={15} color={palette.gold} /><Text style={styles.selectionText}>{selectedService?.name || 'Servicio'}</Text><Text style={styles.muted}>{selectedService?.duration_minutes || 0} min</Text><Text style={styles.muted}>{selectedBarber?.display_name || 'Primero disponible'}</Text></View>
              <Text style={styles.sectionLabel}>Próximos días · hora local ({data.timezone.split('/').at(-1)?.replaceAll('_', ' ') ?? data.timezone})</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dateStrip}>
                {days.map((item) => {
                  const reserved = data.reservedDayKeys.includes(item.id);
                  const selected = dayKey === item.id;
                  return (
                    <Pressable key={item.id} disabled={reserved} onPress={() => { setDayKey(item.id); setSelectedTime(''); setAvailableTimes([]); setBookingError(''); }} style={[styles.dateChoice, selected && styles.dateSelected, reserved && styles.dateReserved]}>
                      <Text style={[styles.dateMeta, selected && styles.dateTextSelected]}>{reserved ? 'Con cita' : item.label}</Text>
                      <Text style={[styles.dateNumber, selected && styles.dateTextSelected]}>{item.number}</Text>
                      <Text style={[styles.dateMeta, selected && styles.dateTextSelected]}>{item.month}</Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
              {dayKey && bookingClosed ? <EmptyState title="Reservas pausadas" description="El negocio cerró las reservas manualmente. Intenta más tarde." /> : null}
              {dayKey && !bookingClosed && !selectedHours?.active ? <EmptyState title="El local está cerrado este día" description="Prueba otra fecha para consultar horarios." /> : null}
              {dayKey && selectedHours?.active ? (
                <>
                  <View style={styles.hoursCard}>
                    <Text style={styles.sectionLabel}>Horario del local · {displayDate(selectedDay)}</Text>
                    <View style={styles.hoursRow}><Sun size={15} color={palette.gold} /><Text style={styles.muted}>Mañana</Text><Text style={styles.hourValue}>{selectedHours.opens_at.slice(0, 5)}–{selectedHours.closes_at.slice(0, 5)}</Text></View>
                    {hasAfternoon ? <View style={styles.hoursRow}><Sunset size={15} color={palette.gold} /><Text style={styles.muted}>Tarde</Text><Text style={styles.hourValue}>{selectedHours.afternoon_opens_at?.slice(0, 5)}–{selectedHours.afternoon_closes_at?.slice(0, 5)}</Text></View> : null}
                    {hasAfternoon ? <Text style={styles.muted}>Pausa del local: {selectedHours.closes_at.slice(0, 5)}–{selectedHours.afternoon_opens_at?.slice(0, 5)}.</Text> : null}
                  </View>
                  {slotsLoading ? <EmptyState title="Consultando espacios disponibles…" /> : availableTimes.length ? (
                    <>
                      <TimeOptions title={hasAfternoon ? 'Turno mañana' : 'Horarios disponibles'} times={morningTimes} selected={selectedTime} onSelect={(value) => { setSelectedTime(value); setBookingError(''); }} />
                      {hasAfternoon ? <TimeOptions title="Turno tarde" times={afternoonTimes} selected={selectedTime} onSelect={(value) => { setSelectedTime(value); setBookingError(''); }} /> : null}
                    </>
                  ) : <EmptyState title="No hay espacios para esta fecha" description="El horario de los profesionales y las citas existentes limitan la disponibilidad." />}
                </>
              ) : null}
              {bookingError ? <InlineMessage>{bookingError}</InlineMessage> : null}
              <View style={styles.buttonRow}>
                <ActionButton label="Atrás" icon={ChevronLeft} tone="secondary" onPress={onBack} />
                <ActionButton label="Continuar" icon={Check} disabled={!dayKey || !selectedTime || slotsLoading} onPress={() => setStep(4)} />
              </View>
            </Card>
          ) : null}
          {!query.loading && data && step === 4 && selectedService ? (
            <Card>
              <CardTitle icon={ShieldCheck} title="Confirma tu cita" subtitle="No necesitas pagar en línea." />
              <SummaryRow label="Servicio" value={selectedService.name} />
              <SummaryRow label="Profesional" value={selectedBarber?.display_name ?? 'Primero disponible'} />
              <SummaryRow label="Horario" value={displayDate(selectedDay) + ' · ' + selectedTime} />
              <SummaryRow label="Precio" value={'Bs ' + Number(selectedService.price).toFixed(2)} />
              {!session ? (
                <View style={styles.loginBox}>
                  <Text style={styles.sectionLabel}>Inicia sesión para reservar</Text>
                  {!authCodeSent ? <TextField label="Correo electrónico" value={authEmail} onChangeText={setAuthEmail} placeholder="tu@correo.com" keyboardType="email-address" autoCapitalize="none" autoComplete="email" /> : <TextField label={`Código enviado a ${authEmail}`} value={authCode} onChangeText={(value) => setAuthCode(value.replace(/\D/g, '').slice(0, 8))} placeholder="000000" keyboardType="number-pad" autoComplete="one-time-code" />}
                  <ActionButton label={authCodeSent ? 'Verificar código' : 'Enviar código'} icon={Mail} loading={authLoading} onPress={() => void signInToReserve()} />
                  {authError ? <InlineMessage>{authError}</InlineMessage> : null}
                </View>
              ) : (
                <>
                  <Text style={styles.accountName}>{session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || 'Cliente'}</Text>
                  <Text style={styles.muted}>{session.user.email}</Text>
                  <TextField label="Teléfono de contacto" value={phone} onChangeText={setPhone} placeholder="Ej. 720 12345" keyboardType="phone-pad" maxLength={20} />
                  <Pressable style={styles.termsRow} onPress={() => setAcceptedTerms((value) => !value)} accessibilityRole="checkbox" accessibilityState={{ checked: acceptedTerms }}>
                    <View style={[styles.checkbox, acceptedTerms && styles.checkboxSelected]}>{acceptedTerms ? <Check size={14} color="#20180f" /> : null}</View>
                    <Text style={styles.muted}>Acepto las condiciones de reserva y cancelación.</Text>
                  </Pressable>
                  {bookingError ? <InlineMessage>{bookingError}</InlineMessage> : null}
                  <View style={styles.buttonRow}>
                    <ActionButton label="Atrás" icon={ChevronLeft} tone="secondary" onPress={onBack} />
                    <ActionButton label={bookingLoading ? 'Confirmando…' : 'Confirmar reserva'} icon={CalendarCheck} disabled={phone.trim().length < 7 || !acceptedTerms} loading={bookingLoading} onPress={() => void confirmBooking()} />
                  </View>
                </>
              )}
            </Card>
          ) : null}
          {step > 1 && step !== 3 && step !== 4 ? <ActionButton label="Atrás" icon={ChevronLeft} tone="secondary" onPress={onBack} /> : null}
          {step > 1 && step !== 3 && step !== 4 && step === 2 ? <InlineMessage tone="info">Los horarios disponibles dependen del servicio seleccionado.</InlineMessage> : null}
          {step === 4 && !selectedService ? <InlineMessage>Vuelve a elegir un servicio para reservar.</InlineMessage> : null}
        </>
      )}
    </AppShell>
  );
}

function ChoiceRow({ title, detail, selected, onPress }: { title: string; detail: string; selected: boolean; onPress: () => void }) {
  return <Pressable onPress={onPress} style={[styles.barberChoice, selected && styles.choiceSelected]}><View style={styles.barberPlaceholder}><Scissors size={18} color={palette.gold} /></View><View style={styles.choiceCopy}><Text style={styles.choiceTitle}>{title}</Text><Text style={styles.muted}>{detail}</Text></View>{selected ? <Check size={18} color={palette.gold} /> : null}</Pressable>;
}

function TimeOptions({ title, times, selected, onSelect }: { title: string; times: string[]; selected: string; onSelect: (value: string) => void }) {
  if (!times.length) return null;
  return <View style={styles.timeSection}><Text style={styles.sectionLabel}>{title}</Text><View style={styles.timeGrid}>{times.map((time) => <Pressable key={time} onPress={() => onSelect(time)} style={[styles.timeButton, selected === time && styles.timeSelected]}><Text style={[styles.timeText, selected === time && styles.timeTextSelected]}>{time}</Text></Pressable>)}</View></View>;
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return <View style={styles.summaryRow}><Text style={styles.muted}>{label}</Text><Text style={styles.summaryValue}>{value}</Text></View>;
}

const styles = StyleSheet.create({
  steps: { flexDirection: 'row', gap: 5, marginBottom: 2 },
  stepPill: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, backgroundColor: palette.surface, borderColor: palette.border, borderWidth: 1, borderRadius: 11, paddingVertical: 9, paddingHorizontal: 4 },
  stepPillActive: { borderColor: palette.gold, backgroundColor: '#34291f' },
  stepPillDone: { borderColor: '#6c5836' },
  stepNumber: { color: palette.muted, fontSize: 10, fontWeight: '800' },
  stepNumberActive: { color: palette.gold },
  stepLabel: { color: palette.muted, fontSize: 9, fontWeight: '700' },
  stepLabelActive: { color: palette.text },
  choiceCard: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 13, borderColor: palette.border, borderWidth: 1, backgroundColor: '#1a1613' },
  choiceCopy: { flex: 1, gap: 4 },
  choiceEyebrow: { color: palette.gold, fontSize: 9, fontWeight: '800', letterSpacing: 1 },
  choiceTitle: { color: palette.text, fontSize: 14, fontWeight: '800' },
  muted: { color: palette.muted, fontSize: 11, lineHeight: 16 },
  choiceMeta: { alignItems: 'flex-end', gap: 5 },
  price: { color: palette.gold, fontSize: 13, fontWeight: '800' },
  barberChoice: { minHeight: 67, flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderRadius: 13, borderColor: palette.border, borderWidth: 1, backgroundColor: '#1a1613' },
  choiceSelected: { borderColor: palette.gold, backgroundColor: '#30271f' },
  barberImage: { width: 43, height: 43, borderRadius: 12, backgroundColor: palette.surfaceRaised },
  barberPlaceholder: { width: 43, height: 43, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.surfaceRaised },
  selectionSummary: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 7, padding: 10, backgroundColor: '#1a1613', borderRadius: 12 },
  selectionText: { color: palette.text, fontSize: 12, fontWeight: '800' },
  sectionLabel: { color: palette.text, fontSize: 12, fontWeight: '800' },
  dateStrip: { gap: 8, paddingVertical: 3 },
  dateChoice: { width: 64, minHeight: 80, justifyContent: 'center', alignItems: 'center', gap: 3, borderRadius: 12, borderWidth: 1, borderColor: palette.border, backgroundColor: '#1a1613' },
  dateSelected: { borderColor: palette.gold, backgroundColor: '#3a2d20' },
  dateReserved: { opacity: 0.35 },
  dateMeta: { color: palette.muted, fontSize: 9, fontWeight: '700', textTransform: 'capitalize' },
  dateNumber: { color: palette.text, fontSize: 21, fontWeight: '900' },
  dateTextSelected: { color: palette.gold },
  hoursCard: { gap: 8, padding: 12, backgroundColor: '#1a1613', borderRadius: 13, borderColor: palette.border, borderWidth: 1 },
  hoursRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  hourValue: { marginLeft: 'auto', color: palette.text, fontSize: 12, fontWeight: '800' },
  timeSection: { gap: 8 },
  timeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  timeButton: { minWidth: 69, paddingVertical: 10, paddingHorizontal: 12, alignItems: 'center', borderRadius: 10, backgroundColor: '#1a1613', borderWidth: 1, borderColor: palette.border },
  timeSelected: { backgroundColor: '#3a2d20', borderColor: palette.gold },
  timeText: { color: palette.text, fontSize: 12, fontWeight: '700' },
  timeTextSelected: { color: palette.gold },
  summaryRow: { minHeight: 39, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, borderBottomColor: palette.border, borderBottomWidth: StyleSheet.hairlineWidth },
  summaryValue: { flex: 1, color: palette.text, fontSize: 12, fontWeight: '800', textAlign: 'right' },
  accountName: { color: palette.text, fontSize: 14, fontWeight: '800' },
  termsRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 5 },
  loginBox: { borderColor: palette.border, borderWidth: 1, borderRadius: 14, backgroundColor: '#191512', padding: 14, gap: 12 },
  checkbox: { width: 22, height: 22, alignItems: 'center', justifyContent: 'center', borderRadius: 6, borderWidth: 1, borderColor: palette.border },
  checkboxSelected: { backgroundColor: palette.gold, borderColor: palette.gold },
  buttonRow: { flexDirection: 'row', gap: 9 },
});
