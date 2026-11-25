"use client";

import { useState } from "react";
import Link from "next/link";
import { X } from "lucide-react";
import { Brand } from "@/components/brand";
import { GoogleSignInCard } from "@/components/google-sign-in-card";
import { googleSignInPath } from "@/lib/supabase/google-redirect";

export function LoginForm({ next, initialError }: { next: string; initialError: string }) {
  const [loading, setLoading] = useState(false);
  async function login() {
    setLoading(true);
    window.location.replace(googleSignInPath(next));
  }

  return (
    <main className="login-shell">
      <div className="login-content">
        <header className="login-header">
          <Brand linked={false} />
          <Link className="login-close" replace href="/" aria-label="Cerrar inicio de sesión" title="Volver al inicio">
            <X size={21} aria-hidden="true" />
          </Link>
        </header>
        <GoogleSignInCard
          layout="page"
          heading="h1"
          title="Inicia sesión"
          description="Entra con Google para gestionar tus citas. Si es tu primera vez, crearemos tu cuenta."
          loading={loading}
          error={loading ? "" : initialError}
          onSignIn={login}
        />
      </div>
    </main>
  );
}
