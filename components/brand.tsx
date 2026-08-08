import Link from "next/link";

export function Brand() {
  return (
    <Link className="brand" href="/" aria-label="Navaja, ir al inicio">
      <span className="brand-mark" aria-hidden="true">N</span>
      <span>
        <strong>NAVAJA</strong>
        <small>PELUQUERÍA & BARBERÍA</small>
      </span>
    </Link>
  );
}
