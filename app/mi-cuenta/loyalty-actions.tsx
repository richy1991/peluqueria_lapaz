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

type BarberBalance = { barberId: string; barberName: string; balance: number };

export function RewardButton({ id, cost, accounts }: { id: string; cost: number; accounts: BarberBalance[] }) {
  const router = useRouter();
  const eligible = accounts.filter(account => account.balance >= cost);
  const closest = [...accounts].sort((a, b) => b.balance - a.balance)[0];
  const [selected, setSelected] = useState(eligible[0]?.barberId ?? "");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function redeem() {
    const account = eligible.find(item => item.barberId === selected);
    if (!account || !window.confirm(`¿Reservar este beneficio por ${cost} puntos con ${account.barberName}?`)) return;
    setBusy(true);
    const { data, error } = await createClient().rpc("request_reward_redemption", { target_reward_id: id, target_barber_id: selected });
    setBusy(false);
    if (error) return setMessage(error.message);
    setMessage(`Código: ${data}. Muéstralo en caja durante los próximos minutos.`);
    router.refresh();
  }

  return <div className="reward-action">
    {eligible.length > 1 && <select aria-label="Peluquero para el canje" value={selected} onChange={event => setSelected(event.target.value)}>
      {eligible.map(account => <option key={account.barberId} value={account.barberId}>{account.barberName} · {account.balance} pts</option>)}
    </select>}
    <button disabled={!eligible.length || busy} onClick={redeem}>{eligible.length ? `Usar ${cost} pts` : `Meta ${cost} pts`}</button>
    {!eligible.length && <small>{closest ? `Te faltan ${Math.max(cost - closest.balance, 0)} puntos con ${closest.barberName}.` : "Empieza a sumar puntos con tu peluquero."}</small>}
    {message && <small>{message}</small>}
  </div>;
}

export function CancelRedemptionButton({ id }: { id: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function cancel() {
    if (!window.confirm("¿Cancelar el canje y devolver los puntos?")) return;
    setBusy(true);
    const { error: cancelError } = await createClient().rpc("cancel_reward_redemption", { target_redemption_id: id });
    setBusy(false);
    if (cancelError) return setError(cancelError.message);
    router.refresh();
  }

  return <div className="reward-action">
    <button disabled={busy} onClick={cancel}>Cancelar</button>
    {error && <small>{error}</small>}
  </div>;
}
