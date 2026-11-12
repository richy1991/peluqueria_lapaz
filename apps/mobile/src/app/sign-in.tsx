import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Scissors, ShieldCheck, Smartphone } from 'lucide-react-native';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ActionButton, Card, InlineMessage, palette } from '@/components/ui';
import { useSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';

WebBrowser.maybeCompleteAuthSession();

function queryValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default function SignInScreen() {
  const { session, role, loading } = useSession();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!session || loading) return;
    if (role === 'client') router.replace('/client');
    if (role === 'barber') router.replace('/barber');
    if (role === 'unsupported') router.replace('/');
  }, [loading, role, session]);

  async function continueWithGoogle() {
    setBusy(true);
    setError('');
    try {
      const redirectTo = Linking.createURL('auth/callback', { scheme: 'legendclub' });
      const { data, error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo, skipBrowserRedirect: true },
      });
      if (oauthError) throw oauthError;
      if (!data.url) throw new Error('No se pudo iniciar el acceso con Google.');

      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
      if (result.type !== 'success') {
        setBusy(false);
        return;
      }

      const parsed = Linking.parse(result.url);
      const query = parsed.queryParams ?? {};
      const description = queryValue(query.error_description as string | string[] | undefined);
      if (description) throw new Error(description);

      const code = queryValue(query.code as string | string[] | undefined);
      if (code) {
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
        if (exchangeError) throw exchangeError;
      } else {
        const fragment = result.url.split('#')[1] ?? '';
        const tokens = new URLSearchParams(fragment);
        const accessToken = tokens.get('access_token');
        const refreshToken = tokens.get('refresh_token');
        if (!accessToken || !refreshToken) throw new Error('Google no devolvió una sesión válida.');
        const { error: sessionError } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
        if (sessionError) throw sessionError;
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No se pudo iniciar sesión.');
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.content}>
        <View style={styles.brandIcon}><Scissors size={28} color={palette.gold} strokeWidth={1.7} /></View>
        <Text style={styles.wordmark}>LEGEND CLUB</Text>
        <Text style={styles.title}>Tu estilo, a tu ritmo.</Text>
        <Text style={styles.description}>Accede a tus citas, puntos y productos, o gestiona tu agenda como peluquero.</Text>

        <Card style={styles.loginCard}>
          <View style={styles.valueRow}><Smartphone size={18} color={palette.gold} /><Text style={styles.valueText}>Una app móvil para cliente y peluquero</Text></View>
          <View style={styles.valueRow}><ShieldCheck size={18} color={palette.gold} /><Text style={styles.valueText}>Tu cuenta y datos siguen protegidos por Supabase</Text></View>
          {error ? <InlineMessage>{error}</InlineMessage> : null}
          <ActionButton label={busy ? 'Conectando…' : 'Continuar con Google'} onPress={() => void continueWithGoogle()} loading={busy} />
          {loading ? <ActivityIndicator color={palette.gold} /> : null}
        </Card>

        <Text style={styles.footer}>El sitio público y las reservas mantienen su dirección actual.</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: palette.background },
  content: { flex: 1, width: '100%', maxWidth: 500, alignSelf: 'center', justifyContent: 'center', paddingHorizontal: 24, gap: 13 },
  brandIcon: { width: 62, height: 62, borderRadius: 20, backgroundColor: '#34291f', borderColor: '#624d30', borderWidth: 1, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  wordmark: { color: palette.gold, fontSize: 12, fontWeight: '900', letterSpacing: 3 },
  title: { color: palette.text, fontSize: 34, lineHeight: 39, fontWeight: '800', letterSpacing: -0.7 },
  description: { color: palette.muted, fontSize: 15, lineHeight: 23, marginBottom: 8 },
  loginCard: { gap: 16 },
  valueRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  valueText: { flex: 1, color: palette.text, fontSize: 12, lineHeight: 18 },
  footer: { color: '#887c70', fontSize: 11, lineHeight: 17, textAlign: 'center', marginTop: 6 },
});
