import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, ImageBackground, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { CalendarDays, Globe2 } from 'lucide-react-native';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import salonHeader from '../../../assets/images/salon-header.jpg';
import brandMark from '../../../assets/images/legend-club-icon.png';
import { ActionButton, InlineMessage, palette } from '@/components/ui';
import { publicSiteUrl } from '@/lib/links';
import { authenticateWithGoogle } from '@/lib/google-auth';
import { useSession } from '@/lib/session';

export default function SignInScreen() {
  const { session, role, loading, roleError, refreshRole } = useSession();
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
      const result = await authenticateWithGoogle();
      if (result === 'cancelled') {
        setBusy(false);
        setError('Acceso cancelado. Puedes intentarlo de nuevo cuando quieras.');
      }
    } catch (reason) {
      setBusy(false);
      setError(reason instanceof Error ? reason.message : 'No se pudo iniciar sesión con Google.');
    }
  }

  return (
    <ImageBackground source={salonHeader} resizeMode="cover" style={styles.background} imageStyle={styles.backgroundImage}>
      <View pointerEvents="none" style={styles.shade} />
      <SafeAreaView style={styles.safe}>
        <View style={styles.content}>
          <Animated.View entering={FadeInDown.duration(520)} style={styles.brand}>
            <Image source={brandMark} style={styles.brandMark} alt="LEGEND CLUB" accessibilityLabel="LEGEND CLUB" />
            <Text style={styles.wordmark}>LEGEND CLUB</Text>
            <Text style={styles.location}>BARBERÍA · LA PAZ</Text>
          </Animated.View>

          <Animated.View entering={FadeInUp.delay(100).duration(560)} style={styles.card}>
            <View style={styles.goldRule} />
            <Text style={styles.eyebrow}>BIENVENIDO</Text>
            <Text style={styles.title}>Tu estilo,{"\n"}a tu ritmo.</Text>
            {loading && session ? <ActivityIndicator color={palette.gold} /> : null}
            {error || (session && roleError) ? <InlineMessage>{error || roleError}</InlineMessage> : null}
            {session && roleError ? (
              <ActionButton label="Reintentar" onPress={() => { setError(''); void refreshRole(); }} loading={loading} />
            ) : (
              <Pressable accessibilityRole="button" disabled={busy} onPress={() => void continueWithGoogle()} style={({ pressed }) => [styles.googleButton, pressed && styles.googlePressed, busy && styles.disabled]}>
                {busy ? <ActivityIndicator color="#211a14" /> : <Text style={styles.googleG}>G</Text>}
                <Text style={styles.googleLabel}>{busy ? 'Conectando…' : 'Continuar con Google'}</Text>
              </Pressable>
            )}
            {!session ? <ActionButton label="Reservar una cita" icon={CalendarDays} tone="secondary" onPress={() => router.push('/client/book-appointment')} /> : null}
            <Pressable onPress={() => void Linking.openURL(publicSiteUrl)} style={styles.publicLink} accessibilityRole="link">
              <Globe2 size={15} color={palette.gold} />
              <Text style={styles.publicLabel}>Sitio público</Text>
            </Pressable>
          </Animated.View>
          <Text style={styles.footer}>LEGEND CLUB</Text>
        </View>
      </SafeAreaView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  background: { flex: 1, backgroundColor: palette.background },
  backgroundImage: { opacity: 0.42 },
  shade: { ...StyleSheet.absoluteFill, backgroundColor: '#080706a8' },
  safe: { flex: 1 },
  content: { flex: 1, width: '100%', maxWidth: 520, alignSelf: 'center', justifyContent: 'space-between', paddingHorizontal: 24, paddingTop: 30, paddingBottom: 16 },
  brand: { alignItems: 'center', gap: 4 },
  brandMark: { width: 88, height: 88, resizeMode: 'contain', marginBottom: 5 },
  wordmark: { color: '#fff8ed', fontSize: 15, fontWeight: '900', letterSpacing: 3 },
  location: { color: palette.gold, fontSize: 9, fontWeight: '800', letterSpacing: 2.2 },
  card: { borderRadius: 24, borderWidth: 1, borderColor: '#d9ad5d4d', backgroundColor: '#171310f2', padding: 23, gap: 16, shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: 24, shadowOffset: { width: 0, height: 13 }, elevation: 16 },
  goldRule: { width: 48, height: 3, borderRadius: 99, backgroundColor: palette.gold, marginBottom: 2 },
  eyebrow: { color: palette.gold, fontSize: 10, fontWeight: '900', letterSpacing: 2 },
  title: { color: palette.text, fontSize: 36, lineHeight: 41, fontWeight: '800', letterSpacing: -0.8 },
  googleButton: { minHeight: 52, borderRadius: 14, backgroundColor: '#f8f4ed', paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 11 },
  googlePressed: { transform: [{ scale: 0.985 }], opacity: 0.9 },
  disabled: { opacity: 0.6 },
  googleG: { color: '#4285f4', fontSize: 19, fontWeight: '900' },
  googleLabel: { color: '#201a14', fontSize: 14, fontWeight: '800' },
  publicLink: { alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 7, padding: 8 },
  publicLabel: { color: palette.muted, fontSize: 12, fontWeight: '700' },
  footer: { color: '#d4c5b5', opacity: 0.58, fontSize: 9, fontWeight: '800', letterSpacing: 3, textAlign: 'center' },
});
