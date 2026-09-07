import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AdminDashboard } from "./admin-dashboard";
import { getUserCapabilities } from "@/lib/user-capabilities";
import type { AnalyticsData } from "./admin-analytics";
import {PanelExperience} from "@/components/panel-experience";
import type { AdminClient } from "./admin-clients-table";

type AdminPageContentProps = {
  initialSection?: string;
  clientSearch?: string;
  clientPage?: number;
};

export async function AdminPageContent({
  initialSection,
  clientSearch = "",
  clientPage = 1,
}: AdminPageContentProps = {}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/admin/login");

  const { data: isAdmin, error: roleError } = await supabase.rpc("is_admin");
  if (roleError || !isAdmin) {
    return (
      <main className="admin-denied">
        <h1>Cuenta sin acceso administrativo</h1>
        <p>La cuenta {user.email} inició sesión correctamente, pero todavía no tiene el rol administrador.</p>
        <Link className="button button-dark" href="/">Volver al inicio</Link>
      </main>
    );
  }

  const capabilities = await getUserCapabilities(user.id);
  const isSuperadmin = capabilities.isSuperadmin;
  if (!initialSection) redirect(`/admin/${isSuperadmin ? "administradores" : "agenda"}`);
  const resolvedSection = initialSection;
  if (resolvedSection === "administradores" && !isSuperadmin) redirect("/admin/agenda");

  const clientPageSize = 25;
  const [ownProfile, services, gallery, products, barbers, cashiers, pendingCashiers, settings, businessHours, adminUsers, appointments, clientDirectory, analytics,marketing,loyaltySettings,rewards,promotions,expenses,payouts] = await Promise.all([
    supabase.from("profiles").select("id,full_name,email,phone,avatar_url,status").eq("id", user.id).maybeSingle(),
    ["servicios", "programa"].includes(resolvedSection) ? supabase.from("services").select("*").order("created_at") : Promise.resolve({ data: [] }),
    resolvedSection === "galeria" ? supabase.from("gallery_posts").select("*").order("created_at", { ascending: false }) : Promise.resolve({ data: [] }),
    ["productos", "programa"].includes(resolvedSection) ? supabase.from("products").select("*").order("created_at", { ascending: false }) : Promise.resolve({ data: [] }),
    ["agenda", "equipo", "servicios", "programa"].includes(resolvedSection) ? supabase.from("barber_profiles").select("*").order("display_name") : Promise.resolve({ data: [] }),
    resolvedSection === "equipo" ? supabase.from("cashier_profiles").select("id,user_id,active,created_at,updated_at,profiles!cashier_profiles_user_id_fkey(id,full_name,email,phone,status)").order("created_at") : Promise.resolve({ data: [] }),
    resolvedSection === "equipo" ? supabase.from("pending_cashiers").select("id,email,status,expires_at,created_at").eq("status","pending").order("created_at",{ascending:false}) : Promise.resolve({ data: [] }),
    ["negocio", "horarios"].includes(resolvedSection) ? supabase.from("business_settings").select("*").eq("id", true).single() : Promise.resolve({ data: null }),
    resolvedSection === "horarios" ? supabase.from("business_hours").select("weekday,opens_at,closes_at,active").order("weekday") : Promise.resolve({ data: [] }),
    resolvedSection === "administradores" && isSuperadmin ? supabase.rpc("list_admin_users") : Promise.resolve({ data: [] }),
    resolvedSection === "agenda" ? supabase.from("appointments").select("id,starts_at,status,service_name_snapshot,price_snapshot,profiles!appointments_client_id_fkey(full_name,email,phone,is_blacklisted),barber_profiles(display_name)").order("starts_at", { ascending: false }).limit(100) : Promise.resolve({ data: [] }),
    resolvedSection === "clientes"
      ? supabase.rpc("admin_list_clients", { search_term: clientSearch || null, page_number: clientPage, page_size: clientPageSize })
      : Promise.resolve({ data: { rows: [], total: 0 }, error: null }),
    resolvedSection === "estadisticas" ? supabase.rpc("admin_business_analytics") : Promise.resolve({ data: null }),
    resolvedSection === "estadisticas" ? supabase.rpc("admin_marketing_analytics") : Promise.resolve({ data: null }),
    resolvedSection === "programa" ? supabase.from("loyalty_settings").select("*").eq("id",true).maybeSingle() : Promise.resolve({ data: null }),
    resolvedSection === "programa" ? supabase.from("rewards").select("*").order("points_cost") : Promise.resolve({ data: [] }),
    resolvedSection === "programa" ? supabase.from("promotions").select("*").order("created_at",{ascending:false}) : Promise.resolve({ data: [] }),
    resolvedSection === "programa" ? supabase.from("barber_expenses").select("*,barber_profiles(display_name)").order("created_at",{ascending:false}).limit(100) : Promise.resolve({ data: [] }),
    resolvedSection === "programa" ? supabase.from("payouts").select("*,barber_profiles(display_name)").order("created_at",{ascending:false}).limit(100) : Promise.resolve({ data: [] }),
  ]);

  const clientPayload = (clientDirectory.data ?? {}) as { rows?: AdminClient[]; total?: number };
  const clientRows = Array.isArray(clientPayload.rows) ? clientPayload.rows : [];
  const clientTotal = Number(clientPayload.total ?? 0);
  const clientTotalPages = Math.max(1, Math.ceil(clientTotal / clientPageSize));
  if (resolvedSection === "clientes" && clientTotal > 0 && clientPage > clientTotalPages) {
    const query = new URLSearchParams();
    if (clientSearch) query.set("q", clientSearch);
    if (clientTotalPages > 1) query.set("page", String(clientTotalPages));
    redirect(`/admin/clientes${query.size ? `?${query}` : ""}`);
  }

  return (
    <PanelExperience><AdminDashboard
      initialSection={resolvedSection}
      isRootPage={!initialSection}
      userEmail={user.email ?? "Administrador"}
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
      barbers={barbers.data ?? []}
      cashiers={cashiers.data ?? []}
      pendingCashiers={pendingCashiers.data ?? []}
      initialSettings={settings.data}
      initialBusinessHours={businessHours.data ?? []}
      isSuperadmin={Boolean(isSuperadmin)}
      adminUsers={adminUsers.data ?? []}
      hasBarber={Boolean(capabilities.barber)}
      initialAppointments={appointments.data ?? []}
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
