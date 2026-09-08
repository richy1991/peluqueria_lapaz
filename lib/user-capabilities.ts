import { createClient } from "@/lib/supabase/server";

export async function getUserCapabilities(userId: string) {
  const supabase = await createClient();
  const [adminResult, superadminResult, cashierResult, barberResult] = await Promise.all([
    supabase.rpc("is_admin"),
    supabase.rpc("is_superadmin"),
    supabase.rpc("is_cashier"),
    supabase.from("barber_profiles").select("id,display_name").eq("user_id", userId).eq("active", true).maybeSingle(),
  ]);
  return {
    isAdmin: Boolean(adminResult.data),
    isSuperadmin: Boolean(superadminResult.data),
    isCashier: Boolean(cashierResult.data),
    barber: barberResult.data,
  };
}

export type UserCapabilities = Awaited<ReturnType<typeof getUserCapabilities>>;

export function getDashboardPath(capabilities: UserCapabilities) {
  if (capabilities.isAdmin) return "/admin";
  if (capabilities.isCashier) return "/caja";
  if (capabilities.barber) return "/barbero";
  return "/mi-cuenta";
}
