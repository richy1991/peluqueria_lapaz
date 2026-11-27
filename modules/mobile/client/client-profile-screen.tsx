import Link from "next/link";
import { Bell, CalendarDays, History, Settings2, UserRoundPen } from "lucide-react";
import { Brand } from "@/components/brand";
import { PublicHomeLink } from "@/components/public-home-link";
import { ClientProfileDetails, type ClientProfile } from "./client-profile-view";
import { ProfileCardMotion } from "./profile-card-motion";

export function ClientProfileScreen({ profile, accountEmail }: { profile: ClientProfile | null; accountEmail?: string }) {
  const name = profile?.full_name?.trim() || (profile?.email || accountEmail)?.split("@")[0] || "Cliente";
  const initials = name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();

  return <main className="portal-shell panel-client-shell client-account-home client-profile-home">
    <header className="client-account-bar">
      <div className="client-account-width">
        <Brand linked={false} />
        <div className="client-header-actions">
          <Link className="client-booking-link" href="/reservar?return=%2Fmi-cuenta%2Fperfil" aria-label="Reservar cita"><CalendarDays size={15} aria-hidden="true" /> Reservar</Link>
          <PublicHomeLink className="client-account-public" />
        </div>
      </div>
    </header>

    <ProfileCardMotion className="client-account-width client-account-content client-profile-content">
      <h1 className="client-account-heading">Mi perfil</h1>
      <section className="account-profile-identity" aria-labelledby="client-profile-name">
        <div className="account-profile-avatar" aria-hidden="true">
          {initials}
          {profile?.avatar_url && <span style={{ backgroundImage: `url(${JSON.stringify(profile.avatar_url)})` }} />}
        </div>
        <div className="account-profile-identity-copy"><h2 id="client-profile-name">{name}</h2><span className="client-profile-role">Cliente</span></div>
      </section>

      <nav className="client-profile-actions" aria-label="Accesos de perfil">
        <Link href="/mi-cuenta/editar-perfil"><UserRoundPen size={18} aria-hidden="true" /><span>Editar perfil</span></Link>
        <Link href="/mi-cuenta/notificaciones"><Bell size={18} aria-hidden="true" /><span>Notificaciones</span></Link>
        <Link href="/mi-cuenta/configuracion-avisos"><Settings2 size={18} aria-hidden="true" /><span>Configurar avisos</span></Link>
        <Link href="/mi-cuenta/historial"><History size={18} aria-hidden="true" /><span>Historial</span></Link>
      </nav>

      <ClientProfileDetails profile={profile} accountEmail={accountEmail} />
    </ProfileCardMotion>
  </main>;
}
