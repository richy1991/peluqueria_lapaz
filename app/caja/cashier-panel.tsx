"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Banknote, CircleDollarSign, LockKeyhole, ReceiptText, WalletCards } from "lucide-react";
import { Brand } from "@/components/brand";
import { ModeSwitcher } from "@/components/mode-switcher";
import { createClient } from "@/lib/supabase/client";

type Row = Record<string,unknown> & { id:string };
type Capabilities = { isAdmin:boolean; isSuperadmin:boolean; isCashier:boolean; barber:{id:string;display_name:string}|null };

export function CashierPanel({userEmail,capabilities,shift,services,barbers,products,clients,appointments,sales}:{userEmail:string;capabilities:Capabilities;shift:Row|null;services:Row[];barbers:Row[];products:Row[];clients:Row[];appointments:Row[];sales:Row[]}){
  const router=useRouter();
  const [busy,setBusy]=useState(false); const [error,setError]=useState(""); const [result,setResult]=useState<Record<string,unknown>|null>(null);
  async function call(name:string,args:Record<string,unknown>){setBusy(true);setError("");const {data,error}=await createClient().rpc(name,args);setBusy(false);if(error){setError(error.message);return null;}return data;}
  async function open(event:FormEvent<HTMLFormElement>){event.preventDefault();const f=new FormData(event.currentTarget);if(await call("open_cash_shift",{opening:Number(f.get("opening")),shift_notes:String(f.get("notes")??"")||null}))router.refresh();}
  async function sell(event:FormEvent<HTMLFormElement>){event.preventDefault();const f=new FormData(event.currentTarget);const data=await call("register_counter_sale",{
    target_appointment_id:String(f.get("appointment_id")??"")||null,target_client_id:String(f.get("client_id")??"")||null,guest_name:String(f.get("guest_name")??"")||null,guest_phone:String(f.get("guest_phone")??"")||null,
    target_barber_id:String(f.get("barber_id")??"")||null,target_service_id:String(f.get("service_id")??"")||null,target_product_id:String(f.get("product_id")??"")||null,product_quantity:Number(f.get("quantity")??1),
    recommended_by_barber_id:String(f.get("recommended_by")??"")||null,manual_discount:Number(f.get("discount")??0),payment_method:String(f.get("payment_method")??"cash"),payment_reference:String(f.get("payment_reference")??"")||null,
    provided_referral_code:String(f.get("referral_code")??"")||null,redemption_code:String(f.get("redemption_code")??"")||null,promotion_code:String(f.get("promotion_code")??"")||null,
  });if(data){setResult(data as Record<string,unknown>);router.refresh();}}
  async function movement(event:FormEvent<HTMLFormElement>){event.preventDefault();const f=new FormData(event.currentTarget);if(await call("record_cash_movement",{movement_kind:String(f.get("kind")),movement_amount:Number(f.get("amount")),payment_method:String(f.get("method")),movement_reason:String(f.get("reason"))}))router.refresh();}
  async function close(event:FormEvent<HTMLFormElement>){event.preventDefault();const f=new FormData(event.currentTarget);const data=await call("close_cash_shift",{counted:Number(f.get("counted")),shift_notes:String(f.get("notes")??"")||null});if(data){setResult(data as Record<string,unknown>);router.refresh();}}
  async function reverseSale(id:string){const reason=window.prompt("Motivo obligatorio de la devolución o anulación:");if(!reason?.trim())return;if(await call("reverse_counter_sale",{target_sale_id:id,reversal_reason:reason.trim()}))router.refresh();}
  return <main className="admin-shell cashier-shell">
    <header className="admin-header"><Brand/><ModeSwitcher current="cashier" isAdmin={capabilities.isAdmin} hasBarber={Boolean(capabilities.barber)} isCashier showClient={!capabilities.isSuperadmin}/><div><span>{userEmail}</span><Link href="/">Sitio público</Link></div></header>
    <section className="cashier-content">
      <div className="admin-title"><WalletCards/><div><p>OPERACIÓN PRESENCIAL</p><h1>Caja</h1></div></div>
      {error&&<p className="admin-error">{error}</p>}{result&&<div className="admin-message"><strong>Operación completada.</strong>{"receipt_id" in result&&<Link href={`/comprobante/${String(result.receipt_id)}`}> Ver comprobante #{String(result.receipt_number)}</Link>}{Boolean(result.claim_code)&&<span> Código del cliente: <b>{String(result.claim_code)}</b></span>}</div>}
      {!shift?<section className="admin-panel cashier-open"><LockKeyhole/><h2>Abrir turno de caja</h2><p>Registra el efectivo inicial antes de realizar ventas.</p><form className="admin-form" onSubmit={open}><label>Monto inicial Bs<input name="opening" type="number" min="0" step="0.5" defaultValue="0" required/></label><label>Observación<input name="notes"/></label><button className="button button-dark wide" disabled={busy}>Abrir caja</button></form></section>:<>
        <div className="cashier-status"><span>Caja abierta desde</span><strong>{new Intl.DateTimeFormat("es-BO",{dateStyle:"medium",timeStyle:"short",timeZone:"America/La_Paz"}).format(new Date(String(shift.opened_at)))}</strong><b>Inicial: Bs {String(shift.opening_amount)}</b></div>
        <div className="cashier-grid">
          <section className="admin-panel cashier-sale"><div className="portal-title"><ReceiptText/><h2>Registrar venta o atención</h2></div><form className="admin-form" onSubmit={sell}>
            <label className="wide">Cita existente opcional<select name="appointment_id" defaultValue=""><option value="">Atención sin reserva</option>{appointments.map(a=><option key={a.id} value={a.id}>{new Intl.DateTimeFormat("es-BO",{timeStyle:"short",timeZone:"America/La_Paz"}).format(new Date(String(a.starts_at)))} · {String(a.service_name_snapshot)} · {String((a.profiles as {full_name?:string}|null)?.full_name??"Cliente")}</option>)}</select></label>
            <label>Cliente registrado<select name="client_id" defaultValue=""><option value="">Cliente invitado</option>{clients.map(c=><option key={c.id} value={c.id}>{String(c.full_name??c.email)}</option>)}</select></label><label>Nombre invitado<input name="guest_name" placeholder="Si no tiene cuenta"/></label><label>Teléfono invitado<input name="guest_phone" inputMode="tel"/></label><label>Código referido<input name="referral_code" placeholder="LC-..."/></label>
            <label>Servicio<select name="service_id" defaultValue=""><option value="">Sin servicio</option>{services.map(s=><option key={s.id} value={s.id}>{String(s.name)} · Bs {String(s.price)}</option>)}</select></label><label>Peluquero<select name="barber_id" defaultValue=""><option value="">Seleccionar</option>{barbers.map(b=><option key={b.id} value={b.id}>{String(b.display_name)} · {String(b.commission_percent)}%</option>)}</select></label>
            <label>Producto opcional<select name="product_id" defaultValue=""><option value="">Sin producto</option>{products.map(p=><option key={p.id} value={p.id}>{String(p.name)} · Bs {String(p.price)} · stock {String(p.stock)}</option>)}</select></label><label>Cantidad<input name="quantity" type="number" min="1" max="20" defaultValue="1"/></label><label>Recomendado por<select name="recommended_by" defaultValue=""><option value="">Sin recomendador</option>{barbers.map(b=><option key={b.id} value={b.id}>{String(b.display_name)}</option>)}</select></label>
            <label>Descuento manual Bs<input name="discount" type="number" min="0" step="0.5" defaultValue="0"/></label><label>Código de promoción<input name="promotion_code" placeholder="PROMO..."/></label><label>Código de canje<input name="redemption_code"/></label><label>Forma de pago<select name="payment_method" defaultValue="cash"><option value="cash">Efectivo</option><option value="qr">QR</option><option value="transfer">Transferencia</option><option value="card">Tarjeta</option><option value="other">Otro</option></select></label><label>Referencia de pago<input name="payment_reference"/></label>
            <button className="button button-dark wide" disabled={busy}><CircleDollarSign/> Confirmar pago y emitir comprobante</button>
          </form></section>
          <aside className="cashier-side">
            <section className="admin-panel"><div className="portal-title"><Banknote/><h2>Movimiento</h2></div><form className="admin-form" onSubmit={movement}><label>Tipo<select name="kind"><option value="income">Ingreso</option><option value="expense">Egreso</option><option value="adjustment">Ajuste</option></select></label><label>Monto Bs<input name="amount" type="number" min="0.5" step="0.5" required/></label><label>Método<select name="method"><option value="cash">Efectivo</option><option value="qr">QR</option><option value="transfer">Transferencia</option></select></label><label>Motivo<input name="reason" required/></label><button className="button button-dark wide" disabled={busy}>Registrar</button></form></section>
            <section className="admin-panel"><h2>Cerrar caja</h2><form className="admin-form" onSubmit={close}><label className="wide">Efectivo contado Bs<input name="counted" type="number" min="0" step="0.5" required/></label><label className="wide">Observación<input name="notes"/></label><button className="button button-dark wide" disabled={busy}>Cerrar y conciliar</button></form></section>
          </aside>
        </div>
        <section className="admin-panel"><h2>Últimas ventas</h2><div className="admin-list">{sales.length?sales.map(s=>{const receipt=Array.isArray(s.receipts)?s.receipts[0]:s.receipts as {id?:string;number?:number}|null;return <article key={s.id}><div><strong>{String((s.profiles as {full_name?:string}|null)?.full_name??s.guest_name??"Cliente")}</strong><span>Bs {String(s.paid_total)} · descuento Bs {String(s.discount_total)} · comisión Bs {String(s.barber_commission_total)}</span></div>{receipt?.id&&<Link href={`/comprobante/${receipt.id}`}>#{String(receipt.number)}</Link>}<button disabled={busy} onClick={()=>reverseSale(String(s.id))}>Revertir</button></article>;}):<p className="admin-help">Todavía no hay ventas en caja.</p>}</div></section>
      </>}
    </section>
  </main>;
}
