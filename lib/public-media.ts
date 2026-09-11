import { supabaseUrl } from "@/lib/supabase/config";

export function publicMediaUrl(path: string | null | undefined) {
  const cleanPath = String(path ?? "").trim();
  if (!cleanPath) return null;
  if (/^https?:\/\//i.test(cleanPath)) return cleanPath;
  const encodedPath = cleanPath.split("/").map(encodeURIComponent).join("/");
  return `${supabaseUrl}/storage/v1/object/public/public-media/${encodedPath}`;
}

export function publicMediaUrls(
  paths: string[] | null | undefined,
  fallbackPath?: string | null,
  maximum = 3,
) {
  const source = [...new Set(paths?.length ? paths : fallbackPath ? [fallbackPath] : [])];
  return source.map(publicMediaUrl).filter((path): path is string => Boolean(path)).slice(0, maximum);
}
