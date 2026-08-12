"use client";

import { FormEvent, useCallback, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BarChart3, CalendarClock, CircleDollarSign, ImagePlus, LogOut, Menu, PackagePlus, Save, Scissors, ShieldCheck, Sparkles, Store, Trash2, UserPlus, UserRoundCog, Users, X } from "lucide-react";
import { Brand } from "@/components/brand";
import { ModeSwitcher } from "@/components/mode-switcher";
import { createClient } from "@/lib/supabase/client";
import { AppointmentAdminActions, ClientAdminActions } from "./admin-operations";
import { AdminAnalytics, type AnalyticsData } from "./admin-analytics";
import { AdminProgram } from "./admin-program";
import { DashboardModal } from "@/components/dashboard-modal";
import { DashboardToast, type DashboardToastData } from "@/components/dashboard-toast";
import { PanelMobileLogout, PanelMobileMenuButton, PanelMobileScrim, PanelMobileSidebarClose, PanelThemeSelector } from "@/components/panel-experience";
import { clearFormErrors, dispatchDashboardSuccess, reportFormError } from "@/lib/form-feedback";
import type {LucideIcon} from "lucide-react";

type Row = Record<string, unknown> & { id: string };
type AdminUser = { user_id: string | null; email: string; role: "admin" | "superadmin" | "pending"; created_at: string };

type AdminDashboardProps = {
  userEmail: string;
  initialServices: Row[];
  initialGallery: Row[];
  initialProducts: Row[];
  barbers: Row[];
  cashiers: Row[];
  pendingCashiers: Row[];
  initialSettings: Record<string, unknown> | null;
  isSuperadmin: boolean;
  adminUsers: AdminUser[];
  hasBarber: boolean;
  initialAppointments: Row[];
  clients: Row[];
  analyticsData: AnalyticsData | null;
  program: {settings:Row|null;rewards:Row[];promotions:Row[];expenses:Row[];payouts:Row[]};
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
  cashiers,
  pendingCashiers,
  initialSettings,
  isSuperadmin,
  adminUsers,
  hasBarber,
  initialAppointments,
  clients,
  analyticsData,
  program,
}: AdminDashboardProps) {
  const router = useRouter();
  const [section, setSection] = useState(isSuperadmin ? "administradores" : "agenda");
  const [toast, setToast] = useState<DashboardToastData | null>(null);
  const [busy, setBusy] = useState(false);
  const [navCollapsed,setNavCollapsed]=useState(false);
  const toastIdRef = useRef(0);

  function showToast(type: "success" | "error", text: string) {
    toastIdRef.current += 1;
    setToast({ id: toastIdRef.current, type, message: text });
  }

  function startAction() {
    setBusy(true);
    setToast(null);
  }

  function finishAction(text: string) {
    setBusy(false);
    showToast("success", text);
    dispatchDashboardSuccess();
    router.refresh();
  }

  function failAction(reason: unknown, form?: HTMLFormElement, preferredField?: string) {
    setBusy(false);
    showToast("error", reportFormError(form, reason, preferredField));
  }

  const closeToast = useCallback(() => setToast(null), []);

  async function saveBusiness(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    clearFormErrors(form);
    startAction();
    const data = new FormData(form);
    const supabase = createClient();
    const payload = {
      business_name: String(data.get("business_name") ?? ""),
      description: String(data.get("description") ?? ""),
      slogan: String(data.get("slogan") ?? ""),
      amenities: String(data.get("amenities") ?? "").split(",").map((item) => item.trim()).filter(Boolean),
      address: String(data.get("address") ?? ""),
      phone: String(data.get("phone") ?? ""),
      whatsapp: String(data.get("whatsapp") ?? ""),
      hours_text: String(data.get("hours_text") ?? ""),
      map_url: String(data.get("map_url") ?? ""),
      instagram_url: String(data.get("instagram_url") ?? ""),
      facebook_url: String(data.get("facebook_url") ?? ""),
      business_status: String(data.get("business_status") ?? "open"),
      status_message: String(data.get("status_message") ?? ""),
    };
    const { error: updateError } = await supabase.from("business_settings").update(payload).eq("id", true);
    if (updateError) return failAction(updateError, form);
    finishAction("Información del negocio actualizada.");
  }

  async function addService(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    clearFormErrors(form);
    startAction();
    const data = new FormData(form);
    const name = String(data.get("name") ?? "").trim();
    const slug = String(data.get("slug") ?? "").trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-");
    const supabase = createClient();
    const { data: insertedService, error: insertError } = await supabase
      .from("services")
      .insert({
        name,
        slug,
        description: String(data.get("description") ?? ""),
        category: String(data.get("category") ?? "Servicio"),
        price: Number(data.get("price")),
        duration_minutes: Number(data.get("duration_minutes")),
        grace_minutes: Number(data.get("grace_minutes") ?? 10),
        status: "active",
      })
      .select("id")
      .single();
    if (insertError) return failAction(insertError, form);
    const activeBarbers = barbers.filter((barber) => barber.active);
    if (activeBarbers.length && insertedService) {
      const { error: assignmentError } = await supabase.from("barber_services").insert(
        activeBarbers.map((barber) => ({ barber_id: barber.id, service_id: insertedService.id })),
      );
      if (assignmentError) return failAction(assignmentError, form);
    }
    finishAction("Servicio publicado.");
  }

  async function addGalleryPost(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    clearFormErrors(form);
    startAction();
    try {
      const data = new FormData(form);
      const file = data.get("image");
      if (!(file instanceof File) || !file.size) throw new Error("Selecciona una imagen.");
      if (data.get("client_consent") !== "on") throw new Error("Debes confirmar la autorización de publicación.");
      const imagePath = await uploadImage(file, "gallery");
      const supabase = createClient();
      const { error: insertError } = await supabase.from("gallery_posts").insert({
        title: String(data.get("title") ?? "Trabajo destacado"),
        description: String(data.get("description") ?? ""),
        image_path: imagePath,
        status: "published",
        client_consent: true,
        consent_date: new Date().toISOString(),
        featured: data.get("featured") === "on",
        source_type: "own_work",
      });
      if (insertError) throw insertError;
      finishAction("Imagen optimizada y publicada.");
    } catch (uploadError) {
      failAction(uploadError, form, uploadError instanceof Error && uploadError.message.includes("autorización") ? "client_consent" : "image");
    }
  }

  async function updateService(event:FormEvent<HTMLFormElement>,item:Row){event.preventDefault();const form=event.currentTarget;clearFormErrors(form);startAction();const data=new FormData(form);const{error:updateError}=await createClient().from("services").update({name:String(data.get("name")??""),description:String(data.get("description")??""),category:String(data.get("category")??"Servicio"),price:Number(data.get("price")),duration_minutes:Number(data.get("duration_minutes")),grace_minutes:Number(data.get("grace_minutes")??10)}).eq("id",item.id);if(updateError)return failAction(updateError,form);finishAction("Servicio actualizado.");}

  async function updateGalleryPost(event:FormEvent<HTMLFormElement>,item:Row){event.preventDefault();const form=event.currentTarget;clearFormErrors(form);startAction();try{const data=new FormData(form);const file=data.get("image");const imagePath=file instanceof File&&file.size?await uploadImage(file,"gallery"):String(item.image_path??"");const{error:updateError}=await createClient().from("gallery_posts").update({title:String(data.get("title")??""),description:String(data.get("description")??""),featured:data.get("featured")==="on",image_path:imagePath}).eq("id",item.id);if(updateError)throw updateError;finishAction("Publicación actualizada.");}catch(reason){failAction(reason,form,reason instanceof Error && reason.message.includes("imagen") ? "image" : undefined);}}

  async function addProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    clearFormErrors(form);
    startAction();
    try {
      const data = new FormData(form);
      const file = data.get("image");
      const imagePath = file instanceof File && file.size ? await uploadImage(file, "products") : null;
      const name = String(data.get("name") ?? "").trim();
      const slug = String(data.get("slug") || name).trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-");
      const supabase = createClient();
      const { error: insertError } = await supabase.from("products").insert({
        name,
        slug,
        description: String(data.get("description") ?? ""),
        category: String(data.get("category") ?? "Cuidado"),
        price: Number(data.get("price")),
        stock: Number(data.get("stock")),
        image_path: imagePath,
        status: "active",
      });
      if (insertError) throw insertError;
      finishAction("Producto publicado.");
    } catch (productError) {
      failAction(productError, form);
    }
  }

  async function toggleStatus(table: "services" | "gallery_posts" | "products", id: string, nextStatus: string) {
    startAction();
    const supabase = createClient();
    const { error: updateError } = await supabase.from(table).update({ status: nextStatus }).eq("id", id);
    if (updateError) return failAction(updateError);
    finishAction("Estado actualizado.");
  }

  async function deleteGalleryPost(item: Row) {
    if (!window.confirm(`¿Eliminar definitivamente "${String(item.title)}" de la galería?`)) return;
    startAction();
    const supabase = createClient();
    const { error: deleteError } = await supabase.from("gallery_posts").delete().eq("id", item.id);
    if (deleteError) return failAction(deleteError);
    const imagePath = String(item.image_path ?? "");
    if (imagePath && !/^https?:\/\//i.test(imagePath)) await supabase.storage.from("public-media").remove([imagePath]);
    finishAction("La publicación se eliminó de la galería.");
  }

  async function manageAdmin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    clearFormErrors(form);
    startAction();
    const data = new FormData(form);
    const email = String(data.get("email") ?? "").trim().toLowerCase();
    const supabase = createClient();
    const { error: roleUpdateError } = await supabase.rpc("set_admin_role", {
      target_email: email,
      enabled: true,
    });
    if (roleUpdateError) return failAction(roleUpdateError, form, "email");
    finishAction(`Acceso administrativo habilitado o invitación registrada para ${email}.`);
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
    event.preventDefault(); const form=event.currentTarget; clearFormErrors(form); startAction();
    const data = new FormData(form);
    const { error: registerError } = await createClient().rpc("pre_register_barber", {
      target_email: String(data.get("email") ?? "").trim(),
      public_name: String(data.get("public_name") ?? "").trim(),
      specialties: String(data.get("specialties") ?? "").split(",").map((item) => item.trim()).filter(Boolean),
      biography: String(data.get("biography") ?? "").trim() || null,
    });
    if (registerError) return failAction(registerError, form);
    finishAction("Peluquero agregado correctamente. Su ficha ya aparece en Equipo y el acceso se activará con Google.");
  }

  async function toggleBarber(id: string, enabled: boolean) {
    startAction();
    const { error: barberError } = await createClient().rpc("set_barber_active", { target_barber_id: id, enabled });
    if (barberError) return failAction(barberError);
    finishAction(enabled ? "Peluquero activado." : "Peluquero desactivado; sus citas futuras requieren reprogramación.");
  }

  async function updateBarber(event: FormEvent<HTMLFormElement>, id: string) {
    event.preventDefault(); const form=event.currentTarget; clearFormErrors(form); startAction(); const data=new FormData(form);
    const { error: updateError }=await createClient().rpc("admin_update_barber",{target_barber_id:id,public_name:String(data.get("display_name")??""),biography:String(data.get("bio")??""),barber_specialties:String(data.get("specialties")??"").split(",").map(x=>x.trim()).filter(Boolean)});
    if(updateError)return failAction(updateError,form); finishAction("Información del peluquero actualizada.");
  }

  async function linkBarber(event: FormEvent<HTMLFormElement>, id: string) {
    event.preventDefault(); const form=event.currentTarget; clearFormErrors(form); startAction(); const data=new FormData(form); const email=String(data.get("account_email")??"").trim();
    const { error: linkError }=await createClient().rpc("link_barber_account",{target_barber_id:id,target_email:email});
    if(linkError)return failAction(linkError,form,"account_email"); finishAction(`Cuenta ${email} vinculada o pendiente de su primer ingreso con Google.`);
  }

  async function addCashier(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    clearFormErrors(form);
    startAction();
    const data = new FormData(form);
    const email = String(data.get("email") ?? "").trim().toLowerCase();
    const { error: cashierError } = await createClient().rpc("set_cashier_role", {
      target_email: email,
      enabled: true,
    });
    if (cashierError) return failAction(cashierError, form, "email");
    finishAction(`Cajero ${email} agregado correctamente. Si todavía no ingresó con Google, su acceso quedó pendiente.`);
  }

  async function toggleCashier(email: string, enabled: boolean) {
    startAction();
    const { error: cashierError } = await createClient().rpc("set_cashier_role", {
      target_email: email,
      enabled,
    });
    if (cashierError) return failAction(cashierError);
    finishAction(enabled ? "Acceso de caja reactivado." : "Cajero movido a personal inactivo.");
  }

  async function updateProduct(event: FormEvent<HTMLFormElement>, item: Row) {
    event.preventDefault(); const form=event.currentTarget; clearFormErrors(form); startAction();
    try { const data=new FormData(form); const file=data.get("image"); const imagePath=file instanceof File&&file.size?await uploadImage(file,"products"):String(item.image_path??"")||null;
      const { error: updateError }=await createClient().rpc("admin_update_product",{target_product_id:item.id,product_name:String(data.get("name")??""),product_description:String(data.get("description")??""),product_category:String(data.get("category")??""),product_price:Number(data.get("price")),product_stock:Number(data.get("stock")),product_image_path:imagePath});
      if(updateError)throw updateError; finishAction("Producto actualizado y publicado.");
    } catch(reason){failAction(reason,form);}
  }

  async function logout() {
    await createClient().auth.signOut();
    router.push("/");
    router.refresh();
  }

  const settings = initialSettings ?? {};
  const activeBarbers = barbers.filter((item) => Boolean(item.active));
  const inactiveBarbers = barbers.filter((item) => !item.active);
  const activeCashiers = cashiers.filter((item) => Boolean(item.active));
  const inactiveCashiers = cashiers.filter((item) => !item.active);
  const inactiveTeamCount = inactiveBarbers.length + inactiveCashiers.length;
  const navigation:Array<[string,string,LucideIcon]>=[
    ["agenda","Agenda",CalendarClock],
    ["programa","Caja y fidelización",CircleDollarSign],
    ["clientes","Clientes",Users],
    ["equipo","Equipo",UserPlus],
    ["servicios","Servicios",Scissors],
    ["productos","Productos",PackagePlus],
    ["galeria","Galería",ImagePlus],
    ["negocio","Negocio",Store],
    ["estadisticas","Estadísticas",BarChart3],
    ...(isSuperadmin?[["administradores","Administradores",ShieldCheck] as [string,string,LucideIcon]]:[]),
  ];

  return (
    <main className="admin-shell admin-control-shell">
      <DashboardToast toast={toast} onClose={closeToast}/>
      <header className="admin-header dash-header">
        <PanelMobileMenuButton/>
        <div className="dash-brand"><Brand linked={false} /><span className="dash-live"><i/> SISTEMA EN LÍNEA</span></div>
        <ModeSwitcher current="admin" isAdmin hasBarber={hasBarber} isCashier={!isSuperadmin} showClient={false} />
        <div className="dash-user"><span className="dash-avatar">{userEmail.slice(0,2).toUpperCase()}</span><span>{userEmail}<small>Administrador</small></span><button className="desktop-logout" onClick={logout}><LogOut size={16} /> Salir</button></div>
      </header>
      <div className={`admin-layout ${navCollapsed?"nav-collapsed":""}`}>
        <aside className="admin-nav dash-sidebar">
          <div className="dash-sidebar-head"><p>CONTROL CENTRAL</p><button className="dash-collapse" type="button" onClick={()=>setNavCollapsed(value=>!value)} aria-label={navCollapsed?"Abrir menú lateral":"Cerrar menú lateral"} aria-expanded={!navCollapsed} title={navCollapsed?"Abrir menú":"Cerrar menú"}>{navCollapsed?<Menu/>:<X/>}</button><PanelMobileSidebarClose/></div>
          <nav>{navigation.map(([id,label,Icon])=><button title={label} className={`${section===id?"active":""} ${id==="negocio"?"nav-secondary-start":""}`} key={id} onClick={()=>setSection(id)}><Icon/><span>{label}</span>{section===id&&<i/>}</button>)}</nav>
          <div className="dash-sidebar-foot"><PanelThemeSelector/><Link href="/"><Sparkles/><span>Ver sitio público</span></Link><PanelMobileLogout/></div>
        </aside>
        <PanelMobileScrim/>
        <section className="admin-content">
          {section === "agenda" && <div className="admin-panel"><div className="admin-title"><CalendarClock /><div><p>OPERACIÓN</p><h1>Reservas y agenda</h1></div></div><div className="admin-metrics"><div><strong>{initialAppointments.filter((item)=>["requested","confirmed","pending_client_confirmation"].includes(String(item.status))).length}</strong><span>Próximas o pendientes</span></div><div><strong>{initialAppointments.filter((item)=>item.status==="needs_reschedule").length}</strong><span>Por reprogramar</span></div><div><strong>{initialAppointments.length}</strong><span>Últimas reservas</span></div></div><div className="admin-list appointment-admin-list">{initialAppointments.length?initialAppointments.map((item)=>{const client=item.profiles as {full_name?:string;phone?:string;email?:string;is_blacklisted?:boolean}|null;const barber=item.barber_profiles as {display_name?:string}|null;return <article key={item.id}><div><strong>{String(item.service_name_snapshot)} · {new Intl.DateTimeFormat("es-BO",{dateStyle:"medium",timeStyle:"short",timeZone:"America/La_Paz"}).format(new Date(String(item.starts_at)))}</strong><span>{client?.full_name??client?.email??"Cliente"} · {client?.phone??"Sin teléfono"} · {barber?.display_name??"Sin asignar"} · {String(item.status)}</span>{client?.is_blacklisted&&<small className="admin-alert">Alerta por inasistencias</small>}</div><AppointmentAdminActions id={item.id} barbers={barbers as Array<{id:string;display_name:string;active?:boolean}>}/></article>}):<p className="admin-help">Todavía no existen reservas.</p>}</div></div>}

          {section === "estadisticas" && <AdminAnalytics data={analyticsData} />}

          {section === "programa" && <AdminProgram settings={program.settings} rewards={program.rewards} promotions={program.promotions} expenses={program.expenses} payouts={program.payouts} barbers={barbers} products={initialProducts} />}

          {section === "clientes" && <div className="admin-panel"><div className="admin-title"><Users /><div><p>USUARIOS</p><h1>Clientes</h1></div></div><p className="admin-help">Puedes dar de baja cuentas antiguas o bloquear manualmente a clientes reincidentes. Ninguna cuenta se elimina físicamente.</p><div className="admin-list client-admin-list">{clients.length?clients.map((item)=><article key={item.id}><div><strong>{String(item.full_name??item.email)}</strong><span>{String(item.email)} · {String(item.phone??"Sin teléfono")} · {String(item.status)} · {String(item.no_show_count)} inasistencia(s)</span>{Boolean(item.is_blacklisted)&&<small className="admin-alert">Lista negra informativa</small>}</div><ClientAdminActions id={item.id} status={String(item.status)} blocked={Boolean(item.is_blocked)}/></article>):<p className="admin-help">Todavía no existen clientes registrados.</p>}</div></div>}

          {section === "negocio" && <div className="admin-panel">
            <div className="admin-title"><Store /><div><p>CONFIGURACIÓN PÚBLICA</p><h1>Información del negocio</h1></div></div>
            <div className="dash-section-intro"><p>Edita la identidad, ubicación, horarios y estado público desde una ventana dedicada.</p><DashboardModal title="Editar información del negocio" description="Los cambios se reflejarán en la página pública." triggerLabel="Editar negocio" triggerIcon={<Store/>} size="large">
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
            </DashboardModal></div>
          </div>}

          {section === "servicios" && <div className="admin-panel">
            <div className="admin-title"><Scissors /><div><p>CATÁLOGO</p><h1>Servicios</h1></div></div>
            <div className="dash-section-intro"><p>Administra el catálogo sin saturar la vista principal.</p><DashboardModal title="Crear servicio" description="Define precio, duración y tiempo de gracia." triggerLabel="Nuevo servicio" triggerIcon={<Scissors/>}>
            <form className="admin-form compact-form" onSubmit={addService} acceptCharset="UTF-8">
              <label>Nombre<input name="name" required /></label><label>Identificador<input name="slug" required placeholder="corte-clasico" /></label>
              <label className="wide">Descripción<input name="description" /></label><label>Categoría<input name="category" /></label>
              <label>Precio Bs<input name="price" type="number" min="0" step="0.5" required /></label><label>Duración (min)<input name="duration_minutes" type="number" min="5" required /></label><label>Gracia (min)<input name="grace_minutes" type="number" min="0" defaultValue="10" /></label>
              <button className="button button-dark wide" disabled={busy}>Agregar servicio</button>
            </form>
            </DashboardModal></div>
            <div className="admin-list">{initialServices.map((item)=><article key={item.id}><div><strong>{String(item.name)}</strong><span>Bs {String(item.price)} · {String(item.duration_minutes)} min · {String(item.status)}</span></div><div className="dash-row-actions"><button onClick={()=>toggleStatus("services",item.id,item.status==="active"?"inactive":"active")}>{item.status==="active"?"Desactivar":"Activar"}</button><DashboardModal title={`Editar ${String(item.name)}`} triggerLabel="Editar" variant="ghost"><form className="admin-form" onSubmit={(event)=>updateService(event,item)}><label>Nombre<input name="name" defaultValue={String(item.name)} required/></label><label>Categoría<input name="category" defaultValue={String(item.category??"")}/></label><label className="wide">Descripción<input name="description" defaultValue={String(item.description??"")}/></label><label>Precio Bs<input name="price" type="number" min="0" step="0.5" defaultValue={Number(item.price)} required/></label><label>Duración<input name="duration_minutes" type="number" min="5" defaultValue={Number(item.duration_minutes)} required/></label><label>Gracia<input name="grace_minutes" type="number" min="0" defaultValue={Number(item.grace_minutes??10)}/></label><button className="button button-dark wide" disabled={busy}>Guardar servicio</button></form></DashboardModal></div></article>)}</div>
          </div>}

          {section === "galeria" && <div className="admin-panel">
            <div className="admin-title"><ImagePlus /><div><p>CONTENIDO</p><h1>Galería de trabajos</h1></div></div>
            <div className="dash-section-intro"><p>Publica imágenes optimizadas únicamente con autorización del cliente.</p><DashboardModal title="Publicar trabajo" description="La imagen será optimizada automáticamente." triggerLabel="Nueva publicación" triggerIcon={<ImagePlus/>}>
            <form className="admin-form" onSubmit={addGalleryPost} acceptCharset="UTF-8"><label>Título<input name="title" required /></label><label>Imagen<input name="image" type="file" accept="image/jpeg,image/png,image/webp" required /></label><label className="wide">Descripción<input name="description" /></label><label className="check-label wide"><input type="checkbox" name="client_consent" /> Confirmo que existe autorización del cliente.</label><label className="check-label wide"><input type="checkbox" name="featured" /> Marcar como destacada.</label><button className="button button-dark wide" disabled={busy}>Optimizar y publicar</button></form>
            </DashboardModal></div>
            <div className="admin-list">{initialGallery.map((item)=><article key={item.id}><div><strong>{String(item.title)}</strong><span>{String(item.status)} · consentimiento: {item.client_consent?"sí":"no"}</span></div><div className="dash-row-actions"><button onClick={()=>toggleStatus("gallery_posts",item.id,item.status==="published"?"hidden":"published")}>{item.status==="published"?"Ocultar":"Publicar"}</button><DashboardModal title={`Editar ${String(item.title)}`} triggerLabel="Editar" variant="ghost"><form className="admin-form" onSubmit={(event)=>updateGalleryPost(event,item)}><label>Título<input name="title" defaultValue={String(item.title)} required/></label><label>Nueva imagen opcional<input name="image" type="file" accept="image/jpeg,image/png,image/webp"/></label><label className="wide">Descripción<input name="description" defaultValue={String(item.description??"")}/></label><label className="check-label wide"><input type="checkbox" name="featured" defaultChecked={Boolean(item.featured)}/> Destacada</label><button className="button button-dark wide" disabled={busy}>Guardar publicación</button></form></DashboardModal><button type="button" className="dash-danger-action" onClick={()=>deleteGalleryPost(item)} disabled={busy}><Trash2/> Eliminar</button></div></article>)}</div>
          </div>}

          {section === "productos" && <div className="admin-panel">
            <div className="admin-title"><PackagePlus /><div><p>CATÁLOGO</p><h1>Productos</h1></div></div>
            <div className="dash-section-intro"><p>Publica inventario nuevo o abre una ficha existente para editarla.</p><DashboardModal title="Crear producto" description="Configura inventario, precio e imagen comercial." triggerLabel="Nuevo producto" triggerIcon={<PackagePlus/>}>
            <form className="admin-form" onSubmit={addProduct} acceptCharset="UTF-8"><label>Nombre<input name="name" required /></label><label>Identificador<input name="slug" placeholder="se genera del nombre" /></label><label className="wide">Descripción<input name="description" /></label><label>Categoría<input name="category" /></label><label>Precio Bs<input name="price" type="number" min="0" step="0.5" required /></label><label>Stock<input name="stock" type="number" min="0" required /></label><label className="wide">Imagen<input name="image" type="file" accept="image/jpeg,image/png,image/webp" /></label><button className="button button-dark wide" disabled={busy}>Publicar producto</button></form>
            </DashboardModal></div>
            <div className="admin-list editable-list">{initialProducts.map((item)=><article key={item.id}><div><strong>{String(item.name)}</strong><span>Bs {String(item.price)} · stock {String(item.stock)} · {String(item.status)}</span></div><div className="dash-row-actions"><button onClick={()=>toggleStatus("products",item.id,item.status==="active"?"inactive":"active")}>{item.status==="active"?"Desactivar":"Activar"}</button><DashboardModal title={`Editar ${String(item.name)}`} description="Actualiza la ficha comercial y el inventario." triggerLabel="Editar" variant="ghost"><form className="admin-form" onSubmit={(event)=>updateProduct(event,item)} acceptCharset="UTF-8"><label>Nombre<input name="name" defaultValue={String(item.name)} required/></label><label>Categoría<input name="category" defaultValue={String(item.category??"")}/></label><label className="wide">Descripción<input name="description" defaultValue={String(item.description??"")}/></label><label>Precio Bs<input name="price" type="number" min="0" step="0.5" defaultValue={Number(item.price)} required/></label><label>Stock<input name="stock" type="number" min="0" defaultValue={Number(item.stock)} required/></label><label className="wide">Nueva imagen opcional<input name="image" type="file" accept="image/jpeg,image/png,image/webp"/></label><button className="button button-dark wide" disabled={busy}>Guardar producto</button></form></DashboardModal></div></article>)}</div>
          </div>}

          {section === "equipo" && <div className="admin-panel team-panel">
            <div className="admin-title"><Users/><div><p>PERSONAL</p><h1>Equipo</h1></div></div>
            <div className="dash-section-intro team-intro">
              <p>Gestiona al personal que trabaja en el negocio, organizado por rol y estado operativo.</p>
              <div className="team-create-actions">
                <DashboardModal title="Crear peluquero" description="Podrás vincular su cuenta incluso después de crear el perfil." triggerLabel="Nuevo peluquero" triggerIcon={<UserPlus/>}>
                  <form className="admin-form" onSubmit={registerBarber} acceptCharset="UTF-8"><label>Correo Google<input name="email" type="email" required/></label><label>Nombre público<input name="public_name" required/></label><label className="wide">Especialidades separadas por comas<input name="specialties" placeholder="Fades, Barba, Cortes clásicos"/></label><label className="wide">Biografía<textarea name="biography"/></label><button className="button button-dark wide" disabled={busy}>Crear nuevo peluquero</button></form>
                </DashboardModal>
                <DashboardModal title="Integrar nuevo cajero" description="La persona debe iniciar sesión con Google una vez antes de recibir acceso de caja." triggerLabel="Nuevo cajero" triggerIcon={<UserRoundCog/>}>
                  <form className="admin-form" onSubmit={addCashier} acceptCharset="UTF-8"><label className="wide">Correo de la cuenta Google<input name="email" type="email" inputMode="email" autoComplete="email" required/></label><button className="button button-dark wide" disabled={busy}>Habilitar acceso de caja</button></form>
                </DashboardModal>
              </div>
            </div>

            <section className="team-role-section">
              <header><div><Scissors/><span><small>ROL OPERATIVO</small><h2>Peluqueros</h2></span></div><b>{activeBarbers.length} activos</b></header>
              <div className="admin-list editable-list team-list">{activeBarbers.length ? activeBarbers.map((item)=><article key={item.id}><div><strong>{String(item.display_name)}</strong><span><i className="team-status-dot"/> Activo · {Array.isArray(item.specialties)?item.specialties.join(", "):"Sin especialidades"} · {item.user_id?"Cuenta vinculada":"Sin cuenta Google"}</span></div><div className="dash-row-actions"><button disabled={busy} onClick={()=>toggleBarber(item.id,false)}>Desactivar</button><DashboardModal title={`Editar ${String(item.display_name)}`} description="Actualiza su perfil público o vincula el acceso Google." triggerLabel="Editar" variant="ghost"><form className="admin-form" onSubmit={(event)=>updateBarber(event,item.id)} acceptCharset="UTF-8"><label>Nombre público<input name="display_name" defaultValue={String(item.display_name)} required/></label><label>Especialidades<input name="specialties" defaultValue={Array.isArray(item.specialties)?item.specialties.join(", "):""}/></label><label className="wide">Biografía<textarea name="bio" defaultValue={String(item.bio??"")}/></label><button className="button button-dark wide" disabled={busy}>Guardar información</button></form>{!item.user_id&&<form className="link-account-form" onSubmit={(event)=>linkBarber(event,item.id)}><input name="account_email" type="email" placeholder="correo Google del peluquero" required/><button disabled={busy}>Vincular cuenta Google</button></form>}</DashboardModal></div></article>) : <p className="admin-help">No hay peluqueros activos.</p>}</div>
            </section>

            <section className="team-role-section">
              <header><div><UserRoundCog/><span><small>ROL OPERATIVO</small><h2>Cajeros</h2></span></div><b>{activeCashiers.length} activos</b></header>
              <div className="admin-list team-list">{activeCashiers.length ? activeCashiers.map((item)=>{const profile=item.profiles as Row|null;const email=String(profile?.email??"");return <article key={item.id}><div><strong>{String(profile?.full_name??profile?.email??"Cajero")}</strong><span><i className="team-status-dot"/> Activo · {email} · Acceso a terminal de caja</span></div><button disabled={busy||!email} onClick={()=>toggleCashier(email,false)}>Desactivar</button></article>}) : <p className="admin-help">No hay cajeros activos.</p>}</div>
              {pendingCashiers.length>0&&<div className="team-pending"><h3>Accesos pendientes de Google</h3><div className="admin-list team-list">{pendingCashiers.map((item)=><article key={item.id}><div><strong>{String(item.email)}</strong><span>Invitación guardada · se activará automáticamente en su primer ingreso</span></div><b>Pendiente</b></article>)}</div></div>}
            </section>

            <details className="inactive-team">
              <summary><span>Ver personal inactivo</span><b>{inactiveTeamCount}</b></summary>
              <div className="inactive-team-content">
                <section><h3>Peluqueros inactivos</h3><div className="admin-list team-list">{inactiveBarbers.length ? inactiveBarbers.map((item)=><article key={item.id}><div><strong>{String(item.display_name)}</strong><span>Inactivo · {Array.isArray(item.specialties)?item.specialties.join(", "):"Sin especialidades"}</span></div><button disabled={busy} onClick={()=>toggleBarber(item.id,true)}>Reactivar</button></article>) : <p className="admin-help">No hay peluqueros inactivos.</p>}</div></section>
                <section><h3>Cajeros inactivos</h3><div className="admin-list team-list">{inactiveCashiers.length ? inactiveCashiers.map((item)=>{const profile=item.profiles as Row|null;const email=String(profile?.email??"");return <article key={item.id}><div><strong>{String(profile?.full_name??profile?.email??"Cajero")}</strong><span>Inactivo · {email}</span></div><button disabled={busy||!email} onClick={()=>toggleCashier(email,true)}>Reactivar</button></article>}) : <p className="admin-help">No hay cajeros inactivos.</p>}</div></section>
              </div>
            </details>
          </div>}

          {section === "administradores" && isSuperadmin && <div className="admin-panel">
            <div className="admin-title"><ShieldCheck /><div><p>SEGURIDAD</p><h1>Administradores</h1></div></div>
            <div className="dash-section-intro"><p>Puedes registrar el correo antes de su primer ingreso. La invitación se activará automáticamente con Google.</p><DashboardModal title="Habilitar administrador" description="Solo el superadministrador puede conceder este permiso." triggerLabel="Nuevo administrador" triggerIcon={<UserPlus/>}>
            <form className="admin-form admin-role-form" onSubmit={manageAdmin} acceptCharset="UTF-8">
              <label className="wide">Correo de la cuenta Google<input name="email" type="email" inputMode="email" autoComplete="email" placeholder="administrador@correo.com" required /></label>
              <button className="button button-dark wide" disabled={busy}><UserPlus size={17} /> Habilitar administrador</button>
            </form>
            </DashboardModal></div>
            <div className="admin-list">{adminUsers.map((item) => <article key={`${String(item.user_id ?? item.email)}-${String(item.role)}`}><div><strong>{String(item.email)}</strong><span>{item.role === "superadmin" ? "Superadministrador · desarrollador" : item.role === "pending" ? "Invitación pendiente de ingreso con Google" : "Administrador"}</span></div>{item.role !== "superadmin" && <button disabled={busy} onClick={() => removeAdmin(String(item.email))}>{item.role === "pending" ? "Cancelar invitación" : "Retirar acceso"}</button>}</article>)}</div>
          </div>}
        </section>
      </div>
    </main>
  );
}
