"use client";

import Image from "next/image";
import { FormEvent, useEffect, useState } from "react";
import { Banknote, Check, Gift, ImageOff, Minus, PackageOpen, Plus, QrCode, Search, ShoppingBag, Trash2, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { publicMediaUrl } from "@/lib/public-media";
import { CashierClientProfileCard, type CashierVisit } from "./cashier-client-profile";

type CashierRow = Record<string, unknown> & { id: string };
type CartLine = { productId: string; quantity: number };
export type PaymentLine = { id: string; method: string; amount: string };
type PromotionQuoteState = { code: string; subtotal: number; valid: boolean; discount: number; total: number; message?: string };
const paymentMethods = [
  { id: "cash", label: "Efectivo", icon: Banknote },
  { id: "qr", label: "QR", icon: QrCode },
];

export function useCashierPromotionQuote(code: string, subtotal: number) {
  const [quote, setQuote] = useState<PromotionQuoteState | null>(null);
  const [loading, setLoading] = useState(false);
  const normalizedCode = code.trim().toLocaleUpperCase("es");
  useEffect(() => {
    if (!normalizedCode) { setQuote(null); setLoading(false); return; }
    let active = true;
    setLoading(true);
    const timer = window.setTimeout(async () => {
      try {
        const { data, error } = await createClient().rpc("cashier_quote_promotion", { target_code: normalizedCode, target_amount: subtotal });
        if (!active) return;
        if (error) setQuote({ code: normalizedCode, subtotal, valid: false, discount: 0, total: subtotal, message: "No se pudo validar el código." });
        else {
          const value = data as { valid?: boolean; discount?: number; total?: number; message?: string } | null;
          setQuote({ code: normalizedCode, subtotal, valid: Boolean(value?.valid), discount: Number(value?.discount ?? 0), total: Number(value?.total ?? subtotal), message: value?.message });
        }
      } catch {
        if (active) setQuote({ code: normalizedCode, subtotal, valid: false, discount: 0, total: subtotal, message: "No se pudo validar el código." });
      } finally {
        if (active) setLoading(false);
      }
    }, 220);
    return () => { active = false; window.clearTimeout(timer); };
  }, [normalizedCode, subtotal]);
  const current = quote?.code === normalizedCode && quote.subtotal === subtotal ? quote : null;
  return { loading: Boolean(normalizedCode) && (loading || !current), valid: Boolean(current?.valid), discount: current?.discount ?? 0, total: current?.total ?? subtotal, message: current?.message };
}

export function CashierProductSaleForm({ products, barbers, clients, visitHistory, busy, onSubmit }: {
  products: CashierRow[];
  barbers: CashierRow[];
  clients: CashierRow[];
  visitHistory: CashierVisit[];
  busy: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("Todos");
  const [clientId, setClientId] = useState("");
  const [selectedClient, setSelectedClient] = useState<CashierRow | null>(null);
  const [clientQuery, setClientQuery] = useState("");
  const [clientResults, setClientResults] = useState<CashierRow[]>([]);
  const [clientSearching, setClientSearching] = useState(false);
  const [barberId, setBarberId] = useState("");
  const [paymentValid, setPaymentValid] = useState(false);
  const [promotion, setPromotion] = useState(false);
  const [promotionCode, setPromotionCode] = useState("");
  const [payments, setPayments] = useState<PaymentLine[]>([{ id: "payment-1", method: "cash", amount: "0.00" }]);

  const categories = ["Todos", ...Array.from(new Set(products.map(product => String(product.category ?? "").trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b, "es"))];
  const filteredProducts = products.filter(product => {
    const matchesCategory = category === "Todos" || String(product.category ?? "") === category;
    const term = query.trim().toLocaleLowerCase("es");
    const searchable = [product.name, product.brand, product.presentation, product.category].map(value => String(value ?? "")).join(" ").toLocaleLowerCase("es");
    return matchesCategory && (!term || searchable.includes(term));
  });
  const total = lines.reduce((sum, line) => sum + Number(products.find(product => product.id === line.productId)?.price ?? 0) * line.quantity, 0);
  const units = lines.reduce((sum, line) => sum + line.quantity, 0);
  const promotionQuote = useCashierPromotionQuote(promotion ? promotionCode : "", total);
  const payableTotal = promotion ? promotionQuote.total : total;
  const promotionReady = !promotion || (!promotionQuote.loading && promotionQuote.valid);
  const client = selectedClient ?? clients.find(item => item.id === clientId);

  useEffect(() => {
    if (payments.length === 1) {
      setPayments(current => current.length === 1 ? [{ ...current[0], amount: payableTotal.toFixed(2) }] : current);
    }
  }, [payableTotal, payments.length]);

  useEffect(() => {
    const search = clientQuery.trim().replace(/[%,_()]/g, " ");
    if (search.length < 2 || clientId) {
      setClientResults([]);
      setClientSearching(false);
      return;
    }
    const normalized = search.toLocaleLowerCase("es");
    const localMatches = clients.filter(item => [item.full_name, item.email, item.phone].some(value => String(value ?? "").toLocaleLowerCase("es").includes(normalized))).slice(0, 8);
    let active = true;
    setClientResults(localMatches);
    setClientSearching(true);
    const timer = window.setTimeout(async () => {
      const pattern = `%${search}%`;
      const { data } = await createClient().from("profiles").select("id,full_name,email,phone,referral_code").eq("status", "active")
        .or(`full_name.ilike.${pattern},email.ilike.${pattern},phone.ilike.${pattern}`).order("full_name").limit(8);
      if (!active) return;
      setClientResults((data as CashierRow[] | null) ?? localMatches);
      setClientSearching(false);
    }, 220);
    return () => { active = false; window.clearTimeout(timer); };
  }, [clientId, clientQuery, clients]);

  function addProduct(product: CashierRow) {
    const stock = Number(product.stock ?? 0);
    setLines(current => {
      const existing = current.find(line => line.productId === product.id);
      if (existing) return current.map(line => line.productId === product.id ? { ...line, quantity: Math.min(stock, line.quantity + 1) } : line);
      return stock > 0 ? [...current, { productId: product.id, quantity: 1 }] : current;
    });
  }

  function setQuantity(productId: string, quantity: number) {
    const stock = Number(products.find(product => product.id === productId)?.stock ?? 0);
    if (quantity < 1) {
      setLines(current => current.filter(line => line.productId !== productId));
      return;
    }
    setLines(current => current.map(line => line.productId === productId ? { ...line, quantity: Math.min(stock, quantity) } : line));
  }

  function chooseClient(selected: CashierRow) {
    setClientId(selected.id);
    setSelectedClient(selected);
    setClientQuery(String(selected.full_name ?? selected.email ?? ""));
    setClientResults([]);
  }

  return <form className="cashier-pos-form" onSubmit={onSubmit}>
    <input type="hidden" name="sale_kind" value="product" />
    {lines.map(line => <span className="cashier-hidden-fields" key={line.productId}><input type="hidden" name="product_id" value={line.productId} /><input type="hidden" name="quantity" value={line.quantity} /></span>)}
    <input type="hidden" name="client_id" value={clientId} />
    <div className="cashier-pos-layout">
      <section className="cashier-catalog">
        <div className="cashier-catalog-heading"><div><p>Catálogo</p><h2>Elige productos</h2></div><span>{filteredProducts.length} disponibles</span></div>
        <label className="cashier-catalog-search"><Search aria-hidden="true" /><span className="sr-only">Buscar productos</span><input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Nombre, marca o presentación" /></label>
        <div className="cashier-category-tabs" role="group" aria-label="Filtrar por categoría">{categories.map(item => <button type="button" key={item} aria-pressed={category === item} className={category === item ? "active" : ""} onClick={() => setCategory(item)}>{item}</button>)}</div>
        <div className="cashier-product-grid">{filteredProducts.map(product => {
          const imagePaths = Array.isArray(product.image_paths) ? product.image_paths.map(String) : [];
          const imageUrl = publicMediaUrl(imagePaths[0] ?? String(product.image_path ?? ""));
          const quantity = lines.find(line => line.productId === product.id)?.quantity ?? 0;
          const stock = Number(product.stock ?? 0);
          return <button type="button" className={`cashier-product-tile ${quantity ? "in-cart" : ""}`} key={product.id} onClick={() => addProduct(product)} disabled={stock < 1} aria-label={`Agregar ${String(product.name)}, Bs ${Number(product.price).toFixed(2)}, stock ${stock}`}>
            <span className="cashier-product-photo">{imageUrl ? <Image src={imageUrl} alt={String(product.name)} fill sizes="(max-width: 700px) 42vw, 220px" unoptimized /> : <ImageOff aria-hidden="true" />}{quantity > 0 && <b className="cashier-product-quantity">{quantity}</b>}</span>
            <span className="cashier-product-tile-copy"><strong>{String(product.name)}</strong><small>{[product.brand, product.presentation].filter(Boolean).map(String).join(" · ") || `${stock} en stock`}</small><span><b>Bs {Number(product.price).toFixed(2)}</b><i>{stock} disponibles</i></span></span>
          </button>;
        })}{filteredProducts.length === 0 && <div className="cashier-catalog-empty"><Search /><strong>No hay coincidencias</strong><span>Prueba otra palabra o categoría.</span></div>}</div>
      </section>

      <aside className="cashier-cart">
        <div className="cashier-cart-heading"><div><p>Venta actual</p><h2><ShoppingBag /> Carrito</h2></div><button type="button" className="cashier-cart-clear" disabled={!lines.length} onClick={() => setLines([])}>Vaciar</button></div>
        <div className="cashier-cart-lines">{lines.length ? lines.map(line => {
          const product = products.find(item => item.id === line.productId);
          if (!product) return null;
          const imagePaths = Array.isArray(product.image_paths) ? product.image_paths.map(String) : [];
          const imageUrl = publicMediaUrl(imagePaths[0] ?? String(product.image_path ?? ""));
          return <article className="cashier-cart-line" key={line.productId}>
            <span className="cashier-cart-photo">{imageUrl ? <Image src={imageUrl} alt="" fill sizes="52px" unoptimized /> : <ImageOff aria-hidden="true" />}</span>
            <span className="cashier-cart-line-copy"><strong>{String(product.name)}</strong><small>Bs {Number(product.price).toFixed(2)} c/u</small><span className="cashier-quantity-control"><button type="button" aria-label={`Quitar una unidad de ${String(product.name)}`} onClick={() => setQuantity(line.productId, line.quantity - 1)}><Minus /></button><b>{line.quantity}</b><button type="button" aria-label={`Agregar una unidad de ${String(product.name)}`} disabled={line.quantity >= Number(product.stock)} onClick={() => setQuantity(line.productId, line.quantity + 1)}><Plus /></button><button type="button" className="remove" aria-label={`Quitar ${String(product.name)} del carrito`} onClick={() => setQuantity(line.productId, 0)}><Trash2 /></button></span></span>
            <strong className="cashier-cart-line-total">Bs {(Number(product.price) * line.quantity).toFixed(2)}</strong>
          </article>;
        }) : <div className="cashier-cart-empty"><ShoppingBag /><strong>Tu carrito está vacío</strong><span>Toca un producto para agregarlo.</span></div>}</div>

        <div className="cashier-cart-client">
          <label htmlFor="cashier-product-client-search">Cliente <small>Opcional</small></label>
          {client ? <><div className="cashier-client-picked"><span><strong>{String(client.full_name ?? client.email ?? "Cliente")}</strong><small>{String(client.phone ?? client.email ?? "")}</small></span><button type="button" onClick={() => { setClientId(""); setSelectedClient(null); setClientQuery(""); }}>Cambiar</button></div><CashierClientProfileCard client={client} visitHistory={visitHistory} /></> : <div className="cashier-client-picker"><Search aria-hidden="true" /><input id="cashier-product-client-search" type="search" value={clientQuery} onChange={event => { setClientQuery(event.target.value); setClientId(""); setSelectedClient(null); }} placeholder="Buscar nombre, teléfono o correo" autoComplete="off" aria-autocomplete="list" aria-controls="cashier-product-client-results" />{clientQuery.trim().length >= 2 && <div id="cashier-product-client-results" className="cashier-client-results" role="listbox" aria-label="Clientes encontrados" aria-busy={clientSearching}>{clientResults.map(item => <button type="button" role="option" aria-selected="false" key={item.id} onClick={() => chooseClient(item)}><strong>{String(item.full_name ?? "Sin nombre")}</strong><small>{String(item.phone ?? item.email ?? "")}</small></button>)}{clientSearching && <p role="status">Buscando clientes…</p>}{!clientSearching && clientResults.length === 0 && <p>No encontramos clientes.</p>}</div>}</div>}
          {clientId && <label className="cashier-barber-picker">Peluquero asociado<select name="recommended_by" value={barberId} onChange={event => setBarberId(event.target.value)} required><option value="">Elige quién recomendó</option>{barbers.map(barber => <option key={barber.id} value={barber.id}>{String(barber.display_name)}</option>)}</select></label>}
          {!clientId && <input type="hidden" name="recommended_by" value="" />}
          {clientId && <p className="cashier-cart-note">La compra acreditará {units * 5} puntos al cliente.</p>}
        </div>

        <button type="button" className={`cashier-option-toggle ${promotion ? "active" : ""}`} aria-pressed={promotion} onClick={() => { setPromotion(value => !value); setPromotionCode(""); }}><Gift />{promotion ? "Quitar promoción" : "Aplicar promoción"}</button>
        {promotion && <label className="cashier-promotion-code">Código de promoción<input name="promotion_code" value={promotionCode} onChange={event => setPromotionCode(event.target.value)} autoCapitalize="characters" required />{promotionQuote.loading ? <small role="status">Validando código…</small> : promotionCode.trim() && !promotionQuote.valid ? <small role="alert">{promotionQuote.message ?? "Código no válido o agotado."}</small> : promotionQuote.valid ? <small className="cashier-promotion-valid">Descuento aplicado: Bs {promotionQuote.discount.toFixed(2)}</small> : null}</label>}
        {!promotion && <input type="hidden" name="promotion_code" value="" />}
        <PaymentSplits total={payableTotal} onValidityChange={setPaymentValid} payments={payments} setPayments={setPayments} />
        <div className="cashier-cart-total"><span>{units} {units === 1 ? "unidad" : "unidades"}{promotion && promotionQuote.discount > 0 && <small>Subtotal Bs {total.toFixed(2)} · descuento − Bs {promotionQuote.discount.toFixed(2)}</small>}</span><div><small>Total a cobrar</small><strong>Bs {payableTotal.toFixed(2)}</strong></div></div>
        <button className="cashier-checkout-button" type="submit" disabled={busy || units === 0 || !paymentValid || !promotionReady}><Check aria-hidden="true" />{busy ? "Registrando venta…" : "Cobrar y emitir comprobante"}</button>
      </aside>
    </div>
  </form>;
}

export function PaymentSplits({ total, onValidityChange, payments, setPayments }: {
  total: number;
  onValidityChange: (valid: boolean) => void;
  payments: PaymentLine[];
  setPayments: (update: (current: PaymentLine[]) => PaymentLine[]) => void;
}) {
  const assigned = payments.reduce((sum, line) => sum + (Number(line.amount) || 0), 0);
  const complete = Math.abs(assigned - total) < 0.005;
  const remaining = Math.max(0, total - assigned);

  useEffect(() => { onValidityChange(complete); }, [complete, onValidityChange]);

  return <section className="cashier-payment-splits" aria-label="Formas de pago">
    <div className="cashier-split-heading"><strong>Forma de pago</strong><span className={complete ? "complete" : ""}>{complete ? "Total distribuido" : `Faltan Bs ${remaining.toFixed(2)}`}</span></div>
    {payments.map((payment, index) => <div className="cashier-payment-split" key={payment.id}>
      <input type="hidden" name="payment_amount" value={payment.amount} />
      <div className="cashier-payment-methods" role="group" aria-label={`Forma de pago ${index + 1}`}>
        {paymentMethods.map(method => {
          const Icon = method.icon;
          const usedElsewhere = payments.some(line => line.id !== payment.id && line.method === method.id);
          return <button type="button" key={method.id} aria-pressed={payment.method === method.id} disabled={usedElsewhere} className={payment.method === method.id ? "active" : ""} onClick={() => setPayments(current => current.map(line => line.id === payment.id ? { ...line, method: method.id } : line))}>
            {Icon && <Icon aria-hidden="true" />}<span>{method.label}</span>
          </button>;
        })}
      </div>
      <label className="cashier-split-amount">Monto<input type="number" name="payment_amount_display" min="0" max={total} step="0.01" value={payment.amount} onChange={event => setPayments(current => current.map(line => line.id === payment.id ? { ...line, amount: event.target.value } : line))} /></label>
      {payments.length > 1 && <button type="button" className="cashier-split-remove" aria-label={`Quitar pago ${index + 1}`} onClick={() => setPayments(current => current.filter(line => line.id !== payment.id))}><X /></button>}
      <input type="hidden" name="payment_method" value={payment.method} />
    </div>)}
    {payments.length < paymentMethods.length && <button type="button" className="cashier-split-add" onClick={() => setPayments(current => [...current, { id: `payment-${Date.now()}`, method: paymentMethods.find(method => !current.some(line => line.method === method.id))?.id ?? "cash", amount: "0.00" }])}><Plus /> Agregar otra forma de pago</button>}
    {!complete && <p className="cashier-split-hint">Asigna el total entre una o más formas de pago.</p>}
  </section>;
}
