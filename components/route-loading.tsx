export function RouteLoading() {
  return <main className="route-loading" aria-busy="true" aria-label="Cargando contenido">
    <header className="route-loading-header"><span className="route-loading-mark" /><span className="route-loading-brand" /><span className="route-loading-action" /></header>
    <section className="route-loading-hero"><span /><strong /><p /></section>
    <section className="route-loading-grid">
      <article><i /><b /><small /></article>
      <article><i /><b /><small /></article>
      <article className="wide"><i /><b /><b /><small /></article>
      <article><i /><b /><small /></article>
    </section>
    <p className="route-loading-label">Cargando información…</p>
  </main>;
}
