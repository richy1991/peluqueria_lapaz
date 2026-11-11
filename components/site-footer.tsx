import Link from "next/link";
import { Brand } from "./brand";
import { FacebookIcon, InstagramIcon, TikTokIcon, WhatsAppIcon } from "./social-icons";
import type { BusinessInfo } from "@/lib/public-data";

export function SiteFooter({ business }: { business?: BusinessInfo }) {
  const publicSection = (section: string) => `/?vista=publica#${section}`;
  return (
    <footer className="site-footer">
      <div className="container footer-grid">
        <div className="footer-brand">
          <Brand />
          <p>{business?.slogan ?? "Empezamos como un servicio al cliente y terminamos como amigos."}</p>
        </div>
        <div>
          <h3>Explora</h3>
          <Link href={publicSection("servicios")}>Servicios</Link>
          <Link href={publicSection("equipo")}>Nuestro equipo</Link>
          <Link href={publicSection("galeria")}>Trabajos</Link>
          <Link href={publicSection("productos")}>Productos</Link>
          <Link href="/reservar">Reservar</Link>
        </div>
        <div>
          <h3>Contacto</h3>
          <p>{business?.address ?? "Av. Jaime Freyre, casa N.º 2057, La Paz"}</p>
          <p>{business?.hours ?? "La Paz, Bolivia"}</p>
          <p>{business?.phone ?? "+591 62600874"}</p>
        </div>
        <div>
          <h3>Síguenos</h3>
          <div className="social-row">
            {business?.instagramUrl && business.instagramUrl !== "#" && <a className="social-instagram" href={business.instagramUrl} aria-label="Instagram" target="_blank" rel="noreferrer"><InstagramIcon /></a>}
            {business?.facebookUrl && business.facebookUrl !== "#" && <a className="social-facebook" href={business.facebookUrl} aria-label="Facebook" target="_blank" rel="noreferrer"><FacebookIcon /></a>}
            {business?.tiktokUrl && business.tiktokUrl !== "#" && <a className="social-tiktok" href={business.tiktokUrl} aria-label="TikTok" target="_blank" rel="noreferrer"><TikTokIcon /></a>}
            {business?.whatsapp && <a className="social-whatsapp" href={`https://wa.me/${business.whatsapp}`} aria-label="WhatsApp" target="_blank" rel="noreferrer"><WhatsAppIcon /></a>}
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
