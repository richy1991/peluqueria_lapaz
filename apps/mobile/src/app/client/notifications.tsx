import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Bell, CheckCheck } from 'lucide-react-native';

import { AppShell } from '@/components/AppShell';
import { ActionButton, Card, CardTitle, EmptyState, InlineMessage, PageHeading, SwitchRow, palette } from '@/components/ui';
import { clientTabs } from '@/lib/navigation';
import { useSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';
import { formatDate, requireData, useRemoteData } from '@/lib/utils';

type NotificationItem = { id: string; title: string; body: string; read_at: string | null; created_at: string };
type Preferences = { appointment_notifications: boolean; promotion_notifications: boolean; chat_notifications: boolean; system_notifications: boolean; muted_all: boolean };
type NotificationData = { notifications: NotificationItem[]; preferences: Preferences };
const defaultPreferences: Preferences = { appointment_notifications: true, promotion_notifications: true, chat_notifications: true, system_notifications: true, muted_all: false };

export default function ClientNotificationsScreen() {
  const { session } = useSession();
  const userId = session?.user.id ?? '';
  const [preferences, setPreferences] = useState(defaultPreferences);
  const [message, setMessage] = useState('');
  const [busyId, setBusyId] = useState('');
  const query = useRemoteData<NotificationData>(async () => {
    if (!userId) throw new Error('Inicia sesión para consultar las notificaciones.');
    const [notificationsResult, preferencesResult] = await Promise.all([
      supabase.from('notifications').select('id,title,body,read_at,created_at').eq('user_id', userId).order('created_at', { ascending: false }).limit(50),
      supabase.from('notification_preferences').select('appointment_notifications,promotion_notifications,chat_notifications,system_notifications,muted_all').eq('user_id', userId).maybeSingle(),
    ]);
    if (preferencesResult.error) throw new Error(preferencesResult.error.message);
    const data = { notifications: requireData(notificationsResult), preferences: { ...defaultPreferences, ...preferencesResult.data } };
    setPreferences(data.preferences);
    return data;
  }, userId);

  async function savePreferences() {
    if (!userId) return;
    setBusyId('preferences');
    setMessage('');
    const { error } = await supabase.from('notification_preferences').upsert({
      user_id: userId,
      ...preferences,
      system_notifications: true,
      updated_at: new Date().toISOString(),
    });
    setBusyId('');
    setMessage(error?.message ?? 'Preferencias guardadas.');
  }

  async function markRead(item: NotificationItem) {
    if (item.read_at) return;
    setBusyId(item.id);
    const { error } = await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', item.id).eq('user_id', userId);
    setBusyId('');
    if (error) { setMessage(error.message); return; }
    query.refresh();
  }

  return (
    <AppShell title="Notificaciones" roleLabel="CENTRO DE AVISOS" tabs={clientTabs} backHref="/client" onRefresh={query.refresh} refreshing={query.loading}>
      <PageHeading eyebrow="Centro de avisos" title="Notificaciones" description="Revisa actualizaciones de citas y decide qué comunicaciones quieres recibir." />
      {query.error || message ? <InlineMessage tone={message.includes('guardadas') ? 'success' : 'error'}>{message || query.error}</InlineMessage> : null}

      <Card>
        <CardTitle icon={Bell} title="Avisos recientes" subtitle="Toca un aviso para marcarlo como leído." />
        {query.data?.notifications.length ? query.data.notifications.map((item) => (
          <View key={item.id} style={[styles.notification, !item.read_at && styles.unread]}>
            <View style={styles.notificationCopy}>
              <Text style={styles.itemTitle}>{item.title}</Text>
              <Text style={styles.body}>{item.body}</Text>
              <Text style={styles.date}>{formatDate(item.created_at, { dateStyle: 'medium', timeZone: 'America/La_Paz' })}</Text>
            </View>
            {!item.read_at ? <ActionButton label="Leído" icon={CheckCheck} tone="secondary" compact loading={busyId === item.id} onPress={() => void markRead(item)} /> : null}
          </View>
        )) : <EmptyState title="No tienes avisos" description="Cuando haya novedades, aparecerán aquí." />}
      </Card>

      <Card>
        <CardTitle icon={Bell} title="Preferencias" subtitle="Elige qué avisos quieres recibir." />
        <SwitchRow label="Avisos de citas" value={preferences.appointment_notifications} onValueChange={(value) => setPreferences((previous) => ({ ...previous, appointment_notifications: value }))} />
        <SwitchRow label="Promociones y puntos" value={preferences.promotion_notifications} onValueChange={(value) => setPreferences((previous) => ({ ...previous, promotion_notifications: value }))} />
        <SwitchRow label="Mensajes internos" value={preferences.chat_notifications} onValueChange={(value) => setPreferences((previous) => ({ ...previous, chat_notifications: value }))} />
        <SwitchRow label="Silenciar avisos secundarios" value={preferences.muted_all} onValueChange={(value) => setPreferences((previous) => ({ ...previous, muted_all: value }))} />
        <ActionButton label="Guardar preferencias" loading={busyId === 'preferences'} onPress={() => void savePreferences()} />
      </Card>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  notification: { flexDirection: 'row', alignItems: 'center', gap: 10, borderTopColor: palette.border, borderTopWidth: StyleSheet.hairlineWidth, paddingVertical: 12 },
  unread: { borderLeftColor: palette.gold, borderLeftWidth: 2, paddingLeft: 9 },
  notificationCopy: { flex: 1, gap: 5 },
  itemTitle: { color: palette.text, fontSize: 13, fontWeight: '800' },
  body: { color: palette.muted, fontSize: 12, lineHeight: 17 },
  date: { color: '#81766c', fontSize: 10 },
});
