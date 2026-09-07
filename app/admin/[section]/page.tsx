import { notFound } from "next/navigation";
import { AdminPageContent } from "../admin-page-content";

export const dynamic = "force-dynamic";

const adminSections = new Set([
  "perfil",
  "agenda",
  "programa",
  "clientes",
  "equipo",
  "servicios",
  "productos",
  "galeria",
  "horarios",
  "negocio",
  "estadisticas",
  "administradores",
]);

type AdminSectionPageProps = {
  params: Promise<{ section: string }>;
  searchParams: Promise<{ q?: string | string[]; page?: string | string[] }>;
};

export default async function AdminSectionPage({ params, searchParams }: AdminSectionPageProps) {
  const [{ section }, filters] = await Promise.all([params, searchParams]);
  if (!adminSections.has(section)) notFound();

  const rawQuery = Array.isArray(filters.q) ? filters.q[0] : filters.q;
  const rawPage = Array.isArray(filters.page) ? filters.page[0] : filters.page;
  const parsedPage = Number.parseInt(rawPage ?? "1", 10);

  return (
    <AdminPageContent
      initialSection={section}
      clientSearch={(rawQuery ?? "").trim().slice(0, 100)}
      clientPage={Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1}
    />
  );
}
