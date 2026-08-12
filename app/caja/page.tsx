import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getUserCapabilities } from "@/lib/user-capabilities";
import { CashierPanel } from "./cashier-panel";
import {PanelExperience} from "@/components/panel-experience";

export const dynamic = "force-dynamic";

export type CashierSection = "servicios" | "productos" | "movimientos" | "liquidaciones" | "gastos" | "historial";

export default function CashierPage() {
  return <CashierPageView section="servicios" />;
}

export async function CashierPageView({ section }: { section: CashierSection }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const capabilities = await getUserCapabilities(user.id);
  if (!capabilities.isCashier) notFound();
  const start = new Date(); start.setHours(0,0,0,0);
  const end = new Date(start); end.setDate(end.getDate() + 1);
  const workDate = new Intl.DateTimeFormat("en-CA", { timeZone: "America/La_Paz" }).format(new Date());
  const [shift,services,barbers,products,clients,appointments,sales,earnings,expenses,payouts] = await Promise.all([
    supabase.from("cash_shifts").select("*").eq("opened_by",user.id).eq("status","open").maybeSingle(),
    supabase.from("services").select("id,name,price").eq("status","active").order("name"),
    supabase.from("barber_profiles").select("id,display_name,commission_percent").eq("active",true).order("display_name"),
    supabase.from("products").select("id,name,price,stock,incentive_percent").eq("status","active").gt("stock",0).order("name"),
    supabase.from("profiles").select("id,full_name,email,phone,referral_code").eq("status","active").order("full_name").limit(300),
    supabase.from("appointments").select("id,service_id,barber_id,status,starts_at,service_name_snapshot,profiles!appointments_client_id_fkey(full_name,email),barber_profiles(display_name),appointment_checkout_details(actual_service_id,extra_service_id,suggested_product_id,product_quantity,notes,submitted_at)").gte("starts_at",start.toISOString()).in("status",["pending_payment"]).order("starts_at"),
    supabase.from("sales").select("id,paid_total,discount_total,business_share,barber_commission_total,guest_name,paid_at,profiles!sales_client_id_fkey(full_name,email),receipts(id,number)").eq("status","paid").order("paid_at",{ascending:false}).limit(20),
    supabase.from("barber_earnings").select("id,barber_id,kind,amount,status,created_at").in("status",["pending","approved"]).gte("created_at",start.toISOString()).lt("created_at",end.toISOString()),
    supabase.from("barber_expenses").select("id,barber_id,concept,amount,status,created_at,barber_profiles(display_name)").in("status",["pending","approved"]).gte("created_at",start.toISOString()).lt("created_at",end.toISOString()).order("created_at",{ascending:false}),
    supabase.from("payouts").select("id,barber_id,period_start,period_end,commission_amount,incentive_amount,reimbursement_amount,total_amount,status,paid_at,barber_profiles(display_name)").eq("period_start",workDate).eq("period_end",workDate).order("created_at",{ascending:false}),
  ]);
  return <PanelExperience><CashierPanel
    userEmail={user.email??"Caja"}
    capabilities={capabilities}
    shift={shift.data}
    services={services.data??[]}
    barbers={barbers.data??[]}
    products={products.data??[]}
    clients={clients.data??[]}
    appointments={appointments.data??[]}
    sales={sales.data??[]}
    earnings={earnings.data??[]}
    expenses={expenses.data??[]}
    payouts={payouts.data??[]}
    movements={shift.data ? (await supabase.from("cash_movements").select("id,kind,amount,payment_method,reason,created_at,sale_id").eq("shift_id",shift.data.id).order("created_at",{ascending:true})).data ?? [] : []}
    workDate={workDate}
    section={section}
  /></PanelExperience>;
}
