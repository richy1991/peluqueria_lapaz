"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, ArrowRight, Check, Eye, EyeOff, LockKeyhole, Mail, Scissors, ShieldCheck, UserPlus, X } from "lucide-react";
import { Brand } from "@/components/brand";
import { googleSignInPath } from "@/lib/supabase/google-redirect";
import { createClient } from "@/lib/supabase/client";

type AuthMode = "options" | "sign-in" | "sign-up" | "reset";
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function authMessage(reason: unknown, fallback: string) {
  const message = reason instanceof Error ? reason.message : fallback;
  const normalized = message.toLowerCase();
  if (normalized.includes("invalid login credentials")) return "El correo o la contraseña no coinciden. Si creaste tu cuenta con Google, usa Google o recupera tu acceso.";
  if (normalized.includes("email not confirmed")) return "Confirma tu correo desde el enlace que te enviamos antes de iniciar sesión.";
  if (normalized.includes("user already registered") || normalized.includes("email_exists") || normalized.includes("user_already_exists")) return "Ese correo ya tiene una cuenta. Inicia sesión con ese correo.";
  if (normalized.includes("password") && (normalized.includes("at least") || normalized.includes("minimum length"))) return "La contraseña es demasiado corta. Usa al menos 8 caracteres.";
  if (normalized.includes("rate limit") || normalized.includes("too many") || normalized.includes("after 60 seconds")) return "Espera un minuto antes de solicitar otro correo.";
  if (normalized.includes("email address not authorized") || normalized.includes("smtp") || normalized.includes("email provider")) return "No se pudo enviar el correo. Inténtalo más tarde.";
  if (normalized.includes("network") || normalized.includes("fetch")) return "No pudimos conectar. Revisa tu internet e inténtalo otra vez.";
  return message;
}

export function LoginForm({ next, initialError }: { next: string; initialError: string }) {
  const [mode, setMode] = useState<AuthMode>("options");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(initialError);
  const [message, setMessage] = useState("");
  const [confirmationPending, setConfirmationPending] = useState(false);

  function changeMode(nextMode: AuthMode) {
    setMode(nextMode);
    setPassword("");
    setPasswordVisible(false);
    setError("");
    setMessage("");
    setConfirmationPending(false);
  }

  function normalizedEmail() {
    const value = email.trim().toLowerCase();
    if (!emailPattern.test(value)) {
      setError("Escribe un correo electrónico válido.");
      return null;
    }
    return value;
  }

  function emailRedirect(nextPath: string) {
    const callback = new URL("/auth/callback", window.location.origin);
    callback.searchParams.set("next", nextPath);
    return callback.toString();
  }

  async function submitEmailAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const address = normalizedEmail();
    if (!address) return;
    if (mode !== "reset" && password.length < 8) {
      setError("La contraseña debe tener al menos 8 caracteres.");
      return;
    }

    setLoading(true);
    setError("");
    setMessage("");
    const supabase = createClient();
    try {
      if (mode === "reset") {
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(address, { redirectTo: emailRedirect("/reset-password") });
        if (resetError) throw resetError;
        setMessage("Te enviamos un enlace para crear una contraseña nueva. Revisa tu correo y la carpeta de spam.");
        return;
      }

      if (mode === "sign-up") {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email: address,
          password,
          options: { emailRedirectTo: emailRedirect(next) },
        });
        if (signUpError) throw signUpError;
        if (data.user?.identities?.length === 0) {
          setMode("sign-in");
          setPassword("");
          setError("Ese correo ya tiene una cuenta. Inicia sesión con tu contraseña o usa Google.");
          return;
        }
        if (data.session) {
          window.location.replace(next);
          return;
        }
        setConfirmationPending(true);
        setMessage(`La cuenta se creó. Confirma el correo enviado a ${address} y vuelve para iniciar sesión.`);
        return;
      }

      const { error: signInError } = await supabase.auth.signInWithPassword({ email: address, password });
      if (signInError) throw signInError;
      window.location.replace(next);
    } catch (reason) {
      if (mode !== "reset" && reason instanceof Error && reason.message.toLowerCase().includes("email not confirmed")) {
        setConfirmationPending(true);
      }
      setError(authMessage(reason, mode === "reset" ? "No pudimos enviar el enlace de recuperación." : mode === "sign-up" ? "No pudimos crear tu cuenta." : "No pudimos iniciar sesión."));
    } finally {
      setLoading(false);
    }
  }

  async function resendConfirmation() {
    const address = normalizedEmail();
    if (!address) return;
    setLoading(true);
    setError("");
    setMessage("");
    try {
      const { error: resendError } = await createClient().auth.resend({
        type: "signup",
        email: address,
        options: { emailRedirectTo: emailRedirect(next) },
      });
      if (resendError) throw resendError;
      setMessage(`Solicitamos otro enlace para ${address}. Revisa tu bandeja de entrada y spam.`);
    } catch (reason) {
      setError(authMessage(reason, "No pudimos reenviar el correo de confirmación."));
    } finally {
      setLoading(false);
    }
  }

  const isSignUp = mode === "sign-up";
  const isReset = mode === "reset";
  const isEmailForm = mode !== "options";
  const title = isReset ? "Recupera tu acceso" : isSignUp ? "Crea tu cuenta" : mode === "sign-in" ? "Qué bueno verte." : "Tu próxima cita empieza aquí.";
  const heading = isReset ? "Restablecer contraseña" : isSignUp ? "Únete a Legend Club" : mode === "sign-in" ? "Iniciar sesión" : "Entra a tu cuenta";

  return (
    <main className="login-shell">
      <div className="login-content">
        <header className="login-header">
          <Brand linked={false} />
          <Link className="login-close" replace href="/" aria-label="Cerrar inicio de sesión" title="Volver al inicio"><X size={21} aria-hidden="true" /></Link>
        </header>

        <section className="login-hero">
          <p className="login-eyebrow">{isReset ? "RECUPERACIÓN SEGURA" : isSignUp ? "CREA TU CUENTA" : mode === "sign-in" ? "ACCESO CON CORREO" : "TU ESPACIO PERSONAL"}</p>
          <h1>{title}</h1>
          <p className="login-trust"><ShieldCheck size={15} aria-hidden="true" /> Acceso seguro a tu cuenta</p>
        </section>

        <section className="login-card" aria-labelledby="login-card-title">
          <div className="login-card-heading">
            <span className="login-card-icon" aria-hidden="true">{isReset ? <Mail /> : isSignUp ? <UserPlus /> : isEmailForm ? <LockKeyhole /> : <Scissors />}</span>
            <div><p className="login-card-eyebrow">{isReset ? "RECUPERAR CUENTA" : isSignUp ? "NUEVO CLIENTE" : isEmailForm ? "ACCESO CON CORREO" : "BIENVENIDO"}</p><h2 id="login-card-title">{heading}</h2></div>
          </div>
          <p className="login-description">{isReset
            ? "Escribe el correo de tu cuenta. Si usas Google, el enlace te permitirá crear una contraseña de LEGEND CLUB sin cambiar tu contraseña de Google."
            : isSignUp
              ? "Regístrate una sola vez para reservar y administrar tus citas."
              : mode === "sign-in"
                ? "Usa tu contraseña de LEGEND CLUB. Si creaste tu cuenta con Google, entra con Google o define una contraseña desde «¿Olvidaste tu contraseña?»."
                : "Elige una forma rápida y segura de continuar."}</p>

          {isEmailForm ? (
            <form className="login-form" onSubmit={(event) => void submitEmailAuth(event)}>
              <label className="login-field"><span>Correo electrónico</span><span className="login-input-frame"><Mail size={17} aria-hidden="true" /><input type="email" autoComplete="email" autoCapitalize="none" autoCorrect="off" inputMode="email" placeholder="tu@correo.com" value={email} onChange={(event) => { setEmail(event.target.value); setError(""); setMessage(""); setConfirmationPending(false); }} disabled={loading} required /></span></label>
              {!isReset && <label className="login-field"><span>Contraseña</span><span className="login-input-frame"><LockKeyhole size={17} aria-hidden="true" /><input type={passwordVisible ? "text" : "password"} autoComplete={isSignUp ? "new-password" : "current-password"} placeholder={isSignUp ? "Crea una contraseña segura" : "Tu contraseña"} value={password} onChange={(event) => { setPassword(event.target.value); setError(""); setMessage(""); setConfirmationPending(false); }} disabled={loading} minLength={8} required /><button className="login-visibility" type="button" aria-label={passwordVisible ? "Ocultar contraseña" : "Mostrar contraseña"} onClick={() => setPasswordVisible((visible) => !visible)}>{passwordVisible ? <EyeOff size={18} /> : <Eye size={18} />}</button></span>{isSignUp && <small>Usa al menos 8 caracteres.</small>}</label>}
              {error && <p className="login-error" role="alert">{error}</p>}
              {message && <p className="login-message" role="status">{message}</p>}
              {confirmationPending && !isReset && <button className="login-text-action" type="button" disabled={loading} onClick={() => void resendConfirmation()}>Reenviar correo de confirmación</button>}
              <button className="login-primary" type="submit" disabled={loading || (isSignUp && Boolean(message))} aria-busy={loading}>
                {loading ? <span className="login-spinner" aria-hidden="true" /> : isReset ? <Mail size={17} aria-hidden="true" /> : isSignUp ? <UserPlus size={17} aria-hidden="true" /> : <ArrowRight size={17} aria-hidden="true" />}
                {loading ? "Un momento…" : isReset ? "Enviarme enlace" : isSignUp ? "Crear cuenta" : "Iniciar sesión"}
              </button>
              {!isReset && !isSignUp && <button className="login-text-action login-forgot" type="button" disabled={loading} onClick={() => changeMode("reset")}>¿Olvidaste tu contraseña?</button>}
              {isReset ? <button className="login-back" type="button" disabled={loading} onClick={() => changeMode("sign-in")}><ArrowLeft size={14} aria-hidden="true" /> Volver a iniciar sesión</button> : <div className="login-switch"><span>{isSignUp ? "¿Ya tienes una cuenta?" : "¿Es tu primera vez?"}</span><button type="button" disabled={loading} onClick={() => changeMode(isSignUp ? "sign-in" : "sign-up")}>{isSignUp ? "Inicia sesión" : "Crear cuenta"}</button></div>}
              {!isReset && <button className="login-back" type="button" disabled={loading} onClick={() => changeMode("options")}><ArrowLeft size={14} aria-hidden="true" /> Otras opciones de acceso</button>}
            </form>
          ) : (
            <div className="login-options">
              {error && <p className="login-error" role="alert">{error}</p>}
              {message && <p className="login-message" role="status">{message}</p>}
              <button className="login-google" type="button" disabled={loading} onClick={() => { setLoading(true); window.location.replace(googleSignInPath(next)); }}>
                <Image src="/brand/google-g.png" alt="" width={22} height={22} unoptimized />
                <span>{loading ? "Conectando con Google…" : "Continuar con Google"}</span><ArrowRight size={16} aria-hidden="true" />
              </button>
              <div className="login-divider"><span />O TAMBIÉN<span /></div>
              <button className="login-primary" type="button" onClick={() => changeMode("sign-in")}><Mail size={17} aria-hidden="true" /> Iniciar con correo</button>
            </div>
          )}
        </section>

        <p className="login-footer"><Check size={12} aria-hidden="true" /> CORTES · ESTILO · BUEN SERVICIO</p>
      </div>
    </main>
  );
}
