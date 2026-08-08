import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AdminDashboard } from "./admin-dashboard";

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

  const { data: isSuperadmin } = await supabase.rpc("is_superadmin");
  const [services, gallery, products, barbers, settings, adminUsers] = await Promise.all([
    supabase.from("services").select("*").order("created_at"),
    supabase.from("gallery_posts").select("*").order("created_at", { ascending: false }),
    supabase.from("products").select("*").order("created_at", { ascending: false }),
    supabase.from("barber_profiles").select("*").order("display_name"),
    supabase.from("business_settings").select("*").eq("id", true).single(),
    isSuperadmin ? supabase.rpc("list_admin_users") : Promise.resolve({ data: [] }),
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
    />
  );
}
