import { createClient } from "@/lib/supabase/server";

export async function getUserCapabilities(userId: string) {
  const supabase = await createClient();
  const [adminResult, superadminResult, barberResult] = await Promise.all([
    supabase.rpc("is_admin"),
    supabase.rpc("is_superadmin"),
    supabase.from("barber_profiles").select("id,display_name").eq("user_id", userId).eq("active", true).maybeSingle(),
  ]);
  return {
    isAdmin: Boolean(adminResult.data),
    isSuperadmin: Boolean(superadminResult.data),
    barber: barberResult.data,
  };
}
