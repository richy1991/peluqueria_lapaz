"use client";

import { useId, useRef, useState, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BarChart3, CalendarClock, ChevronRight, CircleDollarSign, Clock3, ExternalLink, ImagePlus, LogOut, PackagePlus, PanelLeftClose, PanelLeftOpen, Scissors, ShieldCheck, Store, UserPlus, Users, X } from "lucide-react";
import { Brand } from "@/components/brand";
import { ModeSwitcher } from "@/components/mode-switcher";
import { PanelMobileMenuButton, PanelMobileScrim, PanelMobileSidebarClose, PanelResponsiveSidebar, PanelThemeSelector } from "@/components/panel-experience";
import { createClient } from "@/lib/supabase/client";

const navigation = [
  { title: "Atención", links: [
    ["agenda", "Agenda", CalendarClock],
    ["clientes", "Clientes", Users],
    ["horarios", "Horarios", Clock3],
  ] },
  { title: "Catálogo", links: [
    ["servicios", "Servicios", Scissors],
    ["productos", "Productos", PackagePlus],
    ["galeria", "Galería", ImagePlus],
  ] },
  { title: "Gestión", links: [
    ["equipo", "Equipo", UserPlus],
    ["programa", "Caja y fidelización", CircleDollarSign],
    ["negocio", "Negocio", Store],
    ["estadisticas", "Estadísticas", BarChart3],
  ] },
] as const;

function AdminSignOut({ className }: { className: string }) {
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function signOut(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    try {
      const result = await createClient().auth.signOut();
      if (result.error) throw result.error;
      router.replace("/");
      router.refresh();
    } catch {
      setError("No pudimos cerrar tu sesión. Intenta de nuevo.");
      setPending(false);
    }
  }

  return <>
    <button type="button" className={className} aria-haspopup="dialog" onClick={() => {
      setError("");
      dialog.current?.showModal();
    }}><LogOut size={16} aria-hidden="true" /><span>Cerrar sesión</span></button>
    <dialog className="admin-sign-out-dialog" ref={dialog} aria-labelledby={titleId} aria-describedby={descriptionId} onCancel={event => {
      if (pending) event.preventDefault();
    }}>
      <header>
        <LogOut size={20} aria-hidden="true" />
        <button type="button" className="admin-sign-out-close" aria-label="Cerrar ventana" disabled={pending} onClick={() => dialog.current?.close()}><X size={19} aria-hidden="true" /></button>
      </header>
      <h2 id={titleId}>¿Cerrar sesión?</h2>
      <p id={descriptionId}>Para volver a Administración tendrás que entrar con Google.</p>
      <form className="admin-sign-out-form" onSubmit={signOut}>
        {error && <p role="alert">{error}</p>}
        <button type="submit" disabled={pending}>{pending ? "Cerrando sesión…" : "Sí, cerrar sesión"}</button>
      </form>
    </dialog>
  </>;
}

export function AdminNavigation({ section, profile, isSuperadmin, hasBarber, hasCashier, children }: {
  section: string;
  profile: { full_name: string; avatar_url: string | null };
  isSuperadmin: boolean;
  hasBarber: boolean;
  hasCashier: boolean;
  children: ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const role = isSuperadmin ? "Superadministrador" : "Administrador";
  const initials = profile.full_name.trim().split(/\s+/).slice(0, 2).map(part => part[0]).join("").toUpperCase() || "AD";
  const avatarStyle = profile.avatar_url ? { backgroundImage: `url(${JSON.stringify(profile.avatar_url)})` } : undefined;

  return <>
    <header className="admin-header dash-header admin-workspace-header">
      <PanelMobileMenuButton />
      <div className="dash-brand"><Brand linked={false} /><span className="admin-workspace-role">Administración</span></div>
      <ModeSwitcher current="admin" isAdmin hasBarber={hasBarber} isCashier={hasCashier} showClient={false} />
      <div className="dash-user"><AdminSignOut className="desktop-logout admin-logout-trigger" /></div>
    </header>
    <div className={`admin-layout${collapsed ? " nav-collapsed" : ""}`}>
      <PanelResponsiveSidebar>
        <aside className="admin-nav dash-sidebar admin-workspace-nav">
          <div className="dash-sidebar-head">
            <p>Administración</p>
            <button type="button" className="dash-collapse" aria-expanded={!collapsed} aria-controls="admin-workspace-links" aria-label={collapsed ? "Expandir menú lateral" : "Contraer menú lateral"} onClick={() => setCollapsed(value => !value)}>
              {collapsed ? <PanelLeftOpen aria-hidden="true" /> : <PanelLeftClose aria-hidden="true" />}
            </button>
            <PanelMobileSidebarClose />
          </div>
          <nav id="admin-workspace-links" aria-label="Páginas de administración">
            {navigation.map(({ title, links }) => {
              const group = isSuperadmin && title === "Gestión"
                ? [...links, ["administradores", "Administradores", ShieldCheck] as const]
                : links;
              return <div className="admin-nav-group" role="group" aria-label={title} key={title}>
                <p className="admin-nav-label" aria-hidden="true">{title}</p>
                {group.map(([id, label, Icon]) => <Link href={`/admin/${id}`} replace title={label} aria-label={label} aria-current={section === id ? "page" : undefined} key={id}>
                  <Icon aria-hidden="true" /><span>{label}</span>
                </Link>)}
              </div>;
            })}
          </nav>
          <div className="dash-sidebar-foot">
            <PanelThemeSelector />
            <Link href="/sitio" aria-label="Ver sitio público" title="Ver sitio público"><ExternalLink aria-hidden="true" /><span>Ver sitio público</span></Link>
            <AdminSignOut className="mobile-sidebar-logout admin-logout-trigger" />
          </div>
          <Link href="/admin/perfil" replace className="admin-sidebar-profile" aria-current={section === "perfil" ? "page" : undefined} aria-label={`Mi perfil, ${profile.full_name}`} title="Mi perfil">
            <div className={`admin-sidebar-avatar${profile.avatar_url ? " has-photo" : ""}`} style={avatarStyle} aria-hidden="true">{!profile.avatar_url && initials}</div>
            <span><strong>{profile.full_name}</strong><small>{role}</small></span>
            <ChevronRight aria-hidden="true" />
          </Link>
        </aside>
        <PanelMobileScrim />
      </PanelResponsiveSidebar>
      {children}
    </div>
  </>;
}
