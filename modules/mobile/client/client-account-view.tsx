import Link from "next/link";
import { redirect } from "next/navigation";
import { formatBookingDateTime } from "@/lib/business-time";
import { ArrowLeft, CircleUserRound, Images, PackageCheck, Star } from "lucide-react";
import { PublicHomeLink } from "@/components/public-home-link";
import type { ReactNode } from "react";
import { Brand } from "@/components/brand";
import { BusinessStatus } from "@/components/business-status";
import { ProductCatalog } from "@/components/product-catalog";
import { GalleryCatalog } from "@/components/gallery-catalog";
import { createClient } from "@/lib/supabase/server";
import { getUserCapabilities } from "@/lib/user-capabilities";
import { getPublicGallery, getPublicProducts, type PublicGalleryItem } from "@/lib/public-data";
import { DEFAULT_BUSINESS_TIMEZONE, resolveBusinessStatus, type BusinessHour } from "@/lib/business-hours";
import { StaggerContainer } from "@/components/stagger-animations";
import { PanelBottomNavigation, type PanelNavigationItem } from "@/components/panel-bottom-navigation";
import {
  PanelExperience,
  PanelViewportPortal,
} from "@/components/panel-experience";
import { CLIENT_NAVIGATION, type ClientSection } from "./contracts";
import { ClientHomeView } from "./client-home-view";
import { ClientPointsView } from "./client-points-view";

export async function ClientAccountView({ section }: { section: ClientSection }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    const destination = section === "inicio" ? "/mi-cuenta" : `/mi-cuenta/${section}`;
    redirect(`/login?next=${encodeURIComponent(destination)}`);
  }
  const capabilities = await getUserCapabilities(user.id);
  if (capabilities.isAdmin) redirect("/admin");
  if (capabilities.isCashier) redirect("/caja");
  if (capabilities.barber) redirect("/barbero");

  if (section === "productos") {
    const [{ data, error }, products, settings] = await Promise.all([
      supabase.from("product_reservations").select("id,quantity,price_snapshot,expires_at,products(name)")
        .eq("client_id", user.id).eq("status", "reserved").gt("expires_at", new Date().toISOString()).order("created_at", { ascending: false }),
      getPublicProducts(),
      supabase.from("business_settings").select("timezone").eq("id", true).maybeSingle(),
    ]);
    const timezone = settings.data?.timezone ?? DEFAULT_BUSINESS_TIMEZONE;
    const reservations = (data ?? []).map((item) => {
      const relation = item.products as { name?: string } | { name?: string }[] | null;
      const product = Array.isArray(relation) ? relation[0] : relation;
      return {
        id: item.id,
        productName: product?.name ?? "Producto",
        quantity: item.quantity,
        unitPrice: Number(item.price_snapshot),
        expiresAt: item.expires_at,
        expiresLabel: formatBookingDateTime(new Date(item.expires_at), timezone),
      };
    });

    return <ClientSectionFrame section={section} className="client-products-screen" title="Productos y apartados" description="Aparta por 24 horas y paga al recoger en la barbería.">
      <section id="productos" aria-label="Catálogo de productos">
        <ProductCatalog products={products} reservations={reservations} reservationsError={Boolean(error)} />
      </section>
    </ClientSectionFrame>;
  }

  if (section === "puntos") {
    await supabase.rpc("refresh_my_barber_loyalty");
    const [profile, balances, movements, settings] = await Promise.all([
      supabase.from("profiles").select("referral_code").eq("id", user.id).maybeSingle(),
      supabase.from("customer_barber_loyalty_accounts").select("barber_id,balance,lifetime_earned,lifetime_redeemed,barber_profiles(display_name)").eq("user_id", user.id).order("balance", { ascending: false }),
      supabase.from("loyalty_transactions").select("id,points,reason,created_at,barber_id_snapshot,barber_profiles(display_name)").eq("user_id", user.id).or("barber_id.not.is.null,barber_id_snapshot.not.is.null").order("created_at", { ascending: false }).limit(20),
      supabase.from("business_settings").select("timezone").eq("id", true).maybeSingle(),
    ]);

    return <ClientSectionFrame section={section} className="client-points-screen" title="Puntos y recompensas" description="Tus puntos se acumulan por barbero.">
      <ClientPointsView
        balances={balances.data ?? []}
        movements={movements.data ?? []}
        referralCode={profile.data?.referral_code}
        timezone={settings.data?.timezone ?? DEFAULT_BUSINESS_TIMEZONE}
        balancesUnavailable={Boolean(balances.error)}
        movementsUnavailable={Boolean(movements.error)}
      />
    </ClientSectionFrame>;
  }

  if (section === "inicio") await supabase.rpc("refresh_my_barber_loyalty");
  const requestTime = new Date().toISOString();
  const [profile, appointments, businessSettings, businessHours, gallery] = await Promise.all([
    section === "inicio" ? supabase.from("profiles").select("full_name,email,phone,avatar_url,status,no_show_count,is_blacklisted,is_blocked").eq("id", user.id).maybeSingle() : Promise.resolve({ data: null }),
    section === "inicio" ? supabase.from("appointments").select("id,starts_at,status,price_snapshot,service_name_snapshot,barber_name_snapshot,barber_profiles!appointments_barber_id_fkey(display_name)").eq("client_id", user.id).gte("starts_at", requestTime).in("status", ["requested", "confirmed", "in_progress", "pending_payment", "pending_client_confirmation", "needs_reschedule"]).order("starts_at", { ascending: true }).limit(1) : Promise.resolve({ data: [] }),
    supabase.from("business_settings").select("business_status,status_message,timezone").eq("id", true).maybeSingle(),
    supabase.from("business_hours").select("*").order("weekday"),
    section === "galeria" ? getPublicGallery() : Promise.resolve([]),
  ]);

  const clientBusinessHours = (businessHours.data ?? []) as BusinessHour[];
  const clientBusinessTimezone = String(businessSettings.data?.timezone ?? DEFAULT_BUSINESS_TIMEZONE);
  const clientConfiguredStatus = String(businessSettings.data?.business_status ?? "open");
  const clientInitialStatus = resolveBusinessStatus(clientConfiguredStatus, clientBusinessHours, clientBusinessTimezone);
  const businessStatus = <BusinessStatus configuredStatus={clientConfiguredStatus} initialStatus={clientInitialStatus} statusMessage={String(businessSettings.data?.status_message ?? "")} timezone={clientBusinessTimezone} hours={clientBusinessHours} variant="client" />;

  if (section === "inicio") {
    return <PanelExperience chatInHeader>
      <ClientHomeView
        profile={profile.data}
        accountEmail={user.email}
        appointment={appointments.data?.[0]}
        timezone={clientBusinessTimezone}
        businessStatus={businessStatus}
      />
      <PanelViewportPortal><ClientMainNavigation section={section} replaceNavigation={false} variant="mobile" /></PanelViewportPortal>
    </PanelExperience>;
  }

  const clientHeroImage = "/brand/legend-club-salon-header.jpg";

  return <PanelExperience chatInHeader><main className="portal-shell panel-client-shell">
    <section className="client-page-hero client-gallery-hero" style={{ backgroundImage: `url(${JSON.stringify(clientHeroImage)})` }}>
      <div className="client-hero-shade" />
      <div className="client-hero-top">
        <div className="client-hero-brand"><Brand linked={false} />{businessStatus}</div>
        <PublicHomeLink />
      </div>
      <div className="client-hero-content"><p className="eyebrow">INSPIRACIÓN LEGEND</p><h1>Galería de trabajos</h1><p>Explora los cortes y estilos publicados por nuestro equipo.</p></div>
    </section>

    <StaggerContainer className="portal-grid client-section-grid client-gallery-page">
      <section className="portal-card portal-wide"><div className="portal-title"><Images /><div><small>PORTAFOLIO DEL EQUIPO</small><h2>Trabajos Legend</h2></div></div><GalleryCatalog items={gallery as PublicGalleryItem[]} /></section>
    </StaggerContainer>

  </main>
  <PanelViewportPortal>
    <ClientMainNavigation section={section} replaceNavigation variant="mobile" />
  </PanelViewportPortal></PanelExperience>;
}

function ClientSectionFrame({ section, title, description, className, children }: {
  section: "productos" | "puntos";
  title: string;
  description: string;
  className: string;
  children: ReactNode;
}) {
  return <PanelExperience chatInHeader>
    <main className={`portal-shell panel-client-shell client-section-screen ${className}`}>
      <header className="client-section-topbar">
        <div className="client-section-width">
          <Brand linked={false} />
          <div className="client-header-actions">
            <Link href="/mi-cuenta"><ArrowLeft size={16} aria-hidden="true" /> Mi perfil</Link>
            <PublicHomeLink />
          </div>
        </div>
      </header>
      <div className="client-section-width">
        <div className="client-section-heading"><h1>{title}</h1><p>{description}</p></div>
        {children}
      </div>
    </main>
    <PanelViewportPortal><ClientMainNavigation section={section} replaceNavigation variant="mobile" /></PanelViewportPortal>
  </PanelExperience>;
}

const clientNavigationIcons = { inicio: CircleUserRound, productos: PackageCheck, puntos: Star } as const;

function ClientMainNavigation({ section, replaceNavigation, variant }: { section: ClientSection; replaceNavigation: boolean; variant: "desktop" | "mobile" }) {
  if (variant === "mobile") {
    const items: PanelNavigationItem[] = CLIENT_NAVIGATION.map(item => {
      const Icon = clientNavigationIcons[item.id];
      return { ...item, icon: <Icon /> };
    });
    return <PanelBottomNavigation items={items} activeId={section} replace={replaceNavigation} className="client-bottom-nav" ariaLabel="Navegación principal" />;
  }

  return <nav className="client-desktop-nav" aria-label="Navegación del cliente">
    {CLIENT_NAVIGATION.map(item => { const Icon = clientNavigationIcons[item.id]; const active = section === item.id; return <Link key={item.id} href={item.href} replace={replaceNavigation} aria-label={item.label} aria-current={active ? "page" : undefined} className={active ? "active" : ""}><Icon /><span>{item.label}</span><i /></Link>; })}
  </nav>;
}
