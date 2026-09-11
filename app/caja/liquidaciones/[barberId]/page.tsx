import { notFound, redirect } from "next/navigation";
import { PanelExperience } from "@/components/panel-experience";
import { createClient } from "@/lib/supabase/server";
import { getUserCapabilities } from "@/lib/user-capabilities";
import { CashierSettlementDetail } from "./settlement-detail";
import { DEFAULT_BUSINESS_TIMEZONE } from "@/lib/business-hours";
import { businessDateKey } from "@/lib/business-time";

export const dynamic = "force-dynamic";

export default async function SettlementPage({ params }: { params: Promise<{ barberId: string }> }) {
  const { barberId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const capabilities = await getUserCapabilities(user.id);
  if (!capabilities.isCashier) notFound();

  const { data: businessSettings } = await supabase.from("business_settings").select("timezone").eq("id", true).maybeSingle();
  const businessTimezone = String(businessSettings?.timezone ?? DEFAULT_BUSINESS_TIMEZONE);
  const workDate = businessDateKey(new Date(), businessTimezone);
  const [barberResult, shiftResult, detailResult, historyResult] = await Promise.all([
    supabase.from("barber_profiles").select("id,display_name").eq("id", barberId).eq("active", true).maybeSingle(),
    supabase.from("cash_shifts").select("id").eq("opened_by", user.id).eq("status", "open").maybeSingle(),
    supabase.rpc("cashier_get_barber_settlement_detail", { target_barber: barberId, work_date: workDate }),
    supabase.from("payouts").select("id,period_start,commission_amount,incentive_amount,deduction_amount,total_amount,status,paid_at,includes_accumulated_incentives").eq("barber_id", barberId).order("created_at", { ascending: false }).limit(12),
  ]);

  if (!barberResult.data) notFound();
  if (detailResult.error) throw new Error(`No se pudo cargar la liquidación: ${detailResult.error.message}`);

  return <PanelExperience chatInHeader><CashierSettlementDetail
    userEmail={user.email ?? "Caja"}
    capabilities={capabilities}
    shiftOpen={Boolean(shiftResult.data)}
    detail={detailResult.data as unknown as SettlementDetail}
    history={(historyResult.data ?? []) as SettlementHistory[]}
    timezone={businessTimezone}
  /></PanelExperience>;
}

export type SettlementLine = {
  id: string;
  name: string;
  base_amount: number;
  rate_percent: number;
  amount: number;
  created_at: string;
};

export type SettlementExpense = {
  id: string;
  concept: string;
  amount: number;
  status: "pending" | "approved" | "rejected" | "deducted" | "reimbursed";
  notes: string | null;
  created_at: string;
};

export type SettlementPayout = {
  id: string;
  status: "approved" | "paid" | "canceled";
  commission_amount: number;
  incentive_amount: number;
  deduction_amount: number;
  reimbursement_amount: number;
  total_amount: number;
  includes_accumulated_incentives: boolean;
  paid_at: string | null;
};

export type SettlementDetail = {
  barber: { id: string; name: string };
  work_date: string;
  payout: SettlementPayout | null;
  services: SettlementLine[];
  incentives: SettlementLine[];
  expenses: SettlementExpense[];
  commission_total: number;
  incentive_total: number;
  deduction_total: number;
  daily_total: number;
  total_with_incentives: number;
  remaining_incentive_total: number;
};

export type SettlementHistory = {
  id: string;
  period_start: string;
  commission_amount: number;
  incentive_amount: number;
  deduction_amount: number;
  total_amount: number;
  status: string;
  paid_at: string | null;
  includes_accumulated_incentives: boolean;
};
