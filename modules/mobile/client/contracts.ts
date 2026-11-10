import type { MobileNavigationItem } from "../shared/contracts";

export type ClientSection = "inicio" | "puntos" | "productos" | "galeria" | "notificaciones" | "perfil";

export const CLIENT_NAVIGATION = [
  { id: "inicio", href: "/mi-cuenta", label: "Inicio" },
  { id: "productos", href: "/mi-cuenta/productos", label: "Productos" },
  { id: "puntos", href: "/mi-cuenta/puntos", label: "Puntos" },
  { id: "perfil", href: "/mi-cuenta/perfil", label: "Perfil" },
] as const satisfies ReadonlyArray<MobileNavigationItem<ClientSection>>;
