import * as Linking from 'expo-linking';

import { supabase } from '@/lib/supabase';

const first = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value;

function authResponse(url: string) {
  const parsed = Linking.parse(url);
  const query = parsed.queryParams ?? {};
  const fragment = new URLSearchParams(url.split('#')[1] ?? '');
  return {
    code: first(query.code as string | string[] | undefined) ?? fragment.get('code') ?? undefined,
    error: first(query.error_description as string | string[] | undefined)
      ?? first(query.error as string | string[] | undefined)
      ?? fragment.get('error_description')
      ?? fragment.get('error'),
    accessToken: fragment.get('access_token'),
    refreshToken: fragment.get('refresh_token'),
  };
}

function readableAuthError(message: string) {
  const normalized = message.toLowerCase();
  if (normalized.includes('redirect') || normalized.includes('url not allowed')) {
    return 'Supabase rechazó la dirección de retorno. Revisa las URLs permitidas de autenticación.';
  }
  if (normalized.includes('code verifier') || normalized.includes('pkce')) {
    return 'El enlace volvió a la app, pero no se pudo recuperar la sesión. Solicita uno nuevo e inténtalo otra vez.';
  }
  return message;
}

let mostRecentCode: string | null = null;
let mostRecentCompletion: Promise<void> | null = null;

/** Exchanges a Supabase auth code once, for Google OAuth or an email confirmation link. */
export function completeAuthCallback(url: string): Promise<void> {
  const { code, error, accessToken, refreshToken } = authResponse(url);
  if (error) return Promise.reject(new Error(readableAuthError(error)));
  if (code && mostRecentCode === code && mostRecentCompletion) return mostRecentCompletion;

  const completion = (async () => {
    if (code) {
      const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
      if (exchangeError) throw new Error(readableAuthError(exchangeError.message));
      if (!data.session) throw new Error('El enlace no devolvió una sesión válida. Solicita uno nuevo.');
      return;
    }

    if (accessToken && refreshToken) {
      const { data, error: sessionError } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });
      if (sessionError) throw new Error(readableAuthError(sessionError.message));
      if (!data.session) throw new Error('El enlace no devolvió una sesión válida. Solicita uno nuevo.');
      return;
    }

    throw new Error('El enlace regresó a la app sin completar el acceso. Solicita uno nuevo.');
  })();

  if (code) {
    mostRecentCode = code;
    mostRecentCompletion = completion;
  }
  return completion;
}
