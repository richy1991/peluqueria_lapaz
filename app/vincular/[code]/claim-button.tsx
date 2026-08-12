"use client";

import {useState} from "react";
import {useRouter} from "next/navigation";
import {createClient} from "@/lib/supabase/client";

export function ClaimButton({code}:{code:string}){
  const router=useRouter();
  const[busy,setBusy]=useState(false);
  const[error,setError]=useState("");
  async function claim(){
    setBusy(true);setError("");
    const{data,error:claimError}=await createClient().rpc("claim_guest_sale",{provided_code:code});
    if(claimError||!data){setError("Código inválido, utilizado o límite temporal alcanzado.");setBusy(false);return;}
    router.replace("/mi-cuenta");router.refresh();
  }
  return <><button className="button button-dark" disabled={busy} onClick={claim}>{busy?"Vinculando…":"Vincular a mi cuenta"}</button>{error&&<p className="portal-error">{error}</p>}</>;
}
