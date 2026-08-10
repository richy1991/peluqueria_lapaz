"use client";

import Link from "next/link";
import { Check, MoreVertical } from "lucide-react";
import { useRef } from "react";

type ModeSwitcherProps = {
  current: "client" | "barber" | "cashier" | "admin";
  isAdmin: boolean;
  hasBarber: boolean;
  isCashier?: boolean;
  showClient?: boolean;
};

export function ModeSwitcher({
  current,
  isAdmin,
  hasBarber,
  isCashier = false,
  showClient = true,
}: ModeSwitcherProps) {
  const mobileMenuRef = useRef<HTMLDetailsElement>(null);
  const modes = [
    ...(hasBarber ? [{ id: "barber", href: "/barbero", label: "Modo peluquero" }] : []),
    ...(isCashier ? [{ id: "cashier", href: "/caja", label: "Modo caja" }] : []),
    ...(isAdmin ? [{ id: "admin", href: "/admin", label: "Modo administrador" }] : []),
    ...(showClient ? [{ id: "client", href: "/mi-cuenta", label: "Modo cliente" }] : []),
  ];

  if (modes.length < 2) return null;

  return (
    <nav className="mode-switcher" aria-label="Cambiar modo">
      <div className="mode-switcher-links">
        {modes.map((mode) => <Link key={mode.id} className={current === mode.id ? "active" : ""} href={mode.href}>{mode.label}</Link>)}
      </div>
      <details ref={mobileMenuRef} className="mobile-mode-menu">
        <summary aria-label="Cambiar modo de panel"><MoreVertical /></summary>
        <div>
          <small>CAMBIAR MODO</small>
          {modes.map((mode) => <Link key={mode.id} className={current === mode.id ? "active" : ""} href={mode.href} onClick={()=>mobileMenuRef.current?.removeAttribute("open")}>{current === mode.id && <Check />}{mode.label}</Link>)}
        </div>
      </details>
    </nav>
  );
}
