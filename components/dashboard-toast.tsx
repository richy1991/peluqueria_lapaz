"use client";

import { useEffect } from "react";
import { CheckCircle2, CircleAlert, X } from "lucide-react";

export type DashboardToastData = {
  id: number;
  type: "success" | "error";
  message: string;
};

export function DashboardToast({ toast, onClose }: { toast: DashboardToastData | null; onClose: () => void }) {
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(onClose, toast.type === "error" ? 7000 : 4500);
    return () => window.clearTimeout(timer);
  }, [onClose, toast]);

  if (!toast) return null;
  const Icon = toast.type === "success" ? CheckCircle2 : CircleAlert;
  return (
    <div className={`dashboard-toast dashboard-toast-${toast.type}`} role={toast.type === "error" ? "alert" : "status"} aria-live="polite">
      <Icon />
      <div>
        <strong>{toast.type === "success" ? "Operación completada" : "No se pudo completar"}</strong>
        <p>{toast.message}</p>
      </div>
      <button type="button" onClick={onClose} aria-label="Cerrar notificación"><X /></button>
    </div>
  );
}
