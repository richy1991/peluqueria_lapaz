"use client";

import {ReactNode,useSyncExternalStore} from "react";
import {FloatingSupportChat} from "@/components/floating-support-chat";
import {Monitor, Moon, Sun} from "lucide-react";

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
  return <section className={`panel-theme-selector ${compact?"compact":""}`} aria-label="Apariencia del panel">
    <small>APARIENCIA</small>
    <div>
      <button type="button" title="Usar tema del dispositivo" aria-pressed={preference==="system"} className={preference==="system"?"active":""} onClick={()=>selectTheme("system")}><Monitor/><span>Sistema</span></button>
      <button type="button" title="Usar tema claro" aria-pressed={preference==="light"} className={preference==="light"?"active":""} onClick={()=>selectTheme("light")}><Sun/><span>Claro</span></button>
      <button type="button" title="Usar tema oscuro" aria-pressed={preference==="dark"} className={preference==="dark"?"active":""} onClick={()=>selectTheme("dark")}><Moon/><span>Oscuro</span></button>
    </div>
  </section>;
}

export function PanelExperience({children}:{children:ReactNode}){
  const value=useSyncExternalStore(subscribe,snapshot,serverSnapshot);const[,resolved]=value.split(":") as [Preference,"light"|"dark"];
  return <div className="panel-theme" data-panel-theme={resolved} suppressHydrationWarning>{children}<aside className="panel-floating-tools" aria-label="Atención al cliente"><FloatingSupportChat/></aside></div>;
}
