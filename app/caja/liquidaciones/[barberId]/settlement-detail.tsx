"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Banknote, Calculator, CheckCircle2, History, PackageOpen, Scissors } from "lucide-react";
import { CashierWorkflowWindow } from "../../cashier-workflow-window";
import { clearFormErrors, dispatchDashboardError, dispatchDashboardSuccess, reportFormError } from "@/lib/form-feedback";
import { createClient } from "@/lib/supabase/client";
import { zonedDateTimeToDate } from "@/lib/business-time";
import { CashierDesktopNavigation } from "../../cashier-navigation";
import { CashierHeader } from "../../cashier-header";
import type { SettlementDetail, SettlementHistory, SettlementLine } from "./page";
import { PaymentSplits, type PaymentLine } from "../../cashier-product-sale-form";

type Capabilities = { isAdmin: boolean; isSuperadmin: boolean; isCashier: boolean; barber: { id: string; display_name: string } | null };
type Props = { userName: string; userEmail: string; capabilities: Capabilities; shiftOpen: boolean; detail: SettlementDetail; history: SettlementHistory[]; timezone: string };

const money = (value: number) => `Bs ${Number(value).toFixed(2)}`;
const date = (value: string | Date, timezone: string) => new Intl.DateTimeFormat("es-BO", { dateStyle: "medium", timeZone: timezone }).format(new Date(value));

export function CashierSettlementDetail({ userName, userEmail, capabilities, shiftOpen, detail, history, timezone }: Props) {
  const router = useRouter();
  const [includeIncentives, setIncludeIncentives] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [payments, setPayments] = useState<PaymentLine[]>([{ id: "payout-payment-1", method: "cash", amount: "0.00" }]);
  const [paymentValid, setPaymentValid] = useState(false);
  const projectedTotal = useMemo(() => Math.max(Number(detail.commission_total) + (includeIncentives ? Number(detail.incentive_total) : 0), 0), [detail, includeIncentives]);
  const payoutTotal = Number(detail.payout?.total_amount ?? 0);
  useEffect(() => { if (payments.length === 1) setPayments(current => current.length === 1 ? [{ ...current[0], amount: payoutTotal.toFixed(2) }] : current); }, [payments.length, payoutTotal]);
  const legacyPayout = Boolean(detail.payout && Number(detail.payout.reimbursement_amount) > 0 && Number(detail.payout.deduction_amount) === 0);

  async function rpc(name: string, args: Record<string, unknown>, form?: HTMLFormElement) {
    if (form) clearFormErrors(form);
    window.dispatchEvent(new Event("cashier:workflow-start"));
    setBusy(true); setError("");
    const { data, error: rpcError } = await createClient().rpc(name, args);
    setBusy(false);
    if (rpcError) {
      const message = reportFormError(form, rpcError);
      window.dispatchEvent(new CustomEvent("cashier:workflow-error", { detail: message }));
      setError(message); dispatchDashboardError(message); return null;
    }
    window.dispatchEvent(new Event("cashier:workflow-complete"));
    return data ?? true;
  }

  async function prepare(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    if (await rpc("create_daily_barber_payout_v2", { target_barber: detail.barber.id, work_date: detail.work_date, include_accumulated_incentives: includeIncentives }, form)) {
      dispatchDashboardSuccess("Liquidación preparada y conceptos bloqueados contra duplicados.");
      router.refresh();
    }
  }

  async function pay(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!detail.payout) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    const methods = data.getAll("payment_method").map(String);
    const amounts = data.getAll("payment_amount").map(Number);
    if (await rpc("pay_daily_barber_payout_mixed", { target_payout: detail.payout.id, payment_splits: methods.map((method, index) => ({ method, amount: amounts[index] })) }, form)) {
      dispatchDashboardSuccess("Pago registrado y egreso añadido al libro diario.");
      router.refresh();
    }
  }

  return <main className="admin-shell dash-workspace cashier-shell">
    <CashierHeader userName={userName} userEmail={userEmail} capabilities={capabilities} shiftOpen={shiftOpen} />
    <div className="admin-layout cashier-layout"><section className="cashier-content settlement-detail-content"><div className="cashier-toolbar"><CashierDesktopNavigation section="liquidaciones" /></div>
        <Link className="settlement-back" href="/caja/liquidaciones"><ArrowLeft /> Todas las liquidaciones</Link>
        <div className="dash-page-heading"><div className="admin-title"><Calculator /><div><p>CIERRE DEL TURNO · {detail.work_date}</p><h1>{detail.barber.name}</h1></div></div><span className={`dash-status-pill ${shiftOpen ? "online" : "offline"}`}><i />{shiftOpen ? "Turno abierto" : "Turno cerrado"}</span></div>
        {error && <p className="admin-error">{error}</p>}
        <section className="settlement-metrics" aria-label="Resumen de liquidación">
          <article><span>Servicios pendientes</span><strong>{money(detail.commission_total)}</strong></article>
          <article><span>{detail.payout ? "Incentivo incluido" : "Incentivo acumulado"}</span><strong>{money(detail.payout ? detail.payout.incentive_amount : detail.incentive_total)}</strong>{Boolean(detail.payout && detail.remaining_incentive_total > 0) && <small>{money(detail.remaining_incentive_total)} sigue acumulado</small>}</article>
          <article className="net"><span>{detail.payout ? "Total liquidación" : "Pago diario"}</span><strong>{money(detail.payout?.total_amount ?? projectedTotal)}</strong></article>
        </section>

        {legacyPayout && <p className="settlement-warning">Esta liquidación pertenece a una regla anterior y conserva un ajuste histórico de {money(detail.payout?.reimbursement_amount ?? 0)}.</p>}

        <div className="settlement-columns">
          <ConceptPanel icon={<Scissors />} title="Servicios por liquidar" hint={`${detail.services.length} atención(es)`} items={detail.services} empty="No hay comisiones de servicios pendientes." timezone={timezone} />
          <ConceptPanel icon={<PackageOpen />} title="Incentivos de ventas" hint="Acumulado mensual" items={detail.incentives} empty={detail.payout && detail.remaining_incentive_total > 0 ? `Quedan ${money(detail.remaining_incentive_total)} acumulados para una próxima liquidación.` : "No hay incentivos de productos pendientes."} timezone={timezone} />
        </div>

        <section className="admin-panel settlement-action-panel"><div className="dash-list-head"><div><small>CONFIRMACIÓN DE CAJA</small><h2>{detail.payout ? "Liquidación preparada" : "Preparar pago"}</h2></div><Banknote /></div>
          {!detail.payout ? <CashierWorkflowWindow title={`Preparar liquidación de ${detail.barber.name}`} description="Confirma los conceptos y el importe antes de bloquear el pago del turno." triggerLabel="Preparar liquidación" triggerIcon={<Calculator />}><form className="settlement-prepare-form" onSubmit={prepare}>
            {detail.incentive_total > 0 && <label className="settlement-incentive-check"><input type="checkbox" checked={includeIncentives} onChange={event => setIncludeIncentives(event.target.checked)} /><span><strong>Agregar incentivo de ventas acumulado</strong><small>Opcional · normalmente se paga una vez al mes</small></span><b>+ {money(detail.incentive_total)}</b></label>}
            <div className="settlement-net-preview"><span>Servicios {money(detail.commission_total)}</span>{includeIncentives && <span>Incentivo +{money(detail.incentive_total)}</span>}<strong>Neto {money(projectedTotal)}</strong></div>
            {!shiftOpen && <p className="settlement-warning">Abre un turno de caja para preparar y pagar.</p>}
            <button className="button button-dark" disabled={busy || !shiftOpen || projectedTotal <= 0}>Preparar liquidación</button>
          </form></CashierWorkflowWindow> : <div className="settlement-payment-summary"><div><span>Servicios</span><b>{money(detail.payout.commission_amount)}</b></div>{detail.payout.includes_accumulated_incentives && <div><span>Incentivo acumulado</span><b>+ {money(detail.payout.incentive_amount)}</b></div>}<div className="total"><span>Total neto</span><strong>{money(detail.payout.total_amount)}</strong></div>{detail.payout.status === "approved" ? <CashierWorkflowWindow title="Confirmar pago de liquidación" description={`Se registrará un egreso por ${money(detail.payout.total_amount)}. Puedes pagarlo en efectivo, QR o dividirlo entre ambos.`} triggerLabel="Registrar pago" triggerIcon={<CheckCircle2 />} size="large"><form className="admin-form" onSubmit={pay}><PaymentSplits total={payoutTotal} onValidityChange={setPaymentValid} payments={payments} setPayments={setPayments} /><button className="button button-dark wide" disabled={busy || !paymentValid}>Confirmar pago y egreso · {money(payoutTotal)}</button></form></CashierWorkflowWindow> : <span className="cashier-paid-mark"><CheckCircle2 /> Pagada {detail.payout.paid_at ? date(detail.payout.paid_at, timezone) : ""}</span>}</div>}
        </section>

        <section className="admin-panel settlement-history"><div className="dash-list-head"><div><small>TRAZABILIDAD</small><h2>Historial reciente</h2></div><History /></div><div className="settlement-concept-list">{history.length ? history.map(item => <article key={item.id}><div><strong>{date(zonedDateTimeToDate(`${item.period_start}T12:00:00`, timezone), timezone)}</strong><span>Servicios {money(item.commission_amount)} · incentivo {money(item.incentive_amount)}</span></div><div className="settlement-row-amount"><b>{money(item.total_amount)}</b><small>{item.status === "paid" ? "Pagada" : "Preparada"}</small></div></article>) : <p className="admin-help">Todavía no existen liquidaciones.</p>}</div></section>
      </section>
    </div>
  </main>;
}

function ConceptPanel({ icon, title, hint, items, empty, timezone }: { icon: React.ReactNode; title: string; hint: string; items: SettlementLine[]; empty: string; timezone: string }) {
  return <section className="admin-panel settlement-concept-panel"><div className="dash-list-head"><div><small>{hint}</small><h2>{title}</h2></div>{icon}</div><div className="settlement-concept-list">{items.length ? items.map(item => <article key={item.id}><div><strong>{item.name}</strong><span>Base {money(item.base_amount)} · {Number(item.rate_percent).toFixed(2)}% · {date(item.created_at, timezone)}</span></div><b>{money(item.amount)}</b></article>) : <p className="admin-help">{empty}</p>}</div></section>;
}
