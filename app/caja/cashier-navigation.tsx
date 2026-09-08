"use client";

import Link from "next/link";
import { Calculator, PackageCheck, PackageOpen, ReceiptText, Scissors } from "lucide-react";
import { PanelViewportPortal } from "@/components/panel-experience";

export type CashierNavigationSection = "servicios" | "productos" | "reservas" | "movimientos" | "liquidaciones" | "gastos" | "historial";

const cashierQuickNavigation = [
  { id: "servicios", href: "/caja", label: "Cobrar servicios", icon: Scissors },
  { id: "productos", href: "/caja/productos", label: "Vender productos", icon: PackageOpen },
  { id: "reservas", href: "/caja/reservas", label: "Reservas", icon: PackageCheck },
  { id: "movimientos", href: "/caja/movimientos", label: "Libro diario", icon: ReceiptText },
  { id: "liquidaciones", href: "/caja/liquidaciones", label: "Liquidaciones", icon: Calculator },
] as const;

export function CashierMobileNavigation({ section, reservationCount = 0 }: { section: CashierNavigationSection; reservationCount?: number }) {
  const replaceNavigation = section !== "servicios";
  return <PanelViewportPortal><nav className="panel-bottom-nav" aria-label="Accesos rápidos de caja">
    {cashierQuickNavigation.map(item => {
      const Icon = item.icon;
      const active = section === item.id;
      const count = item.id === "reservas" ? reservationCount : 0;
      const label = count > 0 ? `${item.label}, ${count} pendientes` : item.label;
      return <Link key={item.id} href={item.href} replace={replaceNavigation} aria-label={label} aria-current={active ? "page" : undefined} className={active ? "active" : ""}><Icon /><span>{item.label}</span>{count > 0 && <b className="panel-bottom-badge">{count > 99 ? "99+" : count}</b>}<i /></Link>;
    })}
  </nav></PanelViewportPortal>;
}
