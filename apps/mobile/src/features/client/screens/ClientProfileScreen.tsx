import { useCallback, useRef, useState } from 'react';
import { router, useFocusEffect } from 'expo-router';
import { Alert, Image, Linking, Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { ThemedText as Text } from '@/components/ThemedText';
import { BadgeCheck, Bell, CircleAlert, Globe2, History, LogOut, Mail, Palette, Phone, Settings2, UserRound, UserRoundPen } from 'lucide-react-native';

import { AppShell } from '@/components/AppShell';
import { ClientPageHeader, useClientHeaderHeight } from '@/components/ClientPageHeader';
import { ActionButton, Card, CardTitle, EmptyState, InlineMessage, ThemePreferenceControl, palette } from '@/components/ui';
import { useAppearance } from '@/lib/appearance';
import { clientTabs } from '@/lib/navigation';
import { publicPage } from '@/lib/links';
import { useSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';
import { requireData, useRemoteData } from '@/lib/utils';

type Profile = { full_name: string | null; email: string | null; phone: string | null; avatar_url: string | null; status: string; no_show_count: number; is_blacklisted: boolean; is_blocked: boolean };

export default function ClientProfileScreen() {
  const { session, signOut } = useSession();
  const headerHeight = useClientHeaderHeight(214);
  const { colors } = useAppearance();
  const [signOutError, setSignOutError] = useState('');
  const [signOutBusy, setSignOutBusy] = useState(false);
  const hasBeenFocused = useRef(false);
  const userId = session?.user.id ?? '';
  const query = useRemoteData<Profile>(async () => {
    if (!userId) throw new Error('Inicia sesión para consultar tu perfil.');
    const result = await supabase.from('profiles').select('full_name,email,phone,avatar_url,status,no_show_count,is_blacklisted,is_blocked').eq('id', userId).single();
    return requireData(result);
  }, userId);
  const refreshProfile = query.refresh;

  useFocusEffect(useCallback(() => {
    if (hasBeenFocused.current) refreshProfile();
    hasBeenFocused.current = true;
  }, [refreshProfile]));

  async function exit() {
    setSignOutError('');
    setSignOutBusy(true);
    try {
      await signOut();
      router.replace('/sign-in');
    } catch (reason) {
      setSignOutError(reason instanceof Error ? reason.message : 'No se pudo cerrar sesión.');
    } finally {
      setSignOutBusy(false);
    }
  }

  const profile = query.data;
  return (
    <AppShell title="Perfil" roleLabel="CUENTA PERSONAL" activeTab="perfil" tabs={clientTabs} onRefresh={refreshProfile} refreshing={query.loading}
      floatingHeaderHeight={headerHeight}
      floatingHeader={(scrollY) => <ClientPageHeader scrollY={scrollY} expandedHeight={headerHeight} eyebrow="CUENTA PERSONAL" title="Mi perfil" description="Consulta los datos asociados a tu cuenta LEGEND CLUB." />}>
      <View style={styles.pageBody}>
      {query.error || signOutError ? <InlineMessage>{signOutError || query.error}</InlineMessage> : null}
      {profile ? (
        <>
        <Animated.View entering={FadeInDown.duration(280)} style={styles.profileOverview}>
          <View style={[styles.avatar, { backgroundColor: colors.glassRaised, borderColor: colors.surface }]}>
            {profile.avatar_url ? <Image source={{ uri: profile.avatar_url }} style={styles.avatarImage} resizeMode="cover" alt={`Foto de ${profile.full_name || 'cliente'}`} accessibilityLabel={`Foto de ${profile.full_name || 'cliente'}`} /> : <Text style={[styles.avatarInitials, { color: colors.text }]}>{getInitials(profile.full_name || session?.user.email?.split('@')[0] || 'Cliente')}</Text>}
          </View>
          <View style={[styles.profileRole, { backgroundColor: colors.accentSoft, borderColor: colors.glassBorder }]}><UserRound size={14} color={colors.accent} /><Text style={[styles.profileRoleText, { color: colors.accent }]}>Cliente</Text></View>
          <Text numberOfLines={2} style={[styles.profileName, { color: colors.text }]}>{profile.full_name || session?.user.email?.split('@')[0] || 'Cliente'}</Text>
        </Animated.View>
        <Card enteringDelay={180}>
          <View style={styles.accountCardHeading}>
            <View style={styles.accountCardCopy}>
              <Text style={[styles.accountCardTitle, { color: colors.text }]}>Tu cuenta</Text>
              <Text style={[styles.accountCardSubtitle, { color: colors.muted }]}>Datos de tu perfil</Text>
            </View>
            <View style={styles.accountHeaderActions}>
              <Pressable onPress={() => router.push('/client/edit-profile')} style={[styles.editProfileIcon, { backgroundColor: colors.glassRaised, borderColor: colors.glassBorder }]} accessibilityRole="button" accessibilityLabel="Editar perfil">
                <UserRoundPen size={19} color={colors.accent} />
              </Pressable>
              <Pressable onPress={() => router.push('/client/notifications')} style={[styles.editProfileIcon, { backgroundColor: colors.glassRaised, borderColor: colors.glassBorder }]} accessibilityRole="button" accessibilityLabel="Ver notificaciones">
                <Bell size={19} color={colors.accent} />
              </Pressable>
              <Pressable onPress={() => router.push('/client/notification-settings')} style={[styles.editProfileIcon, { backgroundColor: colors.glassRaised, borderColor: colors.glassBorder }]} accessibilityRole="button" accessibilityLabel="Configurar notificaciones">
                <Settings2 size={19} color={colors.accent} />
              </Pressable>
            </View>
          </View>
          <View style={[styles.infoRow, { borderTopColor: colors.border }]}><Mail size={17} color={colors.accent} /><Text style={[styles.infoLabel, { color: colors.muted }]}>Correo</Text><Text selectable style={[styles.infoValue, { color: colors.text }]}>{profile.email || session?.user.email || 'Pendiente'}</Text></View>
          <View style={[styles.infoRow, { borderTopColor: colors.border }]}><Phone size={17} color={colors.accent} /><Text style={[styles.infoLabel, { color: colors.muted }]}>Teléfono</Text><Text style={[styles.infoValue, { color: colors.text }]}>{profile.phone || 'Pendiente de registrar'}</Text></View>
          <View style={[styles.infoRow, { borderTopColor: colors.border }]}><BadgeCheck size={17} color={colors.accent} /><Text style={[styles.infoLabel, { color: colors.muted }]}>Estado</Text><Text style={[styles.infoValue, { color: profile.status === 'active' ? '#15966b' : colors.text }, profile.status === 'active' && styles.statusActive]}>{profile.status === 'active' ? 'Activo' : profile.status}</Text></View>
          <View style={[styles.infoRow, { borderTopColor: colors.border }]}><CircleAlert size={17} color={colors.accent} /><Text style={[styles.infoLabel, { color: colors.muted }]}>Inasistencias</Text><Text style={[styles.infoValue, { color: colors.text }]}>{profile.no_show_count ?? 0}</Text></View>
          {profile.is_blacklisted ? <InlineMessage tone="info">Tu cuenta tiene una alerta por inasistencias.</InlineMessage> : null}
          {profile.is_blocked ? <InlineMessage>Las nuevas reservas están bloqueadas. Contacta al negocio.</InlineMessage> : null}
        </Card>
        </>
      ) : !query.loading ? <EmptyState title="No se pudo cargar el perfil" /> : null}

      <Card enteringDelay={280}>
        <CardTitle icon={Palette} title="Preferencias y ayuda" subtitle="Personaliza la apariencia y accede a la información de tu cuenta." />
        <View style={styles.appearanceHeading}><Palette size={17} color={colors.accent} /><Text style={[styles.appearanceLabel, { color: colors.text }]}>Apariencia</Text></View>
        <ThemePreferenceControl />
        <ActionButton label="Historial" icon={History} tone="secondary" onPress={() => router.push('/client/history')} />
        <ActionButton label="Sitio público" icon={Globe2} tone="secondary" onPress={() => void Linking.openURL(publicPage())} />
        <ActionButton label="Cerrar sesión" icon={LogOut} tone="danger" loading={signOutBusy} onPress={() => Alert.alert('Cerrar sesión', '¿Quieres salir de tu cuenta en este dispositivo?', [{ text: 'Seguir aquí', style: 'cancel' }, { text: 'Cerrar sesión', style: 'destructive', onPress: () => void exit() }])} />
      </Card>
      </View>
    </AppShell>
  );
}

function getInitials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || 'LC';
}

const styles = StyleSheet.create({
  pageBody: { paddingHorizontal: 16, paddingTop: 16, gap: 13 },
  accountCardHeading: { minHeight: 42, flexDirection: 'row', alignItems: 'center', gap: 12 },
  accountHeaderActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  accountCardCopy: { flex: 1, gap: 3 },
  accountCardTitle: { fontSize: 18, fontWeight: '700' },
  accountCardSubtitle: { fontSize: 12, lineHeight: 18 },
  editProfileIcon: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderRadius: 13 },
  profileOverview: { alignItems: 'center', paddingHorizontal: 8, paddingBottom: 4, gap: 0 },
  avatar: { width: 96, height: 96, borderRadius: 48, borderWidth: 4, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', elevation: 3 },
  avatarImage: { width: '100%', height: '100%' },
  avatarInitials: { fontSize: 28, fontWeight: '900' },
  profileRole: { minHeight: 29, marginTop: 10, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 999 },
  profileRoleText: { fontSize: 11, fontWeight: '800' },
  profileName: { maxWidth: '100%', marginTop: 8, fontSize: 23, lineHeight: 29, fontWeight: '800', textAlign: 'center' },
  infoRow: { minHeight: 43, flexDirection: 'row', alignItems: 'center', gap: 9, borderTopColor: palette.border, borderTopWidth: StyleSheet.hairlineWidth },
  infoLabel: { width: 84, color: palette.muted, fontSize: 12, fontWeight: '700' },
  infoValue: { flex: 1, color: palette.text, fontSize: 12, textAlign: 'right' },
  statusActive: { color: palette.green, fontWeight: '800' },
  appearanceHeading: { flexDirection: 'row', alignItems: 'center', gap: 9, marginTop: 3 },
  appearanceLabel: { fontSize: 14, fontWeight: '800' },
});
