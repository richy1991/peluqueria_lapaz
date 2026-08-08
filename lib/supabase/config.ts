// Estos valores identifican el backend público de esta aplicación. La clave
// publishable está diseñada para distribuirse al navegador; la seguridad de
// los datos depende de RLS. Nunca colocar aquí una clave sb_secret o service_role.
export const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ??
  "https://ggiajbauxczmqkylvjow.supabase.co";

export const supabasePublishableKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  "sb_publishable_BBEh7BgfmlXr0-_3Ex6k4A__qD3XKP9";
