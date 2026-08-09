import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getUserCapabilities } from "@/lib/user-capabilities";
import { CashierPanel } from "./cashier-panel";

export const dynamic = "force-dynamic";

export default async function CashierPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const capabilities = await getUserCapabilities(user.id);
  if (!capabilities.isCashier) notFound();
  const start = new Date(); start.setHours(0,0,0,0);
  const [shift,services,barbers,products,clients,appointments,sales] = await Promise.all([
    supabase.from("cash_shifts").select("*").eq("opened_by",user.id).eq("status","open").maybeSingle(),
    supabase.from("services").select("id,name,price").eq("status","active").order("name"),
    supabase.from("barber_profiles").select("id,display_name,commission_percent").eq("active",true).order("display_name"),
    supabase.from("products").select("id,name,price,stock,incentive_percent").eq("status","active").gt("stock",0).order("name"),
    supabase.from("profiles").select("id,full_name,email,phone,referral_code").eq("status","active").order("full_name").limit(300),
    supabase.from("appointments").select("id,starts_at,service_name_snapshot,profiles!appointments_client_id_fkey(full_name,email),barber_profiles(display_name)").gte("starts_at",start.toISOString()).in("status",["requested","confirmed","in_progress"]).order("starts_at"),
    supabase.from("sales").select("id,paid_total,discount_total,business_share,barber_commission_total,guest_name,paid_at,profiles!sales_client_id_fkey(full_name,email),receipts(id,number)").eq("status","paid").order("paid_at",{ascending:false}).limit(20),
  ]);
  return <CashierPanel
    userEmail={user.email??"Caja"}
    capabilities={capabilities}
    shift={shift.data}
    services={services.data??[]}
    barbers={barbers.data??[]}
    products={products.data??[]}
    clients={clients.data??[]}
    appointments={appointments.data??[]}
    sales={sales.data??[]}
  />;
}
