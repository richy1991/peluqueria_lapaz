"use client";

import { FormEvent, useMemo, useState } from "react";
import Image from "next/image";
import { Camera, ImagePlus, Link2, UserRoundPen } from "lucide-react";
import { DashboardModal } from "@/components/dashboard-modal";
import { clearFormErrors, reportFormError } from "@/lib/form-feedback";
import { dispatchDashboardError, dispatchDashboardSuccess } from "@/lib/form-feedback";
import { uploadOptimizedImage } from "@/lib/image-upload";
import { publicMediaUrl } from "@/lib/public-media";
import { createClient } from "@/lib/supabase/client";

type BarberProfile = {
  id: string;
  display_name: string;
  bio: string | null;
  specialties: string[] | null;
  photo_path: string | null;
};

type GalleryItem = {
  id: string;
  title: string;
  status: string;
  source_type?: string | null;
  created_at: string;
};

async function uploadBarberImage(file: File, userId: string, folder: "profile" | "gallery") {
  const path = `barbers/${userId}/${folder}/${crypto.randomUUID()}.webp`;
  return uploadOptimizedImage(file, path);
}

export function PublicProfileManager({ userId, profile, gallery, view, timezone }: { userId: string; profile: BarberProfile; gallery: GalleryItem[]; view: "profile" | "gallery"; timezone: string }) {
  const [busy, setBusy] = useState(false);
  const photoUrl = useMemo(() => publicMediaUrl(profile.photo_path), [profile.photo_path]);

  function fail(form: HTMLFormElement, reason: unknown, field?: string) {
    const message = reportFormError(form, reason, field);
    dispatchDashboardError(message);
    setBusy(false);
  }

  async function updateProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    clearFormErrors(form);
    setBusy(true);
    let uploadedPath: string | null = null;
    try {
      const data = new FormData(form);
      const image = data.get("image");
      if (image instanceof File && image.size) uploadedPath = await uploadBarberImage(image, userId, "profile");
      const specialties = String(data.get("specialties") ?? "").split(",").map((item) => item.trim()).filter(Boolean);
      const supabase = createClient();
      const { error } = await supabase.rpc("update_my_barber_profile", {
        public_name: String(data.get("public_name") ?? ""),
        biography: String(data.get("biography") ?? ""),
        barber_specialties: specialties,
        profile_photo_path: uploadedPath,
      });
      if (error) throw error;
      setBusy(false);
      dispatchDashboardSuccess("Tu perfil público se actualizó correctamente.");
    } catch (reason) {
      if (uploadedPath) await createClient().storage.from("public-media").remove([uploadedPath]);
      fail(form, reason);
    }
  }

  async function publishGallery(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    clearFormErrors(form);
    setBusy(true);
    let uploadedPaths: string[] = [];
    try {
      const data = new FormData(form);
      const images = data.getAll("images").filter((image): image is File => image instanceof File && image.size > 0);
      if (!images.length) throw new Error("Selecciona al menos una imagen para publicar.");
      if (images.length > 3) throw new Error("Puedes publicar un máximo de 3 imágenes por modelo.");
      uploadedPaths = await Promise.all(images.map((image) => uploadBarberImage(image, userId, "gallery")));
      const { error } = await createClient().rpc("barber_publish_gallery_v2", {
        post_title: String(data.get("title") ?? ""),
        post_description: String(data.get("description") ?? ""),
        post_image_paths: uploadedPaths,
        post_source_type: String(data.get("source_type") ?? "own_work"),
        post_source_url: String(data.get("source_url") ?? ""),
        has_client_consent: data.get("client_consent") === "on",
      });
      if (error) throw error;
      form.reset();
      setBusy(false);
      dispatchDashboardSuccess("La imagen se publicó en la galería.");
    } catch (reason) {
      if (uploadedPaths.length) await createClient().storage.from("public-media").remove(uploadedPaths);
      fail(form, reason, reason instanceof Error && reason.message.includes("imagen") ? "images" : undefined);
    }
  }

  return <section className="barber-public-manager">
    {view === "profile" && <div className="barber-profile-summary">
      <div className="barber-profile-photo">{photoUrl ? <Image src={photoUrl} alt={`Perfil de ${profile.display_name}`} width={82} height={82} unoptimized /> : <Camera />}</div>
      <div><small>PERFIL PÚBLICO</small><h3>{profile.display_name}</h3><p>{profile.bio || "Agrega una presentación para que los clientes te conozcan."}</p><span>{profile.specialties?.join(" · ") || "Especialidades por definir"}</span></div>
      <DashboardModal title="Editar mi perfil público" description="Estos datos se mostrarán en la sección Equipo del sitio." triggerLabel="Editar perfil" triggerIcon={<UserRoundPen />}>
        <form className="admin-form" onSubmit={updateProfile} acceptCharset="UTF-8">
          <label>Nombre público<input name="public_name" defaultValue={profile.display_name} minLength={2} maxLength={80} required /></label>
          <label>Fotografía<input name="image" type="file" accept="image/jpeg,image/png,image/webp" /></label>
          <label className="wide">Especialidades separadas por coma<input name="specialties" defaultValue={profile.specialties?.join(", ") ?? ""} /></label>
          <label className="wide">Presentación<textarea name="biography" defaultValue={profile.bio ?? ""} maxLength={500} /></label>
          <button className="button button-dark wide" disabled={busy}>{busy ? "Guardando…" : "Guardar perfil"}</button>
        </form>
      </DashboardModal>
    </div>}

    {view === "gallery" && <div className="barber-gallery-management">
      <div><small>MI PORTAFOLIO</small><h3>Publicaciones recientes</h3><p>Publica trabajos propios autorizados o referencias indicando su fuente.</p></div>
      <DashboardModal title="Publicar en la galería" description="La imagen quedará visible en el sitio público." triggerLabel="Nueva publicación" triggerIcon={<ImagePlus />}>
        <form className="admin-form" onSubmit={publishGallery} acceptCharset="UTF-8">
          <label>Título<input name="title" minLength={2} maxLength={120} required /></label>
          <label>Imágenes (máximo 3)<input name="images" type="file" accept="image/jpeg,image/png,image/webp" multiple required /></label>
          <label>Tipo<select name="source_type" defaultValue="own_work"><option value="own_work">Trabajo propio</option><option value="reference">Modelo o referencia</option></select></label>
          <label>Enlace de la fuente <span aria-hidden="true"><Link2 size={12} /></span><input name="source_url" type="url" placeholder="https://…" /></label>
          <label className="wide">Descripción<textarea name="description" maxLength={500} /></label>
          <label className="check-label wide"><input type="checkbox" name="client_consent" /> Tengo autorización del cliente si es un trabajo propio.</label>
          <button className="button button-dark wide" disabled={busy}>{busy ? "Publicando…" : "Publicar imagen"}</button>
        </form>
      </DashboardModal>
      <div className="barber-gallery-list">{gallery.length ? gallery.map((item) => <article key={item.id}><div><strong>{item.title}</strong><span>{item.source_type === "reference" ? "Referencia" : "Trabajo propio"} · {item.status}</span></div><time>{new Intl.DateTimeFormat("es-BO", { dateStyle: "medium", timeZone: timezone }).format(new Date(item.created_at))}</time></article>) : <p>Aún no publicaste imágenes.</p>}</div>
    </div>}
  </section>;
}
