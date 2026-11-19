import { useEffect, useState } from 'react';
import { router } from 'expo-router';
import { Alert, Image, Linking, Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeInRight, FadeOutLeft } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ThemedText as Text } from '@/components/ThemedText';
import { CalendarDays, Check, ChevronLeft, ChevronRight, Scissors, X } from 'lucide-react-native';

import { AppShell } from '@/components/AppShell';
import { BusinessStatusPill, type BusinessHour } from '@/components/BusinessStatusPill';
import { ActionButton, Card, CardTitle, EmptyState, InlineMessage, palette } from '@/components/ui';
import { ClientPageHeader, useClientHeaderHeight } from '@/components/ClientPageHeader';
import { clientTabs } from '@/lib/navigation';
import { publicPage } from '@/lib/links';
import { useSession } from '@/lib/session';
import { useAppearance } from '@/lib/appearance';
import { supabase } from '@/lib/supabase';
import { formatDate, publicMediaUrl, requireData, useRemoteData } from '@/lib/utils';

type Appointment = {
  id: string; starts_at: string; status: string; price_snapshot: number; service_name_snapshot: string;
  barber_name_snapshot: string | null; barber: { display_name?: string } | null;
};
type WorkItem = { id: string; title: string; image_path: string };
type HomeData = {
  name: string; appointment: Appointment | null;
  timezone: string; businessStatus: string; statusMessage: string; hours: BusinessHour[];
  works: WorkItem[];
};

export default function ClientHomeScreen() {
  const { session } = useSession();
  const { colors } = useAppearance();
  const insets = useSafeAreaInsets();
  const expandedHeaderHeight = useClientHeaderHeight(227);
  const [actionMessage, setActionMessage] = useState('');
  const [actionBusy, setActionBusy] = useState(false);
  const userId = session?.user.id ?? '';
  const query = useRemoteData<HomeData>(async () => {
    if (!userId) throw new Error('Inicia sesiÃ³n para ver tu cuenta.');
    const now = new Date().toISOString();
    const [profileResult, appointmentResult, settingsResult, hoursResult, galleryResult] = await Promise.all([
      supabase.from('profiles').select('full_name').eq('id', userId).maybeSingle(),
      supabase.from('appointments').select('id,starts_at,status,price_snapshot,service_name_snapshot,barber_name_snapshot,barber:barber_profiles!appointments_barber_id_fkey(display_name)')
        .eq('client_id', userId).gte('starts_at', now)
        .in('status', ['requested', 'confirmed', 'in_progress', 'pending_payment', 'pending_client_confirmation', 'needs_reschedule'])
        .order('starts_at').limit(1).maybeSingle(),
      supabase.from('business_settings').select('timezone,business_status,status_message').eq('id', true).maybeSingle(),
      supabase.from('business_hours').select('weekday,opens_at,closes_at,afternoon_opens_at,afternoon_closes_at,active').order('weekday'),
      supabase.from('gallery_posts').select('id,title,image_path').eq('status', 'published').order('featured', { ascending: false }).order('sort_order').limit(6),
    ]);
    if (profileResult.error) throw new Error(profileResult.error.message);
    if (appointmentResult.error) throw new Error(appointmentResult.error.message);
    if (settingsResult.error) throw new Error(settingsResult.error.message);
    if (hoursResult.error) throw new Error(hoursResult.error.message);
    const profile = profileResult.data;
    return {
      name: profile?.full_name?.trim() || session?.user.email?.split('@')[0] || 'bienvenido',
      appointment: appointmentResult.data as Appointment | null,
      timezone: settingsResult.data?.timezone ?? 'America/La_Paz',
      businessStatus: settingsResult.data?.business_status ?? 'open',
      statusMessage: settingsResult.data?.status_message ?? '',
      hours: (hoursResult.data ?? []) as BusinessHour[],
      works: requireData(galleryResult) as WorkItem[],
    };
  }, userId);

  async function appointmentAction(id: string, action: 'cancel' | 'confirm') {
    setActionMessage('');
    setActionBusy(true);
    try {
      const { error } = await supabase.rpc(action === 'cancel' ? 'cancel_own_appointment' : 'confirm_reassigned_appointment', { target_appointment_id: id });
      if (error) throw error;
      setActionMessage(action === 'cancel' ? 'La cita fue cancelada.' : 'Confirmaste el nuevo horario.');
      query.refresh();
    } catch (reason) {
      setActionMessage(reason instanceof Error ? reason.message : 'No se pudo actualizar la cita. IntÃ©ntalo de nuevo.');
    } finally {
      setActionBusy(false);
    }
  }

  const data = query.data;
  const appointment = data?.appointment;
  const barberName = appointment?.barber?.display_name ?? appointment?.barber_name_snapshot ?? 'Peluquero por asignar';
  const appointmentStatus = appointment?.status === 'pending_client_confirmation' ? 'Confirma el cambio de horario'
    : appointment?.status === 'requested' ? 'Solicitud enviada'
      : appointment?.status === 'pending_payment' ? 'Pendiente de pago'
        : appointment?.status === 'needs_reschedule' ? 'Tu cita requiere reprogramaciÃ³n'
          : appointment?.status === 'in_progress' ? 'AtenciÃ³n en curso' : 'Cita confirmada';

  return (
    <AppShell
      title="Inicio"
      roleLabel="CUENTA PERSONAL"
      activeTab="inicio"
      tabs={clientTabs}
      onRefresh={query.refresh}
      refreshing={query.loading}
      floatingHeaderHeight={expandedHeaderHeight}
      floatingHeader={(scrollY) => <ClientPageHeader
        scrollY={scrollY}
        expandedHeight={expandedHeaderHeight}
        title={`Hola, ${data?.name ?? 'bienvenido'}`}
        description="Tu próxima visita, tu estilo y el equipo en un solo lugar."
        titleSize={38}
        titleLineHeight={43}
        expandedContentHeight={142}
        descriptionFontSize={15}
        descriptionLineHeight={22}
        brandAccessory={data ? <BusinessStatusPill configuredStatus={data.businessStatus} statusMessage={data.statusMessage} timezone={data.timezone} hours={data.hours} /> : undefined}
        actionLabel="Ver sitio público"
        onActionPress={() => void Linking.openURL(publicPage())}
      />}>
      <View style={[styles.homeSections, { paddingBottom: insets.bottom + 118 }]}>
        {query.error ? <InlineMessage>{query.error}</InlineMessage> : null}
        {data ? <>
          <Card enteringDelay={100}>
            <CardTitle icon={CalendarDays} title="Mi próxima visita" subtitle={appointmentStatus} />
            {appointment ? (
              <View style={styles.appointmentDetails}>
                <View style={styles.appointmentTop}>
                  <View style={{ flex: 1, gap: 5 }}>
                    <Text style={[styles.strong, { color: colors.text }]}>{appointment.service_name_snapshot}</Text>
                    <Text style={[styles.secondary, { color: colors.muted }]}>{formatDate(appointment.starts_at, { timeZone: data.timezone, dateStyle: 'full', timeStyle: 'short' })}</Text>
                    <Text style={[styles.secondary, { color: colors.muted }]}>{barberName}</Text>
                  </View>
                  <Text style={[styles.price, { color: colors.accent }]}>Bs {Number(appointment.price_snapshot).toFixed(2)}</Text>
                </View>
                <View style={styles.buttonRow}>
                  {appointment.status === 'pending_client_confirmation' ? <ActionButton label="Confirmar horario" icon={Check} compact loading={actionBusy} onPress={() => Alert.alert('Confirmar horario', '¿Aceptas el nuevo horario de tu cita?', [{ text: 'Volver', style: 'cancel' }, { text: 'Confirmar', onPress: () => void appointmentAction(appointment.id, 'confirm') }])} /> : null}
                  {['requested', 'confirmed', 'pending_client_confirmation'].includes(appointment.status) ? <ActionButton label="Cancelar cita" icon={X} tone="danger" compact loading={actionBusy} onPress={() => Alert.alert('Cancelar cita', '¿Seguro que quieres cancelar esta cita?', [{ text: 'Volver', style: 'cancel' }, { text: 'Cancelar cita', style: 'destructive', onPress: () => void appointmentAction(appointment.id, 'cancel') }])} /> : null}
                </View>
              </View>
            ) : (
              <>
                <Text style={[styles.emptyAppointmentText, { color: colors.muted }]}>Agenda tu próximo corte y lo verás aquí.</Text>
                <ActionButton label="Reservar cita" icon={Scissors} onPress={() => router.push('/client/book-appointment')} />
              </>
            )}
            {actionMessage ? <InlineMessage tone={actionMessage.includes('cancelada') || actionMessage.includes('Confirmaste') ? 'success' : 'error'}>{actionMessage}</InlineMessage> : null}
          </Card>

          <Card enteringDelay={190}>
            <View style={styles.workHeading}>
              <View style={styles.workHeadingCopy}>
                <Text style={[styles.workEyebrow, { color: colors.muted }]}>INSPIRACIÓN LEGEND</Text>
                <Text style={[styles.workTitle, { color: colors.text }]}>Trabajos con firma propia</Text>
              </View>
              <Pressable onPress={() => router.push('/client/gallery')} accessibilityRole="button">
                <Text style={[styles.galleryLink, { color: colors.accent }]}>Ver galería</Text>
              </Pressable>
            </View>
            <WorkCarousel items={data.works} onOpen={() => router.push('/client/gallery')} />
          </Card>
        </> : null}
      </View>
    </AppShell>
  );
}

function WorkCarousel({ items, onOpen }: { items: WorkItem[]; onOpen: () => void }) {
  const { colors } = useAppearance();
  const slides = items.slice(0, 6);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    if (slides.length < 2) return;
    const timer = setTimeout(() => setActiveIndex((current) => (current + 1) % slides.length), 5000);
    return () => clearTimeout(timer);
  }, [activeIndex, slides.length]);

  if (!slides.length) return <EmptyState title="Pronto compartiremos nuevos trabajos del equipo." />;

  const work = slides[activeIndex];
  const uri = publicMediaUrl(work.image_path);
  const move = (direction: number) => setActiveIndex((current) => (current + direction + slides.length) % slides.length);

  return (
    <View accessibilityLabel="Carrusel de trabajos del equipo">
      <View style={styles.carouselViewport}>
        <Animated.View key={work.id} entering={FadeInRight.duration(420)} exiting={FadeOutLeft.duration(300)} style={StyleSheet.absoluteFill}>
          <Pressable onPress={onOpen} style={styles.slide} accessibilityRole="button" accessibilityLabel={`Ver trabajo: ${work.title}`}>
            {uri ? <Image source={{ uri }} style={StyleSheet.absoluteFill} resizeMode="cover" alt={work.title} /> : <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.raised }]} />}
            <View style={styles.slideShade} />
            <View style={styles.slideCopy}>
              <Text numberOfLines={2} style={styles.slideTitle}>{work.title}</Text>
              <Text style={styles.slideAction}>Ver trabajo <ChevronRight size={14} color="#fff" /></Text>
            </View>
          </Pressable>
        </Animated.View>
      </View>
      {slides.length > 1 ? <View style={styles.carouselControls}>
        <View style={styles.carouselDots}>
          {slides.map((slide, index) => <Pressable key={slide.id} onPress={() => setActiveIndex(index)} accessibilityRole="button" accessibilityLabel={`Mostrar trabajo ${index + 1}`} accessibilityState={{ selected: index === activeIndex }} style={[styles.carouselDot, { backgroundColor: index === activeIndex ? colors.accent : colors.glassBorder }]} />)}
        </View>
        <View style={styles.carouselArrows}>
          <Pressable onPress={() => move(-1)} style={[styles.carouselArrow, { borderColor: colors.glassBorder }]} accessibilityRole="button" accessibilityLabel="Trabajo anterior"><ChevronLeft size={17} color={colors.text} /></Pressable>
          <Pressable onPress={() => move(1)} style={[styles.carouselArrow, { borderColor: colors.glassBorder }]} accessibilityRole="button" accessibilityLabel="Trabajo siguiente"><ChevronRight size={17} color={colors.text} /></Pressable>
        </View>
      </View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  homeSections: { paddingHorizontal: 16, paddingTop: 16, gap: 13 },
  appointmentDetails: { gap: 15 },
  appointmentTop: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  strong: { fontWeight: '800', fontSize: 16 },
  secondary: { fontSize: 12, lineHeight: 18 },
  price: { fontSize: 14, fontWeight: '800' },
  buttonRow: { gap: 8 },
  emptyAppointmentText: { fontSize: 15, lineHeight: 22 },
  workHeading: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  workHeadingCopy: { flex: 1, gap: 4 },
  workEyebrow: { fontSize: 9, fontWeight: '800', letterSpacing: 1.2 },
  workTitle: { fontSize: 18, lineHeight: 23, fontWeight: '800' },
  galleryLink: { fontSize: 12, fontWeight: '800' },
  carouselViewport: { height: 225, overflow: 'hidden', borderRadius: 17, backgroundColor: palette.surfaceRaised },
  slide: { flex: 1, justifyContent: 'flex-end', overflow: 'hidden' },
  slideShade: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.20)' },
  slideCopy: { padding: 16, gap: 7 },
  slideTitle: { maxWidth: '88%', color: '#FFFFFF', fontSize: 19, lineHeight: 24, fontWeight: '900', textShadowColor: '#0009', textShadowRadius: 8 },
  slideAction: { flexDirection: 'row', alignItems: 'center', color: '#FFFFFF', fontSize: 11, fontWeight: '800' },
  carouselControls: { minHeight: 36, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  carouselDots: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 7 },
  carouselDot: { width: 7, height: 7, borderRadius: 99 },
  carouselArrows: { flexDirection: 'row', gap: 7 },
  carouselArrow: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderRadius: 11 },
});
