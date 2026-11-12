import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';

import { publicSiteUrl } from '@/lib/links';
import { supabase } from '@/lib/supabase';

WebBrowser.maybeCompleteAuthSession();

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function readableAuthError(message: string) {
  const normalized = message.toLowerCase();
  if (normalized.includes('redirect') || normalized.includes('url not allowed')) {
    return 'No se autorizó el retorno de Google. Actualiza la app o inténtalo de nuevo más tarde.';
  }
  if (normalized.includes('code verifier') || normalized.includes('pkce')) {
    return 'Google volvió, pero no se pudo recuperar la sesión. Cierra y abre la app e inténtalo otra vez.';
  }
  return message;
}

/** Starts the native Google flow and stores the returned Supabase session. */
export async function authenticateWithGoogle(): Promise<'success' | 'cancelled'> {
  const appRedirect = 'legendclub://auth/callback';
  const webCallback = `${publicSiteUrl.replace(/\/$/, '')}/auth/callback?native=1`;
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: webCallback, skipBrowserRedirect: true },
  });
  if (error) throw new Error(readableAuthError(error.message));
  if (!data.url) throw new Error('No se pudo iniciar el acceso con Google.');

  const result = await WebBrowser.openAuthSessionAsync(data.url, appRedirect);
  if (result.type !== 'success') return 'cancelled';

  const parsed = Linking.parse(result.url);
  const query = parsed.queryParams ?? {};
  const description = first(query.error_description as string | string[] | undefined);
  const code = first(query.code as string | string[] | undefined);
  const authError = first(query.error as string | string[] | undefined);
  if (description || authError) {
    throw new Error(readableAuthError(description ?? authError ?? 'No se pudo completar el acceso con Google.'));
  }

  if (code) {
    const { data: sessionData, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
    if (exchangeError) throw new Error(readableAuthError(exchangeError.message));
    if (!sessionData.session) throw new Error('Google volvió, pero no se recibió una sesión válida.');
    return 'success';
  }

  const fragment = result.url.split('#')[1] ?? '';
  const tokens = new URLSearchParams(fragment);
  const accessToken = tokens.get('access_token');
  const refreshToken = tokens.get('refresh_token');
  if (!accessToken || !refreshToken) {
    throw new Error('Google volvió sin completar el acceso. Inténtalo otra vez.');
  }

  const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken,
  });
  if (sessionError) throw new Error(readableAuthError(sessionError.message));
  if (!sessionData.session) throw new Error('Google volvió, pero no se recibió una sesión válida.');
  return 'success';
}
