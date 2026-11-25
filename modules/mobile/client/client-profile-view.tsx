import { BadgeCheck, CircleAlert, Mail, Palette, Phone, UserRound } from "lucide-react";
import { PanelMobileLogout, PanelThemeSelector } from "@/components/panel-experience";

export type ClientProfile = {
  full_name: string | null;
  email: string | null;
  phone: string | null;
  avatar_url: string | null;
  status: string | null;
  no_show_count: number | null;
  is_blacklisted: boolean;
  is_blocked: boolean;
};

const accountStatuses: Record<string, string> = {
  active: "Activa",
  inactive: "Inactiva",
  deactivated: "Desactivada",
  suspended: "Suspendida",
};

export function ClientProfileDetails({ profile, accountEmail }: { profile: ClientProfile | null; accountEmail?: string }) {
  const email = profile?.email || accountEmail;
  const status = profile?.status;

  return <div className="client-account-columns account-profile-grid">
    <section id="datos-personales" className="account-profile-card" aria-labelledby="account-profile-data" data-profile-card>
      <div className="account-profile-heading">
        <span><UserRound size={19} aria-hidden="true" /></span>
        <h2 id="account-profile-data">Datos personales</h2>
      </div>
      <dl className="account-profile-details">
        <div>
          <dt><Mail size={16} aria-hidden="true" /> Correo</dt>
          <dd>{email || "Pendiente de registrar"}</dd>
        </div>
        <div>
          <dt><Phone size={16} aria-hidden="true" /> Teléfono</dt>
          <dd>{profile?.phone || "Pendiente de registrar"}</dd>
        </div>
        <div>
          <dt><BadgeCheck size={16} aria-hidden="true" /> Estado de la cuenta</dt>
          <dd><span className="account-profile-status" data-status={status ?? "pending"}>{status ? accountStatuses[status] ?? status : "Pendiente"}</span></dd>
        </div>
        <div>
          <dt><CircleAlert size={16} aria-hidden="true" /> Inasistencias</dt>
          <dd>{profile?.no_show_count ?? 0}</dd>
        </div>
      </dl>
      {profile?.is_blacklisted && <p className="account-profile-notice">La cuenta tiene una alerta por inasistencias.</p>}
      {profile?.is_blocked && <p className="account-profile-notice" data-danger="true">Las nuevas reservas están bloqueadas. Contacta al negocio.</p>}
    </section>

    <section className="account-profile-card account-profile-appearance" aria-labelledby="account-profile-appearance" data-profile-card>
      <div className="account-profile-heading">
        <span><Palette size={19} aria-hidden="true" /></span>
        <h2 id="account-profile-appearance">Apariencia</h2>
      </div>
      <PanelThemeSelector compact />
      <div className="account-profile-session"><PanelMobileLogout /></div>
    </section>
  </div>;
}
