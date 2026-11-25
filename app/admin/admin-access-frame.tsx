import type { ReactNode } from "react";
import Link from "next/link";
import { X } from "lucide-react";
import { Brand } from "@/components/brand";
import "../login/login.css";

export function AdminAccessFrame({ children }: { children: ReactNode }) {
  return <main className="login-shell admin-access">
    <div className="login-content">
      <header className="login-header">
        <Brand linked={false} />
        <Link href="/" replace className="login-close" aria-label="Volver al sitio público" title="Volver al sitio público">
          <X size={21} aria-hidden="true" />
        </Link>
      </header>
      {children}
    </div>
  </main>;
}
