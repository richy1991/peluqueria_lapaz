"use client";

import { createClient } from "@/lib/supabase/client";

const MAX_IMAGE_BYTES = 15 * 1024 * 1024;
const MAX_IMAGE_EDGE = 1600;
const WEBP_QUALITY = 0.82;
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif", "image/heic", "image/heif"]);
export const IMAGE_INPUT_ACCEPT = "image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif,.jpg,.jpeg,.png,.webp,.gif,.heic,.heif";

function isSupportedImage(file: File) {
  return ALLOWED_IMAGE_TYPES.has(file.type) || /\.(jpe?g|png|webp|gif|heic|heif)$/i.test(file.name);
}

async function loadImageForCanvas(file: File): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("No se pudo leer la imagen en este dispositivo. Prueba con JPG, PNG o WebP."));
    });
    return image;
  } catch (error) {
    URL.revokeObjectURL(url);
    throw error;
  }
}

export async function optimizeImage(file: File) {
  if (!isSupportedImage(file)) throw new Error("Selecciona una imagen JPG, PNG, WebP, GIF o HEIC.");
  if (file.size > MAX_IMAGE_BYTES) throw new Error("La imagen no puede superar 15 MB.");

  let source: CanvasImageSource;
  let width: number;
  let height: number;
  let dispose: () => void = () => undefined;

  try {
    const bitmap = await createImageBitmap(file);
    source = bitmap;
    width = bitmap.width;
    height = bitmap.height;
    dispose = () => bitmap.close();
  } catch {
    // Algunos navegadores móviles no decodifican todos los JPG mediante
    // createImageBitmap, aunque sí pueden abrirlos con el elemento Image.
    const image = await loadImageForCanvas(file);
    source = image;
    width = image.naturalWidth;
    height = image.naturalHeight;
    dispose = () => URL.revokeObjectURL(image.src);
  }

  if (!width || !height) {
    dispose();
    throw new Error("La imagen no tiene dimensiones válidas.");
  }
  const scale = Math.min(1, MAX_IMAGE_EDGE / Math.max(width, height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  const context = canvas.getContext("2d");
  if (!context) {
    dispose();
    throw new Error("El navegador no pudo procesar la imagen.");
  }
  try {
    context.drawImage(source, 0, 0, canvas.width, canvas.height);
  } finally {
    dispose();
  }

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => blob ? resolve(blob) : reject(new Error("No se pudo optimizar la imagen.")),
      "image/webp",
      WEBP_QUALITY,
    );
  });
}

async function uploadWithClient(file: File, path: string, supabase: ReturnType<typeof createClient>) {
  const blob = await optimizeImage(file);
  const { error } = await supabase.storage.from("public-media").upload(path, blob, {
    contentType: "image/webp",
    cacheControl: "31536000",
    upsert: false,
  });
  if (error) throw error;
  return path;
}

export async function uploadOptimizedImage(file: File, path: string) {
  return uploadWithClient(file, path, createClient());
}

export async function uploadOptimizedImages(
  files: File[],
  pathForFile: (file: File, index: number) => string,
  maximum = 3,
) {
  if (!files.length) return [];
  if (files.length > maximum) throw new Error(`Puedes publicar un máximo de ${maximum} imágenes.`);

  const supabase = createClient();
  const results = await Promise.allSettled(files.map((file, index) => uploadWithClient(file, pathForFile(file, index), supabase)));
  const uploadedPaths = results.flatMap((result) => result.status === "fulfilled" ? [result.value] : []);
  const failed = results.find((result): result is PromiseRejectedResult => result.status === "rejected");
  if (!failed) return uploadedPaths;

  if (uploadedPaths.length) await supabase.storage.from("public-media").remove(uploadedPaths);
  throw failed.reason;
}
