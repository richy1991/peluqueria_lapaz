import type { MobileNavigationItem } from "../shared/contracts";

export type ClientSection = "inicio" | "puntos" | "productos" | "galeria";

export const CLIENT_NAVIGATION = [
  { id: "inicio", href: "/mi-cuenta", label: "Mi perfil" },
  { id: "productos", href: "/mi-cuenta/productos", label: "Productos" },
  { id: "puntos", href: "/mi-cuenta/puntos", label: "Puntos" },
] as const satisfies ReadonlyArray<MobileNavigationItem<ClientSection>>;
