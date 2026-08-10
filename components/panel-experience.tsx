"use client";

import {ReactNode,useEffect,useRef,useState,useSyncExternalStore} from "react";
import {FloatingSupportChat} from "@/components/floating-support-chat";
import {ChevronDown,Monitor,Moon,Palette,Sun} from "lucide-react";

type Preference="system"|"light"|"dark";
const EVENT="legend-panel-theme";

function subscribe(callback:()=>void){
  window.addEventListener("storage",callback);window.addEventListener(EVENT,callback);
  const media=window.matchMedia("(prefers-color-scheme: dark)");media.addEventListener("change",callback);
  return()=>{window.removeEventListener("storage",callback);window.removeEventListener(EVENT,callback);media.removeEventListener("change",callback);};
}
function snapshot():`${Preference}:${"light"|"dark"}`{const saved=localStorage.getItem("legend-panel-theme");const preference:Preference=saved==="light"||saved==="dark"?saved:"system";const resolved=preference==="system"?(matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"):preference;return `${preference}:${resolved}`;}
function serverSnapshot():`${Preference}:${"light"|"dark"}`{return "system:light";}

function selectTheme(next:Preference){
  if(next==="system")localStorage.removeItem("legend-panel-theme");
  else localStorage.setItem("legend-panel-theme",next);
  window.dispatchEvent(new Event(EVENT));
}

export function PanelThemeSelector({compact=false}:{compact?:boolean}){
  const value=useSyncExternalStore(subscribe,snapshot,serverSnapshot);
  const[preference]=value.split(":") as [Preference,"light"|"dark"];
  const detailsRef=useRef<HTMLDetailsElement>(null);
  function choose(next:Preference){selectTheme(next);detailsRef.current?.removeAttribute("open");}
  return <details ref={detailsRef} className={`panel-theme-selector ${compact?"compact":""}`}>
    <summary aria-label="Seleccionar apariencia"><Palette/><span>Apariencia</span><ChevronDown className="theme-chevron"/></summary>
    <div className="panel-theme-options" role="group" aria-label="Seleccionar tema">
      <button type="button" aria-pressed={preference==="system"} className={preference==="system"?"active":""} onClick={()=>choose("system")}><Monitor/><span>Sistema</span></button>
      <button type="button" aria-pressed={preference==="light"} className={preference==="light"?"active":""} onClick={()=>choose("light")}><Sun/><span>Claro</span></button>
      <button type="button" aria-pressed={preference==="dark"} className={preference==="dark"?"active":""} onClick={()=>choose("dark")}><Moon/><span>Oscuro</span></button>
    </div>
  </details>;
}

export function PanelExperience({children}:{children:ReactNode}){
  const value=useSyncExternalStore(subscribe,snapshot,serverSnapshot);const[,resolved]=value.split(":") as [Preference,"light"|"dark"];
  const[headerHidden,setHeaderHidden]=useState(false);
  useEffect(()=>{
    let previous=window.scrollY;
    let ticking=false;
    function update(){
      const current=window.scrollY;
      const delta=current-previous;
      if(current<24){setHeaderHidden(false);previous=current;}
      else if(delta>7&&current>90){setHeaderHidden(true);previous=current;}
      else if(delta< -7){setHeaderHidden(false);previous=current;}
      ticking=false;
    }
    function onScroll(){if(!ticking){ticking=true;window.requestAnimationFrame(update);}}
    window.addEventListener("scroll",onScroll,{passive:true});
    return()=>window.removeEventListener("scroll",onScroll);
  },[]);
  return <div className={`panel-theme ${headerHidden?"panel-header-hidden":""}`} data-panel-theme={resolved} suppressHydrationWarning>{children}<aside className="panel-floating-tools" aria-label="Atención al cliente"><FloatingSupportChat/></aside></div>;
}
