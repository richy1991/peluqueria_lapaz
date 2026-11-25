"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function ClaimVisitForm() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ message: string; error: boolean }>();

  async function claim(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setFeedback(undefined);
    const form = event.currentTarget;
    const data = new FormData(form);
    try {
      const { data: claimed, error: claimError } = await createClient().rpc("claim_guest_sale", { provided_code: String(data.get("code") ?? "").trim() });
      if (claimError || !claimed) {
        setFeedback({ message: "El código es inválido, ya se usó o alcanzaste el límite temporal de intentos.", error: true });
        return;
      }
      form.reset();
      setFeedback({ message: "Visita vinculada a tu cuenta.", error: false });
      router.refresh();
    } catch {
      setFeedback({ message: "No pudimos vincular la visita. Intenta de nuevo.", error: true });
    } finally {
      setBusy(false);
    }
  }

  return <form className="client-points-claim" onSubmit={claim}>
    <label htmlFor="visit-receipt-code">Código del comprobante</label>
    <input id="visit-receipt-code" name="code" maxLength={10} autoComplete="off" autoCapitalize="characters" spellCheck={false} required />
    <button type="submit" disabled={busy}>{busy ? "Vinculando…" : "Vincular visita"}</button>
    {feedback && <p className="client-points-feedback" role={feedback.error ? "alert" : "status"}>{feedback.message}</p>}
  </form>;
}
