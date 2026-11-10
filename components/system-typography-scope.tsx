"use client";

import { useLayoutEffect } from "react";
import { usePathname } from "next/navigation";

const systemRouteRoots = [
  "/admin",
  "/auth",
  "/barbero",
  "/caja",
  "/comprobante",
  "/login",
  "/mensajes",
  "/mi-cuenta",
  "/panel",
  "/reservar",
  "/vincular",
];

function isSystemRoute(pathname: string) {
  return systemRouteRoots.some((root) => pathname === root || pathname.startsWith(`${root}/`));
}

export function SystemTypographyScope() {
  const pathname = usePathname() ?? "/";

  useLayoutEffect(() => {
    const root = document.documentElement;
    if (isSystemRoute(pathname)) root.dataset.legendTypography = "native";
    else delete root.dataset.legendTypography;
  }, [pathname]);

  return null;
}
