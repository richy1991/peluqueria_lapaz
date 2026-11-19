import { useState } from 'react';
import { router } from 'expo-router';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Bell, CheckCheck, Trash2 } from 'lucide-react-native';
import { ThemedText as Text } from '@/components/ThemedText';

import { AppShell } from '@/components/AppShell';
import { ClientPageHeader } from '@/components/ClientPageHeader';
import { ActionButton, Card, CardTitle, EmptyState, InlineMessage, LoadingState, palette } from '@/components/ui';
import { useSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';
import { formatDate, requireData, useRemoteData } from '@/lib/utils';

type NotificationItem = { id: string; title: string; body: string; read_at: string | null; created_at: string };

export default function ClientNotificationsScreen() {
  const { session } = useSession();
  const insets = useSafeAreaInsets();
  const headerHeight = insets.top + 76;
  const userId = session?.user.id ?? '';
  const [message, setMessage] = useState('');
  const [busyId, setBusyId] = useState('');
  const query = useRemoteData<NotificationItem[]>(async () => {
    if (!userId) throw new Error('Inicia sesión para consultar las notificaciones.');
    const result = await supabase.from('notifications').select('id,title,body,read_at,created_at').eq('user_id', userId).order('created_at', { ascending: false }).limit(50);
    return requireData(result);
  }, userId);

  async function markRead(item: NotificationItem) {
    if (item.read_at || !userId || busyId) return;
    setBusyId(item.id);
    setMessage('');
    try {
      const { error } = await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', item.id).eq('user_id', userId);
      if (error) throw error;
      setMessage('Aviso marcado como leído.');
      query.refresh();
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : 'No se pudo actualizar el aviso.');
    } finally {
      setBusyId('');
    }
  }

  async function markAllRead() {
    if (!userId || busyId) return;
    setBusyId('mark-all');
    setMessage('');
    try {
      const { error } = await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('user_id', userId).is('read_at', null);
      if (error) throw error;
      setMessage('Todas las notificaciones quedaron marcadas como leídas.');
      query.refresh();
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : 'No se pudieron marcar todas como leídas.');
    } finally {
      setBusyId('');
    }
  }

  async function deleteAll() {
    if (!userId || busyId) return;
    setBusyId('delete-all');
    setMessage('');
    try {
      const { error } = await supabase.from('notifications').delete().eq('user_id', userId);
      if (error) throw error;
      setMessage('Se eliminaron tus notificaciones.');
      query.refresh();
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : 'No se pudieron eliminar las notificaciones.');
    } finally {
      setBusyId('');
    }
  }

  function confirmDeleteAll() {
    Alert.alert('Eliminar notificaciones', 'Se borrarán todas las notificaciones de tu cuenta y no se podrán recuperar.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar todas', style: 'destructive', onPress: () => void deleteAll() },
    ]);
  }

  return (
    <AppShell title="Notificaciones" roleLabel="CENTRO DE AVISOS" onRefresh={query.refresh} refreshing={query.loading} tabs={[]}
      floatingHeaderHeight={headerHeight}
      floatingHeader={(scrollY) => <ClientPageHeader scrollY={scrollY} expandedHeight={headerHeight} title="Notificaciones" description="" compact onBack={() => router.replace('/client/profile')} showChat={false} />}>
      {query.error || message ? <InlineMessage tone={message.includes('marcadas como leídas') || message.includes('eliminaron') || message.includes('marcado como leído') ? 'success' : 'error'}>{message || query.error}</InlineMessage> : null}
      {!query.data && query.loading ? <LoadingState title="Cargando tus avisos…" /> : null}
      {query.data ? <Card>
        <CardTitle icon={Bell} title="Avisos recientes" subtitle="Mantén presionado un aviso sin leer para marcarlo como leído." />
        {query.data.length ? <>
          <View style={styles.bulkActions}>
            <View style={styles.bulkAction}><ActionButton label="Marcar todas" icon={CheckCheck} tone="secondary" compact loading={busyId === 'mark-all'} disabled={Boolean(busyId)} onPress={() => void markAllRead()} /></View>
            <View style={styles.bulkAction}><ActionButton label="Eliminar todas" icon={Trash2} tone="danger" compact loading={busyId === 'delete-all'} disabled={Boolean(busyId)} onPress={confirmDeleteAll} /></View>
          </View>
          {query.data.map((item) => (
            <View key={item.id} style={[styles.notification, !item.read_at && styles.unread]}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${item.title}. Mantén presionado para marcar como leído.`}
                accessibilityState={{ disabled: Boolean(item.read_at) || Boolean(busyId) }}
                delayLongPress={450}
                disabled={Boolean(item.read_at) || Boolean(busyId)}
                onLongPress={() => void markRead(item)}
                style={({ pressed }) => [styles.notificationCopy, pressed && styles.notificationPressed]}>
                <Text style={styles.itemTitle}>{item.title}</Text>
                <Text style={styles.body}>{item.body}</Text>
                <Text style={styles.date}>{formatDate(item.created_at, { dateStyle: 'medium', timeZone: 'America/La_Paz' })}</Text>
              </Pressable>
              {!item.read_at ? <ActionButton label="Leído" icon={CheckCheck} tone="secondary" compact loading={busyId === item.id} disabled={Boolean(busyId)} onPress={() => void markRead(item)} /> : null}
            </View>
          ))}
        </> : <EmptyState title="No tienes avisos" description="Cuando haya novedades, aparecerán aquí." />}
      </Card> : null}
    </AppShell>
  );
}

const styles = StyleSheet.create({
  bulkActions: { flexDirection: 'row', gap: 9 },
  bulkAction: { flex: 1, minWidth: 0 },
  notification: { flexDirection: 'row', alignItems: 'center', gap: 10, borderTopColor: palette.border, borderTopWidth: StyleSheet.hairlineWidth, paddingVertical: 12 },
  unread: { borderLeftColor: palette.gold, borderLeftWidth: 2, paddingLeft: 9 },
  notificationCopy: { flex: 1, minWidth: 0, gap: 5 },
  notificationPressed: { opacity: 0.72 },
  itemTitle: { color: palette.text, fontSize: 13, fontWeight: '800' },
  body: { color: palette.muted, fontSize: 12, lineHeight: 17 },
  date: { color: '#727A85', fontSize: 10 },
});
