"use client";

import { FormEvent, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Banknote, Calculator, CheckCircle2, ClipboardCheck, History, PackageCheck, PackageOpen, ReceiptText, Scissors, Sparkles } from "lucide-react";
import { Brand } from "@/components/brand";
import { DashboardModal } from "@/components/dashboard-modal";
import { ModeSwitcher } from "@/components/mode-switcher";
import { PanelMobileLogout, PanelMobileMenuButton, PanelMobileScrim, PanelMobileSidebarClose, PanelResponsiveSidebar, PanelThemeSelector } from "@/components/panel-experience";
import { clearFormErrors, dispatchDashboardError, dispatchDashboardSuccess, reportFormError } from "@/lib/form-feedback";
import { createClient } from "@/lib/supabase/client";
import { zonedDateTimeToDate } from "@/lib/business-time";
import { CashierMobileNavigation } from "../../cashier-navigation";
import type { SettlementDetail, SettlementExpense, SettlementHistory, SettlementLine } from "./page";

type Capabilities = { isAdmin: boolean; isSuperadmin: boolean; isCashier: boolean; barber: { id: string; display_name: string } | null };
type Props = { userEmail: string; capabilities: Capabilities; shiftOpen: boolean; detail: SettlementDetail; history: SettlementHistory[]; timezone: string };

const money = (value: number) => `Bs ${Number(value).toFixed(2)}`;
const date = (value: string | Date, timezone: string) => new Intl.DateTimeFormat("es-BO", { dateStyle: "medium", timeZone: timezone }).format(new Date(value));

export function CashierSettlementDetail({ userEmail, capabilities, shiftOpen, detail, history, timezone }: Props) {
  const router = useRouter();
  const [includeIncentives, setIncludeIncentives] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const pendingExpenses = detail.expenses.filter(item => item.status === "pending");
  const projectedTotal = useMemo(() => Math.max(Number(detail.commission_total) + (includeIncentives ? Number(detail.incentive_total) : 0) - Number(detail.deduction_total), 0), [detail, includeIncentives]);
  const legacyPayout = Boolean(detail.payout && Number(detail.payout.reimbursement_amount) > 0 && Number(detail.payout.deduction_amount) === 0);

  async function rpc(name: string, args: Record<string, unknown>, form?: HTMLFormElement) {
    if (form) clearFormErrors(form);
    setBusy(true); setError("");
    const { data, error: rpcError } = await createClient().rpc(name, args);
    setBusy(false);
    if (rpcError) {
      const message = reportFormError(form, rpcError);
      setError(message); dispatchDashboardError(message); return null;
    }
    return data ?? true;
  }

  async function reviewExpense(id: string, status: "approved" | "rejected") {
    if (await rpc("cashier_review_barber_expense", { target_expense: id, next_status: status })) {
      dispatchDashboardSuccess(status === "approved" ? "Gasto aprobado para descuento." : "Gasto rechazado.");
      router.refresh();
    }
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
    if (await rpc("pay_daily_barber_payout", { target_payout: detail.payout.id, payment_method: String(data.get("payment_method")) }, form)) {
      dispatchDashboardSuccess("Pago registrado y egreso añadido al libro diario.");
      router.refresh();
    }
  }

  return <main className="admin-shell dash-workspace cashier-shell">
    <header className="admin-header dash-header"><PanelMobileMenuButton /><div className="dash-brand"><Brand linked={false} /><span className="dash-live"><i /> CAJA CONECTADA</span></div><ModeSwitcher current="cashier" isAdmin={capabilities.isAdmin} hasBarber={Boolean(capabilities.barber)} isCashier showClient={false} /><div className="dash-user"><span className="dash-avatar">{userEmail.slice(0, 2).toUpperCase()}</span><span>{userEmail}<small>Operador de caja</small></span></div></header>
    <div className="admin-layout cashier-layout"><PanelResponsiveSidebar><aside className="admin-nav dash-sidebar"><div className="dash-sidebar-head"><p>TERMINAL POS</p><PanelMobileSidebarClose /></div><nav>
      <Link replace href="/caja"><Scissors /><span>Cobrar servicios</span></Link><Link replace href="/caja/productos"><PackageOpen /><span>Venta de productos</span></Link><Link replace href="/caja/reservas"><PackageCheck /><span>Reservas</span></Link><Link replace href="/caja/movimientos"><ReceiptText /><span>Libro diario</span></Link><Link replace className="active" href="/caja/liquidaciones"><Calculator /><span>Liquidaciones</span><i /></Link><Link replace href="/caja/gastos"><ClipboardCheck /><span>Gastos</span></Link><Link replace href="/caja/historial"><History /><span>Historial</span></Link>
    </nav><div className="dash-sidebar-foot"><PanelThemeSelector /><Link href="/sitio"><Sparkles /><span>Web pública</span></Link><PanelMobileLogout /></div></aside><PanelMobileScrim /></PanelResponsiveSidebar>
      <section className="cashier-content settlement-detail-content">
        <Link replace className="settlement-back" href="/caja/liquidaciones"><ArrowLeft /> Todas las liquidaciones</Link>
        <div className="dash-page-heading"><div className="admin-title"><Calculator /><div><p>CIERRE DEL TURNO · {detail.work_date}</p><h1>{detail.barber.name}</h1></div></div><span className={`dash-status-pill ${shiftOpen ? "online" : "offline"}`}><i />{shiftOpen ? "Turno abierto" : "Turno cerrado"}</span></div>
        {error && <p className="admin-error">{error}</p>}
        <section className="settlement-metrics" aria-label="Resumen de liquidación">
          <article><span>Servicios pendientes</span><strong>{money(detail.commission_total)}</strong></article>
          <article><span>{detail.payout ? "Incentivo incluido" : "Incentivo acumulado"}</span><strong>{money(detail.payout ? detail.payout.incentive_amount : detail.incentive_total)}</strong>{Boolean(detail.payout && detail.remaining_incentive_total > 0) && <small>{money(detail.remaining_incentive_total)} sigue acumulado</small>}</article>
          <article className="deduction"><span>Gastos aprobados</span><strong>- {money(detail.deduction_total)}</strong></article>
          <article className="net"><span>{detail.payout ? "Total liquidación" : "Pago diario"}</span><strong>{money(detail.payout?.total_amount ?? detail.daily_total)}</strong></article>
        </section>

        {legacyPayout && <p className="settlement-warning">Esta liquidación fue preparada con la regla anterior y conserva un reembolso de {money(detail.payout?.reimbursement_amount ?? 0)}. Las nuevas liquidaciones descuentan los gastos.</p>}

        <div className="settlement-columns">
          <ConceptPanel icon={<Scissors />} title="Servicios por liquidar" hint={`${detail.services.length} atención(es)`} items={detail.services} empty="No hay comisiones de servicios pendientes." timezone={timezone} />
          <ConceptPanel icon={<PackageOpen />} title="Incentivos de ventas" hint="Acumulado mensual" items={detail.incentives} empty={detail.payout && detail.remaining_incentive_total > 0 ? `Quedan ${money(detail.remaining_incentive_total)} acumulados para una próxima liquidación.` : "No hay incentivos de productos pendientes."} timezone={timezone} />
        </div>

        <section className="admin-panel settlement-expenses"><div className="dash-list-head"><div><small>DESCUENTOS DE LA LIQUIDACIÓN</small><h2>Gastos e insumos</h2></div><ClipboardCheck /></div><p className="admin-help">Los gastos aprobados restan del pago. Por seguridad, no se puede preparar una liquidación mientras exista alguno pendiente de revisión.</p><div className="settlement-concept-list">{detail.expenses.length ? detail.expenses.map(item => <ExpenseRow key={item.id} item={item} busy={busy} onReview={reviewExpense} />) : <p className="admin-help">No hay gastos pendientes de esta u otras jornadas.</p>}</div></section>

        <section className="admin-panel settlement-action-panel"><div className="dash-list-head"><div><small>CONFIRMACIÓN DE CAJA</small><h2>{detail.payout ? "Liquidación preparada" : "Preparar pago"}</h2></div><Banknote /></div>
          {!detail.payout ? <form className="settlement-prepare-form" onSubmit={prepare}>
            {detail.incentive_total > 0 && <label className="settlement-incentive-check"><input type="checkbox" checked={includeIncentives} onChange={event => setIncludeIncentives(event.target.checked)} /><span><strong>Agregar incentivo de ventas acumulado</strong><small>Opcional · normalmente se paga una vez al mes</small></span><b>+ {money(detail.incentive_total)}</b></label>}
            <div className="settlement-net-preview"><span>Servicios {money(detail.commission_total)}</span>{includeIncentives && <span>Incentivo +{money(detail.incentive_total)}</span>}<span>Gastos -{money(detail.deduction_total)}</span><strong>Neto {money(projectedTotal)}</strong></div>
            {pendingExpenses.length > 0 && <p className="settlement-warning">Revisa {pendingExpenses.length} gasto(s) pendiente(s) antes de continuar.</p>}
            {!shiftOpen && <p className="settlement-warning">Abre un turno de caja para preparar y pagar.</p>}
            <button className="button button-dark" disabled={busy || !shiftOpen || pendingExpenses.length > 0 || projectedTotal <= 0}>Preparar liquidación</button>
          </form> : <div className="settlement-payment-summary"><div><span>Servicios</span><b>{money(detail.payout.commission_amount)}</b></div>{detail.payout.includes_accumulated_incentives && <div><span>Incentivo acumulado</span><b>+ {money(detail.payout.incentive_amount)}</b></div>}<div><span>Gastos descontados</span><b>- {money(detail.payout.deduction_amount)}</b></div><div className="total"><span>Total neto</span><strong>{money(detail.payout.total_amount)}</strong></div>{detail.payout.status === "approved" ? <DashboardModal title="Confirmar pago de liquidación" description={`Se registrará un egreso por ${money(detail.payout.total_amount)}. Esta acción no debe repetirse.`} triggerLabel="Registrar pago" triggerIcon={<CheckCircle2 />}><form className="admin-form" onSubmit={pay}><label className="wide">Forma de pago<select name="payment_method" required><option value="cash">Efectivo</option><option value="qr">QR</option><option value="transfer">Transferencia</option></select></label><button className="button button-dark wide" disabled={busy}>Confirmar pago y egreso</button></form></DashboardModal> : <span className="cashier-paid-mark"><CheckCircle2 /> Pagada {detail.payout.paid_at ? date(detail.payout.paid_at, timezone) : ""}</span>}</div>}
        </section>

        <section className="admin-panel settlement-history"><div className="dash-list-head"><div><small>TRAZABILIDAD</small><h2>Historial reciente</h2></div><History /></div><div className="settlement-concept-list">{history.length ? history.map(item => <article key={item.id}><div><strong>{date(zonedDateTimeToDate(`${item.period_start}T12:00:00`, timezone), timezone)}</strong><span>Servicios {money(item.commission_amount)} · incentivo {money(item.incentive_amount)} · gastos -{money(item.deduction_amount)}</span></div><div className="settlement-row-amount"><b>{money(item.total_amount)}</b><small>{item.status === "paid" ? "Pagada" : "Preparada"}</small></div></article>) : <p className="admin-help">Todavía no existen liquidaciones.</p>}</div></section>
      </section>
    </div>
    <CashierMobileNavigation section="liquidaciones" />
  </main>;
}

function ConceptPanel({ icon, title, hint, items, empty, timezone }: { icon: React.ReactNode; title: string; hint: string; items: SettlementLine[]; empty: string; timezone: string }) {
  return <section className="admin-panel settlement-concept-panel"><div className="dash-list-head"><div><small>{hint}</small><h2>{title}</h2></div>{icon}</div><div className="settlement-concept-list">{items.length ? items.map(item => <article key={item.id}><div><strong>{item.name}</strong><span>Base {money(item.base_amount)} · {Number(item.rate_percent).toFixed(2)}% · {date(item.created_at, timezone)}</span></div><b>{money(item.amount)}</b></article>) : <p className="admin-help">{empty}</p>}</div></section>;
}

function ExpenseRow({ item, busy, onReview }: { item: SettlementExpense; busy: boolean; onReview: (id: string, status: "approved" | "rejected") => void }) {
  return <article><div><strong>{item.concept}</strong><span>{item.notes || "Sin detalle"} · {item.status === "pending" ? "Pendiente" : item.status === "approved" ? "Aprobado para descuento" : item.status}</span></div><div className="settlement-row-amount"><b>- {money(item.amount)}</b>{item.status === "pending" && <span className="dash-row-actions"><button disabled={busy} onClick={() => onReview(item.id, "approved")}>Aprobar</button><button disabled={busy} onClick={() => onReview(item.id, "rejected")}>Rechazar</button></span>}</div></article>;
}
