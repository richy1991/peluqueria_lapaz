import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, UserRoundPen } from "lucide-react";
import { EditProfileForm } from "@/modules/mobile/client/edit-profile-form";
import { ClientSecondaryPage } from "@/modules/mobile/client/client-secondary-page";
import { createClient } from "@/lib/supabase/server";
import "./edit-profile.css";

export const dynamic = "force-dynamic";

const title = "Editar perfil";

export default async function EditClientProfilePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=%2Fmi-cuenta%2Feditar-perfil");
  const { data: profile } = await supabase.from("profiles").select("full_name,email,phone,phone_normalized,phone_confirmed_at").eq("id", user.id).maybeSingle();
  return <ClientSecondaryPage title={title} className="client-profile-editor" header={
    <header className="client-profile-edit-heading">
      <div className="client-header-actions">
        <Link href="/mi-cuenta#datos-personales"><ArrowLeft size={16} aria-hidden="true" /> Mi perfil</Link>
      </div>
      <h1>{title}</h1>
    </header>
  }>
    <section className="client-profile-edit-card" aria-labelledby="edit-profile-data">
      <div className="client-profile-edit-title">
        <span><UserRoundPen size={19} aria-hidden="true" /></span>
        <div><h2 id="edit-profile-data">Datos personales</h2><p>Actualiza tu nombre y teléfono de contacto.</p></div>
      </div>
      <EditProfileForm userId={user.id} initialName={profile?.full_name ?? ""} initialPhone={profile?.phone ?? ""} initialPhoneNormalized={profile?.phone_normalized ?? ""} initialPhoneConfirmedAt={profile?.phone_confirmed_at ?? null} email={profile?.email ?? user.email ?? ""} />
    </section>
  </ClientSecondaryPage>;
}
