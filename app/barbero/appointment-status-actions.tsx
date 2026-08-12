"use client";

import { FormEvent, useState } from "react";
import { CreditCard, Play, UserX } from "lucide-react";
import { useRouter } from "next/navigation";
import { DashboardModal } from "@/components/dashboard-modal";
import { dispatchDashboardError, dispatchDashboardSuccess, reportFormError } from "@/lib/form-feedback";
import { createClient } from "@/lib/supabase/client";

type Option = { id: string; name: string; price?: number; stock?: number };

export function AppointmentStatusActions({ id, status, defaultServiceId, services, products }: {
  id: string;
  status: string;
  defaultServiceId: string;
  services: Option[];
  products: Option[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function update(nextStatus: string) {
    setBusy(true); setError("");
    const { error: actionError } = await createClient().rpc("update_assigned_appointment", { target_appointment_id: id, next_status: nextStatus, note: null });
    setBusy(false);
    if (actionError) { setError(actionError.message); dispatchDashboardError(actionError.message); return; }
    dispatchDashboardSuccess(nextStatus === "in_progress" ? "Atención iniciada." : "Estado actualizado.");
    router.refresh();
  }

  async function sendToCashier(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setBusy(true); setError("");
    const { error: actionError } = await createClient().rpc("send_appointment_to_cashier", {
      target_appointment_id: id,
      actual_service: String(data.get("actual_service") ?? "") || null,
      extra_service: String(data.get("extra_service") ?? "") || null,
      suggested_product: String(data.get("product_id") ?? "") || null,
      suggested_quantity: Number(data.get("quantity") ?? 1),
      checkout_note: String(data.get("notes") ?? "") || null,
    });
    setBusy(false);
    if (actionError) {
      const message = reportFormError(form, actionError);
      setError(message); dispatchDashboardError(message); return;
    }
    dispatchDashboardSuccess("Atención enviada a la cola de cobro.");
    router.refresh();
  }

  if (status === "pending_payment") return <span className="dash-status-pill online"><i /> En caja</span>;
  return <div className="status-actions">
    {status === "confirmed" && <button disabled={busy} onClick={() => update("in_progress")}><Play /> Iniciar</button>}
    {["confirmed", "in_progress"].includes(status) && <DashboardModal title="Enviar atención a caja" description="Confirma lo realizado y registra extras antes de generar el cobro." triggerLabel="Enviar a caja" triggerIcon={<CreditCard />} size="large">
      <form className="admin-form" onSubmit={sendToCashier}>
        <label>Servicio realizado<select name="actual_service" defaultValue={defaultServiceId} required>{services.map(service => <option key={service.id} value={service.id}>{service.name} · Bs {service.price}</option>)}</select></label>
        <label>Servicio extra<select name="extra_service" defaultValue=""><option value="">Sin servicio extra</option>{services.map(service => <option key={service.id} value={service.id}>{service.name} · Bs {service.price}</option>)}</select></label>
        <label>Producto aplicado o vendido<select name="product_id" defaultValue=""><option value="">Sin producto</option>{products.map(product => <option key={product.id} value={product.id}>{product.name} · stock {product.stock}</option>)}</select></label>
        <label>Cantidad<input name="quantity" type="number" min="1" max="20" defaultValue="1" /></label>
        <label className="wide">Nota para caja<textarea name="notes" rows={3} placeholder="Detalle del cambio, aplicación o producto adicional" /></label>
        <button className="button button-dark wide" disabled={busy}><CreditCard /> Confirmar y enviar a cobro</button>
      </form>
    </DashboardModal>}
    {["confirmed", "in_progress"].includes(status) && <button className="danger" disabled={busy} onClick={() => update("no_show")}><UserX /> No asistió</button>}
    {error && <small>{error}</small>}
  </div>;
}
