import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getDashboardPath, getUserCapabilities } from "@/lib/user-capabilities";

export const dynamic = "force-dynamic";

export default async function PanelPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/panel");
  const capabilities = await getUserCapabilities(user.id);
  redirect(getDashboardPath(capabilities));
}
