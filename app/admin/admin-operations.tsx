"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {DashboardModal} from "@/components/dashboard-modal";
import { clearFormErrors, dispatchDashboardError, dispatchDashboardSuccess, reportFormError } from "@/lib/form-feedback";
import { zonedDateTimeToDate } from "@/lib/business-time";
import { AdminDeleteAction } from "./admin-delete-action";

export function AppointmentAdminActions({ id, barbers, timezone }: { id: string; barbers: Array<{ id: string; display_name: string; active?: boolean }>; timezone: string }) {
  const router=useRouter(); const [busy,setBusy]=useState(false); const [error,setError]=useState("");
  async function setStatus(nextStatus:string){setBusy(true);setError("");const {error:e}=await createClient().rpc("admin_set_appointment_status",{target_appointment_id:id,next_status:nextStatus,reason:null});if(e){setError(e.message);dispatchDashboardError(e.message);setBusy(false);return;}setBusy(false);dispatchDashboardSuccess("Estado de la cita actualizado.");router.refresh();}
  async function reassign(event:FormEvent<HTMLFormElement>){event.preventDefault();const form=event.currentTarget;clearFormErrors(form);setBusy(true);setError("");const data=new FormData(form);try{const startsAt=zonedDateTimeToDate(String(data.get("starts_at")),timezone).toISOString();const {error:e}=await createClient().rpc("admin_reassign_appointment",{target_appointment_id:id,target_barber_id:String(data.get("barber_id")),target_starts_at:startsAt});if(e)throw e;setBusy(false);dispatchDashboardSuccess("Cita reasignada; el cliente debe confirmar la propuesta.");router.refresh();}catch(reason){const message=reportFormError(form,reason,"starts_at");setError(message);dispatchDashboardError(message);setBusy(false);}}
  return <div className="admin-operation"><div><button disabled={busy} onClick={()=>setStatus("confirmed")}>Confirmar</button><button disabled={busy} onClick={()=>setStatus("needs_reschedule")}>Reprogramar</button><button disabled={busy} onClick={()=>setStatus("canceled")}>Cancelar</button><DashboardModal title="Reasignar cita" description="El cliente deberá confirmar la nueva propuesta." triggerLabel="Cambiar horario" variant="ghost"><form className="admin-form" onSubmit={reassign}><label>Peluquero<select name="barber_id" required defaultValue=""><option value="" disabled>Seleccionar</option>{barbers.filter(x=>x.active).map(x=><option key={x.id} value={x.id}>{x.display_name}</option>)}</select></label><label>Fecha y hora<input name="starts_at" type="datetime-local" required/></label><button className="button button-dark wide" disabled={busy}>Guardar propuesta</button></form></DashboardModal></div>{error&&<small>{error}</small>}</div>;
}

export function ClientAdminActions({ id, name, status, blocked, blockedReason }: {
  id: string;
  name: string;
  status: string;
  blocked: boolean;
  blockedReason?: string | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [pendingStatus, setPendingStatus] = useState<string | null>(null);
  const [reason, setReason] = useState("");

  async function update(nextStatus: string, nextBlocked: boolean, blockReason: string | null = null) {
    setBusy(true);
    setError("");
    try {
      const { error: updateError } = await createClient().rpc("admin_update_client", {
        target_user_id: id,
        next_status: nextStatus,
        blocked: nextBlocked,
        reason: blockReason,
      });
      if (updateError) throw updateError;
      setPendingStatus(null);
      setReason("");
      dispatchDashboardSuccess("Estado del cliente actualizado.");
      router.refresh();
    } catch (cause) {
      const message = cause && typeof cause === "object" && "message" in cause ? String(cause.message) : "No se pudo actualizar la cuenta. Inténtalo de nuevo.";
      setError(message);
      dispatchDashboardError(message);
    } finally {
      setBusy(false);
    }
  }

  function requestUpdate(nextStatus: string, nextBlocked: boolean) {
    setError("");
    if (nextBlocked && (!blocked || !blockedReason?.trim())) {
      setPendingStatus(nextStatus);
      setReason("");
      return;
    }
    void update(nextStatus, nextBlocked, nextBlocked ? blockedReason ?? null : null);
  }

  function confirmBlock(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pendingStatus === null) return;
    if (!reason.trim()) {
      setError("Escribe un motivo para bloquear la cuenta.");
      return;
    }
    void update(pendingStatus, true, reason.trim());
  }

  const disabled = busy || pendingStatus !== null;
  return (
    <div className="admin-operation client-admin-actions">
      <div className="client-action-buttons">
        {status === "active" ? <button type="button" disabled={disabled} onClick={() => requestUpdate("deactivated", blocked)}>Dar de baja</button> : <button type="button" disabled={disabled} onClick={() => requestUpdate("active", false)}>Reactivar</button>}
        <button type="button" disabled={disabled} onClick={() => requestUpdate(status, !blocked)}>{blocked ? "Desbloquear" : "Bloquear"}</button>
        <AdminDeleteAction entity="client" id={id} label={name} disabled={disabled} />
      </div>
      {pendingStatus !== null && (
        <form className="client-block-form" onSubmit={confirmBlock}>
          <label htmlFor={`client-block-reason-${id}`}>Motivo del bloqueo</label>
          <textarea id={`client-block-reason-${id}`} value={reason} onChange={(event) => setReason(event.target.value)} required maxLength={500} rows={3} disabled={busy} autoFocus placeholder="Explica por qué se bloquea esta cuenta" />
          <div>
            <button type="button" disabled={busy} onClick={() => { setPendingStatus(null); setReason(""); setError(""); }}>Cancelar</button>
            <button type="submit" disabled={busy}>{busy ? "Guardando…" : "Confirmar bloqueo"}</button>
          </div>
        </form>
      )}
      {error && <p className="client-action-error" role="alert">{error}</p>}
    </div>
  );
}
