import { useEffect } from 'react';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { Platform } from 'react-native';

import { useSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';

Notifications.setNotificationHandler({
  handleNotification: async (notification) => ({
    shouldPlaySound: Boolean(notification.request.content.sound),
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

type IncomingNotification = { id: string; title: string | null; body: string | null; type: string | null };
const handledNotificationResponses = new Set<string>();
const askedNotificationPermissionUsers = new Set<string>();

export function ClientNotificationListener() {
  const { session, role } = useSession();
  const userId = session?.user.id ?? '';

  useEffect(() => {
    if (!userId || role !== 'client' || Platform.OS === 'web') return;
    let active = true;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    async function openNotification(response: Notifications.NotificationResponse) {
      const notificationId = response.notification.request.content.data?.notificationId;
      const responseId = response.notification.request.identifier;
      if (!active || typeof notificationId !== 'string' || handledNotificationResponses.has(responseId)) return;
      handledNotificationResponses.add(responseId);
      try {
        await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', notificationId).eq('user_id', userId).is('read_at', null);
      } catch {
        // A notification tap should still open the inbox if the network is unavailable.
      } finally {
        Notifications.clearLastNotificationResponse();
        if (active) router.push('/client/notifications');
      }
    }

    const responseSubscription = Notifications.addNotificationResponseReceivedListener((response) => {
      void openNotification(response);
    });
    void Notifications.getLastNotificationResponseAsync().then((response) => {
      if (response) return openNotification(response);
    }).catch(() => undefined);

    async function subscribeToNewNotifications() {
      try {
        if (Platform.OS === 'android') {
          await Notifications.setNotificationChannelAsync('client-updates-v1', {
            name: 'Avisos de LEGEND CLUB',
            importance: Notifications.AndroidImportance.HIGH,
            vibrationPattern: [0, 220, 120, 220],
            sound: 'default',
          }).catch(() => undefined);
        }

        // Ask once when a signed-in client first enters the app. If the user
        // declines, the settings screen can still request again or open system settings.
        if (!askedNotificationPermissionUsers.has(userId)) {
          askedNotificationPermissionUsers.add(userId);
          try {
            const permission = await Notifications.getPermissionsAsync();
            if (!permission.granted && permission.status !== 'granted' && permission.canAskAgain) {
              await Notifications.requestPermissionsAsync();
            }
          } catch {
            // Notifications remain optional; the in-app inbox still works.
          }
        }

        const existing = await supabase.from('notifications').select('id').eq('user_id', userId).order('created_at', { ascending: false }).limit(100);
        if (!active) return;
        const seenIds = new Set((existing.data ?? []).map((item) => item.id));

        channel = supabase.channel(`client-notifications-${userId}`)
          .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` }, async (payload) => {
            const item = payload.new as IncomingNotification;
            if (!item.id || seenIds.has(item.id)) return;
            seenIds.add(item.id);

            let mutedAll = false;
            let permission: Notifications.NotificationPermissionsStatus;
            try {
              const [preferenceResult, devicePermission] = await Promise.all([
                supabase.from('notification_preferences').select('muted_all').eq('user_id', userId).maybeSingle(),
                Notifications.getPermissionsAsync(),
              ]);
              mutedAll = Boolean(preferenceResult.data?.muted_all);
              permission = devicePermission;
            } catch {
              return;
            }
            if (!active || mutedAll || !(permission.granted || permission.status === 'granted')) return;

            try {
              await Notifications.scheduleNotificationAsync({
                content: {
                  title: item.title || 'Novedades de LEGEND CLUB',
                  body: item.body || 'Tienes un nuevo aviso.',
                  sound: 'default',
                  data: { notificationId: item.id, type: item.type },
                },
                trigger: null,
              });
            } catch {
              // The notification remains in the inbox if the OS blocks local playback.
            }
          })
          .subscribe();
      } catch {
        // Realtime or notification permissions can be unavailable; the inbox stays usable.
      }
    }

    void subscribeToNewNotifications();
    return () => {
      active = false;
      responseSubscription.remove();
      if (channel) void supabase.removeChannel(channel);
    };
  }, [role, userId]);

  return null;
}
