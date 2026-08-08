"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function AppointmentStatusActions({ id, status }: { id: string; status: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function update(nextStatus: string) {
    setBusy(true); setError("");
    const { error: actionError } = await createClient().rpc("update_assigned_appointment", { target_appointment_id: id, next_status: nextStatus, note: null });
    if (actionError) { setError(actionError.message); setBusy(false); return; }
    router.refresh();
  }
  return <div className="status-actions">
    {status === "confirmed" && <button disabled={busy} onClick={() => update("in_progress")}>Iniciar cita</button>}
    {status === "in_progress" && <button disabled={busy} onClick={() => update("completed")}>Completar</button>}
    {["confirmed","in_progress"].includes(status) && <button className="danger" disabled={busy} onClick={() => update("no_show")}>No asistió</button>}
    {error && <small>{error}</small>}
  </div>;
}
