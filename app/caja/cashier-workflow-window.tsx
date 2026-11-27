"use client";

import { ReactNode, useEffect, useRef, useState } from "react";
import { ArrowLeft, X } from "lucide-react";
import { Brand } from "@/components/brand";

type Props = {
  title: string;
  description: string;
  triggerLabel: string;
  triggerIcon?: ReactNode;
  variant?: "primary" | "secondary" | "ghost";
  size?: "default" | "large";
  children: ReactNode;
};

export function CashierWorkflowWindow({ title, description, triggerLabel, triggerIcon, variant = "secondary", size = "default", children }: Props) {
  const [open, setOpen] = useState(false);
  const [workflowError, setWorkflowError] = useState("");
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!open || !dialog) return;
    if (!dialog.open) dialog.showModal();
    dialog.querySelector<HTMLElement>(".cashier-workflow-heading h1")?.focus();
    return () => {
      if (dialog.open) dialog.close();
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const start = () => setWorkflowError("");
    const finish = () => setOpen(false);
    window.addEventListener("cashier:workflow-start", start);
    window.addEventListener("cashier:workflow-complete", finish);
    return () => {
      window.removeEventListener("cashier:workflow-start", start);
      window.removeEventListener("cashier:workflow-complete", finish);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const reportError = (event: Event) => setWorkflowError(String((event as CustomEvent<string>).detail ?? "No se pudo completar la operación."));
    window.addEventListener("cashier:workflow-error", reportError);
    return () => window.removeEventListener("cashier:workflow-error", reportError);
  }, [open]);

  return <>
    <button type="button" className={`cashier-workflow-launch ${variant}`} onClick={() => { setWorkflowError(""); setOpen(true); }}>
      {triggerIcon}<span>{triggerLabel}</span>
    </button>
    {open && <dialog ref={dialogRef} className="cashier-workflow-dialog" data-size={size} aria-labelledby="cashier-workflow-title" onCancel={event => { event.preventDefault(); setOpen(false); }}>
      <div className="cashier-workflow-screen">
        <header className="cashier-workflow-header">
          <div className="cashier-workflow-brand"><Brand linked={false} /><span>Caja</span></div>
          <button type="button" className="cashier-workflow-back" onClick={() => setOpen(false)}>
            <ArrowLeft aria-hidden="true" /><span>Volver al panel</span>
          </button>
          <button type="button" className="cashier-workflow-close" aria-label="Cerrar ventana de caja" onClick={() => setOpen(false)}>
            <X aria-hidden="true" />
          </button>
        </header>
        <main className="cashier-workflow-main">
          <div className="cashier-workflow-heading">
            <p>Transacción de caja</p>
            <h1 id="cashier-workflow-title" tabIndex={-1}>{title}</h1>
            <span>{description}</span>
          </div>
          {workflowError && <p className="cashier-workflow-error" role="alert">{workflowError}</p>}
          <div className="cashier-workflow-content">{children}</div>
        </main>
      </div>
    </dialog>}
  </>;
}
