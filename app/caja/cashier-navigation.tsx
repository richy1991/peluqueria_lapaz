"use client";

import Link from "next/link";
import { Calculator, History, PackageCheck, PackageOpen, ReceiptText, Scissors } from "lucide-react";

export type CashierNavigationSection = "servicios" | "productos" | "reservas" | "movimientos" | "liquidaciones" | "historial";

const cashierQuickNavigation = [
  { id: "servicios", href: "/caja", label: "Cobros", icon: Scissors },
  { id: "productos", href: "/caja/productos", label: "Vender productos", icon: PackageOpen },
  { id: "reservas", href: "/caja/reservas", label: "Reservas", icon: PackageCheck },
  { id: "movimientos", href: "/caja/movimientos", label: "Libro diario", icon: ReceiptText },
  { id: "liquidaciones", href: "/caja/liquidaciones", label: "Liquidaciones", icon: Calculator },
  { id: "historial", href: "/caja/historial", label: "Historial", icon: History },
] as const;

export function CashierDesktopNavigation({ section, reservationCount = 0 }: { section: CashierNavigationSection; reservationCount?: number }) {
  return <nav className="cashier-desktop-nav" aria-label="Secciones de caja">
    {cashierQuickNavigation.map(item => {
      const Icon = item.icon;
      const active = section === item.id;
      const count = item.id === "reservas" ? reservationCount : 0;
      return <Link key={item.id} href={item.href} aria-current={active ? "page" : undefined} className={active ? "active" : ""}>
        <Icon /><span>{item.label}</span>{count > 0 && <b>{count > 99 ? "99+" : count}</b>}
      </Link>;
    })}
  </nav>;
}
