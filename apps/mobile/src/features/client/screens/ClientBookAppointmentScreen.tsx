import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { router } from 'expo-router';
import { BackHandler, Image, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ThemedText as Text } from '@/components/ThemedText';
import { CalendarCheck, CalendarDays, Check, Clock3, Mail, Scissors } from 'lucide-react-native';

import { ActionButton, EmptyState, InlineMessage, TextField, palette } from '@/components/ui';
import { businessDateKey, businessTimeLabel, zonedDateTimeToDate } from '@/lib/business-time';
import { useSession } from '@/lib/session';
import { authenticateWithGoogle } from '@/lib/google-auth';
import { authErrorMessage } from '@/lib/auth-message';
import { supabase } from '@/lib/supabase';
import { publicMediaUrl, requireData, useRemoteData } from '@/lib/utils';
import { useAppearance } from '@/lib/appearance';
import { AppShell } from '@/components/AppShell';
import { ClientPageHeader } from '@/components/ClientPageHeader';

type Service = { slug: string; name: string; description: string | null; category: string | null; price: number; duration_minutes: number };
type Barber = { slug: string; display_name: string; bio: string | null; photo_path: string | null; specialties: string[] | null; service_slugs: string[] };
type BusinessHour = { weekday: number; opens_at: string; closes_at: string; afternoon_opens_at: string | null; afternoon_closes_at: string | null; active: boolean };
type BookingDay = { id: string; label: string; number: string; month: string; weekday: number };
type BookingData = { services: Service[]; barbers: Barber[]; timezone: string; businessStatus: string; hours: BusinessHour[]; reservedDayKeys: string[]; phone: string };
type AvailableSlot = { startsAt: string; time: string; isAvailable: boolean };

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
  return businessTimeLabel(value, timezone);
}

function displayDate(day: BookingDay | undefined) {
  return day ? day.label + ' ' + day.number + ' ' + day.month : 'Horario seleccionado';
}

export default function ClientBookingScreen() {
  const { session } = useSession();
  const { colors } = useAppearance();
  const insets = useSafeAreaInsets();
  const compactHeaderHeight = insets.top + 76;
  const userId = session?.user.id ?? '';
  const [step, setStep] = useState(1);
  const [serviceSlugs, setServiceSlugs] = useState<string[]>([]);
  const [barberSlug, setBarberSlug] = useState('');
  const [dayKey, setDayKey] = useState('');
  const [selectedSlot, setSelectedSlot] = useState<AvailableSlot | null>(null);
  const [phone, setPhone] = useState('');
  const [availableSlots, setAvailableSlots] = useState<AvailableSlot[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [availabilityVersion, setAvailabilityVersion] = useState(0);
  const [bookingError, setBookingError] = useState('');
  const [bookingLoading, setBookingLoading] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState('');
  const [authEmail, setAuthEmail] = useState('');
  const [authCode, setAuthCode] = useState('');
  const [authCodeSent, setAuthCodeSent] = useState(false);
  const [authResendAt, setAuthResendAt] = useState(0);
  const [authSecondsLeft, setAuthSecondsLeft] = useState(0);
  const [confirmed, setConfirmed] = useState(false);
  const selectedSlotRef = useRef<AvailableSlot | null>(null);
  const phonePrefilled = useRef(false);
  const authVerificationStarted = useRef(false);

  const query = useRemoteData<BookingData>(async () => {
    const [settingsResult, servicesResult, barbersResult, profileResult] = await Promise.all([
      supabase.from('business_settings').select('timezone,business_status').eq('id', true).maybeSingle(),
      supabase.from('services').select('slug,name,description,category,price,duration_minutes').eq('status', 'active').order('price'),
      supabase.from('barber_profiles').select('slug,display_name,bio,photo_path,specialties,barber_services(services(slug))').eq('active', true).order('display_name'),
      userId ? supabase.from('profiles').select('phone').eq('id', userId).maybeSingle() : Promise.resolve({ data: null, error: null }),
    ]);
    if (settingsResult.error) throw new Error(settingsResult.error.message);
    const services = requireData(servicesResult) as Service[];
    const barberRows = requireData(barbersResult) as unknown as Array<Omit<Barber, 'service_slugs'> & { barber_services?: Array<{ services?: { slug?: string } | null }> }>;
    const barbers: Barber[] = barberRows.map((barber) => ({
      ...barber,
      service_slugs: (barber.barber_services ?? []).flatMap((assignment) => assignment.services?.slug ? [assignment.services.slug] : []),
    }));
    const settings = settingsResult.data;
    const timezone = settings?.timezone ?? 'America/La_Paz';
    const days = datesFor(timezone);
    const afterLastDay = new Date(days[days.length - 1].id + 'T00:00:00.000Z');
    afterLastDay.setUTCDate(afterLastDay.getUTCDate() + 1);
    const rangeStart = zonedDateTimeToDate(days[0].id + 'T00:00:00', timezone).toISOString();
    const rangeEnd = zonedDateTimeToDate(afterLastDay.toISOString().slice(0, 10) + 'T00:00:00', timezone).toISOString();
    const [hoursResult, appointmentsResult] = await Promise.all([
      supabase.from('business_hours').select('weekday,opens_at,closes_at,afternoon_opens_at,afternoon_closes_at,active').order('weekday'),
      userId ? supabase.from('appointments').select('starts_at').eq('client_id', userId).neq('status', 'canceled').gte('starts_at', rangeStart).lt('starts_at', rangeEnd) : Promise.resolve({ data: [], error: null }),
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
  const selectedServices = useMemo(() => (data?.services ?? []).filter((item) => serviceSlugs.includes(item.slug)), [data?.services, serviceSlugs]);
  const selectedServiceNames = selectedServices.map((item) => item.name).join(' + ');
  const selectedDuration = selectedServices.reduce((total, item) => total + item.duration_minutes, 0);
  const selectedPrice = selectedServices.reduce((total, item) => total + Number(item.price), 0);
  const eligibleBarbers = (data?.barbers ?? []).filter((item) => selectedServices.length > 0 && selectedServices.every((service) => item.service_slugs.includes(service.slug)));
  const selectedBarber = eligibleBarbers.find((item) => item.slug === barberSlug);
  const selectedDay = days.find((item) => item.id === dayKey);
  const selectedHours = data?.hours.find((item) => item.weekday === selectedDay?.weekday);
  const bookingClosed = data?.businessStatus === 'closed' || data?.businessStatus === 'emergency_closed';
  const selectedTime = selectedSlot?.time ?? '';
  const needsPhone = !data?.phone.trim();

  useEffect(() => { selectedSlotRef.current = selectedSlot; }, [selectedSlot]);

  useEffect(() => {
    const update = () => setAuthSecondsLeft(Math.max(0, Math.ceil((authResendAt - Date.now()) / 1000)));
    update();
    if (!authResendAt) return;
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, [authResendAt]);

  useEffect(() => {
    if (data && userId && !query.loading && !phonePrefilled.current) {
      setPhone(data.phone);
      phonePrefilled.current = true;
    }
  }, [data, query.loading, userId]);

  useEffect(() => {
    if (!data || !dayKey || !serviceSlugs.length || !barberSlug) return;
    const reserved = data.reservedDayKeys.includes(dayKey);
    const unavailable = reserved || bookingClosed || !selectedHours?.active;
    if (unavailable) {
      let active = true;
      void Promise.resolve().then(() => {
        if (!active) return;
        setAvailableSlots([]);
        setSelectedSlot(null);
        selectedSlotRef.current = null;
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
      try {
        const { data: result, error } = await supabase.rpc('get_booking_slots_for_services', {
          p_service_slugs: serviceSlugs,
          p_barber_slug: barberSlug,
          p_date: dayKey,
        });
        if (!active) return;
        if (error) {
          setAvailableSlots([]);
          setBookingError('No se pudo consultar la agenda. Intenta de nuevo en unos minutos.');
          return;
        }
        const slotsByInstant = new Map<number, AvailableSlot>();
        for (const slot of (result ?? []) as Array<{ starts_at: string; is_available: boolean }>) {
          const instant = Date.parse(slot.starts_at);
          if (Number.isFinite(instant)) slotsByInstant.set(instant, { startsAt: slot.starts_at, time: formatSlot(slot.starts_at, timezone), isAvailable: slot.is_available });
        }
        const slots = [...slotsByInstant.entries()].sort(([left], [right]) => left - right).map(([, slot]) => slot);
        setAvailableSlots(slots);
        const selected = selectedSlotRef.current;
        if (selected && !slots.some((slot) => slot.isAvailable && Date.parse(slot.startsAt) === Date.parse(selected.startsAt))) {
          setSelectedSlot(null);
          selectedSlotRef.current = null;
          setBookingError('Ese horario ya no está disponible. Elige otro para continuar.');
          setStep(3);
        }
      } catch {
        if (!active) return;
        setAvailableSlots([]);
        setBookingError('No se pudo consultar la agenda. Intenta de nuevo en unos minutos.');
      } finally {
        if (active) setSlotsLoading(false);
      }
    }
    void loadAvailability();
    return () => { active = false; };
  }, [availabilityVersion, barberSlug, bookingClosed, data, dayKey, selectedHours?.active, serviceSlugs]);

  function selectService(slug: string) {
    const alreadySelected = serviceSlugs.includes(slug);
    if (!alreadySelected) {
      const service = data?.services.find((item) => item.slug === slug);
      if (serviceSlugs.length >= 12) {
        setBookingError('Puedes combinar hasta 12 servicios en una cita.');
        return;
      }
      if (service && selectedDuration + service.duration_minutes > 480) {
        setBookingError('La duración total de una cita no puede superar 8 horas.');
        return;
      }
    }
    setServiceSlugs((current) => current.includes(slug) ? current.filter((item) => item !== slug) : [...current, slug]);
    setBarberSlug('');
    setDayKey('');
    setSelectedSlot(null);
    selectedSlotRef.current = null;
    setAvailableSlots([]);
    setBookingError('');
  }

  function selectBarber(slug: string) {
    setBarberSlug(slug);
    setDayKey('');
    setSelectedSlot(null);
    selectedSlotRef.current = null;
    setAvailableSlots([]);
    setBookingError('');
  }

  async function confirmBooking() {
    if (!data || !selectedServices.length || !selectedBarber || !dayKey || !selectedSlot?.isAvailable) {
      setBookingError('Vuelve a elegir un horario disponible para continuar.');
      setStep(3);
      return;
    }
    const contactPhone = data.phone.trim() || phone.trim();
    if (contactPhone.replace(/\D/g, '').length < 7) return;
    setBookingLoading(true);
    setBookingError('');
    try {
      const { error } = await supabase.rpc('create_appointment_with_services', {
        p_service_slugs: selectedServices.map((item) => item.slug),
        p_barber_slug: selectedBarber.slug,
        p_starts_at: selectedSlot.startsAt,
        p_phone: contactPhone,
      });
      if (error) throw error;
      setConfirmed(true);
      query.refresh();
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : 'No pudimos guardar la cita. Revisa el horario e inténtalo nuevamente.';
      setBookingError(message);
      if (/horario|disponible|reservas/i.test(message)) {
        setSelectedSlot(null);
        selectedSlotRef.current = null;
        setStep(3);
        setAvailabilityVersion((value) => value + 1);
      }
    } finally {
      setBookingLoading(false);
    }
  }

  async function signInToReserve(resend = false) {
    setAuthLoading(true);
    setAuthError('');
    try {
      if (!authCodeSent || resend) {
        if (resend && authSecondsLeft > 0) return;
        const normalized = authEmail.trim().toLowerCase();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) { setAuthError('Escribe un correo electrónico válido.'); return; }
        const { error } = await supabase.auth.signInWithOtp({ email: normalized, options: { shouldCreateUser: true } });
        if (error) throw error;
        setAuthEmail(normalized); setAuthCodeSent(true); setAuthResendAt(Date.now() + 60_000); setAuthCode('');
      }
    } catch (reason) {
      setAuthError(authErrorMessage(reason, 'No se pudo enviar el código.'));
    } finally {
      setAuthLoading(false);
    }
  }

  async function verifyBookingCode(value: string) {
    const token = value.trim();
    if (!/^\d{6}$/.test(token) || authVerificationStarted.current) return;
    authVerificationStarted.current = true;
    setAuthLoading(true);
    setAuthError('');
    try {
      const { error } = await supabase.auth.verifyOtp({ email: authEmail.trim().toLowerCase(), token, type: 'email' });
      if (error) throw error;
    } catch (reason) {
      authVerificationStarted.current = false;
      setAuthError(authErrorMessage(reason, 'No se pudo validar el código.'));
    } finally {
      setAuthLoading(false);
    }
  }

  async function signInWithGoogleToReserve() {
    setAuthLoading(true);
    setAuthError('');
    try {
      await authenticateWithGoogle();
    } catch (reason) {
      setAuthError(authErrorMessage(reason, 'No se pudo iniciar con Google.'));
    } finally {
      setAuthLoading(false);
    }
  }

  const onBack = useCallback(() => {
    if (confirmed || step === 1) router.replace(userId ? '/client' : '/sign-in');
    else setStep((value) => Math.max(1, value - 1));
  }, [confirmed, step, userId]);

  useEffect(() => {
    if (Platform.OS !== 'android' || step <= 1 || confirmed) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      onBack();
      return true;
    });
    return () => subscription.remove();
  }, [confirmed, onBack, step]);

  const prompts = ['Elige tus servicios', 'Elige tu peluquero', 'Elige tu horario', 'Confirma tu cita'];
  const stepLabels = ['Servicios', 'Peluquero', 'Horario', 'Confirmar'];

  return (
    <AppShell
      title="Reservar cita"
      roleLabel="RESERVA"
      tabs={[]}
      showChat={false}
      floatingHeaderHeight={compactHeaderHeight}
      floatingHeader={(scrollY) => <ClientPageHeader scrollY={scrollY} expandedHeight={compactHeaderHeight} eyebrow="RESERVA DE CITA" title={confirmed ? 'Cita confirmada' : prompts[step - 1]} description="" compact onBack={onBack} showChat={false} />}>
      <View style={styles.flowContent}>
        {confirmed && selectedServices.length > 0 ? (
          <View style={styles.stepContent}>
            <View style={[styles.confirmedMark, { backgroundColor: colors.successSoft, borderColor: colors.successBorder }]}><Check size={30} color={colors.success} strokeWidth={2.5} /></View>
            <Text style={[styles.confirmedTitle, { color: colors.text }]}>¡Nos vemos pronto!</Text>
            <View style={[styles.confirmationCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <SummaryRow label="Servicios" value={selectedServiceNames} />
              <SummaryRow label="Peluquero" value={selectedBarber?.display_name ?? ''} />
              <SummaryRow label="Fecha y hora" value={displayDate(selectedDay) + ' · ' + selectedTime} />
              <SummaryRow label="Duración" value={selectedDuration + ' min'} />
              <SummaryRow label="Precio total" value={'Bs ' + selectedPrice.toFixed(2)} />
            </View>
            <ActionButton label="Ver mi cuenta" icon={CalendarDays} onPress={() => router.replace('/client')} />
          </View>
        ) : (
          <>
            <View style={styles.steps}>
              {stepLabels.map((label, index) => {
                const done = step > index + 1;
                const active = step === index + 1;
                return (
                  <View key={label} style={[styles.stepPill, { backgroundColor: colors.surface, borderColor: colors.border }, active && { borderColor: colors.accent, backgroundColor: colors.accentSoft }, done && { borderColor: colors.successBorder }]}>
                    <View style={[styles.stepMark, { borderColor: colors.muted }, active && { backgroundColor: colors.accent, borderColor: colors.accent }, done && { backgroundColor: colors.success, borderColor: colors.success }]}>
                      {done ? <Check size={11} color="#FFFFFF" strokeWidth={3} /> : <Text style={[styles.stepNumber, { color: active ? colors.accentForeground : colors.muted }]}>{index + 1}</Text>}
                    </View>
                    <Text numberOfLines={1} style={[styles.stepLabel, { color: active ? colors.text : colors.muted }]}>{label}</Text>
                  </View>
                );
              })}
            </View>
            {query.error ? <InlineMessage>{query.error}</InlineMessage> : null}
            {query.loading && !data ? <EmptyState title="Cargando…" /> : null}
            {!query.loading && data && step === 1 ? (
              <View style={styles.stepContent}>
                <Text style={styles.muted}>Elige uno o varios servicios. Sumaremos el tiempo para buscar un horario que alcance para toda la cita.</Text>
                {data.services.length ? data.services.map((service) => (
                  <Pressable key={service.slug} accessibilityRole="checkbox" accessibilityState={{ checked: serviceSlugs.includes(service.slug) }} accessibilityLabel={`${service.name}, ${service.duration_minutes} minutos, Bs ${Number(service.price).toFixed(2)}`} onPress={() => selectService(service.slug)} style={[styles.choiceCard, { backgroundColor: colors.surface, borderColor: serviceSlugs.includes(service.slug) ? colors.accent : colors.border }, serviceSlugs.includes(service.slug) && { backgroundColor: colors.accentSoft }]}>
                    <View style={styles.choiceCopy}>
                      <Text style={styles.choiceEyebrow}>{service.category || 'Servicio'}</Text>
                      <Text style={styles.choiceTitle}>{service.name}</Text>
                      {service.description ? <Text style={styles.muted}>{service.description}</Text> : null}
                    </View>
                    <View style={styles.choiceMeta}><Text style={styles.price}>Bs {Number(service.price).toFixed(2)}</Text><Text style={styles.muted}>{service.duration_minutes} min</Text>{serviceSlugs.includes(service.slug) ? <Check size={18} color={colors.accent} /> : <Text style={styles.addLabel}>Agregar</Text>}</View>
                  </Pressable>
                )) : <EmptyState title="No hay servicios disponibles" />}
                {selectedServices.length > 0 ? <View style={[styles.selectionSummary, { backgroundColor: colors.accentSoft }]}><Scissors size={15} color={colors.accent} /><Text style={styles.selectionText}>{selectedServices.length} servicio(s) · {selectedDuration} min</Text><Text style={styles.muted}>Bs {selectedPrice.toFixed(2)}</Text></View> : null}
                {bookingError ? <InlineMessage>{bookingError}</InlineMessage> : null}
                <ActionButton label="Elegir peluquero" icon={CalendarDays} disabled={!selectedServices.length} onPress={() => { setBookingError(''); setStep(2); }} />
              </View>
            ) : null}
            {!query.loading && data && step === 2 ? (
              <View style={styles.stepContent}>
                {eligibleBarbers.map((barber) => (
                  <Pressable key={barber.slug} onPress={() => selectBarber(barber.slug)} style={[styles.barberChoice, { backgroundColor: colors.surface, borderColor: colors.border }, barberSlug === barber.slug && { backgroundColor: colors.accentSoft, borderColor: colors.accent }]}>
                    {publicMediaUrl(barber.photo_path) ? <Image source={{ uri: publicMediaUrl(barber.photo_path)! }} alt={barber.display_name} style={styles.barberImage} /> : <View style={styles.barberPlaceholder}><Scissors size={18} color={palette.gold} /></View>}
                    <View style={styles.choiceCopy}><Text style={styles.choiceTitle}>{barber.display_name}</Text><Text style={styles.muted}>{(barber.specialties ?? []).join(', ') || barber.bio || 'Barbero LEGEND CLUB'}</Text></View>
                    {barberSlug === barber.slug ? <Check size={19} color={colors.success} strokeWidth={3} /> : null}
                  </Pressable>
                ))}
                {eligibleBarbers.length === 0 ? <EmptyState title={data.barbers.length ? 'Ningún peluquero realiza todos los servicios elegidos' : 'No hay peluqueros disponibles'} /> : null}
                <ActionButton label="Continuar" icon={CalendarDays} disabled={!barberSlug} onPress={() => { setBookingError(''); setStep(3); }} />
              </View>
            ) : null}
            {!query.loading && data && step === 3 ? (
              <View style={styles.stepContent}>
                <View style={styles.selectionSummary}><Scissors size={15} color={palette.gold} /><Text style={styles.selectionText}>{selectedServiceNames}</Text><Text style={styles.muted}>{selectedDuration} min · {selectedBarber?.display_name || ''}</Text></View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dateStrip}>
                  {days.map((item) => {
                    const reserved = data.reservedDayKeys.includes(item.id);
                    const selected = dayKey === item.id;
                    return (
                      <Pressable key={item.id} disabled={reserved} onPress={() => { setDayKey(item.id); setSelectedSlot(null); selectedSlotRef.current = null; setAvailableSlots([]); setBookingError(''); }} style={[styles.dateChoice, { backgroundColor: colors.surface, borderColor: colors.border }, selected && { backgroundColor: colors.accentSoft, borderColor: colors.accent }, reserved && styles.dateReserved]}>
                        <Text style={[styles.dateMeta, { color: selected ? colors.accent : colors.muted }]}>{reserved ? 'Con cita' : item.label}</Text>
                        <Text style={[styles.dateNumber, { color: selected ? colors.accent : colors.text }]}>{item.number}</Text>
                        <Text style={[styles.dateMeta, { color: selected ? colors.accent : colors.muted }]}>{item.month}</Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
                {dayKey && bookingClosed ? <EmptyState title="Reservas pausadas" /> : null}
                {dayKey && !bookingClosed && !selectedHours?.active ? <EmptyState title="El local está cerrado este día" /> : null}
                {dayKey && selectedHours?.active ? (
                  <>
                    <View style={[styles.hoursCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                      <View style={styles.hoursRow}><Clock3 size={15} color={palette.gold} /><Text style={styles.muted}>Jornada continua</Text><Text style={styles.hourValue}>{selectedHours.opens_at.slice(0, 5)}–{selectedHours.closes_at.slice(0, 5)}</Text></View>
                    </View>
                    {slotsLoading ? <EmptyState title="Buscando horarios…" /> : availableSlots.length ? (
                      <TimeOptions title={`Inicio de cita · ${selectedDuration} min`} slots={availableSlots} selected={selectedSlot?.startsAt ?? ''} onSelect={(value) => { setSelectedSlot(value); setBookingError(''); }} />
                    ) : <EmptyState title="No hay horarios disponibles" />}
                  </>
                ) : null}
                {bookingError ? <InlineMessage>{bookingError}</InlineMessage> : null}
                <ActionButton label="Continuar" icon={Check} disabled={!dayKey || !selectedSlot?.isAvailable || slotsLoading} onPress={() => setStep(4)} />
              </View>
            ) : null}
            {!query.loading && data && step === 4 && selectedServices.length > 0 ? (
              <View style={styles.stepContent}>
                <View style={[styles.confirmationCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <SummaryRow label="Servicios" value={selectedServiceNames} />
                  <SummaryRow label="Peluquero" value={selectedBarber?.display_name ?? ''} />
                  <SummaryRow label="Fecha y hora" value={displayDate(selectedDay) + ' · ' + selectedTime} />
                  <SummaryRow label="Duración total" value={selectedDuration + ' min'} />
                  <SummaryRow label="Precio total" value={'Bs ' + selectedPrice.toFixed(2)} />
                </View>
                {!session ? (
                  <View style={styles.loginBox}>
                    {!authCodeSent ? <>
                      <ActionButton label="Continuar con Google" loading={authLoading} onPress={() => void signInWithGoogleToReserve()} />
                      <Text style={styles.authDivider}>O CON TU CORREO</Text>
                      <TextField label="Correo electrónico" value={authEmail} onChangeText={setAuthEmail} placeholder="tu@correo.com" keyboardType="email-address" autoCapitalize="none" autoCorrect={false} autoComplete="email" editable={!authLoading} />
                      <ActionButton label="Enviarme un código" icon={Mail} loading={authLoading} onPress={() => void signInToReserve()} />
                    </> : <>
                      <TextField label={`Código enviado a ${authEmail}`} value={authCode} onChangeText={(value) => {
                        const digits = value.replace(/\D/g, '').slice(0, 6);
                        setAuthCode(digits);
                        setAuthError('');
                        if (digits.length === 6) void verifyBookingCode(digits);
                      }} placeholder="000000" keyboardType="number-pad" {...(Platform.OS === 'ios' ? { textContentType: 'oneTimeCode' as const } : { autoComplete: Platform.OS === 'android' ? 'email-otp' as const : 'one-time-code' as const })} importantForAutofill={Platform.OS === 'android' ? 'yes' : 'auto'} maxLength={6} editable={!authLoading} autoFocus />
                      <ActionButton label="Verificar código" icon={Mail} loading={authLoading} disabled={authCode.length !== 6} onPress={() => void verifyBookingCode(authCode)} />
                      <View style={styles.authLinks}>
                        <Pressable disabled={authLoading} onPress={() => { setAuthCodeSent(false); setAuthCode(''); setAuthError(''); }}><Text style={styles.authLink}>Cambiar correo</Text></Pressable>
                        <Pressable disabled={authLoading || authSecondsLeft > 0} onPress={() => { authVerificationStarted.current = false; void signInToReserve(true); }}><Text style={[styles.authLink, authSecondsLeft > 0 && styles.authLinkDisabled]}>{authSecondsLeft > 0 ? `Reenviar en ${authSecondsLeft}s` : 'Reenviar código'}</Text></Pressable>
                      </View>
                    </>}
                    {authError ? <InlineMessage>{authError}</InlineMessage> : null}
                  </View>
                ) : (
                  <>
                    {needsPhone ? <TextField label="Número de teléfono" value={phone} onChangeText={setPhone} placeholder="Ej. 720 12345" keyboardType="phone-pad" maxLength={20} /> : null}
                    {bookingError ? <InlineMessage>{bookingError}</InlineMessage> : null}
                    <ActionButton label={bookingLoading ? 'Confirmando…' : 'Confirmar cita'} icon={CalendarCheck} disabled={needsPhone && phone.replace(/\D/g, '').length < 7} loading={bookingLoading} onPress={() => void confirmBooking()} />
                  </>
                )}
              </View>
            ) : null}
            {step === 4 && !selectedServices.length ? <InlineMessage>Vuelve a elegir un servicio para reservar.</InlineMessage> : null}
          </>
        )}
      </View>
    </AppShell>
  );
}

function TimeOptions({ title, slots, selected, onSelect }: { title: string; slots: AvailableSlot[]; selected: string; onSelect: (value: AvailableSlot) => void }) {
  const { colors } = useAppearance();
  if (!slots.length) return null;
  const availableCount = slots.filter((slot) => slot.isAvailable).length;
  const occupiedCount = slots.length - availableCount;
  return <View style={styles.timeSection}><Text style={styles.sectionLabel}>{title}</Text><Text style={styles.muted}>{availableCount} disponibles{occupiedCount > 0 ? ` · ${occupiedCount} ocupados` : ''}</Text><View style={styles.timeGrid}>{slots.map((slot) => {
    const isSelected = selected === slot.startsAt;
    return <Pressable key={slot.startsAt} disabled={!slot.isAvailable} accessibilityRole="button" accessibilityLabel={`${slot.time}, ${slot.isAvailable ? 'disponible' : 'ocupado'}`} accessibilityState={{ disabled: !slot.isAvailable, selected: isSelected }} onPress={() => onSelect(slot)} style={[styles.timeButton, { backgroundColor: colors.surface, borderColor: colors.border }, isSelected && { backgroundColor: colors.accentSoft, borderColor: colors.accent }, !slot.isAvailable && { backgroundColor: colors.raised, borderColor: colors.border, opacity: 0.72 }]}><Text style={[styles.timeText, { color: isSelected ? colors.accent : slot.isAvailable ? colors.text : colors.muted }]}>{slot.time}</Text>{!slot.isAvailable ? <Text style={[styles.timeStatus, { color: colors.muted }]}>Ocupado</Text> : null}</Pressable>;
  })}</View></View>;
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return <View style={styles.summaryRow}><Text style={styles.muted}>{label}</Text><Text style={styles.summaryValue}>{value}</Text></View>;
}

const styles = StyleSheet.create({
  flowContent: { flexGrow: 1, gap: 16, paddingHorizontal: 18, paddingTop: 16, paddingBottom: 24 },
  stepContent: { gap: 12 },
  steps: { flexDirection: 'row', gap: 5 },
  stepPill: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, borderWidth: 1, borderRadius: 11, paddingVertical: 8, paddingHorizontal: 3 },
  stepMark: { width: 19, height: 19, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderRadius: 10 },
  stepNumber: { fontSize: 9, fontWeight: '900' },
  stepLabel: { fontSize: 8, fontWeight: '800' },
  choiceCard: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderRadius: 15, borderWidth: 1 },
  choiceCopy: { flex: 1, gap: 4 },
  choiceEyebrow: { color: palette.gold, fontSize: 9, fontWeight: '800', letterSpacing: 1 },
  choiceTitle: { color: palette.text, fontSize: 14, fontWeight: '800' },
  muted: { color: palette.muted, fontSize: 11, lineHeight: 16 },
  choiceMeta: { alignItems: 'flex-end', gap: 5 },
  addLabel: { color: palette.gold, fontSize: 10, fontWeight: '800' },
  price: { color: palette.gold, fontSize: 13, fontWeight: '800' },
  barberChoice: { minHeight: 67, flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderRadius: 13, borderColor: palette.border, borderWidth: 1, backgroundColor: '#15181C' },
  barberImage: { width: 43, height: 43, borderRadius: 12, backgroundColor: palette.surfaceRaised },
  barberPlaceholder: { width: 43, height: 43, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.surfaceRaised },
  selectionSummary: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 7, padding: 10, backgroundColor: '#15181C', borderRadius: 12 },
  selectionText: { color: palette.text, fontSize: 12, fontWeight: '800' },
  sectionLabel: { color: palette.text, fontSize: 12, fontWeight: '800' },
  dateStrip: { gap: 8, paddingVertical: 3 },
  dateChoice: { width: 64, minHeight: 80, justifyContent: 'center', alignItems: 'center', gap: 3, borderRadius: 12, borderWidth: 1, borderColor: palette.border, backgroundColor: '#15181C' },
  dateReserved: { opacity: 0.35 },
  dateMeta: { color: palette.muted, fontSize: 9, fontWeight: '700', textTransform: 'capitalize' },
  dateNumber: { color: palette.text, fontSize: 21, fontWeight: '900' },
  dateTextSelected: { color: palette.gold },
  hoursCard: { gap: 8, padding: 12, backgroundColor: '#15181C', borderRadius: 13, borderColor: palette.border, borderWidth: 1 },
  hoursRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  hourValue: { marginLeft: 'auto', color: palette.text, fontSize: 12, fontWeight: '800' },
  timeSection: { gap: 8 },
  timeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  timeButton: { minWidth: 69, minHeight: 48, paddingVertical: 7, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center', borderRadius: 10, backgroundColor: '#15181C', borderWidth: 1, borderColor: palette.border },
  timeText: { color: palette.text, fontSize: 12, fontWeight: '700' },
  timeStatus: { fontSize: 9, fontWeight: '700' },
  summaryRow: { minHeight: 39, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, borderBottomColor: palette.border, borderBottomWidth: StyleSheet.hairlineWidth },
  summaryValue: { flex: 1, color: palette.text, fontSize: 12, fontWeight: '800', textAlign: 'right' },
  confirmationCard: { gap: 3, borderWidth: 1, borderRadius: 16, paddingHorizontal: 15, paddingVertical: 5 },
  confirmedMark: { width: 64, height: 64, alignItems: 'center', justifyContent: 'center', alignSelf: 'center', borderWidth: 1, borderRadius: 32, marginTop: 40 },
  confirmedTitle: { color: palette.text, fontSize: 23, lineHeight: 29, fontWeight: '900', textAlign: 'center', marginBottom: 16 },
  loginBox: { borderColor: palette.border, borderWidth: 1, borderRadius: 14, backgroundColor: '#121519', padding: 14, gap: 12 },
  authDivider: { color: palette.muted, fontSize: 9, fontWeight: '800', letterSpacing: 1.5, textAlign: 'center' },
  authLinks: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
  authLink: { color: palette.gold, fontSize: 11, fontWeight: '700', paddingVertical: 4 },
  authLinkDisabled: { color: '#727A85' },
});
