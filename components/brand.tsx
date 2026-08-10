import Link from "next/link";
import Image from "next/image";

export function Brand({ linked = true }: { linked?: boolean }) {
  const identity = (
    <>
      <span className="brand-mark" aria-hidden="true">
        <Image src="/brand/legend-club-emblem.webp" alt="" width={52} height={52} priority />
      </span>
      <span>
        <strong>LEGEND CLUB</strong>
        <small>BARBERÍA · LA PAZ</small>
      </span>
    </>
  );

  if (!linked) return <div className="brand" aria-label="Barbería Legend Club">{identity}</div>;
  return <Link className="brand" href="/" aria-label="Barbería Legend Club, ir al inicio">{identity}</Link>;
}
