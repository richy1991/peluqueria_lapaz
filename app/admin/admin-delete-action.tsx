"use client";

import { useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { dispatchDashboardError, dispatchDashboardSuccess } from "@/lib/form-feedback";

type Entity = "client" | "product" | "barber" | "gallery" | "service";

const entities = {
  client: { rpc: "clients", success: "Cliente eliminado de la base de datos.", detail: "Se eliminarán su cuenta de acceso y sus datos de cliente." },
  product: { rpc: "products", success: "Producto eliminado de la base de datos.", detail: "El producto dejará de estar disponible en el catálogo." },
  barber: { rpc: "barbers", success: "Peluquero eliminado de la base de datos.", detail: "Se eliminarán su perfil de peluquero y su acceso como peluquero. Si tiene otros roles, los conservará." },
  gallery: { rpc: "gallery", success: "Publicación eliminada de la base de datos.", detail: "La publicación dejará de aparecer en la galería." },
  service: { rpc: "services", success: "Servicio eliminado de la base de datos.", detail: "El servicio dejará de estar disponible para nuevas reservas." },
} satisfies Record<Entity, { rpc: string; success: string; detail: string }>;

export function AdminDeleteAction({ entity, id, label, disabled = false, confirmInitially = false, imagePaths = [], onDeleted }: { entity: Entity; id: string; label: string; disabled?: boolean; confirmInitially?: boolean; imagePaths?: string[]; onDeleted?: () => void }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(confirmInitially);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const pendingRef = useRef(false);
  const confirmationId = useId();
  const config = entities[entity];

  async function removeRecord() {
    if (pendingRef.current || disabled) return;
    pendingRef.current = true;
    setBusy(true);
    setError("");
    try {
      const supabase = createClient();
      const { error: deleteError } = await supabase.rpc("admin_delete_record", { entity_type: config.rpc, target_id: id });
      if (deleteError) throw deleteError;
      const storedPaths = [...new Set(imagePaths.filter((path) => path && !/^(?:https?:|data:|blob:|\/)/i.test(path)))];
      let cleanupPending = false;
      if (storedPaths.length && (entity === "product" || entity === "gallery")) {
        try {
          const { error: storageError } = await supabase.storage.from("public-media").remove(storedPaths);
          cleanupPending = Boolean(storageError);
        } catch {
          cleanupPending = true;
        }
      }
      setConfirming(false);
      onDeleted?.();
      dispatchDashboardSuccess(`${config.success}${cleanupPending ? " No se pudieron retirar sus archivos de imagen del almacenamiento." : ""}`);
      router.refresh();
    } catch (reason) {
      const message = reason && typeof reason === "object" && "message" in reason ? String(reason.message) : "No se pudo eliminar el registro. Inténtalo de nuevo.";
      setError(message);
      dispatchDashboardError(message);
    } finally {
      pendingRef.current = false;
      setBusy(false);
    }
  }

  return <div className={`admin-delete-action${confirming ? " is-confirming" : ""}`}>
    {!confirming ? <button type="button" className="dash-danger-action" disabled={disabled || busy} onClick={() => setConfirming(true)}><Trash2 aria-hidden="true" /><span>Eliminar</span></button> : <section className="admin-delete-confirmation" aria-labelledby={confirmationId} aria-busy={busy}>
      <h3 id={confirmationId}>Eliminar «{label}»</h3>
      <p>{config.detail} Esta acción es permanente.</p>
      {entity !== "gallery" && <p>El historial de ventas y cobros se conserva.</p>}
      <div className="admin-confirm-actions">
        <button type="button" disabled={busy} onClick={() => { setConfirming(false); setError(""); }}>Cancelar</button>
        <button type="button" className="dash-danger-action" disabled={disabled || busy} onClick={removeRecord}><Trash2 aria-hidden="true" />{busy ? "Eliminando…" : "Sí, eliminar"}</button>
      </div>
      {error && <p className="admin-delete-error" role="alert">{error}</p>}
    </section>}
  </div>;
}
