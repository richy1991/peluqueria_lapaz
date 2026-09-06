"use client";

import {ReactNode,useEffect,useId,useState} from "react";
import {createPortal} from "react-dom";
import {Plus,Sparkles,X} from "lucide-react";
import {useNativeOverlay} from "@/components/use-native-overlay";

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
  const closeModal=useNativeOverlay(open,()=>setOpen(false),"dashboard-modal");
  useEffect(()=>{
    if(!open)return;
    const previous=document.body.style.overflow;
    document.body.style.overflow="hidden";
    return()=>{document.body.style.overflow=previous;};
  },[open]);
  useEffect(()=>{
    const closeAfterSuccess=()=>closeModal();
    window.addEventListener("legend-dashboard-operation-success",closeAfterSuccess);
    return()=>window.removeEventListener("legend-dashboard-operation-success",closeAfterSuccess);
  },[closeModal]);
  return <>
    <button type="button" className={`dash-action dash-action-${variant}`} onClick={()=>setOpen(true)}>{triggerIcon??<Plus/>}<span>{triggerLabel}</span></button>
    {open&&createPortal(<div className="dash-modal-backdrop" role="presentation" onMouseDown={(event)=>{if(event.target===event.currentTarget)closeModal();}}>
      <section className={`dash-modal dash-modal-${size}`} role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <div className="dash-modal-glow" aria-hidden="true"/>
        <header><div className="dash-modal-icon"><Sparkles/></div><div><small>NUEVA OPERACIÓN</small><h2 id={titleId}>{title}</h2>{description&&<p>{description}</p>}</div><button type="button" className="dash-modal-close" onClick={closeModal} aria-label="Cerrar ventana"><X/></button></header>
        <div className="dash-modal-body">{children}</div>
      </section>
    </div>,document.querySelector<HTMLElement>(".panel-theme")??document.body)}
  </>;
}
