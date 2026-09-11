import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ReceiptView } from "./receipt-view";

export const dynamic="force-dynamic";

export default async function ReceiptPage({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<{print?:string}>}){
  const {id}=await params;
  const query=await searchParams;
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user)redirect(`/login?next=/comprobante/${id}`);
  const [receipt,business]=await Promise.all([
    supabase.from("receipts").select("id,number,verification_code,issued_at,sales(id,guest_name,guest_phone,claim_code,list_total,discount_total,paid_total,barber_commission_total,business_share,profiles!sales_client_id_fkey(full_name,email),sale_items(item_type,name_snapshot,attendee_label,quantity,unit_price_snapshot,discount_amount,commission_amount,barber_profiles!sale_items_barber_id_fkey(display_name)),payments(method,reference))").eq("id",id).single(),
    supabase.from("business_settings").select("business_name,address,phone,timezone").eq("id",true).single(),
  ]);
  if(!receipt.data)notFound();
  return <ReceiptView receipt={receipt.data as unknown as Record<string,unknown>} business={business.data as Record<string,unknown>|null} autoPrint={query.print==="1"}/>;
}
