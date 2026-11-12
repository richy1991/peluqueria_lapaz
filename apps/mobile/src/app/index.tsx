import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, BackHandler, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { WebView } from 'react-native-webview';

import { palette } from '@/components/ui';
import { publicPage, publicSiteUrl } from '@/lib/links';

export default function MobilePortal() {
  const webView = useRef<WebView<object>>(null);
  const [canGoBack, setCanGoBack] = useState(false);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  const handleNavigation = useCallback((request: { url: string }) => {
    if (request.url.startsWith('about:')) return true;
    try {
      const next = new URL(request.url);
      if (next.origin === new URL(publicSiteUrl).origin) return true;
    } catch {
      return false;
    }
    void Linking.openURL(request.url).catch(() => undefined);
    return false;
  }, []);

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!canGoBack) return true;
      webView.current?.goBack();
      return true;
    });
    return () => subscription.remove();
  }, [canGoBack]);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom', 'left', 'right']}>
      <StatusBar style="light" />
      <WebView<object>
        key={attempt}
        ref={webView}
        source={{ uri: publicPage('/movil') }}
        style={styles.webView}
        containerStyle={styles.container}
        javaScriptEnabled
        domStorageEnabled
        sharedCookiesEnabled
        thirdPartyCookiesEnabled
        cacheEnabled
        originWhitelist={['https://*', 'http://*']}
        setSupportMultipleWindows
        allowsBackForwardNavigationGestures
        onShouldStartLoadWithRequest={handleNavigation}
        onOpenWindow={({ nativeEvent }) => { void Linking.openURL(nativeEvent.targetUrl).catch(() => undefined); }}
        onNavigationStateChange={(state) => { setCanGoBack(state.canGoBack); setFailed(false); }}
        onLoadStart={() => { setLoading(true); setFailed(false); }}
        onLoadEnd={() => setLoading(false)}
        onError={() => { setLoading(false); setFailed(true); }}
        onHttpError={({ nativeEvent }) => { if (nativeEvent.statusCode >= 500) { setLoading(false); setFailed(true); } }}
        startInLoadingState={false}
        pullToRefreshEnabled
        textZoom={100}
      />
      {loading && !failed ? <View pointerEvents="none" style={styles.loading}><ActivityIndicator size="large" color={palette.gold} /><Text style={styles.loadingText}>Cargando LEGEND CLUB…</Text></View> : null}
      {failed ? <View style={styles.error}><Text style={styles.errorTitle}>No pudimos cargar el contenido.</Text><Text style={styles.errorText}>Comprueba tu conexión e inténtalo de nuevo.</Text><Pressable style={styles.retry} onPress={() => { setFailed(false); setLoading(true); setAttempt(value => value + 1); }}><Text style={styles.retryText}>Reintentar</Text></Pressable></View> : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0d0d0d' },
  container: { flex: 1, backgroundColor: '#0d0d0d' },
  webView: { flex: 1, backgroundColor: '#0d0d0d' },
  loading: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', gap: 13, backgroundColor: '#0d0d0d' },
  loadingText: { color: '#d4a853', fontSize: 12, fontWeight: '700', letterSpacing: 1 },
  error: { ...StyleSheet.absoluteFill, padding: 30, alignItems: 'center', justifyContent: 'center', gap: 12, backgroundColor: '#0d0d0d' },
  errorTitle: { color: '#f5f0e8', fontSize: 20, fontWeight: '800', textAlign: 'center' },
  errorText: { color: '#aaa39a', fontSize: 14, textAlign: 'center' },
  retry: { minHeight: 46, marginTop: 6, paddingHorizontal: 24, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: '#d4a853' },
  retryText: { color: '#171310', fontSize: 13, fontWeight: '800' },
});
