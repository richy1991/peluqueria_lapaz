import Link from "next/link";
import { Menu } from "lucide-react";
import { Brand } from "./brand";

export function SiteHeader() {
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
          <Link href="/panel">Mi cuenta</Link>
        </nav>
        <Link className="button button-small header-book" href="/reservar">
          Reservar cita
        </Link>
        <details className="mobile-menu">
          <summary aria-label="Abrir menú"><Menu size={22} /></summary>
          <nav>
            <Link href="/#servicios">Servicios</Link>
            <Link href="/#equipo">Equipo</Link>
            <Link href="/#galeria">Galería</Link>
            <Link href="/#productos">Productos</Link>
            <Link href="/#visitanos">Visítanos</Link>
            <Link href="/panel">Mi cuenta</Link>
            <Link href="/reservar">Reservar cita</Link>
          </nav>
        </details>
      </div>
    </header>
  );
}
