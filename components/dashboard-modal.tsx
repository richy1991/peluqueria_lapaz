"use client";

import {ReactNode,useEffect,useId,useState} from "react";
import {createPortal} from "react-dom";
import {Plus,Sparkles,X} from "lucide-react";

type DashboardModalProps={
  title:string;
  description?:string;
  triggerLabel:string;
  triggerIcon?:ReactNode;
  children:ReactNode;
  variant?:"primary"|"secondary"|"ghost";
  size?:"medium"|"large";
};

export function DashboardModal({title,description,triggerLabel,triggerIcon,children,variant="primary",size="medium"}:DashboardModalProps){
  const[open,setOpen]=useState(false);
  const titleId=useId();
  useEffect(()=>{
    if(!open)return;
    const previous=document.body.style.overflow;
    const close=(event:KeyboardEvent)=>{if(event.key==="Escape")setOpen(false);};
    document.body.style.overflow="hidden";
    window.addEventListener("keydown",close);
    return()=>{document.body.style.overflow=previous;window.removeEventListener("keydown",close);};
  },[open]);
  return <>
    <button type="button" className={`dash-action dash-action-${variant}`} onClick={()=>setOpen(true)}>{triggerIcon??<Plus/>}<span>{triggerLabel}</span></button>
    {open&&createPortal(<div className="dash-modal-backdrop" role="presentation" onMouseDown={(event)=>{if(event.target===event.currentTarget)setOpen(false);}}>
      <section className={`dash-modal dash-modal-${size}`} role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <div className="dash-modal-glow" aria-hidden="true"/>
        <header><div className="dash-modal-icon"><Sparkles/></div><div><small>NUEVA OPERACIÓN</small><h2 id={titleId}>{title}</h2>{description&&<p>{description}</p>}</div><button type="button" className="dash-modal-close" onClick={()=>setOpen(false)} aria-label="Cerrar ventana"><X/></button></header>
        <div className="dash-modal-body">{children}</div>
      </section>
    </div>,document.body)}
  </>;
}
