import { router } from 'expo-router';
import * as Linking from 'expo-linking';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Eye,
  EyeOff,
  LockKeyhole,
  Mail,
  Scissors,
  ShieldCheck,
  UserPlus,
} from 'lucide-react-native';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ActionButton, InlineMessage, palette } from '@/components/ui';
import { useSession } from '@/lib/session';
import { authenticateWithGoogle } from '@/lib/google-auth';
import { authErrorMessage } from '@/lib/auth-message';
import { publicSiteUrl } from '@/lib/links';
import { supabase } from '@/lib/supabase';

type AuthMode = 'options' | 'sign-in' | 'sign-up' | 'reset';

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function SignInScreen() {
  const insets = useSafeAreaInsets();
  const { session, role, profileComplete, loading, roleError, refreshRole } = useSession();
  const [mode, setMode] = useState<AuthMode>('options');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [confirmationPending, setConfirmationPending] = useState(false);

  useEffect(() => {
    if (!session || loading) return;
    if (role === 'client') router.replace(profileComplete ? '/client' : '/complete-profile');
    if (role === 'barber') router.replace('/barber');
    if (role === 'unsupported') router.replace('/');
  }, [loading, profileComplete, role, session]);

  function changeMode(nextMode: AuthMode) {
    setMode(nextMode);
    setPassword('');
    setPasswordVisible(false);
    setError('');
    setMessage('');
    setConfirmationPending(false);
  }

  function normalizedEmail() {
    const value = email.trim().toLowerCase();
    if (!emailPattern.test(value)) {
      setError('Escribe un correo electrónico válido.');
      return null;
    }
    return value;
  }

  function confirmationRedirectTo() {
    return Platform.OS === 'web'
      ? `${publicSiteUrl.replace(/\/$/, '')}/auth/callback`
      : Linking.createURL('auth/callback');
  }

  async function resendSignupConfirmation() {
    const address = normalizedEmail();
    if (!address) return;

    setBusy(true);
    setError('');
    setMessage('');
    try {
      const { error: resendError } = await supabase.auth.resend({
        type: 'signup',
        email: address,
        options: { emailRedirectTo: confirmationRedirectTo() },
      });
      if (resendError) throw resendError;
      setMessage(`Solicitamos otro enlace para ${address}. Revisa tu bandeja de entrada y spam.`);
    } catch (reason) {
      setError(authErrorMessage(reason, 'No pudimos reenviar el correo de confirmación.'));
    } finally {
      setBusy(false);
    }
  }

  async function submitEmailAuth() {
    const address = normalizedEmail();
    if (!address) return;
    if (mode !== 'reset' && password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres.');
      return;
    }

    setBusy(true);
    setError('');
    setMessage('');
    try {
      if (mode === 'reset') {
        const redirectTo = Platform.OS === 'web'
          ? `${publicSiteUrl.replace(/\/$/, '')}/auth/callback?next=%2Freset-password`
          : Linking.createURL('auth/reset-password');
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(address, { redirectTo });
        if (resetError) throw resetError;
        setMessage('Te enviamos un enlace para crear una contraseña nueva. Revisa tu correo y la carpeta de spam.');
        return;
      }

      if (mode === 'sign-up') {
        const emailRedirectTo = confirmationRedirectTo();
        const { data, error: signUpError } = await supabase.auth.signUp({
          email: address,
          password,
          options: { emailRedirectTo },
        });
        if (signUpError) throw signUpError;

        if (data.user?.identities?.length === 0) {
          setMode('sign-in');
          setPassword('');
          setError('Ese correo ya tiene una cuenta. Inicia sesión con tu contraseña o usa Google.');
          return;
        }

        if (!data.session) {
          setConfirmationPending(true);
          setMessage(`La cuenta se creó. Confirma el correo enviado a ${address} y vuelve para iniciar sesión.`);
        }
        return;
      }

      const { error: signInError } = await supabase.auth.signInWithPassword({ email: address, password });
      if (signInError) throw signInError;
    } catch (reason) {
      if (mode !== 'reset' && reason instanceof Error && reason.message.toLowerCase().includes('email not confirmed')) {
        setConfirmationPending(true);
      }
      setError(authErrorMessage(reason, mode === 'reset'
        ? 'No pudimos enviar el enlace de recuperación.'
        : mode === 'sign-up'
          ? 'No pudimos crear tu cuenta.'
          : 'No pudimos iniciar sesión.'));
    } finally {
      setBusy(false);
    }
  }

  async function signInWithGoogle() {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const result = await authenticateWithGoogle();
      if (result === 'cancelled') setMessage('Acceso cancelado. Puedes intentarlo cuando quieras.');
    } catch (reason) {
      setError(authErrorMessage(reason, 'No pudimos iniciar con Google.'));
    } finally {
      setBusy(false);
    }
  }

  const showSessionLoader = Boolean(session && loading);
  const isSignUp = mode === 'sign-up';
  const isReset = mode === 'reset';
  const isEmailForm = mode !== 'options';
  const title = isReset
    ? 'Recupera tu acceso'
    : isSignUp
      ? 'Crea tu cuenta'
      : mode === 'sign-in'
        ? 'Qué bueno verte.'
        : 'Tu próxima cita empieza aquí.';
  const heading = isReset
    ? 'Restablecer contraseña'
    : isSignUp
      ? 'Únete a Legend Club'
      : mode === 'sign-in'
        ? 'Iniciar sesión'
        : 'Entra a tu cuenta';

  return (
    <View style={styles.safe}>
      <KeyboardAvoidingView
        style={[styles.keyboard, {
          paddingTop: insets.top,
          paddingBottom: insets.bottom,
          paddingLeft: insets.left,
          paddingRight: insets.right,
        }]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentInsetAdjustmentBehavior="never"
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled">
          <View style={styles.container}>
            <Animated.View entering={FadeInUp.duration(650)} style={styles.hero}>
              <View style={styles.brandRow}>
                <View style={styles.brandMark} accessibilityLabel="LEGEND CLUB">
                  <Scissors size={24} color="#E5E9EF" strokeWidth={1.7} />
                </View>
                <View style={styles.brandLockup}>
                  <Text style={styles.wordmark}>LEGEND CLUB</Text>
                  <Text style={styles.caption}>BARBER-SHOP</Text>
                </View>
              </View>
              <View style={styles.heroCopy}>
                <Text style={styles.heroEyebrow}>{isReset ? 'RECUPERACIÓN SEGURA' : isSignUp ? 'CREA TU CUENTA' : mode === 'sign-in' ? 'ACCESO CON CORREO' : 'TU ESPACIO PERSONAL'}</Text>
                <Text style={styles.heroTitle}>{title}</Text>
              </View>
              <View style={styles.trustLine}>
                <ShieldCheck size={14} color={palette.gold} />
                <Text style={styles.trustText}>Acceso seguro a tu cuenta</Text>
              </View>
            </Animated.View>

            <Animated.View key={mode} entering={FadeInDown.duration(350)} style={styles.card}>
              <View style={styles.cardHeading}>
                <View style={styles.cardIcon}>
                  {isReset ? <Mail size={19} color={palette.gold} /> : isSignUp ? <UserPlus size={19} color={palette.gold} /> : isEmailForm ? <LockKeyhole size={19} color={palette.gold} /> : <Scissors size={19} color={palette.gold} />}
                </View>
                <View style={styles.cardHeadingCopy}>
                  <Text style={styles.cardEyebrow}>{isReset ? 'RECUPERAR CUENTA' : isSignUp ? 'NUEVO CLIENTE' : isEmailForm ? 'ACCESO CON CORREO' : 'BIENVENIDO'}</Text>
                  <Text style={styles.cardTitle}>{heading}</Text>
                </View>
              </View>

              <Text style={styles.description}>
                {isReset
                  ? 'Escribe el correo de tu cuenta. Si usas Google, el enlace te permitirá crear una contraseña de LEGEND CLUB; no cambiará tu contraseña de Google.'
                  : isSignUp
                    ? 'Regístrate una sola vez para reservar y administrar tus citas.'
                    : mode === 'sign-in'
                    ? 'Usa tu contraseña de LEGEND CLUB. Si creaste tu cuenta con Google, entra con Google o define una contraseña desde «¿Olvidaste tu contraseña?».'
                      : 'Elige una forma rápida y segura de continuar.'}
              </Text>

              {isEmailForm ? (
                <Animated.View entering={FadeInDown.duration(250)} style={styles.form}>
                  <View style={styles.field}>
                    <Text style={styles.fieldLabel}>Correo electrónico</Text>
                    <View style={styles.inputFrame}>
                      <Mail size={17} color={palette.muted} />
                      <TextInput
                        value={email}
                        onChangeText={(value) => { setEmail(value); setError(''); setMessage(''); setConfirmationPending(false); }}
                        placeholder="tu@correo.com"
                        placeholderTextColor={palette.muted}
                        keyboardType="email-address"
                        autoCapitalize="none"
                        autoCorrect={false}
                        autoComplete="email"
                        textContentType="emailAddress"
                        returnKeyType={isReset ? 'send' : 'next'}
                        onSubmitEditing={() => { if (isReset) void submitEmailAuth(); }}
                        editable={!busy}
                        accessibilityLabel="Correo electrónico"
                        style={styles.input}
                      />
                    </View>
                  </View>

                  {!isReset ? (
                    <View style={styles.field}>
                      <Text style={styles.fieldLabel}>Contraseña</Text>
                      <View style={styles.inputFrame}>
                        <LockKeyhole size={17} color={palette.muted} />
                        <TextInput
                          value={password}
                          onChangeText={(value) => { setPassword(value); setError(''); setMessage(''); setConfirmationPending(false); }}
                          placeholder={isSignUp ? 'Crea una contraseña segura' : 'Tu contraseña'}
                          placeholderTextColor={palette.muted}
                          autoCapitalize="none"
                          autoCorrect={false}
                          autoComplete={isSignUp ? 'new-password' : 'current-password'}
                          textContentType={isSignUp ? 'newPassword' : 'password'}
                          secureTextEntry={!passwordVisible}
                          returnKeyType="done"
                          onSubmitEditing={() => void submitEmailAuth()}
                          editable={!busy}
                          accessibilityLabel="Contraseña"
                          style={styles.input}
                        />
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={passwordVisible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                          onPress={() => setPasswordVisible((visible) => !visible)}
                          hitSlop={10}
                          style={styles.visibilityButton}>
                          {passwordVisible ? <EyeOff size={18} color={palette.muted} /> : <Eye size={18} color={palette.muted} />}
                        </Pressable>
                      </View>
                      {isSignUp ? <Text style={styles.fieldHint}>Usa al menos 8 caracteres.</Text> : null}
                    </View>
                  ) : null}

                  {error ? <InlineMessage>{error}</InlineMessage> : null}
                  {message ? <InlineMessage tone="success">{message}</InlineMessage> : null}
                  {confirmationPending && !isReset ? (
                    <Pressable disabled={busy} onPress={() => void resendSignupConfirmation()} hitSlop={8} style={styles.forgotLink}>
                      <Text style={styles.textLink}>Reenviar correo de confirmación</Text>
                    </Pressable>
                  ) : null}
                  {session && roleError ? (
                    <>
                      <InlineMessage>{roleError}</InlineMessage>
                      <ActionButton label="Reintentar validación" onPress={() => void refreshRole()} tone="secondary" loading={loading} />
                    </>
                  ) : null}
                  {showSessionLoader ? (
                    <View style={styles.loadingRow}>
                      <ActivityIndicator color={palette.gold} />
                      <Text style={styles.loadingText}>Validando tu cuenta…</Text>
                    </View>
                  ) : (
                    <ActionButton
                      label={isReset ? 'Enviarme enlace' : isSignUp ? 'Crear cuenta' : 'Iniciar sesión'}
                      icon={isReset ? Mail : isSignUp ? UserPlus : ArrowRight}
                      onPress={() => void submitEmailAuth()}
                      disabled={isSignUp && Boolean(message)}
                      loading={busy}
                    />
                  )}

                  {!isReset && !isSignUp ? (
                    <Pressable disabled={busy} onPress={() => changeMode('reset')} hitSlop={8} style={styles.forgotLink}>
                      <Text style={styles.textLink}>¿Olvidaste tu contraseña?</Text>
                    </Pressable>
                  ) : null}

                  {isReset ? (
                    <Pressable disabled={busy} onPress={() => changeMode('sign-in')} hitSlop={8} style={styles.backLink}>
                      <ArrowLeft size={14} color={palette.gold} />
                      <Text style={styles.textLink}>Volver a iniciar sesión</Text>
                    </Pressable>
                  ) : (
                    <View style={styles.switchMode}>
                      <Text style={styles.switchModeText}>{isSignUp ? '¿Ya tienes una cuenta?' : '¿Es tu primera vez?'}</Text>
                      <Pressable
                        disabled={busy}
                        onPress={() => changeMode(isSignUp ? 'sign-in' : 'sign-up')}
                        hitSlop={8}>
                        <Text style={styles.textLink}>{isSignUp ? 'Inicia sesión' : 'Crear cuenta'}</Text>
                      </Pressable>
                    </View>
                  )}

                  {!isReset ? (
                    <Pressable disabled={busy} onPress={() => changeMode('options')} hitSlop={8} style={styles.backLink}>
                      <ArrowLeft size={14} color={palette.muted} />
                      <Text style={styles.backText}>Otras opciones de acceso</Text>
                    </Pressable>
                  ) : null}
                </Animated.View>
              ) : (
                <>
                  {error ? <InlineMessage>{error}</InlineMessage> : null}
                  {message ? <InlineMessage tone="success">{message}</InlineMessage> : null}
                  {showSessionLoader ? (
                    <View style={styles.loadingRow}>
                      <ActivityIndicator color={palette.gold} />
                      <Text style={styles.loadingText}>Validando tu cuenta…</Text>
                    </View>
                  ) : (
                    <>
                      <Pressable
                        accessibilityRole="button"
                        disabled={busy}
                        onPress={() => void signInWithGoogle()}
                        style={({ pressed }) => [styles.googleButton, pressed && styles.pressed, busy && styles.disabled]}>
                        {busy ? <ActivityIndicator color="#171A1F" /> : <View style={styles.googleMark}><Text style={styles.googleG}>G</Text></View>}
                        <Text style={styles.googleLabel}>{busy ? 'Conectando con Google…' : 'Continuar con Google'}</Text>
                        <View style={styles.buttonEnd}><ArrowRight size={16} color="#626B76" /></View>
                      </Pressable>
                      <View style={styles.separator}><View style={styles.separatorLine} /><Text style={styles.separatorText}>O TAMBIÉN</Text><View style={styles.separatorLine} /></View>
                      <ActionButton label="Iniciar con correo" icon={Mail} onPress={() => changeMode('sign-in')} />
                    </>
                  )}
                  {session && roleError ? <><InlineMessage>{roleError}</InlineMessage><ActionButton label="Reintentar" onPress={() => void refreshRole()} tone="secondary" loading={loading} /></> : null}
                </>
              )}
            </Animated.View>

            <View style={styles.footer}>
              <Check size={12} color={palette.gold} />
              <Text style={styles.footerText}>CORTES · ESTILO · BUEN SERVICIO</Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0B0D10' },
  keyboard: { flex: 1 },
  scrollContent: { flexGrow: 1 },
  container: { flex: 1, width: '100%', maxWidth: 520, alignSelf: 'center', justifyContent: 'center', paddingHorizontal: 25, paddingTop: 26, paddingBottom: 24, gap: 24 },
  hero: { gap: 22, paddingTop: 4 },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 13 },
  brandMark: { width: 54, height: 54, borderRadius: 16, backgroundColor: '#20242A', borderColor: '#343A43', borderWidth: 1, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  brandLockup: { alignItems: 'flex-start', gap: 4 },
  wordmark: { color: '#F2F4F7', fontSize: 13, fontWeight: '900', letterSpacing: 2.4 },
  caption: { color: '#929AA5', fontSize: 8, fontWeight: '800', letterSpacing: 1.8 },
  heroCopy: { gap: 8 },
  heroEyebrow: { color: '#AAB2BC', fontSize: 9, fontWeight: '900', letterSpacing: 2 },
  heroTitle: { color: '#F2F4F7', fontSize: 35, lineHeight: 40, fontWeight: '800', letterSpacing: -1, maxWidth: 400 },
  trustLine: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  trustText: { color: '#ADB5BF', fontSize: 10, fontWeight: '600', letterSpacing: 0.2 },
  card: { borderRadius: 22, borderWidth: 1, borderColor: '#2D333B', backgroundColor: '#15181C', padding: 20, gap: 16, shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 24, shadowOffset: { width: 0, height: 10 }, elevation: 6 },
  cardHeading: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  cardIcon: { width: 43, height: 43, borderRadius: 14, backgroundColor: '#20242A', borderWidth: 1, borderColor: '#343A43', alignItems: 'center', justifyContent: 'center' },
  cardHeadingCopy: { flex: 1, gap: 3 },
  cardEyebrow: { color: '#AAB2BC', fontSize: 8, fontWeight: '900', letterSpacing: 1.8 },
  cardTitle: { color: '#F2F4F7', fontSize: 20, lineHeight: 25, fontWeight: '800', letterSpacing: -0.4 },
  description: { color: '#A4ACB6', fontSize: 12, lineHeight: 18 },
  form: { gap: 14 },
  field: { gap: 8 },
  fieldLabel: { color: '#E4E8ED', fontSize: 12, fontWeight: '700' },
  fieldHint: { color: '#89929E', fontSize: 10, marginTop: -3 },
  inputFrame: { minHeight: 52, borderRadius: 14, borderWidth: 1, borderColor: '#343A43', backgroundColor: '#20242A', paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', gap: 10 },
  input: { flex: 1, minWidth: 0, minHeight: 50, paddingVertical: 0, color: '#F2F4F7', fontSize: 14 },
  visibilityButton: { width: 30, height: 42, alignItems: 'center', justifyContent: 'center' },
  forgotLink: { alignSelf: 'flex-end', marginTop: -6 },
  switchMode: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 5, flexWrap: 'wrap' },
  switchModeText: { color: '#A4ACB6', fontSize: 11 },
  textLink: { color: '#E0E5EB', fontSize: 11, fontWeight: '800', paddingVertical: 4 },
  backLink: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 28 },
  backText: { color: '#9AA2AC', fontSize: 11, fontWeight: '700', paddingVertical: 4 },
  googleButton: { minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingHorizontal: 14, borderRadius: 14, backgroundColor: '#F2F4F7', borderWidth: 1, borderColor: '#F2F4F7' },
  googleMark: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  googleG: { color: '#4285F4', fontSize: 15, fontWeight: '900' },
  googleLabel: { flex: 1, color: '#171A1F', fontSize: 13, fontWeight: '800', textAlign: 'center' },
  buttonEnd: { width: 23, alignItems: 'center' },
  separator: { flexDirection: 'row', alignItems: 'center', gap: 11, marginVertical: 1 },
  separatorLine: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: '#343A43' },
  separatorText: { color: '#777F8A', fontSize: 8, fontWeight: '900', letterSpacing: 1.5 },
  loadingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, minHeight: 48 },
  loadingText: { color: '#BBC2CC', fontSize: 12, fontWeight: '600' },
  footer: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start' },
  footerText: { color: '#727A85', fontSize: 8, fontWeight: '800', letterSpacing: 1.8, textAlign: 'center' },
  pressed: { opacity: 0.82, transform: [{ scale: 0.99 }] },
  disabled: { opacity: 0.55 },
});
