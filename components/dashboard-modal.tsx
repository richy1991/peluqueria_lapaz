"use client";

import {ReactNode,useEffect,useId,useRef,useState} from "react";
import {createPortal} from "react-dom";
import {Plus,Sparkles,X} from "lucide-react";
import {useNativeOverlay} from "@/components/use-native-overlay";

type DashboardModalProps={
  title:string;
  description?:string;
  triggerLabel:string;
  triggerIcon?:ReactNode;
  triggerContent?:ReactNode;
  triggerClassName?:string;
  ariaLabel?:string;
  eyebrow?:string;
  children:ReactNode;
  variant?:"primary"|"secondary"|"ghost";
  size?:"medium"|"large";
};

export function DashboardModal({title,description,triggerLabel,triggerIcon,triggerContent,triggerClassName,ariaLabel,eyebrow="NUEVA OPERACIÓN",children,variant="primary",size="medium"}:DashboardModalProps){
  const[open,setOpen]=useState(false);
  const titleId=useId();
  const descriptionId=useId();
  const dialogRef=useRef<HTMLElement>(null);
  const closeModal=useNativeOverlay(open,()=>setOpen(false),"dashboard-modal");
  useEffect(()=>{
    if(!open)return;
    const previous=document.body.style.overflow;
    const previousFocus=document.activeElement instanceof HTMLElement?document.activeElement:null;
    document.body.style.overflow="hidden";
    dialogRef.current?.focus();
    function trapFocus(event:KeyboardEvent){
      const dialog=dialogRef.current;
      const dialogs=document.querySelectorAll(".dash-modal");
      if(event.key!=="Tab"||!dialog||dialogs.item(dialogs.length-1)!==dialog)return;
      const controls=Array.from(dialog.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]')).filter(element=>element.getClientRects().length>0);
      const first=controls[0];const last=controls.at(-1);
      if(!first||!last){event.preventDefault();dialog.focus();}
      else if(event.shiftKey&&(document.activeElement===first||document.activeElement===dialog||!dialog.contains(document.activeElement))){event.preventDefault();last.focus();}
      else if(!event.shiftKey&&(document.activeElement===last||!dialog.contains(document.activeElement))){event.preventDefault();first.focus();}
    }
    document.addEventListener("keydown",trapFocus);
    return()=>{document.body.style.overflow=previous;document.removeEventListener("keydown",trapFocus);if(previousFocus?.isConnected)previousFocus.focus();};
  },[open]);
  useEffect(()=>{
    if(!open)return;
    const closeAfterSuccess=()=>closeModal();
    window.addEventListener("legend-dashboard-operation-success",closeAfterSuccess);
    return()=>window.removeEventListener("legend-dashboard-operation-success",closeAfterSuccess);
  },[closeModal,open]);
  return <>
    <button type="button" className={triggerClassName??`dash-action dash-action-${variant}`} onClick={()=>setOpen(true)} aria-label={ariaLabel??(triggerContent?triggerLabel:undefined)} aria-haspopup="dialog" aria-expanded={open}>{triggerContent??<>{triggerIcon??<Plus/>}<span>{triggerLabel}</span></>}</button>
    {open&&createPortal(<div className="dash-modal-backdrop" role="presentation" onMouseDown={(event)=>{if(event.target===event.currentTarget)closeModal();}}>
      <section ref={dialogRef} tabIndex={-1} className={`dash-modal dash-modal-${size}`} role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={description?descriptionId:undefined}>
        <div className="dash-modal-glow" aria-hidden="true"/>
        <header><div className="dash-modal-icon"><Sparkles/></div><div><small>{eyebrow}</small><h2 id={titleId}>{title}</h2>{description&&<p id={descriptionId}>{description}</p>}</div><button type="button" className="dash-modal-close" onClick={closeModal} aria-label="Cerrar ventana"><X/></button></header>
        <div className="dash-modal-body">{children}</div>
      </section>
    </div>,document.querySelector<HTMLElement>(".panel-theme")??document.body)}
  </>;
}
