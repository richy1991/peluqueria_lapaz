// Estos identificadores se distribuyen al navegador por diseño. Las variables
// de entorno son preferidas; el respaldo evita romper un despliegue sin ellas.
// Nunca colocar aquí una clave sb_secret, service_role ni secretos OAuth.
export const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  ?? "https://ggiajbauxczmqkylvjow.supabase.co";
export const supabasePublishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  ?? "sb_publishable_BBEh7BgfmlXr0-_3Ex6k4A__qD3XKP9";
