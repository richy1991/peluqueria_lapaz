import Link from "next/link";

type ModeSwitcherProps = { current: "client" | "barber" | "admin"; isAdmin: boolean; hasBarber: boolean; showClient?: boolean };

export function ModeSwitcher({ current, isAdmin, hasBarber, showClient = true }: ModeSwitcherProps) {
  const modes = [
    ...(hasBarber ? [{ id: "barber", href: "/barbero", label: "Modo peluquero" }] : []),
    ...(isAdmin ? [{ id: "admin", href: "/admin", label: "Modo administrador" }] : []),
    ...(showClient ? [{ id: "client", href: "/mi-cuenta", label: "Modo cliente" }] : []),
  ];
  if (modes.length < 2) return null;
  return <nav className="mode-switcher" aria-label="Cambiar modo">{modes.map((mode) => <Link key={mode.id} className={current === mode.id ? "active" : ""} href={mode.href}>{mode.label}</Link>)}</nav>;
}
