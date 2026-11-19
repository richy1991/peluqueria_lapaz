import { redirect } from "next/navigation";
import { EditProfileForm } from "@/modules/mobile/client/edit-profile-form";
import { ClientSecondaryPage } from "@/modules/mobile/client/client-secondary-page";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function EditClientProfilePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=%2Fmi-cuenta%2Fperfil");
  const { data: profile } = await supabase.from("profiles").select("full_name,email,phone,phone_normalized,phone_confirmed_at").eq("id", user.id).maybeSingle();
  return <ClientSecondaryPage title="Editar perfil">
    <section className="portal-card client-secondary-card"><h2>Datos personales</h2><p>Actualiza tu nombre y teléfono de contacto.</p><EditProfileForm userId={user.id} initialName={profile?.full_name ?? ""} initialPhone={profile?.phone ?? ""} initialPhoneNormalized={profile?.phone_normalized ?? ""} initialPhoneConfirmedAt={profile?.phone_confirmed_at ?? null} email={profile?.email ?? user.email ?? ""} /></section>
  </ClientSecondaryPage>;
}
