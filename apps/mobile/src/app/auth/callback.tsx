import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { completeAuthCallback } from '@/lib/auth-callback';
import { useSession } from '@/lib/session';

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default function AuthCallbackScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ code?: string | string[]; error?: string | string[]; error_description?: string | string[] }>();
  const { session, role, profileComplete, loading, roleError, refreshRole } = useSession();
  const [callbackError, setCallbackError] = useState('');
  const callbackUrl = useMemo(() => {
    const query = new URLSearchParams();
    const code = first(params.code);
    const error = first(params.error);
    const description = first(params.error_description);
    if (code) query.set('code', code);
    if (error) query.set('error', error);
    if (description) query.set('error_description', description);
    return `legendclub://auth/callback?${query.toString()}`;
  }, [params.code, params.error, params.error_description]);

  useEffect(() => {
    let active = true;
    void completeAuthCallback(callbackUrl).catch((reason: unknown) => {
      if (active) setCallbackError(reason instanceof Error ? reason.message : 'No se pudo completar el acceso.');
    });
    return () => { active = false; };
  }, [callbackUrl]);

  useEffect(() => {
    if (!session || loading) return;
    if (role === 'client') router.replace(profileComplete ? '/client' : '/complete-profile');
    else if (role === 'barber') router.replace('/barber');
    else if (role === 'unsupported') router.replace('/');
  }, [loading, profileComplete, role, session]);

  const visibleError = callbackError || (session && !loading ? roleError : '');

  return (
    <View style={[styles.screen, { paddingTop: 24 + insets.top, paddingBottom: 24 + insets.bottom, paddingLeft: 24 + insets.left, paddingRight: 24 + insets.right }]}>
      <View style={styles.card}>
        {visibleError ? (
          <>
            <Text style={styles.title}>No se pudo validar el acceso</Text>
            <Text style={styles.message}>{visibleError}</Text>
            {session && roleError ? <Pressable onPress={() => void refreshRole()} style={styles.button}><Text style={styles.buttonText}>Reintentar</Text></Pressable> : null}
            <Pressable onPress={() => router.replace('/sign-in')} style={styles.backButton}><Text style={styles.backText}>Volver al inicio de sesión</Text></Pressable>
          </>
        ) : (
          <>
            <ActivityIndicator color="#D7DDE5" size="large" />
            <Text style={styles.title}>Volviendo a LEGEND CLUB</Text>
            <Text style={styles.message}>Estamos validando tu acceso de forma segura.</Text>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0B0D10', padding: 24 },
  card: { width: '100%', maxWidth: 390, alignItems: 'center', gap: 14, borderRadius: 24, borderWidth: 1, borderColor: '#2C3138', backgroundColor: '#15181C', padding: 26 },
  title: { color: '#F2F4F7', fontSize: 19, lineHeight: 25, fontWeight: '800', textAlign: 'center' },
  message: { color: '#9AA2AC', fontSize: 13, lineHeight: 19, textAlign: 'center' },
  button: { width: '100%', minHeight: 46, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: '#D7DDE5', marginTop: 4 },
  buttonText: { color: '#171A1F', fontSize: 13, fontWeight: '800' },
  backButton: { paddingVertical: 8 },
  backText: { color: '#BBC2CC', fontSize: 12, fontWeight: '700' },
});
