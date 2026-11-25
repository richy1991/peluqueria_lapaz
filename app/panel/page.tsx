import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getDashboardPath, getUserCapabilities } from "@/lib/user-capabilities";

export const dynamic = "force-dynamic";

export default async function PanelPage({ searchParams }: { searchParams: Promise<{ destino?: string }> }) {
  const supabase = await createClient();
  const { destino } = await searchParams;
  const wantsProfile = destino === "perfil";
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(wantsProfile ? "/login?next=%2Fpanel%3Fdestino%3Dperfil" : "/login?next=/panel");
  const capabilities = await getUserCapabilities(user.id);
  const dashboard = getDashboardPath(capabilities);
  redirect(wantsProfile && (dashboard === "/admin" || dashboard === "/barbero") ? `${dashboard}/perfil` : dashboard);
}
