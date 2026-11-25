import Link from "next/link";
import { Store } from "lucide-react";

export function PublicHomeLink({ className }: { className?: string }) {
  return <Link className={className ? `public-home-link ${className}` : "public-home-link"} href="/" aria-label="Inicio de Legend Club">
    <Store size={16} strokeWidth={1.8} aria-hidden="true" /> <span>Inicio</span>
  </Link>;
}
