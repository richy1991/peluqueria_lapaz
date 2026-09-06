"use client";

import { useState } from "react";
import Link from "next/link";
import { Brand } from "@/components/brand";
import { createClient } from "@/lib/supabase/client";

export function AdminLoginForm() {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function login() {
    setLoading(true);
    setError("");
    const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent("/panel")}`;
    const { data, error: authError } = await createClient().auth.signInWithOAuth({ provider: "google", options: { redirectTo, skipBrowserRedirect: true } });
    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }
    if (data.url) window.location.replace(data.url);
    else { setError("No pudimos abrir el acceso con Google."); setLoading(false); }
  }

  return <main className="admin-login-shell"><section className="admin-login-card"><Brand/><p className="eyebrow">ACCESO INTERNO</p><h1>Panel administrador</h1><p>Inicia sesión con una cuenta Google autorizada. Si ya tienes sesión, entrarás directamente al panel que corresponda.</p><button className="google-button" onClick={login} disabled={loading}><b>G</b> {loading ? "Conectando…" : "Continuar con Google"}</button>{error && <p className="admin-error">{error}</p>}<Link replace href="/">Volver a la web pública</Link></section></main>;
}
