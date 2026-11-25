"use client";

import { useCallback, useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from "react";
import { ArrowLeft, ChevronRight, CircleAlert, LockKeyhole, LockKeyholeOpen, Trash2, UserRoundCheck, UserRoundMinus, X } from "lucide-react";
import { DEFAULT_BUSINESS_TIMEZONE } from "@/lib/business-hours";
import { dispatchDashboardSuccess, reportFormError } from "@/lib/form-feedback";
import { createClient } from "@/lib/supabase/client";
import { CLIENT_DELETE_DETAIL, deleteAdminRecord } from "./admin-delete-action";
import type { AdminClient } from "./admin-clients-table";

const statusLabels: Record<string, string> = {
  active: "Activo",
  inactive: "Inactivo",
  deactivated: "Dado de baja",
  suspended: "Suspendido",
};

const actions = {
  block: {
    label: "Bloquear",
    title: "Bloquear acceso",
    description: "El cliente perderá acceso a su cuenta hasta que la desbloquees. El motivo quedará en su ficha.",
    success: "Acceso del cliente bloqueado.",
    icon: LockKeyhole,
  },
  unblock: {
    label: "Desbloquear",
    title: "Desbloquear acceso",
    description: "Se quitará el bloqueo de la cuenta. Su estado de alta o baja se conserva.",
    success: "Bloqueo retirado.",
    icon: LockKeyholeOpen,
  },
  deactivate: {
    label: "Dar de baja",
    title: "Dar de baja la cuenta",
    description: "La cuenta quedará desactivada. Podrás reactivarla desde esta ficha.",
    success: "Cuenta dada de baja.",
    icon: UserRoundMinus,
  },
  reactivate: {
    label: "Reactivar",
    title: "Reactivar la cuenta",
    description: "La cuenta volverá a estar activa y se levantará cualquier bloqueo.",
    success: "Cuenta reactivada.",
    icon: UserRoundCheck,
  },
  delete: {
    label: "Eliminar definitivamente",
    title: "Eliminar la cuenta",
    description: CLIENT_DELETE_DETAIL,
    success: "",
    icon: Trash2,
  },
} as const;

type Action = keyof typeof actions;

export function ClientStatus({ client }: { client: AdminClient }) {
  const tone = client.is_blocked || client.status === "suspended" ? "danger" : client.status === "active" ? "positive" : "neutral";
  return <span className="directory-status" data-tone={tone}>{client.is_blocked ? "Bloqueado" : statusLabels[client.status] ?? client.status}</span>;
}

function formatDate(value: string, timezone: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Sin registrar";
  try {
    return new Intl.DateTimeFormat("es-BO", { dateStyle: "medium", timeZone: timezone }).format(date);
  } catch {
    return new Intl.DateTimeFormat("es-BO", { dateStyle: "medium", timeZone: DEFAULT_BUSINESS_TIMEZONE }).format(date);
  }
}

function Field({ label, children, wideOnMobile }: { label: string; children: ReactNode; wideOnMobile?: boolean }) {
  return <div className={wideOnMobile ? "directory-field-wide" : undefined}><dt>{label}</dt><dd>{children}</dd></div>;
}

function ClientDetails({ client, timezone }: { client: AdminClient; timezone: string }) {
  return <div className="directory-detail">
    <section>
      <h3>Contacto y datos personales</h3>
      <dl className="directory-fields">
        <Field label="Nombre completo" wideOnMobile>{client.full_name?.trim() || "Sin nombre registrado"}</Field>
        <Field label="Correo electrónico" wideOnMobile><a href={`mailto:${client.email}`}>{client.email}</a></Field>
        <Field label="Teléfono">{client.phone ? <a href={`tel:${client.phone}`}>{client.phone}</a> : "Sin registrar"}</Field>
        <Field label="Fecha de nacimiento">{client.birthday ? formatDate(`${client.birthday}T00:00:00Z`, "UTC") : "Sin registrar"}</Field>
        <Field label="Dirección">{client.address || "Sin registrar"}</Field>
        {client.photo_consent != null && <Field label="Autoriza fotografías">{client.photo_consent ? "Sí" : "No"}</Field>}
      </dl>
    </section>
    <section>
      <h3>Cuenta y asistencia</h3>
      <dl className="directory-fields">
        <Field label="Estado de la cuenta">{statusLabels[client.status] ?? client.status}</Field>
        <Field label="Acceso">{client.is_blocked ? "Bloqueado" : "Sin bloqueo"}</Field>
        <Field label="Fecha de registro">{formatDate(client.created_at, timezone)}</Field>
        {client.updated_at && <Field label="Última actualización">{formatDate(client.updated_at, timezone)}</Field>}
        <Field label="Inasistencias">{client.no_show_count}</Field>
        {client.late_cancel_count != null && <Field label="Cancelaciones tardías">{client.late_cancel_count}</Field>}
        <Field label="En seguimiento">{client.is_blacklisted ? "Sí" : "No"}</Field>
      </dl>
      {client.is_blocked && <dl className="directory-notes">
        <Field label="Motivo del bloqueo">
          {client.blocked_reason || "Sin motivo registrado"}
          {client.blocked_at && <small>Desde {formatDate(client.blocked_at, timezone)}</small>}
        </Field>
      </dl>}
      {client.is_blacklisted && client.blacklist_reason && <dl className="directory-notes"><Field label="Motivo del seguimiento">{client.blacklist_reason}</Field></dl>}
    </section>
  </div>;
}

export function ClientDialog({ client, timezone, onClose, onSaved }: {
  client: AdminClient;
  timezone: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const body = useRef<HTMLDivElement>(null);
  const pendingRef = useRef(false);
  const titleId = useId();
  const descriptionId = useId();
  const [view, setView] = useState<"details" | "actions">("details");
  const [action, setAction] = useState<Action | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const name = client.full_name?.trim() || client.email;
  const current = action ? actions[action] : null;
  const submitText = action === "delete" ? "Sí, eliminar" : current?.label;
  const reasonRequired = action === "block" || (action === "deactivate" && client.is_blocked && !client.blocked_reason?.trim());
  const destructive = action === "delete" || action === "deactivate" || action === "block";
  const available: Action[] = [client.is_blocked ? "unblock" : "block", client.status === "active" ? "deactivate" : "reactivate", "delete"];

  const close = useCallback(() => {
    if (pendingRef.current) return;
    dialog.current?.close();
    onClose();
  }, [onClose]);

  useEffect(() => {
    const element = dialog.current;
    if (element && !element.open) element.showModal();
    heading.current?.focus({ preventScroll: true });
  }, [action]);

  useEffect(() => {
    function closeOnBackdrop(event: MouseEvent) {
      const element = dialog.current;
      if (!element?.open || event.detail === 0) return;
      const { left, right, top, bottom } = element.getBoundingClientRect();
      if (event.clientX >= left && event.clientX <= right && event.clientY >= top && event.clientY <= bottom) return;
      event.preventDefault();
      event.stopPropagation();
      close();
    }
    document.addEventListener("click", closeOnBackdrop, true);
    return () => document.removeEventListener("click", closeOnBackdrop, true);
  }, [close]);

  function chooseAction(next: Action | null) {
    setAction(next);
    setError("");
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!action || pendingRef.current) return;
    const reason = String(new FormData(event.currentTarget).get("reason") ?? "").trim();
    if (reasonRequired && !reason) {
      setError("Escribe un motivo para bloquear la cuenta.");
      return;
    }
    pendingRef.current = true;
    setPending(true);
    setError("");
    try {
      let message: string;
      if (action === "delete") {
        message = await deleteAdminRecord("client", client.id);
      } else {
        const nextStatus = action === "deactivate" ? "deactivated" : action === "reactivate" ? "active" : client.status;
        const blocked = action === "block" || (action === "deactivate" && client.is_blocked);
        const { error: updateError } = await createClient().rpc("admin_update_client", {
          target_user_id: client.id,
          next_status: nextStatus,
          blocked,
          reason: blocked ? (reasonRequired ? reason : client.blocked_reason ?? null) : null,
        });
        if (updateError) throw updateError;
        message = actions[action].success;
      }
      pendingRef.current = false;
      close();
      onSaved();
      dispatchDashboardSuccess(message);
    } catch (cause) {
      setError(reportFormError(undefined, cause));
    } finally {
      pendingRef.current = false;
      setPending(false);
    }
  }

  return <dialog
    className="directory-dialog"
    ref={dialog}
    aria-labelledby={titleId}
    aria-describedby={current ? descriptionId : undefined}
    onCancel={event => { event.preventDefault(); close(); }}
  >
    <div className="directory-dialog-inner">
      <header className="directory-dialog-heading">
        <div>
          <h2 id={titleId} ref={heading} tabIndex={-1}>{current?.title ?? name}</h2>
          {current ? <p>{name}</p> : <ClientStatus client={client} />}
        </div>
        <button type="button" className="directory-control directory-dismiss" aria-label="Cerrar ficha" disabled={pending} onClick={close}><X size={19} aria-hidden="true" /></button>
      </header>
      {action && current ? (
        <form className="directory-confirm directory-dialog-step" key={action} onSubmit={save} aria-busy={pending}>
          <p id={descriptionId}>{current.description}</p>
          {action === "delete" && <p className="directory-delete-note">La eliminación es permanente. También se retirarán las comisiones de sus ventas de las liquidaciones.</p>}
          {reasonRequired && <label className="directory-reason">
            Motivo del bloqueo
            <textarea name="reason" required maxLength={500} rows={3} disabled={pending} />
          </label>}
          {error && <p className="directory-error" role="alert"><CircleAlert size={17} aria-hidden="true" />{error}</p>}
          <div className="directory-confirm-buttons">
            <button type="button" className="directory-control" disabled={pending} onClick={() => chooseAction(null)}><ArrowLeft size={16} aria-hidden="true" /> Atrás</button>
            <button type="submit" className="directory-control directory-primary" data-danger={destructive} disabled={pending}>
              {pending ? (action === "delete" ? "Eliminando…" : "Guardando…") : submitText}
            </button>
          </div>
        </form>
      ) : (
        <>
          <div className="directory-tabs" role="group" aria-label="Secciones de la ficha">
            <button type="button" aria-pressed={view === "details"} onClick={() => { setView("details"); if (body.current) body.current.scrollTop = 0; }}>Datos</button>
            <button type="button" aria-pressed={view === "actions"} onClick={() => { setView("actions"); if (body.current) body.current.scrollTop = 0; }}>Acciones</button>
          </div>
          <div className="directory-dialog-body" ref={body}>
            <div className="directory-dialog-step" key={view}>
              {view === "details" ? <ClientDetails client={client} timezone={timezone} /> : (
                <ul className="directory-actions">
                  {available.map(item => {
                    const { icon: Icon, label } = actions[item];
                    return <li key={item}><button type="button" data-danger={item === "delete"} onClick={() => chooseAction(item)}>
                      <Icon size={17} aria-hidden="true" /><span>{label}</span><ChevronRight size={17} aria-hidden="true" />
                    </button></li>;
                  })}
                </ul>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  </dialog>;
}
