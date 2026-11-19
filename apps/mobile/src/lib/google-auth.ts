import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';

import { publicSiteUrl } from '@/lib/links';
import { completeAuthCallback } from '@/lib/auth-callback';

WebBrowser.maybeCompleteAuthSession();

const appRedirect = 'legendclub://auth/callback';
const callbackTimeoutMs = 15_000;

/** Browser-based fallback for web. Native platforms use google-auth.native.ts. */
export async function authenticateWithGoogle(): Promise<'success' | 'cancelled'> {
  const { supabase } = await import('@/lib/supabase');
  const webCallback = publicSiteUrl.replace(/\/$/, '') + '/auth/callback?native=1';
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: webCallback, skipBrowserRedirect: true },
  });
  if (error) throw error;
  if (!data.url) throw new Error('No se pudo iniciar el acceso con Google.');

  let resolveAppCallback!: (url: string) => void;
  const appCallback = new Promise<string>((resolve) => { resolveAppCallback = resolve; });
  let receivedCallbackUrl: string | null = null;
  const subscription = Linking.addEventListener('url', ({ url }) => {
    if (url.toLowerCase().startsWith(appRedirect)) {
      receivedCallbackUrl = url;
      resolveAppCallback(url);
    }
  });
  let timeout: ReturnType<typeof setTimeout> | undefined;
  let returnedToApp = false;

  try {
    const result = await WebBrowser.openAuthSessionAsync(data.url, appRedirect, {
      toolbarColor: '#0B0D10',
      controlsColor: '#D7DDE5',
    });

    if (result.type === 'cancel' && !receivedCallbackUrl) return 'cancelled';

    const callbackUrl = result.type === 'success' ? result.url : await Promise.race([
      appCallback,
      new Promise<null>((resolve) => { timeout = setTimeout(() => resolve(null), callbackTimeoutMs); }),
    ]);
    if (!callbackUrl) {
      throw new Error('Google abrió la app, pero no devolvió la respuesta de acceso. Vuelve a intentarlo.');
    }

    returnedToApp = true;
    await completeAuthCallback(callbackUrl);
    return 'success';
  } finally {
    subscription.remove();
    if (timeout) clearTimeout(timeout);
    if (returnedToApp) {
      try {
        if (WebBrowser.dismissAuthSession) WebBrowser.dismissAuthSession();
        if (WebBrowser.dismissBrowser) await WebBrowser.dismissBrowser();
      } catch {
        // The operating system may already have closed the browser tab.
      }
    }
  }
}
