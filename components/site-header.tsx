import Link from "next/link";
import { Menu } from "lucide-react";
import { Brand } from "./brand";
import { AccountMenu } from "./account-menu";
import { createClient } from "@/lib/supabase/server";

export async function SiteHeader() {
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  const name=user?.user_metadata?.full_name??user?.email?.split("@")[0]??"Usuario";
  return (
    <header className="site-header">
      <div className="container header-inner">
        <Brand />
        <nav className="desktop-nav" aria-label="Navegación principal">
          <Link href="/#servicios">Servicios</Link>
          <Link href="/#equipo">Equipo</Link>
          <Link href="/#galeria">Galería</Link>
          <Link href="/#productos">Productos</Link>
          <Link href="/#visitanos">Visítanos</Link>
        </nav>
        <Link className="button button-small header-book" href="/reservar">
          Reservar cita
        </Link>
        {user?<AccountMenu name={name} email={user.email??""} avatarUrl={user.user_metadata?.avatar_url}/>:<Link className="header-login" href="/login">Iniciar sesión</Link>}
        <details className="mobile-menu">
          <summary aria-label="Abrir menú"><Menu size={22} /></summary>
          <nav>
            <Link href="/#servicios">Servicios</Link>
            <Link href="/#equipo">Equipo</Link>
            <Link href="/#galeria">Galería</Link>
            <Link href="/#productos">Productos</Link>
            <Link href="/#visitanos">Visítanos</Link>
            {!user&&<Link href="/login">Iniciar sesión</Link>}
            <Link href="/reservar">Reservar cita</Link>
          </nav>
        </details>
      </div>
    </header>
  );
}
