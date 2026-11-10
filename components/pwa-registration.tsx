"use client";
import {useEffect} from "react";

const RELOAD_KEY = "legend-sw-v6-reloaded";

export function PwaRegistration(){
  useEffect(()=>{
    if (!("serviceWorker" in navigator)) return;
    const refresh = () => {
      if (sessionStorage.getItem(RELOAD_KEY)) return;
      sessionStorage.setItem(RELOAD_KEY, "1");
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener("controllerchange", refresh);
    navigator.serviceWorker.register("/sw.js", { updateViaCache: "none" }).then(registration => registration.update()).catch(()=>undefined);
    return () => navigator.serviceWorker.removeEventListener("controllerchange", refresh);
  },[]);
  return null;
}
