import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AdminDashboard } from "./admin-dashboard";
import { getUserCapabilities } from "@/lib/user-capabilities";
import type { AnalyticsData } from "./admin-analytics";

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
  const [services, gallery, products, barbers, settings, adminUsers, appointments, profiles, analytics] = await Promise.all([
    supabase.from("services").select("*").order("created_at"),
    supabase.from("gallery_posts").select("*").order("created_at", { ascending: false }),
    supabase.from("products").select("*").order("created_at", { ascending: false }),
    supabase.from("barber_profiles").select("*").order("display_name"),
    supabase.from("business_settings").select("*").eq("id", true).single(),
    isSuperadmin ? supabase.rpc("list_admin_users") : Promise.resolve({ data: [] }),
    supabase.from("appointments").select("id,starts_at,status,service_name_snapshot,price_snapshot,profiles!appointments_client_id_fkey(full_name,email,phone,is_blacklisted),barber_profiles(display_name)").order("starts_at", { ascending: false }).limit(100),
    supabase.from("profiles").select("id,full_name,email,phone,status,no_show_count,is_blacklisted,is_blocked,user_roles(role)").order("created_at", { ascending: false }).limit(100),
    supabase.rpc("admin_business_analytics"),
  ]);

  return (
    <AdminDashboard
      userEmail={user.email ?? "Administrador"}
      initialServices={services.data ?? []}
      initialGallery={gallery.data ?? []}
      initialProducts={products.data ?? []}
      barbers={barbers.data ?? []}
      initialSettings={settings.data}
      isSuperadmin={Boolean(isSuperadmin)}
      adminUsers={adminUsers.data ?? []}
      hasBarber={Boolean(capabilities.barber)}
      initialAppointments={appointments.data ?? []}
      clients={(profiles.data ?? []).filter((profile) => !profile.user_roles?.some((role) => role.role === "admin" || role.role === "superadmin"))}
      analyticsData={(analytics.data as AnalyticsData | null) ?? null}
    />
  );
}
