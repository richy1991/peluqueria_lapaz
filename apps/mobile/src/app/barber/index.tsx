import { useState } from 'react';
import { Alert, Linking, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Activity, CalendarDays, Check, ChevronDown, Clock3, CreditCard, History, Phone, Play, UserRoundX } from 'lucide-react-native';

import { AppShell } from '@/components/AppShell';
import { ActionButton, Card, CardTitle, EmptyState, InlineMessage, PageHeading, palette } from '@/components/ui';
import { barberTabs } from '@/lib/navigation';
import { useSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';
import { businessDayStart, formatDate, requireData, useRemoteData } from '@/lib/utils';

type Appointment = { id: string; service_id: string; starts_at: string; ends_at: string; status: string; service_name_snapshot: string; client_name_snapshot: string | null; notes: string | null; reference_image_path: string | null };
type BarberClient = { appointment_id: string; full_name: string | null; phone: string | null; is_blacklisted: boolean };
type Service = { id: string; name: string; price: number };
type Product = { id: string; name: string; price: number; stock: number };
type AgendaData = { appointments: Appointment[]; clients: BarberClient[]; services: Service[]; products: Product[]; timezone: string };

export default function BarberAgendaScreen() {
  const { barber } = useSession();
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
  const active = (data?.appointments ?? []).filter((item) => !['canceled', 'completed', 'no_show', 'needs_reschedule'].includes(item.status));
  const today = active.filter((item) => new Intl.DateTimeFormat('en-CA', { timeZone: data?.timezone ?? 'America/La_Paz', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(item.starts_at))
    === new Intl.DateTimeFormat('en-CA', { timeZone: data?.timezone ?? 'America/La_Paz', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()));
  const clientById = new Map((data?.clients ?? []).map((item) => [item.appointment_id, item]));
  const groups = active.reduce<Record<string, Appointment[]>>((result, appointment) => {
    const key = new Intl.DateTimeFormat('en-CA', { timeZone: data?.timezone ?? 'America/La_Paz', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(appointment.starts_at));
    (result[key] ??= []).push(appointment);
    return result;
  }, {});

  return (
    <AppShell title="Agenda" roleLabel={`PELUQUERO · ${barber?.display_name ?? ''}`} activeTab="agenda" tabs={barberTabs} onRefresh={query.refresh} refreshing={query.loading}>
      <PageHeading eyebrow="Operación diaria" title="Agenda del día" description="Consulta tus citas, actualiza su estado y envía atenciones terminadas a caja." />
      {query.error ? <InlineMessage>{query.error}</InlineMessage> : null}
      <View style={styles.stats}>
        <Card style={styles.stat}><CardTitle icon={Activity} title="Hoy" subtitle="Citas activas" /><Text style={styles.statValue}>{today.length}</Text></Card>
        <Card style={styles.stat}><CardTitle icon={Clock3} title="Próxima cita" subtitle="En los próximos siete días" /><Text style={styles.statDate}>{active[0] ? formatDate(active[0].starts_at, { timeZone: data?.timezone ?? 'America/La_Paz' }) : 'Sin citas'}</Text></Card>
      </View>

      <Card>
        <CardTitle icon={CalendarDays} title="Cola de clientes" subtitle={`${today.length} citas para hoy`} />
        {today.length ? today.map((appointment) => (
          <AppointmentCard key={appointment.id} appointment={appointment} client={clientById.get(appointment.id)} timezone={data?.timezone ?? 'America/La_Paz'} services={data?.services ?? []} products={data?.products ?? []} refresh={query.refresh} />
        )) : <EmptyState title="No hay citas activas para hoy" description="Las próximas reservas aparecerán aquí." />}
      </Card>

      <Card>
        <CardTitle icon={History} title="Agenda semanal" subtitle="Próximos siete días" />
        {Object.entries(groups).length ? Object.entries(groups).map(([key, appointments]) => (
          <View key={key} style={styles.dayGroup}>
            <Text style={styles.dayTitle}>{formatDate(appointments[0].starts_at, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: data?.timezone ?? 'America/La_Paz' })}</Text>
            {appointments.map((appointment) => {
              const client = clientById.get(appointment.id);
              return <View key={appointment.id} style={styles.weekItem}>
                <Text style={styles.time}>{formatDate(appointment.starts_at, { timeStyle: 'short', timeZone: data?.timezone ?? 'America/La_Paz' })}</Text>
                <View style={{ flex: 1, gap: 3 }}><Text style={styles.clientName}>{client?.full_name ?? appointment.client_name_snapshot ?? 'Cliente'}</Text><Text style={styles.muted}>{appointment.service_name_snapshot} · {statusLabel(appointment.status)}</Text>{client?.phone ? <Pressable onPress={() => void Linking.openURL('tel:' + client.phone)} style={styles.phone}><Phone size={13} color={palette.gold} /><Text style={styles.muted}>{client.phone}</Text></Pressable> : null}</View>
              </View>;
            })}
          </View>
        )) : <EmptyState title="No tienes citas próximas esta semana" />}
      </Card>
    </AppShell>
  );
}

function statusLabel(status: string) {
  return ({ requested: 'Solicitada', confirmed: 'Confirmada', in_progress: 'En atención', pending_payment: 'En caja', pending_client_confirmation: 'Cambio pendiente' } as Record<string, string>)[status] ?? status;
}

function AppointmentCard({ appointment, client, timezone, services, products, refresh }: { appointment: Appointment; client?: BarberClient; timezone: string; services: Service[]; products: Product[]; refresh: () => void }) {
  return (
    <View style={styles.appointment}>
      <View style={styles.appointmentTime}><Text style={styles.time}>{formatDate(appointment.starts_at, { timeStyle: 'short', timeZone: timezone })}</Text></View>
      <View style={styles.appointmentCopy}>
        <Text style={styles.clientName}>{client?.full_name ?? appointment.client_name_snapshot ?? 'Cliente'}</Text>
        <Text style={styles.muted}>{appointment.service_name_snapshot} · {statusLabel(appointment.status)}</Text>
        {client?.phone ? <Pressable onPress={() => void Linking.openURL(`tel:${client.phone}`)} style={styles.phone}><Phone size={13} color={palette.gold} /><Text style={styles.muted}>{client.phone}</Text></Pressable> : null}
        {client?.is_blacklisted ? <Text style={styles.warning}>Alerta por inasistencias</Text> : null}
        {appointment.notes ? <Text style={styles.muted}>Nota: {appointment.notes}</Text> : null}
      </View>
      <AppointmentActions appointment={appointment} services={services} products={products} refresh={refresh} />
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
    const { error: actionError } = await supabase.rpc('update_assigned_appointment', { target_appointment_id: appointment.id, next_status: nextStatus, note: null });
    setBusy(false);
    if (actionError) { setError(actionError.message); return; }
    refresh();
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
  const [serviceId, setServiceId] = useState(appointment.service_id);
  const [extraServiceId, setExtraServiceId] = useState('');
  const [productId, setProductId] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit() {
    setBusy(true); setError('');
    const { error: submitError } = await supabase.rpc('send_appointment_to_cashier', {
      target_appointment_id: appointment.id,
      actual_service: serviceId || null,
      extra_service: extraServiceId || null,
      suggested_product: productId || null,
      suggested_quantity: Math.max(1, Math.min(20, Number(quantity) || 1)),
      checkout_note: notes.trim() || null,
    });
    setBusy(false);
    if (submitError) { setError(submitError.message); return; }
    onComplete();
  }

  return (
    <Modal transparent visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalShade}>
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>Enviar atención a caja</Text>
          <Text style={styles.muted}>Confirma el servicio, extras y productos aplicados.</Text>
          <ChoiceField label="Servicio realizado" value={serviceId} options={services.map((item) => ({ value: item.id, label: `${item.name} · Bs ${item.price}` }))} onChange={setServiceId} />
          <ChoiceField label="Servicio extra" value={extraServiceId} emptyLabel="Sin servicio extra" options={services.map((item) => ({ value: item.id, label: `${item.name} · Bs ${item.price}` }))} onChange={setExtraServiceId} />
          <ChoiceField label="Producto" value={productId} emptyLabel="Sin producto" options={products.map((item) => ({ value: item.id, label: `${item.name} · stock ${item.stock}` }))} onChange={setProductId} />
          <Text style={styles.fieldLabel}>Cantidad de producto</Text>
          <TextInput value={quantity} onChangeText={(value) => setQuantity(value.replace(/[^0-9]/g, '').slice(0, 2))} keyboardType="number-pad" style={styles.notesInput} />
          <Text style={styles.fieldLabel}>Nota para caja (opcional)</Text>
          <TextInput value={notes} onChangeText={setNotes} placeholder="Detalle de extras o cambios" placeholderTextColor="#82776e" style={[styles.notesInput, styles.multiline]} multiline />
          {error ? <InlineMessage>{error}</InlineMessage> : null}
          <ActionButton label="Confirmar y enviar" icon={Check} loading={busy} onPress={() => void submit()} />
          <ActionButton label="Volver" onPress={onClose} tone="secondary" />
        </View>
      </View>
    </Modal>
  );
}

function ChoiceField({ label, value, options, emptyLabel, onChange }: { label: string; value: string; options: Array<{ value: string; label: string }>; emptyLabel?: string; onChange: (value: string) => void }) {
  const [open, setOpen] = useState(false);
  const current = options.find((option) => option.value === value)?.label ?? emptyLabel ?? 'Selecciona';
  return (
    <>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Pressable style={styles.choice} onPress={() => setOpen(true)}><Text numberOfLines={2} style={styles.choiceText}>{current}</Text><ChevronDown size={17} color={palette.gold} /></Pressable>
      <Modal transparent visible={open} animationType="fade" onRequestClose={() => setOpen(false)}>
        <View style={styles.modalShade}><View style={styles.optionsCard}><Text style={styles.modalTitle}>{label}</Text><ScrollView style={{ maxHeight: 360 }}>
          {emptyLabel ? <Pressable onPress={() => { onChange(''); setOpen(false); }} style={styles.option}><Text style={styles.choiceText}>{emptyLabel}</Text></Pressable> : null}
          {options.map((option) => <Pressable key={option.value} onPress={() => { onChange(option.value); setOpen(false); }} style={styles.option}><Text style={styles.choiceText}>{option.label}</Text></Pressable>)}
        </ScrollView><ActionButton label="Cerrar" onPress={() => setOpen(false)} tone="secondary" compact /></View></View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  stats: { flexDirection: 'row', gap: 10 },
  stat: { flex: 1, minWidth: 0, padding: 13 },
  statValue: { color: palette.gold, fontSize: 32, fontWeight: '900' },
  statDate: { color: palette.text, fontSize: 12, lineHeight: 18, fontWeight: '700' },
  appointment: { gap: 10, paddingVertical: 14, borderTopColor: palette.border, borderTopWidth: StyleSheet.hairlineWidth },
  appointmentTime: { alignSelf: 'flex-start', borderRadius: 9, backgroundColor: '#33281f', paddingHorizontal: 9, paddingVertical: 6 },
  time: { color: palette.gold, fontSize: 12, fontWeight: '900' },
  appointmentCopy: { gap: 5 },
  clientName: { color: palette.text, fontSize: 14, fontWeight: '800' },
  muted: { color: palette.muted, fontSize: 11, lineHeight: 16 },
  phone: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 3 },
  warning: { color: '#e6b25f', fontSize: 11, fontWeight: '700' },
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
  choice: { minHeight: 47, borderColor: palette.border, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, backgroundColor: '#191512' },
  choiceText: { color: palette.text, fontSize: 12, flex: 1 },
  option: { minHeight: 44, borderBottomColor: palette.border, borderBottomWidth: StyleSheet.hairlineWidth, justifyContent: 'center', paddingHorizontal: 6 },
  notesInput: { minHeight: 46, backgroundColor: '#191512', color: palette.text, borderColor: palette.border, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12 },
  multiline: { minHeight: 72, textAlignVertical: 'top', paddingTop: 10 },
});
