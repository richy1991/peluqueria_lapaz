"use client";

import { useState } from "react";
import Link from "next/link";
import { Brand } from "@/components/brand";
import { createClient } from "@/lib/supabase/client";

export function LoginForm({ next, initialError }: { next: string; initialError: string }) {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(initialError);
  const [message, setMessage] = useState("");

  async function sendCode(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");
    const { error: authError } = await createClient().auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: { shouldCreateUser: true },
    });
    setLoading(false);
    if (authError) {
      setError("No pudimos enviar el código. Revisa el correo e inténtalo de nuevo.");
      return;
    }
    setSent(true);
    setMessage("Te enviamos un código de acceso a tu correo.");
  }

  async function verifyCode(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    const { error: authError } = await createClient().auth.verifyOtp({
      email: email.trim().toLowerCase(),
      token: code.replace(/\s/g, ""),
      type: "email",
    });
    setLoading(false);
    if (authError) {
      setError("El código no es válido o venció. Revisa el correo e inténtalo de nuevo.");
      return;
    }
    window.location.replace(next);
  }

  return <main className="login-shell"><section className="login-card"><Brand/><p className="eyebrow">CUENTA LEGEND</p><h1>{sent ? "Revisa tu correo." : "Entra con tu correo."}</h1><p>{sent ? `Escribe el código que enviamos a ${email}.` : "Te enviaremos un código de acceso. No necesitas contraseña."}</p>
    {!sent ? <form className="login-form" onSubmit={sendCode}><label htmlFor="login-email">Correo electrónico</label><input id="login-email" autoComplete="email" autoCapitalize="none" type="email" inputMode="email" value={email} onChange={event => setEmail(event.target.value)} placeholder="tu@correo.com" required /><button className="google-button" type="submit" disabled={loading}>{loading ? "Enviando…" : "Enviar código"}</button></form> : <form className="login-form" onSubmit={verifyCode}><label htmlFor="login-code">Código de acceso</label><input id="login-code" autoComplete="one-time-code" inputMode="numeric" pattern="[0-9]*" maxLength={8} value={code} onChange={event => setCode(event.target.value.replace(/\D/g, ""))} placeholder="Código de 6 dígitos" required /><button className="google-button" type="submit" disabled={loading || code.length < 6}>{loading ? "Verificando…" : "Entrar"}</button><button className="login-link-button" type="button" disabled={loading} onClick={() => { setSent(false); setCode(""); setMessage(""); }}>Usar otro correo</button></form>}
    {message && <p className="login-success" role="status">{message}</p>}{error && <p className="login-error" role="alert">{error}</p>}<small>Al continuar aceptas usar tu cuenta LEGEND CLUB para tus reservas y beneficios.</small><Link replace href="/">Volver al inicio</Link></section></main>;
}
