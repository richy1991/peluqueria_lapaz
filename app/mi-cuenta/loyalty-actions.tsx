"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function ClaimVisitForm(){const router=useRouter();const[busy,setBusy]=useState(false);const[error,setError]=useState("");async function claim(e:FormEvent<HTMLFormElement>){e.preventDefault();setBusy(true);setError("");const f=new FormData(e.currentTarget);const{data,error}=await createClient().rpc("claim_guest_sale",{provided_code:String(f.get("code")??"")});setBusy(false);if(error||!data)return setError("Código inválido, utilizado o límite temporal alcanzado.");router.refresh();e.currentTarget.reset();}return <form className="portal-inline-form" onSubmit={claim}><input name="code" maxLength={10} autoComplete="off" placeholder="Código del comprobante" required/><button disabled={busy}>Vincular atención</button>{error&&<small>{error}</small>}</form>}

export function RewardButton({id,cost,disabled}:{id:string;cost:number;disabled:boolean}){const router=useRouter();const[busy,setBusy]=useState(false);const[message,setMessage]=useState("");async function redeem(){if(!window.confirm(`¿Canjear ${cost} puntos?`))return;setBusy(true);const{data,error}=await createClient().rpc("request_reward_redemption",{target_reward_id:id});setBusy(false);if(error)return setMessage(error.message);setMessage(`Código: ${data}. Preséntalo en caja.`);router.refresh();}return <div className="reward-action"><button disabled={disabled||busy} onClick={redeem}>Canjear {cost} pts</button>{message&&<small>{message}</small>}</div>}

export function CancelRedemptionButton({id}:{id:string}){const router=useRouter();const[busy,setBusy]=useState(false);const[error,setError]=useState("");async function cancel(){if(!window.confirm("¿Cancelar el canje y devolver los puntos?"))return;setBusy(true);const{error:cancelError}=await createClient().rpc("cancel_reward_redemption",{target_redemption_id:id});setBusy(false);if(cancelError)return setError(cancelError.message);router.refresh();}return <div className="reward-action"><button disabled={busy} onClick={cancel}>Cancelar</button>{error&&<small>{error}</small>}</div>}
