import Image from "next/image";

export function RouteLoading() {
  return <main className="route-loading route-loading-simple" aria-busy="true" aria-label="Cargando LEGEND CLUB">
    <div className="route-loading-single">
      <div className="route-loading-single-logo" aria-hidden="true">
        <Image src="/brand/loading-logo.jpeg" alt="" fill sizes="min(76vw, 380px)" priority />
      </div>
      <strong>LEGEND CLUB</strong>
      <span>Cargando</span>
    </div>
  </main>;
}
