import { createClient } from "@/lib/supabase/server";
import {
  barbers as fallbackBarbers,
  gallery as fallbackGallery,
  services as fallbackServices,
} from "@/lib/demo-data";
import { formatBusinessHours, isBusinessOpenNow, type BusinessHour } from "@/lib/business-hours";

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
  description?: string;
  image: string;
  images: string[];
  sourceType?: string;
  sourceUrl?: string | null;
  barberName?: string | null;
};

export type PublicProduct = {
  id: string;
  name: string;
  description: string;
  category: string;
  price: number;
  stock: number;
  image: string | null;
  images: string[];
  brand: string;
  presentation: string;
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
  configuredStatus: string;
  statusMessage: string;
  hours: string;
  schedule: BusinessHour[];
  timezone: string;
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
  configuredStatus: "open",
  statusMessage: "",
  hours: "Martes a domingo · 09:00 a 20:00",
  schedule: [],
  timezone: "America/La_Paz",
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

function publicImageUrls(
  supabase: Awaited<ReturnType<typeof createClient>>,
  paths: string[] | null | undefined,
  fallbackPath?: string | null,
) {
  const source = paths?.length ? paths : fallbackPath ? [fallbackPath] : [];
  return source.map((path) => publicImageUrl(supabase, path)).filter((path): path is string => Boolean(path)).slice(0, 3);
}

export async function getPublicData() {
  try {
    const supabase = await createClient();
    const [servicesResult, barbersResult, galleryResult, productsResult, businessResult, businessHoursResult] =
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
          .select("id,title,description,image_path,image_paths,sort_order")
          .eq("status", "published")
          .eq("client_consent", true)
          .order("featured", { ascending: false })
          .order("sort_order")
          .limit(8),
        supabase
          .from("products")
          .select("id,name,description,category,brand,presentation,price,stock,image_path,image_paths")
          .eq("status", "active")
          .order("created_at", { ascending: false })
          .limit(12),
        supabase.from("business_settings").select("*").eq("id", true).maybeSingle(),
        supabase.from("business_hours").select("weekday,opens_at,closes_at,active").order("weekday"),
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
          images: [image],
        }))
      : galleryResult.data.map((item) => {
          const images = publicImageUrls(supabase, item.image_paths, item.image_path);
          return {
            id: item.id,
            title: item.title,
            description: item.description ?? "",
            image: images[0] ?? fallbackGallery[0],
            images: images.length ? images : [fallbackGallery[0]],
          };
        });

    const products: PublicProduct[] = productsResult.error
      ? []
      : (productsResult.data ?? []).map((item) => ({
          id: item.id,
          name: item.name,
          description: item.description ?? "Producto seleccionado por nuestro equipo.",
          category: item.category ?? "Cuidado",
          price: Number(item.price),
          stock: item.stock,
          brand: item.brand ?? "",
          presentation: item.presentation ?? "",
          image: publicImageUrls(supabase, item.image_paths, item.image_path)[0] ?? null,
          images: publicImageUrls(supabase, item.image_paths, item.image_path),
        }));

    const row = businessResult.data;
    const businessHours = (businessHoursResult.data ?? []) as BusinessHour[];
    const scheduledOpen = isBusinessOpenNow(businessHours, row?.timezone ?? "America/La_Paz");
    const configuredStatus = row?.business_status ?? fallbackBusiness.status;
    const followsSchedule = configuredStatus === "open" || configuredStatus === "appointment_only";
    const effectiveStatus = followsSchedule && !scheduledOpen ? "schedule_closed" : configuredStatus;
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
          status: effectiveStatus,
          configuredStatus,
          statusMessage: effectiveStatus === "schedule_closed" ? "Fuera del horario de atención" : row.status_message ?? "",
          hours: businessHours.length ? formatBusinessHours(businessHours) : row.hours_text ?? fallbackBusiness.hours,
          schedule: businessHours,
          timezone: row.timezone ?? fallbackBusiness.timezone,
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
        images: [image],
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
    .select("id,name,description,category,brand,presentation,price,stock,image_path,image_paths")
    .eq("status", "active")
    .gt("stock", 0)
    .order("created_at", { ascending: false });
  if (error) return [] as PublicProduct[];
  return (data ?? []).map((item) => {
    const images = publicImageUrls(supabase, item.image_paths, item.image_path);
    return {
      id: item.id,
      name: item.name,
      description: item.description ?? "Producto seleccionado por nuestro equipo.",
      category: item.category ?? "Cuidado",
      brand: item.brand ?? "",
      presentation: item.presentation ?? "",
      price: Number(item.price),
      stock: item.stock,
      image: images[0] ?? null,
      images,
    };
  }) as PublicProduct[];
}

export async function getPublicGallery() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("gallery_posts")
    .select("id,title,description,image_path,image_paths,source_type,source_url,barber_profiles(display_name)")
    .eq("status", "published")
    .order("featured", { ascending: false })
    .order("created_at", { ascending: false });
  if (error || !data?.length) {
    return fallbackGallery.map((image, index) => ({ id: `fallback-${index}`, title: `Trabajo destacado ${index + 1}`, image, images: [image] }));
  }
  return data.map((item) => {
    const images = publicImageUrls(supabase, item.image_paths, item.image_path);
    return {
      id: item.id,
      title: item.title,
      description: item.description ?? "",
      image: images[0] ?? fallbackGallery[0],
      images: images.length ? images : [fallbackGallery[0]],
      sourceType: item.source_type ?? "own_work",
      sourceUrl: item.source_url ?? null,
      barberName: (item.barber_profiles as unknown as { display_name?: string } | null)?.display_name ?? null,
    };
  });
}
