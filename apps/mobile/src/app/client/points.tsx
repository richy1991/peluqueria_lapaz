import { useState } from 'react';
import { Share, StyleSheet, Text, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { Gift, History, PackageCheck, Share2, Star } from 'lucide-react-native';

import { AppShell } from '@/components/AppShell';
import { ActionButton, Card, CardTitle, EmptyState, InlineMessage, PageHeading, TextField, palette } from '@/components/ui';
import { clientTabs } from '@/lib/navigation';
import { useSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';
import { formatDate, requireData, useRemoteData } from '@/lib/utils';

type LoyaltyAccount = { barber_id: string; balance: number; lifetime_earned: number; barber_profiles: { display_name?: string } | null };
type LoyaltyTransaction = { id: string; points: number; reason: string; created_at: string; barber_id_snapshot: string | null; barber_profiles: { display_name?: string } | null };
type PointsData = { accounts: LoyaltyAccount[]; transactions: LoyaltyTransaction[]; code: string | null };

export default function ClientPointsScreen() {
  const { session } = useSession();
  const userId = session?.user.id ?? '';
  const [visitCode, setVisitCode] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const query = useRemoteData<PointsData>(async () => {
    if (!userId) throw new Error('Inicia sesión para consultar tus puntos.');
    await supabase.rpc('refresh_my_barber_loyalty');
    const [accountsResult, transactionsResult, profileResult] = await Promise.all([
      supabase.from('customer_barber_loyalty_accounts').select('barber_id,balance,lifetime_earned,barber_profiles(display_name)').eq('user_id', userId).order('balance', { ascending: false }),
      supabase.from('loyalty_transactions').select('id,points,reason,created_at,barber_id_snapshot,barber_profiles(display_name)').eq('user_id', userId).or('barber_id.not.is.null,barber_id_snapshot.not.is.null').order('created_at', { ascending: false }).limit(30),
      supabase.from('profiles').select('referral_code').eq('id', userId).maybeSingle(),
    ]);
    if (profileResult.error) throw new Error(profileResult.error.message);
    return { accounts: requireData(accountsResult) as LoyaltyAccount[], transactions: requireData(transactionsResult) as LoyaltyTransaction[], code: profileResult.data?.referral_code ?? null };
  }, userId);

  async function claimVisit() {
    setBusy(true);
    setMessage('');
    const { data, error } = await supabase.rpc('claim_guest_sale', { provided_code: visitCode.trim().toUpperCase() });
    setBusy(false);
    if (error || !data) { setMessage(error?.message ?? 'Código inválido o ya utilizado.'); return; }
    setVisitCode('');
    setMessage('Visita vinculada a tu cuenta.');
    query.refresh();
  }

  async function shareReferral() {
    const code = query.data?.code;
    if (!code) return;
    try {
      await Share.share({ message: `Usa mi código ${code} en tu primera atención en Barbería LEGEND CLUB.` });
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : 'No se pudo compartir el código.');
    }
  }

  const totalPoints = (query.data?.accounts ?? []).reduce((total, account) => total + Number(account.balance), 0);
  return (
    <AppShell title="Puntos" roleLabel="FIDELIZACIÓN" activeTab="puntos" tabs={clientTabs} onRefresh={query.refresh} refreshing={query.loading}>
      <PageHeading eyebrow="Fidelización" title="Puntos y recompensas" description="Cada peluquero mantiene su propio saldo. Consulta tus cuentas y movimientos aquí." />
      {query.error || message ? <InlineMessage tone={message.includes('vinculada') ? 'success' : 'error'}>{message || query.error}</InlineMessage> : null}

      <Card>
        <CardTitle icon={Star} title="Tu saldo" subtitle="Los puntos se actualizan después de registrar un pago." />
        <View style={styles.total}><Text style={styles.totalValue}>{totalPoints}</Text><Text style={styles.totalLabel}>puntos disponibles</Text></View>
        {query.data?.accounts.length ? query.data.accounts.map((account) => (
          <View key={account.barber_id} style={styles.accountRow}>
            <View style={{ flex: 1, gap: 4 }}><Text style={styles.rowTitle}>{account.barber_profiles?.display_name ?? 'Peluquero'}</Text><Text style={styles.muted}>{account.lifetime_earned} puntos acumulados</Text></View>
            <Text style={styles.points}>{account.balance}</Text>
          </View>
        )) : <EmptyState title="Aún no tienes puntos" description="Tus puntos aparecerán luego de vincular o pagar una visita." />}
      </Card>

      <Card>
        <CardTitle icon={Gift} title="Recomienda LEGEND CLUB" subtitle="Comparte tu código para que lo registren en una primera visita." />
        {query.data?.code ? (
          <View style={styles.referral}>
            <View style={styles.qrBox}><QRCode value={query.data.code} size={112} backgroundColor="#ffffff" color="#14110f" /></View>
            <View style={styles.referralDetails}><Text style={styles.codeLabel}>TU CÓDIGO</Text><Text selectable style={styles.code}>{query.data.code}</Text><ActionButton label="Compartir código" icon={Share2} compact onPress={() => void shareReferral()} /></View>
          </View>
        ) : <EmptyState title="No hay un código asignado" />}
      </Card>

      <Card>
        <CardTitle icon={PackageCheck} title="Vincular una visita" subtitle="Ingresa el código impreso en tu comprobante de caja." />
        <TextField label="Código del comprobante" autoCapitalize="characters" autoCorrect={false} maxLength={10} value={visitCode} onChangeText={(value) => setVisitCode(value.toUpperCase())} placeholder="Ej. 45AB78CD12" />
        <ActionButton label="Vincular atención" icon={PackageCheck} loading={busy} disabled={visitCode.trim().length < 4} onPress={() => void claimVisit()} />
      </Card>

      <Card>
        <CardTitle icon={History} title="Historial de puntos" subtitle="Últimos movimientos por peluquero." />
        {query.data?.transactions.length ? query.data.transactions.map((transaction) => (
          <View key={transaction.id} style={styles.transaction}>
            <View style={{ flex: 1, gap: 4 }}><Text style={styles.rowTitle}>{transaction.reason}</Text><Text style={styles.muted}>{transaction.barber_profiles?.display_name ?? (transaction.barber_id_snapshot ? 'Peluquero eliminado' : 'Peluquero')} · {formatDate(transaction.created_at, { dateStyle: 'medium', timeZone: 'America/La_Paz' })}</Text></View>
            <Text style={[styles.points, transaction.points < 0 && styles.negative]}>{transaction.points > 0 ? '+' : ''}{transaction.points}</Text>
          </View>
        )) : <EmptyState title="Sin movimientos" description="Cuando sumes o uses puntos, verás aquí el historial." />}
      </Card>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  total: { alignItems: 'center', paddingVertical: 5 },
  totalValue: { color: palette.gold, fontSize: 43, fontWeight: '900' },
  totalLabel: { color: palette.muted, fontSize: 11, fontWeight: '700' },
  accountRow: { flexDirection: 'row', alignItems: 'center', borderTopColor: palette.border, borderTopWidth: StyleSheet.hairlineWidth, paddingVertical: 12, gap: 12 },
  rowTitle: { color: palette.text, fontSize: 13, fontWeight: '800' },
  muted: { color: palette.muted, fontSize: 11, lineHeight: 16 },
  points: { color: palette.green, fontSize: 16, fontWeight: '900' },
  negative: { color: palette.red },
  referral: { flexDirection: 'row', alignItems: 'center', gap: 13 },
  qrBox: { padding: 8, backgroundColor: '#fff', borderRadius: 12 },
  referralDetails: { flex: 1, gap: 9 },
  codeLabel: { color: palette.muted, fontSize: 10, fontWeight: '800', letterSpacing: 1.4 },
  code: { color: palette.gold, fontSize: 20, fontWeight: '900', letterSpacing: 1 },
  transaction: { flexDirection: 'row', alignItems: 'center', borderTopColor: palette.border, borderTopWidth: StyleSheet.hairlineWidth, paddingVertical: 12, gap: 10 },
});
