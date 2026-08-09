import { BarChart3, CalendarDays, Clock3, Package, Scissors, TrendingDown, TrendingUp, Users } from "lucide-react";

type Summary = {
  registered_users?: number;
  new_users_current?: number;
  new_users_previous?: number;
  completed_current?: number;
  completed_previous?: number;
  service_value_current?: number;
  service_value_previous?: number;
  average_ticket_current?: number;
  product_units_current?: number;
  product_units_previous?: number;
  cancellation_rate?: number;
  no_show_rate?: number;
  repeat_clients?: number;
};

type MonthlyRow = { month: string; completed: number; service_value: number; new_users: number; product_units: number };
type RankedRow = { name: string; completed?: number; units?: number; service_value?: number; product_value?: number };
type DemandRow = { label: string; total: number; day_number?: number; hour_number?: number };
type BusyDate = { date: string; total: number };

export type AnalyticsData = {
  generated_at?: string;
  summary?: Summary;
  monthly?: MonthlyRow[];
  top_services?: RankedRow[];
  top_products?: RankedRow[];
  top_barbers?: RankedRow[];
  busy_dates?: BusyDate[];
  weekdays?: DemandRow[];
  hours?: DemandRow[];
  marketing?: {visitors_30d?:number;pageviews_30d?:number;reservation_clicks_30d?:number;whatsapp_clicks_30d?:number;paid_sales_current?:number;revenue_current?:number;commissions_current?:number;business_share_current?:number;top_paths?:Array<{path:string;total:number}>;top_sources?:Array<{source:string;total:number}>};
};

const number = new Intl.NumberFormat("es-BO");
const money = new Intl.NumberFormat("es-BO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function growth(current = 0, previous = 0) {
  if (previous === 0) return current > 0 ? null : 0;
  return ((current - previous) / previous) * 100;
}

function Trend({ current, previous }: { current?: number; previous?: number }) {
  const value = growth(Number(current ?? 0), Number(previous ?? 0));
  if (value === null) return <span className="analytics-trend neutral">Sin base anterior</span>;
  const positive = value >= 0;
  return <span className={`analytics-trend ${positive ? "positive" : "negative"}`}>{positive ? <TrendingUp /> : <TrendingDown />}{Math.abs(value).toFixed(1)}% vs. mes anterior</span>;
}

function Bars({ rows, value, detail, empty }: { rows: Array<{ label: string; value: number; detail?: string }>; value?: string; detail?: string; empty: string }) {
  const maximum = Math.max(...rows.map((row) => row.value), 1);
  if (!rows.length) return <p className="analytics-empty">{empty}</p>;
  return <div className="analytics-bars">{rows.map((row) => <div className="analytics-bar" key={row.label}>
    <div><strong>{row.label}</strong><span>{row.detail}</span></div>
    <div className="analytics-bar-track"><i style={{ width: `${Math.max(4, row.value / maximum * 100)}%` }} /></div>
    <b>{number.format(row.value)}{value}</b>
    {detail && <small>{detail}</small>}
  </div>)}</div>;
}

function monthLabel(key: string) {
  const [year, month] = key.split("-").map(Number);
  if (!year || !month) return key;
  return new Intl.DateTimeFormat("es-BO", { month: "short", year: "2-digit" }).format(new Date(year, month - 1, 1));
}

export function AdminAnalytics({ data }: { data: AnalyticsData | null }) {
  const summary = data?.summary ?? {};
  const monthly = data?.monthly ?? [];
  const mostDemandedMonth = [...monthly].sort((a, b) => Number(b.completed) - Number(a.completed))[0];
  const strongestDay = [...(data?.weekdays ?? [])].sort((a, b) => Number(b.total) - Number(a.total))[0];
  const strongestHour = data?.hours?.[0];

  return <div className="admin-panel analytics-panel">
    <div className="admin-title"><BarChart3 /><div><p>INTELIGENCIA DE NEGOCIO</p><h1>Estadísticas</h1></div></div>
    <p className="admin-help analytics-intro">Indicadores de los últimos 12 meses y comparación del mes actual. Las cifras económicas representan el valor registrado de servicios completados; se convertirán en ingresos cobrados cuando se incorpore el módulo de caja.</p>

    {!data ? <p className="admin-error">No fue posible cargar las estadísticas. Revisa que la migración de analítica esté aplicada.</p> : <>
      <section className="analytics-kpis">
        <article><span><Scissors /> Servicios completados este mes</span><strong>{number.format(Number(summary.completed_current ?? 0))}</strong><Trend current={summary.completed_current} previous={summary.completed_previous} /></article>
        <article><span><BarChart3 /> Valor de servicios completados</span><strong>Bs {money.format(Number(summary.service_value_current ?? 0))}</strong><Trend current={summary.service_value_current} previous={summary.service_value_previous} /></article>
        <article><span><Users /> Nuevos registros este mes</span><strong>{number.format(Number(summary.new_users_current ?? 0))}</strong><Trend current={summary.new_users_current} previous={summary.new_users_previous} /></article>
        <article><span><Package /> Productos recogidos este mes</span><strong>{number.format(Number(summary.product_units_current ?? 0))}</strong><Trend current={summary.product_units_current} previous={summary.product_units_previous} /></article>
      </section>

      <section className="analytics-snapshot">
        <article><small>Usuarios registrados</small><strong>{number.format(Number(summary.registered_users ?? 0))}</strong><span>Sin contar la cuenta técnica</span></article>
        <article><small>Clientes recurrentes</small><strong>{number.format(Number(summary.repeat_clients ?? 0))}</strong><span>Con 2 o más servicios completados</span></article>
        <article><small>Ticket promedio registrado</small><strong>Bs {money.format(Number(summary.average_ticket_current ?? 0))}</strong><span>Servicios completados este mes</span></article>
        <article><small>Cancelaciones</small><strong>{Number(summary.cancellation_rate ?? 0).toFixed(1)}%</strong><span>Sobre citas del mes</span></article>
        <article><small>Inasistencias</small><strong>{Number(summary.no_show_rate ?? 0).toFixed(1)}%</strong><span>Sobre citas del mes</span></article>
      </section>

      <section className="analytics-insights">
        <article><CalendarDays /><div><small>Mes de mayor demanda</small><strong>{mostDemandedMonth?.completed ? monthLabel(mostDemandedMonth.month) : "Sin datos suficientes"}</strong><span>{number.format(Number(mostDemandedMonth?.completed ?? 0))} servicios completados</span></div></article>
        <article><CalendarDays /><div><small>Día más solicitado</small><strong>{strongestDay?.label ?? "Sin datos suficientes"}</strong><span>{number.format(Number(strongestDay?.total ?? 0))} reservas registradas</span></div></article>
        <article><Clock3 /><div><small>Hora de mayor demanda</small><strong>{strongestHour?.label ?? "Sin datos suficientes"}</strong><span>{number.format(Number(strongestHour?.total ?? 0))} reservas registradas</span></div></article>
      </section>

      <section className="analytics-grid">
        <article className="analytics-card wide"><header><div><p>TENDENCIA</p><h2>Evolución mensual</h2></div><span>12 meses</span></header><Bars empty="Todavía no hay servicios completados." rows={monthly.map((row) => ({ label: monthLabel(row.month), value: Number(row.completed), detail: `Bs ${money.format(Number(row.service_value))} · ${number.format(Number(row.new_users))} registros` }))} /></article>
        <article className="analytics-card"><header><div><p>DEMANDA</p><h2>Servicios más solicitados</h2></div></header><Bars empty="Todavía no hay servicios completados." rows={(data.top_services ?? []).map((row) => ({ label: row.name, value: Number(row.completed ?? 0), detail: `Bs ${money.format(Number(row.service_value ?? 0))}` }))} /></article>
        <article className="analytics-card"><header><div><p>EQUIPO</p><h2>Peluqueros con mayor actividad</h2></div></header><Bars empty="Todavía no hay servicios completados por el equipo." rows={(data.top_barbers ?? []).map((row) => ({ label: row.name, value: Number(row.completed ?? 0), detail: `Bs ${money.format(Number(row.service_value ?? 0))} registrados` }))} /></article>
        <article className="analytics-card"><header><div><p>CATÁLOGO</p><h2>Productos más recogidos</h2></div></header><Bars empty="Todavía no hay productos marcados como recogidos." rows={(data.top_products ?? []).map((row) => ({ label: row.name, value: Number(row.units ?? 0), detail: `Bs ${money.format(Number(row.product_value ?? 0))}` }))} /></article>
        <article className="analytics-card"><header><div><p>PLANIFICACIÓN</p><h2>Demanda por día</h2></div></header><Bars empty="Todavía no hay demanda suficiente." rows={(data.weekdays ?? []).map((row) => ({ label: row.label, value: Number(row.total) }))} /></article>
        <article className="analytics-card wide"><header><div><p>FECHAS CLAVE</p><h2>Días con mayor demanda</h2></div><span>Top 10</span></header><div className="analytics-date-grid">{(data.busy_dates ?? []).length ? (data.busy_dates ?? []).map((row, index) => <div key={row.date}><b>{String(index + 1).padStart(2,"0")}</b><span>{new Intl.DateTimeFormat("es-BO",{dateStyle:"long",timeZone:"UTC"}).format(new Date(`${row.date}T12:00:00Z`))}</span><strong>{number.format(Number(row.total))} reservas</strong></div>) : <p className="analytics-empty">Todavía no existen fechas con demanda registrada.</p>}</div></article>
      </section>

      <aside className="analytics-note"><strong>Lectura de marketing:</strong> la actividad web se registra únicamente cuando el visitante acepta analítica. Los datos anteriores a esta implementación no pueden reconstruirse.</aside>
      <section className="analytics-card wide"><header><div><p>CAJA CONFIRMADA</p><h2>Resultado económico del mes</h2></div></header><div className="analytics-snapshot"><article><small>Ventas pagadas</small><strong>{number.format(Number(data.marketing?.paid_sales_current??0))}</strong><span>Operaciones confirmadas en caja</span></article><article><small>Total cobrado</small><strong>Bs {money.format(Number(data.marketing?.revenue_current??0))}</strong><span>Después de descuentos</span></article><article><small>Comisiones del equipo</small><strong>Bs {money.format(Number(data.marketing?.commissions_current??0))}</strong><span>Servicios e incentivos</span></article><article><small>Participación del negocio</small><strong>Bs {money.format(Number(data.marketing?.business_share_current??0))}</strong><span>Antes de gastos generales</span></article></div></section>
      <section className="analytics-card wide marketing-card"><header><div><p>MARKETING DIGITAL</p><h2>Actividad web con consentimiento · últimos 30 días</h2></div></header><div className="analytics-snapshot"><article><small>Visitantes</small><strong>{number.format(Number(data.marketing?.visitors_30d??0))}</strong><span>Sesiones únicas consentidas</span></article><article><small>Páginas vistas</small><strong>{number.format(Number(data.marketing?.pageviews_30d??0))}</strong><span>Navegación registrada</span></article><article><small>Clics en reservar</small><strong>{number.format(Number(data.marketing?.reservation_clicks_30d??0))}</strong><span>Intención de reserva</span></article><article><small>Clics en WhatsApp</small><strong>{number.format(Number(data.marketing?.whatsapp_clicks_30d??0))}</strong><span>Contacto comercial</span></article></div><div className="analytics-grid"><div><h3>Fuentes de tráfico</h3><Bars empty="Aún no hay campañas registradas." rows={(data.marketing?.top_sources??[]).map(row=>({label:row.source,value:Number(row.total)}))}/></div><div><h3>Páginas más vistas</h3><Bars empty="Aún no hay navegación registrada." rows={(data.marketing?.top_paths??[]).map(row=>({label:row.path,value:Number(row.total)}))}/></div></div></section>
    </>}
  </div>;
}
