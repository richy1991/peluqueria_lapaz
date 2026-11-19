import { redirect } from "next/navigation";
import { CalendarDays, PackageCheck, Scissors } from "lucide-react";
import { ClientSecondaryPage } from "@/modules/mobile/client/client-secondary-page";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function ClientHistoryPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=%2Fmi-cuenta%2Fhistorial");
  const [appointments, sales, reservations, settings] = await Promise.all([
    loadAllPages(from => supabase.from("appointments").select("id,starts_at,status,price_snapshot,service_name_snapshot,barber_name_snapshot,barber_profiles!appointments_barber_id_fkey(display_name)").eq("client_id", user.id).order("starts_at", { ascending: false }).range(from, from + 499)),
    loadAllPages(from => supabase.from("sales").select("id,status,created_at,sale_items(id,item_type,name_snapshot,quantity,unit_price_snapshot)").eq("client_id", user.id).order("created_at", { ascending: false }).range(from, from + 499)),
    loadAllPages(from => supabase.from("product_reservations").select("id,status,quantity,price_snapshot,created_at,expires_at,products(name)").eq("client_id", user.id).order("created_at", { ascending: false }).range(from, from + 499)),
    supabase.from("business_settings").select("timezone").eq("id", true).maybeSingle(),
  ]);
  if (settings.error) throw new Error(settings.error.message);
  const timezone = settings.data?.timezone ?? "America/La_Paz";
  const serviceSales = sales.flatMap(sale => (sale.sale_items ?? []).filter(item => item.item_type === "service").map(item => ({ sale, item })));

  return <ClientSecondaryPage title="Mi historial">
    <div className="client-history-list">
      <section className="portal-card client-secondary-card"><div className="portal-title"><CalendarDays /><div><small>RESERVAS</small><h2>Citas</h2></div></div>
        {appointments.length ? appointments.map(item => {
          const barber = Array.isArray(item.barber_profiles) ? item.barber_profiles[0]?.display_name : item.barber_profiles?.display_name;
          return <article className="client-history-row" key={item.id}><div><strong>{item.service_name_snapshot}</strong><span>{new Intl.DateTimeFormat("es-BO", { dateStyle: "full", timeStyle: "short", timeZone: timezone }).format(new Date(item.starts_at))}</span><small>{barber ?? item.barber_name_snapshot ?? "Peluquero"}</small></div><div><b>{statusLabel(item.status)}</b><strong>Bs {item.price_snapshot}</strong></div></article>;
        }) : <p className="portal-empty">Aún no tienes citas.</p>}
      </section>
      <section className="portal-card client-secondary-card"><div className="portal-title"><Scissors /><div><small>ATENCIONES</small><h2>Servicios cobrados</h2></div></div>
        {serviceSales.length ? serviceSales.map(({ sale, item }) => <article className="client-history-row" key={`${sale.id}-${item.id}`}><div><strong>{item.name_snapshot}{item.quantity > 1 ? ` ×${item.quantity}` : ""}</strong><span>{new Intl.DateTimeFormat("es-BO", { dateStyle: "medium", timeZone: timezone }).format(new Date(sale.created_at))}</span></div><div><b>{statusLabel(sale.status)}</b><strong>Bs {(Number(item.unit_price_snapshot) * item.quantity).toFixed(2)}</strong></div></article>) : <p className="portal-empty">Aún no tienes servicios cobrados.</p>}
      </section>
      <section className="portal-card client-secondary-card"><div className="portal-title"><PackageCheck /><div><small>PRODUCTOS</small><h2>Apartados</h2></div></div>
        {reservations.length ? reservations.map(item => {
          const product = Array.isArray(item.products) ? item.products[0]?.name : item.products?.name;
          const status = item.status === "reserved" && Date.parse(item.expires_at) < Date.now() ? "expired" : item.status;
          return <article className="client-history-row" key={item.id}><div><strong>{product ?? "Producto"}{item.quantity > 1 ? ` ×${item.quantity}` : ""}</strong><span>{new Intl.DateTimeFormat("es-BO", { dateStyle: "medium", timeZone: timezone }).format(new Date(item.created_at))}</span></div><div><b>{statusLabel(status)}</b><strong>Bs {(Number(item.price_snapshot) * item.quantity).toFixed(2)}</strong></div></article>;
        }) : <p className="portal-empty">Aún no tienes apartados.</p>}
      </section>
    </div>
  </ClientSecondaryPage>;
}

async function loadAllPages<T>(load: (from: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>) {
  const rows: T[] = [];
  for (let from = 0; ; from += 500) {
    const result = await load(from);
    if (result.error) throw new Error(result.error.message);
    const page = result.data ?? [];
    rows.push(...page);
    if (page.length < 500) return rows;
  }
}

function statusLabel(status: string) {
  return ({ requested: "Solicitada", confirmed: "Confirmada", in_progress: "En curso", pending_payment: "En caja", pending_client_confirmation: "Confirma cambio", needs_reschedule: "Reprogramar", completed: "Completada", canceled: "Cancelada", no_show: "Inasistencia", paid: "Pagado", refunded: "Reembolsado", reserved: "Apartado", collected: "Retirado", expired: "Vencido", draft: "En proceso" } as Record<string, string>)[status] ?? status;
}
