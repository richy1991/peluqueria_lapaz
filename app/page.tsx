import Link from "next/link";
import {
  ArrowRight,
  CalendarDays,
  Check,
  Clock3,
  MapPin,
  MessageCircle,
  Scissors,
  Sparkles,
  Star,
} from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { barbers, gallery, services } from "@/lib/demo-data";

export default function HomePage() {
  return (
    <>
      <SiteHeader />
      <main>
        <section className="hero">
          <div className="hero-photo" aria-hidden="true" />
          <div className="hero-shade" />
          <div className="container hero-content">
            <div className="open-pill"><span /> Abierto hoy · hasta las 20:00</div>
            <p className="eyebrow light">OFICIO · DETALLE · ACTITUD</p>
            <h1>Tu estilo.<br /><em>Bien hecho.</em></h1>
            <p className="hero-copy">
              Cortes precisos, atención sin apuros y un espacio pensado para que vuelvas.
            </p>
            <div className="hero-actions">
              <Link className="button" href="/reservar">
                Reservar una cita <ArrowRight size={18} />
              </Link>
              <Link className="text-link light-link" href="#servicios">Ver servicios</Link>
            </div>
          </div>
          <div className="container hero-facts">
            <div><Star size={17} fill="currentColor" /><strong>4.9</strong><span>clientes felices</span></div>
            <div><Clock3 size={18} /><strong>Mar — Dom</strong><span>09:00 a 20:00</span></div>
            <div><MapPin size={18} /><strong>Sopocachi</strong><span>La Paz</span></div>
          </div>
        </section>

        <section className="section intro-section">
          <div className="container split-heading">
            <div>
              <p className="eyebrow">NUESTRA MANERA</p>
              <h2>Más que un corte,<br /><em>un buen momento.</em></h2>
            </div>
            <div className="intro-copy">
              <p>
                Creemos en escuchar primero y cortar después. Cada servicio comienza con una
                conversación para entender qué buscas y termina solo cuando el resultado se siente tuyo.
              </p>
              <div className="mini-benefits">
                <span><Check size={16} /> Asesoría personal</span>
                <span><Check size={16} /> Horarios puntuales</span>
                <span><Check size={16} /> Productos profesionales</span>
              </div>
            </div>
          </div>
        </section>

        <section className="section services-section" id="servicios">
          <div className="container">
            <div className="section-heading">
              <div>
                <p className="eyebrow">SERVICIOS</p>
                <h2>Lo esencial,<br /><em>hecho con precisión.</em></h2>
              </div>
              <p>Precios claros y el tiempo necesario para hacer las cosas bien.</p>
            </div>
            <div className="service-list">
              {services.map((service, index) => (
                <article className="service-row" key={service.id}>
                  <span className="service-number">0{index + 1}</span>
                  <div>
                    <span className="tag">{service.category}</span>
                    <h3>{service.name}</h3>
                    <p>{service.description}</p>
                  </div>
                  <div className="service-meta">
                    <strong>Bs {service.price}</strong>
                    <span>{service.duration} min</span>
                  </div>
                  <Link aria-label={`Reservar ${service.name}`} href={`/reservar?servicio=${service.id}`}>
                    <ArrowRight size={21} />
                  </Link>
                </article>
              ))}
            </div>
            <div className="center-action">
              <Link className="button button-dark" href="/reservar">Elegir servicio y reservar</Link>
            </div>
          </div>
        </section>

        <section className="section team-section" id="equipo">
          <div className="container">
            <div className="section-heading light-heading">
              <div>
                <p className="eyebrow light">EL EQUIPO</p>
                <h2>Buenas manos.<br /><em>Grandes personas.</em></h2>
              </div>
              <p>Elige a tu profesional de confianza o déjanos asignarte el primer horario disponible.</p>
            </div>
            <div className="team-grid">
              {barbers.map((barber) => (
                <article className="barber-card" key={barber.id}>
                  <div className="barber-photo" style={{ backgroundImage: `url(${barber.image})` }}>
                    <Link href={`/reservar?peluquero=${barber.id}`} aria-label={`Reservar con ${barber.name}`}>
                      <CalendarDays size={20} />
                    </Link>
                  </div>
                  <span>{barber.role}</span>
                  <h3>{barber.name}</h3>
                  <p>{barber.specialties}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="section gallery-section" id="galeria">
          <div className="container">
            <div className="section-heading">
              <div>
                <p className="eyebrow">TRABAJOS RECIENTES</p>
                <h2>Resultados que<br /><em>hablan solos.</em></h2>
              </div>
              <a className="text-link" href="#">Síguenos en Instagram <ArrowRight size={16} /></a>
            </div>
            <div className="gallery-grid">
              {gallery.map((image, index) => (
                <div
                  className={`gallery-item gallery-${index + 1}`}
                  key={image}
                  style={{ backgroundImage: `url(${image})` }}
                  aria-label={`Trabajo destacado ${index + 1}`}
                  role="img"
                />
              ))}
            </div>
          </div>
        </section>

        <section className="visit-section" id="visitanos">
          <div className="visit-image" aria-hidden="true" />
          <div className="visit-card">
            <p className="eyebrow">VISÍTANOS</p>
            <h2>Tu próximo corte<br /><em>empieza aquí.</em></h2>
            <div className="visit-details">
              <div><MapPin /><p><strong>Av. 6 de Agosto 2145</strong><span>Sopocachi, La Paz</span></p></div>
              <div><Clock3 /><p><strong>Martes a domingo</strong><span>09:00 — 20:00</span></p></div>
              <div><MessageCircle /><p><strong>+591 720 12345</strong><span>Escríbenos por WhatsApp</span></p></div>
            </div>
            <div className="visit-actions">
              <Link className="button button-dark" href="/reservar">Reservar ahora</Link>
              <a className="button button-outline" href="https://maps.google.com" target="_blank" rel="noreferrer">Cómo llegar</a>
            </div>
          </div>
        </section>

        <section className="closing-cta">
          <Scissors size={34} />
          <h2>¿Listo para un cambio?</h2>
          <p>Encuentra tu horario en menos de un minuto.</p>
          <Link className="button" href="/reservar">Ver horarios disponibles <Sparkles size={17} /></Link>
        </section>
      </main>
      <SiteFooter />
      <Link className="mobile-book-bar" href="/reservar">Reservar una cita <ArrowRight size={18} /></Link>
    </>
  );
}
