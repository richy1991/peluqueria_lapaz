"use client";

import { useEffect } from "react";

export function PanelExitGuard() {
  useEffect(() => {
    const warnBeforeExit = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warnBeforeExit);
    return () => window.removeEventListener("beforeunload", warnBeforeExit);
  }, []);

  return null;
}
