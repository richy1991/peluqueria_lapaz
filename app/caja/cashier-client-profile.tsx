"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export type CashierClientProfile = Record<string, unknown> & { id: string };
export type CashierVisit = Record<string, unknown> & { id: string };

export function CashierClientProfileCard({ client, visitHistory }: { client: CashierClientProfile | null; visitHistory: CashierVisit[] }) {
  const [snapshot, setSnapshot] = useState<{ points_balance: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const clientId = client?.id ?? "";
  const recentVisits = visitHistory.filter(item => String(item.client_id ?? "") === clientId && ["completed", "pending_payment"].includes(String(item.status)))
    .sort((a, b) => new Date(String(b.starts_at)).getTime() - new Date(String(a.starts_at)).getTime()).slice(0, 3);

  useEffect(() => {
    if (!clientId) { setSnapshot(null); setLoading(false); return; }
    let active = true;
    setSnapshot(null);
    setLoading(true);
    const load = async () => {
      try {
        const { data } = await createClient().rpc("cashier_client_loyalty_snapshot", { target_client_id: clientId });
        if (active) setSnapshot((data as { points_balance: number } | null) ?? { points_balance: 0 });
      } catch {
        if (active) setSnapshot({ points_balance: 0 });
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => { active = false; };
  }, [clientId]);

  if (!client) return null;
  return <section className="cashier-client-profile" aria-label={`Perfil de ${String(client.full_name ?? "cliente")}`}>
    <div className="cashier-client-profile-head"><span className="cashier-client-avatar">{String(client.full_name ?? "C").trim().slice(0, 1).toLocaleUpperCase("es")}</span><span><small>PERFIL DEL CLIENTE</small><strong>{String(client.full_name ?? client.email ?? "Cliente")}</strong><span>{String(client.phone ?? client.email ?? "Sin contacto")}</span></span><span className="cashier-client-points"><small>PUNTOS</small><strong aria-live="polite">{loading ? "…" : Number(snapshot?.points_balance ?? 0)}</strong></span></div>
    <div className="cashier-client-profile-meta"><span><small>CÓDIGO</small><strong>{String(client.referral_code ?? "Aún sin código")}</strong></span><span><small>VISITAS RECIENTES</small><strong>{recentVisits.length || "Sin visitas recientes"}</strong></span></div>
    {recentVisits.length > 0 && <ol>{recentVisits.map(item => <li key={item.id}><time>{new Intl.DateTimeFormat("es-BO", { dateStyle: "medium" }).format(new Date(String(item.starts_at)))}</time><span>{String(item.service_name_snapshot ?? "Servicio")}<small>{String(item.barber_name_snapshot ?? "Peluquero")}</small></span></li>)}</ol>}
  </section>;
}
