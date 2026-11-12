import Link from "next/link";
import { redirect } from "next/navigation";
import { Brand } from "@/components/brand";
import { createClient } from "@/lib/supabase/server";
import { getUserCapabilities } from "@/lib/user-capabilities";
import "../login/login.css";

export const dynamic = "force-dynamic";

export default async function MobileEntryPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=%2Fmovil");

  const [capabilities, rolesResult] = await Promise.all([
    getUserCapabilities(user.id),
    supabase.from("user_roles").select("role").eq("user_id", user.id),
  ]);
  const roles = new Set((rolesResult.data ?? []).map(({ role }) => role));

  if (rolesResult.error || capabilities.isAdmin || capabilities.isSuperadmin || capabilities.isCashier) {
    return <UnsupportedAccount />;
  }
  if (capabilities.barber && roles.has("barber")) redirect("/barbero");
  if (roles.has("client")) redirect("/mi-cuenta");
  return <UnsupportedAccount />;
}

function UnsupportedAccount() {
  return <main className="login-shell"><section className="login-card"><Brand/><p className="eyebrow">LEGEND CLUB</p><h1>Esta cuenta no puede usar esta app.</h1><p>Para administrar el negocio, inicia sesión desde la versión web.</p><a className="google-button mobile-admin-link" href="/admin/login" target="_blank" rel="noreferrer">Abrir administración web</a><Link href="/">Volver al inicio</Link></section></main>;
}
