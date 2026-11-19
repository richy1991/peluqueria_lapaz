import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { PanelExperience } from "@/components/panel-experience";
import { createClient } from "@/lib/supabase/server";
import { getUserCapabilities } from "@/lib/user-capabilities";

export async function ClientSecondaryPage({ title, children }: { title: string; children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=%2Fmi-cuenta");
  const capabilities = await getUserCapabilities(user.id);
  if (capabilities.isAdmin) redirect("/admin");
  if (capabilities.isCashier) redirect("/caja");
  if (capabilities.barber) redirect("/barbero");

  return <PanelExperience hideFloatingTools><main className="portal-shell panel-client-shell client-secondary-page">
    <header className="client-secondary-hero" style={{ backgroundImage: "linear-gradient(90deg,rgba(9,10,12,.9),rgba(9,10,12,.54)),url('/brand/legend-club-salon-header.jpg')" }}>
      <Link href="/mi-cuenta/perfil" aria-label="Volver al perfil"><ArrowLeft /></Link>
      <h1>{title}</h1>
    </header>
    <div className="client-secondary-content">{children}</div>
  </main></PanelExperience>;
}
