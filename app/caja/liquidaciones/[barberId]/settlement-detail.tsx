"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Banknote, Calculator, CheckCircle2, ChevronDown, History, PackageOpen, Scissors } from "lucide-react";
import { CashierWorkflowWindow } from "../../cashier-workflow-window";
import { clearFormErrors, dispatchDashboardError, dispatchDashboardSuccess, reportFormError } from "@/lib/form-feedback";
import { createClient } from "@/lib/supabase/client";
import { CashierDesktopNavigation } from "../../cashier-navigation";
import { CashierHeader } from "../../cashier-header";
import type { SettlementDetail, SettlementHistory, SettlementLine } from "./page";
import { PaymentSplits, type PaymentLine } from "../../cashier-product-sale-form";

type Capabilities = { isAdmin: boolean; isSuperadmin: boolean; isCashier: boolean; barber: { id: string; display_name: string } | null };
type Props = { userName: string; userEmail: string; capabilities: Capabilities; shiftOpen: boolean; detail: SettlementDetail; history: SettlementHistory[]; timezone: string };

const money = (value: number) => `Bs ${Number(value).toFixed(2)}`;
const date = (value: string | Date, timezone: string) => new Intl.DateTimeFormat("es-BO", { dateStyle: "medium", timeZone: timezone }).format(new Date(value));
const monthName = (key: string) => new Intl.DateTimeFormat("es-BO", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${key}-01T12:00:00Z`));

export function CashierSettlementDetail({ userName, userEmail, capabilities, shiftOpen, detail, history, timezone }: Props) {
  const router = useRouter();
  const [includeIncentives, setIncludeIncentives] = useState(false);
  const [serviceAmount, setServiceAmount] = useState(Number(detail.commission_total).toFixed(2));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [historyMonth, setHistoryMonth] = useState("all");
  const [payments, setPayments] = useState<PaymentLine[]>([{ id: "settlement-payment-1", method: "cash", amount: "0.00" }]);
  const [paymentValid, setPaymentValid] = useState(false);

  const serviceBalance = Math.max(Number(detail.commission_total) || 0, 0);
  const incentiveBalance = Math.max(Number(detail.incentive_total) || 0, 0);
  const serviceAmountValue = Number(serviceAmount);
  const validServiceAmount = Number.isFinite(serviceAmountValue) && serviceAmountValue >= 0 && serviceAmountValue <= serviceBalance;
  const payoutTotal = (validServiceAmount ? serviceAmountValue : 0) + (includeIncentives ? incentiveBalance : 0);
  const totalBalance = serviceBalance + incentiveBalance;
  const months = useMemo(() => [...new Set(history.map(item => item.period_start.slice(0, 7)))].sort((a, b) => b.localeCompare(a)), [history]);
  const visibleHistory = useMemo(() => historyMonth === "all" ? history : history.filter(item => item.period_start.startsWith(historyMonth)), [history, historyMonth]);

  useEffect(() => {
    setServiceAmount(Math.max(Number(detail.commission_total) || 0, 0).toFixed(2));
    setIncludeIncentives(false);
  }, [detail.commission_total, detail.incentive_total]);

  useEffect(() => {
    setPayments(current => {
      if (!current.length) return current;
      const rest = current.slice(1).reduce((sum, line) => sum + (Number(line.amount) || 0), 0);
      const firstAmount = Math.max(0, payoutTotal - rest).toFixed(2);
      return current[0].amount === firstAmount ? current : [{ ...current[0], amount: firstAmount }, ...current.slice(1)];
    });
  }, [payoutTotal]);

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

  async function pay(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!validServiceAmount || payoutTotal <= 0 || !shiftOpen) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    const methods = data.getAll("payment_method").map(String);
    const amounts = data.getAll("payment_amount").map(Number);
    const result = await rpc("cashier_pay_barber_settlement_mixed", {
      target_barber: detail.barber.id,
      work_date: detail.work_date,
      service_amount: serviceAmountValue,
      include_accumulated_incentives: includeIncentives,
      payment_splits: methods.map((method, index) => ({ method, amount: amounts[index] })),
    }, form);
    if (result) {
      dispatchDashboardSuccess("Pago registrado. Los saldos pendientes se actualizaron.");
      router.refresh();
    }
  }

  return <main className="admin-shell dash-workspace cashier-shell">
    <CashierHeader userName={userName} userEmail={userEmail} capabilities={capabilities} shiftOpen={shiftOpen} />
    <div className="admin-layout cashier-layout"><section className="cashier-content settlement-detail-content">
      <div className="cashier-toolbar"><CashierDesktopNavigation section="liquidaciones" /></div>
      <Link className="settlement-back" href="/caja/liquidaciones"><ArrowLeft /> Todas las liquidaciones</Link>
      <div className="dash-page-heading"><div className="admin-title"><Calculator /><div><p>SALDO DEL PELUQUERO · {detail.work_date}</p><h1>{detail.barber.name}</h1></div></div><span className={`dash-status-pill ${shiftOpen ? "online" : "offline"}`}><i />{shiftOpen ? "Turno abierto" : "Turno cerrado"}</span></div>
      {error && <p className="admin-error">{error}</p>}

      <section className="settlement-metrics" aria-label="Saldos acumulados">
        <article><span>Servicios</span><strong>{money(serviceBalance)}</strong><small>Comisiones pendientes</small></article>
        <article><span>Incentivos</span><strong>{money(incentiveBalance)}</strong><small>Ventas acumuladas</small></article>
        <article className="net"><span>Total acumulado</span><strong>{money(totalBalance)}</strong><small>Saldo pendiente de pago</small></article>
      </section>

      <section className="settlement-accordions" aria-label="Detalle de saldos">
        <ConceptAccordion icon={<Scissors />} title="Servicios por liquidar" hint={`${detail.services.length} servicio(s) pendiente(s)`} total={serviceBalance} items={detail.services} empty="No hay comisiones de servicios pendientes." timezone={timezone} />
        <ConceptAccordion icon={<PackageOpen />} title="Incentivos por ventas" hint={`${detail.incentives.length} producto(s) acumulado(s)`} total={incentiveBalance} items={detail.incentives} empty="No hay incentivos de productos pendientes." timezone={timezone} />
      </section>

      <section className="settlement-actions" aria-label="Acciones de liquidación">
        <CashierWorkflowWindow title={`Pagar a ${detail.barber.name}`} description="Elige un anticipo o paga todo el saldo de servicios. Los incentivos se agregan completos si los marcas." triggerLabel="Pagar liquidación" triggerContent={<><div><Banknote /><span>PAGO DIRECTO</span><strong>Pagar liquidación</strong><small>Anticipo o saldo completo · incentivos opcionales</small></div><ArrowRight /></>} triggerClassName="settlement-action-card settlement-pay-card" variant="secondary" size="default">
          <form className="admin-form settlement-pay-form" onSubmit={pay}>
            <div className="settlement-pay-balances"><div><span>Servicios disponibles</span><strong>{money(serviceBalance)}</strong></div><div><span>Incentivos disponibles</span><strong>{money(incentiveBalance)}</strong></div></div>
            <label className="settlement-service-amount">Monto a pagar por servicios
              <input name="service_amount" type="number" inputMode="decimal" min="0" max={serviceBalance.toFixed(2)} step="0.01" value={serviceAmount} onChange={event => setServiceAmount(event.target.value)} aria-describedby="settlement-service-hint" />
              <small id="settlement-service-hint">Puedes pagar un anticipo o el total de {money(serviceBalance)}.</small>
            </label>
            {incentiveBalance > 0 && <label className="settlement-incentive-check"><input type="checkbox" checked={includeIncentives} onChange={event => setIncludeIncentives(event.target.checked)} /><span><strong>Incluir todos los incentivos</strong><small>Opcional · normalmente se liquidan al cierre del mes</small></span><b>+ {money(incentiveBalance)}</b></label>}
            <div className="settlement-net-preview"><span>Servicios {money(validServiceAmount ? serviceAmountValue : 0)}</span>{includeIncentives && <span>Incentivos +{money(incentiveBalance)}</span>}<strong>Total a pagar {money(payoutTotal)}</strong></div>
            {!shiftOpen && <p className="settlement-warning">Abre un turno de caja para registrar el pago.</p>}
            <PaymentSplits total={payoutTotal} onValidityChange={setPaymentValid} payments={payments} setPayments={setPayments} />
            <button className="button button-dark wide" disabled={busy || !shiftOpen || !validServiceAmount || payoutTotal <= 0 || !paymentValid}><CheckCircle2 />{busy ? "Registrando pago…" : `Confirmar pago · ${money(payoutTotal)}`}</button>
          </form>
        </CashierWorkflowWindow>

        <CashierWorkflowWindow title={`Historial de ${detail.barber.name}`} description="Consulta las liquidaciones registradas y filtra por mes." triggerLabel="Ver historial de pagos" triggerContent={<><div><History /><span>TRAZABILIDAD</span><strong>Historial de pagos</strong><small>{history.length} liquidación(es) registrada(s) · filtros por mes</small></div><ArrowRight /></>} triggerClassName="settlement-action-card settlement-history-card" variant="secondary" size="large">
          <div className="settlement-history-modal">
            <div className="settlement-history-filters" role="group" aria-label="Filtrar liquidaciones por mes">
              <button type="button" className={historyMonth === "all" ? "active" : ""} aria-pressed={historyMonth === "all"} onClick={() => setHistoryMonth("all")}>Todos</button>
              {months.map(month => <button type="button" key={month} className={historyMonth === month ? "active" : ""} aria-pressed={historyMonth === month} onClick={() => setHistoryMonth(month)}>{monthName(month)}</button>)}
            </div>
            <div className="settlement-history-table-wrap"><table className="settlement-history-table">
              <thead><tr><th>Fecha</th><th>Servicios</th><th>Incentivos</th><th>Total pagado</th><th>Estado</th></tr></thead>
              <tbody>{visibleHistory.map(item => <tr key={item.id}>
                <td>{date(`${item.period_start}T12:00:00`, timezone)}</td><td>{money(item.commission_amount)}</td><td>{money(item.incentive_amount)}</td><td><strong>{money(item.total_amount)}</strong></td><td><span className={`settlement-history-status ${item.status}`}>{item.status === "paid" ? "Pagada" : item.status === "approved" ? "Pendiente" : item.status === "canceled" ? "Anulada" : item.status}</span></td>
              </tr>)}{visibleHistory.length === 0 && <tr><td colSpan={5} className="settlement-history-empty">No hay liquidaciones para este periodo.</td></tr>}</tbody>
            </table></div>
            <p className="settlement-history-count">{visibleHistory.length} liquidación(es)</p>
          </div>
        </CashierWorkflowWindow>
      </section>
    </section></div>
  </main>;
}

function ConceptAccordion({ icon, title, hint, total, items, empty, timezone }: { icon: React.ReactNode; title: string; hint: string; total: number; items: SettlementLine[]; empty: string; timezone: string }) {
  return <details className="settlement-accordion">
    <summary>
      <span className="settlement-accordion-icon">{icon}</span>
      <span className="settlement-accordion-copy"><small>{hint}</small><strong>{title}</strong></span>
      <b className="settlement-accordion-total">{money(total)}</b>
      <ChevronDown className="settlement-accordion-chevron" aria-hidden="true" />
    </summary>
    <div className="settlement-concept-list">
      {items.length ? items.map(item => <article key={item.id}><div><strong>{item.name}</strong><span>Base {money(item.base_amount)} · {Number(item.rate_percent).toFixed(2)}% · {date(item.created_at, timezone)}</span></div><b>{money(item.amount)}</b></article>) : <p className="settlement-accordion-empty">{empty}</p>}
    </div>
  </details>;
}
