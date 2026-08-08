"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarClock, ImagePlus, LogOut, PackagePlus, Save, Scissors, ShieldCheck, Store, UserPlus, Users } from "lucide-react";
import { Brand } from "@/components/brand";
import { ModeSwitcher } from "@/components/mode-switcher";
import { createClient } from "@/lib/supabase/client";
import { AppointmentAdminActions, ClientAdminActions } from "./admin-operations";

type Row = Record<string, unknown> & { id: string };
type AdminUser = { user_id: string; email: string; role: "admin" | "superadmin"; created_at: string };

type AdminDashboardProps = {
  userEmail: string;
  initialServices: Row[];
  initialGallery: Row[];
  initialProducts: Row[];
  barbers: Row[];
  initialSettings: Record<string, unknown> | null;
  isSuperadmin: boolean;
  adminUsers: AdminUser[];
  hasBarber: boolean;
  initialAppointments: Row[];
  clients: Row[];
};

async function optimizeImage(file: File) {
  if (!file.type.startsWith("image/")) throw new Error("Selecciona una imagen válida.");
  if (file.size > 8 * 1024 * 1024) throw new Error("La imagen supera el límite de 8 MB.");

  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => blob ? resolve(blob) : reject(new Error("No se pudo optimizar la imagen.")),
      "image/webp",
      0.82,
    );
  });
}

async function uploadImage(file: File, folder: string) {
  const supabase = createClient();
  const blob = await optimizeImage(file);
  const path = `${folder}/${crypto.randomUUID()}.webp`;
  const { error } = await supabase.storage.from("public-media").upload(path, blob, {
    contentType: "image/webp",
    cacheControl: "31536000",
  });
  if (error) throw error;
  return path;
}

export function AdminDashboard({
  userEmail,
  initialServices,
  initialGallery,
  initialProducts,
  barbers,
  initialSettings,
  isSuperadmin,
  adminUsers,
  hasBarber,
  initialAppointments,
  clients,
}: AdminDashboardProps) {
  const router = useRouter();
  const [section, setSection] = useState(isSuperadmin ? "administradores" : "agenda");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  function startAction() {
    setBusy(true);
    setMessage("");
    setError("");
  }

  function finishAction(text: string) {
    setBusy(false);
    setMessage(text);
    window.setTimeout(() => window.location.reload(), 650);
  }

  function failAction(reason: unknown) {
    setBusy(false);
    setError(reason instanceof Error ? reason.message : "No se pudo completar la operación.");
  }

  async function saveBusiness(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startAction();
    const form = new FormData(event.currentTarget);
    const supabase = createClient();
    const payload = {
      business_name: String(form.get("business_name") ?? ""),
      description: String(form.get("description") ?? ""),
      slogan: String(form.get("slogan") ?? ""),
      amenities: String(form.get("amenities") ?? "").split(",").map((item) => item.trim()).filter(Boolean),
      address: String(form.get("address") ?? ""),
      phone: String(form.get("phone") ?? ""),
      whatsapp: String(form.get("whatsapp") ?? ""),
      hours_text: String(form.get("hours_text") ?? ""),
      map_url: String(form.get("map_url") ?? ""),
      instagram_url: String(form.get("instagram_url") ?? ""),
      facebook_url: String(form.get("facebook_url") ?? ""),
      business_status: String(form.get("business_status") ?? "open"),
      status_message: String(form.get("status_message") ?? ""),
    };
    const { error: updateError } = await supabase.from("business_settings").update(payload).eq("id", true);
    if (updateError) return failAction(updateError);
    finishAction("Información del negocio actualizada.");
  }

  async function addService(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startAction();
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name") ?? "").trim();
    const slug = String(form.get("slug") ?? "").trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-");
    const supabase = createClient();
    const { data: insertedService, error: insertError } = await supabase
      .from("services")
      .insert({
        name,
        slug,
        description: String(form.get("description") ?? ""),
        category: String(form.get("category") ?? "Servicio"),
        price: Number(form.get("price")),
        duration_minutes: Number(form.get("duration_minutes")),
        grace_minutes: Number(form.get("grace_minutes") ?? 10),
        status: "active",
      })
      .select("id")
      .single();
    if (insertError) return failAction(insertError);
    const activeBarbers = barbers.filter((barber) => barber.active);
    if (activeBarbers.length && insertedService) {
      const { error: assignmentError } = await supabase.from("barber_services").insert(
        activeBarbers.map((barber) => ({ barber_id: barber.id, service_id: insertedService.id })),
      );
      if (assignmentError) return failAction(assignmentError);
    }
    finishAction("Servicio publicado.");
  }

  async function addGalleryPost(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startAction();
    try {
      const form = new FormData(event.currentTarget);
      const file = form.get("image");
      if (!(file instanceof File) || !file.size) throw new Error("Selecciona una imagen.");
      if (form.get("client_consent") !== "on") throw new Error("Debes confirmar la autorización de publicación.");
      const imagePath = await uploadImage(file, "gallery");
      const supabase = createClient();
      const { error: insertError } = await supabase.from("gallery_posts").insert({
        title: String(form.get("title") ?? "Trabajo destacado"),
        description: String(form.get("description") ?? ""),
        image_path: imagePath,
        status: "published",
        client_consent: true,
        consent_date: new Date().toISOString(),
        featured: form.get("featured") === "on",
      });
      if (insertError) throw insertError;
      finishAction("Imagen optimizada y publicada.");
    } catch (uploadError) {
      failAction(uploadError);
    }
  }

  async function addProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startAction();
    try {
      const form = new FormData(event.currentTarget);
      const file = form.get("image");
      const imagePath = file instanceof File && file.size ? await uploadImage(file, "products") : null;
      const name = String(form.get("name") ?? "").trim();
      const slug = String(form.get("slug") || name).trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-");
      const supabase = createClient();
      const { error: insertError } = await supabase.from("products").insert({
        name,
        slug,
        description: String(form.get("description") ?? ""),
        category: String(form.get("category") ?? "Cuidado"),
        price: Number(form.get("price")),
        stock: Number(form.get("stock")),
        image_path: imagePath,
        status: "active",
      });
      if (insertError) throw insertError;
      finishAction("Producto publicado.");
    } catch (productError) {
      failAction(productError);
    }
  }

  async function toggleStatus(table: "services" | "gallery_posts" | "products", id: string, nextStatus: string) {
    startAction();
    const supabase = createClient();
    const { error: updateError } = await supabase.from(table).update({ status: nextStatus }).eq("id", id);
    if (updateError) return failAction(updateError);
    finishAction("Estado actualizado.");
  }

  async function manageAdmin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startAction();
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "").trim().toLowerCase();
    const supabase = createClient();
    const { error: roleUpdateError } = await supabase.rpc("set_admin_role", {
      target_email: email,
      enabled: true,
    });
    if (roleUpdateError) return failAction(roleUpdateError);
    finishAction(`Acceso administrativo habilitado para ${email}.`);
  }

  async function removeAdmin(email: string) {
    if (!window.confirm(`¿Retirar el acceso administrativo de ${email}?`)) return;
    startAction();
    const supabase = createClient();
    const { error: roleUpdateError } = await supabase.rpc("set_admin_role", {
      target_email: email,
      enabled: false,
    });
    if (roleUpdateError) return failAction(roleUpdateError);
    finishAction(`Acceso administrativo retirado de ${email}.`);
  }

  async function registerBarber(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); startAction();
    const form = new FormData(event.currentTarget);
    const { error: registerError } = await createClient().rpc("pre_register_barber", {
      target_email: String(form.get("email") ?? "").trim(),
      public_name: String(form.get("public_name") ?? "").trim(),
      specialties: String(form.get("specialties") ?? "").split(",").map((item) => item.trim()).filter(Boolean),
      biography: String(form.get("biography") ?? "").trim() || null,
    });
    if (registerError) return failAction(registerError);
    finishAction("Peluquero registrado. Si la cuenta aún no existe, se activará al ingresar con Google.");
  }

  async function toggleBarber(id: string, enabled: boolean) {
    startAction();
    const { error: barberError } = await createClient().rpc("set_barber_active", { target_barber_id: id, enabled });
    if (barberError) return failAction(barberError);
    finishAction(enabled ? "Peluquero activado." : "Peluquero desactivado; sus citas futuras requieren reprogramación.");
  }

  async function logout() {
    await createClient().auth.signOut();
    router.push("/");
    router.refresh();
  }

  const settings = initialSettings ?? {};

  return (
    <main className="admin-shell">
      <header className="admin-header">
        <Brand />
        <ModeSwitcher current="admin" isAdmin hasBarber={hasBarber} />
        <div><span>{userEmail}</span><button onClick={logout}><LogOut size={16} /> Salir</button></div>
      </header>
      <div className="admin-layout">
        <aside className="admin-nav">
          <p>GESTIÓN</p>
          {[
            ["agenda", "Agenda"],
            ["clientes", "Clientes"],
            ["negocio", "Negocio"],
            ["servicios", "Servicios"],
            ["galeria", "Galería"],
            ["productos", "Productos"],
            ["equipo", "Equipo"],
            ...(isSuperadmin ? [["administradores", "Administradores"]] : []),
          ].map(([id, label]) => <button className={section === id ? "active" : ""} key={id} onClick={() => setSection(id)}>{label}</button>)}
          <Link href="/" target="_blank">Ver sitio público ↗</Link>
        </aside>
        <section className="admin-content">
          {message && <p className="admin-message">{message}</p>}
          {error && <p className="admin-error">{error}</p>}

          {section === "agenda" && <div className="admin-panel"><div className="admin-title"><CalendarClock /><div><p>OPERACIÓN</p><h1>Reservas y agenda</h1></div></div><div className="admin-metrics"><div><strong>{initialAppointments.filter((item)=>["requested","confirmed","pending_client_confirmation"].includes(String(item.status))).length}</strong><span>Próximas o pendientes</span></div><div><strong>{initialAppointments.filter((item)=>item.status==="needs_reschedule").length}</strong><span>Por reprogramar</span></div><div><strong>{initialAppointments.length}</strong><span>Últimas reservas</span></div></div><div className="admin-list appointment-admin-list">{initialAppointments.length?initialAppointments.map((item)=>{const client=item.profiles as {full_name?:string;phone?:string;email?:string;is_blacklisted?:boolean}|null;const barber=item.barber_profiles as {display_name?:string}|null;return <article key={item.id}><div><strong>{String(item.service_name_snapshot)} · {new Intl.DateTimeFormat("es-BO",{dateStyle:"medium",timeStyle:"short",timeZone:"America/La_Paz"}).format(new Date(String(item.starts_at)))}</strong><span>{client?.full_name??client?.email??"Cliente"} · {client?.phone??"Sin teléfono"} · {barber?.display_name??"Sin asignar"} · {String(item.status)}</span>{client?.is_blacklisted&&<small className="admin-alert">Alerta por inasistencias</small>}</div><AppointmentAdminActions id={item.id} barbers={barbers as Array<{id:string;display_name:string;active?:boolean}>}/></article>}):<p className="admin-help">Todavía no existen reservas.</p>}</div></div>}

          {section === "clientes" && <div className="admin-panel"><div className="admin-title"><Users /><div><p>USUARIOS</p><h1>Clientes</h1></div></div><p className="admin-help">Puedes dar de baja cuentas antiguas o bloquear manualmente a clientes reincidentes. Ninguna cuenta se elimina físicamente.</p><div className="admin-list client-admin-list">{clients.length?clients.map((item)=><article key={item.id}><div><strong>{String(item.full_name??item.email)}</strong><span>{String(item.email)} · {String(item.phone??"Sin teléfono")} · {String(item.status)} · {String(item.no_show_count)} inasistencia(s)</span>{Boolean(item.is_blacklisted)&&<small className="admin-alert">Lista negra informativa</small>}</div><ClientAdminActions id={item.id} status={String(item.status)} blocked={Boolean(item.is_blocked)}/></article>):<p className="admin-help">Todavía no existen clientes registrados.</p>}</div></div>}

          {section === "negocio" && <div className="admin-panel">
            <div className="admin-title"><Store /><div><p>CONFIGURACIÓN PÚBLICA</p><h1>Información del negocio</h1></div></div>
            <form className="admin-form" onSubmit={saveBusiness} acceptCharset="UTF-8">
              <label>Nombre<input name="business_name" required defaultValue={String(settings.business_name ?? "Barbería LEGEND CLUB")} /></label>
              <label>Estado<select name="business_status" defaultValue={String(settings.business_status ?? "open")}><option value="open">Abierto</option><option value="appointment_only">Solo con reserva</option><option value="closed">Cerrado</option><option value="emergency_closed">Cierre de emergencia</option></select></label>
              <label className="wide">Descripción<textarea name="description" defaultValue={String(settings.description ?? "")} /></label>
              <label className="wide">Lema<input name="slogan" defaultValue={String(settings.slogan ?? "")} /></label>
              <label className="wide">Beneficios separados por comas<input name="amenities" defaultValue={Array.isArray(settings.amenities) ? settings.amenities.join(", ") : ""} /></label>
              <label className="wide">Mensaje de estado<input name="status_message" defaultValue={String(settings.status_message ?? "")} /></label>
              <label className="wide">Dirección<input name="address" defaultValue={String(settings.address ?? "")} /></label>
              <label>Teléfono<input name="phone" defaultValue={String(settings.phone ?? "")} /></label>
              <label>WhatsApp sin +<input name="whatsapp" defaultValue={String(settings.whatsapp ?? "")} /></label>
              <label className="wide">Horario informativo<input name="hours_text" defaultValue={String(settings.hours_text ?? "")} /></label>
              <label className="wide">Enlace de Google Maps<input name="map_url" type="url" defaultValue={String(settings.map_url ?? "")} /></label>
              <label>Instagram<input name="instagram_url" defaultValue={String(settings.instagram_url ?? "")} /></label>
              <label>Facebook<input name="facebook_url" defaultValue={String(settings.facebook_url ?? "")} /></label>
              <button className="button button-dark wide" disabled={busy}><Save size={17} /> Guardar cambios</button>
            </form>
          </div>}

          {section === "servicios" && <div className="admin-panel">
            <div className="admin-title"><Scissors /><div><p>CATÁLOGO</p><h1>Servicios</h1></div></div>
            <form className="admin-form compact-form" onSubmit={addService} acceptCharset="UTF-8">
              <label>Nombre<input name="name" required /></label><label>Identificador<input name="slug" required placeholder="corte-clasico" /></label>
              <label className="wide">Descripción<input name="description" /></label><label>Categoría<input name="category" /></label>
              <label>Precio Bs<input name="price" type="number" min="0" step="0.5" required /></label><label>Duración (min)<input name="duration_minutes" type="number" min="5" required /></label><label>Gracia (min)<input name="grace_minutes" type="number" min="0" defaultValue="10" /></label>
              <button className="button button-dark wide" disabled={busy}>Agregar servicio</button>
            </form>
            <div className="admin-list">{initialServices.map((item) => <article key={item.id}><div><strong>{String(item.name)}</strong><span>Bs {String(item.price)} · {String(item.duration_minutes)} min · {String(item.status)}</span></div><button onClick={() => toggleStatus("services", item.id, item.status === "active" ? "inactive" : "active")}>{item.status === "active" ? "Desactivar" : "Activar"}</button></article>)}</div>
          </div>}

          {section === "galeria" && <div className="admin-panel">
            <div className="admin-title"><ImagePlus /><div><p>CONTENIDO</p><h1>Galería de trabajos</h1></div></div>
            <form className="admin-form" onSubmit={addGalleryPost} acceptCharset="UTF-8"><label>Título<input name="title" required /></label><label>Imagen<input name="image" type="file" accept="image/jpeg,image/png,image/webp" required /></label><label className="wide">Descripción<input name="description" /></label><label className="check-label wide"><input type="checkbox" name="client_consent" /> Confirmo que existe autorización del cliente.</label><label className="check-label wide"><input type="checkbox" name="featured" /> Marcar como destacada.</label><button className="button button-dark wide" disabled={busy}>Optimizar y publicar</button></form>
            <div className="admin-list">{initialGallery.map((item) => <article key={item.id}><div><strong>{String(item.title)}</strong><span>{String(item.status)} · consentimiento: {item.client_consent ? "sí" : "no"}</span></div><button onClick={() => toggleStatus("gallery_posts", item.id, item.status === "published" ? "hidden" : "published")}>{item.status === "published" ? "Ocultar" : "Publicar"}</button></article>)}</div>
          </div>}

          {section === "productos" && <div className="admin-panel">
            <div className="admin-title"><PackagePlus /><div><p>CATÁLOGO</p><h1>Productos</h1></div></div>
            <form className="admin-form" onSubmit={addProduct} acceptCharset="UTF-8"><label>Nombre<input name="name" required /></label><label>Identificador<input name="slug" placeholder="se genera del nombre" /></label><label className="wide">Descripción<input name="description" /></label><label>Categoría<input name="category" /></label><label>Precio Bs<input name="price" type="number" min="0" step="0.5" required /></label><label>Stock<input name="stock" type="number" min="0" required /></label><label className="wide">Imagen<input name="image" type="file" accept="image/jpeg,image/png,image/webp" /></label><button className="button button-dark wide" disabled={busy}>Publicar producto</button></form>
            <div className="admin-list">{initialProducts.map((item) => <article key={item.id}><div><strong>{String(item.name)}</strong><span>Bs {String(item.price)} · stock {String(item.stock)} · {String(item.status)}</span></div><button onClick={() => toggleStatus("products", item.id, item.status === "active" ? "inactive" : "active")}>{item.status === "active" ? "Desactivar" : "Activar"}</button></article>)}</div>
          </div>}

          {section === "equipo" && <div className="admin-panel"><div className="admin-title"><Scissors /><div><p>PERSONAL</p><h1>Peluqueros</h1></div></div><p className="admin-help">Si el correo ya pertenece a un cliente, se convierte de inmediato. Si todavía no existe, el perfil se activará cuando ingrese con Google.</p><form className="admin-form" onSubmit={registerBarber} acceptCharset="UTF-8"><label>Correo Google<input name="email" type="email" required /></label><label>Nombre público<input name="public_name" required /></label><label className="wide">Especialidades separadas por comas<input name="specialties" placeholder="Fades, Barba, Cortes clásicos" /></label><label className="wide">Biografía<textarea name="biography" /></label><button className="button button-dark wide" disabled={busy}>Registrar peluquero</button></form><div className="admin-list">{barbers.map((item) => <article key={item.id}><div><strong>{String(item.display_name)}</strong><span>{item.active ? "Activo" : "Inactivo"} · {Array.isArray(item.specialties) ? item.specialties.join(", ") : ""}</span></div><button disabled={busy} onClick={() => toggleBarber(item.id, !Boolean(item.active))}>{item.active ? "Desactivar" : "Activar"}</button></article>)}</div></div>}

          {section === "administradores" && isSuperadmin && <div className="admin-panel">
            <div className="admin-title"><ShieldCheck /><div><p>SEGURIDAD</p><h1>Administradores</h1></div></div>
            <p className="admin-help">La persona debe iniciar sesión una vez con Google antes de recibir acceso. Solo el superadministrador puede gestionar estos permisos.</p>
            <form className="admin-form admin-role-form" onSubmit={manageAdmin} acceptCharset="UTF-8">
              <label className="wide">Correo de la cuenta Google<input name="email" type="email" inputMode="email" autoComplete="email" placeholder="administrador@correo.com" required /></label>
              <button className="button button-dark wide" disabled={busy}><UserPlus size={17} /> Habilitar administrador</button>
            </form>
            <div className="admin-list">{adminUsers.map((item) => <article key={`${String(item.user_id)}-${String(item.role)}`}><div><strong>{String(item.email)}</strong><span>{item.role === "superadmin" ? "Superadministrador · desarrollador" : "Administrador"}</span></div>{item.role === "admin" && <button disabled={busy} onClick={() => removeAdmin(String(item.email))}>Retirar acceso</button>}</article>)}</div>
          </div>}
        </section>
      </div>
    </main>
  );
}
