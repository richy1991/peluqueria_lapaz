import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LoginForm } from "./login-form";
import "./login.css";

export const dynamic = "force-dynamic";

function safeNext(value?: string) {
  return value?.startsWith("/") && !value.startsWith("//") ? value : "/panel";
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; auth_error?: string }> }) {
  const params = await searchParams;
  const next = safeNext(params.next);
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) redirect(next);
  return <LoginForm next={next} initialError={params.auth_error ?? ""} />;
}
