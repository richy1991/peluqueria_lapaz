import { Platform, TurboModuleRegistry } from 'react-native';
import * as Crypto from 'expo-crypto';

import { supabase } from '@/lib/supabase';

type GoogleSignInModule = typeof import('react-native-nitro-google-signin');
const defaultGoogleWebClientId = '416009427003-d5kqiqj8hne5kodtn46ahqrrcgn282dl.apps.googleusercontent.com';

function isGoogleClientId(value: string | undefined): value is string {
  return Boolean(
    value
      && value.endsWith('.apps.googleusercontent.com')
      && !/your-|placeholder|not-configured/i.test(value),
  );
}

async function configureGoogleSignIn(google: GoogleSignInModule) {
  const configuredWebClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID?.trim();
  const webClientId = isGoogleClientId(configuredWebClientId)
    ? configuredWebClientId
    : defaultGoogleWebClientId;
  const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID?.trim();
  const iosUrlScheme = process.env.EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME?.trim();
  if (Platform.OS === 'ios' && (
    !isGoogleClientId(iosClientId)
      || !iosUrlScheme
      || /your-|placeholder|not-configured/i.test(iosUrlScheme)
  )) {
    throw new Error('Google no esta configurado para iOS: define EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID y EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME antes de compilar.');
  }

  const nonce = Crypto.randomUUID();
  const hashedNonce = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, nonce);
  google.GoogleOneTapSignIn.configure({
    webClientId,
    scopes: ['email', 'profile'],
    nonce: hashedNonce,
    ...(iosClientId ? { iosClientId } : {}),
  });
  return nonce;
}

/** Google-native credential is validated by Supabase Auth and becomes its session. */
export async function authenticateWithGoogle(): Promise<'success' | 'cancelled'> {
  if (!TurboModuleRegistry.get('NitroModules')) {
    throw new Error('Google nativo no esta incluido en Expo Go. Instala el APK de desarrollo de LEGEND CLUB y ejecuta npm run start:dev-client.');
  }

  let google: GoogleSignInModule;
  try {
    // This package initializes its Nitro native module as soon as it is imported.
    // Load it only after the user taps Google so the app itself can still start
    // in Expo Go or an older binary and show this message on demand.
    google = await import('react-native-nitro-google-signin');
  } catch {
    throw new Error('Google nativo no pudo cargarse en esta compilacion. Reinstala el APK de desarrollo de LEGEND CLUB.');
  }

  const nonce = await configureGoogleSignIn(google);
  await google.GoogleOneTapSignIn.checkPlayServices();

  // iOS restorePreviousSignIn returns an ID token without a fresh nonce. Use its
  // interactive native dialog so Supabase can verify the nonce on every login.
  let response = Platform.OS === 'ios'
    ? await google.GoogleOneTapSignIn.createAccount()
    : await google.GoogleOneTapSignIn.signIn();
  if (google.isNoSavedCredentialFoundResponse(response)) {
    response = await google.GoogleOneTapSignIn.createAccount();
  }
  if (google.isNoSavedCredentialFoundResponse(response)) {
    response = await google.GoogleOneTapSignIn.presentExplicitSignIn();
  }
  if (google.isCancelledResponse(response)) return 'cancelled';
  if (!google.isSuccessResponse(response)) {
    throw new Error('Google no devolvio una cuenta. Vuelve a intentarlo.');
  }

  const { data, error } = await supabase.auth.signInWithIdToken({
    provider: 'google',
    token: response.data.idToken,
    nonce,
  });
  if (error) throw error;
  if (!data.session) throw new Error('Supabase no confirmo la sesion de Google. Revisa tu conexion e intentalo otra vez.');
  return 'success';
}
