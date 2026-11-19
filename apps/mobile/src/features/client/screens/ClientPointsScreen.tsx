import { useState } from 'react';
import { Share, StyleSheet, View } from 'react-native';
import { ThemedText as Text } from '@/components/ThemedText';
import QRCode from 'react-native-qrcode-svg';
import { Gift, History, PackageCheck, Share2, Star } from 'lucide-react-native';

import { AppShell } from '@/components/AppShell';
import { ClientPageHeader, useClientHeaderHeight } from '@/components/ClientPageHeader';
import { ActionButton, Card, CardTitle, InlineMessage, TextField, palette } from '@/components/ui';
import { useAppearance } from '@/lib/appearance';
import { clientTabs } from '@/lib/navigation';
import { useSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';
import { formatDate, requireData, useRemoteData } from '@/lib/utils';

type LoyaltyAccount = { barber_id: string; balance: number; barber_profiles: { display_name?: string } | null };
type LoyaltyTransaction = { id: string; points: number; reason: string; created_at: string; barber_id_snapshot: string | null; barber_profiles: { display_name?: string } | null };
type PointsData = { accounts: LoyaltyAccount[]; transactions: LoyaltyTransaction[]; code: string | null };

export default function ClientPointsScreen() {
  const { session } = useSession();
  const { colors } = useAppearance();
  const headerHeight = useClientHeaderHeight(246);
  const userId = session?.user.id ?? '';
  const [visitCode, setVisitCode] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const query = useRemoteData<PointsData>(async () => {
    if (!userId) throw new Error('Inicia sesión para consultar tus puntos.');
    await supabase.rpc('refresh_my_barber_loyalty');
    const [accountsResult, transactionsResult, profileResult] = await Promise.all([
      supabase.from('customer_barber_loyalty_accounts').select('barber_id,balance,barber_profiles(display_name)').eq('user_id', userId).order('balance', { ascending: false }),
      supabase.from('loyalty_transactions').select('id,points,reason,created_at,barber_id_snapshot,barber_profiles(display_name)').eq('user_id', userId).or('barber_id.not.is.null,barber_id_snapshot.not.is.null').order('created_at', { ascending: false }).limit(30),
      supabase.from('profiles').select('referral_code').eq('id', userId).maybeSingle(),
    ]);
    if (profileResult.error) throw new Error(profileResult.error.message);
    return { accounts: requireData(accountsResult) as LoyaltyAccount[], transactions: requireData(transactionsResult) as LoyaltyTransaction[], code: profileResult.data?.referral_code ?? null };
  }, userId);

  async function claimVisit() {
    setBusy(true);
    setMessage('');
    try {
      const { data, error } = await supabase.rpc('claim_guest_sale', { provided_code: visitCode.trim().toUpperCase() });
      if (error) throw error;
      if (!data) { setMessage('Código inválido o ya utilizado.'); return; }
      setVisitCode('');
      setMessage('Visita vinculada a tu cuenta.');
      query.refresh();
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : 'No se pudo vincular la visita. Revisa tu conexión.');
    } finally {
      setBusy(false);
    }
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

  return (
    <AppShell title="Puntos" roleLabel="FIDELIZACIÓN" activeTab="puntos" tabs={clientTabs} onRefresh={query.refresh} refreshing={query.loading}
      floatingHeaderHeight={headerHeight}
      floatingHeader={(scrollY) => <ClientPageHeader scrollY={scrollY} expandedHeight={headerHeight} eyebrow="FIDELIZACIÓN" title="Puntos y recompensas" description="Cada peluquero mantiene su propio saldo. Consulta tus cuentas y movimientos aquí." />}>
      <View style={styles.pageBody}>
      {query.error || message ? <InlineMessage tone={message.includes('vinculada') ? 'success' : 'error'}>{message || query.error}</InlineMessage> : null}
      {query.data ? <>
      <Card enteringDelay={100}>
        <CardTitle icon={Star} title="Puntos por peluquero" />
        {query.data.accounts.length ? (
          <View style={styles.accountGrid}>
            {query.data.accounts.map((account) => (
              <View key={account.barber_id} style={[styles.accountTile, { backgroundColor: colors.glassRaised, borderColor: colors.glassBorder }]}>
                <Text numberOfLines={2} style={[styles.rowTitle, { color: colors.text }]}>{account.barber_profiles?.display_name ?? 'Peluquero'}</Text>
                <Text style={[styles.points, { color: colors.accent }]}>{account.balance}</Text>
                <Text style={[styles.muted, { color: colors.muted }]}>disponibles</Text>
              </View>
            ))}
          </View>
        ) : <Text style={[styles.emptyText, { color: colors.muted }]}>Aún no tienes puntos.</Text>}
      </Card>

      <Card enteringDelay={190}>
        <CardTitle icon={Gift} title="Recomendar" />
        {query.data?.code ? (
          <View style={styles.referral}>
            <View style={styles.qrBox}><QRCode value={query.data.code} size={112} backgroundColor="#ffffff" color="#171A1F" /></View>
            <View style={styles.referralDetails}><Text selectable style={[styles.code, { color: colors.accent }]}>{query.data.code}</Text><ActionButton label="Compartir código" icon={Share2} compact onPress={() => void shareReferral()} /></View>
          </View>
        ) : <Text style={[styles.emptyText, { color: colors.muted }]}>Aún no tienes un código de recomendación.</Text>}
      </Card>

      <Card enteringDelay={280}>
        <CardTitle icon={PackageCheck} title="Agregar una visita" />
        <TextField label="Código del comprobante" autoCapitalize="characters" autoCorrect={false} maxLength={10} value={visitCode} onChangeText={(value) => setVisitCode(value.toUpperCase())} placeholder="Ej. 45AB78CD12" />
        <ActionButton label="Vincular atención" icon={PackageCheck} loading={busy} disabled={visitCode.trim().length < 4} onPress={() => void claimVisit()} />
      </Card>

      <Card enteringDelay={370}>
        <CardTitle icon={History} title="Historial de puntos" />
        {query.data?.transactions.length ? query.data.transactions.map((transaction) => (
            <View key={transaction.id} style={[styles.transaction, { borderTopColor: colors.border }]}>
            <View style={{ flex: 1, gap: 4 }}><Text style={[styles.rowTitle, { color: colors.text }]}>{transaction.reason}</Text><Text style={[styles.muted, { color: colors.muted }]}>{transaction.barber_profiles?.display_name ?? (transaction.barber_id_snapshot ? 'Peluquero eliminado' : 'Peluquero')} · {formatDate(transaction.created_at, { dateStyle: 'medium', timeZone: 'America/La_Paz' })}</Text></View>
            <Text style={[styles.transactionPoints, { color: transaction.points < 0 ? colors.danger : colors.success }]}>{transaction.points > 0 ? '+' : ''}{transaction.points}</Text>
          </View>
        )) : <Text style={[styles.emptyText, { color: colors.muted }]}>Aún no tienes movimientos.</Text>}
      </Card>
      </> : null}
      </View>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  pageBody: { paddingHorizontal: 16, paddingTop: 16, gap: 13 },
  accountGrid: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start', gap: 10 },
  accountTile: { width: '47%', minHeight: 116, padding: 13, borderWidth: 1, borderRadius: 14, justifyContent: 'space-between', gap: 7 },
  rowTitle: { fontSize: 13, lineHeight: 18, fontWeight: '800' },
  muted: { fontSize: 11, lineHeight: 16 },
  points: { fontSize: 28, lineHeight: 32, fontWeight: '900' },
  transactionPoints: { color: palette.green, fontSize: 16, fontWeight: '900' },
  emptyText: { fontSize: 13, lineHeight: 19 },
  referral: { flexDirection: 'row', alignItems: 'center', gap: 13 },
  qrBox: { padding: 8, backgroundColor: '#fff', borderRadius: 12 },
  referralDetails: { flex: 1, gap: 9 },
  code: { fontSize: 20, fontWeight: '900', letterSpacing: 1 },
  transaction: { flexDirection: 'row', alignItems: 'center', borderTopWidth: StyleSheet.hairlineWidth, paddingVertical: 12, gap: 10 },
});
