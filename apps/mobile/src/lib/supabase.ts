import { createClient } from '@supabase/supabase-js';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? 'https://ggiajbauxczmqkylvjow.supabase.co';
const publishableKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  ?? 'sb_publishable_BBEh7BgfmlXr0-_3Ex6k4A__qD3XKP9';

export const supabase = createClient(url, publishableKey, {
  auth: {
    storage: localStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
