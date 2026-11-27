"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Calculator, CirclePlus, Gift, History, LockKeyhole, PackageCheck, PackageOpen, Printer, ReceiptText, RotateCcw, Scissors, ShoppingBag, Trash2, WalletCards } from "lucide-react";
import { Brand } from "@/components/brand";
import { CashierWorkflowWindow } from "./cashier-workflow-window";
import { ModeSwitcher } from "@/components/mode-switcher";
import { PanelMobileLogout, PanelThemeSelector } from "@/components/panel-experience";
import { clearFormErrors, dispatchDashboardError, dispatchDashboardSuccess, reportFormError } from "@/lib/form-feedback";
import { businessDateKey } from "@/lib/business-time";
import { createClient } from "@/lib/supabase/client";
import { CashierDesktopNavigation, CashierMobileNavigation, type CashierNavigationSection } from "./cashier-navigation";
import { InstallAppButton } from "@/components/install-app-button";
import { CashierProductSaleForm, PaymentSplits, type PaymentLine, useCashierPromotionQuote } from "./cashier-product-sale-form";
import { CashierClientProfileCard } from "./cashier-client-profile";

type Row = Record<string, unknown> & { id: string };
type RewardQuote = { reward_id: string; barber_id: string; barber_name: string; balance: number; reward_name: string; points_cost: number; eligible_base: number; discount_amount: number };
type RedemptionQuote = { code: string; clientId: string; fingerprint: string; valid: boolean; discount: number; message?: string };
type Capabilities = { isAdmin: boolean; isSuperadmin: boolean; isCashier: boolean; barber: { id: string; display_name: string } | null };
type CashierSection = Exclude<CashierNavigationSection, "reservas">;
type CashierRouteSection = CashierNavigationSection;
type Props = { userEmail: string; capabilities: Capabilities; shift: Row | null; services: Row[]; barbers: Row[]; products: Row[]; clients: Row[]; appointments: Row[]; visitHistory: Row[]; sales: Row[]; earnings: Row[]; expenses: Row[]; payouts: Row[]; productReservations: Row[]; movements: Row[]; workDate: string; businessTimezone: string; section: CashierRouteSection };

export function CashierPanel(props: Props) {
  const { userEmail, capabilities, shift, services, barbers, products, clients, appointments, visitHistory, sales, earnings, expenses, payouts, productReservations, movements, workDate, businessTimezone, section } = props;
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase.channel("cashier-payment-queue")
      .on("postgres_changes", { event: "*", schema: "public", table: "appointments" }, () => router.refresh())
      .on("postgres_changes", { event: "*", schema: "public", table: "appointment_checkout_details" }, () => router.refresh())
      .on("postgres_changes", { event: "*", schema: "public", table: "product_reservations" }, () => router.refresh())
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [router]);

  async function call(name: string, args: Record<string, unknown>, form?: HTMLFormElement, preferredField?: string) {
    if (form) clearFormErrors(form);
    window.dispatchEvent(new Event("cashier:workflow-start"));
    setBusy(true); setError("");
    const { data, error: rpcError } = await createClient().rpc(name, args);
    setBusy(false);
    if (rpcError) {
      const message = reportFormError(form, rpcError, preferredField);
      window.dispatchEvent(new CustomEvent("cashier:workflow-error", { detail: message }));
      setError(message); dispatchDashboardError(message); return null;
    }
    window.dispatchEvent(new Event("cashier:workflow-complete"));
    return data ?? true;
  }

  async function open(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = event.currentTarget; const data = new FormData(form);
    if (await call("open_cash_shift", { opening: Number(data.get("opening")), shift_notes: String(data.get("notes") ?? "") || null }, form, "opening")) {
      dispatchDashboardSuccess("Turno de caja abierto correctamente."); router.refresh();
    }
  }

  async function sell(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = event.currentTarget; const data = new FormData(form);
    const saleKind = String(data.get("sale_kind") ?? "service");
    if (saleKind === "product") {
      const productIds = data.getAll("product_id").map(String);
      const quantities = data.getAll("quantity").map(Number);
      const paymentMethods = data.getAll("payment_method").map(String);
      const paymentAmounts = data.getAll("payment_amount").map(Number);
      const response = await call("register_counter_product_sale_batch_mixed", {
        product_lines: productIds.map((product_id, index) => ({ product_id, quantity: quantities[index] })),
        target_client_id: String(data.get("client_id") ?? "") || null,
        recommended_by_barber_id: String(data.get("recommended_by") ?? "") || null,
        manual_discount: Number(data.get("discount") ?? 0),
        payment_splits: paymentMethods.map((method, index) => ({ method, amount: paymentAmounts[index] })),
        promotion_code: String(data.get("promotion_code") ?? "") || null,
      }, form);
      if (response) {
        setResult(response as Record<string, unknown>);
        dispatchDashboardSuccess("Venta de productos registrada y comprobante generado.");
        router.refresh();
      }
      return;
    }
    const searchInput = form.elements.namedItem("client_search") as HTMLInputElement | null;
    if (!data.get("appointment_id") && data.get("customer_mode") === "existing" && !data.get("client_id")) {
      searchInput?.setCustomValidity("Selecciona un cliente de los resultados de búsqueda.");
      searchInput?.reportValidity();
      return;
    }
    searchInput?.setCustomValidity("");
    const serviceIds = data.getAll("line_service_id").map(String);
    const serviceBarbers = data.getAll("line_barber_id").map(String);
    const attendeeLabels = data.getAll("line_attendee_label").map(String);
    const chargeDescriptions = data.getAll("charge_description").map(String);
    const chargeAmounts = data.getAll("charge_amount").map(Number);
    const chargeBarbers = data.getAll("charge_barber_id").map(String);
    const paymentMethods = data.getAll("payment_method").map(String);
    const paymentAmounts = data.getAll("payment_amount").map(Number);
    const response = await call("register_counter_service_sale_v6_mixed", {
      target_appointment_id: String(data.get("appointment_id") ?? "") || null,
      target_client_id: String(data.get("client_id") ?? "") || null,
      guest_name: String(data.get("guest_name") ?? "") || null,
      guest_phone: String(data.get("guest_phone") ?? "") || null,
      service_lines: serviceIds.map((serviceId, index) => ({ service_id: serviceId, barber_id: serviceBarbers[index], attendee_label: attendeeLabels[index] })),
      custom_charges: chargeDescriptions.map((description, index) => ({ description, amount: chargeAmounts[index], barber_id: chargeBarbers[index] })),
      product_lines: String(data.get("product_id") ?? "") ? [{ product_id: String(data.get("product_id")), quantity: Number(data.get("quantity") ?? 1) }] : [],
      recommended_by_barber_id: String(data.get("recommended_by") ?? "") || null,
      payment_method: paymentMethods[0] ?? "cash",
      payment_reference: null,
      payment_splits: paymentMethods.map((method, index) => ({ method, amount: paymentAmounts[index] })),
      provided_referral_code: String(data.get("referral_code") ?? "") || null,
      selected_reward_id: String(data.get("selected_reward_id") ?? "") || null,
      selected_reward_barber_id: String(data.get("selected_reward_barber_id") ?? "") || null,
      redemption_code: String(data.get("redemption_code") ?? "") || null,
      promotion_code: String(data.get("promotion_code") ?? "") || null,
      manual_discount: Number(data.get("manual_discount") ?? 0),
      checkout_idempotency_key: String(data.get("checkout_idempotency_key") ?? ""),
    }, form);
    if (response) {
      setResult(response as Record<string, unknown>);
      dispatchDashboardSuccess("Cobro registrado y comprobante generado."); router.refresh();
    }
  }

  async function movement(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = event.currentTarget; const data = new FormData(form);
    if (await call("record_cash_movement", { movement_kind: String(data.get("kind")), movement_amount: Number(data.get("amount")), payment_method: String(data.get("method")), movement_reason: String(data.get("reason")) }, form, "amount")) {
      dispatchDashboardSuccess("Movimiento registrado en el libro diario."); router.refresh();
    }
  }

  async function close(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = event.currentTarget; const data = new FormData(form);
    const response = await call("close_cash_shift", { counted: Number(data.get("counted")), shift_notes: String(data.get("notes") ?? "") || null }, form, "counted");
    if (response) { setResult(response as Record<string, unknown>); dispatchDashboardSuccess("Turno cerrado y conciliado."); router.refresh(); }
  }

  async function collectReservation(event: FormEvent<HTMLFormElement>, reservationId: string) {
    event.preventDefault(); const form = event.currentTarget; const data = new FormData(form);
    const paymentMethods = data.getAll("payment_method").map(String);
    const paymentAmounts = data.getAll("payment_amount").map(Number);
    const response = await call("collect_product_reservation_mixed", {
      target_reservation_id: reservationId,
      recommended_by_barber_id: String(data.get("recommended_by") ?? "") || null,
      payment_splits: paymentMethods.map((method, index) => ({ method, amount: paymentAmounts[index] })),
      promotion_code: String(data.get("promotion_code") ?? "") || null,
    }, form);
    if (response) {
      setResult(response as Record<string, unknown>);
      dispatchDashboardSuccess("Apartado cobrado, stock actualizado y comprobante generado a nombre del cliente.");
      router.refresh();
    }
  }

  async function reverseSale(event: FormEvent<HTMLFormElement>, id: string) {
    event.preventDefault(); const form = event.currentTarget; const data = new FormData(form);
    const reason = String(data.get("reason") ?? "").trim();
    if (await call("reverse_counter_sale", { target_sale_id: id, reversal_reason: reason }, form, "reason")) { dispatchDashboardSuccess("Venta revertida y motivo registrado."); router.refresh(); }
  }

  const pendingByBarber = new Map<string, number>();
  earnings.filter(item => item.status === "pending" && item.kind === "service_commission").forEach(item => pendingByBarber.set(String(item.barber_id), (pendingByBarber.get(String(item.barber_id)) ?? 0) + Number(item.amount)));
  const titles: Record<CashierSection, string> = { servicios: "Cobro de servicios", productos: "Venta de productos", movimientos: "Libro diario", liquidaciones: "Liquidaciones diarias", historial: "Historial de ventas" };

  return <main className="admin-shell dash-workspace cashier-shell">
    <header className="admin-header dash-header"><div className="dash-brand"><Brand linked={false} /><span className="dash-live"><i /> CAJA CONECTADA</span></div><InstallAppButton compact /><ModeSwitcher current="cashier" isAdmin={capabilities.isAdmin} hasBarber={Boolean(capabilities.barber)} isCashier showClient={false} /><div className="dash-user"><span className="dash-avatar">{userEmail.slice(0, 2).toUpperCase()}</span><span>{userEmail}<small>Operador de caja</small></span></div></header>
    <div className="admin-layout cashier-layout"><section className="cashier-content"><div className="cashier-toolbar"><CashierDesktopNavigation section={section} reservationCount={productReservations.length} /><div className="cashier-toolbar-tools"><PanelThemeSelector compact /><PanelMobileLogout /></div></div><div className="dash-page-heading"><div className="admin-title"><WalletCards /><div><p>TERMINAL POS</p><h1>{section === "reservas" ? "Reservas de productos" : titles[section]}</h1></div></div><span className={`dash-status-pill ${shift ? "online" : "offline"}`}><i />{shift ? "Turno abierto" : "Turno cerrado"}</span></div>
        {error && <p className="admin-error">{error}</p>}{result && <div className="admin-message"><strong>Operación completada.</strong>{"receipt_id" in result && <Link href={`/comprobante/${String(result.receipt_id)}`}> Ver comprobante #{String(result.receipt_number)}</Link>}{Boolean(result.claim_code) && <span> Código: <b>{String(result.claim_code)}</b></span>}</div>}
        {!shift ? <OpenShift onSubmit={open} busy={busy} /> : <>
          {section === "servicios" && <ServiceDashboard appointments={appointments} visitHistory={visitHistory} clients={clients} services={services} barbers={barbers} products={products} sales={sales} reservations={productReservations} busy={busy} onSubmit={sell} />}
          {section === "productos" && <ProductDashboard products={products} barbers={barbers} clients={clients} visitHistory={visitHistory} busy={busy} onSubmit={sell} />}
          {section === "reservas" && <ReservationDashboard reservations={productReservations} barbers={barbers} visitHistory={visitHistory} busy={busy} onCollect={collectReservation} timezone={businessTimezone} />}
          {section === "movimientos" && <DailyLedger movements={movements} shift={shift} operator={userEmail} busy={busy} onMovement={movement} onClose={close} workDate={workDate} timezone={businessTimezone} />}
          {section === "liquidaciones" && <Settlements barbers={barbers} payouts={payouts} pendingByBarber={pendingByBarber} workDate={workDate} />}
          {section === "historial" && <SalesHistory sales={sales} busy={busy} onReverse={reverseSale} timezone={businessTimezone} />}
        </>}
      </section>
    </div>
    <CashierMobileNavigation section={section} reservationCount={productReservations.length} />
  </main>;
}

function OpenShift({ onSubmit, busy }: { onSubmit: (event: FormEvent<HTMLFormElement>) => void; busy: boolean }) {
  return <section className="admin-panel cashier-welcome"><div className="cashier-orb"><LockKeyhole /></div><div className="cashier-welcome-copy"><p className="eyebrow">TERMINAL BLOQUEADA</p><h2>Abre un turno para comenzar.</h2><p>La apertura queda registrada en el libro diario. Los importes no se muestran en el dashboard operativo.</p></div><div className="cashier-welcome-action"><CashierWorkflowWindow title="Abrir turno" description="Registra el efectivo disponible al iniciar." triggerLabel="Abrir terminal" triggerIcon={<LockKeyhole />}><form className="admin-form" onSubmit={onSubmit}><label>Monto inicial Bs<input name="opening" type="number" min="0" step="0.5" defaultValue="0" required /></label><label>Glosa de apertura<input name="notes" /></label><button className="button button-dark wide" disabled={busy}>Confirmar apertura</button></form></CashierWorkflowWindow></div></section>;
}

function ServiceDashboard({ appointments, visitHistory, clients, services, barbers, products, sales, reservations, busy, onSubmit }: { appointments: Row[]; visitHistory: Row[]; clients: Row[]; services: Row[]; barbers: Row[]; products: Row[]; sales: Row[]; reservations: Row[]; busy: boolean; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  const stockUnits = products.reduce((total, product) => total + Number(product.stock ?? 0), 0);
  return <><div className="cashier-compact-status"><span><b>{appointments.length}</b> en cola</span><span><b>{sales.filter(sale => Boolean(sale.paid_at)).length}</b> procesadas</span></div>
    <section className="cashier-dashboard-tools" aria-label="Acciones frecuentes">
      <Link className="cashier-tool-card cashier-tool-products" href="/caja/productos"><span className="cashier-tool-icon"><ShoppingBag /></span><span className="cashier-tool-copy"><small>Punto de venta</small><strong>Vender productos</strong><span>{products.length} productos · {stockUnits} unidades disponibles</span></span><span className="cashier-tool-action">Abrir <ArrowRight /></span></Link>
      <Link className="cashier-tool-card cashier-tool-reservations" href="/caja/reservas"><span className="cashier-tool-icon"><PackageCheck /></span><span className="cashier-tool-copy"><small>Retiro en local</small><strong>Reservas por entregar</strong><span>{reservations.length} pedido(s) pendiente(s)</span></span><span className="cashier-tool-action">Ver reservas <ArrowRight /></span>{reservations.length > 0 && <b className="cashier-tool-count">{reservations.length}</b>}</Link>
      <Link className="cashier-tool-card cashier-tool-ledger" href="/caja/movimientos"><span className="cashier-tool-icon"><Calculator /></span><span className="cashier-tool-copy"><small>Control de turno</small><strong>Libro diario</strong><span>Ingresos, egresos y cierre de caja</span></span><span className="cashier-tool-action">Ver caja <ArrowRight /></span></Link>
    </section>
    <section className="admin-panel cashier-queue"><div className="dash-list-head"><div><small>ACTUALIZACIÓN AUTOMÁTICA</small><h2>Cobros pendientes</h2></div><ReceiptText /></div><p className="admin-help">Cuando el peluquero termina una atención, aparece aquí con los cambios y extras informados.</p><div className="admin-list">{appointments.length ? appointments.map(appointment => <QueueItem key={appointment.id} appointment={appointment} clients={clients} visitHistory={visitHistory} services={services} barbers={barbers} products={products} busy={busy} onSubmit={onSubmit} />) : <p className="admin-help">No hay cobros pendientes. Puedes registrar una atención sin reserva.</p>}</div></section>
    <div className="cashier-quick-actions"><section className="admin-panel cashier-quick-action"><div><small>CLIENTE SIN RESERVA</small><h2>Cobro directo de servicio</h2><p>Busca una cuenta existente o registra un cliente nuevo. Para nuevos clientes, el comprobante generará su código y QR de vinculación.</p></div><CashierWorkflowWindow title="Cobrar servicio" description="Atención sin reserva previa." triggerLabel="Nuevo cobro" triggerIcon={<Scissors />} size="large"><ServiceSaleForm clients={clients} visitHistory={visitHistory} services={services} barbers={barbers} products={products} busy={busy} onSubmit={onSubmit} /></CashierWorkflowWindow></section></div></>;
}

function QueueItem({ appointment, clients, visitHistory, services, barbers, products, busy, onSubmit }: { appointment: Row; clients: Row[]; visitHistory: Row[]; services: Row[]; barbers: Row[]; products: Row[]; busy: boolean; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  const checkout = appointment.appointment_checkout_details as Row | Row[] | null;
  const details = Array.isArray(checkout) ? checkout[0] : checkout;
  const client = appointment.profiles as { full_name?: string } | null;
  const barber = appointment.barber_profiles as { display_name?: string } | null;
  return <article><div><strong>{client?.full_name ?? "Cliente"} · {String(appointment.service_name_snapshot)}</strong><span>{barber?.display_name ?? "Peluquero"}{details?.notes ? ` · ${String(details.notes)}` : ""}</span></div><CashierWorkflowWindow title={`Cobrar a ${client?.full_name ?? "cliente"}`} description="Puedes corregir el servicio y añadir extras antes de confirmar." triggerLabel="Revisar y cobrar" triggerIcon={<ReceiptText />} size="large"><ServiceSaleForm appointment={appointment} checkout={details ?? null} clients={clients} visitHistory={visitHistory} services={services} barbers={barbers} products={products} busy={busy} onSubmit={onSubmit} /></CashierWorkflowWindow></article>;
}

function ClientFields({ clients, mode, onModeChange, onClientChange, visitHistory }: { clients: Row[]; mode: "new" | "existing"; onModeChange: (mode: "new" | "existing") => void; onClientChange: (id: string) => void; visitHistory: Row[] }) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Row | null>(null);
  const [results, setResults] = useState<Row[]>([]);
  const [searching, setSearching] = useState(false);
  const [referred, setReferred] = useState(false);

  useEffect(() => {
    if (mode !== "existing" || query.trim().length < 2 || selected) {
      setSearching(false);
      return;
    }
    const search = query.trim().replace(/[%,_()]/g, " ");
    const normalized = search.toLocaleLowerCase("es");
    const localMatches = clients.filter(client => [client.full_name, client.email, client.phone].some(value => String(value ?? "").toLocaleLowerCase("es").includes(normalized))).slice(0, 8);
    let active = true;
    setResults(localMatches);
    setSearching(true);
    const timer = window.setTimeout(async () => {
      const pattern = `%${search}%`;
      const { data } = await createClient().from("profiles").select("id,full_name,email,phone,referral_code").eq("status", "active")
        .or(`full_name.ilike.${pattern},email.ilike.${pattern},phone.ilike.${pattern}`).order("full_name").limit(8);
      if (active) {
        setResults((data as Row[] | null) ?? localMatches);
        setSearching(false);
      }
    }, 220);
    return () => { active = false; window.clearTimeout(timer); };
  }, [clients, mode, query, selected]);

  function chooseMode(next: "new" | "existing") {
    onModeChange(next);
    onClientChange("");
    setQuery("");
    setSelected(null);
    setResults([]);
    setReferred(false);
  }

  return <fieldset className="wide cashier-client-fields">
    <legend>Datos del cliente</legend>
    <div className="cashier-client-modes" role="group" aria-label="Tipo de cliente">
      <button type="button" aria-pressed={mode === "new"} className={mode === "new" ? "active" : ""} onClick={() => chooseMode("new")}>Cliente nuevo</button>
      <button type="button" aria-pressed={mode === "existing"} className={mode === "existing" ? "active" : ""} onClick={() => chooseMode("existing")}>Cliente registrado</button>
    </div>
    <input type="hidden" name="customer_mode" value={mode} />
    <input type="hidden" name="client_id" value={selected?.id ?? ""} />
    {mode === "new" ? <div className="cashier-client-grid">
      <label>Nombre completo<input name="guest_name" autoComplete="name" minLength={3} required placeholder="Nombre y apellidos" /></label>
      <label>Teléfono (opcional)<input name="guest_phone" inputMode="tel" autoComplete="tel" placeholder="Ej. 70123456" /></label>
      <p className="wide cashier-client-help">El comprobante incluirá un QR y código único. Al escanearlo e iniciar sesión, el cliente vinculará esta compra y recibirá sus puntos.</p>
    </div> : <div className="cashier-client-search">
      <label>Buscar por nombre
        <input name="client_search" type="search" autoComplete="off" value={query} onChange={event => {
          const nextQuery = event.target.value;
          const normalized = nextQuery.trim().toLocaleLowerCase("es");
          event.currentTarget.setCustomValidity("");
          setQuery(nextQuery);
          setSelected(null);
          onClientChange("");
          setResults(normalized.length >= 2 ? clients.filter(client => [client.full_name, client.email, client.phone].some(value => String(value ?? "").toLocaleLowerCase("es").includes(normalized))).slice(0, 8) : []);
          setSearching(normalized.length >= 2);
        }} placeholder="Nombre, teléfono o correo" required aria-autocomplete="list" aria-controls="cashier-service-client-results" aria-busy={searching} />
      </label>
      {selected ? <><div className="cashier-client-selected"><span><strong>{String(selected.full_name ?? selected.email)}</strong>{Boolean(selected.phone) && <small>{String(selected.phone)}</small>}</span><button type="button" onClick={() => { setSelected(null); setQuery(""); onClientChange(""); }}>Cambiar</button></div><CashierClientProfileCard client={selected} visitHistory={visitHistory} /></> : query.trim().length >= 2 && <div id="cashier-service-client-results" className="cashier-client-results" role="listbox" aria-label="Clientes encontrados" aria-live="polite" aria-busy={searching}>
        {results.map(client => <button type="button" role="option" aria-selected="false" key={client.id} onClick={event => { (event.currentTarget.form?.elements.namedItem("client_search") as HTMLInputElement | null)?.setCustomValidity(""); setSelected(client); onClientChange(client.id); setQuery(String(client.full_name ?? client.email ?? "")); setResults([]); setSearching(false); }}><strong>{String(client.full_name ?? "Sin nombre")}</strong><small>{String(client.phone ?? client.email ?? "")}</small></button>)}
        {!searching && results.length === 0 && <p>No encontramos clientes con ese nombre.</p>}
        {searching && <p>Buscando…</p>}
      </div>}
    </div>}
    {mode === "new" && <label className="wide cashier-product-toggle cashier-referral-toggle"><input type="checkbox" checked={referred} onChange={event => setReferred(event.target.checked)} /> Viene recomendado por otro cliente</label>}
    {mode === "new" && referred && <label className="wide">Código del cliente que lo recomendó<input name="referral_code" placeholder="LC-..." autoCapitalize="characters" required /></label>}
  </fieldset>;
}
function PaymentFields({ total, allowPromotion = false, onValidityChange }: { total: number; allowPromotion?: boolean; onValidityChange?: (valid: boolean) => void }) {
  const [payments, setPayments] = useState<PaymentLine[]>([{ id: "payment-1", method: "cash", amount: "0.00" }]);
  const [promotion, setPromotion] = useState(false);
  const [promotionCode, setPromotionCode] = useState("");
  const [splitValid, setSplitValid] = useState(false);
  const promotionQuote = useCashierPromotionQuote(promotion ? promotionCode : "", total);
  const payableTotal = promotion ? promotionQuote.total : total;
  useEffect(() => { onValidityChange?.(splitValid && (!promotion || (!promotionQuote.loading && promotionQuote.valid))); }, [onValidityChange, promotion, promotionQuote.loading, promotionQuote.valid, splitValid]);
  useEffect(() => { if (payments.length === 1) setPayments(current => current.length === 1 ? [{ ...current[0], amount: payableTotal.toFixed(2) }] : current); }, [payments.length, payableTotal]);
  return <>{allowPromotion && <button type="button" className={`cashier-option-toggle ${promotion ? "active" : ""}`} aria-pressed={promotion} onClick={() => { setPromotion(value => !value); setPromotionCode(""); }}><Gift />{promotion ? "Quitar promoción" : "Aplicar promoción"}</button>}{promotion && <label className="wide">Código de promoción<input name="promotion_code" value={promotionCode} onChange={event => setPromotionCode(event.target.value)} autoCapitalize="characters" required />{promotionQuote.loading ? <small role="status">Validando código…</small> : promotionCode.trim() && !promotionQuote.valid ? <small role="alert">{promotionQuote.message ?? "Código no válido o agotado."}</small> : promotionQuote.valid ? <small className="cashier-promotion-valid">Descuento aplicado: Bs {promotionQuote.discount.toFixed(2)}</small> : null}</label>}{!promotion && <input type="hidden" name="promotion_code" value="" />}<PaymentSplits total={payableTotal} onValidityChange={setSplitValid} payments={payments} setPayments={setPayments} />{promotion && promotionQuote.valid && <p className="cashier-promotion-valid wide">Total con promoción: Bs {payableTotal.toFixed(2)}</p>}</>;
}

type CashierChoice = { value: string; label: string; caption?: string };
function ChoiceButtons({ name, label, value, options, onChange, className = "" }: { name: string; label: string; value: string; options: CashierChoice[]; onChange: (value: string) => void; className?: string }) {
  return <div className={`cashier-choice-field ${className}`}><span>{label}</span><input type="hidden" name={name} value={value} /><div className="cashier-choice-buttons" role="group" aria-label={label}>{options.map(option => <button type="button" key={option.value} aria-pressed={value === option.value} className={value === option.value ? "active" : ""} onClick={() => onChange(option.value)}><strong>{option.label}</strong>{option.caption && <small>{option.caption}</small>}</button>)}</div></div>;
}

type ServiceLine = { key: string; serviceId: string; barberId: string; attendeeLabel: string };
type CustomCharge = { key: string; description: string; amount: string; barberId: string };

function useCashierRedemptionQuote(code: string, clientId: string, serviceLines: ServiceLine[]) {
  const [quote, setQuote] = useState<RedemptionQuote | null>(null);
  const [loading, setLoading] = useState(false);
  const normalizedCode = code.trim().toLocaleUpperCase("es");
  const fingerprint = JSON.stringify(serviceLines.map(line => ({ service_id: line.serviceId, barber_id: line.barberId })));
  useEffect(() => {
    if (!normalizedCode || !clientId || serviceLines.some(line => !line.serviceId || !line.barberId)) { setQuote(null); setLoading(false); return; }
    let active = true;
    setLoading(true);
    const timer = window.setTimeout(async () => {
      try {
        const { data, error } = await createClient().rpc("cashier_quote_redemption", {
          target_client_id: clientId,
          target_code: normalizedCode,
          service_lines: serviceLines.map(line => ({ service_id: line.serviceId, barber_id: line.barberId })),
        });
        if (!active) return;
        const result = data as { valid?: boolean; discount?: number; message?: string } | null;
        setQuote({ code: normalizedCode, clientId, fingerprint, valid: !error && Boolean(result?.valid), discount: Number(result?.discount ?? 0), message: error?.message ?? result?.message });
      } catch {
        if (active) setQuote({ code: normalizedCode, clientId, fingerprint, valid: false, discount: 0, message: "No se pudo validar el código." });
      } finally {
        if (active) setLoading(false);
      }
    }, 220);
    return () => { active = false; window.clearTimeout(timer); };
  }, [clientId, fingerprint, normalizedCode, serviceLines]);
  const current = quote?.code === normalizedCode && quote.clientId === clientId && quote.fingerprint === fingerprint ? quote : null;
  return { loading: Boolean(normalizedCode) && (loading || !current), valid: Boolean(current?.valid), discount: current?.discount ?? 0, message: current?.message };
}

function ServiceSaleForm({ appointment, checkout, clients, visitHistory, services, barbers, products, busy, onSubmit }: { appointment?: Row; checkout?: Row | null; clients: Row[]; visitHistory: Row[]; services: Row[]; barbers: Row[]; products: Row[]; busy: boolean; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  const [customerMode, setCustomerMode] = useState<"new" | "existing">("new");
  const [clientId, setClientId] = useState(String(appointment?.client_id ?? ""));
  const [addProduct, setAddProduct] = useState(Boolean(checkout?.suggested_product_id));
  const [selectedProductId, setSelectedProductId] = useState(String(checkout?.suggested_product_id ?? ""));
  const [selectedProductQuantity, setSelectedProductQuantity] = useState(Number(checkout?.product_quantity ?? 1));
  const [recommendedBy, setRecommendedBy] = useState(String(appointment?.barber_id ?? ""));
  const [benefitMode, setBenefitMode] = useState<"none" | "points" | "promotion" | "code">("none");
  const [rewardQuotes, setRewardQuotes] = useState<RewardQuote[]>([]);
  const [quotedFingerprint, setQuotedFingerprint] = useState("");
  const [selectedReward, setSelectedReward] = useState("");
  const [vipDiscount, setVipDiscount] = useState(false);
  const [promotionCode, setPromotionCode] = useState("");
  const [redemptionCode, setRedemptionCode] = useState("");
  const [paymentValid, setPaymentValid] = useState(false);
  const [checkoutKey] = useState(() => typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `checkout-${Date.now()}-${Math.random()}`);
  const [serviceLines, setServiceLines] = useState<ServiceLine[]>(() => {
    const initial = [{ key: "primary", serviceId: String(checkout?.actual_service_id ?? appointment?.service_id ?? ""), barberId: String(appointment?.barber_id ?? ""), attendeeLabel: "Titular" }];
    if (checkout?.extra_service_id) initial.push({ key: "checkout-extra", serviceId: String(checkout.extra_service_id), barberId: String(appointment?.barber_id ?? ""), attendeeLabel: "Titular" });
    return initial;
  });
  const [charges, setCharges] = useState<CustomCharge[]>([]);
  const quoteFingerprint=`${clientId}:${serviceLines.map(line=>`${line.serviceId}:${line.barberId}`).join("|")}`;
  useEffect(() => {
    if (!clientId || serviceLines.some(line => !line.serviceId || !line.barberId)) return;
    let active = true;
    const timer = window.setTimeout(async () => {
      const { data } = await createClient().rpc("cashier_quote_loyalty", { target_client_id: clientId, service_lines: serviceLines.map(line => ({ service_id: line.serviceId, barber_id: line.barberId })) });
      if (!active) return;
      const quotes = (data as RewardQuote[] | null) ?? [];
      setRewardQuotes(quotes); setQuotedFingerprint(quoteFingerprint); setSelectedReward(current => quotes.some(item => `${item.reward_id}:${item.barber_id}` === current) ? current : (quotes[0] ? `${quotes[0].reward_id}:${quotes[0].barber_id}` : ""));
    }, 250);
    return () => { active = false; window.clearTimeout(timer); };
  }, [clientId, serviceLines, quoteFingerprint]);
  function updateServiceLine(key: string, field: keyof Omit<ServiceLine, "key">, value: string) { setServiceLines(lines => lines.map(line => line.key === key ? { ...line, [field]: value } : line)); }
  function updateCharge(key: string, field: keyof Omit<CustomCharge, "key">, value: string) { setCharges(items => items.map(item => item.key === key ? { ...item, [field]: value } : item)); }
  const quoteInputValid=Boolean(clientId) && serviceLines.every(line=>line.serviceId&&line.barberId);
  const chosenQuote = quoteInputValid&&quotedFingerprint===quoteFingerprint?rewardQuotes.find(item => `${item.reward_id}:${item.barber_id}` === selectedReward):undefined;
  const pointsRewards = quoteInputValid&&quotedFingerprint===quoteFingerprint ? rewardQuotes.filter(item => [50,100].includes(item.points_cost)) : [];
  const serviceSubtotal = serviceLines.reduce((sum, line) => sum + Number(services.find(service => service.id === line.serviceId)?.price ?? 0), 0);
  const chargesSubtotal = charges.reduce((sum, charge) => sum + (Number(charge.amount) || 0), 0);
  const productSubtotal = addProduct ? Number(products.find(product => product.id === selectedProductId)?.price ?? 0) * selectedProductQuantity : 0;
  const now = new Date();
  const monthlyVisits = visitHistory.filter(item => {
    const date = new Date(String(item.starts_at));
    return String(item.client_id ?? "") === clientId && date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
  });
  const checkoutSubtotal = serviceSubtotal + chargesSubtotal + productSubtotal;
  const promotionQuote = useCashierPromotionQuote(benefitMode === "promotion" ? promotionCode : "", checkoutSubtotal);
  const redemptionQuote = useCashierRedemptionQuote(benefitMode === "code" ? redemptionCode : "", clientId, serviceLines);
  const manualDiscount = vipDiscount && monthlyVisits.length > 0 && benefitMode === "none" ? 5 : 0;
  const estimatedTotal = benefitMode === "promotion" ? promotionQuote.total : Math.max(0, checkoutSubtotal - (benefitMode === "code" ? redemptionQuote.discount : 0) - manualDiscount - (benefitMode === "points" ? Number(chosenQuote?.discount_amount ?? 0) : 0));
  const appointmentProfile = appointment && clientId ? (clients.find(client => client.id === clientId) ?? { id: clientId, ...(appointment.profiles as Record<string, unknown> | null) }) as Row : null;
  const serviceOptions = services.map(service => ({ value: service.id, label: String(service.name), caption: `Bs ${Number(service.price).toFixed(2)}` }));
  const barberOptions = barbers.map(barber => ({ value: barber.id, label: String(barber.display_name), caption: `${Number(barber.commission_percent ?? 0)}% comisión` }));
  return <form className="admin-form cashier-service-checkout" onSubmit={onSubmit}><input type="hidden" name="sale_kind" value="service" /><input type="hidden" name="appointment_id" value={appointment?.id ?? ""} /><input type="hidden" name="checkout_idempotency_key" value={checkoutKey} /><input type="hidden" name="selected_reward_id" value={benefitMode === "points" ? chosenQuote?.reward_id ?? "" : ""} /><input type="hidden" name="selected_reward_barber_id" value={benefitMode === "points" ? chosenQuote?.barber_id ?? "" : ""} />{!appointment && <ClientFields clients={clients} visitHistory={visitHistory} mode={customerMode} onModeChange={mode => { setCustomerMode(mode); setBenefitMode("none"); }} onClientChange={setClientId} />}{appointmentProfile && <div className="wide"><CashierClientProfileCard client={appointmentProfile} visitHistory={visitHistory} /></div>}
    <fieldset className="wide cashier-line-group"><legend>Atenciones incluidas</legend>{serviceLines.map((line, index) => <div className="cashier-service-line" key={line.key}>
      {serviceLines.length > 1 && <span className="cashier-line-number">Atención {index + 1}</span>}
      {index === 0 ? <input type="hidden" name="line_attendee_label" value="Titular" /> : <ChoiceButtons name="line_attendee_label" label="Persona atendida" value={line.attendeeLabel} onChange={value => updateServiceLine(line.key, "attendeeLabel", value)} options={[{ value: "Titular", label: "Titular" }, { value: "Hijo/a", label: "Hijo/a" }, { value: "Acompañante", label: "Acompañante" }]} />}
      <ChoiceButtons name="line_service_id" label="Servicio" value={line.serviceId} onChange={value => updateServiceLine(line.key, "serviceId", value)} options={serviceOptions} className="cashier-service-choice" />
      <ChoiceButtons name="line_barber_id" label="Peluquero" value={line.barberId} onChange={value => updateServiceLine(line.key, "barberId", value)} options={barberOptions} className="cashier-barber-choice" />
      {serviceLines.length > 1 && <button type="button" className="cashier-remove-line" aria-label={`Quitar atención ${index + 1}`} onClick={() => setServiceLines(lines => lines.filter(item => item.key !== line.key))}><Trash2 /> Quitar</button>}
    </div>)}<button type="button" className="cashier-add-line" onClick={() => setServiceLines(lines => [...lines, { key: `service-${Date.now()}`, serviceId: "", barberId: lines.at(-1)?.barberId ?? "", attendeeLabel: "Hijo/a" }])}><CirclePlus /> Agregar otra atención</button></fieldset>
    {charges.length > 0 && <fieldset className="wide cashier-line-group"><legend>Cargos imprevistos</legend>{charges.map((charge, index) => <div className="cashier-service-line cashier-charge-line" key={charge.key}>
      <span className="cashier-line-number">Cargo {index + 1}</span><label>Justificación<input name="charge_description" value={charge.description} onChange={event => updateCharge(charge.key, "description", event.target.value)} required placeholder="Detalle realizado" /></label><label>Monto Bs<input name="charge_amount" type="number" min="0.5" step="0.5" value={charge.amount} onChange={event => updateCharge(charge.key, "amount", event.target.value)} required /></label><ChoiceButtons name="charge_barber_id" label="Peluquero responsable" value={charge.barberId} onChange={value => updateCharge(charge.key, "barberId", value)} options={barberOptions} className="cashier-barber-choice" /><button type="button" className="cashier-remove-line" onClick={() => setCharges(items => items.filter(item => item.key !== charge.key))}><Trash2 /> Quitar</button>
    </div>)}</fieldset>}
    {charges.length === 0 && <button type="button" className="wide cashier-add-line cashier-optional-action" onClick={() => setCharges([{ key: `charge-${Date.now()}`, description: "", amount: "", barberId: serviceLines[0]?.barberId ?? "" }])}><CirclePlus /> Agregar cargo imprevisto</button>}
    <button type="button" className={`cashier-option-toggle ${addProduct ? "active" : ""}`} aria-pressed={addProduct} onClick={() => setAddProduct(value => !value)}><PackageOpen />{addProduct ? "Quitar producto" : "Añadir producto al cobro"}</button>
    {addProduct && <div className="wide cashier-checkout-products">{products.map(product => <button type="button" key={product.id} className={selectedProductId === product.id ? "active" : ""} aria-pressed={selectedProductId === product.id} onClick={() => setSelectedProductId(product.id)}><span>{String(product.name)}</span><small>Bs {Number(product.price).toFixed(2)} · {Number(product.stock)} disponibles</small></button>)}<input type="hidden" name="product_id" value={selectedProductId} /><input type="hidden" name="quantity" value={selectedProductQuantity} />{selectedProductId && <div className="cashier-product-quantity-choice"><span>Cantidad</span><button type="button" aria-label="Quitar una unidad" disabled={selectedProductQuantity <= 1} onClick={() => setSelectedProductQuantity(value => Math.max(value - 1, 1))}>−</button><strong>{selectedProductQuantity}</strong><button type="button" aria-label="Agregar una unidad" disabled={selectedProductQuantity >= Math.min(20, Number(products.find(product => product.id === selectedProductId)?.stock ?? 0))} onClick={() => setSelectedProductQuantity(value => value + 1)}>+</button></div>}<ChoiceButtons name="recommended_by" label="Recomendado por" value={recommendedBy} onChange={setRecommendedBy} options={[{ value: "", label: "Sin recomendador" }, ...barberOptions]} /></div>}
    {(Boolean(appointment) || customerMode === "existing") && <fieldset className="wide cashier-benefits"><legend>Beneficio (opcional)</legend><div className="cashier-benefit-modes"><button type="button" aria-pressed={benefitMode === "none"} className={benefitMode === "none" ? "active" : ""} onClick={() => setBenefitMode("none")}>Sin beneficio</button>{pointsRewards.length > 0 && <button type="button" aria-pressed={benefitMode === "points"} className={benefitMode === "points" ? "active" : ""} onClick={() => { setBenefitMode("points"); setSelectedReward(`${pointsRewards[0].reward_id}:${pointsRewards[0].barber_id}`); }}><Gift /> Canjear puntos</button>}<button type="button" aria-pressed={benefitMode === "promotion"} className={benefitMode === "promotion" ? "active" : ""} onClick={() => { setBenefitMode("promotion"); setPromotionCode(""); }}>Promoción</button><button type="button" aria-pressed={benefitMode === "code"} className={benefitMode === "code" ? "active" : ""} onClick={() => { setBenefitMode("code"); setRedemptionCode(""); }}>Código</button></div>{benefitMode === "points" && <div className="cashier-reward-options">{pointsRewards.map(reward => <label className={selectedReward === `${reward.reward_id}:${reward.barber_id}` ? "selected" : ""} key={`${reward.reward_id}:${reward.barber_id}`}><input type="radio" name="reward_choice" checked={selectedReward === `${reward.reward_id}:${reward.barber_id}`} onChange={() => setSelectedReward(`${reward.reward_id}:${reward.barber_id}`)} /><span><strong>{reward.points_cost === 50 ? "50% de descuento" : "Descuento de Bs 25"}</strong><small>{reward.barber_name} · usa {reward.points_cost} de {reward.balance} puntos</small></span><b>- Bs {Number(reward.discount_amount).toFixed(2)}</b></label>)}</div>}{benefitMode === "promotion" && <label>Código de promoción<input name="promotion_code" value={promotionCode} onChange={event => setPromotionCode(event.target.value)} autoCapitalize="characters" required />{promotionQuote.loading ? <small role="status">Validando código…</small> : promotionCode.trim() && !promotionQuote.valid ? <small role="alert">{promotionQuote.message ?? "Código no válido o agotado."}</small> : promotionQuote.valid ? <small className="cashier-promotion-valid">Descuento aplicado: Bs {promotionQuote.discount.toFixed(2)}</small> : null}</label>}{benefitMode === "code" && <label>Código mostrado por el cliente<input name="redemption_code" value={redemptionCode} onChange={event => setRedemptionCode(event.target.value)} autoCapitalize="characters" required />{redemptionQuote.loading ? <small role="status">Validando canje…</small> : redemptionCode.trim() && !redemptionQuote.valid ? <small role="alert">{redemptionQuote.message ?? "Canje no válido, vencido o sin servicios elegibles."}</small> : redemptionQuote.valid ? <small className="cashier-promotion-valid">Descuento aplicado: Bs {redemptionQuote.discount.toFixed(2)}</small> : null}</label>}</fieldset>}
    {clientId && monthlyVisits.length > 0 && benefitMode === "none" && <button type="button" className={`cashier-option-toggle ${vipDiscount ? "active" : ""}`} aria-pressed={vipDiscount} onClick={() => setVipDiscount(value => !value)}><Gift />{vipDiscount ? "Quitar descuento de cliente frecuente" : "Aplicar descuento de cliente frecuente · Bs 5"}</button>}
    <input type="hidden" name="manual_discount" value={manualDiscount} /><div className="wide cashier-total-preview"><span>Subtotal estimado <b>Bs {checkoutSubtotal.toFixed(2)}</b></span>{manualDiscount > 0 && <span>Descuento VIP <b>− Bs {manualDiscount.toFixed(2)}</b></span>}{benefitMode === "points" && <span>Canje de {chosenQuote?.points_cost ?? "—"} puntos <b>− Bs {Number(chosenQuote?.discount_amount ?? 0).toFixed(2)}</b></span>}{benefitMode === "promotion" && promotionQuote.valid && <span>Promoción <b>− Bs {promotionQuote.discount.toFixed(2)}</b></span>}{benefitMode === "code" && redemptionQuote.valid && <span>Canje <b>− Bs {redemptionQuote.discount.toFixed(2)}</b></span>}<strong>Total estimado a cobrar <b>Bs {estimatedTotal.toFixed(2)}</b></strong></div><PaymentFields total={estimatedTotal} onValidityChange={setPaymentValid} /><button className="button button-dark wide" disabled={busy || !paymentValid || (benefitMode === "promotion" && (promotionQuote.loading || !promotionQuote.valid)) || (benefitMode === "code" && (redemptionQuote.loading || !redemptionQuote.valid)) || !serviceLines.every(line => line.serviceId && line.barberId) || !charges.every(charge => charge.description.trim().length >= 3 && Number(charge.amount) > 0 && charge.barberId) || (addProduct && !selectedProductId) || (benefitMode === "points" && !chosenQuote)}><ReceiptText /> Confirmar pago y emitir comprobante · Bs {estimatedTotal.toFixed(2)}</button></form>;
}

function ProductDashboard({ products, barbers, clients, visitHistory, busy, onSubmit }: { products: Row[]; barbers: Row[]; clients: Row[]; visitHistory: Row[]; busy: boolean; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  const stockUnits = products.reduce((total, product) => total + Number(product.stock ?? 0), 0);
  return <section className="admin-panel cashier-product-sale">
    <div className="cashier-product-layout">
      <div className="cashier-product-copy"><div className="dash-list-head"><div><small>OPERACIÓN INDEPENDIENTE</small><h2>Registrar productos</h2></div><PackageOpen /></div><p className="admin-help">Agrega varios productos a una sola cuenta. El cliente suma 5 puntos por unidad; el peluquero asociado recibe Bs 5 por unidad.</p></div>
      <div className="cashier-product-stats"><span><strong>{products.length}</strong> productos disponibles</span><span><strong>{stockUnits}</strong> unidades en stock</span></div>
      {products.length ? <CashierWorkflowWindow title="Registrar venta de productos" description="Busca artículos, arma el carrito y distribuye el cobro entre uno o varios medios." triggerLabel="Nueva venta" triggerIcon={<PackageOpen />} size="large"><CashierProductSaleForm products={products} barbers={barbers} clients={clients} visitHistory={visitHistory} busy={busy} onSubmit={onSubmit} /></CashierWorkflowWindow> : <div className="cashier-inline-empty"><strong>No hay productos disponibles para vender</strong><span>Revisa el inventario con Administración y vuelve a Caja cuando haya existencias.</span></div>}
    </div>
  </section>;
}
function ReservationDashboard({ reservations, barbers, visitHistory, busy, onCollect, timezone }: { reservations: Row[]; barbers: Row[]; visitHistory: Row[]; busy: boolean; onCollect: (event: FormEvent<HTMLFormElement>, reservationId: string) => void; timezone: string }) {
  const expiredCount = reservations.filter(reservation => Boolean(reservation.is_expired)).length;
  const reservedValue = reservations.filter(reservation => !reservation.is_expired).reduce((sum, reservation) => sum + Number(reservation.price_snapshot) * Number(reservation.quantity), 0);
  return <section className="admin-panel cashier-reservations"><div className="dash-list-head"><div><small>RETIRO EN EL LOCAL</small><h2>Productos apartados</h2></div><PackageCheck /></div><p className="admin-help">Confirma la identidad del cliente antes de cobrar. Al finalizar, el apartado sale de esta lista, se descuenta el stock y se crea un comprobante a su nombre.</p><div className="cashier-reservation-overview"><article><span>Apartados</span><strong>{reservations.length}</strong></article><article><span>Por cobrar</span><strong>Bs {reservedValue.toFixed(2)}</strong></article><article><span>Vencidos</span><strong>{expiredCount}</strong></article></div><div className="cashier-reservation-list">{reservations.length ? reservations.map(reservation => {
    const client = reservation.profiles as { full_name?: string; email?: string; phone?: string } | null;
    const product = reservation.products as { name?: string; brand?: string; presentation?: string; stock?: number } | null;
    const expiresAt = new Date(String(reservation.expires_at));
    const expired = Boolean(reservation.is_expired);
    const total = Number(reservation.price_snapshot) * Number(reservation.quantity);
    const clientName = String(client?.full_name ?? client?.email ?? "Cliente");
    const productName = String(product?.name ?? "Producto");
    const profile = client ? { id: String(reservation.client_id), ...client } as Row : null;
    return <article className={expired ? "expired" : ""} key={reservation.id}><div className="cashier-reservation-main"><span className="cashier-reservation-icon"><PackageOpen /></span><div><small>{expired ? "APARTADO VENCIDO" : "LISTO PARA RETIRO"}</small><h3>{productName}</h3><p>{[product?.brand, product?.presentation].filter(Boolean).join(" · ") || "Sin presentación registrada"}</p></div></div><dl><div><dt>Cliente</dt><dd>{clientName}</dd></div><div><dt>Contacto</dt><dd>{String(client?.phone ?? client?.email ?? "Sin contacto")}</dd></div><div><dt>Cantidad</dt><dd>{String(reservation.quantity)} unidad(es)</dd></div><div><dt>Total reservado</dt><dd>Bs {total.toFixed(2)}</dd></div><div><dt>Vencimiento</dt><dd>{new Intl.DateTimeFormat("es-BO", { dateStyle: "medium", timeStyle: "short", timeZone: timezone }).format(expiresAt)}</dd></div><div><dt>Stock físico</dt><dd>{String(product?.stock ?? 0)}</dd></div></dl>{expired ? <p className="cashier-reservation-expired">Este apartado venció; el cliente debe realizar uno nuevo.</p> : <CashierWorkflowWindow title={`Cobrar ${productName}`} description={`Comprobante para ${clientName}. El precio reservado es Bs ${total.toFixed(2)}.`} triggerLabel="Cobrar y entregar" triggerIcon={<ReceiptText />} size="large"><ReservationCollectForm reservationId={reservation.id} total={total} clientName={clientName} productName={productName} quantity={Number(reservation.quantity)} client={profile} visitHistory={visitHistory} barbers={barbers} busy={busy} onCollect={onCollect} /></CashierWorkflowWindow>}</article>;
  }) : <div className="cashier-empty-state"><PackageCheck/><strong>No hay productos apartados pendientes</strong><span>Los pedidos para retiro aparecerán aquí.</span></div>}</div></section>;
}

function ReservationCollectForm({ reservationId, total, clientName, productName, quantity, client, visitHistory, barbers, busy, onCollect }: { reservationId: string; total: number; clientName: string; productName: string; quantity: number; client: Row | null; visitHistory: Row[]; barbers: Row[]; busy: boolean; onCollect: (event: FormEvent<HTMLFormElement>, reservationId: string) => void }) {
  const [recommendedBy, setRecommendedBy] = useState("");
  const [paymentValid, setPaymentValid] = useState(false);
  const barberChoices = [{ value: "", label: "Sin peluquero asociado" }, ...barbers.map(barber => ({ value: barber.id, label: String(barber.display_name) }))];
  return <form className="admin-form cashier-reservation-checkout" onSubmit={event => onCollect(event, reservationId)}><div className="wide cashier-reservation-summary"><strong>{clientName}</strong><span>{productName} · {quantity} unidad(es) · Bs {total.toFixed(2)}</span></div>{client && <div className="wide"><CashierClientProfileCard client={client} visitHistory={visitHistory} /></div>}<ChoiceButtons name="recommended_by" label="Vendido o recomendado por" value={recommendedBy} onChange={setRecommendedBy} options={barberChoices} /><PaymentFields total={total} allowPromotion onValidityChange={setPaymentValid} /><button className="button button-dark wide" disabled={busy || !paymentValid}><ReceiptText /> Confirmar pago, entrega y comprobante</button></form>;
}

function DailyLedger({ movements, shift, operator, busy, onMovement, onClose, workDate, timezone }: { movements: Row[]; shift: Row; operator: string; busy: boolean; onMovement: (event: FormEvent<HTMLFormElement>) => void; onClose: (event: FormEvent<HTMLFormElement>) => void; workDate: string; timezone: string }) {
  const opening = Number(shift.opening_amount ?? 0);
  const income = movements.reduce((sum, item) => sum + Math.max(Number(item.amount), 0), 0);
  const expenses = movements.reduce((sum, item) => sum + Math.abs(Math.min(Number(item.amount), 0)), 0);
  const cash = opening + movements.filter(item => item.payment_method === "cash").reduce((sum, item) => sum + Number(item.amount), 0);
  const qr = movements.filter(item => item.payment_method === "qr").reduce((sum, item) => sum + Number(item.amount), 0);
  const registered = opening + income - expenses;
  return <section className="admin-panel cashier-ledger"><div className="cashier-print-header"><Brand linked={false} /><div><small>LIBRO DIARIO DE CAJA</small><strong>{workDate}</strong></div></div><div className="dash-list-head"><div><small>TURNO · {workDate}</small><h2>Movimientos del turno</h2></div><div className="dash-row-actions no-print"><button onClick={() => window.print()}><Printer /> Imprimir</button><CashierWorkflowWindow title="Registrar movimiento" description="Todo movimiento requiere una glosa clara." triggerLabel="Nuevo movimiento" variant="secondary"><MovementForm busy={busy} onSubmit={onMovement} /></CashierWorkflowWindow></div></div><div className="cashier-ledger-meta"><span>Operador: {operator}</span><span>Apertura: {new Intl.DateTimeFormat("es-BO", { dateStyle: "medium", timeStyle: "short", timeZone: timezone }).format(new Date(String(shift.opened_at)))}</span><span>Monto inicial: Bs {opening.toFixed(2)}</span></div><section className="cashier-ledger-summary" aria-label="Resumen del turno"><article><span>Ingresos</span><strong>Bs {income.toFixed(2)}</strong></article><article><span>Egresos</span><strong>Bs {expenses.toFixed(2)}</strong></article><article><span>Total efectivo</span><strong>Bs {cash.toFixed(2)}</strong></article><article><span>Total QR</span><strong>Bs {qr.toFixed(2)}</strong></article><article className="ledger-grand-total"><span>Total registrado</span><strong>Bs {registered.toFixed(2)}</strong></article></section><div className="cashier-ledger-table"><div className="ledger-row ledger-head"><span>Hora</span><span>Movimiento</span><span>Glosa</span><span>Método</span><span>Importe</span></div>{movements.length ? movements.map(item => <div className="ledger-row" key={item.id}><span>{new Intl.DateTimeFormat("es-BO", { timeStyle: "short", timeZone: timezone }).format(new Date(String(item.created_at)))}</span><span>{movementLabel(String(item.kind))}</span><span>{String(item.reason ?? "Sin glosa")}</span><span>{paymentLabel(String(item.payment_method))}</span><b>Bs {Number(item.amount).toFixed(2)}</b></div>) : <p className="admin-help">Aún no existen movimientos en este turno.</p>}</div><div className="cashier-ledger-signatures"><span>Firma cajero/a</span><span>Firma administrador/a</span></div><div className="cashier-close-action no-print"><CashierWorkflowWindow title="Cerrar y conciliar caja" description="Realiza esta acción al finalizar el turno." triggerLabel="Cerrar turno" variant="ghost"><form className="admin-form" onSubmit={onClose}><label className="wide">Efectivo contado Bs<input name="counted" type="number" min="0" step="0.5" required /></label><label className="wide">Glosa de cierre<input name="notes" required /></label><button className="button button-dark wide" disabled={busy}>Cerrar y conciliar</button></form></CashierWorkflowWindow></div></section>;
}

function MovementForm({ busy, onSubmit }: { busy: boolean; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  const [kind, setKind] = useState("income");
  const [method, setMethod] = useState("cash");
  return <form className="admin-form cashier-movement-form" onSubmit={onSubmit}>
    <ChoiceButtons name="kind" label="Tipo de movimiento" value={kind} onChange={setKind} options={[{ value: "income", label: "Ingreso" }, { value: "expense", label: "Egreso" }, { value: "adjustment", label: "Ajuste" }]} />
    <label>Monto Bs<input name="amount" type="number" min="0.5" step="0.5" required /></label>
    <ChoiceButtons name="method" label="Medio de pago" value={method} onChange={setMethod} options={[{ value: "cash", label: "Efectivo" }, { value: "qr", label: "QR" }, { value: "transfer", label: "Transferencia" }, { value: "card", label: "Tarjeta" }, { value: "other", label: "Otro" }]} />
    <label>Glosa<input name="reason" required placeholder="Concepto y responsable" /></label>
    <button className="button button-dark wide" disabled={busy}>Registrar en libro diario</button>
  </form>;
}
function movementLabel(kind: string) { return ({ sale: "Venta", income: "Ingreso", expense: "Egreso", refund: "Devolución", adjustment: "Ajuste" } as Record<string, string>)[kind] ?? kind; }
function paymentLabel(method: string) { return ({ cash: "Efectivo", qr: "QR", transfer: "Transferencia", card: "Tarjeta", other: "Otro" } as Record<string, string>)[method] ?? method; }

function Settlements({ barbers, payouts, pendingByBarber, workDate }: { barbers: Row[]; payouts: Row[]; pendingByBarber: Map<string, number>; workDate: string }) {
  const archivedPayouts = payouts.filter(payout => !barbers.some(barber => barber.id === payout.barber_id));
  const pendingTotal = [...pendingByBarber.values()].reduce((total, amount) => total + amount, 0);
  const paidCount = payouts.filter(payout => payout.status === "paid").length;
  const recordCount = barbers.length + archivedPayouts.length;
  return <section className="admin-panel cashier-team-panel">
    <div className="dash-list-head"><div><small>CIERRE DEL EQUIPO · {workDate}</small><h2>Cierre por peluquero</h2></div><Calculator /></div>
    <p className="admin-help">Revisa cada cuenta antes de preparar el pago. Los servicios se liquidan por jornada y el incentivo de ventas se agrega cuando Caja lo confirma.</p>
    <div className="cashier-settlement-overview"><article><span>Personas en el cierre</span><strong>{recordCount}</strong></article><article><span>Saldo pendiente</span><strong>Bs {pendingTotal.toFixed(2)}</strong></article><article><span>Pagadas hoy</span><strong>{paidCount}</strong></article></div>
    {recordCount ? <div className="cashier-settlement-summary">{barbers.map(barber => {
      const payout = payouts.find(item => item.barber_id === barber.id);
      const commission = pendingByBarber.get(barber.id) ?? Number(payout?.commission_amount ?? 0);
      return <article key={barber.id}><div><strong>{String(barber.display_name)}</strong><span>Saldo pendiente: Bs {commission.toFixed(2)}</span>{payout && <span className={`cashier-settlement-state ${String(payout.status)}`}>{payout.status === "paid" ? "Pagada" : "Preparada"} · Bs {Number(payout.total_amount).toFixed(2)}</span>}</div><Link className="cashier-detail-link" href={`/caja/liquidaciones/${barber.id}`}>Ver detalle <ArrowRight /></Link></article>;
    })}{archivedPayouts.map(payout => <article key={payout.id}><div><strong>{String((payout.barber_profiles as Row | null)?.display_name ?? payout.barber_name_snapshot ?? "Peluquero eliminado")}</strong><span>Comisiones: Bs {Number(payout.commission_amount).toFixed(2)} · Incentivos: Bs {Number(payout.incentive_amount).toFixed(2)}</span><span className={`cashier-settlement-state ${String(payout.status)}`}>{payout.status === "paid" ? "Pagada" : payout.status === "canceled" ? "Cancelada" : "Preparada"} · Bs {Number(payout.total_amount).toFixed(2)}</span></div><span>Registro histórico</span></article>)}</div> : <div className="cashier-empty-state"><Calculator/><strong>No hay liquidaciones para este cierre</strong><span>Los importes por peluquero se mostrarán cuando existan comisiones, incentivos o pagos registrados.</span></div>}
  </section>;
}

function SalesHistory({ sales, busy, onReverse, timezone }: { sales: Row[]; busy: boolean; onReverse: (event: FormEvent<HTMLFormElement>, id: string) => void; timezone: string }) {
  const [period, setPeriod] = useState<"today" | "week" | "month">("today");
  const today = businessDateKey(new Date(), timezone);
  const cutoff = new Date(`${today}T12:00:00Z`); cutoff.setUTCDate(cutoff.getUTCDate() - (period === "week" ? 6 : 29));
  const cutoffKey = cutoff.toISOString().slice(0, 10);
  const visible = sales.filter(sale => {
    const key = businessDateKey(new Date(String(sale.paid_at)), timezone);
    return period === "today" ? key === today : key >= cutoffKey && key <= today;
  });
  return <section className="admin-panel cashier-history"><div className="dash-list-head"><div><small>TRAZABILIDAD</small><h2>Ventas registradas</h2></div><History /></div><div className="cashier-history-filters" role="group" aria-label="Periodo del historial"><button className={period === "today" ? "active" : ""} onClick={() => setPeriod("today")}>Hoy</button><button className={period === "week" ? "active" : ""} onClick={() => setPeriod("week")}>7 días</button><button className={period === "month" ? "active" : ""} onClick={() => setPeriod("month")}>30 días</button></div><div className="admin-list">{visible.length ? visible.map(sale => {
    const receipt = Array.isArray(sale.receipts) ? sale.receipts[0] : sale.receipts as { id?: string; number?: number } | null;
    const paymentRows = Array.isArray(sale.payments) ? sale.payments as Row[] : sale.payments ? [sale.payments as Row] : [];
    const paymentSummary = paymentRows.map(payment => `${paymentLabel(String(payment.method ?? ""))} Bs ${Number(payment.amount ?? 0).toFixed(2)}`).join(" + ");
    const refunded = sale.status === "refunded";
    const items = Array.isArray(sale.sale_items) ? sale.sale_items as Row[] : [];
    return <article key={sale.id}><div><strong>{String((sale.profiles as { full_name?: string } | null)?.full_name ?? sale.guest_name ?? "Consumidor final")}</strong><span>{new Intl.DateTimeFormat("es-BO", { dateStyle: "short", timeStyle: "short", timeZone: timezone }).format(new Date(String(sale.paid_at)))} · {paymentSummary} · Bs {Number(sale.paid_total).toFixed(2)} · descuento Bs {Number(sale.discount_total).toFixed(2)}</span><small>{items.map(item => `${String(item.name_snapshot)} × ${String(item.quantity)}${item.barber_name_snapshot ? ` · ${String(item.barber_name_snapshot)}` : ""}`).join(" · ") || "Sin detalle de artículos"}</small>{refunded && <small className="cashier-refunded-label">Venta revertida · {String(sale.reversal_reason ?? "Motivo registrado en auditoría")}</small>}</div><div className="dash-row-actions">{receipt?.id && <Link href={`/comprobante/${receipt.id}?print=1`} target="_blank" rel="noreferrer"><Printer /> Imprimir #{String(receipt.number)}</Link>}{!refunded && <CashierWorkflowWindow title="Revertir venta" description="La devolución quedará registrada en Caja, puntos, comisiones y auditoría. La justificación es obligatoria." triggerLabel="Revertir" triggerIcon={<RotateCcw />} variant="ghost"><form className="admin-form" onSubmit={event => onReverse(event, sale.id)}><label className="wide">Justificación<textarea name="reason" minLength={5} maxLength={500} required placeholder="Explica por qué se devuelve o anula esta venta" /></label><button className="button button-dark wide" disabled={busy}>Confirmar reversión</button></form></CashierWorkflowWindow>}</div></article>;
  }) : <p className="admin-help">No hay ventas en el periodo seleccionado.</p>}</div></section>;
}
