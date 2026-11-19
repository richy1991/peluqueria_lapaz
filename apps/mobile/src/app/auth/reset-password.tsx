import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Eye, EyeOff, LockKeyhole } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ActionButton, InlineMessage } from '@/components/ui';
import { completeAuthCallback } from '@/lib/auth-callback';
import { authErrorMessage } from '@/lib/auth-message';
import { supabase } from '@/lib/supabase';

const first = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value;

export default function ResetPasswordScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ code?: string | string[]; error?: string | string[]; error_description?: string | string[] }>();
  const code = first(params.code);
  const callbackError = first(params.error_description) ?? first(params.error);
  const [readyCode, setReadyCode] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [password, setPassword] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    let active = true;
    if (callbackError || !code) return () => { active = false; };

    const url = `legendclub://auth/reset-password?code=${encodeURIComponent(code)}`;
    void completeAuthCallback(url).then(() => {
      if (active) setReadyCode(code);
    }).catch((reason: unknown) => {
      if (active) setError(authErrorMessage(reason, 'No pudimos validar el enlace. Solicita uno nuevo.'));
    });
    return () => { active = false; };
  }, [callbackError, code]);

  const ready = Boolean(code && readyCode === code);
  const loadingLink = Boolean(code && !callbackError && !ready && !error);
  const visibleError = callbackError
    ?? error
    ?? (!code ? 'Este enlace de recuperación no es válido o ya venció. Solicita uno nuevo.' : '');

  async function savePassword() {
    if (password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres.');
      return;
    }

    setBusy(true);
    setError('');
    setMessage('');
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;
      setMessage('Tu contraseña se actualizó correctamente.');
      setPassword('');
    } catch (reason) {
      setError(authErrorMessage(reason, 'No pudimos cambiar tu contraseña. Solicita un enlace nuevo.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={[styles.screen, {
      paddingTop: 24 + insets.top,
      paddingBottom: 24 + insets.bottom,
      paddingLeft: 24 + insets.left,
      paddingRight: 24 + insets.right,
    }]}>
      <View style={styles.card}>
        <View style={styles.icon}><LockKeyhole size={21} color="#D7DDE5" /></View>
        <Text style={styles.eyebrow}>RECUPERAR CUENTA</Text>
        <Text style={styles.title}>Crea una nueva contraseña</Text>
        <Text style={styles.description}>Usa al menos 8 caracteres para proteger tu cuenta.</Text>

        {loadingLink ? (
          <View style={styles.loadingRow}><ActivityIndicator color="#D7DDE5" /><Text style={styles.description}>Validando el enlace…</Text></View>
        ) : ready && !message ? (
          <View style={styles.field}>
            <Text style={styles.label}>Nueva contraseña</Text>
            <View style={styles.inputFrame}>
              <TextInput
                value={password}
                onChangeText={(value) => { setPassword(value); setError(''); }}
                placeholder="Nueva contraseña"
                placeholderTextColor="#89929E"
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="new-password"
                textContentType="newPassword"
                secureTextEntry={!passwordVisible}
                editable={!busy}
                accessibilityLabel="Nueva contraseña"
                style={styles.input}
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={passwordVisible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                onPress={() => setPasswordVisible((visible) => !visible)}
                hitSlop={10}
                style={styles.visibilityButton}>
                {passwordVisible ? <EyeOff size={18} color="#9AA2AC" /> : <Eye size={18} color="#9AA2AC" />}
              </Pressable>
            </View>
          </View>
        ) : null}

        {visibleError ? <InlineMessage>{visibleError}</InlineMessage> : null}
        {message ? <InlineMessage tone="success">{message}</InlineMessage> : null}

        {ready && !message ? <ActionButton label="Guardar contraseña" onPress={() => void savePassword()} loading={busy} /> : null}
        {message ? <ActionButton label="Continuar" onPress={() => router.replace('/sign-in')} /> : null}
        {visibleError && !ready ? <Pressable onPress={() => router.replace('/sign-in')} style={styles.backButton}><Text style={styles.backText}>Volver a iniciar sesión</Text></Pressable> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0B0D10', padding: 24 },
  card: { width: '100%', maxWidth: 410, gap: 15, borderRadius: 24, borderWidth: 1, borderColor: '#2C3138', backgroundColor: '#15181C', padding: 25 },
  icon: { width: 46, height: 46, alignItems: 'center', justifyContent: 'center', borderRadius: 15, borderWidth: 1, borderColor: '#343A43', backgroundColor: '#20242A' },
  eyebrow: { color: '#AAB2BC', fontSize: 9, fontWeight: '900', letterSpacing: 1.8 },
  title: { color: '#F2F4F7', fontSize: 23, lineHeight: 29, fontWeight: '800', letterSpacing: -0.5 },
  description: { color: '#A4ACB6', fontSize: 12, lineHeight: 18 },
  loadingRow: { minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  field: { gap: 8 },
  label: { color: '#E4E8ED', fontSize: 12, fontWeight: '700' },
  inputFrame: { minHeight: 52, borderRadius: 14, borderWidth: 1, borderColor: '#343A43', backgroundColor: '#20242A', paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', gap: 10 },
  input: { flex: 1, minWidth: 0, minHeight: 50, paddingVertical: 0, color: '#F2F4F7', fontSize: 14 },
  visibilityButton: { width: 30, height: 42, alignItems: 'center', justifyContent: 'center' },
  backButton: { minHeight: 38, alignItems: 'center', justifyContent: 'center' },
  backText: { color: '#BBC2CC', fontSize: 12, fontWeight: '700' },
});
