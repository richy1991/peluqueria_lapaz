import { useState } from 'react';
import { router } from 'expo-router';
import { Alert, Image, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { Bell, CalendarDays, Check, ChevronRight, Gift, Globe2, Images, Scissors, Star, X } from 'lucide-react-native';

import { AppShell } from '@/components/AppShell';
import { BusinessStatusPill, type BusinessHour } from '@/components/BusinessStatusPill';
import { ActionButton, Card, CardTitle, EmptyState, InlineMessage, PageHeading, StatCard, palette } from '@/components/ui';
import { clientTabs } from '@/lib/navigation';
import { publicPage } from '@/lib/links';
import { useSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';
import { formatDate, publicMediaUrl, requireData, useRemoteData } from '@/lib/utils';

type Appointment = {
  id: string; starts_at: string; status: string; price_snapshot: number; service_name_snapshot: string;
  barber_name_snapshot: string | null; barber_profiles: { display_name?: string } | null;
};
type WorkItem = { id: string; title: string; image_path: string; barber_profiles: { display_name?: string } | null };
type HomeData = {
  name: string; points: number; referralCode: string | null; appointment: Appointment | null;
  timezone: string; businessStatus: string; statusMessage: string; hours: BusinessHour[];
  works: WorkItem[]; notifications: number;
};

export default function ClientHomeScreen() {
  const { session } = useSession();
  const [actionMessage, setActionMessage] = useState('');
  const userId = session?.user.id ?? '';
  const query = useRemoteData<HomeData>(async () => {
    if (!userId) throw new Error('Inicia sesión para ver tu cuenta.');
    await supabase.rpc('refresh_my_barber_loyalty');
    const now = new Date().toISOString();
    const [profileResult, appointmentResult, pointsResult, settingsResult, hoursResult, galleryResult, notificationsResult] = await Promise.all([
      supabase.from('profiles').select('full_name,referral_code').eq('id', userId).maybeSingle(),
      supabase.from('appointments').select('id,starts_at,status,price_snapshot,service_name_snapshot,barber_name_snapshot,barber_profiles(display_name)')
        .eq('client_id', userId).gte('starts_at', now)
        .in('status', ['requested', 'confirmed', 'in_progress', 'pending_payment', 'pending_client_confirmation', 'needs_reschedule'])
        .order('starts_at').limit(1).maybeSingle(),
      supabase.from('customer_barber_loyalty_accounts').select('balance').eq('user_id', userId),
      supabase.from('business_settings').select('timezone,business_status,status_message').eq('id', true).maybeSingle(),
      supabase.from('business_hours').select('weekday,opens_at,closes_at,afternoon_opens_at,afternoon_closes_at,active').order('weekday'),
      supabase.from('gallery_posts').select('id,title,image_path,barber_profiles(display_name)').eq('status', 'published').order('featured', { ascending: false }).order('sort_order').limit(3),
      supabase.from('notifications').select('id', { count: 'exact', head: true }).eq('user_id', userId).is('read_at', null),
    ]);
    if (profileResult.error) throw new Error(profileResult.error.message);
    if (appointmentResult.error) throw new Error(appointmentResult.error.message);
    const profile = profileResult.data;
    const appointment = appointmentResult.data;
    const balances = requireData(pointsResult);
    const gallery = requireData(galleryResult);
    if (settingsResult.error) throw new Error(settingsResult.error.message);
    if (hoursResult.error) throw new Error(hoursResult.error.message);
    if (notificationsResult.error) throw new Error(notificationsResult.error.message);
    return {
      name: profile?.full_name?.trim() || session?.user.email?.split('@')[0] || 'Cliente',
      points: balances.reduce((total, item) => total + Number(item.balance ?? 0), 0),
      referralCode: profile?.referral_code ?? null,
      appointment: appointment as Appointment | null,
      timezone: settingsResult.data?.timezone ?? 'America/La_Paz',
      businessStatus: settingsResult.data?.business_status ?? 'open',
      statusMessage: settingsResult.data?.status_message ?? '',
      hours: (hoursResult.data ?? []) as BusinessHour[],
      works: gallery as WorkItem[],
      notifications: notificationsResult.count ?? 0,
    };
  }, userId);

  async function appointmentAction(id: string, action: 'cancel' | 'confirm') {
    setActionMessage('');
    const { error } = await supabase.rpc(action === 'cancel' ? 'cancel_own_appointment' : 'confirm_reassigned_appointment', { target_appointment_id: id });
    if (error) { setActionMessage(error.message); return; }
    setActionMessage(action === 'cancel' ? 'La cita fue cancelada.' : 'Confirmaste el nuevo horario.');
    query.refresh();
  }

  const appointment = query.data?.appointment;
  const barberName = appointment?.barber_profiles?.display_name ?? appointment?.barber_name_snapshot ?? 'Peluquero por asignar';
  const appointmentStatus = appointment?.status === 'pending_client_confirmation' ? 'Confirma el cambio de horario'
    : appointment?.status === 'requested' ? 'Solicitud enviada'
      : appointment?.status === 'pending_payment' ? 'Pendiente de pago'
        : appointment?.status === 'needs_reschedule' ? 'Tu cita requiere reprogramación'
        : appointment?.status === 'in_progress' ? 'Atención en curso' : 'Cita confirmada';

  return (
    <AppShell title="Inicio" roleLabel="MODO CLIENTE" activeTab="inicio" tabs={clientTabs} onRefresh={query.refresh} refreshing={query.loading}>
      <PageHeading eyebrow="Tu cuenta" title={`Hola, ${query.data?.name ?? 'bienvenido'}`} description="Tu próxima visita, tus beneficios y tu estilo en un solo lugar." />
      {query.data ? <BusinessStatusPill configuredStatus={query.data.businessStatus} statusMessage={query.data.statusMessage} timezone={query.data.timezone} hours={query.data.hours} /> : null}
      {query.error ? <InlineMessage>{query.error}</InlineMessage> : null}

      <View style={styles.stats}>
        <StatCard label="Puntos disponibles" value={String(query.data?.points ?? 0)} hint="Sumados entre tus peluqueros" />
        <StatCard label="Avisos sin leer" value={String(query.data?.notifications ?? 0)} hint="Novedades de tu cuenta" />
      </View>

      <Card>
        <CardTitle icon={CalendarDays} title="Mi próxima visita" subtitle={appointmentStatus} />
        {appointment ? (
          <View style={styles.appointmentDetails}>
            <View style={styles.appointmentTop}>
              <View style={{ flex: 1, gap: 5 }}>
                <Text style={styles.strong}>{appointment.service_name_snapshot}</Text>
                <Text style={styles.secondary}>{formatDate(appointment.starts_at, { timeZone: query.data?.timezone ?? 'America/La_Paz', dateStyle: 'full', timeStyle: 'short' })}</Text>
                <Text style={styles.secondary}>{barberName}</Text>
              </View>
              <Text style={styles.price}>Bs {Number(appointment.price_snapshot).toFixed(2)}</Text>
            </View>
            <View style={styles.buttonRow}>
              {appointment.status === 'pending_client_confirmation' ? <ActionButton label="Confirmar horario" icon={Check} compact onPress={() => Alert.alert('Confirmar horario', '¿Aceptas el nuevo horario de tu cita?', [{ text: 'Volver', style: 'cancel' }, { text: 'Confirmar', onPress: () => void appointmentAction(appointment.id, 'confirm') }])} /> : null}
              {['requested', 'confirmed', 'pending_client_confirmation'].includes(appointment.status) ? <ActionButton label="Cancelar cita" icon={X} tone="danger" compact onPress={() => Alert.alert('Cancelar cita', '¿Seguro que quieres cancelar esta cita?', [{ text: 'Volver', style: 'cancel' }, { text: 'Cancelar cita', style: 'destructive', onPress: () => void appointmentAction(appointment.id, 'cancel') }])} /> : null}
            </View>
          </View>
        ) : (
          <>
            <EmptyState title="Aún no tienes una cita próxima" description="Elige servicio, peluquero y horario." />
            <ActionButton label="Reservar una cita" icon={Scissors} onPress={() => router.push('/client/book-appointment')} />
          </>
        )}
        {actionMessage ? <InlineMessage tone={actionMessage.includes('cancelada') || actionMessage.includes('Confirmaste') ? 'success' : 'error'}>{actionMessage}</InlineMessage> : null}
      </Card>

      <Card>
        <CardTitle icon={Star} title="Tus puntos" subtitle={query.data?.referralCode ? `Código para recomendar: ${query.data.referralCode}` : 'Consulta los puntos que tienes con cada peluquero.'} />
        <ActionButton label="Ver puntos e historial" icon={Gift} tone="secondary" onPress={() => router.push('/client/points')} />
      </Card>

      <Card>
        <CardTitle icon={Bell} title="Notificaciones" subtitle="Revisa cambios de citas y novedades de tu cuenta." />
        <ActionButton label="Abrir centro de avisos" icon={ChevronRight} tone="secondary" onPress={() => router.push('/client/notifications')} />
      </Card>

      <Card>
        <CardTitle icon={Images} title="Trabajos del equipo" subtitle="Los estilos se mantienen sincronizados con el sitio público." />
        <View style={styles.galleryRow}>
          {query.data?.works.map((work) => {
            const uri = publicMediaUrl(work.image_path);
            return (
              <View key={work.id} style={styles.workTile}>
                {uri ? <Image source={{ uri }} alt={work.title} style={styles.workImage} /> : <View style={styles.workPlaceholder}><Scissors size={22} color={palette.gold} /></View>}
                <Text numberOfLines={1} style={styles.workTitle}>{work.title}</Text>
              </View>
            );
          })}
        </View>
        <ActionButton label="Ver galería" icon={Images} tone="secondary" onPress={() => router.push('/client/gallery')} />
      </Card>

      <Card>
        <CardTitle icon={Globe2} title="Sitio y horarios" subtitle="Abre la página pública existente para ver información actualizada del local." />
        <ActionButton label="Ver sitio público" icon={Globe2} onPress={() => void Linking.openURL(publicPage())} />
        <Pressable style={styles.extraLink} onPress={() => router.push('/client/gallery')}><Images size={16} color={palette.gold} /><Text style={styles.secondary}>Ver galería del equipo</Text><ChevronRight size={15} color={palette.muted} /></Pressable>
      </Card>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  stats: { flexDirection: 'row', gap: 10 },
  appointmentDetails: { gap: 15 },
  appointmentTop: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  strong: { color: palette.text, fontWeight: '800', fontSize: 16 },
  secondary: { color: palette.muted, fontSize: 12, lineHeight: 18 },
  price: { color: palette.gold, fontSize: 14, fontWeight: '800' },
  buttonRow: { gap: 8 },
  galleryRow: { flexDirection: 'row', gap: 9 },
  workTile: { flex: 1, gap: 6 },
  workImage: { width: '100%', height: 104, borderRadius: 12, backgroundColor: palette.surfaceRaised },
  workPlaceholder: { height: 104, borderRadius: 12, backgroundColor: palette.surfaceRaised, alignItems: 'center', justifyContent: 'center' },
  workTitle: { color: palette.text, fontSize: 11, fontWeight: '700' },
  extraLink: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 5 },
});
