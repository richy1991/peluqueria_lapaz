import Link from "next/link";

type ModeSwitcherProps = { current: "client" | "barber" | "cashier" | "admin"; isAdmin: boolean; hasBarber: boolean; isCashier?: boolean; showClient?: boolean };

export function ModeSwitcher({ current, isAdmin, hasBarber, isCashier = false, showClient = true }: ModeSwitcherProps) {
  const modes = [
    ...(hasBarber ? [{ id: "barber", href: "/barbero", label: "Modo peluquero" }] : []),
    ...(isCashier ? [{ id: "cashier", href: "/caja", label: "Modo caja" }] : []),
    ...(isAdmin ? [{ id: "admin", href: "/admin", label: "Modo administrador" }] : []),
    ...(showClient ? [{ id: "client", href: "/mi-cuenta", label: "Modo cliente" }] : []),
  ];
  if (modes.length < 2) return null;
  return <nav className="mode-switcher" aria-label="Cambiar modo">{modes.map((mode) => <Link key={mode.id} className={current === mode.id ? "active" : ""} href={mode.href}>{mode.label}</Link>)}</nav>;
}
