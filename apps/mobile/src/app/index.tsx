import { router } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { ActionButton, InlineMessage, palette } from '@/components/ui';
import { useSession } from '@/lib/session';

export default function IndexRoute() {
  const { session, role, loading, roleError, refreshRole, signOut } = useSession();

  useEffect(() => {
    if (loading) return;
    if (!session) router.replace('/sign-in');
    else if (role === 'client') router.replace('/client');
    else if (role === 'barber') router.replace('/barber');
  }, [loading, role, session]);

  if (role === 'unsupported' && !loading) {
    return (
      <View style={styles.center}>
        <Text style={styles.brand}>LEGEND CLUB</Text>
        <Text style={styles.title}>No se pudo abrir esta cuenta</Text>
        <ActionButton label="Cerrar sesión" onPress={() => void signOut()} tone="secondary" />
      </View>
    );
  }

  if (roleError && !loading) {
    return (
      <View style={styles.center}>
        <Text style={styles.brand}>LEGEND CLUB</Text>
        <Text style={styles.title}>No se pudo validar tu acceso</Text>
        <InlineMessage>{roleError}</InlineMessage>
        <ActionButton label="Reintentar" onPress={() => void refreshRole()} />
        <ActionButton label="Volver al inicio de sesión" onPress={() => void signOut()} tone="secondary" />
      </View>
    );
  }

  return <View style={styles.center}><ActivityIndicator color={palette.gold} /><Text style={styles.copy}>Preparando tu cuenta…</Text></View>;
}

const styles = StyleSheet.create({
  center: { flex: 1, backgroundColor: palette.background, alignItems: 'center', justifyContent: 'center', padding: 28, gap: 16 },
  brand: { color: palette.gold, fontSize: 12, fontWeight: '900', letterSpacing: 3 },
  title: { color: palette.text, fontSize: 24, lineHeight: 31, fontWeight: '800', textAlign: 'center' },
  copy: { color: palette.muted, fontSize: 14, lineHeight: 21, textAlign: 'center' },
});
