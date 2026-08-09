"use client";

import { useState } from "react";
import Link from "next/link";
import { Brand } from "@/components/brand";
import { createClient } from "@/lib/supabase/client";
import "./login.css";

export default function LoginPage(){
  const [loading,setLoading]=useState(false);const [error,setError]=useState("");
  async function login(){setLoading(true);setError("");const requested=new URLSearchParams(window.location.search).get("next");const next=requested?.startsWith("/")&&!requested.startsWith("//")?requested:"/panel";const redirectTo=`${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;const {error:e}=await createClient().auth.signInWithOAuth({provider:"google",options:{redirectTo}});if(e){setError(e.message);setLoading(false);}}
  return <main className="login-shell"><section className="login-card"><Brand/><p className="eyebrow">CUENTA LEGEND</p><h1>Entra con Google.</h1><p>Si es tu primera vez, crearemos automáticamente tu cuenta de cliente. Si eres peluquero, administrador o superadmin, abriremos el panel correspondiente a tus permisos.</p><button className="google-button" onClick={login} disabled={loading}><b>G</b>{loading?"Conectando…":"Continuar con Google"}</button>{error&&<p className="login-error">{error}</p>}<small>No utilizamos contraseñas propias. Tu acceso se protege con Google y Supabase.</small><Link href="/">Volver al inicio</Link></section></main>;
}
