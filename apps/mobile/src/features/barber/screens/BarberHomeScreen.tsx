import { useState } from 'react';
import { Alert, Linking, Modal, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { ThemedText as Text } from '@/components/ThemedText';
import { CalendarDays, Check, ChevronDown, CreditCard, History, Phone, Play, UserRoundX } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppShell } from '@/components/AppShell';
import { FloatingPageHeader, useClientHeaderHeight } from '@/components/ClientPageHeader';
import { ActionButton, Card, CardTitle, EmptyState, InlineMessage, LoadingState, palette } from '@/components/ui';
import { useAppearance } from '@/lib/appearance';
import { barberTabs } from '@/lib/navigation';
import { useSession } from '@/lib/session';
import { businessDateKey, zonedDateTimeToDate } from '@/lib/business-time';
import { supabase } from '@/lib/supabase';
import { businessDayStart, formatDate, requireData, useRemoteData } from '@/lib/utils';

type Appointment = { id: string; service_id: string; starts_at: string; ends_at: string; status: string; service_name_snapshot: string; client_name_snapshot: string | null; notes: string | null; reference_image_path: string | null };
type BarberClient = { appointment_id: string; full_name: string | null; phone: string | null; is_blacklisted: boolean };
type Service = { id: string; name: string; price: number };
type Product = { id: string; name: string; price: number; stock: number };
type AgendaData = { appointments: Appointment[]; clients: BarberClient[]; services: Service[]; products: Product[]; timezone: string };

export default function BarberAgendaScreen() {
  const { barber } = useSession();
  const { colors } = useAppearance();
  const expandedHeaderHeight = useClientHeaderHeight(227);
  const [selectedDayKey, setSelectedDayKey] = useState('');
  const barberId = barber?.id ?? '';
  const query = useRemoteData<AgendaData>(async () => {
    if (!barberId) throw new Error('No se encontró tu perfil de peluquero.');
    const settingsResult = await supabase.from('business_settings').select('timezone').eq('id', true).maybeSingle();
    if (settingsResult.error) throw new Error(settingsResult.error.message);
    const timezone = settingsResult.data?.timezone ?? 'America/La_Paz';
    const start = businessDayStart(timezone);
    const end = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000);
    const [appointmentsResult, servicesResult, productsResult] = await Promise.all([
      supabase.from('appointments').select('id,service_id,starts_at,ends_at,status,service_name_snapshot,client_name_snapshot,notes,reference_image_path')
        .eq('barber_id', barberId).gte('starts_at', start.toISOString()).lt('starts_at', end.toISOString()).order('starts_at'),
      supabase.from('services').select('id,name,price').eq('status', 'active').order('name'),
      supabase.from('products').select('id,name,price,stock').eq('status', 'active').gt('stock', 0).order('name'),
    ]);
    const appointments = requireData(appointmentsResult) as Appointment[];
    const ids = appointments.map((appointment) => appointment.id);
    const clientResult = ids.length ? await supabase.rpc('get_barber_appointment_clients', { target_appointment_ids: ids }) : { data: [], error: null };
    if (clientResult.error) throw new Error(clientResult.error.message);
    return { appointments, clients: (clientResult.data ?? []) as BarberClient[], services: requireData(servicesResult), products: requireData(productsResult), timezone };
  }, barberId);

  const data = query.data;
  const timezone = data?.timezone ?? 'America/La_Paz';
  const now = new Date().toISOString();
  const todayKey = businessDateKey(new Date(now), timezone);
  const activeAppointments = (data?.appointments ?? []).filter((item) => !['canceled', 'completed', 'no_show', 'needs_reschedule'].includes(item.status));
  const clientById = new Map((data?.clients ?? []).map((item) => [item.appointment_id, item]));
  const appointmentsByDay = activeAppointments.reduce<Record<string, Appointment[]>>((result, appointment) => {
    const key = businessDateKey(new Date(appointment.starts_at), timezone);
    (result[key] ??= []).push(appointment);
    return result;
  }, {});
  const weekDays = buildWeekDays(todayKey, appointmentsByDay, timezone);
  const selectedDay = weekDays.find((day) => day.key === selectedDayKey) ?? weekDays[0];
  const selectedAppointments = selectedDay?.appointments ?? [];

  return (
    <AppShell title="Agenda" roleLabel={`PELUQUERO · ${barber?.display_name ?? ''}`} activeTab="agenda" tabs={barberTabs} onRefresh={query.refresh} refreshing={query.loading}
      floatingHeaderHeight={expandedHeaderHeight}
      floatingHeader={(scrollY) => <FloatingPageHeader scrollY={scrollY} expandedHeight={expandedHeaderHeight} eyebrow="TU ESTACIÓN" title={`Hola, ${barber?.display_name ?? 'peluquero'}`} description="Agenda, atenciones y el resumen de tu jornada." titleSize={36} expandedContentHeight={142} chatHref="/barber/chat" />}>
      <View style={styles.agendaContent}>
        {query.error ? <InlineMessage>{query.error}</InlineMessage> : null}
        {!data && query.loading ? <LoadingState title="Sincronizando tu agenda…" /> : null}
        {data ? <>
          <View style={styles.weekHeading}>
            <View style={styles.weekHeadingCopy}>
              <Text style={[styles.weekEyebrow, { color: colors.accent }]}>AGENDA SEMANAL</Text>
              <Text style={[styles.weekTitle, { color: colors.text }]}>Tus citas</Text>
            </View>
            <Text style={[styles.weekCaption, { color: colors.muted }]}>Próximos 7 días</Text>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.weekCalendar}>
            {weekDays.map((day) => {
              const selected = day.key === selectedDay?.key;
              return <Pressable key={day.key} onPress={() => setSelectedDayKey(day.key)} style={[styles.weekDay, { backgroundColor: selected ? colors.accent : colors.surface, borderColor: selected ? colors.accent : colors.glassBorder }]} accessibilityRole="button" accessibilityLabel={`${day.fullLabel}, ${day.appointments.length} ${day.appointments.length === 1 ? 'cita' : 'citas'}`} accessibilityState={{ selected }}>
                <Text style={[styles.weekDayName, { color: selected ? colors.accentForeground : colors.muted }]}>{day.weekday}</Text>
                <Text style={[styles.weekDayNumber, { color: selected ? colors.accentForeground : colors.text }]}>{day.dayNumber}</Text>
                <View style={[styles.weekDayCount, { backgroundColor: selected ? colors.accentForeground : colors.glassRaised }]}>
                  <Text style={[styles.weekDayCountText, { color: selected ? colors.accent : colors.muted }]}>{day.appointments.length}</Text>
                </View>
              </Pressable>;
            })}
          </ScrollView>

          <Card>
            <CardTitle icon={selectedDay?.isToday ? CalendarDays : History} title={selectedDay?.isToday ? 'Hoy' : selectedDay?.fullLabel ?? 'Agenda'} subtitle={`${selectedAppointments.length} ${selectedAppointments.length === 1 ? 'cita' : 'citas'}`} />
            {selectedAppointments.length ? selectedAppointments.map((appointment) => (
              <AppointmentCard key={appointment.id} appointment={appointment} client={clientById.get(appointment.id)} timezone={timezone} services={data.services} products={data.products} canManage={selectedDay?.isToday ?? false} refresh={query.refresh} />
            )) : <EmptyState title="No hay citas para este día" description="Elige otra fecha de la semana para consultar su agenda." />}
          </Card>
        </> : null}
      </View>
    </AppShell>
  );
}

function buildWeekDays(todayKey: string, appointmentsByDay: Record<string, Appointment[]>, timezone: string) {
  const [year, month, day] = todayKey.split('-').map(Number);
  return Array.from({ length: 7 }, (_, offset) => {
    const calendarDate = new Date(Date.UTC(year, month - 1, day + offset, 12));
    const key = `${calendarDate.getUTCFullYear()}-${String(calendarDate.getUTCMonth() + 1).padStart(2, '0')}-${String(calendarDate.getUTCDate()).padStart(2, '0')}`;
    const localNoon = zonedDateTimeToDate(`${key}T12:00:00`, timezone).toISOString();
    return {
      key,
      isToday: offset === 0,
      weekday: formatDate(localNoon, { weekday: 'short', timeZone: timezone }).replace(/\.$/, ''),
      dayNumber: formatDate(localNoon, { day: 'numeric', timeZone: timezone }),
      fullLabel: formatDate(localNoon, { weekday: 'long', day: 'numeric', month: 'long', timeZone: timezone }),
      appointments: appointmentsByDay[key] ?? [],
    };
  });
}

function statusLabel(status: string) {
  return ({ requested: 'Solicitada', confirmed: 'Confirmada', in_progress: 'En atención', pending_payment: 'En caja', pending_client_confirmation: 'Cambio pendiente' } as Record<string, string>)[status] ?? status;
}

function formatTimeRange(appointment: Appointment, timezone: string) {
  const start = formatDate(appointment.starts_at, { timeStyle: 'short', timeZone: timezone });
  const end = formatDate(appointment.ends_at, { timeStyle: 'short', timeZone: timezone });
  return `${start} – ${end}`;
}

function AppointmentCard({ appointment, client, timezone, services, products, canManage, refresh }: { appointment: Appointment; client?: BarberClient; timezone: string; services: Service[]; products: Product[]; canManage: boolean; refresh: () => void }) {
  return (
    <View style={styles.appointment}>
      <View style={styles.appointmentTime}><Text style={styles.time}>{formatTimeRange(appointment, timezone)}</Text></View>
      <View style={styles.appointmentCopy}>
        <Text style={styles.clientName}>{client?.full_name ?? appointment.client_name_snapshot ?? 'Cliente'}</Text>
        <Text style={styles.muted}>{appointment.service_name_snapshot} · {statusLabel(appointment.status)}</Text>
        {client?.phone ? <Pressable onPress={() => void Linking.openURL(`tel:${client.phone}`)} style={styles.phone}><Phone size={13} color={palette.gold} /><Text style={styles.muted}>{client.phone}</Text></Pressable> : null}
        {client?.is_blacklisted ? <Text style={styles.warning}>Alerta por inasistencias</Text> : null}
        {appointment.notes ? <Text style={styles.muted}>Nota: {appointment.notes}</Text> : null}
      </View>
      {canManage ? <AppointmentActions appointment={appointment} services={services} products={products} refresh={refresh} /> : null}
    </View>
  );
}

function AppointmentActions({ appointment, services, products, refresh }: { appointment: Appointment; services: Service[]; products: Product[]; refresh: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  if (appointment.status === 'pending_payment') return <Text style={styles.inCash}>En caja</Text>;

  async function updateStatus(nextStatus: 'in_progress' | 'no_show') {
    setBusy(true); setError('');
    try {
      const { error: actionError } = await supabase.rpc('update_assigned_appointment', { target_appointment_id: appointment.id, next_status: nextStatus, note: null });
      if (actionError) throw actionError;
      refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No se pudo actualizar la cita. Revisa tu conexión.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.actions}>
      {appointment.status === 'confirmed' ? <ActionButton label="Iniciar" icon={Play} compact loading={busy} onPress={() => void updateStatus('in_progress')} /> : null}
      {['confirmed', 'in_progress'].includes(appointment.status) ? <>
        <ActionButton label="Enviar a caja" icon={CreditCard} compact tone="secondary" disabled={busy} onPress={() => setCheckoutOpen(true)} />
        <ActionButton label="No asistió" icon={UserRoundX} compact tone="danger" disabled={busy} onPress={() => Alert.alert('Marcar inasistencia', '¿Confirmas que el cliente no asistió?', [{ text: 'Volver', style: 'cancel' }, { text: 'Confirmar', style: 'destructive', onPress: () => void updateStatus('no_show') }])} />
      </> : null}
      {error ? <InlineMessage>{error}</InlineMessage> : null}
      <CheckoutModal visible={checkoutOpen} onClose={() => setCheckoutOpen(false)} appointment={appointment} services={services} products={products} onComplete={() => { setCheckoutOpen(false); refresh(); }} />
    </View>
  );
}

function CheckoutModal({ visible, onClose, appointment, services, products, onComplete }: { visible: boolean; onClose: () => void; appointment: Appointment; services: Service[]; products: Product[]; onComplete: () => void }) {
  const insets = useSafeAreaInsets();
  const [serviceId, setServiceId] = useState(appointment.service_id);
  const [extraServiceId, setExtraServiceId] = useState('');
  const [productId, setProductId] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit() {
    setBusy(true); setError('');
    try {
      const { error: submitError } = await supabase.rpc('send_appointment_to_cashier', {
        target_appointment_id: appointment.id,
        actual_service: serviceId || null,
        extra_service: extraServiceId || null,
        suggested_product: productId || null,
        suggested_quantity: Math.max(1, Math.min(20, Number(quantity) || 1)),
        checkout_note: notes.trim() || null,
      });
      if (submitError) throw submitError;
      onComplete();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No se pudo enviar la atención a caja.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal transparent visible={visible} animationType="slide" onRequestClose={onClose} statusBarTranslucent navigationBarTranslucent>
      <View style={[styles.modalShade, { paddingTop: insets.top, paddingBottom: insets.bottom, paddingLeft: insets.left, paddingRight: insets.right }]}>
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>Enviar atención a caja</Text>
          <Text style={styles.muted}>Confirma el servicio, extras y productos aplicados.</Text>
          <ChoiceField label="Servicio realizado" value={serviceId} options={services.map((item) => ({ value: item.id, label: `${item.name} · Bs ${item.price}` }))} onChange={setServiceId} />
          <ChoiceField label="Servicio extra" value={extraServiceId} emptyLabel="Sin servicio extra" options={services.map((item) => ({ value: item.id, label: `${item.name} · Bs ${item.price}` }))} onChange={setExtraServiceId} />
          <ChoiceField label="Producto" value={productId} emptyLabel="Sin producto" options={products.map((item) => ({ value: item.id, label: `${item.name} · stock ${item.stock}` }))} onChange={setProductId} />
          <Text style={styles.fieldLabel}>Cantidad de producto</Text>
          <TextInput value={quantity} onChangeText={(value) => setQuantity(value.replace(/[^0-9]/g, '').slice(0, 2))} keyboardType="number-pad" style={styles.notesInput} />
          <Text style={styles.fieldLabel}>Nota para caja (opcional)</Text>
          <TextInput value={notes} onChangeText={setNotes} placeholder="Detalle de extras o cambios" placeholderTextColor="#9AA2AC" style={[styles.notesInput, styles.multiline]} multiline />
          {error ? <InlineMessage>{error}</InlineMessage> : null}
          <ActionButton label="Confirmar y enviar" icon={Check} loading={busy} onPress={() => void submit()} />
          <ActionButton label="Volver" onPress={onClose} tone="secondary" />
        </View>
      </View>
    </Modal>
  );
}

function ChoiceField({ label, value, options, emptyLabel, onChange }: { label: string; value: string; options: Array<{ value: string; label: string }>; emptyLabel?: string; onChange: (value: string) => void }) {
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const current = options.find((option) => option.value === value)?.label ?? emptyLabel ?? 'Selecciona';
  return (
    <>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Pressable style={styles.choice} onPress={() => setOpen(true)}><Text numberOfLines={2} style={styles.choiceText}>{current}</Text><ChevronDown size={17} color={palette.gold} /></Pressable>
      <Modal transparent visible={open} animationType="fade" onRequestClose={() => setOpen(false)} statusBarTranslucent navigationBarTranslucent>
        <View style={[styles.modalShade, { paddingTop: 18 + insets.top, paddingBottom: 18 + insets.bottom, paddingLeft: 18 + insets.left, paddingRight: 18 + insets.right }]}><View style={styles.optionsCard}><Text style={styles.modalTitle}>{label}</Text><ScrollView style={{ maxHeight: 360 }}>
          {emptyLabel ? <Pressable onPress={() => { onChange(''); setOpen(false); }} style={styles.option}><Text style={styles.choiceText}>{emptyLabel}</Text></Pressable> : null}
          {options.map((option) => <Pressable key={option.value} onPress={() => { onChange(option.value); setOpen(false); }} style={styles.option}><Text style={styles.choiceText}>{option.label}</Text></Pressable>)}
        </ScrollView><ActionButton label="Cerrar" onPress={() => setOpen(false)} tone="secondary" compact /></View></View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  agendaContent: { paddingHorizontal: 16, paddingTop: 22, paddingBottom: 24, gap: 15 },
  weekHeading: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, paddingHorizontal: 2 },
  weekHeadingCopy: { gap: 3 },
  weekEyebrow: { fontSize: 9, fontWeight: '900', letterSpacing: 1.5 },
  weekTitle: { fontSize: 21, lineHeight: 26, fontWeight: '800' },
  weekCaption: { fontSize: 11, fontWeight: '700', paddingBottom: 3 },
  weekCalendar: { gap: 8, paddingHorizontal: 1, paddingVertical: 2 },
  weekDay: { width: 48, minHeight: 78, alignItems: 'center', justifyContent: 'center', gap: 4, borderWidth: 1, borderRadius: 15, paddingVertical: 7 },
  weekDayName: { fontSize: 9, lineHeight: 12, fontWeight: '800', textTransform: 'uppercase' },
  weekDayNumber: { fontSize: 17, lineHeight: 20, fontWeight: '900' },
  weekDayCount: { minWidth: 18, height: 18, alignItems: 'center', justifyContent: 'center', borderRadius: 99, paddingHorizontal: 4 },
  weekDayCountText: { fontSize: 9, lineHeight: 12, fontWeight: '800' },
  appointment: { gap: 10, paddingVertical: 14, borderTopColor: palette.border, borderTopWidth: StyleSheet.hairlineWidth },
  appointmentTime: { alignSelf: 'flex-start', borderRadius: 9, backgroundColor: '#20242A', paddingHorizontal: 9, paddingVertical: 6 },
  time: { color: palette.gold, fontSize: 11, fontWeight: '900' },
  appointmentCopy: { gap: 5 },
  clientName: { color: palette.text, fontSize: 14, fontWeight: '800' },
  muted: { color: palette.muted, fontSize: 11, lineHeight: 16 },
  phone: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 3 },
  warning: { color: '#D7DDE5', fontSize: 11, fontWeight: '700' },
  actions: { gap: 7, marginTop: 4 },
  inCash: { alignSelf: 'flex-start', color: palette.green, fontWeight: '800', fontSize: 11 },
  dayGroup: { gap: 5, borderTopColor: palette.border, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 12 },
  dayTitle: { color: palette.gold, fontSize: 13, fontWeight: '800', textTransform: 'capitalize' },
  weekItem: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 8 },
  modalShade: { flex: 1, justifyContent: 'flex-end', backgroundColor: '#000000b8' },
  modalCard: { maxHeight: '92%', backgroundColor: palette.background, borderColor: palette.border, borderWidth: 1, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, gap: 12 },
  optionsCard: { maxHeight: '75%', margin: 18, backgroundColor: palette.surface, borderColor: palette.border, borderWidth: 1, borderRadius: 20, padding: 17, gap: 10 },
  modalTitle: { color: palette.text, fontSize: 19, fontWeight: '800' },
  fieldLabel: { color: palette.text, fontSize: 11, fontWeight: '800', marginTop: 4 },
  choice: { minHeight: 47, borderColor: palette.border, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, backgroundColor: '#121519' },
  choiceText: { color: palette.text, fontSize: 12, flex: 1 },
  option: { minHeight: 44, borderBottomColor: palette.border, borderBottomWidth: StyleSheet.hairlineWidth, justifyContent: 'center', paddingHorizontal: 6 },
  notesInput: { minHeight: 46, backgroundColor: '#121519', color: palette.text, borderColor: palette.border, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12 },
  multiline: { minHeight: 72, textAlignVertical: 'top', paddingTop: 10 },
});
