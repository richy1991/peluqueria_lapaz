import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);

  // The native build uses the already-authorized web callback as a bridge.
  // Keep the PKCE code on the device; exchanging it here would bind the
  // resulting session to the browser instead of the app.
  if (requestUrl.searchParams.get("native") === "1") {
    const appUrl = new URL("legendclub://auth/callback");
    for (const key of ["code", "error", "error_code", "error_description"]) {
      const value = requestUrl.searchParams.get(key);
      if (value) appUrl.searchParams.set(key, value);
    }
    const response = NextResponse.redirect(appUrl, { status: 302 });
    response.headers.set("Cache-Control", "no-store");
    return response;
  }

  const code = requestUrl.searchParams.get("code");
  const requestedNext = requestUrl.searchParams.get("next") ?? "/panel";
  const next = requestedNext.startsWith("/") && !requestedNext.startsWith("//")
    ? requestedNext
    : "/panel";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      return NextResponse.redirect(new URL(next, requestUrl.origin));
    }
  }

  const errorUrl = new URL("/login", requestUrl.origin);
  errorUrl.searchParams.set("next", next);
  errorUrl.searchParams.set("auth_error", "No pudimos completar el acceso con Google.");
  return NextResponse.redirect(errorUrl);
}
