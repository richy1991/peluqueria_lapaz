import Image from "next/image";

const logoSource = "/brand/loading-logo.jpeg";

export function RouteLoading() {
  return <main className="route-loading" aria-busy="true" aria-label="Cargando LEGEND CLUB">
    <div className="route-loading-aura" aria-hidden="true" />
    <div className="route-loading-mark" aria-hidden="true">
      <div className="route-loading-piece route-loading-piece-top-left">
        <Image src={logoSource} alt="" fill sizes="min(78vw, 420px)" priority />
      </div>
      <div className="route-loading-piece route-loading-piece-top-right">
        <Image src={logoSource} alt="" fill sizes="min(78vw, 420px)" priority />
      </div>
      <div className="route-loading-piece route-loading-piece-bottom-left">
        <Image src={logoSource} alt="" fill sizes="min(78vw, 420px)" priority />
      </div>
      <div className="route-loading-piece route-loading-piece-bottom-right">
        <Image src={logoSource} alt="" fill sizes="min(78vw, 420px)" priority />
      </div>
      <div className="route-loading-bear">
        <Image src={logoSource} alt="" fill sizes="min(78vw, 420px)" priority />
      </div>
    </div>
    <div className="route-loading-copy">
      <strong><span>LEGEND</span><span>CLUB</span></strong>
      <span>La experiencia comienza aquí</span>
      <i aria-hidden="true"><b /></i>
    </div>
  </main>;
}
