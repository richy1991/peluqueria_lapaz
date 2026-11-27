"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { Eye, EyeOff, LockKeyhole, ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type LinkState = "checking" | "ready" | "invalid";

export function ResetPasswordForm() {
  const [linkState, setLinkState] = useState<LinkState>("checking");
  const [password, setPassword] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;
    void createClient().auth.getUser().then(({ data, error: authError }) => {
      if (!active) return;
      setLinkState(!authError && data.user ? "ready" : "invalid");
    });
    return () => { active = false; };
  }, []);

  async function savePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (password.length < 8) {
      setError("La contraseña debe tener al menos 8 caracteres.");
      return;
    }
    setLoading(true);
    setError("");
    setMessage("");
    try {
      const { error: updateError } = await createClient().auth.updateUser({ password });
      if (updateError) throw updateError;
      setMessage("Tu contraseña se actualizó correctamente.");
      setPassword("");
    } catch (reason) {
      const detail = reason instanceof Error ? reason.message.toLowerCase() : "";
      setError(detail.includes("password") ? "La contraseña debe tener al menos 8 caracteres." : "No pudimos cambiar tu contraseña. Solicita un enlace nuevo.");
    } finally {
      setLoading(false);
    }
  }

  return <main className="reset-password-shell">
    <section className="reset-password-card" aria-labelledby="reset-password-title">
      <span className="reset-password-icon"><LockKeyhole size={21} aria-hidden="true" /></span>
      <p className="reset-password-eyebrow"><ShieldCheck size={13} aria-hidden="true" /> RECUPERAR CUENTA</p>
      <h1 id="reset-password-title">Crea una nueva contraseña</h1>
      <p className="reset-password-description">Usa al menos 8 caracteres para proteger tu cuenta.</p>

      {linkState === "checking" && <p className="reset-password-status" role="status">Validando el enlace…</p>}
      {linkState === "invalid" && <p className="reset-password-error" role="alert">Este enlace de recuperación no es válido o ya venció. Solicita uno nuevo.</p>}
      {error && <p className="reset-password-error" role="alert">{error}</p>}
      {message && <p className="reset-password-success" role="status">{message}</p>}

      {linkState === "ready" && !message && <form className="reset-password-form" onSubmit={(event) => void savePassword(event)}>
        <label htmlFor="new-password">Nueva contraseña</label>
        <span className="reset-password-input-frame"><LockKeyhole size={17} aria-hidden="true" /><input id="new-password" type={passwordVisible ? "text" : "password"} value={password} onChange={(event) => { setPassword(event.target.value); setError(""); }} autoComplete="new-password" minLength={8} required disabled={loading} /><button type="button" aria-label={passwordVisible ? "Ocultar contraseña" : "Mostrar contraseña"} onClick={() => setPasswordVisible((visible) => !visible)}>{passwordVisible ? <EyeOff size={18} /> : <Eye size={18} />}</button></span>
        <button className="reset-password-submit" type="submit" disabled={loading} aria-busy={loading}>{loading ? "Guardando…" : "Guardar contraseña"}</button>
      </form>}
      {message && <Link className="reset-password-submit reset-password-link" href="/login">Continuar</Link>}
      {linkState === "invalid" && <Link className="reset-password-back" href="/login">Volver a iniciar sesión</Link>}
    </section>
  </main>;
}
