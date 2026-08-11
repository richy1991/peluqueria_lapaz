import { createClient } from "@/lib/supabase/server";
import {
  barbers as fallbackBarbers,
  gallery as fallbackGallery,
  services as fallbackServices,
} from "@/lib/demo-data";

export type PublicService = {
  id: string;
  name: string;
  description: string;
  price: number;
  duration: number;
  category: string;
};

export type PublicBarber = {
  id: string;
  name: string;
  role: string;
  specialties: string;
  image: string;
};

export type PublicGalleryItem = {
  id: string;
  title: string;
  image: string;
};

export type PublicProduct = {
  id: string;
  name: string;
  description: string;
  category: string;
  price: number;
  stock: number;
  image: string | null;
};

export type BusinessInfo = {
  name: string;
  description: string;
  slogan: string;
  amenities: string[];
  address: string;
  phone: string;
  whatsapp: string;
  mapUrl: string;
  instagramUrl: string;
  facebookUrl: string;
  status: string;
  statusMessage: string;
  hours: string;
  coverImage: string | null;
};

const fallbackBusiness: BusinessInfo = {
  name: "Barbería LEGEND CLUB",
  description: "Tradición, calle y precisión en cada corte.",
  slogan: "Empezamos como un servicio al cliente y terminamos como amigos.",
  amenities: ["Trato personalizado", "Buen servicio", "Ambiente cómodo", "Mucha higiene", "Wi‑Fi libre"],
  address: "Av. Jaime Freyre, entre Av. Jaime Zudáñez y Caupolicán, casa N.º 2057, al lado de la Iglesia de los Mormones, La Paz",
  phone: "+591 62600874",
  whatsapp: "59162600874",
  mapUrl: "https://maps.app.goo.gl/E2riV3QtnhfvmqKK9?g_st=ac",
  instagramUrl: "#",
  facebookUrl: "#",
  status: "open",
  statusMessage: "",
  hours: "Martes a domingo · 09:00 a 20:00",
  coverImage: null,
};

function publicImageUrl(
  supabase: Awaited<ReturnType<typeof createClient>>,
  path: string | null,
) {
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;
  return supabase.storage.from("public-media").getPublicUrl(path).data.publicUrl;
}

export async function getPublicData() {
  try {
    const supabase = await createClient();
    const [servicesResult, barbersResult, galleryResult, productsResult, businessResult] =
      await Promise.all([
        supabase
          .from("services")
          .select("slug,name,description,category,price,duration_minutes")
          .eq("status", "active")
          .order("price"),
        supabase
          .from("barber_profiles")
          .select("slug,display_name,bio,photo_path,specialties")
          .eq("active", true)
          .order("display_name"),
        supabase
          .from("gallery_posts")
          .select("id,title,image_path,sort_order")
          .eq("status", "published")
          .eq("client_consent", true)
          .order("featured", { ascending: false })
          .order("sort_order")
          .limit(8),
        supabase
          .from("products")
          .select("id,name,description,category,price,stock,image_path")
          .eq("status", "active")
          .order("created_at", { ascending: false })
          .limit(12),
        supabase.from("business_settings").select("*").eq("id", true).maybeSingle(),
      ]);

    const services: PublicService[] = servicesResult.error
      ? fallbackServices
      : (servicesResult.data ?? []).map((item) => ({
          id: item.slug,
          name: item.name,
          description: item.description ?? "Servicio profesional personalizado.",
          category: item.category ?? "Servicio",
          price: Number(item.price),
          duration: item.duration_minutes,
        }));

    const barbers: PublicBarber[] = barbersResult.error
      ? fallbackBarbers
      : (barbersResult.data ?? []).map((item) => ({
          id: item.slug,
          name: item.display_name,
          role: item.bio ?? "Barbero LEGEND CLUB",
          specialties: (item.specialties ?? []).join(", "),
          image:
            publicImageUrl(supabase, item.photo_path) ??
            fallbackBarbers.find((barber) => barber.id === item.slug)?.image ??
            fallbackBarbers[0].image,
        }));

    const gallery: PublicGalleryItem[] = galleryResult.error || !galleryResult.data?.length
      ? fallbackGallery.map((image, index) => ({
          id: `fallback-${index}`,
          title: `Trabajo destacado ${index + 1}`,
          image,
        }))
      : galleryResult.data.map((item) => ({
          id: item.id,
          title: item.title,
          image: publicImageUrl(supabase, item.image_path) ?? fallbackGallery[0],
        }));

    const products: PublicProduct[] = productsResult.error
      ? []
      : (productsResult.data ?? []).map((item) => ({
          id: item.id,
          name: item.name,
          description: item.description ?? "Producto seleccionado por nuestro equipo.",
          category: item.category ?? "Cuidado",
          price: Number(item.price),
          stock: item.stock,
          image: publicImageUrl(supabase, item.image_path),
        }));

    const row = businessResult.data;
    const business: BusinessInfo = row
      ? {
          name: row.business_name,
          description: row.description ?? fallbackBusiness.description,
          slogan: row.slogan ?? fallbackBusiness.slogan,
          amenities: row.amenities ?? fallbackBusiness.amenities,
          address: row.address ?? fallbackBusiness.address,
          phone: row.phone ?? fallbackBusiness.phone,
          whatsapp: row.whatsapp ?? fallbackBusiness.whatsapp,
          mapUrl: row.map_url ?? fallbackBusiness.mapUrl,
          instagramUrl: row.instagram_url ?? fallbackBusiness.instagramUrl,
          facebookUrl: row.facebook_url ?? fallbackBusiness.facebookUrl,
          status: row.business_status,
          statusMessage: row.status_message ?? "",
          hours: row.hours_text ?? fallbackBusiness.hours,
          coverImage: publicImageUrl(supabase, row.cover_path),
        }
      : fallbackBusiness;

    return { services, barbers, gallery, products, business };
  } catch {
    return {
      services: fallbackServices,
      barbers: fallbackBarbers,
      gallery: fallbackGallery.map((image, index) => ({
        id: `fallback-${index}`,
        title: `Trabajo destacado ${index + 1}`,
        image,
      })),
      products: [] as PublicProduct[],
      business: fallbackBusiness,
    };
  }
}

export async function getPublicProducts() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("products")
    .select("id,name,description,category,price,stock,image_path")
    .eq("status", "active")
    .gt("stock", 0)
    .order("created_at", { ascending: false });
  if (error) return [] as PublicProduct[];
  return (data ?? []).map((item) => ({
    id: item.id,
    name: item.name,
    description: item.description ?? "Producto seleccionado por nuestro equipo.",
    category: item.category ?? "Cuidado",
    price: Number(item.price),
    stock: item.stock,
    image: publicImageUrl(supabase, item.image_path),
  })) as PublicProduct[];
}

export async function getPublicGallery() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("gallery_posts")
    .select("id,title,image_path,source_type,source_url,barber_profiles(display_name)")
    .eq("status", "published")
    .order("featured", { ascending: false })
    .order("created_at", { ascending: false });
  if (error || !data?.length) {
    return fallbackGallery.map((image, index) => ({ id: `fallback-${index}`, title: `Trabajo destacado ${index + 1}`, image }));
  }
  return data.map((item) => ({
    id: item.id,
    title: item.title,
    image: publicImageUrl(supabase, item.image_path) ?? fallbackGallery[0],
    sourceType: item.source_type ?? "own_work",
    sourceUrl: item.source_url ?? null,
    barberName: (item.barber_profiles as unknown as { display_name?: string } | null)?.display_name ?? null,
  }));
}
