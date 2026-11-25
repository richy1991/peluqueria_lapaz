"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function EditProfileForm({ userId, initialName, initialPhone, initialPhoneNormalized, initialPhoneConfirmedAt, email }: { userId: string; initialName: string; initialPhone: string; initialPhoneNormalized: string; initialPhoneConfirmedAt: string | null; email: string }) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [phone, setPhone] = useState(initialPhone);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleanName = name.trim();
    const cleanPhone = phone.trim();
    const normalized = cleanPhone.replace(/\D/g, "");
    if (cleanName.length < 2 || cleanName.length > 80) { setMessage("Escribe un nombre de entre 2 y 80 caracteres."); return; }
    if (cleanPhone && (normalized.length < 7 || normalized.length > 15)) { setMessage("El teléfono debe tener entre 7 y 15 dígitos."); return; }
    setBusy(true);
    setMessage("");
    const currentNormalized = initialPhoneNormalized || initialPhone.replace(/\D/g, "");
    const { error } = await createClient().from("profiles").update({ full_name: cleanName, phone: cleanPhone || null, phone_normalized: normalized || null, phone_confirmed_at: normalized === currentNormalized ? initialPhoneConfirmedAt : null, updated_at: new Date().toISOString() }).eq("id", userId);
    setBusy(false);
    if (error) { setMessage(error.message); return; }
    router.replace("/mi-cuenta#datos-personales");
    router.refresh();
  }

  return <form className="client-edit-profile-form" onSubmit={save}>
    <label>Nombre completo<input required minLength={2} maxLength={80} autoComplete="name" value={name} onChange={event => setName(event.target.value)} /></label>
    <label>Número de teléfono<input type="tel" autoComplete="tel" placeholder="Ej. +591 70000000" value={phone} onChange={event => setPhone(event.target.value)} /></label>
    <label>Correo electrónico<input type="email" autoComplete="email" aria-describedby="profile-email-note" value={email} readOnly /><small id="profile-email-note">Es el correo con el que inicias sesión.</small></label>
    {message && <p role="alert">{message}</p>}
    <div className="client-profile-edit-actions">
      <Link href="/mi-cuenta#datos-personales">Cancelar</Link>
      <button type="submit" disabled={busy}>{busy ? "Guardando…" : "Guardar cambios"}</button>
    </div>
  </form>;
}
