import { useState } from 'react';
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { ThemedText as Text } from '@/components/ThemedText';
import { ArrowLeft, Save } from 'lucide-react-native';

import { AppShell } from '@/components/AppShell';
import { ClientPageHeader, useClientHeaderHeight } from '@/components/ClientPageHeader';
import { ActionButton, Card, CardTitle, InlineMessage, LoadingState, TextField } from '@/components/ui';
import { useAppearance } from '@/lib/appearance';
import { clientTabs } from '@/lib/navigation';
import { useSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';
import { requireData, useRemoteData } from '@/lib/utils';

type EditableProfile = {
  full_name: string | null;
  email: string | null;
  phone: string | null;
  phone_normalized: string | null;
  phone_confirmed_at: string | null;
};
type ProfileDraft = { fullName: string; phone: string };

export default function ClientEditProfileScreen() {
  const { session } = useSession();
  const { colors } = useAppearance();
  const headerHeight = useClientHeaderHeight(220);
  const userId = session?.user.id ?? '';
  const [draft, setDraft] = useState<ProfileDraft | null>(null);
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const query = useRemoteData<EditableProfile>(async () => {
    if (!userId) throw new Error('Inicia sesión para editar tu perfil.');
    const result = await supabase.from('profiles').select('full_name,email,phone,phone_normalized,phone_confirmed_at').eq('id', userId).single();
    return requireData(result);
  }, userId);

  const fullName = draft?.fullName ?? query.data?.full_name ?? '';
  const phone = draft?.phone ?? query.data?.phone ?? '';

  async function saveProfile() {
    const name = fullName.trim();
    const cleanPhone = phone.trim();
    const normalizedPhone = cleanPhone.replace(/\D/g, '');
    if (name.length < 2 || name.length > 80) {
      setErrorMessage('Escribe un nombre de entre 2 y 80 caracteres.');
      return;
    }
    if (cleanPhone && (normalizedPhone.length < 7 || normalizedPhone.length > 15)) {
      setErrorMessage('El teléfono debe tener entre 7 y 15 dígitos, incluido el código de país si corresponde.');
      return;
    }
    if (!query.data) return;

    setBusy(true);
    setErrorMessage('');
    try {
      const currentPhone = query.data.phone_normalized || query.data.phone?.replace(/\D/g, '') || '';
      const { error } = await supabase.from('profiles').update({
        full_name: name,
        phone: cleanPhone || null,
        phone_normalized: normalizedPhone || null,
        phone_confirmed_at: normalizedPhone === currentPhone ? query.data.phone_confirmed_at : null,
        updated_at: new Date().toISOString(),
      }).eq('id', userId);
      if (error) throw error;
      router.back();
    } catch (reason) {
      setErrorMessage(reason instanceof Error ? reason.message : 'No se pudieron guardar los cambios. Revisa tu conexión.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell title="Editar perfil" roleLabel="CUENTA PERSONAL" activeTab="perfil" tabs={clientTabs} onRefresh={query.refresh} refreshing={query.loading}
      floatingHeaderHeight={headerHeight}
      floatingHeader={(scrollY) => <ClientPageHeader scrollY={scrollY} expandedHeight={headerHeight} eyebrow="CUENTA PERSONAL" title="Editar perfil" description="Actualiza el nombre y el teléfono de contacto de tu cuenta." />}>
      <View style={styles.pageBody}>
        {errorMessage ? <InlineMessage>{errorMessage}</InlineMessage> : null}
        {!query.data && query.loading ? <LoadingState title="Cargando tus datos…" /> : null}
        {query.error && !errorMessage ? <InlineMessage>{query.error}</InlineMessage> : null}
        {query.data ? <Card enteringDelay={100}>
          <CardTitle title="Datos personales" subtitle="Tu correo se mantiene como dato de acceso." />
          <TextField label="Nombre completo" value={fullName} onChangeText={(value) => setDraft((current) => ({ fullName: value, phone: current?.phone ?? query.data?.phone ?? '' }))} autoCapitalize="words" autoCorrect={false} maxLength={80} placeholder="Tu nombre" returnKeyType="next" />
          <TextField label="Número de teléfono" value={phone} onChangeText={(value) => setDraft((current) => ({ fullName: current?.fullName ?? query.data?.full_name ?? '', phone: value }))} keyboardType="phone-pad" maxLength={24} placeholder="Ej. +591 70000000" />
          <View style={styles.emailField}>
            <Text style={[styles.emailLabel, { color: colors.muted }]}>Correo electrónico</Text>
            <Text selectable style={[styles.emailValue, { color: colors.text }]}>{query.data.email || session?.user.email || 'No disponible'}</Text>
          </View>
          <ActionButton label="Guardar cambios" icon={Save} loading={busy} disabled={query.loading} onPress={() => void saveProfile()} />
          <ActionButton label="Cancelar" icon={ArrowLeft} tone="secondary" disabled={busy} onPress={() => router.back()} />
        </Card> : null}
      </View>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  pageBody: { paddingHorizontal: 16, paddingTop: 16, gap: 13 },
  emailField: { gap: 7 },
  emailLabel: { fontSize: 12, fontWeight: '700' },
  emailValue: { fontSize: 14, fontWeight: '600' },
});
