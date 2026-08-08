"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function CancelAppointmentButton({ id }: { id: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function cancel() {
    if (!window.confirm("¿Confirmas la cancelación de esta cita?")) return;
    setBusy(true); setError("");
    const { error: actionError } = await createClient().rpc("cancel_own_appointment", { target_appointment_id: id });
    if (actionError) { setError(actionError.message); setBusy(false); return; }
    router.refresh();
  }
  return <div className="inline-action"><button disabled={busy} onClick={cancel}>{busy ? "Cancelando…" : "Cancelar cita"}</button>{error && <small>{error}</small>}</div>;
}
