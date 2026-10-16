"use client";

import Link from "next/link";
import { FormEvent } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, ChevronLeft, ChevronRight, Search, UserRoundCheck, Users, X } from "lucide-react";
import { DashboardModal } from "@/components/dashboard-modal";
import { ClientAdminActions } from "./admin-operations";

export type AdminClient = {
  id: string;
  full_name: string | null;
  email: string;
  phone: string | null;
  status: string;
  no_show_count: number;
  is_blacklisted: boolean;
  is_blocked: boolean;
  created_at: string;
  birthday?: string | null;
  address?: string | null;
  late_cancel_count?: number;
  blacklist_reason?: string | null;
  blocked_reason?: string | null;
  blocked_at?: string | null;
  photo_consent?: boolean;
  updated_at?: string;
};

type AdminClientsTableProps = {
  clients: AdminClient[];
  query: string;
  page: number;
  pageSize: number;
  total: number;
  loadError?: boolean;
  timezone: string;
};

const statusLabels: Record<string, string> = {
  active: "Activo",
  inactive: "Inactivo",
  deactivated: "Dado de baja",
  suspended: "Suspendido",
};

function pageHref(page: number, query: string) {
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  if (page > 1) params.set("page", String(page));
  const suffix = params.toString();
  return `/admin/clientes${suffix ? `?${suffix}` : ""}`;
}

function ClientDetails({ client, timezone }: { client: AdminClient; timezone: string }) {
  const date = (value: string) => new Intl.DateTimeFormat("es-BO", {
    dateStyle: "medium",
    timeZone: timezone,
  }).format(new Date(value));

  return (
    <div className="client-details">
      <dl className="client-details-grid">
        <div><dt>Nombre completo</dt><dd>{client.full_name || "Sin nombre registrado"}</dd></div>
        <div><dt>Correo electrónico</dt><dd><a href={`mailto:${client.email}`}>{client.email}</a></dd></div>
        <div><dt>Teléfono</dt><dd>{client.phone ? <a href={`tel:${client.phone}`}>{client.phone}</a> : "Sin teléfono"}</dd></div>
        <div><dt>Estado de la cuenta</dt><dd>{statusLabels[client.status] ?? client.status}</dd></div>
        <div><dt>Acceso</dt><dd>{client.is_blocked ? "Bloqueado" : "Sin bloqueo"}</dd></div>
        <div><dt>Fecha de registro</dt><dd>{date(client.created_at)}</dd></div>
        <div><dt>Fecha de nacimiento</dt><dd>{client.birthday ? new Intl.DateTimeFormat("es-BO", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(`${client.birthday}T00:00:00Z`)) : "Sin registrar"}</dd></div>
        <div><dt>Dirección</dt><dd>{client.address || "Sin registrar"}</dd></div>
        <div><dt>Inasistencias</dt><dd>{client.no_show_count}</dd></div>
        {client.late_cancel_count !== undefined && <div><dt>Cancelaciones tardías</dt><dd>{client.late_cancel_count}</dd></div>}
        <div><dt>Lista de seguimiento</dt><dd>{client.is_blacklisted ? "Sí" : "No"}</dd></div>
        {client.photo_consent !== undefined && <div><dt>Autoriza fotografías</dt><dd>{client.photo_consent ? "Sí" : "No"}</dd></div>}
        {client.is_blocked && <div className="client-details-wide"><dt>Motivo del bloqueo</dt><dd>{client.blocked_reason || "Sin motivo registrado"}{client.blocked_at && <small>Desde {date(client.blocked_at)}</small>}</dd></div>}
        {client.is_blacklisted && client.blacklist_reason && <div className="client-details-wide"><dt>Motivo del seguimiento</dt><dd>{client.blacklist_reason}</dd></div>}
        {client.updated_at && <div><dt>Última actualización</dt><dd>{date(client.updated_at)}</dd></div>}
      </dl>
      <p className="client-details-help">Dar de baja desactiva la cuenta y permite reactivarla. Eliminar borra la cuenta permanentemente.</p>
      <ClientAdminActions id={client.id} name={client.full_name?.trim() || client.email} status={client.status} blocked={client.is_blocked} blockedReason={client.blocked_reason} />
    </div>
  );
}

export function AdminClientsTable({ clients, query, page, pageSize, total, loadError = false, timezone }: AdminClientsTableProps) {
  const router = useRouter();
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const firstResult = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const lastResult = Math.min(page * pageSize, total);

  function searchClients(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const nextQuery = String(form.get("q") ?? "").trim();
    const params = new URLSearchParams();
    if (nextQuery) params.set("q", nextQuery);
    router.replace(`/admin/clientes${params.size ? `?${params}` : ""}`);
  }

  return (
    <div className="admin-page admin-clients-page">
      <header className="admin-page-header">
        <div>
          <p>ADMINISTRACIÓN <span>/</span> CLIENTES</p>
          <h1>Clientes</h1>
          <span>Busca, revisa y gestiona las cuentas desde una vista preparada para crecer.</span>
        </div>
        <div className="admin-page-count" aria-label={`${total} clientes encontrados`}>
          <Users />
          <span><strong>{total}</strong> clientes</span>
        </div>
      </header>

      <section className="admin-panel clients-workspace" aria-labelledby="clients-table-title">
        <div className="clients-toolbar">
          <div>
            <small>DIRECTORIO</small>
            <h2 id="clients-table-title">Listado de clientes</h2>
          </div>
          <form className="clients-search" action="/admin/clientes" method="get" role="search" onSubmit={searchClients}>
            <label htmlFor="client-search">Buscar clientes</label>
            <div>
              <Search aria-hidden="true" />
              <input
                id="client-search"
                name="q"
                type="search"
                defaultValue={query}
                placeholder="Nombre, correo o teléfono"
                autoComplete="off"
              />
              {query && <Link href="/admin/clientes" replace aria-label="Limpiar búsqueda" title="Limpiar búsqueda"><X /></Link>}
              <button type="submit">Buscar</button>
            </div>
          </form>
        </div>

        <p className={`clients-guidance ${loadError ? "is-error" : ""}`}>
          {loadError ? "No se pudo cargar el directorio. Comprueba que la migración de clientes esté aplicada e inténtalo de nuevo." : "Selecciona un cliente para ver sus datos, dar de baja, bloquear o eliminar su cuenta."}
        </p>

        {clients.length ? (
          <>
            <div className="client-table-scroll">
              <table className="client-data-table">
                <thead>
                  <tr>
                    <th scope="col">Cliente</th>
                    <th scope="col" className="client-contact-column">Contacto</th>
                    <th scope="col">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {clients.map((client) => {
                    const displayName = client.full_name?.trim() || client.email;
                    const initials = displayName.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
                    const hasAlert = client.is_blacklisted || client.is_blocked;
                    return (
                      <tr key={client.id} className="client-selectable-row" onClick={(event) => {
                        if (!(event.target instanceof Element) || !event.currentTarget.contains(event.target) || event.target.closest("button, a, input, select, textarea")) return;
                        event.currentTarget.querySelector<HTMLButtonElement>(".client-details-trigger")?.click();
                      }}>
                        <td>
                          <DashboardModal
                            title={displayName}
                            description="Consulta sus datos y administra su cuenta."
                            eyebrow="FICHA DEL CLIENTE"
                            triggerLabel={displayName}
                            ariaLabel={`Ver datos y acciones de ${displayName}`}
                            triggerClassName="client-details-trigger"
                            triggerContent={<div className="client-identity">
                              <span aria-hidden="true">{initials || "CL"}</span>
                              <div><strong>{displayName}</strong><small>Ver ficha <ChevronRight aria-hidden="true" /></small></div>
                            </div>}
                            variant="ghost"
                          >
                            <ClientDetails client={client} timezone={timezone} />
                          </DashboardModal>
                        </td>
                        <td className="client-contact-column"><a href={`mailto:${client.email}`}>{client.email}</a><small>{client.phone || "Sin teléfono"}</small></td>
                        <td>
                          <span className={`client-status ${client.is_blocked ? "status-blocked" : `status-${client.status}`}`}>{client.is_blocked ? "Bloqueado" : statusLabels[client.status] ?? client.status}</span>
                          {hasAlert && <small className="client-risk"><AlertTriangle /> {client.is_blacklisted ? "Lista de seguimiento" : "Acceso restringido"}</small>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <footer className="clients-pagination">
              <p>Mostrando <strong>{firstResult}–{lastResult}</strong> de <strong>{total}</strong></p>
              <nav aria-label="Paginación de clientes">
                {page > 1 ? <Link href={pageHref(page - 1, query)} replace aria-label="Página anterior"><ChevronLeft /> Anterior</Link> : <span aria-disabled="true"><ChevronLeft /> Anterior</span>}
                <b>Página {page} de {totalPages}</b>
                {page < totalPages ? <Link href={pageHref(page + 1, query)} replace>Siguiente <ChevronRight /></Link> : <span aria-disabled="true">Siguiente <ChevronRight /></span>}
              </nav>
            </footer>
          </>
        ) : (
          <div className="clients-empty">
            <UserRoundCheck />
            <h3>{loadError ? "No pudimos cargar los clientes" : query ? "No encontramos coincidencias" : "Todavía no hay clientes"}</h3>
            <p>{loadError ? "Actualiza la página después de revisar la conexión con la base de datos." : query ? `Prueba con otro nombre, correo o teléfono distinto de “${query}”.` : "Las nuevas cuentas aparecerán aquí automáticamente."}</p>
            {query && <Link href="/admin/clientes" replace>Ver todos los clientes</Link>}
          </div>
        )}
      </section>
    </div>
  );
}
