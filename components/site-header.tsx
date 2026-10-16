import Link from "next/link";
import { Menu } from "lucide-react";
import { Brand } from "./brand";
import { AccountMenu } from "./account-menu";
import { createClient } from "@/lib/supabase/server";

export async function SiteHeader() {
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  const name=user?.user_metadata?.full_name??user?.email?.split("@")[0]??"Usuario";
  const publicSection = (section: string) => `/?vista=publica#${section}`;
  return (
    <header className="site-header">
      <div className="container header-inner">
        <Brand />
        <nav className="desktop-nav" aria-label="Navegación principal">
          <Link href={publicSection("servicios")}>Servicios</Link>
          <Link href={publicSection("equipo")}>Equipo</Link>
          <Link href={publicSection("galeria")}>Galería</Link>
          <Link href={publicSection("productos")}>Productos</Link>
          <Link href={publicSection("visitanos")}>Visítanos</Link>
        </nav>
        <Link className="button button-small header-book" href="/reservar">
          Reservar cita
        </Link>
        {user?<AccountMenu name={name} email={user.email??""} avatarUrl={user.user_metadata?.avatar_url}/>:<Link className="header-login" href="/login">Iniciar sesión</Link>}
        <details className="mobile-menu">
          <summary aria-label="Abrir menú"><Menu size={22} /></summary>
          <nav>
            <Link href={publicSection("servicios")}>Servicios</Link>
            <Link href={publicSection("equipo")}>Equipo</Link>
            <Link href={publicSection("galeria")}>Galería</Link>
            <Link href={publicSection("productos")}>Productos</Link>
            <Link href={publicSection("visitanos")}>Visítanos</Link>
            {!user&&<Link href="/login">Iniciar sesión</Link>}
            <Link href="/reservar">Reservar cita</Link>
          </nav>
        </details>
      </div>
    </header>
  );
}
