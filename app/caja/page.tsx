import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getUserCapabilities } from "@/lib/user-capabilities";
import { CashierPanel } from "./cashier-panel";
import type { CashierNavigationSection } from "./cashier-navigation";
import {PanelExperience} from "@/components/panel-experience";
import { DEFAULT_BUSINESS_TIMEZONE } from "@/lib/business-hours";
import { businessDayRange } from "@/lib/business-time";

export const dynamic = "force-dynamic";

export type CashierSection = CashierNavigationSection;

export default function CashierPage() {
  return <CashierPageView section="servicios" />;
}

export async function CashierPageView({ section }: { section: CashierSection }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const capabilities = await getUserCapabilities(user.id);
  if (!capabilities.isCashier) notFound();
  const [businessSettingsResult, operatorProfileResult] = await Promise.all([
    supabase.from("business_settings").select("timezone").eq("id", true).maybeSingle(),
    supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle(),
  ]);
  const businessSettings = businessSettingsResult.data;
  const businessTimezone = String(businessSettings?.timezone ?? DEFAULT_BUSINESS_TIMEZONE);
  const { date: workDate, start, end } = businessDayRange(new Date(), businessTimezone);
  const historyStart = new Date(end); historyStart.setUTCDate(historyStart.getUTCDate() - 31);
  const visitHistoryStart = new Date(end); visitHistoryStart.setUTCDate(visitHistoryStart.getUTCDate() - 180);
  const requestTimestamp = new Date().getTime();
  const [shift,services,barbers,products,clients,appointments,sales,earnings,expenses,payouts,productReservations,todayServiceEntries] = await Promise.all([
    supabase.from("cash_shifts").select("*").eq("opened_by",user.id).eq("status","open").maybeSingle(),
    section === "servicios" ? supabase.from("services").select("id,name,price").eq("status","active").order("name") : Promise.resolve({ data: [] }),
    ["servicios", "productos", "reservas", "liquidaciones"].includes(section) ? supabase.from("barber_profiles").select("id,display_name,photo_path,bio,specialties,commission_percent").eq("active",true).order("display_name") : Promise.resolve({ data: [] }),
    ["servicios", "productos"].includes(section) ? supabase.from("products").select("id,name,price,stock,incentive_percent,category,brand,presentation,image_path,image_paths").eq("status","active").gt("stock",0).order("name") : Promise.resolve({ data: [] }),
    ["servicios", "productos"].includes(section) ? supabase.from("profiles").select("id,full_name,email,phone,referral_code").eq("status","active").order("full_name").limit(300) : Promise.resolve({ data: [] }),
    section === "servicios" ? supabase.from("appointments").select("id,client_id,service_id,barber_id,status,starts_at,service_name_snapshot,profiles!appointments_client_id_fkey(full_name,email,referral_code),barber_profiles!appointments_barber_id_fkey(display_name),appointment_checkout_details(actual_service_id,extra_service_id,suggested_product_id,product_quantity,notes,submitted_at),appointment_service_items(service_id,position,name_snapshot,price_snapshot,duration_snapshot)").gte("starts_at",start.toISOString()).in("status",["pending_payment"]).order("starts_at") : Promise.resolve({ data: [] }),
    ["servicios", "historial"].includes(section) ? supabase.from("sales").select("id,status,paid_total,list_total,discount_total,business_share,barber_commission_total,guest_name,paid_at,updated_at,reversal_reason,reversed_at,profiles!sales_client_id_fkey(full_name,email),receipts(id,number),payments(method,amount),sale_items(item_type,name_snapshot,quantity,unit_price_snapshot,barber_name_snapshot)").in("status",["paid","refunded"]).gte("paid_at",historyStart.toISOString()).order("paid_at",{ascending:false}).limit(500) : Promise.resolve({ data: [] }),
    section === "liquidaciones" ? supabase.from("barber_earnings").select("id,barber_id,kind,amount,status,created_at").eq("status","pending").lt("created_at",end.toISOString()) : Promise.resolve({ data: [] }),
    section === "liquidaciones" ? supabase.from("barber_expenses").select("id,barber_id,concept,amount,status,created_at,barber_profiles(display_name)").in("status",["pending","approved"]).lt("created_at",end.toISOString()).order("created_at",{ascending:false}) : Promise.resolve({ data: [] }),
    section === "liquidaciones" ? supabase.from("payouts").select("id,barber_id,barber_name_snapshot,period_start,period_end,commission_amount,incentive_amount,reimbursement_amount,deduction_amount,includes_accumulated_incentives,total_amount,status,paid_at,barber_profiles(display_name)").or(`status.eq.approved,and(status.eq.paid,paid_at.gte.${start.toISOString()},paid_at.lt.${end.toISOString()})`).order("created_at",{ascending:false}) : Promise.resolve({ data: [] }),
    supabase.from("product_reservations").select("id,client_id,product_id,quantity,price_snapshot,status,expires_at,created_at,profiles!product_reservations_client_id_fkey(full_name,email,phone,referral_code),products(name,brand,presentation,stock)").eq("status","reserved").order("created_at",{ascending:true}),
    section === "liquidaciones" ? supabase.from("sales").select("sale_items(id,item_type,barber_id)").eq("status","paid").gte("paid_at",start.toISOString()).lt("paid_at",end.toISOString()) : Promise.resolve({ data: [] }),
  ]);
  const servicesToday: Record<string, number> = {};
  const todaySales = (todayServiceEntries.data ?? []) as Array<{ sale_items?: Array<{ item_type?: string; barber_id?: string | null }> | null }>;
  for (const sale of todaySales) {
    for (const item of sale.sale_items ?? []) {
      if (item.item_type !== "service" || !item.barber_id) continue;
      servicesToday[item.barber_id] = (servicesToday[item.barber_id] ?? 0) + 1;
    }
  }
  const visitHistory = ["servicios", "productos", "reservas"].includes(section)
    ? (await supabase.from("appointments").select("id,client_id,starts_at,status,service_name_snapshot,barber_name_snapshot").gte("starts_at", visitHistoryStart.toISOString()).lt("starts_at", end.toISOString()).in("status", ["completed", "pending_payment"]).order("starts_at", { ascending: false }).limit(1000)).data ?? []
    : [];
  return <PanelExperience chatInHeader><CashierPanel
    userName={String(operatorProfileResult.data?.full_name ?? user.email?.split("@")[0] ?? "Caja")}
    userEmail={user.email??"Caja"}
    capabilities={capabilities}
    shift={shift.data}
    services={services.data??[]}
    barbers={barbers.data??[]}
    products={products.data??[]}
    clients={clients.data??[]}
    appointments={appointments.data??[]}
    visitHistory={visitHistory}
    sales={sales.data??[]}
    earnings={earnings.data??[]}
    servicesToday={servicesToday}
    expenses={expenses.data??[]}
    payouts={payouts.data??[]}
    productReservations={(productReservations.data??[]).map(item => ({ ...item, is_expired: new Date(item.expires_at).getTime() <= requestTimestamp }))}
    movements={shift.data && section === "movimientos" ? (await supabase.from("cash_movements").select("id,kind,amount,payment_method,reason,created_at,sale_id").eq("shift_id",shift.data.id).order("created_at",{ascending:true})).data ?? [] : []}
    workDate={workDate}
    businessTimezone={businessTimezone}
    section={section}
  /></PanelExperience>;
}
