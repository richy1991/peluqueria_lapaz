"use client";

import { Brand } from "@/components/brand";
import { InstallAppButton } from "@/components/install-app-button";
import { ModeSwitcher } from "@/components/mode-switcher";
import { PanelMobileLogout, PanelThemeSelector } from "@/components/panel-experience";
import { ChevronDown, UserRound } from "lucide-react";

type Capabilities = { isAdmin: boolean; isSuperadmin: boolean; isCashier: boolean; barber: { id: string; display_name: string } | null };

export function CashierHeader({ userName, userEmail, capabilities, shiftOpen }: {
  userName: string;
  userEmail: string;
  capabilities: Capabilities;
  shiftOpen: boolean;
}) {
  const initials = userName.trim().split(/\s+/).slice(0, 2).map(part => part[0]).join("").toLocaleUpperCase("es") || "CJ";

  return <header className="cashier-topbar" aria-label="Terminal de caja">
    <div className="cashier-topbar-brand">
      <Brand linked={false} />
      <span className="cashier-terminal-status"><i />{shiftOpen ? "Turno abierto" : "Turno cerrado"}</span>
    </div>
    <div className="cashier-topbar-tools">
      <InstallAppButton compact />
      <ModeSwitcher current="cashier" isAdmin={capabilities.isAdmin} hasBarber={Boolean(capabilities.barber)} isCashier showClient={false} />
    </div>
    <details className="cashier-user-menu">
      <summary aria-label={`Perfil de ${userName}`}>
        <span className="cashier-user-avatar">{initials}</span>
        <span className="cashier-user-summary"><strong>{userName}</strong><small>Operador de caja</small></span>
        <ChevronDown aria-hidden="true" />
      </summary>
      <div className="cashier-user-popover">
        <div className="cashier-user-profile">
          <span className="cashier-user-avatar large"><UserRound aria-hidden="true" /></span>
          <span><strong>{userName}</strong><small>{userEmail}</small><small>Operador de caja</small></span>
        </div>
        <section className="cashier-user-preferences" aria-label="Preferencias de apariencia">
          <strong>Tema de la interfaz</strong>
          <PanelThemeSelector compact />
        </section>
        <PanelMobileLogout />
      </div>
    </details>
  </header>;
}
