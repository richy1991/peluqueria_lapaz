import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Stack, router } from 'expo-router';

import { ActionButton, InlineMessage, palette } from '@/components/ui';
import { useSession } from '@/lib/session';

export default function ClientLayout() {
  const { session, role, profileComplete, loading, roleError, refreshRole } = useSession();

  useEffect(() => {
    if (loading) return;
    if (!session) router.replace('/sign-in');
    else if (role === 'client' && !profileComplete) router.replace('/complete-profile');
    else if (role === 'barber' || role === 'unsupported') router.replace('/');
  }, [loading, profileComplete, role, session]);

  if (session && role === 'client' && profileComplete && !loading) {
    return <Stack screenOptions={{ headerShown: false }} />;
  }

  return (
    <View style={styles.screen}>
      {roleError && !loading ? (
        <>
          <InlineMessage>{roleError}</InlineMessage>
          <ActionButton label="Reintentar" onPress={() => void refreshRole()} />
        </>
      ) : <ActivityIndicator color={palette.gold} />}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, padding: 24, backgroundColor: palette.background },
});
