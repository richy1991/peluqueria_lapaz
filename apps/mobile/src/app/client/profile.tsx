import { useState } from 'react';
import { router } from 'expo-router';
import { Linking, StyleSheet, Text, View } from 'react-native';
import { Bell, BadgeCheck, CircleAlert, Globe2, LogOut, Mail, Phone, ShieldAlert, UserRound } from 'lucide-react-native';

import { AppShell } from '@/components/AppShell';
import { ActionButton, Card, CardTitle, EmptyState, InlineMessage, PageHeading, palette } from '@/components/ui';
import { clientTabs } from '@/lib/navigation';
import { publicPage } from '@/lib/links';
import { useSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';
import { requireData, useRemoteData } from '@/lib/utils';

type Profile = { full_name: string | null; email: string | null; phone: string | null; avatar_url: string | null; status: string; no_show_count: number; is_blacklisted: boolean; is_blocked: boolean };

export default function ClientProfileScreen() {
  const { session, signOut } = useSession();
  const [signOutError, setSignOutError] = useState('');
  const userId = session?.user.id ?? '';
  const query = useRemoteData<Profile>(async () => {
    if (!userId) throw new Error('Inicia sesión para consultar tu perfil.');
    const result = await supabase.from('profiles').select('full_name,email,phone,avatar_url,status,no_show_count,is_blacklisted,is_blocked').eq('id', userId).single();
    return requireData(result);
  }, userId);

  async function exit() {
    setSignOutError('');
    try {
      await signOut();
      router.replace('/sign-in');
    } catch (reason) {
      setSignOutError(reason instanceof Error ? reason.message : 'No se pudo cerrar sesión.');
    }
  }

  const profile = query.data;
  return (
    <AppShell title="Perfil" roleLabel="CUENTA PERSONAL" activeTab="perfil" tabs={clientTabs} onRefresh={query.refresh} refreshing={query.loading}>
      <PageHeading eyebrow="Cuenta personal" title="Mi perfil" description="Consulta los datos asociados a tu cuenta LEGEND CLUB." />
      {query.error || signOutError ? <InlineMessage>{signOutError || query.error}</InlineMessage> : null}
      {profile ? (
        <Card>
          <CardTitle icon={UserRound} title={profile.full_name || 'Cliente'} subtitle={profile.email || session?.user.email || 'Cuenta LEGEND CLUB'} />
          <View style={styles.infoRow}><Mail size={17} color={palette.gold} /><Text style={styles.infoLabel}>Correo</Text><Text selectable style={styles.infoValue}>{profile.email || session?.user.email || 'Pendiente'}</Text></View>
          <View style={styles.infoRow}><Phone size={17} color={palette.gold} /><Text style={styles.infoLabel}>Teléfono</Text><Text style={styles.infoValue}>{profile.phone || 'Pendiente de registrar'}</Text></View>
          <View style={styles.infoRow}><BadgeCheck size={17} color={palette.gold} /><Text style={styles.infoLabel}>Estado</Text><Text style={[styles.infoValue, profile.status === 'active' && styles.statusActive]}>{profile.status === 'active' ? 'Activo' : profile.status}</Text></View>
          <View style={styles.infoRow}><CircleAlert size={17} color={palette.gold} /><Text style={styles.infoLabel}>Inasistencias</Text><Text style={styles.infoValue}>{profile.no_show_count ?? 0}</Text></View>
          {profile.is_blacklisted ? <InlineMessage tone="info">Tu cuenta tiene una alerta por inasistencias.</InlineMessage> : null}
          {profile.is_blocked ? <InlineMessage>Las nuevas reservas están bloqueadas. Contacta al negocio.</InlineMessage> : null}
        </Card>
      ) : !query.loading ? <EmptyState title="No se pudo cargar el perfil" /> : null}

      <Card>
        <CardTitle icon={ShieldAlert} title="Ayuda y preferencias" subtitle="Usa el sitio actual para cambiar tus opciones o consultar información detallada." />
        <ActionButton label="Notificaciones y preferencias" icon={Bell} tone="secondary" onPress={() => router.push('/client/notifications')} />
        <ActionButton label="Sitio público" icon={Globe2} tone="secondary" onPress={() => void Linking.openURL(publicPage())} />
        <ActionButton label="Cerrar sesión" icon={LogOut} tone="danger" onPress={() => void exit()} />
      </Card>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  infoRow: { minHeight: 43, flexDirection: 'row', alignItems: 'center', gap: 9, borderTopColor: palette.border, borderTopWidth: StyleSheet.hairlineWidth },
  infoLabel: { width: 84, color: palette.muted, fontSize: 12, fontWeight: '700' },
  infoValue: { flex: 1, color: palette.text, fontSize: 12, textAlign: 'right' },
  statusActive: { color: palette.green, fontWeight: '800' },
});
