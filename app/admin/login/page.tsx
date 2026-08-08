"use client";

import { useState } from "react";
import Link from "next/link";
import { Brand } from "@/components/brand";
import { createClient } from "@/lib/supabase/client";

export default function AdminLoginPage() {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function login() {
    setLoading(true);
    setError("");
    const supabase = createClient();
    const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent("/admin")}`;
    const { error: authError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo },
    });
    if (authError) {
      setError(authError.message);
      setLoading(false);
    }
  }

  return (
    <main className="admin-login-shell">
      <section className="admin-login-card">
        <Brand />
        <p className="eyebrow">ACCESO INTERNO</p>
        <h1>Panel administrador</h1>
        <p>Inicia sesión con una cuenta Google autorizada como administrador.</p>
        <button className="google-button" onClick={login} disabled={loading}>
          <b>G</b> {loading ? "Conectando…" : "Continuar con Google"}
        </button>
        {error && <p className="admin-error">{error}</p>}
        <Link href="/">Volver a la web pública</Link>
      </section>
    </main>
  );
}
