import Image from "next/image";

export function RouteLoading() {
  return <main className="route-loading" aria-busy="true" aria-label="Cargando LEGEND CLUB">
    <div className="route-loading-glow" aria-hidden="true" />
    <div className="route-loading-logo-wrap">
      <div className="route-loading-logo">
        <Image src="/brand/loading-logo.jpeg" alt="" fill sizes="min(72vw, 360px)" priority />
      </div>
      <span className="route-loading-ring route-loading-ring-one" aria-hidden="true" />
      <span className="route-loading-ring route-loading-ring-two" aria-hidden="true" />
    </div>
    <div className="route-loading-copy">
      <strong>LEGEND CLUB</strong>
      <span>Preparando tu experiencia</span>
      <i aria-hidden="true"><b /></i>
    </div>
  </main>;
}
