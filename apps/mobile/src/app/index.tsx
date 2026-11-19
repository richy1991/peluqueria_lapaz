import { router } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, Linking, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ActionButton, InlineMessage, palette } from '@/components/ui';
import { useSession } from '@/lib/session';
import { adminLoginUrl } from '@/lib/links';

export default function IndexRoute() {
  const insets = useSafeAreaInsets();
  const { session, role, profileComplete, loading, roleError, refreshRole, signOut } = useSession();
  const contentInsets = { paddingTop: 28 + insets.top, paddingBottom: 28 + insets.bottom, paddingLeft: 28 + insets.left, paddingRight: 28 + insets.right };

  useEffect(() => {
    if (loading) return;
    if (!session) router.replace('/sign-in');
    else if (role === 'client') router.replace(profileComplete ? '/client' : '/complete-profile');
    else if (role === 'barber') router.replace('/barber');
  }, [loading, profileComplete, role, session]);

  if (role === 'unsupported' && !loading) {
    return (
      <View style={[styles.center, contentInsets]}>
        <Text style={styles.brand}>LEGEND CLUB</Text>
        <Text style={styles.title}>Esta cuenta no puede usar esta app</Text>
        <Text style={styles.copy}>Inicia sesión desde la versión web de administración.</Text>
        <ActionButton label="Abrir administración web" onPress={() => void Linking.openURL(adminLoginUrl)} />
        <ActionButton label="Cerrar sesión" onPress={() => void signOut()} tone="secondary" />
      </View>
    );
  }

  if (roleError && !loading) {
    return (
      <View style={[styles.center, contentInsets]}>
        <Text style={styles.brand}>LEGEND CLUB</Text>
        <Text style={styles.title}>No se pudo validar tu acceso</Text>
        <InlineMessage>{roleError}</InlineMessage>
        <ActionButton label="Reintentar" onPress={() => void refreshRole()} />
        <ActionButton label="Volver al inicio de sesión" onPress={() => void signOut()} tone="secondary" />
      </View>
    );
  }

  return <View style={[styles.center, contentInsets]}><ActivityIndicator color={palette.gold} /><Text style={styles.copy}>Preparando tu cuenta…</Text></View>;
}

const styles = StyleSheet.create({
  center: { flex: 1, backgroundColor: palette.background, alignItems: 'center', justifyContent: 'center', padding: 28, gap: 16 },
  brand: { color: palette.gold, fontSize: 12, fontWeight: '900', letterSpacing: 3 },
  title: { color: palette.text, fontSize: 24, lineHeight: 31, fontWeight: '800', textAlign: 'center' },
  copy: { color: palette.muted, fontSize: 14, lineHeight: 21, textAlign: 'center' },
});
