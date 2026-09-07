"use client";

import Link from "next/link";
import { FormEvent } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, ChevronLeft, ChevronRight, Search, UserRoundCheck, Users, X } from "lucide-react";
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
};

type AdminClientsTableProps = {
  clients: AdminClient[];
  query: string;
  page: number;
  pageSize: number;
  total: number;
  loadError?: boolean;
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

export function AdminClientsTable({ clients, query, page, pageSize, total, loadError = false }: AdminClientsTableProps) {
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
          {loadError ? "No se pudo cargar el directorio. Comprueba que la migración de clientes esté aplicada e inténtalo de nuevo." : "Las bajas son reversibles y ningún registro se elimina físicamente. Los bloqueos requieren un motivo."}
        </p>

        {clients.length ? (
          <>
            <div className="client-table-scroll" tabIndex={0} aria-label="Tabla desplazable de clientes">
              <table className="client-data-table">
                <thead>
                  <tr>
                    <th scope="col">Cliente</th>
                    <th scope="col">Contacto</th>
                    <th scope="col">Estado</th>
                    <th scope="col">Asistencia</th>
                    <th scope="col"><span className="sr-only">Acciones</span></th>
                  </tr>
                </thead>
                <tbody>
                  {clients.map((client) => {
                    const displayName = client.full_name?.trim() || client.email;
                    const initials = displayName.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
                    const hasAlert = client.is_blacklisted || client.is_blocked;
                    return (
                      <tr key={client.id}>
                        <td>
                          <div className="client-identity">
                            <span aria-hidden="true">{initials || "CL"}</span>
                            <div><strong>{displayName}</strong><small>Desde {new Intl.DateTimeFormat("es-BO", { month: "short", year: "numeric", timeZone: "America/La_Paz" }).format(new Date(client.created_at))}</small></div>
                          </div>
                        </td>
                        <td><a href={`mailto:${client.email}`}>{client.email}</a><small>{client.phone || "Sin teléfono"}</small></td>
                        <td>
                          <span className={`client-status ${client.is_blocked ? "status-blocked" : `status-${client.status}`}`}>{client.is_blocked ? "Bloqueado" : statusLabels[client.status] ?? client.status}</span>
                          {hasAlert && <small className="client-risk"><AlertTriangle /> {client.is_blacklisted ? "Lista de seguimiento" : "Acceso restringido"}</small>}
                        </td>
                        <td><strong>{client.no_show_count}</strong><small>{client.no_show_count === 1 ? "inasistencia" : "inasistencias"}</small></td>
                        <td><ClientAdminActions id={client.id} status={client.status} blocked={client.is_blocked} /></td>
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
