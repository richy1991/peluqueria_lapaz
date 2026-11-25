import Image from "next/image";

export function RouteLoading() {
  return <main className="route-loading route-loading-simple" aria-busy="true" aria-label="Cargando LEGEND CLUB">
    <div className="route-loading-single">
      <div className="route-loading-single-logo" aria-hidden="true">
        <Image src="/brand/legend-club-emblem.webp" alt="" fill sizes="88px" preload />
      </div>
      <strong>LEGEND CLUB</strong>
      <span>Cargando…</span>
    </div>
  </main>;
}
