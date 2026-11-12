import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Mail, Scissors } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import brandMark from '../../assets/images/legend-club-icon.png';
import { ActionButton, InlineMessage, TextField, palette } from '@/components/ui';
import { useSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';

export default function SignInScreen() {
  const { session, role, loading, roleError, refreshRole } = useSession();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!session || loading) return;
    if (role === 'client') router.replace('/client');
    if (role === 'barber') router.replace('/barber');
    if (role === 'unsupported') router.replace('/');
  }, [loading, role, session]);

  async function sendCode() {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) { setError('Escribe tu correo electrónico.'); return; }
    setBusy(true); setError(''); setMessage('');
    const { error: requestError } = await supabase.auth.signInWithOtp({ email: normalizedEmail, options: { shouldCreateUser: true } });
    setBusy(false);
    if (requestError) { setError(requestError.message); return; }
    setEmail(normalizedEmail); setCodeSent(true); setMessage('Te enviamos un código de acceso. Revisa tu correo.');
  }

  async function verifyCode() {
    if (code.trim().length < 6) { setError('Escribe el código de 6 dígitos.'); return; }
    setBusy(true); setError('');
    const { error: verifyError } = await supabase.auth.verifyOtp({ email: email.trim().toLowerCase(), token: code.trim(), type: 'email' });
    setBusy(false);
    if (verifyError) setError(verifyError.message);
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={styles.keyboard} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.container}>
          <View style={styles.brand}>
            <View style={styles.mark}><Image source={brandMark} style={styles.logo} alt="LEGEND CLUB" accessibilityLabel="LEGEND CLUB" /></View>
            <Text style={styles.wordmark}>LEGEND CLUB</Text>
            <Text style={styles.caption}>BARBERÍA · LA PAZ</Text>
          </View>

          <View style={styles.card}>
            <View style={styles.icon}><Mail size={22} color={palette.gold} /></View>
            <Text style={styles.title}>{codeSent ? 'Revisa tu correo' : 'Inicia sesión'}</Text>
            <Text style={styles.description}>{codeSent ? `Ingresa el código enviado a ${email}` : 'Usa tu correo para entrar o crear tu cuenta.'}</Text>
            {!codeSent ? <TextField label="Correo electrónico" value={email} onChangeText={setEmail} placeholder="tu@correo.com" keyboardType="email-address" autoCapitalize="none" autoComplete="email" textContentType="emailAddress" returnKeyType="done" onSubmitEditing={() => void sendCode()} /> : <TextField label="Código de acceso" value={code} onChangeText={(value) => setCode(value.replace(/\D/g, '').slice(0, 8))} placeholder="000000" keyboardType="number-pad" autoComplete="one-time-code" textContentType="oneTimeCode" />}
            {error ? <InlineMessage>{error}</InlineMessage> : null}
            {message ? <InlineMessage tone="success">{message}</InlineMessage> : null}
            {loading && session ? <ActivityIndicator color={palette.gold} /> : codeSent ? <>
              <ActionButton label="Verificar código" icon={Mail} onPress={() => void verifyCode()} loading={busy} />
              <Pressable onPress={() => { setCodeSent(false); setCode(''); setMessage(''); setError(''); }}><Text style={styles.textLink}>Cambiar correo</Text></Pressable>
              <Pressable disabled={busy} onPress={() => void sendCode()}><Text style={styles.textLink}>Enviar otro código</Text></Pressable>
            </> : <ActionButton label="Enviar código" icon={Mail} onPress={() => void sendCode()} loading={busy} />}
            {session && roleError ? <><InlineMessage>{roleError}</InlineMessage><ActionButton label="Reintentar" onPress={() => void refreshRole()} tone="secondary" loading={loading} /></> : null}
            <ActionButton label="Reservar una cita" icon={Scissors} tone="secondary" onPress={() => router.push('/client/book-appointment')} />
          </View>
          <Text style={styles.footer}>CORTES · ESTILO · BUEN SERVICIO</Text>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#100f0e' }, keyboard: { flex: 1 },
  container: { flex: 1, width: '100%', maxWidth: 520, alignSelf: 'center', justifyContent: 'space-between', paddingHorizontal: 24, paddingTop: 28, paddingBottom: 18 },
  brand: { alignItems: 'center', gap: 5 }, mark: { width: 76, height: 76, borderRadius: 24, backgroundColor: '#f6efdf', borderColor: '#bf9858', borderWidth: 1, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }, logo: { width: 72, height: 72, resizeMode: 'contain' },
  wordmark: { color: '#f7f2e9', fontSize: 15, fontWeight: '900', letterSpacing: 3 }, caption: { color: palette.gold, fontSize: 9, fontWeight: '800', letterSpacing: 2 },
  card: { borderRadius: 24, borderWidth: 1, borderColor: '#3b342b', backgroundColor: '#1b1917', padding: 22, gap: 15 }, icon: { width: 48, height: 48, borderRadius: 16, backgroundColor: '#30271c', alignItems: 'center', justifyContent: 'center' }, title: { color: '#f8f4ed', fontSize: 28, lineHeight: 34, fontWeight: '800', letterSpacing: -0.7 }, description: { color: '#b8b1a7', fontSize: 13, lineHeight: 19 }, textLink: { color: palette.gold, fontSize: 13, textAlign: 'center', fontWeight: '700', padding: 4 }, footer: { color: '#8f867a', fontSize: 9, fontWeight: '800', letterSpacing: 2, textAlign: 'center' },
});
