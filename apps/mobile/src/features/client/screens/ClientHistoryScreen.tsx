import { StyleSheet, View } from 'react-native';
import { ThemedText as Text } from '@/components/ThemedText';
import { router } from 'expo-router';
import { ArrowLeft, CalendarDays, PackageCheck, Scissors } from 'lucide-react-native';

import { AppShell } from '@/components/AppShell';
import { ClientPageHeader, useClientHeaderHeight } from '@/components/ClientPageHeader';
import { ActionButton, Card, CardTitle, EmptyState, InlineMessage, LoadingState } from '@/components/ui';
import { useAppearance, type AppColors } from '@/lib/appearance';
import { clientTabs } from '@/lib/navigation';
import { useSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';
import { formatDate, formatMoney, useRemoteData } from '@/lib/utils';

const pageSize = 500;

type AppointmentHistory = {
  id: string;
  starts_at: string;
  status: string;
  price_snapshot: number;
  service_name_snapshot: string;
  barber_name_snapshot: string | null;
  barber_profiles: { display_name?: string }[] | null;
};
type SaleItem = { id: string; item_type: string; name_snapshot: string; quantity: number; unit_price_snapshot: number };
type ServiceSale = { id: string; status: string; created_at: string; sale_items: SaleItem[] };
type ProductReservation = {
  id: string;
  quantity: number;
  price_snapshot: number;
  status: string;
  created_at: string;
  expires_at: string;
  products: { name?: string }[] | null;
};
type HistoryData = { appointments: AppointmentHistory[]; services: ServiceSale[]; reservations: ProductReservation[]; timezone: string; loadedAt: number };
type PageResult<T> = { data: T[] | null; error: { message: string } | null };

export default function ClientHistoryScreen() {
  const { session } = useSession();
  const { colors } = useAppearance();
  const headerHeight = useClientHeaderHeight(226);
  const userId = session?.user.id ?? '';
  const query = useRemoteData<HistoryData>(async () => {
    if (!userId) throw new Error('Inicia sesión para consultar tu historial.');

    const [appointments, services, reservations, settingsResult] = await Promise.all([
      loadAllPages<AppointmentHistory>(async (from, to) => await supabase.from('appointments')
        .select('id,starts_at,status,price_snapshot,service_name_snapshot,barber_name_snapshot,barber_profiles!appointments_barber_id_fkey(display_name)')
        .eq('client_id', userId).order('starts_at', { ascending: false }).order('id', { ascending: false }).range(from, to)),
      loadAllPages<ServiceSale>(async (from, to) => await supabase.from('sales')
        .select('id,status,created_at,sale_items(id,item_type,name_snapshot,quantity,unit_price_snapshot)')
        .eq('client_id', userId).order('created_at', { ascending: false }).order('id', { ascending: false }).range(from, to)),
      loadAllPages<ProductReservation>(async (from, to) => await supabase.from('product_reservations')
        .select('id,quantity,price_snapshot,status,created_at,expires_at,products(name)')
        .eq('client_id', userId).order('created_at', { ascending: false }).order('id', { ascending: false }).range(from, to)),
      supabase.from('business_settings').select('timezone').eq('id', true).maybeSingle(),
    ]);
    if (settingsResult.error) throw new Error(settingsResult.error.message);
    return { appointments, services, reservations, timezone: settingsResult.data?.timezone ?? 'America/La_Paz', loadedAt: Date.now() };
  }, userId);
  const data = query.data;
  const serviceHistory = (data?.services ?? []).flatMap((sale) => sale.sale_items.filter((item) => item.item_type === 'service').map((item) => ({ sale, item })));

  return (
    <AppShell title="Historial" roleLabel="ACTIVIDAD DE LA CUENTA" activeTab="perfil" tabs={clientTabs} onRefresh={query.refresh} refreshing={query.loading}
      floatingHeaderHeight={headerHeight}
      floatingHeader={(scrollY) => <ClientPageHeader scrollY={scrollY} expandedHeight={headerHeight} eyebrow="ACTIVIDAD DE LA CUENTA" title="Mi historial" description="Consulta tus citas, servicios y apartados, incluso los que fueron cancelados." />}>
      <View style={styles.pageBody}>
        <ActionButton label="Volver al perfil" icon={ArrowLeft} tone="quiet" compact onPress={() => router.back()} />
        {query.error ? <InlineMessage>{query.error}</InlineMessage> : null}
        {!query.data && query.loading ? <LoadingState title="Cargando tu historial…" /> : null}
        {data ? <>
          <Card enteringDelay={100}>
            <CardTitle icon={CalendarDays} title="Citas" subtitle="Reservas de servicios y su estado." />
            {data.appointments.length ? data.appointments.map((appointment) => (
              <View key={appointment.id} style={[styles.historyRow, { borderTopColor: colors.border }]}>
                <View style={styles.rowHeading}>
                  <Text style={[styles.rowTitle, { color: colors.text }]}>{appointment.service_name_snapshot}</Text>
                  <StatusBadge status={appointment.status} colors={colors} />
                </View>
                <Text style={[styles.muted, { color: colors.muted }]}>{formatDate(appointment.starts_at, { dateStyle: 'full', timeStyle: 'short', timeZone: data.timezone })}</Text>
                <View style={styles.rowFooter}>
                  <Text style={[styles.muted, { color: colors.muted }]}>{appointment.barber_profiles?.[0]?.display_name ?? appointment.barber_name_snapshot ?? 'Peluquero'}</Text>
                  <Text style={[styles.amount, { color: colors.accent }]}>{formatMoney(appointment.price_snapshot)}</Text>
                </View>
              </View>
            )) : <EmptyState title="Aún no tienes citas" description="Cuando reserves un servicio aparecerá aquí, aunque luego se cancele." />}
          </Card>

          <Card enteringDelay={190}>
            <CardTitle icon={Scissors} title="Servicios cobrados" subtitle="Servicios registrados en caja." />
            {serviceHistory.length ? serviceHistory.map(({ sale, item }) => (
              <View key={`${sale.id}:${item.id}`} style={[styles.historyRow, { borderTopColor: colors.border }]}>
                <View style={styles.rowHeading}>
                  <Text style={[styles.rowTitle, { color: colors.text }]}>{item.name_snapshot}{item.quantity > 1 ? ` ×${item.quantity}` : ''}</Text>
                  <StatusBadge status={sale.status} colors={colors} />
                </View>
                <View style={styles.rowFooter}>
                  <Text style={[styles.muted, { color: colors.muted }]}>{formatDate(sale.created_at, { dateStyle: 'medium', timeZone: data.timezone })}</Text>
                  <Text style={[styles.amount, { color: colors.accent }]}>{formatMoney(Number(item.unit_price_snapshot) * item.quantity)}</Text>
                </View>
              </View>
            )) : <EmptyState title="Aún no tienes servicios cobrados" />}
          </Card>

          <Card enteringDelay={280}>
            <CardTitle icon={PackageCheck} title="Apartados de productos" subtitle="Incluye productos retirados, vencidos y cancelados." />
            {data.reservations.length ? data.reservations.map((reservation) => (
              <View key={reservation.id} style={[styles.historyRow, { borderTopColor: colors.border }]}>
                <View style={styles.rowHeading}>
                  <Text style={[styles.rowTitle, { color: colors.text }]}>{reservation.products?.[0]?.name ?? 'Producto'}{reservation.quantity > 1 ? ` ×${reservation.quantity}` : ''}</Text>
                  <StatusBadge status={reservation.status === 'reserved' && Date.parse(reservation.expires_at) <= data.loadedAt ? 'expired' : reservation.status} colors={colors} />
                </View>
                <View style={styles.rowFooter}>
                  <Text style={[styles.muted, { color: colors.muted }]}>{formatDate(reservation.created_at, { dateStyle: 'medium', timeZone: data.timezone })}</Text>
                  <Text style={[styles.amount, { color: colors.accent }]}>{formatMoney(Number(reservation.price_snapshot) * reservation.quantity)}</Text>
                </View>
              </View>
            )) : <EmptyState title="Aún no tienes apartados" />}
          </Card>
        </> : null}
      </View>
    </AppShell>
  );
}

async function loadAllPages<T>(loadPage: (from: number, to: number) => Promise<PageResult<T>>) {
  const rows: T[] = [];
  for (let from = 0; ; from += pageSize) {
    const result = await loadPage(from, from + pageSize - 1);
    if (result.error) throw new Error(result.error.message);
    const page = result.data ?? [];
    rows.push(...page);
    if (page.length < pageSize) return rows;
  }
}

function StatusBadge({ status, colors }: { status: string; colors: AppColors }) {
  const label = statusLabel(status);
  const foreground = ['completed', 'paid', 'collected', 'confirmed'].includes(status) ? colors.success : ['canceled', 'no_show', 'refunded', 'expired'].includes(status) ? colors.danger : colors.accent;
  const background = ['completed', 'paid', 'collected', 'confirmed'].includes(status) ? colors.successSoft : ['canceled', 'no_show', 'refunded', 'expired'].includes(status) ? colors.dangerSoft : colors.accentSoft;
  return <View style={[styles.statusBadge, { backgroundColor: background }]}><Text style={[styles.statusText, { color: foreground }]}>{label}</Text></View>;
}

function statusLabel(status: string) {
  return ({
    requested: 'Solicitada', confirmed: 'Confirmada', in_progress: 'En curso', pending_payment: 'En caja',
    pending_client_confirmation: 'Confirma cambio', needs_reschedule: 'Reprogramar', completed: 'Completada',
    canceled: 'Cancelada', no_show: 'Inasistencia', paid: 'Pagado', refunded: 'Reembolsado',
    reserved: 'Apartado', collected: 'Retirado', expired: 'Vencido', draft: 'En proceso',
  } as Record<string, string>)[status] ?? status;
}

const styles = StyleSheet.create({
  pageBody: { paddingHorizontal: 16, paddingTop: 16, gap: 13 },
  historyRow: { gap: 8, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 12 },
  rowHeading: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 },
  rowTitle: { flex: 1, fontSize: 13, lineHeight: 18, fontWeight: '800' },
  muted: { fontSize: 11, lineHeight: 16 },
  rowFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  amount: { fontSize: 12, fontWeight: '900' },
  statusBadge: { maxWidth: 126, paddingHorizontal: 8, paddingVertical: 5, borderRadius: 999 },
  statusText: { fontSize: 9, lineHeight: 12, fontWeight: '800' },
});
