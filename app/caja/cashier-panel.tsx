"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Calculator, CirclePlus, Gift, History, LockKeyhole, PackageCheck, PackageOpen, Printer, ReceiptText, RotateCcw, Scissors, ShoppingBag, Trash2, WalletCards } from "lucide-react";
import { Brand } from "@/components/brand";
import { CashierWorkflowWindow } from "./cashier-workflow-window";
import { clearFormErrors, dispatchDashboardError, dispatchDashboardSuccess, reportFormError } from "@/lib/form-feedback";
import { businessDateKey } from "@/lib/business-time";
import { publicMediaUrl } from "@/lib/public-media";
import { createClient } from "@/lib/supabase/client";
import { CashierDesktopNavigation, type CashierNavigationSection } from "./cashier-navigation";
import { CashierProductSaleForm, PaymentSplits, type PaymentLine, useCashierPromotionQuote } from "./cashier-product-sale-form";
import { CashierClientProfileCard } from "./cashier-client-profile";
import { CashierHeader } from "./cashier-header";

type Row = Record<string, unknown> & { id: string };
type RewardQuote = { reward_id: string; barber_id: string; barber_name: string; balance: number; reward_name: string; points_cost: number; eligible_base: number; discount_amount: number; service_line_key: string; service_name: string };
type RedemptionQuote = { code: string; clientId: string; fingerprint: string; valid: boolean; discount: number; message?: string };
type Capabilities = { isAdmin: boolean; isSuperadmin: boolean; isCashier: boolean; barber: { id: string; display_name: string } | null };
type CashierSection = Exclude<CashierNavigationSection, "reservas">;
type CashierRouteSection = CashierNavigationSection;
type Props = { userName: string; userEmail: string; capabilities: Capabilities; shift: Row | null; services: Row[]; barbers: Row[]; products: Row[]; clients: Row[]; appointments: Row[]; visitHistory: Row[]; sales: Row[]; earnings: Row[]; servicesToday: Record<string, number>; expenses: Row[]; payouts: Row[]; productReservations: Row[]; movements: Row[]; workDate: string; businessTimezone: string; section: CashierRouteSection };

export function CashierPanel(props: Props) {
  const { userEmail, capabilities, shift, services, barbers, products, clients, appointments, visitHistory, sales, earnings, servicesToday, payouts, productReservations, movements, workDate, businessTimezone, section } = props;
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
    let serviceLines: GroupedServiceLine[];
    try {
      serviceLines = JSON.parse(String(data.get("service_lines_payload") ?? "[]")) as GroupedServiceLine[];
    } catch {
      reportFormError(form, new Error("No se pudieron leer las atenciones. Revisa el cobro e inténtalo de nuevo."));
      return;
    }
    const paymentMethods = data.getAll("payment_method").map(String);
    const paymentAmounts = data.getAll("payment_amount").map(Number);
    const response = await call("register_counter_service_sale_v7_mixed", {
      target_appointment_id: String(data.get("appointment_id") ?? "") || null,
      target_client_id: String(data.get("client_id") ?? "") || null,
      guest_name: String(data.get("guest_name") ?? "") || null,
      guest_phone: String(data.get("guest_phone") ?? "") || null,
      service_lines: serviceLines.map(line => ({
        line_id: line.key,
        service_id: line.serviceId,
        barber_id: line.barberId,
        attendee_label: line.attendeeLabel,
        unit_price: line.unitPrice,
        charges: line.charges.map(charge => ({ line_id: charge.key, description: charge.description, amount: charge.amount, unit_price: charge.unitPrice })),
        products: line.products.map(product => ({ line_id: product.key, product_id: product.productId, quantity: product.quantity, unit_price: product.unitPrice })),
      })),
      custom_charges: [],
      product_lines: [],
      recommended_by_barber_id: null,
      payment_method: paymentMethods[0] ?? "cash",
      payment_reference: null,
      payment_splits: paymentMethods.map((method, index) => ({ method, amount: paymentAmounts[index] })),
      provided_referral_code: String(data.get("referral_code") ?? "") || null,
      selected_reward_id: String(data.get("selected_reward_id") ?? "") || null,
      selected_reward_barber_id: String(data.get("selected_reward_barber_id") ?? "") || null,
      selected_reward_service_line_key: String(data.get("selected_reward_service_line_key") ?? "") || null,
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
  const titles: Record<CashierSection, string> = { servicios: "Caja", productos: "Venta de productos", movimientos: "Libro diario", liquidaciones: "Liquidaciones diarias", historial: "Historial de ventas" };

  return <main className="admin-shell dash-workspace cashier-shell">
    <CashierHeader userName={props.userName} userEmail={userEmail} capabilities={capabilities} shiftOpen={Boolean(shift)} />
    <div className="admin-layout cashier-layout"><section className="cashier-content"><div className="cashier-toolbar"><CashierDesktopNavigation section={section} reservationCount={productReservations.length} /></div><div className="dash-page-heading"><div className="admin-title"><WalletCards /><div><p>TERMINAL POS</p><h1>{section === "reservas" ? "Reservas de productos" : titles[section]}</h1></div></div><span className={`dash-status-pill ${shift ? "online" : "offline"}`}><i />{shift ? "Turno abierto" : "Turno cerrado"}</span></div>
        {error && <p className="admin-error">{error}</p>}{result && <div className="admin-message"><strong>Operación completada.</strong>{"receipt_id" in result && <Link href={`/comprobante/${String(result.receipt_id)}`}> Ver comprobante #{String(result.receipt_number)}</Link>}{Boolean(result.claim_code) && <span> Código: <b>{String(result.claim_code)}</b></span>}</div>}
        {!shift ? <OpenShift onSubmit={open} busy={busy} /> : <>
          {section === "servicios" && <ServiceDashboard appointments={appointments} visitHistory={visitHistory} clients={clients} services={services} barbers={barbers} products={products} sales={sales} busy={busy} onSubmit={sell} />}
          {section === "productos" && <ProductDashboard products={products} barbers={barbers} clients={clients} visitHistory={visitHistory} busy={busy} onSubmit={sell} />}
          {section === "reservas" && <ReservationDashboard reservations={productReservations} barbers={barbers} visitHistory={visitHistory} busy={busy} onCollect={collectReservation} timezone={businessTimezone} />}
          {section === "movimientos" && <DailyLedger movements={movements} shift={shift} operator={userEmail} busy={busy} onMovement={movement} onClose={close} workDate={workDate} timezone={businessTimezone} />}
          {section === "liquidaciones" && <Settlements barbers={barbers} payouts={payouts} pendingByBarber={pendingByBarber} servicesToday={servicesToday} workDate={workDate} />}
          {section === "historial" && <SalesHistory sales={sales} busy={busy} onReverse={reverseSale} timezone={businessTimezone} />}
        </>}
      </section>
    </div>
  </main>;
}

function OpenShift({ onSubmit, busy }: { onSubmit: (event: FormEvent<HTMLFormElement>) => void; busy: boolean }) {
  return <section className="admin-panel cashier-welcome"><div className="cashier-orb"><LockKeyhole /></div><div className="cashier-welcome-copy"><p className="eyebrow">TERMINAL BLOQUEADA</p><h2>Abre un turno para comenzar.</h2><p>La apertura queda registrada en el libro diario. Los importes no se muestran en el dashboard operativo.</p></div><div className="cashier-welcome-action"><CashierWorkflowWindow title="Abrir turno" description="Registra el efectivo disponible al iniciar." triggerLabel="Abrir terminal" triggerIcon={<LockKeyhole />} size="compact"><form className="admin-form" onSubmit={onSubmit}><label>Monto inicial Bs<input name="opening" type="number" min="0" step="0.5" defaultValue="0" required /></label><label>Glosa de apertura<input name="notes" /></label><button className="button button-dark wide" disabled={busy}>Confirmar apertura</button></form></CashierWorkflowWindow></div></section>;
}

function ServiceDashboard({ appointments, visitHistory, clients, services, barbers, products, sales, busy, onSubmit }: { appointments: Row[]; visitHistory: Row[]; clients: Row[]; services: Row[]; barbers: Row[]; products: Row[]; sales: Row[]; busy: boolean; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  const stockUnits = products.reduce((total, product) => total + Number(product.stock ?? 0), 0);
  return <><div className="cashier-compact-status"><span><b>{appointments.length}</b> en cola</span><span><b>{sales.filter(sale => Boolean(sale.paid_at)).length}</b> procesadas</span></div>
    <section className="cashier-dashboard-tools" aria-label="Acciones de caja">
      <CashierWorkflowWindow title="Cobrar servicio" description="Atención sin reserva previa. Busca al cliente, añade servicios y define el pago." triggerLabel="Cobrar servicio" triggerIcon={<Scissors />} triggerClassName="cashier-tool-card cashier-tool-cobrar" triggerContent={<><span className="cashier-tool-icon"><Scissors /></span><span className="cashier-tool-copy"><small>Atención directa</small><strong>Cobrar servicio</strong><span>Cliente, servicios y formas de pago</span></span><span className="cashier-tool-action" aria-hidden="true"><ArrowRight /></span></>} size="window"><GroupedServiceSaleForm clients={clients} visitHistory={visitHistory} services={services} barbers={barbers} products={products} busy={busy} onSubmit={onSubmit} /></CashierWorkflowWindow>
      <Link href="/caja/productos" className="cashier-tool-card cashier-tool-products" aria-label="Vender productos">
        <span className="cashier-tool-icon"><ShoppingBag /></span><span className="cashier-tool-copy"><small>Punto de venta</small><strong>Vender productos</strong><span>{products.length} productos · {stockUnits} unidades disponibles</span></span><span className="cashier-tool-action" aria-hidden="true"><ArrowRight /></span>
      </Link>
    </section>
    <details className="admin-panel cashier-queue"><summary className="dash-list-head"><div><small>ACTUALIZACIÓN AUTOMÁTICA</small><h2>Cobros pendientes</h2></div><span className="cashier-queue-count">{appointments.length}</span><ReceiptText /></summary><p className="admin-help">Atenciones finalizadas que esperan revisión y pago.</p><div className="admin-list">{appointments.length ? appointments.map(appointment => <QueueItem key={appointment.id} appointment={appointment} clients={clients} visitHistory={visitHistory} services={services} barbers={barbers} products={products} busy={busy} onSubmit={onSubmit} />) : <p className="admin-help">No hay cobros pendientes. Puedes iniciar un cobro directo desde las tarjetas de arriba.</p>}</div></details></>;
}

function QueueItem({ appointment, clients, visitHistory, services, barbers, products, busy, onSubmit }: { appointment: Row; clients: Row[]; visitHistory: Row[]; services: Row[]; barbers: Row[]; products: Row[]; busy: boolean; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  const checkout = appointment.appointment_checkout_details as Row | Row[] | null;
  const details = Array.isArray(checkout) ? checkout[0] : checkout;
  const client = appointment.profiles as { full_name?: string } | null;
  const barber = appointment.barber_profiles as { display_name?: string } | null;
  return <article><div><strong>{client?.full_name ?? "Cliente"} · {String(appointment.service_name_snapshot)}</strong><span>{barber?.display_name ?? "Peluquero"}{details?.notes ? ` · ${String(details.notes)}` : ""}</span></div><CashierWorkflowWindow title={`Cobrar a ${client?.full_name ?? "cliente"}`} description="Puedes corregir el servicio y añadir extras antes de confirmar." triggerLabel="Revisar y cobrar" triggerIcon={<ReceiptText />} size="window"><GroupedServiceSaleForm appointment={appointment} checkout={details ?? null} clients={clients} visitHistory={visitHistory} services={services} barbers={barbers} products={products} busy={busy} onSubmit={onSubmit} /></CashierWorkflowWindow></article>;
}

function ClientFields({ clients, mode, onModeChange, onClientChange, visitHistory }: { clients: Row[]; mode: "new" | "existing"; onModeChange: (mode: "new" | "existing") => void; onClientChange: (id: string) => void; visitHistory: Row[] }) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Row | null>(null);
  const [results, setResults] = useState<Row[]>([]);
  const [searching, setSearching] = useState(false);
  const [referred, setReferred] = useState(false);

  useEffect(() => {
    if (mode !== "existing" || query.trim().length < 2 || selected) return;
    const search = query.trim().replace(/[%,_()]/g, " ");
    const normalized = search.toLocaleLowerCase("es");
    const localMatches = clients.filter(client => [client.full_name, client.email, client.phone].some(value => String(value ?? "").toLocaleLowerCase("es").includes(normalized))).slice(0, 8);
    let active = true;
    const timer = window.setTimeout(async () => {
      const pattern = `%${search}%`;
      const { data } = await createClient().from("profiles").select("id,full_name,email,phone,referral_code").eq("status", "active")
        .or(`full_name.ilike.${pattern},email.ilike.${pattern},phone.ilike.${pattern}`).order("full_name").limit(8);
      if (active) {
        setResults((data as Row[] | null) ?? localMatches);
        setSearching(false);
      }
    }, 120);
    return () => { active = false; window.clearTimeout(timer); };
  }, [clients, mode, query, selected]);

  function chooseMode(next: "new" | "existing") {
    onModeChange(next);
    onClientChange("");
    setQuery("");
    setSelected(null);
    setResults([]);
    setSearching(false);
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
  useEffect(() => {
    if (payments.length !== 1) return;
    const timer = window.setTimeout(() => setPayments(current => current.length === 1 ? [{ ...current[0], amount: payableTotal.toFixed(2) }] : current), 0);
    return () => window.clearTimeout(timer);
  }, [payments.length, payableTotal]);
  return <>{allowPromotion && <button type="button" className={`cashier-option-toggle ${promotion ? "active" : ""}`} aria-pressed={promotion} onClick={() => { setPromotion(value => !value); setPromotionCode(""); }}><Gift />{promotion ? "Quitar promoción" : "Aplicar promoción"}</button>}{promotion && <label className="wide">Código de promoción<input name="promotion_code" value={promotionCode} onChange={event => setPromotionCode(event.target.value)} autoCapitalize="characters" required />{promotionQuote.loading ? <small role="status">Validando código…</small> : promotionCode.trim() && !promotionQuote.valid ? <small role="alert">{promotionQuote.message ?? "Código no válido o agotado."}</small> : promotionQuote.valid ? <small className="cashier-promotion-valid">Descuento aplicado: Bs {promotionQuote.discount.toFixed(2)}</small> : null}</label>}{!promotion && <input type="hidden" name="promotion_code" value="" />}<PaymentSplits total={payableTotal} onValidityChange={setSplitValid} payments={payments} setPayments={setPayments} />{promotion && promotionQuote.valid && <p className="cashier-promotion-valid wide">Total con promoción: Bs {payableTotal.toFixed(2)}</p>}</>;
}

type CashierChoice = { value: string; label: string; caption?: string };
function ChoiceButtons({ name, label, value, options, onChange, className = "", popup = false }: { name: string; label: string; value: string; options: CashierChoice[]; onChange: (value: string) => void; className?: string; popup?: boolean }) {
  const selected = options.find(option => option.value === value);
  return <div className={`cashier-choice-field ${className} ${popup ? "cashier-choice-popup" : ""}`}>
    <span>{label}</span><input type="hidden" name={name} value={value} />
    {popup ? <details className="cashier-choice-menu"><summary aria-label={`${label}: ${selected?.label ?? "Seleccionar"}`}><span><strong>{selected?.label ?? `Seleccionar ${label.toLocaleLowerCase("es")}`}</strong>{selected?.caption && <small>{selected.caption}</small>}</span></summary><div className="cashier-choice-options" role="group" aria-label={label}>{options.map(option => <button type="button" key={option.value} aria-pressed={value === option.value} className={value === option.value ? "active" : ""} onClick={event => { onChange(option.value); const menu = event.currentTarget.closest("details"); if (menu) menu.open = false; }}><strong>{option.label}</strong>{option.caption && <small>{option.caption}</small>}</button>)}</div></details>
      : <div className="cashier-choice-buttons" role="group" aria-label={label}>{options.map(option => <button type="button" key={option.value} aria-pressed={value === option.value} className={value === option.value ? "active" : ""} onClick={() => onChange(option.value)}><strong>{option.label}</strong>{option.caption && <small>{option.caption}</small>}</button>)}</div>}
  </div>;
}

type ServiceLine = { key: string; serviceId: string; barberId: string; attendeeLabel: string };
type GroupedCharge = { key: string; description: string; amount: string; unitPrice: number };
type GroupedProduct = { key: string; productId: string; quantity: number; unitPrice: number };
type GroupedServiceLine = { key: string; serviceId: string; barberId: string; attendeeLabel: string; charges: GroupedCharge[]; products: GroupedProduct[]; unitPrice: number };

function useCashierRedemptionQuote(code: string, clientId: string, serviceLines: ServiceLine[]) {
  const [quote, setQuote] = useState<RedemptionQuote | null>(null);
  const [loading, setLoading] = useState(false);
  const normalizedCode = code.trim().toLocaleUpperCase("es");
  const fingerprint = JSON.stringify(serviceLines.map(line => ({ service_id: line.serviceId, barber_id: line.barberId })));
  useEffect(() => {
    if (!normalizedCode || !clientId || serviceLines.some(line => !line.serviceId || !line.barberId)) return;
    let active = true;
    const timer = window.setTimeout(async () => {
      setLoading(true);
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

function GroupedServiceSaleForm({ appointment, checkout, clients, visitHistory, services, barbers, products, busy, onSubmit }: { appointment?: Row; checkout?: Row | null; clients: Row[]; visitHistory: Row[]; services: Row[]; barbers: Row[]; products: Row[]; busy: boolean; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  const [customerMode, setCustomerMode] = useState<"new" | "existing">("new");
  const [clientId, setClientId] = useState(String(appointment?.client_id ?? ""));
  const [serviceLines, setServiceLines] = useState<GroupedServiceLine[]>(() => {
    const primary: GroupedServiceLine = {
      key: "primary",
      serviceId: String(checkout?.actual_service_id ?? appointment?.service_id ?? ""),
      barberId: String(appointment?.barber_id ?? ""),
      attendeeLabel: "Titular",
      charges: [],
      products: checkout?.suggested_product_id ? [{ key: "suggested-product", productId: String(checkout.suggested_product_id), quantity: Number(checkout.product_quantity ?? 1), unitPrice: 0 }] : [],
      unitPrice: 0,
    };
    return checkout?.extra_service_id ? [primary, { key: "checkout-extra", serviceId: String(checkout.extra_service_id), barberId: primary.barberId, attendeeLabel: "Titular", charges: [], products: [], unitPrice: 0 }] : [primary];
  });
  const [benefitMode, setBenefitMode] = useState<"none" | "manual" | "points" | "promotion" | "code" | "frequent">("none");
  const [benefitOpen, setBenefitOpen] = useState(false);
  const [manualPrices, setManualPrices] = useState<Record<string, string>>({});
  const [productChoices, setProductChoices] = useState<Record<string, string>>({});
  const [rewardQuotes, setRewardQuotes] = useState<RewardQuote[]>([]);
  const [quotedFingerprint, setQuotedFingerprint] = useState("");
  const [selectedReward, setSelectedReward] = useState("");
  const [promotionCode, setPromotionCode] = useState("");
  const [redemptionCode, setRedemptionCode] = useState("");
  const [paymentValid, setPaymentValid] = useState(false);
  const [checkoutKey] = useState(() => typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `checkout-${Date.now()}-${Math.random()}`);

  const quoteLinesPayload = JSON.stringify(serviceLines.map(line => ({ key: line.key, service_id: line.serviceId, barber_id: line.barberId, attendee_label: line.attendeeLabel })));
  const quoteFingerprint = `${clientId}:${quoteLinesPayload}`;
  useEffect(() => {
    const quoteLines = JSON.parse(quoteLinesPayload) as Array<{ key: string; service_id: string; barber_id: string }>;
    if (!clientId || quoteLines.some(line => !line.service_id || !line.barber_id)) return;
    let active = true;
    const timer = window.setTimeout(async () => {
      const supabase = createClient();
      const results = await Promise.all(quoteLines.map(async line => {
        const { data } = await supabase.rpc("cashier_quote_loyalty", { target_client_id: clientId, service_lines: [{ service_id: line.service_id, barber_id: line.barber_id }] });
        const serviceName = String(services.find(service => service.id === line.service_id)?.name ?? "Servicio");
        return ((data as RewardQuote[] | null) ?? []).map(quote => ({ ...quote, service_line_key: line.key, service_name: serviceName }));
      }));
      if (!active) return;
      const quotes = results.flat().filter(item => [50, 100].includes(item.points_cost) && item.balance > 50 && item.balance >= item.points_cost);
      const getRewardKey = (item: RewardQuote) => `${item.reward_id}:${item.barber_id}:${item.service_line_key ?? ""}`;
      setRewardQuotes(quotes);
      setQuotedFingerprint(quoteFingerprint);
      setSelectedReward(current => quotes.some(item => getRewardKey(item) === current) ? current : (quotes[0] ? getRewardKey(quotes[0]) : ""));
    }, 250);
    return () => { active = false; window.clearTimeout(timer); };
  }, [clientId, quoteFingerprint, quoteLinesPayload, services]);

  const serviceOptions = services.map(service => ({ value: service.id, label: String(service.name), caption: `Bs ${Number(service.price).toFixed(2)}` }));
  const barberOptions = barbers.map(barber => ({ value: barber.id, label: String(barber.display_name), caption: `${Number(barber.commission_percent ?? 0)}% comisión` }));
  const rewardKey = (item: RewardQuote) => `${item.reward_id}:${item.barber_id}:${item.service_line_key ?? ""}`;
  const pointsRewards = clientId && quotedFingerprint === quoteFingerprint ? rewardQuotes : [];
  const chosenQuote = pointsRewards.find(item => rewardKey(item) === selectedReward);
  const quoteLines = useMemo(() => (JSON.parse(quoteLinesPayload) as Array<{ key: string; service_id: string; barber_id: string; attendee_label: string }>).map(line => ({ key: line.key, serviceId: line.service_id, barberId: line.barber_id, attendeeLabel: line.attendee_label })), [quoteLinesPayload]);
  const redemptionQuote = useCashierRedemptionQuote(benefitMode === "code" ? redemptionCode : "", clientId, quoteLines);
  const chargeableLines = serviceLines.flatMap((line, serviceIndex) => {
    const service = services.find(item => item.id === line.serviceId);
    const entries: Array<{ key: string; label: string; detail: string; base: number; quantity: number }> = [];
    if (service) entries.push({ key: `service:${line.key}`, label: String(service.name), detail: `Servicio ${serviceIndex + 1} · ${String(barbers.find(item => item.id === line.barberId)?.display_name ?? "Peluquero")}`, base: Number(service.price), quantity: 1 });
    line.charges.forEach(charge => entries.push({ key: `charge:${charge.key}`, label: charge.description || "Cargo imprevisto", detail: `Atención ${serviceIndex + 1} · adicional`, base: Number(charge.amount) || 0, quantity: 1 }));
    line.products.forEach(item => {
      const product = products.find(row => row.id === item.productId);
      if (product) entries.push({ key: `product:${item.key}`, label: String(product.name), detail: `Atención ${serviceIndex + 1} · ${item.quantity} unidad(es)`, base: Number(product.price), quantity: item.quantity });
    });
    return entries;
  });
  const checkoutSubtotal = chargeableLines.reduce((total, item) => total + item.base * item.quantity, 0);
  const productUnits = serviceLines.reduce((total, line) => total + line.products.reduce((subtotal, item) => subtotal + item.quantity, 0), 0);
  const manuallyAdjustedTotal = chargeableLines.reduce((total, item) => {
    const requested = manualPrices[item.key] === undefined ? item.base : Number(manualPrices[item.key]);
    return total + Math.max(0, Math.min(item.base, Number.isFinite(requested) ? requested : item.base)) * item.quantity;
  }, 0);
  const manualLineDiscount = Math.max(0, checkoutSubtotal - manuallyAdjustedTotal);
  const now = new Date();
  const monthlyVisits = visitHistory.filter(item => {
    const date = new Date(String(item.starts_at));
    return String(item.client_id ?? "") === clientId && date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
  });
  const promotionQuote = useCashierPromotionQuote(benefitMode === "promotion" ? promotionCode : "", checkoutSubtotal);
  const frequentDiscount = benefitMode === "frequent" && monthlyVisits.length > 0 ? Math.min(5, checkoutSubtotal) : 0;
  const estimatedTotal = benefitMode === "manual" ? manuallyAdjustedTotal : benefitMode === "promotion" ? promotionQuote.total : Math.max(0, checkoutSubtotal - frequentDiscount - (benefitMode === "points" ? Number(chosenQuote?.discount_amount ?? 0) : 0) - (benefitMode === "code" ? redemptionQuote.discount : 0));
  const appointmentProfile = appointment && clientId ? (clients.find(client => client.id === clientId) ?? { id: clientId, ...(appointment.profiles as Record<string, unknown> | null) }) as Row : null;
  const payloadLines = serviceLines.map(line => {
    const servicePrice = Number(services.find(item => item.id === line.serviceId)?.price ?? 0);
    const safePrice = (key: string, base: number) => {
      if (benefitMode !== "manual") return base;
      const requested = manualPrices[key] === undefined ? base : Number(manualPrices[key]);
      return Math.max(0, Math.min(base, Number.isFinite(requested) ? requested : base));
    };
    return {
      ...line,
      unitPrice: safePrice(`service:${line.key}`, servicePrice),
      charges: line.charges.map(charge => ({ ...charge, unitPrice: safePrice(`charge:${charge.key}`, Number(charge.amount) || 0) })),
      products: line.products.map(item => ({ ...item, unitPrice: safePrice(`product:${item.key}`, Number(products.find(product => product.id === item.productId)?.price ?? 0)) })),
    };
  });
  const malformedLines = productUnits > 100 || serviceLines.some(line => !line.serviceId || !line.barberId || line.charges.length > 10 || line.charges.some(charge => charge.description.trim().length < 3 || Number(charge.amount) <= 0) || line.products.some(item => !item.productId || item.quantity < 1 || item.quantity > Number(products.find(product => product.id === item.productId)?.stock ?? 0)));
  const discountLabel = benefitMode === "manual" ? "Ajuste manual" : benefitMode === "frequent" ? "Cliente frecuente" : benefitMode === "points" ? `Canje · ${chosenQuote?.points_cost ?? "—"} puntos` : benefitMode === "promotion" ? "Promoción" : benefitMode === "code" ? "Canje" : "";
  const discountAmount = benefitMode === "manual" ? manualLineDiscount : benefitMode === "frequent" ? frequentDiscount : benefitMode === "points" ? Number(chosenQuote?.discount_amount ?? 0) : benefitMode === "promotion" ? promotionQuote.discount : benefitMode === "code" ? redemptionQuote.discount : 0;
  const selectBenefit = (mode: typeof benefitMode) => { setBenefitMode(mode); setPromotionCode(""); setRedemptionCode(""); };

  return <form className="admin-form cashier-service-checkout" onSubmit={onSubmit}>
    <input type="hidden" name="sale_kind" value="service" />
    <input type="hidden" name="appointment_id" value={appointment?.id ?? ""} />
    <input type="hidden" name="checkout_idempotency_key" value={checkoutKey} />
    <input type="hidden" name="service_lines_payload" value={JSON.stringify(payloadLines)} />
    <input type="hidden" name="selected_reward_id" value={benefitMode === "points" ? chosenQuote?.reward_id ?? "" : ""} />
    <input type="hidden" name="selected_reward_barber_id" value={benefitMode === "points" ? chosenQuote?.barber_id ?? "" : ""} />
    <input type="hidden" name="selected_reward_service_line_key" value={benefitMode === "points" ? chosenQuote?.service_line_key ?? "" : ""} />
    <input type="hidden" name="redemption_code" value={benefitMode === "code" ? redemptionCode : ""} />
    <input type="hidden" name="promotion_code" value={benefitMode === "promotion" ? promotionCode : ""} />
    <input type="hidden" name="manual_discount" value={benefitMode === "frequent" ? frequentDiscount : 0} />
    <div className="cashier-service-details">
      {!appointment && <ClientFields clients={clients} visitHistory={visitHistory} mode={customerMode} onModeChange={mode => { setCustomerMode(mode); setBenefitMode("none"); }} onClientChange={setClientId} />}
      {appointmentProfile && <div className="wide"><CashierClientProfileCard client={appointmentProfile} visitHistory={visitHistory} /></div>}
      <fieldset className="wide cashier-line-group cashier-attention-group"><legend>Atenciones</legend>
        <div className="cashier-attention-list">{serviceLines.map((line, index) => {
          const service = services.find(item => item.id === line.serviceId);
          return <article className="cashier-attention-card" key={line.key}>
            <header className="cashier-attention-heading"><strong>Atención {index + 1}</strong>{service && <span>Bs {Number(service.price).toFixed(2)}</span>}{serviceLines.length > 1 && <button type="button" className="cashier-icon-remove" aria-label={`Quitar atención ${index + 1}`} onClick={() => setServiceLines(lines => lines.filter(item => item.key !== line.key))}><Trash2 /></button>}</header>
            <div className="cashier-attention-fields">
              {index > 0 && <ChoiceButtons name="line_attendee_label" label="Persona atendida" value={line.attendeeLabel} onChange={value => setServiceLines(lines => lines.map(item => item.key === line.key ? { ...item, attendeeLabel: value } : item))} options={[{ value: "Titular", label: "Titular" }, { value: "Hijo/a", label: "Hijo/a" }, { value: "Acompañante", label: "Acompañante" }]} />}
              <ChoiceButtons name="line_service_id" label="Servicio" value={line.serviceId} onChange={value => setServiceLines(lines => lines.map(item => item.key === line.key ? { ...item, serviceId: value } : item))} options={serviceOptions} className="cashier-service-choice" popup />
              <ChoiceButtons name="line_barber_id" label="Peluquero" value={line.barberId} onChange={value => setServiceLines(lines => lines.map(item => item.key === line.key ? { ...item, barberId: value } : item))} options={barberOptions} className="cashier-barber-choice" popup />
            </div>
            {line.charges.length > 0 && <div className="cashier-attention-extras"><div className="cashier-subsection-label">Cargos de esta atención</div>{line.charges.map((charge, chargeIndex) => <div className="cashier-extra-row" key={charge.key}><label><span>Detalle {chargeIndex + 1}</span><input value={charge.description} onChange={event => setServiceLines(lines => lines.map(item => item.key === line.key ? { ...item, charges: item.charges.map(row => row.key === charge.key ? { ...row, description: event.target.value } : row) } : item))} required minLength={3} maxLength={160} placeholder="Ej. Diseño o tratamiento adicional" /></label><label className="cashier-extra-amount"><span>Monto Bs</span><input type="number" min="0.5" step="0.01" value={charge.amount} onChange={event => setServiceLines(lines => lines.map(item => item.key === line.key ? { ...item, charges: item.charges.map(row => row.key === charge.key ? { ...row, amount: event.target.value } : row) } : item))} required /></label><button type="button" className="cashier-icon-remove" aria-label="Quitar cargo" onClick={() => setServiceLines(lines => lines.map(item => item.key === line.key ? { ...item, charges: item.charges.filter(row => row.key !== charge.key) } : item))}><Trash2 /></button></div>)}</div>}
            <div className="cashier-attention-tools">
              <button type="button" className="cashier-inline-action" disabled={line.charges.length >= 10} onClick={() => setServiceLines(lines => lines.map(item => item.key === line.key ? { ...item, charges: [...item.charges, { key: `charge-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, description: "", amount: "", unitPrice: 0 }] } : item))}><CirclePlus /> Cargo imprevisto</button>
              <div className="cashier-product-adder"><select aria-label={`Producto para atención ${index + 1}`} value={productChoices[line.key] ?? ""} onChange={event => setProductChoices(current => ({ ...current, [line.key]: event.target.value }))}><option value="">Añadir producto…</option>{products.map(product => <option key={product.id} value={product.id}>{String(product.name)}{product.brand ? ` · ${String(product.brand)}` : ""} · Bs {Number(product.price).toFixed(2)}</option>)}</select><button type="button" disabled={!productChoices[line.key] || productUnits >= 100} onClick={() => {
                const productId = productChoices[line.key];
                  const product = products.find(item => item.id === productId);
                  if (!product || productUnits >= 100) return;
                setServiceLines(lines => lines.map(item => {
                  if (item.key !== line.key) return item;
                  const existing = item.products.find(row => row.productId === productId);
                  if (existing) return { ...item, products: item.products.map(row => row.productId === productId ? { ...row, quantity: Math.min(row.quantity + 1, Number(product.stock ?? 0)) } : row) };
                  return { ...item, products: [...item.products, { key: `product-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, productId, quantity: 1, unitPrice: Number(product.price) }] };
                }));
                setProductChoices(current => ({ ...current, [line.key]: "" }));
              }}><PackageOpen /> Añadir</button></div>
            </div>
            {line.products.length > 0 && <div className="cashier-attention-products"><div className="cashier-subsection-label">Productos en esta atención</div>{line.products.map(item => {
              const product = products.find(row => row.id === item.productId);
              if (!product) return null;
              return <div className="cashier-attention-product" key={item.key}><span><strong>{String(product.name)}</strong><small>{[product.brand, product.presentation].filter(Boolean).map(String).join(" · ")} · Bs {Number(product.price).toFixed(2)}</small></span><div className="cashier-product-stepper"><button type="button" aria-label="Quitar unidad" disabled={item.quantity <= 1} onClick={() => setServiceLines(lines => lines.map(entry => entry.key === line.key ? { ...entry, products: entry.products.map(row => row.key === item.key ? { ...row, quantity: Math.max(1, row.quantity - 1) } : row) } : entry))}>−</button><b>{item.quantity}</b><button type="button" aria-label="Agregar unidad" disabled={item.quantity >= Number(product.stock ?? 0) || productUnits >= 100} onClick={() => setServiceLines(lines => lines.map(entry => entry.key === line.key ? { ...entry, products: entry.products.map(row => row.key === item.key ? { ...row, quantity: Math.min(Number(product.stock ?? 0), row.quantity + 1) } : row) } : entry))}>+</button></div><b>Bs {(Number(product.price) * item.quantity).toFixed(2)}</b><button type="button" className="cashier-icon-remove" aria-label={`Quitar ${String(product.name)}`} onClick={() => setServiceLines(lines => lines.map(entry => entry.key === line.key ? { ...entry, products: entry.products.filter(row => row.key !== item.key) } : entry))}><Trash2 /></button></div>;
            })}</div>}
          </article>;
        })}</div>
        <button type="button" className="cashier-add-line" disabled={serviceLines.length >= 12} onClick={() => setServiceLines(lines => [...lines, { key: `service-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, serviceId: "", barberId: lines.at(-1)?.barberId ?? "", attendeeLabel: "Hijo/a", charges: [], products: [], unitPrice: 0 }])}><CirclePlus /> Agregar otra atención</button>
      </fieldset>
    </div>
    <aside className="cashier-service-payment">
      <div className="cashier-total-preview"><span>Subtotal <b>Bs {checkoutSubtotal.toFixed(2)}</b></span>{discountAmount > 0 && <span>{discountLabel}<b>− Bs {discountAmount.toFixed(2)}</b></span>}<strong>Total a cobrar <b>Bs {estimatedTotal.toFixed(2)}</b></strong></div>
      <div className="cashier-benefit-area">
        <button type="button" className={`cashier-benefit-trigger ${benefitMode !== "none" ? "active" : ""}`} aria-expanded={benefitOpen} onClick={() => setBenefitOpen(open => !open)}><Gift /><span><strong>Beneficios y descuentos</strong><small>{benefitMode === "none" ? "Opcional · elegir una opción" : discountLabel}</small></span><span>{benefitOpen ? "Cerrar" : "Abrir"}</span></button>
        {benefitOpen && <section className="cashier-benefit-panel" aria-label="Beneficios y descuentos">
          <div className="cashier-benefit-modes" role="group" aria-label="Tipo de descuento">
            <button type="button" aria-pressed={benefitMode === "manual"} className={benefitMode === "manual" ? "active" : ""} onClick={() => selectBenefit("manual")}>Manual</button>
            {pointsRewards.length > 0 && <button type="button" aria-pressed={benefitMode === "points"} className={`cashier-points-option ${benefitMode === "points" ? "active" : ""}`} onClick={() => { selectBenefit("points"); setSelectedReward(rewardKey(pointsRewards[0])); }}><Gift /> Puntos</button>}
            <button type="button" aria-pressed={benefitMode === "promotion"} className={benefitMode === "promotion" ? "active" : ""} onClick={() => selectBenefit("promotion")}>Promoción</button>
            <button type="button" aria-pressed={benefitMode === "code"} className={benefitMode === "code" ? "active" : ""} onClick={() => selectBenefit("code")}>Canje</button>
            {clientId && monthlyVisits.length > 0 && <button type="button" aria-pressed={benefitMode === "frequent"} className={benefitMode === "frequent" ? "active" : ""} onClick={() => selectBenefit("frequent")}>Frecuente</button>}
          </div>
          {benefitMode === "manual" && <div className="cashier-manual-price-list">{chargeableLines.map(item => <label key={item.key}><span><strong>{item.label}</strong><small>{item.detail} · {item.quantity > 1 ? `${item.quantity} × ` : ""}Bs {item.base.toFixed(2)}</small></span><span className="cashier-manual-price"><small>Bs</small><input aria-label={`Nuevo precio para ${item.label}`} type="number" min="0" max={item.base} step="0.01" required value={manualPrices[item.key] ?? item.base.toFixed(2)} onChange={event => setManualPrices(current => ({ ...current, [item.key]: event.target.value }))} /></span></label>)}<p>Descuento manual <strong>− Bs {manualLineDiscount.toFixed(2)}</strong></p></div>}
          {benefitMode === "points" && <div className="cashier-reward-options">{pointsRewards.map(reward => <label className={selectedReward === rewardKey(reward) ? "selected" : ""} key={rewardKey(reward)}><input type="radio" name="reward_choice" checked={selectedReward === rewardKey(reward)} onChange={() => setSelectedReward(rewardKey(reward))} /><span><strong>{reward.points_cost === 50 ? "50% de un servicio" : "100% de un servicio"}</strong><small>{reward.service_name} · {reward.barber_name} · quedan {reward.balance - reward.points_cost} puntos</small></span><b>− Bs {Number(reward.discount_amount).toFixed(2)}</b></label>)}</div>}
          {benefitMode === "promotion" && <label className="cashier-benefit-code">Código de promoción<input name="promotion_code_input" value={promotionCode} onChange={event => setPromotionCode(event.target.value)} autoCapitalize="characters" required />{promotionQuote.loading ? <small role="status">Validando código…</small> : promotionCode.trim() && !promotionQuote.valid ? <small role="alert">{promotionQuote.message ?? "Código no válido o agotado."}</small> : promotionQuote.valid ? <small className="cashier-promotion-valid">Descuento: Bs {promotionQuote.discount.toFixed(2)}</small> : null}</label>}
          {benefitMode === "code" && <label className="cashier-benefit-code">Código de canje<input name="redemption_code_input" value={redemptionCode} onChange={event => setRedemptionCode(event.target.value)} autoCapitalize="characters" required />{redemptionQuote.loading ? <small role="status">Validando canje…</small> : redemptionCode.trim() && !redemptionQuote.valid ? <small role="alert">{redemptionQuote.message ?? "Canje no válido, vencido o sin servicios elegibles."}</small> : redemptionQuote.valid ? <small className="cashier-promotion-valid">Descuento: Bs {redemptionQuote.discount.toFixed(2)}</small> : null}</label>}
          {benefitMode === "frequent" && <p className="cashier-benefit-note">Descuento de cliente frecuente: Bs {frequentDiscount.toFixed(2)}</p>}
        </section>}
      </div>
      <PaymentFields total={estimatedTotal} onValidityChange={setPaymentValid} />
      <button className="button button-dark wide" disabled={busy || !paymentValid || (benefitMode === "promotion" && (promotionQuote.loading || !promotionQuote.valid)) || (benefitMode === "code" && (redemptionQuote.loading || !redemptionQuote.valid)) || malformedLines || (benefitMode === "points" && !chosenQuote)}><ReceiptText /> Confirmar pago · Bs {estimatedTotal.toFixed(2)}</button>
    </aside>
  </form>;
}

function ProductDashboard({ products, barbers, clients, visitHistory, busy, onSubmit }: { products: Row[]; barbers: Row[]; clients: Row[]; visitHistory: Row[]; busy: boolean; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  return products.length
    ? <div className="cashier-product-workspace"><CashierProductSaleForm products={products} barbers={barbers} clients={clients} visitHistory={visitHistory} busy={busy} onSubmit={onSubmit} /></div>
    : <section className="admin-panel cashier-inline-empty"><PackageOpen /><strong>No hay productos disponibles para vender</strong><span>Revisa el inventario con Administración y vuelve a Caja cuando haya existencias.</span></section>;
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
    <ChoiceButtons name="method" label="Medio de pago" value={method} onChange={setMethod} options={[{ value: "cash", label: "Efectivo" }, { value: "qr", label: "QR" }]} />
    <label>Glosa<input name="reason" required placeholder="Concepto y responsable" /></label>
    <button className="button button-dark wide" disabled={busy}>Registrar en libro diario</button>
  </form>;
}
function movementLabel(kind: string) { return ({ sale: "Venta", income: "Ingreso", expense: "Egreso", refund: "Devolución", adjustment: "Ajuste" } as Record<string, string>)[kind] ?? kind; }
function paymentLabel(method: string) { return ({ cash: "Efectivo", qr: "QR" } as Record<string, string>)[method] ?? method; }

function Settlements({ barbers, payouts, pendingByBarber, servicesToday, workDate }: { barbers: Row[]; payouts: Row[]; pendingByBarber: Map<string, number>; servicesToday: Record<string, number>; workDate: string }) {
  const archivedPayouts = payouts.filter(payout => !barbers.some(barber => barber.id === payout.barber_id));
  const preparedTotal = payouts.filter(payout => payout.status === "approved").reduce((total, payout) => total + Number(payout.commission_amount ?? 0), 0);
  const pendingTotal = [...pendingByBarber.values()].reduce((total, amount) => total + amount, 0) + preparedTotal;
  const paidCount = payouts.filter(payout => payout.status === "paid").length;
  const recordCount = barbers.length + archivedPayouts.length;
  return <section className="admin-panel cashier-team-panel">
    <div className="dash-list-head"><div><small>CIERRE DEL EQUIPO · {workDate}</small><h2>Cierre por peluquero</h2></div><Calculator /></div>
    <p className="admin-help">Actividad de hoy y comisiones de servicios pendientes para liquidar.</p>
    <div className="cashier-settlement-overview"><article><span>Personas en el cierre</span><strong>{recordCount}</strong></article><article><span>Saldo pendiente</span><strong>Bs {pendingTotal.toFixed(2)}</strong></article><article><span>Pagadas hoy</span><strong>{paidCount}</strong></article></div>
    {recordCount ? <><div className="cashier-barber-grid">{barbers.map(barber => {
      const payout = payouts.find(item => item.barber_id === barber.id);
      const preparedCommission = payouts.filter(item => item.barber_id === barber.id && item.status === "approved").reduce((total, item) => total + Number(item.commission_amount ?? 0), 0);
      const commission = (pendingByBarber.get(barber.id) ?? 0) + preparedCommission;
      const name = String(barber.display_name ?? "Peluquero");
      const imageUrl = publicMediaUrl(String(barber.photo_path ?? ""));
      const specialties = Array.isArray(barber.specialties) ? barber.specialties.map(String).filter(Boolean).join(" · ") : "";
      const initials = name.trim().split(/\s+/).slice(0, 2).map(part => part[0]).join("").toLocaleUpperCase("es");
      return <Link key={barber.id} className="cashier-barber-card" href={`/caja/liquidaciones/${barber.id}`} aria-label={`Ver liquidación de ${name}`}>
        <span className="cashier-barber-portrait">{imageUrl ? <Image src={imageUrl} alt={`Foto de ${name}`} width={68} height={68} unoptimized /> : <b>{initials}</b>}</span>
        <span className="cashier-barber-identity"><strong>{name}</strong><small>{specialties || String(barber.bio ?? "Equipo Legend Club")}</small><i>Comisión por servicio · {Number(barber.commission_percent ?? 0)}%</i></span>
        <span className="cashier-barber-metrics"><span><small>Servicios hoy</small><b>{servicesToday[barber.id] ?? 0}</b></span><span><small>Por liquidar</small><b>Bs {commission.toFixed(2)}</b></span></span>
        {payout && <span className={`cashier-settlement-state ${String(payout.status)}`}>{payout.status === "paid" ? "Pagada hoy" : "Liquidación preparada"} · Bs {Number(payout.total_amount).toFixed(2)}</span>}
        <span className="cashier-barber-link">Ver liquidación <ArrowRight /></span>
      </Link>;
    })}</div>{archivedPayouts.length > 0 && <div className="cashier-archived-payouts">{archivedPayouts.map(payout => <article key={payout.id}><strong>{String((payout.barber_profiles as Row | null)?.display_name ?? payout.barber_name_snapshot ?? "Peluquero eliminado")}</strong><span>Registro histórico · Bs {Number(payout.total_amount).toFixed(2)}</span><small>{payout.status === "paid" ? "Pagada" : payout.status === "canceled" ? "Cancelada" : "Preparada"}</small></article>)}</div>}</> : <div className="cashier-empty-state"><Calculator/><strong>No hay liquidaciones para este cierre</strong><span>Los perfiles y saldos aparecerán cuando haya peluqueros activos o pagos registrados.</span></div>}
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
