import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { safeAuthPath } from "@/lib/supabase/google-redirect";
import { AdminAccessFrame } from "../admin-access-frame";
import { AdminLoginForm } from "./admin-login-form";

export const dynamic = "force-dynamic";

export default async function AdminLoginPage({ searchParams }: { searchParams: Promise<{ next?: string; auth_error?: string }> }) {
  const query = await searchParams;
  const requested = safeAuthPath(typeof query.next === "string" ? query.next : null);
  const pathname = requested.split(/[?#]/, 1)[0];
  const next = /^\/admin\/(?!login\/?$)[a-z]+\/?$/.test(pathname) ? requested : "/admin";
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) redirect(next);
  return <AdminAccessFrame><AdminLoginForm next={next} error={typeof query.auth_error === "string" ? query.auth_error : ""} /></AdminAccessFrame>;
}
