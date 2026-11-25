"use client";

import Link from "next/link";
import { CircleUserRound, LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function AccountMenu({ name, email }: { name: string; email: string }) {
  const router=useRouter();
  async function logout(){if(!window.confirm("¿Seguro que quieres salir de la aplicación? Puedes quedarte un poco más para continuar usando LEGEND CLUB."))return;await createClient().auth.signOut();router.replace("/");router.refresh();}
  // The browser can toggle the native open attribute before React hydrates.
  return <details className="account-menu" name="legend-header-actions" suppressHydrationWarning>
    <summary aria-label={`Cuenta de ${name}`}><CircleUserRound size={20} strokeWidth={1.8} aria-hidden="true" /></summary>
    <div className="account-popover">
      <strong>{name}</strong><small>{email}</small>
      <Link replace href="/panel?destino=perfil"><CircleUserRound size={16} strokeWidth={1.8} aria-hidden="true" /> Ir a mi perfil</Link>
      <button onClick={logout}><LogOut size={15} /> Cerrar sesión</button>
    </div>
  </details>;
}
