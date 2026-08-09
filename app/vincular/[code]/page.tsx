import Link from "next/link";
import {redirect} from "next/navigation";
import {Brand} from "@/components/brand";
import {createClient} from "@/lib/supabase/server";
import {ClaimButton} from "./claim-button";

export const dynamic="force-dynamic";

export default async function ClaimPage({params}:{params:Promise<{code:string}>}){
  const{code}=await params;
  const supabase=await createClient();
  const{data:{user}}=await supabase.auth.getUser();
  if(!user)redirect(`/login?next=${encodeURIComponent(`/vincular/${code}`)}`);
  return <main className="login-shell"><section className="login-card"><Brand/><p className="eyebrow">FIDELIZACIÓN LEGEND</p><h1>Guarda esta visita.</h1><p>La atención se vinculará a <strong>{user.email}</strong> y acreditará los puntos correspondientes una sola vez.</p><ClaimButton code={code}/><Link href="/mi-cuenta">Volver a mi cuenta</Link></section></main>;
}
