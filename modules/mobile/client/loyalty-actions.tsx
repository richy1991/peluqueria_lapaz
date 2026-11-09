"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function ClaimVisitForm() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function claim(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const form = event.currentTarget;
    const data = new FormData(form);
    const { data: claimed, error: claimError } = await createClient().rpc("claim_guest_sale", { provided_code: String(data.get("code") ?? "") });
    setBusy(false);
    if (claimError || !claimed) return setError("Código inválido, utilizado o límite temporal alcanzado.");
    router.refresh();
    form.reset();
  }

  return <form className="portal-inline-form" onSubmit={claim}>
    <input name="code" maxLength={10} autoComplete="off" placeholder="Código del comprobante" required />
    <button disabled={busy}>Vincular atención</button>
    {error && <small>{error}</small>}
  </form>;
}
