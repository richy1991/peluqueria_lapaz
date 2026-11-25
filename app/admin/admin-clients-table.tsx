"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import { ArrowRight, ChevronLeft, ChevronRight, CircleAlert, Search, Users, X } from "lucide-react";
import { ClientDialog, ClientStatus } from "./admin-operations";
import "./admin-clients.css";

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

function pageHref(page: number, query: string) {
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  if (page > 1) params.set("page", String(page));
  const suffix = params.toString();
  return `/admin/clientes${suffix ? `?${suffix}` : ""}`;
}

const number = new Intl.NumberFormat("es-BO");

export function AdminClientsTable({ clients, query, page, pageSize, total, loadError = false, timezone }: AdminClientsTableProps) {
  const router = useRouter();
  const [loading, startTransition] = useTransition();
  const [selected, setSelected] = useState<AdminClient | null>(null);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const firstResult = (page - 1) * pageSize + 1;
  const lastResult = Math.min(page * pageSize, total);

  function navigate(event: { preventDefault: () => void }, href: string) {
    event.preventDefault();
    startTransition(() => router.replace(href));
  }

  function searchClients(event: FormEvent<HTMLFormElement>) {
    const data = new FormData(event.currentTarget);
    navigate(event, pageHref(1, String(data.get("q") ?? "").trim()));
  }

  function refresh() {
    startTransition(() => router.refresh());
  }

  return (
    <div className="admin-directory">
      <header className="directory-heading">
        <h1>Clientes</h1>
      </header>

      <section aria-label="Directorio" aria-busy={loading}>
        <div className="directory-toolbar">
          <form className="directory-search" key={query} action="/admin/clientes" method="get" role="search" onSubmit={searchClients}>
            <div className="directory-search-field">
              <Search size={16} aria-hidden="true" />
              <input aria-label="Buscar por nombre, correo o teléfono" name="q" type="search" defaultValue={query} placeholder="Nombre, correo o teléfono" autoComplete="off" maxLength={100} />
              {query && <Link href="/admin/clientes" replace aria-label="Limpiar búsqueda" onNavigate={event => navigate(event, "/admin/clientes")}><X size={16} aria-hidden="true" /></Link>}
            </div>
            <button type="submit" className="directory-control" disabled={loading}>Buscar</button>
          </form>
          <p className="directory-total" role="status">{loading ? "Cargando…" : !loadError && `${number.format(total)} ${total === 1 ? "cliente" : "clientes"}`}</p>
        </div>

        {!loadError && clients.length > 0 ? (
          <div className="directory-results" key={pageHref(page, query)}>
            <table className="directory-table" aria-label="Clientes">
              <thead>
                <tr>
                  <th scope="col">Cliente</th>
                  <th scope="col" className="directory-contact">Contacto</th>
                  <th scope="col">Estado</th>
                  <th scope="col" className="directory-access"><span className="directory-sr-only">Ficha</span></th>
                </tr>
              </thead>
              <tbody>
                {clients.map(client => {
                  const name = client.full_name?.trim() || client.email;
                  const initials = name.split(/\s+/).slice(0, 2).map(part => part[0]).join("").toUpperCase();
                  return (
                    <tr key={client.id} onClick={event => {
                      if (event.target instanceof Element && !event.target.closest("a, button")) {
                        event.currentTarget.querySelector<HTMLButtonElement>(".directory-open")?.click();
                      }
                    }}>
                      <td>
                        <div className="directory-identity">
                          <span className="directory-initials" aria-hidden="true">{initials}</span>
                          <div>
                            <strong>{name}</strong>
                            <small className="directory-mobile-contact">{client.phone || (client.full_name?.trim() ? client.email : "Sin teléfono")}</small>
                          </div>
                        </div>
                      </td>
                      <td className="directory-contact">
                        <a href={`mailto:${client.email}`} title={client.email}>{client.email}</a>
                        <small>{client.phone || "Sin teléfono"}</small>
                      </td>
                      <td>
                        <ClientStatus client={client} />
                        {client.is_blacklisted && <small className="directory-alert"><CircleAlert size={13} aria-hidden="true" /> Seguimiento</small>}
                      </td>
                      <td className="directory-access">
                        <button className="directory-open" type="button" aria-haspopup="dialog" aria-label={`Ver ficha de ${name}`} disabled={loading} onClick={event => {
                          event.currentTarget.focus();
                          setSelected(client);
                        }}>
                          <span>Ver ficha</span><ArrowRight size={16} aria-hidden="true" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <footer className="directory-pagination">
              <p>{number.format(firstResult)}–{number.format(lastResult)} de {number.format(total)}</p>
              <nav aria-label="Paginación de clientes">
                {page > 1 ? <Link href={pageHref(page - 1, query)} replace onNavigate={event => navigate(event, pageHref(page - 1, query))}><ChevronLeft size={16} aria-hidden="true" /> Anterior</Link> : <span aria-disabled="true"><ChevronLeft size={16} aria-hidden="true" /> Anterior</span>}
                <span className="directory-page">Página {number.format(page)} de {number.format(totalPages)}</span>
                {page < totalPages ? <Link href={pageHref(page + 1, query)} replace onNavigate={event => navigate(event, pageHref(page + 1, query))}>Siguiente <ChevronRight size={16} aria-hidden="true" /></Link> : <span aria-disabled="true">Siguiente <ChevronRight size={16} aria-hidden="true" /></span>}
              </nav>
            </footer>
          </div>
        ) : (
          <div className="directory-empty" role={loadError ? "alert" : undefined}>
            {loadError ? <CircleAlert size={23} aria-hidden="true" /> : <Users size={23} aria-hidden="true" />}
            <h2>{loadError ? "No pudimos cargar los clientes" : query ? "No encontramos coincidencias" : "Todavía no hay clientes"}</h2>
            {loadError ? <button className="directory-control" type="button" onClick={refresh} disabled={loading}>Volver a intentar</button>
              : query && <Link className="directory-control" href="/admin/clientes" replace onNavigate={event => navigate(event, "/admin/clientes")}>Limpiar búsqueda</Link>}
          </div>
        )}
      </section>
      {selected && <ClientDialog client={selected} timezone={timezone} onClose={() => setSelected(null)} onSaved={refresh} />}
    </div>
  );
}
