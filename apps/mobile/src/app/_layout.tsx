import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { SessionProvider } from '@/lib/session';
import { AppearanceProvider, useAppearance } from '@/lib/appearance';
import { ClientNotificationListener } from '@/components/ClientNotificationListener';

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: '#0B0D10' }}>
      <SafeAreaProvider>
        <AppearanceProvider>
          <SessionProvider>
            <RootNavigator />
          </SessionProvider>
        </AppearanceProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function RootNavigator() {
  const { resolved, colors } = useAppearance();
  return <>
    <StatusBar style={resolved === 'dark' ? 'light' : 'dark'} animated />
    <ClientNotificationListener />
    <Stack screenOptions={{ headerShown: false, animation: 'fade_from_bottom', animationDuration: 260, contentStyle: { backgroundColor: colors.background } }} />
  </>;
}
