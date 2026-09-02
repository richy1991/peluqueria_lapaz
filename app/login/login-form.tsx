"use client";

import { useState } from "react";
import Link from "next/link";
import { Brand } from "@/components/brand";
import { createClient } from "@/lib/supabase/client";

export function LoginForm({ next, initialError }: { next: string; initialError: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(initialError);

  async function login() {
    setLoading(true);
    setError("");
    const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;
    const { error: authError } = await createClient().auth.signInWithOAuth({ provider: "google", options: { redirectTo } });
    if (authError) {
      setError(authError.message);
      setLoading(false);
    }
  }

  return <main className="login-shell"><section className="login-card"><Brand/><p className="eyebrow">CUENTA LEGEND</p><h1>Entra con Google.</h1><p>Si es tu primera vez, crearemos automáticamente tu cuenta de cliente. Si ya iniciaste sesión, te llevaremos directamente a tu destino.</p><button className="google-button" onClick={login} disabled={loading}><b>G</b>{loading ? "Conectando…" : "Continuar con Google"}</button>{error && <p className="login-error">{error}</p>}<small>No utilizamos contraseñas propias. Tu acceso se protege con Google y Supabase.</small><Link href="/">Volver al inicio</Link></section></main>;
}
