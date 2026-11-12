import { StyleSheet, Text, View } from 'react-native';
import { Banknote, History, Sparkles } from 'lucide-react-native';

import { AppShell } from '@/components/AppShell';
import { Card, CardTitle, EmptyState, InlineMessage, PageHeading, StatCard, palette } from '@/components/ui';
import { barberTabs } from '@/lib/navigation';
import { useSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';
import { businessMonthStart, formatDate, formatMoney, requireData, useRemoteData } from '@/lib/utils';

type Earning = { id: string; kind: string; base_amount: number; rate_percent: number; amount: number; status: string; created_at: string; sale_items: { name_snapshot?: string } | null };
type Payout = { id: string; period_start: string; period_end: string; commission_amount: number; incentive_amount: number; deduction_amount: number; total_amount: number; status: string; paid_at: string | null };
type Discount = { id: string; name_snapshot: string; eligible_base: number; discount_amount: number; barber_discount_share: number; business_discount_share: number; created_at: string };
type BalanceData = { earnings: Earning[]; monthEarnings: Earning[]; payouts: Payout[]; discounts: Discount[]; timezone: string };

export default function BarberBalanceScreen() {
  const { barber } = useSession();
  const barberId = barber?.id ?? '';
  const query = useRemoteData<BalanceData>(async () => {
    if (!barberId) throw new Error('No se encontró tu perfil de peluquero.');
    const settingsResult = await supabase.from('business_settings').select('timezone').eq('id', true).maybeSingle();
    if (settingsResult.error) throw new Error(settingsResult.error.message);
    const timezone = settingsResult.data?.timezone ?? 'America/La_Paz';
    const monthStart = businessMonthStart(timezone).toISOString();
    const [earningsResult, monthEarningsResult, payoutsResult, discountsResult] = await Promise.all([
      supabase.from('barber_earnings').select('id,kind,base_amount,rate_percent,amount,status,created_at,sale_items(name_snapshot)').eq('barber_id', barberId).order('created_at', { ascending: false }).limit(50),
      supabase.from('barber_earnings').select('id,kind,base_amount,rate_percent,amount,status,created_at').eq('barber_id', barberId).gte('created_at', monthStart).order('created_at', { ascending: false }),
      supabase.from('payouts').select('id,period_start,period_end,commission_amount,incentive_amount,deduction_amount,total_amount,status,paid_at').eq('barber_id', barberId).order('created_at', { ascending: false }).limit(20),
      supabase.from('discount_applications').select('id,name_snapshot,eligible_base,discount_amount,barber_discount_share,business_discount_share,created_at').eq('barber_id', barberId).gte('created_at', monthStart).order('created_at', { ascending: false }).limit(30),
    ]);
    return {
      earnings: requireData(earningsResult) as Earning[],
      monthEarnings: requireData(monthEarningsResult) as Earning[],
      payouts: requireData(payoutsResult) as Payout[],
      discounts: requireData(discountsResult) as Discount[],
      timezone,
    };
  }, barberId);

  const data = query.data;
  const pendingTotal = (data?.earnings ?? []).filter((item) => ['pending', 'approved'].includes(item.status)).reduce((sum, item) => sum + Number(item.amount), 0);
  const monthProductEarnings = (data?.monthEarnings ?? []).filter((item) => item.kind === 'product_incentive');
  const monthProductSales = monthProductEarnings.reduce((sum, item) => sum + Number(item.base_amount), 0);
  const monthProductCommission = monthProductEarnings.reduce((sum, item) => sum + Number(item.amount), 0);

  return (
    <AppShell title="Balance económico" roleLabel="CONTROL PERSONAL" activeTab="balance" tabs={barberTabs} onRefresh={query.refresh} refreshing={query.loading}>
      <PageHeading eyebrow="Control personal" title="Balance económico" description="Revisa tus comisiones, incentivos y liquidaciones." />
      {query.error ? <InlineMessage>{query.error}</InlineMessage> : null}
      <View style={styles.stats}>
        <StatCard label="Liquidación pendiente" value={formatMoney(pendingTotal)} hint="Saldo por recibir" />
        <StatCard label="Productos vendidos" value={formatMoney(monthProductSales)} hint="Este mes" />
        <StatCard label="Incentivo por productos" value={formatMoney(monthProductCommission)} hint="Bs 5 por unidad vendida" />
      </View>

      <Card>
        <CardTitle icon={Banknote} title="Comisiones económicas" subtitle="Este registro es independiente de los puntos de fidelidad." />
        {data?.earnings.length ? data.earnings.map((item) => (
          <View key={item.id} style={styles.row}>
            <View style={{ flex: 1, gap: 4 }}><Text style={styles.rowTitle}>{item.sale_items?.name_snapshot ?? earningLabel(item.kind)}</Text><Text style={styles.muted}>{earningLabel(item.kind)} · {statusLabel(item.status)} · {formatDate(item.created_at, { dateStyle: 'medium', timeZone: data.timezone })}</Text></View>
            <Text style={styles.money}>{formatMoney(item.amount)}</Text>
          </View>
        )) : <EmptyState title="Aún no existen comisiones registradas" />}
      </Card>

      <Card>
        <CardTitle icon={Sparkles} title="Descuentos compartidos" subtitle="Desglose de descuentos asumidos por ti y por el local este mes." />
        {data?.discounts.length ? data.discounts.map((item) => (
          <View key={item.id} style={styles.row}>
            <View style={{ flex: 1, gap: 4 }}><Text style={styles.rowTitle}>{item.name_snapshot}</Text><Text style={styles.muted}>Base {formatMoney(item.eligible_base)} · descuento {formatMoney(item.discount_amount)} · {formatDate(item.created_at, { dateStyle: 'medium', timeZone: data.timezone })}</Text></View>
            <Text style={styles.money}>Tú {formatMoney(item.barber_discount_share)} · Local {formatMoney(item.business_discount_share)}</Text>
          </View>
        )) : <EmptyState title="Este mes todavía no asumiste descuentos" />}
      </Card>

      <Card>
        <CardTitle icon={History} title="Liquidaciones" subtitle="Pagos preparados o completados por administración." />
        {data?.payouts.length ? data.payouts.map((item) => (
          <View key={item.id} style={styles.row}>
            <View style={{ flex: 1, gap: 4 }}><Text style={styles.rowTitle}>{formatDate(`${item.period_start}T12:00:00`, { dateStyle: 'medium', timeZone: data.timezone })} – {formatDate(`${item.period_end}T12:00:00`, { dateStyle: 'medium', timeZone: data.timezone })}</Text><Text style={styles.muted}>Servicios {formatMoney(item.commission_amount)} · incentivo {formatMoney(item.incentive_amount)} · {payoutStatus(item.status)}</Text>{item.paid_at ? <Text style={styles.muted}>Pagada {formatDate(item.paid_at, { dateStyle: 'medium', timeZone: data.timezone })}</Text> : null}</View>
            <Text style={styles.money}>{formatMoney(item.total_amount)}</Text>
          </View>
        )) : <EmptyState title="Aún no existen liquidaciones" />}
      </Card>
    </AppShell>
  );
}

function earningLabel(kind: string) {
  return kind === 'product_incentive' ? 'Venta de producto' : kind === 'service_commission' ? 'Servicio' : kind;
}
function statusLabel(status: string) {
  return ({ pending: 'Pendiente', approved: 'Aprobada', paid: 'Pagada', reversed: 'Revertida' } as Record<string, string>)[status] ?? status;
}
function payoutStatus(status: string) {
  return ({ draft: 'Preparada', approved: 'Aprobada', paid: 'Pagada', canceled: 'Cancelada' } as Record<string, string>)[status] ?? status;
}

const styles = StyleSheet.create({
  stats: { gap: 9 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, borderTopColor: palette.border, borderTopWidth: StyleSheet.hairlineWidth, paddingVertical: 12 },
  rowTitle: { color: palette.text, fontSize: 12, fontWeight: '800' },
  muted: { color: palette.muted, fontSize: 10, lineHeight: 15 },
  money: { color: palette.gold, fontSize: 12, fontWeight: '900', textAlign: 'right', maxWidth: 140 },
});
