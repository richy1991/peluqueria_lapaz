import Link from "next/link";
import { MessageCircle } from "lucide-react";
import { Brand } from "./brand";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="container footer-grid">
        <div className="footer-brand">
          <Brand />
          <p>Buen oficio, atención honesta y un estilo que se siente tuyo.</p>
        </div>
        <div>
          <h3>Explora</h3>
          <Link href="/#servicios">Servicios</Link>
          <Link href="/#equipo">Nuestro equipo</Link>
          <Link href="/#galeria">Trabajos</Link>
          <Link href="/reservar">Reservar</Link>
        </div>
        <div>
          <h3>Contacto</h3>
          <p>Av. 6 de Agosto 2145, Sopocachi</p>
          <p>La Paz, Bolivia</p>
          <p>+591 720 12345</p>
        </div>
        <div>
          <h3>Síguenos</h3>
          <div className="social-row">
            <a href="#" aria-label="Instagram"><strong>IG</strong></a>
            <a href="#" aria-label="Facebook"><strong>f</strong></a>
            <a href="#" aria-label="WhatsApp"><MessageCircle size={20} /></a>
          </div>
        </div>
      </div>
      <div className="container footer-bottom">
        <span>© {new Date().getFullYear()} Navaja. Marca demostrativa.</span>
        <span>Privacidad · Condiciones de reserva</span>
      </div>
    </footer>
  );
}
