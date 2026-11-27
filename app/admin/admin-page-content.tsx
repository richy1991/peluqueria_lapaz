import Link from "next/link";
import { redirect } from "next/navigation";
import { ShieldAlert } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { AdminDashboard } from "./admin-dashboard";
import { AdminAccessFrame } from "./admin-access-frame";
import { getUserCapabilities } from "@/lib/user-capabilities";
import { DEFAULT_BUSINESS_TIMEZONE, resolveBusinessStatus } from "@/lib/business-hours";
import { businessDateKey } from "@/lib/business-time";
import type { AnalyticsData } from "./admin-analytics";
import {PanelExperience} from "@/components/panel-experience";
import type { AdminClient } from "./admin-clients-table";

type AdminPageContentProps = {
  initialSection?: string;
  clientSearch?: string;
  clientPage?: number;
};

function getAgendaTimezone(timezone: string) {
  try {
    return new Intl.DateTimeFormat("es-BO", { timeZone: timezone }).resolvedOptions().timeZone;
  } catch {
    return DEFAULT_BUSINESS_TIMEZONE;
  }
}

export async function AdminPageContent({
  initialSection,
  clientSearch = "",
  clientPage = 1,
}: AdminPageContentProps = {}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const destination = initialSection ? `/admin/${initialSection}` : "/admin";
  if (!user) redirect(`/admin/login?next=${encodeURIComponent(destination)}`);

  const { data: isAdmin, error: roleError } = await supabase.rpc("is_admin");
  if (roleError || !isAdmin) {
    return (
      <AdminAccessFrame>
        <section className="admin-access-notice" aria-labelledby="admin-access-title">
          <ShieldAlert size={26} aria-hidden="true" />
          <h1 id="admin-access-title">{roleError ? "No pudimos verificar el acceso" : "Acceso reservado al equipo"}</h1>
          <p>{roleError ? "Vuelve a intentarlo para comprobar los permisos de tu cuenta." : <>La cuenta <strong>{user.email ?? "con la que iniciaste sesión"}</strong> necesita permisos de administrador.</>}</p>
          {roleError ? <a href={destination}>Volver a intentar</a> : <Link href="/panel" replace>Ir a mi panel</Link>}
        </section>
      </AdminAccessFrame>
    );
  }

  const capabilities = await getUserCapabilities(user.id);
  const isSuperadmin = capabilities.isSuperadmin;
  if (!initialSection) redirect(`/admin/${isSuperadmin ? "administradores" : "agenda"}`);
  const resolvedSection = initialSection;
  if (resolvedSection === "administradores" && !isSuperadmin) redirect("/admin/agenda");

  const clientPageSize = 25;
  const [ownProfile, services, gallery, products, productCategories, barbers, cashiers, pendingBarbers, pendingCashiers, settings, businessHours, adminUsers, appointments, clientDirectory, analytics,marketing,loyaltySettings,rewards,promotions,expenses,payouts] = await Promise.all([
    supabase.from("profiles").select("id,full_name,email,phone,avatar_url,status").eq("id", user.id).maybeSingle(),
    ["servicios", "programa"].includes(resolvedSection) ? supabase.from("services").select("*").order("created_at") : Promise.resolve({ data: [] }),
    resolvedSection === "galeria" ? supabase.from("gallery_posts").select("*").order("created_at", { ascending: false }) : Promise.resolve({ data: [] }),
    ["productos", "programa"].includes(resolvedSection) ? supabase.from("products").select("*").order("created_at", { ascending: false }) : Promise.resolve({ data: [] }),
    resolvedSection === "productos" ? supabase.from("product_categories").select("name").eq("active", true).order("name") : Promise.resolve({ data: [] }),
    ["agenda", "equipo", "servicios", "programa"].includes(resolvedSection) ? supabase.from("barber_profiles").select("*,profiles!barber_profiles_user_id_fkey(email)").order("display_name") : Promise.resolve({ data: [] }),
    resolvedSection === "equipo" ? supabase.from("cashier_profiles").select("id,user_id,active,created_at,updated_at,profiles!cashier_profiles_user_id_fkey(id,full_name,email,phone,status)").order("created_at") : Promise.resolve({ data: [] }),
    resolvedSection === "equipo" ? supabase.from("pending_barbers").select("id,email,status,barber_profile_id,expires_at,created_at").eq("status","pending").order("created_at",{ascending:false}) : Promise.resolve({ data: [] }),
    resolvedSection === "equipo" ? supabase.from("pending_cashiers").select("id,email,status,expires_at,created_at").eq("status","pending").order("created_at",{ascending:false}) : Promise.resolve({ data: [] }),
    ["agenda", "negocio", "horarios"].includes(resolvedSection) ? supabase.from("business_settings").select("*").eq("id", true).single() : Promise.resolve({ data: null }),
    resolvedSection === "horarios" ? supabase.from("business_hours").select("*").order("weekday") : Promise.resolve({ data: [], error: null }),
    resolvedSection === "administradores" && isSuperadmin ? supabase.rpc("list_admin_users") : Promise.resolve({ data: [] }),
    resolvedSection === "agenda" ? supabase.from("appointments").select("id,barber_id,starts_at,status,service_name_snapshot,client_name_snapshot,barber_name_snapshot,profiles!appointments_client_id_fkey(full_name,email,phone,is_blacklisted),barber_profiles!appointments_barber_id_fkey(display_name)").order("starts_at", { ascending: false }).limit(100) : Promise.resolve({ data: [], error: null }),
    resolvedSection === "clientes"
      ? supabase.rpc("admin_list_clients", { search_term: clientSearch || null, page_number: clientPage, page_size: clientPageSize })
      : Promise.resolve({ data: { rows: [], total: 0 }, error: null }),
    resolvedSection === "estadisticas" ? supabase.rpc("admin_business_analytics") : Promise.resolve({ data: null }),
    resolvedSection === "estadisticas" ? supabase.rpc("admin_marketing_analytics") : Promise.resolve({ data: null }),
    resolvedSection === "programa" ? supabase.from("loyalty_settings").select("*").eq("id",true).maybeSingle() : Promise.resolve({ data: null }),
    resolvedSection === "programa" ? supabase.from("rewards").select("*").order("points_cost") : Promise.resolve({ data: [] }),
    resolvedSection === "programa" ? supabase.from("promotions").select("*,services(name)").order("created_at",{ascending:false}) : Promise.resolve({ data: [] }),
    resolvedSection === "programa" ? supabase.from("barber_expenses").select("*,barber_profiles(display_name)").order("created_at",{ascending:false}).limit(100) : Promise.resolve({ data: [] }),
    resolvedSection === "programa" ? supabase.from("payouts").select("*,barber_profiles(display_name)").order("created_at",{ascending:false}).limit(100) : Promise.resolve({ data: [] }),
  ]);

  const timezone = getAgendaTimezone(String(settings.data?.timezone ?? DEFAULT_BUSINESS_TIMEZONE));
  const agendaDate = new Intl.DateTimeFormat("es-BO", { dateStyle: "full", timeZone: timezone });
  const agendaTime = new Intl.DateTimeFormat("es-BO", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: timezone });

  const clientPayload = (clientDirectory.data ?? {}) as { rows?: AdminClient[]; total?: number };
  const clientRows = Array.isArray(clientPayload.rows) ? clientPayload.rows : [];
  const clientTotal = Number(clientPayload.total ?? 0);
  const clientTotalPages = Math.max(1, Math.ceil(clientTotal / clientPageSize));
  if (resolvedSection === "clientes" && !clientDirectory.error && clientPage > clientTotalPages) {
    const query = new URLSearchParams();
    if (clientSearch) query.set("q", clientSearch);
    if (clientTotalPages > 1) query.set("page", String(clientTotalPages));
    redirect(`/admin/clientes${query.size ? `?${query}` : ""}`);
  }

  return (
    <PanelExperience><AdminDashboard
      initialSection={resolvedSection}
      adminProfile={{
        id: user.id,
        full_name: ownProfile.data?.full_name ?? user.user_metadata?.full_name ?? user.email?.split("@")[0] ?? "Administrador",
        email: ownProfile.data?.email ?? user.email ?? "",
        phone: ownProfile.data?.phone ?? null,
        avatar_url: ownProfile.data?.avatar_url ?? user.user_metadata?.avatar_url ?? null,
        status: ownProfile.data?.status ?? "active",
      }}
      initialServices={services.data ?? []}
      initialGallery={gallery.data ?? []}
      initialProducts={products.data ?? []}
      initialProductCategories={(productCategories.data ?? []).map((category) => String(category.name))}
      barbers={barbers.data ?? []}
      cashiers={cashiers.data ?? []}
      pendingBarbers={pendingBarbers.data ?? []}
      pendingCashiers={pendingCashiers.data ?? []}
      initialSettings={resolvedSection === "agenda" ? { timezone } : settings.data}
      initialBusinessHours={businessHours.data ?? []}
      initialHoursStatus={resolvedSection === "horarios"
        ? resolveBusinessStatus(String(settings.data?.business_status ?? "open"), businessHours.data ?? [], timezone)
        : "schedule_closed"}
      businessHoursLoadError={Boolean(businessHours.error)}
      isSuperadmin={Boolean(isSuperadmin)}
      adminUsers={adminUsers.data ?? []}
      hasBarber={Boolean(capabilities.barber)}
      hasCashier={capabilities.isCashier}
      appointmentsLoadError={Boolean(appointments.error)}
      initialAppointments={(appointments.data ?? []).map(item => {
        const startsAt = new Date(item.starts_at);
        const client = Array.isArray(item.profiles) ? item.profiles[0] : item.profiles;
        const barber = Array.isArray(item.barber_profiles) ? item.barber_profiles[0] : item.barber_profiles;
        return {
          id: item.id,
          barberId: item.barber_id ?? null,
          startsAt: item.starts_at,
          dateKey: businessDateKey(startsAt, timezone),
          dateLabel: agendaDate.format(startsAt),
          timeLabel: agendaTime.format(startsAt),
          service: item.service_name_snapshot,
          clientName: client?.full_name ?? client?.email ?? item.client_name_snapshot ?? "Cliente",
          phone: client?.phone ?? null,
          flagged: Boolean(client?.is_blacklisted),
          barberName: barber?.display_name ?? item.barber_name_snapshot ?? "Sin asignar",
          status: item.status,
        };
      })}
      clients={clientRows}
      clientSearch={clientSearch}
      clientPage={clientPage}
      clientPageSize={clientPageSize}
      clientTotal={clientTotal}
      clientLoadError={Boolean(clientDirectory.error)}
      analyticsData={analytics.data?{...(analytics.data as AnalyticsData),marketing:(marketing.data as AnalyticsData["marketing"])??undefined}:null}
      program={{settings:loyaltySettings.data,rewards:rewards.data??[],promotions:promotions.data??[],expenses:expenses.data??[],payouts:payouts.data??[]}}
    /></PanelExperience>
  );
}
