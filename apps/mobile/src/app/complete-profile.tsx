import { useEffect, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { Phone, UserRound } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ActionButton, InlineMessage, palette } from '@/components/ui';
import { useSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';
import { useRemoteData } from '@/lib/utils';

type ProfileContact = { full_name: string | null; phone: string | null };

export default function CompleteProfileScreen() {
  const { session, role, profileComplete, loading, roleError, refreshRole } = useSession();
  const userId = session?.user.id ?? '';
  const profileQuery = useRemoteData<ProfileContact | null>(async () => {
    if (!userId) return null;
    const { data, error } = await supabase.from('profiles').select('full_name,phone').eq('id', userId).maybeSingle();
    if (error) throw new Error(error.message);
    return data;
  }, userId);

  useEffect(() => {
    if (loading) return;
    if (!session) router.replace('/sign-in');
    else if (role === 'barber' || role === 'unsupported') router.replace('/');
    else if (role === 'client' && profileComplete) router.replace('/client');
  }, [loading, profileComplete, role, session]);

  if (loading || !session) {
    return <View style={styles.loadingScreen}><ActivityIndicator color={palette.gold} /></View>;
  }

  if (roleError) {
    return (
      <View style={styles.loadingScreen}>
        <InlineMessage>{roleError}</InlineMessage>
        <ActionButton label="Reintentar validación" onPress={() => void refreshRole()} />
      </View>
    );
  }

  if (role !== 'client' || profileComplete) {
    return <View style={styles.loadingScreen}><ActivityIndicator color={palette.gold} /></View>;
  }

  if (profileQuery.loading) {
    return <View style={styles.loadingScreen}><ActivityIndicator color={palette.gold} /></View>;
  }

  if (profileQuery.error) {
    return (
      <View style={styles.loadingScreen}>
        <InlineMessage>{profileQuery.error}</InlineMessage>
        <ActionButton label="Volver a intentar" onPress={profileQuery.refresh} />
      </View>
    );
  }

  return (
    <ProfileForm
      key={`${userId}-${profileQuery.generation}`}
      initialName={profileQuery.data?.full_name || String(session.user.user_metadata?.full_name ?? '')}
      initialPhone={profileQuery.data?.phone ?? ''}
      onSaved={refreshRole}
    />
  );
}

function ProfileForm({ initialName, initialPhone, onSaved }: { initialName: string; initialPhone: string; onSaved: () => Promise<void> }) {
  const insets = useSafeAreaInsets();
  const { session } = useSession();
  const [fullName, setFullName] = useState(initialName);
  const [phone, setPhone] = useState(initialPhone);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function saveProfile() {
    const normalizedName = fullName.trim().replace(/\s+/g, ' ');
    const nameParts = normalizedName.split(' ').filter(Boolean);
    const normalizedPhone = phone.replace(/\D/g, '');
    if (nameParts.length < 2) {
      setError('Escribe tu nombre y apellido.');
      return;
    }
    if (normalizedPhone.length < 7 || normalizedPhone.length > 15) {
      setError('Escribe un número válido, entre 7 y 15 dígitos.');
      return;
    }
    if (!session?.user.id) {
      router.replace('/sign-in');
      return;
    }

    setBusy(true);
    setError('');
    try {
      const { data, error: updateError } = await supabase
        .from('profiles')
        .update({ full_name: normalizedName, phone: phone.trim(), phone_normalized: normalizedPhone, updated_at: new Date().toISOString() })
        .eq('id', session.user.id)
        .select('id')
        .maybeSingle();
      if (updateError) throw updateError;
      if (!data) throw new Error('No encontramos tu perfil para guardar estos datos. Cierra sesión y vuelve a entrar.');
      await onSaved();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No pudimos guardar tu perfil. Inténtalo de nuevo.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.screen}>
      <KeyboardAvoidingView
        style={[styles.keyboard, { paddingTop: insets.top, paddingBottom: insets.bottom, paddingLeft: insets.left, paddingRight: insets.right }]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <View style={styles.content}>
            <View style={styles.brandMark}><UserRound size={23} color="#E5E9EF" strokeWidth={1.7} /></View>
            <Text style={styles.eyebrow}>UN ÚLTIMO PASO</Text>
            <Text style={styles.title}>Completa tu perfil</Text>
            <Text style={styles.description}>Usaremos tu nombre y teléfono para identificar tus reservas y contactarte sobre tus citas.</Text>

            <View style={styles.card}>
              <View style={styles.field}>
                <Text style={styles.label}>Nombre completo</Text>
                <View style={styles.inputFrame}>
                  <UserRound size={17} color={palette.muted} />
                  <TextInput
                    value={fullName}
                    onChangeText={(value) => { setFullName(value); setError(''); }}
                    placeholder="Nombre y apellido"
                    placeholderTextColor={palette.muted}
                    autoCapitalize="words"
                    autoCorrect={false}
                    autoComplete="name"
                    textContentType="name"
                    returnKeyType="next"
                    editable={!busy}
                    accessibilityLabel="Nombre completo"
                    style={styles.input}
                  />
                </View>
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>Número de teléfono</Text>
                <View style={styles.inputFrame}>
                  <Phone size={17} color={palette.muted} />
                  <TextInput
                    value={phone}
                    onChangeText={(value) => { setPhone(value); setError(''); }}
                    placeholder="Ej. 720 12345"
                    placeholderTextColor={palette.muted}
                    keyboardType="phone-pad"
                    autoComplete="tel"
                    textContentType="telephoneNumber"
                    maxLength={20}
                    returnKeyType="done"
                    onSubmitEditing={() => void saveProfile()}
                    editable={!busy}
                    accessibilityLabel="Número de teléfono"
                    style={styles.input}
                  />
                </View>
                <Text style={styles.hint}>Solo lo usaremos para coordinar tus reservas.</Text>
              </View>

              {error ? <InlineMessage>{error}</InlineMessage> : null}
              <ActionButton label="Guardar y continuar" icon={UserRound} onPress={() => void saveProfile()} loading={busy} />
            </View>
            <Text style={styles.footer}>TUS DATOS SE GUARDAN DE FORMA SEGURA</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#0B0D10' },
  keyboard: { flex: 1 },
  scrollContent: { flexGrow: 1, justifyContent: 'center' },
  content: { width: '100%', maxWidth: 520, alignSelf: 'center', gap: 15, paddingHorizontal: 24, paddingVertical: 28 },
  brandMark: { width: 52, height: 52, alignItems: 'center', justifyContent: 'center', borderRadius: 16, borderWidth: 1, borderColor: '#343A43', backgroundColor: '#20242A' },
  eyebrow: { color: '#AAB2BC', fontSize: 9, fontWeight: '900', letterSpacing: 1.8, marginTop: 4 },
  title: { color: '#F2F4F7', fontSize: 30, lineHeight: 36, fontWeight: '800', letterSpacing: -0.7 },
  description: { color: '#A4ACB6', fontSize: 13, lineHeight: 20, marginBottom: 4 },
  card: { gap: 17, padding: 20, borderRadius: 22, borderWidth: 1, borderColor: '#2D333B', backgroundColor: '#15181C' },
  field: { gap: 8 },
  label: { color: '#E4E8ED', fontSize: 12, fontWeight: '700' },
  inputFrame: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 13, borderRadius: 14, borderWidth: 1, borderColor: '#343A43', backgroundColor: '#20242A' },
  input: { flex: 1, minWidth: 0, minHeight: 50, paddingVertical: 0, color: '#F2F4F7', fontSize: 14 },
  hint: { color: '#89929E', fontSize: 10, lineHeight: 15 },
  footer: { color: '#727A85', fontSize: 8, fontWeight: '800', letterSpacing: 1.5, textAlign: 'center', marginTop: 5 },
  loadingScreen: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 15, padding: 24, backgroundColor: '#0B0D10' },
});
