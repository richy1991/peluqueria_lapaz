"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {DashboardModal} from "@/components/dashboard-modal";
import { clearFormErrors, dispatchDashboardError, dispatchDashboardSuccess, reportFormError } from "@/lib/form-feedback";

export function AppointmentAdminActions({ id, barbers }: { id: string; barbers: Array<{ id: string; display_name: string; active?: boolean }> }) {
  const router=useRouter(); const [busy,setBusy]=useState(false); const [error,setError]=useState("");
  async function setStatus(nextStatus:string){setBusy(true);setError("");const {error:e}=await createClient().rpc("admin_set_appointment_status",{target_appointment_id:id,next_status:nextStatus,reason:null});if(e){setError(e.message);dispatchDashboardError(e.message);setBusy(false);return;}setBusy(false);dispatchDashboardSuccess("Estado de la cita actualizado.");router.refresh();}
  async function reassign(event:FormEvent<HTMLFormElement>){event.preventDefault();const form=event.currentTarget;clearFormErrors(form);setBusy(true);setError("");const data=new FormData(form);const local=String(data.get("starts_at"));const {error:e}=await createClient().rpc("admin_reassign_appointment",{target_appointment_id:id,target_barber_id:String(data.get("barber_id")),target_starts_at:new Date(`${local}:00-04:00`).toISOString()});if(e){const message=reportFormError(form,e,"starts_at");setError(message);dispatchDashboardError(message);setBusy(false);return;}setBusy(false);dispatchDashboardSuccess("Cita reasignada; el cliente debe confirmar la propuesta.");router.refresh();}
  return <div className="admin-operation"><div><button disabled={busy} onClick={()=>setStatus("confirmed")}>Confirmar</button><button disabled={busy} onClick={()=>setStatus("needs_reschedule")}>Reprogramar</button><button disabled={busy} onClick={()=>setStatus("canceled")}>Cancelar</button><DashboardModal title="Reasignar cita" description="El cliente deberá confirmar la nueva propuesta." triggerLabel="Cambiar horario" variant="ghost"><form className="admin-form" onSubmit={reassign}><label>Peluquero<select name="barber_id" required defaultValue=""><option value="" disabled>Seleccionar</option>{barbers.filter(x=>x.active).map(x=><option key={x.id} value={x.id}>{x.display_name}</option>)}</select></label><label>Fecha y hora<input name="starts_at" type="datetime-local" required/></label><button className="button button-dark wide" disabled={busy}>Guardar propuesta</button></form></DashboardModal></div>{error&&<small>{error}</small>}</div>;
}

export function ClientAdminActions({ id, status, blocked }: { id:string; status:string; blocked:boolean }) {
  const router=useRouter(); const [busy,setBusy]=useState(false); const [error,setError]=useState("");
  async function update(nextStatus:string,nextBlocked:boolean){const reason=nextBlocked?window.prompt("Motivo del bloqueo:")??"Bloqueo administrativo":null;setBusy(true);setError("");const {error:e}=await createClient().rpc("admin_update_client",{target_user_id:id,next_status:nextStatus,blocked:nextBlocked,reason});if(e){setError(e.message);dispatchDashboardError(e.message);setBusy(false);return;}setBusy(false);dispatchDashboardSuccess("Estado del cliente actualizado.");router.refresh();}
  return <div className="admin-operation"><div>{status==="active"?<button disabled={busy} onClick={()=>update("deactivated",blocked)}>Dar de baja</button>:<button disabled={busy} onClick={()=>update("active",false)}>Reactivar</button>}<button disabled={busy} onClick={()=>update(status,!blocked)}>{blocked?"Desbloquear":"Bloquear"}</button></div>{error&&<small>{error}</small>}</div>;
}
