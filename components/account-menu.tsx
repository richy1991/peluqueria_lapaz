"use client";

import Link from "next/link";
import { LogOut, UserRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function AccountMenu({ name, email, avatarUrl }: { name: string; email: string; avatarUrl?: string }) {
  const router=useRouter();
  async function logout(){await createClient().auth.signOut();router.replace("/");router.refresh();}
  const initials=name.split(" ").slice(0,2).map(part=>part[0]).join("").toUpperCase();
  return <details className="account-menu"><summary aria-label={`Cuenta de ${name}`}>{avatarUrl?<span className="account-avatar" style={{backgroundImage:`url(${avatarUrl})`}}/>:<span className="account-avatar account-initials">{initials||<UserRound size={18}/>}</span>}</summary><div className="account-popover"><strong>{name}</strong><small>{email}</small><Link replace href="/panel"><UserRound size={15}/> Ir a mi panel</Link><button onClick={logout}><LogOut size={15}/> Cerrar sesión</button></div></details>;
}
