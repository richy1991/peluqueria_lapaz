"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Calculator, CirclePlus, ClipboardCheck, Gift, History, LockKeyhole, PackageCheck, PackageOpen, Printer, ReceiptText, RotateCcw, Scissors, Sparkles, Trash2, WalletCards } from "lucide-react";
import { Brand } from "@/components/brand";
import { DashboardModal } from "@/components/dashboard-modal";
import { ModeSwitcher } from "@/components/mode-switcher";
import { PanelMobileLogout, PanelMobileMenuButton, PanelMobileScrim, PanelMobileSidebarClose, PanelResponsiveSidebar, PanelThemeSelector } from "@/components/panel-experience";
import { clearFormErrors, dispatchDashboardError, dispatchDashboardSuccess, reportFormError } from "@/lib/form-feedback";
import { createClient } from "@/lib/supabase/client";
import { CashierMobileNavigation, type CashierNavigationSection } from "./cashier-navigation";

type Row = Record<string, unknown> & { id: string };
type RewardQuote = { reward_id: string; barber_id: string; barber_name: string; balance: number; reward_name: string; points_cost: number; eligible_base: number; discount_amount: number };
type Capabilities = { isAdmin: boolean; isSuperadmin: boolean; isCashier: boolean; barber: { id: string; display_name: string } | null };
type CashierSection = Exclude<CashierNavigationSection, "reservas">;
type CashierRouteSection = CashierNavigationSection;
type Props = { userEmail: string; capabilities: Capabilities; shift: Row | null; services: Row[]; barbers: Row[]; products: Row[]; clients: Row[]; appointments: Row[]; sales: Row[]; earnings: Row[]; expenses: Row[]; payouts: Row[]; productReservations: Row[]; movements: Row[]; workDate: string; section: CashierRouteSection };

export function CashierPanel(props: Props) {
  const { userEmail, capabilities, shift, services, barbers, products, clients, appointments, sales, earnings, expenses, payouts, productReservations, movements, workDate, section } = props;
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
    setBusy(true); setError("");
    const { data, error: rpcError } = await createClient().rpc(name, args);
    setBusy(false);
    if (rpcError) {
      const message = reportFormError(form, rpcError, preferredField);
      setError(message); dispatchDashboardError(message); return null;
    }
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
      const response = await call("register_counter_product_sale_v2", {
        target_product_id: String(data.get("product_id") ?? "") || null,
        product_quantity: Number(data.get("quantity") ?? 1),
        recommended_by_barber_id: String(data.get("recommended_by") ?? "") || null,
        manual_discount: Number(data.get("discount") ?? 0),
        payment_method: String(data.get("payment_method") ?? "cash"),
        payment_reference: String(data.get("payment_reference") ?? "") || null,
        promotion_code: String(data.get("promotion_code") ?? "") || null,
      }, form);
      if (response) {
        setResult(response as Record<string, unknown>);
        dispatchDashboardSuccess("Venta de producto registrada sin generar beneficios de cliente.");
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
    const response = await call("register_counter_service_sale_v5", {
      target_appointment_id: String(data.get("appointment_id") ?? "") || null,
      target_client_id: String(data.get("client_id") ?? "") || null,
      guest_name: String(data.get("guest_name") ?? "") || null,
      guest_phone: String(data.get("guest_phone") ?? "") || null,
      service_lines: serviceIds.map((serviceId, index) => ({ service_id: serviceId, barber_id: serviceBarbers[index], attendee_label: attendeeLabels[index] })),
      custom_charges: chargeDescriptions.map((description, index) => ({ description, amount: chargeAmounts[index], barber_id: chargeBarbers[index] })),
      target_product_id: String(data.get("product_id") ?? "") || null,
      product_quantity: Number(data.get("quantity") ?? 1),
      recommended_by_barber_id: String(data.get("recommended_by") ?? "") || null,
      payment_method: String(data.get("payment_method") ?? "cash"),
      payment_reference: String(data.get("payment_reference") ?? "") || null,
      provided_referral_code: String(data.get("referral_code") ?? "") || null,
      selected_reward_id: String(data.get("selected_reward_id") ?? "") || null,
      selected_reward_barber_id: String(data.get("selected_reward_barber_id") ?? "") || null,
      redemption_code: String(data.get("redemption_code") ?? "") || null,
      promotion_code: String(data.get("promotion_code") ?? "") || null,
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
    const response = await call("collect_product_reservation", {
      target_reservation_id: reservationId,
      recommended_by_barber_id: String(data.get("recommended_by") ?? "") || null,
      payment_method: String(data.get("payment_method") ?? "cash"),
      payment_reference: String(data.get("payment_reference") ?? "") || null,
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

  async function reviewExpense(id: string, status: "approved" | "rejected") {
    if (await call("cashier_review_barber_expense", { target_expense: id, next_status: status })) { dispatchDashboardSuccess(status === "approved" ? "Gasto aprobado." : "Gasto rechazado."); router.refresh(); }
  }

  const pendingByBarber = new Map<string, number>();
  earnings.filter(item => item.status === "pending" && item.kind === "service_commission").forEach(item => pendingByBarber.set(String(item.barber_id), (pendingByBarber.get(String(item.barber_id)) ?? 0) + Number(item.amount)));
  const titles: Record<CashierSection, string> = { servicios: "Cobro de servicios", productos: "Venta de productos", movimientos: "Libro diario", liquidaciones: "Liquidaciones diarias", gastos: "Gastos del equipo", historial: "Historial de ventas" };
  const replaceNavigation = section !== "servicios";

  return <main className="admin-shell dash-workspace cashier-shell">
    <header className="admin-header dash-header"><PanelMobileMenuButton /><div className="dash-brand"><Brand linked={false} /><span className="dash-live"><i /> CAJA CONECTADA</span></div><ModeSwitcher current="cashier" isAdmin={capabilities.isAdmin} hasBarber={Boolean(capabilities.barber)} isCashier showClient={false} /><div className="dash-user"><span className="dash-avatar">{userEmail.slice(0, 2).toUpperCase()}</span><span>{userEmail}<small>Operador de caja</small></span></div></header>
    <div className="admin-layout cashier-layout"><PanelResponsiveSidebar><aside className="admin-nav dash-sidebar"><div className="dash-sidebar-head"><p>TERMINAL POS</p><PanelMobileSidebarClose /></div><nav>
      <Link replace={replaceNavigation} className={section === "servicios" ? "active" : ""} href="/caja"><Scissors /><span>Cobrar servicios</span>{section === "servicios" && <i />}</Link>
      <Link replace={replaceNavigation} className={section === "productos" ? "active" : ""} href="/caja/productos"><PackageOpen /><span>Venta de productos</span>{section === "productos" && <i />}</Link>
      <Link replace={replaceNavigation} className={section === "reservas" ? "active" : ""} href="/caja/reservas"><PackageCheck /><span>Reservas</span>{productReservations.length > 0 && <b className="cashier-nav-badge">{productReservations.length}</b>}{section === "reservas" && <i />}</Link>
      <Link replace={replaceNavigation} className={section === "movimientos" ? "active" : ""} href="/caja/movimientos"><ReceiptText /><span>Libro diario</span>{section === "movimientos" && <i />}</Link>
      <Link replace={replaceNavigation} className={section === "liquidaciones" ? "active" : ""} href="/caja/liquidaciones"><Calculator /><span>Liquidaciones</span>{section === "liquidaciones" && <i />}</Link>
      <Link replace={replaceNavigation} className={section === "gastos" ? "active" : ""} href="/caja/gastos"><ClipboardCheck /><span>Gastos</span>{section === "gastos" && <i />}</Link>
      <Link replace={replaceNavigation} className={section === "historial" ? "active" : ""} href="/caja/historial"><History /><span>Historial</span>{section === "historial" && <i />}</Link>
    </nav><div className="dash-sidebar-foot"><PanelThemeSelector /><Link href="/sitio"><Sparkles /><span>Web pública</span></Link><PanelMobileLogout /></div></aside><PanelMobileScrim /></PanelResponsiveSidebar>
      <section className="cashier-content"><div className="dash-page-heading"><div className="admin-title"><WalletCards /><div><p>TERMINAL POS</p><h1>{section === "reservas" ? "Reservas de productos" : titles[section]}</h1></div></div><span className={`dash-status-pill ${shift ? "online" : "offline"}`}><i />{shift ? "Turno abierto" : "Turno cerrado"}</span></div>
        {error && <p className="admin-error">{error}</p>}{result && <div className="admin-message"><strong>Operación completada.</strong>{"receipt_id" in result && <Link href={`/comprobante/${String(result.receipt_id)}`}> Ver comprobante #{String(result.receipt_number)}</Link>}{Boolean(result.claim_code) && <span> Código: <b>{String(result.claim_code)}</b></span>}</div>}
        {!shift ? <OpenShift onSubmit={open} busy={busy} /> : <>
          {section === "servicios" && <ServiceDashboard appointments={appointments} clients={clients} services={services} barbers={barbers} products={products} sales={sales} busy={busy} onSubmit={sell} />}
          {section === "productos" && <ProductDashboard products={products} barbers={barbers} busy={busy} onSubmit={sell} />}
          {section === "reservas" && <ReservationDashboard reservations={productReservations} barbers={barbers} busy={busy} onCollect={collectReservation} />}
          {section === "movimientos" && <DailyLedger movements={movements} shift={shift} operator={userEmail} busy={busy} onMovement={movement} onClose={close} workDate={workDate} />}
          {section === "liquidaciones" && <Settlements barbers={barbers} payouts={payouts} expenses={expenses} pendingByBarber={pendingByBarber} workDate={workDate} />}
          {section === "gastos" && <Expenses expenses={expenses} busy={busy} onReview={reviewExpense} />}
          {section === "historial" && <SalesHistory sales={sales} busy={busy} onReverse={reverseSale} />}
        </>}
      </section>
    </div>
    <CashierMobileNavigation section={section} reservationCount={productReservations.length} />
  </main>;
}

function OpenShift({ onSubmit, busy }: { onSubmit: (event: FormEvent<HTMLFormElement>) => void; busy: boolean }) {
  return <section className="admin-panel cashier-welcome"><div className="cashier-orb"><LockKeyhole /></div><p className="eyebrow">TERMINAL BLOQUEADA</p><h2>Abre un turno para comenzar.</h2><p>La apertura queda registrada en el libro diario y los importes no se muestran en el dashboard operativo.</p><DashboardModal title="Abrir turno" description="Registra el efectivo disponible al iniciar." triggerLabel="Abrir terminal" triggerIcon={<LockKeyhole />}><form className="admin-form" onSubmit={onSubmit}><label>Monto inicial Bs<input name="opening" type="number" min="0" step="0.5" defaultValue="0" required /></label><label>Glosa de apertura<input name="notes" /></label><button className="button button-dark wide" disabled={busy}>Confirmar apertura</button></form></DashboardModal></section>;
}

function ServiceDashboard({ appointments, clients, services, barbers, products, sales, busy, onSubmit }: { appointments: Row[]; clients: Row[]; services: Row[]; barbers: Row[]; products: Row[]; sales: Row[]; busy: boolean; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  return <><div className="cashier-compact-status"><span><b>{appointments.length}</b> en cola</span><span><b>{sales.filter(sale => Boolean(sale.paid_at)).length}</b> procesadas</span></div>
    <section className="admin-panel cashier-queue"><div className="dash-list-head"><div><small>ACTUALIZACIÓN AUTOMÁTICA</small><h2>Cobros pendientes</h2></div><ReceiptText /></div><p className="admin-help">Cuando el peluquero termina una atención, aparece aquí con los cambios y extras informados.</p><div className="admin-list">{appointments.length ? appointments.map(appointment => <QueueItem key={appointment.id} appointment={appointment} clients={clients} services={services} barbers={barbers} products={products} busy={busy} onSubmit={onSubmit} />) : <p className="admin-help">No hay cobros pendientes. Puedes registrar una atención sin reserva.</p>}</div></section>
    <div className="cashier-quick-actions"><section className="admin-panel cashier-quick-action"><div><small>CLIENTE SIN RESERVA</small><h2>Cobro directo de servicio</h2><p>Busca una cuenta existente o registra un cliente nuevo. Para nuevos clientes, el comprobante generará su código y QR de vinculación.</p></div><DashboardModal title="Cobrar servicio" description="Atención sin reserva previa." triggerLabel="Nuevo cobro" triggerIcon={<Scissors />} size="large"><ServiceSaleForm clients={clients} services={services} barbers={barbers} products={products} busy={busy} onSubmit={onSubmit} /></DashboardModal></section>
    <section className="admin-panel cashier-quick-action"><div><small>COMPROBANTE RÁPIDO</small><h2>Venta directa de producto</h2><p>Cobra una compra sin registrar cliente ni generar puntos. La comisión de venta sigue asociándose al peluquero.</p></div><DashboardModal title="Registrar venta de producto" description="Venta sin beneficios de cliente. El stock se descontará al confirmar." triggerLabel="Venta directa" triggerIcon={<PackageOpen />} size="large"><ProductSaleForm products={products} barbers={barbers} busy={busy} onSubmit={onSubmit} /></DashboardModal></section></div></>;
}

function QueueItem({ appointment, clients, services, barbers, products, busy, onSubmit }: { appointment: Row; clients: Row[]; services: Row[]; barbers: Row[]; products: Row[]; busy: boolean; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  const checkout = appointment.appointment_checkout_details as Row | Row[] | null;
  const details = Array.isArray(checkout) ? checkout[0] : checkout;
  const client = appointment.profiles as { full_name?: string } | null;
  const barber = appointment.barber_profiles as { display_name?: string } | null;
  return <article><div><strong>{client?.full_name ?? "Cliente"} · {String(appointment.service_name_snapshot)}</strong><span>{barber?.display_name ?? "Peluquero"}{details?.notes ? ` · ${String(details.notes)}` : ""}</span></div><DashboardModal title={`Cobrar a ${client?.full_name ?? "cliente"}`} description="Puedes corregir el servicio y añadir extras antes de confirmar." triggerLabel="Revisar y cobrar" triggerIcon={<ReceiptText />} size="large"><ServiceSaleForm appointment={appointment} checkout={details ?? null} clients={clients} services={services} barbers={barbers} products={products} busy={busy} onSubmit={onSubmit} /></DashboardModal></article>;
}

function ClientFields({ clients, mode, onModeChange, onClientChange }: { clients: Row[]; mode: "new" | "existing"; onModeChange: (mode: "new" | "existing") => void; onClientChange: (id: string) => void }) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Row | null>(null);
  const [results, setResults] = useState<Row[]>([]);
  const [searching, setSearching] = useState(false);
  const [referred, setReferred] = useState(false);

  useEffect(() => {
    if (mode !== "existing" || query.trim().length < 2 || selected) return;
    const search = query.trim().replace(/[,%()]/g, " ");
    const localMatches = clients.filter(client => String(client.full_name ?? "").toLocaleLowerCase("es").includes(search.toLocaleLowerCase("es"))).slice(0, 8);
    let active = true;
    const timer = window.setTimeout(async () => {
      const { data } = await createClient().from("profiles").select("id,full_name,email,phone").eq("status", "active").ilike("full_name", `%${search}%`).order("full_name").limit(8);
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
      <button type="button" className={mode === "new" ? "active" : ""} onClick={() => chooseMode("new")}>Cliente nuevo</button>
      <button type="button" className={mode === "existing" ? "active" : ""} onClick={() => chooseMode("existing")}>Cliente registrado</button>
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
          setResults(normalized.length >= 2 ? clients.filter(client => String(client.full_name ?? "").toLocaleLowerCase("es").includes(normalized)).slice(0, 8) : []);
          setSearching(normalized.length >= 2);
        }} placeholder="Escribe al menos 2 letras" required />
      </label>
      {selected ? <div className="cashier-client-selected"><span><strong>{String(selected.full_name ?? selected.email)}</strong>{Boolean(selected.phone) && <small>{String(selected.phone)}</small>}</span><button type="button" onClick={() => { setSelected(null); setQuery(""); onClientChange(""); }}>Cambiar</button></div> : query.trim().length >= 2 && <div className="cashier-client-results" role="listbox" aria-label="Clientes encontrados">
        {results.map(client => <button type="button" role="option" aria-selected="false" key={client.id} onClick={event => { (event.currentTarget.form?.elements.namedItem("client_search") as HTMLInputElement | null)?.setCustomValidity(""); setSelected(client); onClientChange(client.id); setQuery(String(client.full_name ?? client.email ?? "")); setResults([]); setSearching(false); }}><strong>{String(client.full_name ?? "Sin nombre")}</strong><small>{String(client.phone ?? client.email ?? "")}</small></button>)}
        {!searching && results.length === 0 && <p>No encontramos clientes con ese nombre.</p>}
        {searching && <p>Buscando…</p>}
      </div>}
    </div>}
    {mode === "new" && <label className="wide cashier-product-toggle cashier-referral-toggle"><input type="checkbox" checked={referred} onChange={event => setReferred(event.target.checked)} /> Viene recomendado por otro cliente</label>}
    {mode === "new" && referred && <label className="wide">Código del cliente que lo recomendó<input name="referral_code" placeholder="LC-..." autoCapitalize="characters" required /></label>}
  </fieldset>;
}
function PaymentFields({ allowPromotion = false }: { allowPromotion?: boolean }) {
  const [method, setMethod] = useState("cash");
  const [promotion, setPromotion] = useState(false);
  return <>{allowPromotion && <label className="wide cashier-product-toggle"><input type="checkbox" checked={promotion} onChange={event => setPromotion(event.target.checked)} /> Aplicar promoción</label>}{promotion && <label className="wide">Código de promoción<input name="promotion_code" autoCapitalize="characters" required /></label>}<label>Forma de pago<select name="payment_method" value={method} onChange={event => setMethod(event.target.value)}><option value="cash">Efectivo</option><option value="qr">QR</option><option value="transfer">Transferencia</option><option value="card">Tarjeta</option><option value="other">Otro</option></select></label>{method !== "cash" && <label>Referencia del pago<input name="payment_reference" required /></label>}</>;
}

type ServiceLine = { key: string; serviceId: string; barberId: string; attendeeLabel: string };
type CustomCharge = { key: string; description: string; amount: string; barberId: string };

function ServiceSaleForm({ appointment, checkout, clients, services, barbers, products, busy, onSubmit }: { appointment?: Row; checkout?: Row | null; clients: Row[]; services: Row[]; barbers: Row[]; products: Row[]; busy: boolean; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  const [customerMode, setCustomerMode] = useState<"new" | "existing">("new");
  const [clientId, setClientId] = useState(String(appointment?.client_id ?? ""));
  const [addProduct, setAddProduct] = useState(Boolean(checkout?.suggested_product_id));
  const [benefitMode, setBenefitMode] = useState<"none" | "points" | "promotion" | "code">("none");
  const [rewardQuotes, setRewardQuotes] = useState<RewardQuote[]>([]);
  const [quotedFingerprint, setQuotedFingerprint] = useState("");
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [selectedReward, setSelectedReward] = useState("");
  const [checkoutKey] = useState(() => typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `checkout-${Date.now()}-${Math.random()}`);
  const [serviceLines, setServiceLines] = useState<ServiceLine[]>(() => {
    const initial = [{ key: "primary", serviceId: String(checkout?.actual_service_id ?? appointment?.service_id ?? ""), barberId: String(appointment?.barber_id ?? ""), attendeeLabel: "Titular" }];
    if (checkout?.extra_service_id) initial.push({ key: "checkout-extra", serviceId: String(checkout.extra_service_id), barberId: String(appointment?.barber_id ?? ""), attendeeLabel: "Titular" });
    return initial;
  });
  const [charges, setCharges] = useState<CustomCharge[]>([]);
  const quoteFingerprint=`${clientId}:${serviceLines.map(line=>`${line.serviceId}:${line.barberId}`).join("|")}`;
  useEffect(() => {
    if (benefitMode !== "points" || !clientId || serviceLines.some(line => !line.serviceId || !line.barberId)) return;
    let active = true;
    const timer = window.setTimeout(async () => {
      setQuoteLoading(true);
      const { data } = await createClient().rpc("cashier_quote_loyalty", { target_client_id: clientId, service_lines: serviceLines.map(line => ({ service_id: line.serviceId, barber_id: line.barberId })) });
      if (!active) return;
      const quotes = (data as RewardQuote[] | null) ?? [];
      setRewardQuotes(quotes); setQuotedFingerprint(quoteFingerprint); setSelectedReward(current => quotes.some(item => `${item.reward_id}:${item.barber_id}` === current) ? current : (quotes[0] ? `${quotes[0].reward_id}:${quotes[0].barber_id}` : "")); setQuoteLoading(false);
    }, 250);
    return () => { active = false; window.clearTimeout(timer); };
  }, [benefitMode, clientId, serviceLines, quoteFingerprint]);
  function updateServiceLine(key: string, field: keyof Omit<ServiceLine, "key">, value: string) { setServiceLines(lines => lines.map(line => line.key === key ? { ...line, [field]: value } : line)); }
  function updateCharge(key: string, field: keyof Omit<CustomCharge, "key">, value: string) { setCharges(items => items.map(item => item.key === key ? { ...item, [field]: value } : item)); }
  const quoteInputValid=benefitMode === "points" && Boolean(clientId) && serviceLines.every(line=>line.serviceId&&line.barberId);
  const chosenQuote = quoteInputValid&&quotedFingerprint===quoteFingerprint?rewardQuotes.find(item => `${item.reward_id}:${item.barber_id}` === selectedReward):undefined;
  return <form className="admin-form" onSubmit={onSubmit}><input type="hidden" name="sale_kind" value="service" /><input type="hidden" name="appointment_id" value={appointment?.id ?? ""} /><input type="hidden" name="checkout_idempotency_key" value={checkoutKey} /><input type="hidden" name="selected_reward_id" value={benefitMode === "points" ? chosenQuote?.reward_id ?? "" : ""} /><input type="hidden" name="selected_reward_barber_id" value={benefitMode === "points" ? chosenQuote?.barber_id ?? "" : ""} />{!appointment && <ClientFields clients={clients} mode={customerMode} onModeChange={mode => { setCustomerMode(mode); setBenefitMode("none"); }} onClientChange={setClientId} />}
    <fieldset className="wide cashier-line-group"><legend>Atenciones incluidas</legend>{serviceLines.map((line, index) => <div className="cashier-service-line" key={line.key}>
      {serviceLines.length > 1 && <span className="cashier-line-number">Atención {index + 1}</span>}
      {index === 0 ? <input type="hidden" name="line_attendee_label" value="Titular" /> : <label>Persona atendida<select name="line_attendee_label" value={line.attendeeLabel} onChange={event => updateServiceLine(line.key, "attendeeLabel", event.target.value)}><option>Hijo/a</option><option>Acompañante</option><option>Titular</option></select></label>}
      <label>Servicio<select name="line_service_id" value={line.serviceId} onChange={event => updateServiceLine(line.key, "serviceId", event.target.value)} required><option value="">Seleccionar servicio</option>{services.map(service => <option key={service.id} value={service.id}>{String(service.name)} · Bs {String(service.price)}</option>)}</select></label>
      <label>Peluquero<select name="line_barber_id" value={line.barberId} onChange={event => updateServiceLine(line.key, "barberId", event.target.value)} required><option value="">Seleccionar</option>{barbers.map(barber => <option key={barber.id} value={barber.id}>{String(barber.display_name)}</option>)}</select></label>
      {serviceLines.length > 1 && <button type="button" className="cashier-remove-line" aria-label={`Quitar atención ${index + 1}`} onClick={() => setServiceLines(lines => lines.filter(item => item.key !== line.key))}><Trash2 /> Quitar</button>}
    </div>)}<button type="button" className="cashier-add-line" onClick={() => setServiceLines(lines => [...lines, { key: `service-${Date.now()}`, serviceId: "", barberId: lines.at(-1)?.barberId ?? "", attendeeLabel: "Hijo/a" }])}><CirclePlus /> Agregar otra atención</button></fieldset>
    {charges.length > 0 && <fieldset className="wide cashier-line-group"><legend>Cargos imprevistos</legend>{charges.map((charge, index) => <div className="cashier-service-line cashier-charge-line" key={charge.key}>
      <span className="cashier-line-number">Cargo {index + 1}</span><label>Justificación<input name="charge_description" value={charge.description} onChange={event => updateCharge(charge.key, "description", event.target.value)} required placeholder="Detalle realizado" /></label><label>Monto Bs<input name="charge_amount" type="number" min="0.5" step="0.5" value={charge.amount} onChange={event => updateCharge(charge.key, "amount", event.target.value)} required /></label><label>Peluquero<select name="charge_barber_id" value={charge.barberId} onChange={event => updateCharge(charge.key, "barberId", event.target.value)} required><option value="">Seleccionar</option>{barbers.map(barber => <option key={barber.id} value={barber.id}>{String(barber.display_name)}</option>)}</select></label><button type="button" className="cashier-remove-line" onClick={() => setCharges(items => items.filter(item => item.key !== charge.key))}><Trash2 /> Quitar</button>
    </div>)}</fieldset>}
    {charges.length === 0 && <button type="button" className="wide cashier-add-line cashier-optional-action" onClick={() => setCharges([{ key: `charge-${Date.now()}`, description: "", amount: "", barberId: serviceLines[0]?.barberId ?? "" }])}><CirclePlus /> Agregar cargo imprevisto</button>}
    <label className="wide cashier-product-toggle"><input type="checkbox" checked={addProduct} onChange={event => setAddProduct(event.target.checked)} /> Añadir producto a este cobro</label>
    {addProduct && <><label>Producto<select name="product_id" defaultValue={String(checkout?.suggested_product_id ?? "")} required><option value="">Seleccionar producto</option>{products.map(product => <option key={product.id} value={product.id}>{String(product.name)} · Bs {String(product.price)} · stock {String(product.stock)}</option>)}</select></label><label>Cantidad<input name="quantity" type="number" min="1" max="20" defaultValue={Number(checkout?.product_quantity ?? 1)} /></label><label>Recomendado por<select name="recommended_by" defaultValue={String(appointment?.barber_id ?? "")}><option value="">Sin recomendador</option>{barbers.map(barber => <option key={barber.id} value={barber.id}>{String(barber.display_name)}</option>)}</select></label></>}
    {(Boolean(appointment) || customerMode === "existing") && <fieldset className="wide cashier-benefits"><legend>Beneficio (opcional)</legend><div className="cashier-benefit-modes"><button type="button" className={benefitMode === "none" ? "active" : ""} onClick={() => setBenefitMode("none")}>Sin beneficio</button><button type="button" className={benefitMode === "points" ? "active" : ""} onClick={() => setBenefitMode("points")}><Gift /> Puntos</button><button type="button" className={benefitMode === "promotion" ? "active" : ""} onClick={() => setBenefitMode("promotion")}>Promoción</button><button type="button" className={benefitMode === "code" ? "active" : ""} onClick={() => setBenefitMode("code")}>Código</button></div>{benefitMode === "points" && <div className="cashier-reward-options">{quoteLoading||quotedFingerprint!==quoteFingerprint ? <p>Consultando beneficios…</p> : rewardQuotes.length ? rewardQuotes.map(item => { const value=`${item.reward_id}:${item.barber_id}`; return <label className={selectedReward === value ? "selected" : ""} key={value}><input type="radio" checked={selectedReward === value} onChange={() => setSelectedReward(value)} /><span><strong>{item.reward_name}</strong><small>{item.barber_name} · usa {item.points_cost} de {item.balance} pts · base Bs {Number(item.eligible_base).toFixed(2)}</small></span><b>- Bs {Number(item.discount_amount).toFixed(2)}</b></label>; }) : <p>No hay recompensas disponibles para estos servicios y peluqueros.</p>}</div>}{benefitMode === "promotion" && <label>Código de promoción<input name="promotion_code" autoCapitalize="characters" required /></label>}{benefitMode === "code" && <label>Código mostrado por el cliente<input name="redemption_code" autoCapitalize="characters" required /></label>}</fieldset>}
    <PaymentFields /><button className="button button-dark wide" disabled={busy || (benefitMode === "points" && !chosenQuote)}><ReceiptText /> {chosenQuote ? `Confirmar pago · ahorro Bs ${Number(chosenQuote.discount_amount).toFixed(2)}` : "Confirmar pago y emitir comprobante"}</button></form>;
}

function ProductDashboard({ products, barbers, busy, onSubmit }: { products: Row[]; barbers: Row[]; busy: boolean; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  return <section className="admin-panel cashier-product-sale"><div className="dash-list-head"><div><small>OPERACIÓN INDEPENDIENTE</small><h2>Registrar producto</h2></div><PackageOpen /></div><p className="admin-help">Genera únicamente un comprobante de pago. No registra cliente, referido ni puntos de fidelidad.</p><DashboardModal title="Registrar venta de producto" description="Venta sin beneficios de cliente. El stock se descontará al confirmar." triggerLabel="Nueva venta" triggerIcon={<PackageOpen />} size="large"><ProductSaleForm products={products} barbers={barbers} busy={busy} onSubmit={onSubmit} /></DashboardModal></section>;
}

function ReservationDashboard({ reservations, barbers, busy, onCollect }: { reservations: Row[]; barbers: Row[]; busy: boolean; onCollect: (event: FormEvent<HTMLFormElement>, reservationId: string) => void }) {
  return <section className="admin-panel cashier-reservations"><div className="dash-list-head"><div><small>RETIRO EN EL LOCAL</small><h2>Productos apartados</h2></div><PackageCheck /></div><p className="admin-help">Confirma la identidad del cliente antes de cobrar. Al finalizar, el apartado sale de esta lista, se descuenta el stock y se crea un comprobante a su nombre.</p><div className="cashier-reservation-list">{reservations.length ? reservations.map(reservation => {
    const client = reservation.profiles as { full_name?: string; email?: string; phone?: string } | null;
    const product = reservation.products as { name?: string; brand?: string; presentation?: string; stock?: number } | null;
    const expiresAt = new Date(String(reservation.expires_at));
    const expired = Boolean(reservation.is_expired);
    const total = Number(reservation.price_snapshot) * Number(reservation.quantity);
    return <article className={expired ? "expired" : ""} key={reservation.id}><div className="cashier-reservation-main"><span className="cashier-reservation-icon"><PackageOpen /></span><div><small>{expired ? "APARTADO VENCIDO" : "LISTO PARA RETIRO"}</small><h3>{String(product?.name ?? "Producto")}</h3><p>{[product?.brand, product?.presentation].filter(Boolean).join(" · ") || "Sin presentación registrada"}</p></div></div><dl><div><dt>Cliente</dt><dd>{String(client?.full_name ?? client?.email ?? "Cliente")}</dd></div><div><dt>Contacto</dt><dd>{String(client?.phone ?? client?.email ?? "Sin contacto")}</dd></div><div><dt>Cantidad</dt><dd>{String(reservation.quantity)} unidad(es)</dd></div><div><dt>Total reservado</dt><dd>Bs {total.toFixed(2)}</dd></div><div><dt>Vencimiento</dt><dd>{new Intl.DateTimeFormat("es-BO", { dateStyle: "medium", timeStyle: "short", timeZone: "America/La_Paz" }).format(expiresAt)}</dd></div><div><dt>Stock físico</dt><dd>{String(product?.stock ?? 0)}</dd></div></dl>{expired ? <p className="cashier-reservation-expired">Este apartado venció; el cliente debe realizar uno nuevo.</p> : <DashboardModal title={`Cobrar ${String(product?.name ?? "producto")}`} description={`Comprobante para ${String(client?.full_name ?? client?.email ?? "el cliente")}. El precio reservado es Bs ${total.toFixed(2)}.`} triggerLabel="Cobrar y entregar" triggerIcon={<ReceiptText />} size="large"><form className="admin-form" onSubmit={event => onCollect(event, reservation.id)}><div className="wide cashier-reservation-summary"><strong>{String(client?.full_name ?? client?.email ?? "Cliente")}</strong><span>{String(product?.name ?? "Producto")} · {String(reservation.quantity)} unidad(es) · Bs {total.toFixed(2)}</span></div><label className="wide">Vendido o recomendado por<select name="recommended_by"><option value="">Sin peluquero asociado</option>{barbers.map(barber => <option key={barber.id} value={barber.id}>{String(barber.display_name)}</option>)}</select></label><PaymentFields allowPromotion /><button className="button button-dark wide" disabled={busy}><ReceiptText /> Confirmar pago, entrega y comprobante</button></form></DashboardModal>}</article>;
  }) : <p className="admin-help">No hay productos apartados pendientes de retiro.</p>}</div></section>;
}

function ProductSaleForm({ products, barbers, busy, onSubmit }: { products: Row[]; barbers: Row[]; busy: boolean; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  return <form className="admin-form" onSubmit={onSubmit}><input type="hidden" name="sale_kind" value="product" /><label>Producto<select name="product_id" required><option value="">Seleccionar producto</option>{products.map(product => <option key={product.id} value={product.id}>{String(product.name)} · Bs {String(product.price)} · stock {String(product.stock)}</option>)}</select></label><label>Cantidad<input name="quantity" type="number" min="1" max="20" defaultValue="1" required /></label><label>Vendido o recomendado por<select name="recommended_by"><option value="">Sin peluquero asociado</option>{barbers.map(barber => <option key={barber.id} value={barber.id}>{String(barber.display_name)}</option>)}</select></label><PaymentFields allowPromotion /><button className="button button-dark wide" disabled={busy}><ReceiptText /> Cobrar producto y emitir comprobante</button></form>;
}

function DailyLedger({ movements, shift, operator, busy, onMovement, onClose, workDate }: { movements: Row[]; shift: Row; operator: string; busy: boolean; onMovement: (event: FormEvent<HTMLFormElement>) => void; onClose: (event: FormEvent<HTMLFormElement>) => void; workDate: string }) {
  const opening = Number(shift.opening_amount ?? 0);
  const income = movements.reduce((sum, item) => sum + Math.max(Number(item.amount), 0), 0);
  const expenses = movements.reduce((sum, item) => sum + Math.abs(Math.min(Number(item.amount), 0)), 0);
  const cash = opening + movements.filter(item => item.payment_method === "cash").reduce((sum, item) => sum + Number(item.amount), 0);
  const qr = movements.filter(item => item.payment_method === "qr").reduce((sum, item) => sum + Number(item.amount), 0);
  const registered = opening + income - expenses;
  return <section className="admin-panel cashier-ledger"><div className="cashier-print-header"><Brand linked={false} /><div><small>LIBRO DIARIO DE CAJA</small><strong>{workDate}</strong></div></div><div className="dash-list-head"><div><small>TURNO · {workDate}</small><h2>Movimientos del turno</h2></div><div className="dash-row-actions no-print"><button onClick={() => window.print()}><Printer /> Imprimir</button><DashboardModal title="Registrar movimiento" description="Todo movimiento requiere una glosa clara." triggerLabel="Nuevo movimiento" variant="secondary"><MovementForm busy={busy} onSubmit={onMovement} /></DashboardModal></div></div><div className="cashier-ledger-meta"><span>Operador: {operator}</span><span>Apertura: {new Intl.DateTimeFormat("es-BO", { dateStyle: "medium", timeStyle: "short", timeZone: "America/La_Paz" }).format(new Date(String(shift.opened_at)))}</span><span>Monto inicial: Bs {opening.toFixed(2)}</span></div><section className="cashier-ledger-summary" aria-label="Resumen del turno"><article><span>Ingresos</span><strong>Bs {income.toFixed(2)}</strong></article><article><span>Egresos</span><strong>Bs {expenses.toFixed(2)}</strong></article><article><span>Total efectivo</span><strong>Bs {cash.toFixed(2)}</strong></article><article><span>Total QR</span><strong>Bs {qr.toFixed(2)}</strong></article><article className="ledger-grand-total"><span>Total registrado</span><strong>Bs {registered.toFixed(2)}</strong></article></section><div className="cashier-ledger-table"><div className="ledger-row ledger-head"><span>Hora</span><span>Movimiento</span><span>Glosa</span><span>Método</span><span>Importe</span></div>{movements.length ? movements.map(item => <div className="ledger-row" key={item.id}><span>{new Intl.DateTimeFormat("es-BO", { timeStyle: "short", timeZone: "America/La_Paz" }).format(new Date(String(item.created_at)))}</span><span>{movementLabel(String(item.kind))}</span><span>{String(item.reason ?? "Sin glosa")}</span><span>{paymentLabel(String(item.payment_method))}</span><b>Bs {Number(item.amount).toFixed(2)}</b></div>) : <p className="admin-help">Aún no existen movimientos en este turno.</p>}</div><div className="cashier-ledger-signatures"><span>Firma cajero/a</span><span>Firma administrador/a</span></div><div className="cashier-close-action no-print"><DashboardModal title="Cerrar y conciliar caja" description="Realiza esta acción al finalizar el turno." triggerLabel="Cerrar turno" variant="ghost"><form className="admin-form" onSubmit={onClose}><label className="wide">Efectivo contado Bs<input name="counted" type="number" min="0" step="0.5" required /></label><label className="wide">Glosa de cierre<input name="notes" required /></label><button className="button button-dark wide" disabled={busy}>Cerrar y conciliar</button></form></DashboardModal></div></section>;
}

function MovementForm({ busy, onSubmit }: { busy: boolean; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) { return <form className="admin-form" onSubmit={onSubmit}><label>Tipo<select name="kind"><option value="income">Ingreso</option><option value="expense">Egreso</option><option value="adjustment">Ajuste</option></select></label><label>Monto Bs<input name="amount" type="number" min="0.5" step="0.5" required /></label><label>Método<select name="method"><option value="cash">Efectivo</option><option value="qr">QR</option><option value="transfer">Transferencia</option></select></label><label>Glosa<input name="reason" required placeholder="Concepto y responsable" /></label><button className="button button-dark wide" disabled={busy}>Registrar en libro diario</button></form>; }
function movementLabel(kind: string) { return ({ sale: "Venta", income: "Ingreso", expense: "Egreso", refund: "Devolución", adjustment: "Ajuste" } as Record<string, string>)[kind] ?? kind; }
function paymentLabel(method: string) { return ({ cash: "Efectivo", qr: "QR", transfer: "Transferencia", card: "Tarjeta", other: "Otro" } as Record<string, string>)[method] ?? method; }

function Settlements({ barbers, payouts, expenses, pendingByBarber, workDate }: { barbers: Row[]; payouts: Row[]; expenses: Row[]; pendingByBarber: Map<string, number>; workDate: string }) {
  return <section className="admin-panel cashier-team-panel"><div className="dash-list-head"><div><small>CIERRE DEL EQUIPO · {workDate}</small><h2>Cierre por peluquero</h2></div><Calculator /></div><p className="admin-help">Revisa cada cuenta antes de preparar el pago. Los servicios se liquidan por jornada, los gastos aprobados se descuentan y el incentivo de ventas solo se agrega cuando Caja lo confirma.</p><div className="cashier-settlement-summary">{barbers.map(barber => {
    const payout = payouts.find(item => item.barber_id === barber.id);
    const deductions = expenses.filter(item => item.barber_id === barber.id && item.status === "approved").reduce((sum, item) => sum + Number(item.amount), 0);
    const commission = pendingByBarber.get(barber.id) ?? Number(payout?.commission_amount ?? 0);
    return <article key={barber.id}><div><strong>{String(barber.display_name)}</strong><span>Servicios pendientes: Bs {commission.toFixed(2)} · Gastos: -Bs {Number(payout?.deduction_amount ?? deductions).toFixed(2)}</span>{payout && <span className={`cashier-settlement-state ${String(payout.status)}`}>{payout.status === "paid" ? "Pagada" : "Preparada"} · Bs {Number(payout.total_amount).toFixed(2)}</span>}</div><Link className="cashier-detail-link" href={`/caja/liquidaciones/${barber.id}`}>Ver detalle <ArrowRight /></Link></article>;
  })}</div></section>;
}
function Expenses({ expenses, busy, onReview }: { expenses: Row[]; busy: boolean; onReview: (id: string, status: "approved" | "rejected") => void }) { return <section className="admin-panel cashier-team-panel"><div className="dash-list-head"><div><small>INSUMOS Y DESCUENTOS</small><h2>Solicitudes pendientes</h2></div><ClipboardCheck /></div><p className="admin-help">Un gasto aprobado se descontará de la siguiente liquidación del peluquero.</p><div className="admin-list">{expenses.length ? expenses.map(expense => <article key={expense.id}><div><strong>{String((expense.barber_profiles as Row | null)?.display_name ?? "Peluquero")} · {String(expense.concept)}</strong><span>Bs {Number(expense.amount).toFixed(2)} · {String(expense.status)}</span></div>{expense.status === "pending" && <div className="dash-row-actions"><button disabled={busy} onClick={() => onReview(expense.id, "approved")}>Aprobar descuento</button><button disabled={busy} onClick={() => onReview(expense.id, "rejected")}>Rechazar</button></div>}</article>) : <p className="admin-help">No hay gastos por revisar.</p>}</div></section>; }
function SalesHistory({ sales, busy, onReverse }: { sales: Row[]; busy: boolean; onReverse: (event: FormEvent<HTMLFormElement>, id: string) => void }) {
  const [period, setPeriod] = useState<"today" | "week" | "month">("today");
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/La_Paz" }).format(new Date());
  const cutoff = new Date(`${today}T12:00:00Z`); cutoff.setUTCDate(cutoff.getUTCDate() - (period === "week" ? 6 : 29));
  const cutoffKey = cutoff.toISOString().slice(0, 10);
  const visible = sales.filter(sale => {
    const key = new Intl.DateTimeFormat("en-CA", { timeZone: "America/La_Paz" }).format(new Date(String(sale.paid_at)));
    return period === "today" ? key === today : key >= cutoffKey && key <= today;
  });
  return <section className="admin-panel cashier-history"><div className="dash-list-head"><div><small>TRAZABILIDAD</small><h2>Ventas registradas</h2></div><History /></div><div className="cashier-history-filters" role="group" aria-label="Periodo del historial"><button className={period === "today" ? "active" : ""} onClick={() => setPeriod("today")}>Hoy</button><button className={period === "week" ? "active" : ""} onClick={() => setPeriod("week")}>7 días</button><button className={period === "month" ? "active" : ""} onClick={() => setPeriod("month")}>30 días</button></div><div className="admin-list">{visible.length ? visible.map(sale => {
    const receipt = Array.isArray(sale.receipts) ? sale.receipts[0] : sale.receipts as { id?: string; number?: number } | null;
    const payment = Array.isArray(sale.payments) ? sale.payments[0] as Row | undefined : sale.payments as Row | null;
    const refunded = sale.status === "refunded";
    return <article key={sale.id}><div><strong>{String((sale.profiles as { full_name?: string } | null)?.full_name ?? sale.guest_name ?? "Consumidor final")}</strong><span>{new Intl.DateTimeFormat("es-BO", { dateStyle: "short", timeStyle: "short", timeZone: "America/La_Paz" }).format(new Date(String(sale.paid_at)))} · {paymentLabel(String(payment?.method ?? ""))} · Bs {Number(sale.paid_total).toFixed(2)} · descuento Bs {Number(sale.discount_total).toFixed(2)}</span>{refunded && <small className="cashier-refunded-label">Venta revertida · {String(sale.reversal_reason ?? "Motivo registrado en auditoría")}</small>}</div><div className="dash-row-actions">{receipt?.id && <Link href={`/comprobante/${receipt.id}?print=1`} target="_blank" rel="noreferrer"><Printer /> Imprimir #{String(receipt.number)}</Link>}{!refunded && <DashboardModal title="Revertir venta" description="La devolución quedará registrada en Caja, puntos, comisiones y auditoría. La justificación es obligatoria." triggerLabel="Revertir" triggerIcon={<RotateCcw />} variant="ghost"><form className="admin-form" onSubmit={event => onReverse(event, sale.id)}><label className="wide">Justificación<textarea name="reason" minLength={5} maxLength={500} required placeholder="Explica por qué se devuelve o anula esta venta" /></label><button className="button button-dark wide" disabled={busy}>Confirmar reversión</button></form></DashboardModal>}</div></article>;
  }) : <p className="admin-help">No hay ventas en el periodo seleccionado.</p>}</div></section>;
}
