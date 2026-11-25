import { Gift, History, ReceiptText, Scissors, Star } from "lucide-react";
import { ClaimVisitForm } from "./loyalty-actions";
import { ReferralCode } from "./referral-code";

type Balance = {
  barber_id: string;
  balance: number;
  lifetime_earned: number;
  lifetime_redeemed: number;
  barber_profiles: unknown;
};

type Movement = {
  id: string;
  points: number;
  reason: string;
  created_at: string;
  barber_id_snapshot: string | null;
  barber_profiles: unknown;
};

function barberName(relation: unknown) {
  const barber = relation as { display_name?: string } | { display_name?: string }[] | null;
  return (Array.isArray(barber) ? barber[0] : barber)?.display_name;
}

export function ClientPointsView({ balances, movements, referralCode, timezone, balancesUnavailable, movementsUnavailable }: {
  balances: Balance[];
  movements: Movement[];
  referralCode?: string | null;
  timezone: string;
  balancesUnavailable: boolean;
  movementsUnavailable: boolean;
}) {
  const formatDate = new Intl.DateTimeFormat("es-BO", { dateStyle: "medium", timeZone: timezone });
  return <div className="client-points-layout">
    <section className="client-points-card client-points-balances" aria-labelledby="points-balances">
      <h2 id="points-balances"><Star size={20} aria-hidden="true" /> Saldos por barbero</h2>
      {balancesUnavailable ? <p className="client-points-empty" role="alert">No pudimos cargar tus saldos.</p>
        : balances.length ? <ul className="client-points-balances-list">
          {balances.map((account) => (
            <li key={account.barber_id}>
              <h3><Scissors size={16} aria-hidden="true" /> {barberName(account.barber_profiles) ?? "Barbero"}</h3>
              <p><strong>{account.balance}</strong> disponibles</p>
              <dl>
                <div><dt>Ganados</dt><dd>{account.lifetime_earned}</dd></div>
                <div><dt>Canjeados</dt><dd>{account.lifetime_redeemed}</dd></div>
              </dl>
            </li>
          ))}
        </ul>
        : <p className="client-points-empty">Aún no tienes puntos.</p>}
    </section>

    <div className="client-points-actions">
      <section className="client-points-card" aria-labelledby="points-referral">
        <h2 id="points-referral"><Gift size={20} aria-hidden="true" /> Recomendar</h2>
        {referralCode
          ? <><p>Comparte tu código para la primera visita de la persona que recomiendas.</p><ReferralCode code={referralCode} /></>
          : <p>Tu código de recomendación aún no está disponible.</p>}
      </section>
      <section className="client-points-card" aria-labelledby="points-claim">
        <h2 id="points-claim"><ReceiptText size={20} aria-hidden="true" /> Agregar una visita</h2>
        <ClaimVisitForm />
      </section>
    </div>

    <section className="client-points-card client-points-history" aria-labelledby="points-history">
      <h2 id="points-history"><History size={20} aria-hidden="true" /> Movimientos de puntos</h2>
      {movementsUnavailable ? <p className="client-points-empty" role="alert">No pudimos cargar tus movimientos.</p>
        : movements.length ? <ul className="client-points-movements">
          {movements.map((item) => (
            <li key={item.id}>
              <div>
                <strong>{item.reason}</strong>
                <span>{barberName(item.barber_profiles) ?? (item.barber_id_snapshot ? "Barbero eliminado" : "Barbero")} · <time dateTime={item.created_at}>{formatDate.format(new Date(item.created_at))}</time></span>
              </div>
              <b data-points={item.points > 0 ? "added" : item.points < 0 ? "removed" : "unchanged"}>{item.points > 0 ? "+" : ""}{item.points}</b>
            </li>
          ))}
        </ul>
        : <p className="client-points-empty">Aún no tienes movimientos.</p>}
    </section>
  </div>;
}
