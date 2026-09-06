import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AdminDashboard } from "./admin-dashboard";
import { getUserCapabilities } from "@/lib/user-capabilities";
import type { AnalyticsData } from "./admin-analytics";
import {PanelExperience} from "@/components/panel-experience";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
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
  const [ownProfile, services, gallery, products, barbers, cashiers, pendingCashiers, settings, businessHours, adminUsers, appointments, profiles, analytics,marketing,loyaltySettings,rewards,promotions,expenses,payouts] = await Promise.all([
    supabase.from("profiles").select("id,full_name,email,phone,avatar_url,status").eq("id", user.id).maybeSingle(),
    supabase.from("services").select("*").order("created_at"),
    supabase.from("gallery_posts").select("*").order("created_at", { ascending: false }),
    supabase.from("products").select("*").order("created_at", { ascending: false }),
    supabase.from("barber_profiles").select("*").order("display_name"),
    supabase.from("cashier_profiles").select("id,user_id,active,created_at,updated_at,profiles!cashier_profiles_user_id_fkey(id,full_name,email,phone,status)").order("created_at"),
    supabase.from("pending_cashiers").select("id,email,status,expires_at,created_at").eq("status","pending").order("created_at",{ascending:false}),
    supabase.from("business_settings").select("*").eq("id", true).single(),
    supabase.from("business_hours").select("weekday,opens_at,closes_at,active").order("weekday"),
    isSuperadmin ? supabase.rpc("list_admin_users") : Promise.resolve({ data: [] }),
    supabase.from("appointments").select("id,starts_at,status,service_name_snapshot,price_snapshot,profiles!appointments_client_id_fkey(full_name,email,phone,is_blacklisted),barber_profiles(display_name)").order("starts_at", { ascending: false }).limit(100),
    supabase.from("profiles").select("id,full_name,email,phone,status,no_show_count,is_blacklisted,is_blocked,user_roles(role)").order("created_at", { ascending: false }).limit(100),
    supabase.rpc("admin_business_analytics"),
    supabase.rpc("admin_marketing_analytics"),
    supabase.from("loyalty_settings").select("*").eq("id",true).maybeSingle(),
    supabase.from("rewards").select("*").order("points_cost"),
    supabase.from("promotions").select("*").order("created_at",{ascending:false}),
    supabase.from("barber_expenses").select("*,barber_profiles(display_name)").order("created_at",{ascending:false}).limit(100),
    supabase.from("payouts").select("*,barber_profiles(display_name)").order("created_at",{ascending:false}).limit(100),
  ]);

  return (
    <PanelExperience><AdminDashboard
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
      clients={(profiles.data ?? []).filter((profile) => !profile.user_roles?.some((role) => role.role === "admin" || role.role === "superadmin"))}
      analyticsData={analytics.data?{...(analytics.data as AnalyticsData),marketing:(marketing.data as AnalyticsData["marketing"])??undefined}:null}
      program={{settings:loyaltySettings.data,rewards:rewards.data??[],promotions:promotions.data??[],expenses:expenses.data??[],payouts:payouts.data??[]}}
    /></PanelExperience>
  );
}
