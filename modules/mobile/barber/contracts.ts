import type { MobileNavigationItem } from "../shared/contracts";

export type BarberSection = "agenda" | "productos" | "perfil" | "balance" | "trabajos";

export const BARBER_NAVIGATION = [
  { id: "agenda", href: "/barbero", label: "Agenda" },
  { id: "productos", href: "/barbero/productos", label: "Productos" },
  { id: "perfil", href: "/barbero/perfil", label: "Perfil" },
  { id: "balance", href: "/barbero/balance", label: "Balance" },
  { id: "trabajos", href: "/barbero/trabajos", label: "Trabajos" },
] as const satisfies ReadonlyArray<MobileNavigationItem<BarberSection>>;
