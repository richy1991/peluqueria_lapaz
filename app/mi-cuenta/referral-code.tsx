"use client";

import QRCode from "react-qr-code";
import {useState} from "react";

export function ReferralCode({code}:{code:string}){
  const[copied,setCopied]=useState(false);
  async function share(){
    const text=`Usa mi código ${code} en tu primera atención en Barbería LEGEND CLUB.`;
    if(navigator.share){await navigator.share({title:"LEGEND CLUB",text});return;}
    await navigator.clipboard.writeText(text);setCopied(true);
  }
  return <div className="referral-share"><QRCode value={code} size={112}/><div><strong className="referral-code">{code}</strong><button onClick={share}>{copied?"Copiado":"Compartir código"}</button></div></div>;
}
