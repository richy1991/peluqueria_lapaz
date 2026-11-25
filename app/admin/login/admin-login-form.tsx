"use client";

import { useState } from "react";
import { GoogleSignInCard } from "@/components/google-sign-in-card";
import { googleSignInPath } from "@/lib/supabase/google-redirect";

export function AdminLoginForm({ next, error }: { next: string; error: string }) {
  const [loading, setLoading] = useState(false);

  async function login() {
    setLoading(true);
    window.location.assign(googleSignInPath(next));
  }

  return <GoogleSignInCard
    layout="page"
    heading="h1"
    title="Administración"
    description="Usa la cuenta de Google autorizada por Legend Club para administrar la barbería."
    loading={loading}
    error={loading ? "" : error}
    onSignIn={login}
  />;
}
