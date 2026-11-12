import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import type { ImagePickerAsset } from 'expo-image-picker';

import { supabase } from '@/lib/supabase';

function fileToken() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export async function uploadBarberImage(asset: ImagePickerAsset, userId: string, folder: 'profile' | 'gallery') {
  const context = ImageManipulator.manipulate(asset.uri, { maxWidth: 1600, maxHeight: 1600 });
  const rendered = await context.renderAsync();
  const image = await rendered.saveAsync({ format: SaveFormat.WEBP, compress: 0.82 });
  const response = await fetch(image.uri);
  if (!response.ok) throw new Error('No se pudo preparar la imagen seleccionada.');
  const bytes = await response.arrayBuffer();
  if (bytes.byteLength > 8 * 1024 * 1024) throw new Error('La imagen optimizada supera el límite permitido.');
  const path = `barbers/${userId}/${folder}/${fileToken()}.webp`;
  const { error } = await supabase.storage.from('public-media').upload(path, bytes, {
    contentType: 'image/webp',
    cacheControl: '31536000',
    upsert: false,
  });
  if (error) throw error;
  return path;
}

export async function uploadBarberGalleryImages(assets: ImagePickerAsset[], userId: string) {
  if (!assets.length) throw new Error('Selecciona al menos una imagen.');
  if (assets.length > 3) throw new Error('Puedes publicar un máximo de 3 imágenes por modelo.');
  const uploaded: string[] = [];
  try {
    for (const asset of assets) uploaded.push(await uploadBarberImage(asset, userId, 'gallery'));
    return uploaded;
  } catch (error) {
    if (uploaded.length) await supabase.storage.from('public-media').remove(uploaded);
    throw error;
  }
}
