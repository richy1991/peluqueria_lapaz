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

export function PanelExperience({children}:{children:ReactNode}){
  const value=useSyncExternalStore(subscribe,snapshot,serverSnapshot);const[preference,resolved]=value.split(":") as [Preference,"light"|"dark"];
  function select(next:Preference){if(next==="system")localStorage.removeItem("legend-panel-theme");else localStorage.setItem("legend-panel-theme",next);window.dispatchEvent(new Event(EVENT));}
  return <div className="panel-theme" data-panel-theme={resolved} suppressHydrationWarning>{children}<aside className="panel-floating-tools" aria-label="Preferencias del panel"><details><summary aria-label="Cambiar tema">{preference==="system"?<Monitor/>:resolved==="dark"?<Moon/>:<Sun/>}</summary><div><small>APARIENCIA</small><button className={preference==="system"?"active":""} onClick={()=>select("system")}><Monitor/>Sistema</button><button className={preference==="light"?"active":""} onClick={()=>select("light")}><Sun/>Claro</button><button className={preference==="dark"?"active":""} onClick={()=>select("dark")}><Moon/>Oscuro</button></div></details><FloatingSupportChat/></aside></div>;
}
