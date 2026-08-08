import Link from "next/link";
import {
  ArrowRight,
  CalendarDays,
  Clock3,
  MapPin,
  MessageCircle,
  Sparkles,
} from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { ProductCatalog } from "@/components/product-catalog";
import { BearPawIcon, LegendCrownIcon, LegendDivider, StraightRazorIcon } from "@/components/legend-icons";
import { getPublicData } from "@/lib/public-data";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const { services, barbers, gallery, products, business } = await getPublicData();
  const isOpen = business.status === "open" || business.status === "appointment_only";
  const statusText = isOpen
    ? business.status === "appointment_only" ? "Atención solo con reserva" : "Abierto hoy"
    : business.status === "emergency_closed" ? "Cerrado por emergencia" : "Cerrado temporalmente";

  return (
    <>
      <SiteHeader />
      <main>
        <section className="hero">
          <div
            className="hero-photo"
            aria-hidden="true"
            style={business.coverImage ? { backgroundImage: `url(${business.coverImage})` } : undefined}
          />
          <div className="hero-shade" />
          <div className="container hero-content">
            <div className={`open-pill ${isOpen ? "" : "closed-pill"}`}>
              <span /> {statusText}{business.statusMessage ? ` · ${business.statusMessage}` : ""}
            </div>
            <p className="eyebrow light">TRADICIÓN · CALLE · PRECISIÓN</p>
            <h1>Respeto al estilo.<br /><em>Leyenda en cada corte.</em></h1>
            <p className="hero-copy">{business.slogan}</p>
            <div className="hero-actions">
              <Link className="button" href="/reservar">
                Reservar una cita <ArrowRight size={18} />
              </Link>
              <Link className="text-link light-link" href="#servicios">Ver servicios</Link>
            </div>
          </div>
          <div className="container hero-facts">
            <div><LegendCrownIcon size={19} /><strong>LEGEND CLUB</strong><span>La Paz, Bolivia</span></div>
            <div><Clock3 size={18} /><strong>Horario</strong><span>{business.hours}</span></div>
            <div><MapPin size={18} /><strong>La Paz</strong><span>{business.address}</span></div>
          </div>
        </section>

        <LegendDivider />

        <section className="section intro-section">
          <div className="container split-heading">
            <div>
              <p className="eyebrow">CÓDIGO LEGEND</p>
              <h2>El barrio reconoce<br /><em>un corte bien hecho.</em></h2>
            </div>
            <div className="intro-copy">
              <p>{business.description}</p>
              <div className="mini-benefits">
                {business.amenities.map((amenity, index) => <span key={amenity}>{index % 3 === 0 ? <BearPawIcon size={18} /> : index % 3 === 1 ? <StraightRazorIcon size={18} /> : <LegendCrownIcon size={18} />} {amenity}</span>)}
              </div>
            </div>
          </div>
        </section>

        <section className="section services-section" id="servicios">
          <div className="container">
            <div className="section-heading">
              <div>
                <p className="eyebrow">SERVICIOS</p>
                <h2>Clásicos del oficio,<br /><em>con sello Legend.</em></h2>
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
                <h2>Manos expertas.<br /><em>Respeto ganado.</em></h2>
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
                <h2>Trabajos con<br /><em>firma propia.</em></h2>
              </div>
              <a className="text-link" href="#">Síguenos en Instagram <ArrowRight size={16} /></a>
            </div>
            <div className="gallery-grid">
              {gallery.slice(0, 4).map((item, index) => (
                <div
                  className={`gallery-item gallery-${index + 1}`}
                  key={item.id}
                  style={{ backgroundImage: `url(${item.image})` }}
                  aria-label={item.title}
                  role="img"
                />
              ))}
            </div>
          </div>
        </section>

        <section className="section products-section" id="productos">
          <div className="container">
            <div className="section-heading">
              <div>
                <p className="eyebrow">PRODUCTOS</p>
                <h2>Cuidado profesional,<br /><em>también en casa.</em></h2>
              </div>
              <p>Productos seleccionados por el equipo. Consulta disponibilidad y apártalos por 24 horas.</p>
            </div>
            <ProductCatalog products={products} />
          </div>
        </section>

        <section className="visit-section" id="visitanos">
          <div className="visit-image" aria-hidden="true" />
          <div className="visit-card">
            <p className="eyebrow">VISÍTANOS</p>
            <h2>Tu próximo corte<br /><em>empieza aquí.</em></h2>
            <div className="visit-details">
              <div><MapPin /><p><strong>{business.address}</strong><span>La Paz, Bolivia</span></p></div>
              <div><Clock3 /><p><strong>Horario de atención</strong><span>{business.hours}</span></p></div>
              <div><MessageCircle /><p><strong>{business.phone}</strong><span>Escríbenos por WhatsApp</span></p></div>
            </div>
            <div className="visit-actions">
              <Link className="button button-dark" href="/reservar">Reservar ahora</Link>
              <a className="button button-outline" href={business.mapUrl} target="_blank" rel="noreferrer">Cómo llegar</a>
            </div>
          </div>
        </section>

        <section className="closing-cta">
          <BearPawIcon size={42} />
          <h2>Entra al club.</h2>
          <p>{business.slogan}</p>
          <Link className="button" href="/reservar">Ver horarios disponibles <Sparkles size={17} /></Link>
        </section>
      </main>
      <SiteFooter business={business} />
      <Link className="mobile-book-bar" href="/reservar">Reservar una cita <ArrowRight size={18} /></Link>
    </>
  );
}
