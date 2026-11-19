import { useCallback, useEffect, useState } from 'react';
import { router, useFocusEffect } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { Bell, BellRing } from 'lucide-react-native';
import { AppState, Linking, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppShell } from '@/components/AppShell';
import { ClientPageHeader } from '@/components/ClientPageHeader';
import { ActionButton, Card, CardTitle, InlineMessage, LoadingState, SwitchRow } from '@/components/ui';
import { useSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';
import { useRemoteData } from '@/lib/utils';

type Preferences = { appointment_notifications: boolean; promotion_notifications: boolean; chat_notifications: boolean; system_notifications: boolean; muted_all: boolean };
const defaultPreferences: Preferences = { appointment_notifications: true, promotion_notifications: true, chat_notifications: true, system_notifications: true, muted_all: false };

export default function ClientNotificationSettingsScreen() {
  const { session } = useSession();
  const insets = useSafeAreaInsets();
  const headerHeight = insets.top + 76;
  const userId = session?.user.id ?? '';
  const [preferences, setPreferences] = useState(defaultPreferences);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [permission, setPermission] = useState<Notifications.NotificationPermissionsStatus | null>(null);
  const [permissionLoading, setPermissionLoading] = useState(false);
  const query = useRemoteData<Preferences>(async () => {
    if (!userId) throw new Error('Inicia sesión para configurar tus notificaciones.');
    const result = await supabase.from('notification_preferences').select('appointment_notifications,promotion_notifications,chat_notifications,system_notifications,muted_all').eq('user_id', userId).maybeSingle();
    if (result.error) throw new Error(result.error.message);
    const next = { ...defaultPreferences, ...result.data };
    setPreferences(next);
    return next;
  }, userId);

  const loadDevicePermission = useCallback(async () => {
    if (Platform.OS === 'web') return;
    setPermissionLoading(true);
    try {
      // Read the OS permission independently: channel setup can fail in Expo Go
      // and must not make the permission look unavailable.
      const result = await Notifications.getPermissionsAsync();
      setPermission(result);
      setMessage('');
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('client-updates-v1', {
          name: 'Avisos de LEGEND CLUB',
          importance: Notifications.AndroidImportance.HIGH,
          vibrationPattern: [0, 220, 120, 220],
          sound: 'default',
        }).catch(() => undefined);
      }
    } catch {
      setMessage('No se pudo consultar el permiso. Pulsa el control para solicitarlo o revisa los ajustes del teléfono.');
    } finally {
      setPermissionLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    void loadDevicePermission();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void loadDevicePermission();
    });
    return () => subscription.remove();
  }, [loadDevicePermission]));

  async function enableDeviceSound() {
    if (Platform.OS === 'web') {
      setMessage('El sonido de avisos está disponible en la aplicación móvil.');
      return;
    }
    setBusy(true);
    setMessage('');
    try {
      const current = permission ?? await Notifications.getPermissionsAsync();
      const next = current.granted || current.status === 'granted'
        ? current
        : current.canAskAgain
          ? await Notifications.requestPermissionsAsync()
          : null;
      if (next) {
        setPermission(next);
        setMessage(next.granted ? 'Las notificaciones están activas en este teléfono.' : 'No se concedió el permiso. Puedes activarlo en los ajustes del teléfono.');
      } else {
        await Linking.openSettings();
        setMessage('Activa las notificaciones en los ajustes del teléfono y vuelve a esta pantalla.');
      }
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : 'No se pudo activar el sonido de avisos.');
    } finally {
      setBusy(false);
    }
  }

  async function toggleDevicePermission(enabled: boolean) {
    if (enabled) {
      await enableDeviceSound();
      return;
    }
    setMessage('Android no permite quitar este permiso desde la app. Abre los ajustes del teléfono para desactivarlo.');
    try {
      await Linking.openSettings();
    } catch {
      setMessage('Abre los ajustes del teléfono y desactiva las notificaciones de LEGEND CLUB.');
    }
  }

  async function savePreferences() {
    if (!userId) return;
    setBusy(true);
    setMessage('');
    try {
      const { error } = await supabase.from('notification_preferences').upsert({
        user_id: userId,
        ...preferences,
        system_notifications: true,
        updated_at: new Date().toISOString(),
      });
      if (error) throw error;
      setMessage('Preferencias guardadas.');
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : 'No se pudieron guardar tus preferencias.');
    } finally {
      setBusy(false);
    }
  }

  const deviceSoundEnabled = Boolean(permission?.granted || permission?.status === 'granted');

  return (
    <AppShell title="Configuración de avisos" roleLabel="CUENTA PERSONAL" tabs={[]} onRefresh={query.refresh} refreshing={query.loading}
      floatingHeaderHeight={headerHeight}
      floatingHeader={(scrollY) => <ClientPageHeader scrollY={scrollY} expandedHeight={headerHeight} title="Configuración de avisos" description="" compact onBack={() => router.replace('/client/profile')} showChat={false} />}>
      {query.error || message ? <InlineMessage tone={message.includes('guardadas') || message.includes('activas en este teléfono') || message.includes('Android no permite quitar') ? 'success' : 'error'}>{message || query.error}</InlineMessage> : null}
      {!query.data && query.loading ? <LoadingState title="Cargando tus preferencias…" /> : null}
      {query.data ? <>
        <Card>
          <CardTitle icon={BellRing} title="Sonido en este teléfono" subtitle="Los avisos nuevos pueden sonar mientras usas la app. El teléfono debe permitir sus notificaciones." />
          {Platform.OS === 'web'
            ? <InlineMessage tone="info">El sonido de avisos está disponible en la aplicación móvil.</InlineMessage>
            : <SwitchRow
              label="Notificaciones de este teléfono"
              description={permissionLoading ? 'Consultando permiso…' : deviceSoundEnabled ? 'Permitidas en los ajustes del teléfono' : 'Desactivadas en los ajustes del teléfono'}
              value={deviceSoundEnabled}
              disabled={busy || permissionLoading}
              onValueChange={(value) => void toggleDevicePermission(value)}
            />}
          {!permission && !permissionLoading && Platform.OS !== 'web'
            ? <ActionButton label="Consultar o solicitar permiso" icon={Bell} loading={busy} onPress={() => void enableDeviceSound()} />
            : null}
        </Card>
        <Card>
          <CardTitle icon={Bell} title="Tipos de avisos" subtitle="Elige qué novedades quieres recibir." />
          <SwitchRow label="Avisos de citas" value={preferences.appointment_notifications} disabled={busy} onValueChange={(value) => setPreferences((previous) => ({ ...previous, appointment_notifications: value }))} />
          <SwitchRow label="Promociones y puntos" value={preferences.promotion_notifications} disabled={busy} onValueChange={(value) => setPreferences((previous) => ({ ...previous, promotion_notifications: value }))} />
          <SwitchRow label="Mensajes internos" value={preferences.chat_notifications} disabled={busy} onValueChange={(value) => setPreferences((previous) => ({ ...previous, chat_notifications: value }))} />
          <SwitchRow label="Silenciar todos los avisos" value={preferences.muted_all} disabled={busy} onValueChange={(value) => setPreferences((previous) => ({ ...previous, muted_all: value }))} />
          <ActionButton label="Guardar preferencias" loading={busy} onPress={() => void savePreferences()} />
        </Card>
      </> : null}
    </AppShell>
  );
}
