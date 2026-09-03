"use client";

import Link from "next/link";
import QRCode from "react-qr-code";
import { Brand } from "@/components/brand";

type Row=Record<string,unknown>;

export function ReceiptView({receipt,business}:{receipt:Row;business:Row|null}){
  const sale=receipt.sales as Row;
  const client=sale.profiles as Row|null;
  const items=(sale.sale_items??[]) as Row[];
  const payment=Array.isArray(sale.payments)?sale.payments[0] as Row:sale.payments as Row|null;
  const productOnly=items.length>0&&items.every(item=>item.item_type==="product");
  const origin=process.env.NEXT_PUBLIC_SITE_URL??"https://peluqueria-lapaz.vercel.app";
  const url=Boolean(sale.claim_code)?`${origin}/vincular/${String(sale.claim_code)}`:`${origin}/comprobante/${String(receipt.id)}`;
  return <main className="receipt-shell"><section className="receipt-paper">
    <header><Brand/><p>COMPROBANTE INTERNO</p><h1>N.º {String(receipt.number).padStart(6,"0")}</h1></header>
    <div className="receipt-meta"><span>{new Intl.DateTimeFormat("es-BO",{dateStyle:"long",timeStyle:"short",timeZone:"America/La_Paz"}).format(new Date(String(receipt.issued_at)))}</span><span>{String(business?.address??"")}</span><span>{String(business?.phone??"")}</span></div>
    <div className="receipt-customer"><small>CLIENTE</small><strong>{String(client?.full_name??client?.email??sale.guest_name??"Consumidor final")}</strong>{Boolean(sale.guest_phone)&&<span>{String(sale.guest_phone)}</span>}</div>
    <div className="receipt-items">{items.map((item,index)=>{const lineTotal=Number(item.quantity)*Number(item.unit_price_snapshot);const lineDiscount=Number(item.discount_amount??0);return <article key={index}><div><strong>{String(item.name_snapshot)}</strong><span>{Boolean(item.attendee_label) && `${String(item.attendee_label)} · `}{String(item.quantity)} × Bs {Number(item.unit_price_snapshot).toFixed(2)}{(item.barber_profiles as Row|null)?.display_name?` · ${(item.barber_profiles as Row).display_name}`:""}{lineDiscount>0?` · descuento Bs ${lineDiscount.toFixed(2)}`:""}</span></div><b>Bs {(lineTotal-lineDiscount).toFixed(2)}</b></article>})}</div>
    <dl className="receipt-totals"><div><dt>Subtotal</dt><dd>Bs {Number(sale.list_total).toFixed(2)}</dd></div><div><dt>Descuento</dt><dd>- Bs {Number(sale.discount_total).toFixed(2)}</dd></div><div className="total"><dt>TOTAL PAGADO</dt><dd>Bs {Number(sale.paid_total).toFixed(2)}</dd></div><div><dt>Forma de pago</dt><dd>{String(payment?.method??"")}</dd></div></dl>
    {Boolean(sale.claim_code)&&<aside className="receipt-claim"><strong>Activa tus puntos en la app</strong><p>Escanea el QR, abre o instala la aplicación, inicia sesión y vincula estas atenciones:</p><b>{String(sale.claim_code)}</b></aside>}
    <div className="receipt-verify">{!productOnly&&<QRCode value={url} size={112}/>}<div><small>VERIFICACIÓN</small><strong>{String(receipt.verification_code)}</strong><span>{productOnly?"Comprobante de pago sin beneficios de fidelidad.":"Este documento registra una operación interna de LEGEND CLUB."}</span></div></div>
    <footer><strong>COMPROBANTE INTERNO — NO VÁLIDO COMO CRÉDITO FISCAL</strong><p>Gracias por confiar en LEGEND CLUB.</p></footer>
    <div className="receipt-actions"><button onClick={()=>window.print()}>Imprimir / guardar PDF</button><Link href="/panel">Volver al panel</Link></div>
  </section></main>;
}
