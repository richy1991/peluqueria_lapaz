"use client";

import { createClient } from "@/lib/supabase/client";

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const MAX_IMAGE_EDGE = 1600;
const WEBP_QUALITY = 0.82;
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export async function optimizeImage(file: File) {
  if (!ALLOWED_IMAGE_TYPES.has(file.type)) throw new Error("Selecciona una imagen JPG, PNG o WebP.");
  if (file.size > MAX_IMAGE_BYTES) throw new Error("La imagen no puede superar 8 MB.");

  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_IMAGE_EDGE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const context = canvas.getContext("2d");
  if (!context) {
    bitmap.close();
    throw new Error("El navegador no pudo procesar la imagen.");
  }
  try {
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  } finally {
    bitmap.close();
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
