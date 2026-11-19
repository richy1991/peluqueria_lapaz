import 'expo-sqlite/localStorage/install';

import { AppState, Platform } from 'react-native';
import { createClient } from '@supabase/supabase-js';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? 'https://ggiajbauxczmqkylvjow.supabase.co';
const publishableKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  ?? 'sb_publishable_BBEh7BgfmlXr0-_3Ex6k4A__qD3XKP9';

const authStorage = {
  getItem(key: string) {
    return typeof globalThis.localStorage === 'undefined' ? null : globalThis.localStorage.getItem(key);
  },
  setItem(key: string, value: string) {
    if (typeof globalThis.localStorage !== 'undefined') globalThis.localStorage.setItem(key, value);
  },
  removeItem(key: string) {
    if (typeof globalThis.localStorage !== 'undefined') globalThis.localStorage.removeItem(key);
  },
};

export const supabase = createClient(url, publishableKey, {
  auth: {
    storage: authStorage,
    flowType: 'pkce',
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}
