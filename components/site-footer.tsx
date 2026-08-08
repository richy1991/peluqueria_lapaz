import Link from "next/link";
import { MessageCircle } from "lucide-react";
import { Brand } from "./brand";
import type { BusinessInfo } from "@/lib/public-data";

export function SiteFooter({ business }: { business?: BusinessInfo }) {
  return (
    <footer className="site-footer">
      <div className="container footer-grid">
        <div className="footer-brand">
          <Brand />
          <p>Respeto por el oficio, identidad de barrio y un corte digno de leyenda.</p>
        </div>
        <div>
          <h3>Explora</h3>
          <Link href="/#servicios">Servicios</Link>
          <Link href="/#equipo">Nuestro equipo</Link>
          <Link href="/#galeria">Trabajos</Link>
          <Link href="/#productos">Productos</Link>
          <Link href="/reservar">Reservar</Link>
        </div>
        <div>
          <h3>Contacto</h3>
          <p>{business?.address ?? "Av. 6 de Agosto 2145, Sopocachi"}</p>
          <p>{business?.hours ?? "La Paz, Bolivia"}</p>
          <p>{business?.phone ?? "+591 720 12345"}</p>
        </div>
        <div>
          <h3>Síguenos</h3>
          <div className="social-row">
            <a href={business?.instagramUrl ?? "#"} aria-label="Instagram" target="_blank" rel="noreferrer"><strong>IG</strong></a>
            <a href={business?.facebookUrl ?? "#"} aria-label="Facebook" target="_blank" rel="noreferrer"><strong>f</strong></a>
            <a href={business?.whatsapp ? `https://wa.me/${business.whatsapp}` : "#"} aria-label="WhatsApp" target="_blank" rel="noreferrer"><MessageCircle size={20} /></a>
          </div>
        </div>
      </div>
      <div className="container footer-bottom">
        <span>© {new Date().getFullYear()} Barbería LEGEND CLUB.</span>
        <span>Privacidad · Condiciones de reserva</span>
      </div>
    </footer>
  );
}
