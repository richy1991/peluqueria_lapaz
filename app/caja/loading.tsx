export default function CashierLoading() {
  return <main className="cashier-loading" role="status" aria-live="polite" aria-busy="true">
    <span className="cashier-loading-brand">LEGEND CLUB <i /></span>
    <div className="cashier-loading-toolbar"><span /><span /><span /><span /><span /></div>
    <div className="cashier-loading-heading"><span /><div><i /><b /></div></div>
    <div className="cashier-loading-cards"><span /><span /><span /></div>
    <div className="cashier-loading-panel"><span /><span /><span /><span /></div>
    <span className="cashier-loading-label">Cargando caja…</span>
  </main>;
}
