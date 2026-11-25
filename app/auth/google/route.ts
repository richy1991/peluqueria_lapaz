import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { googleCallbackPath, googleErrorUrl, googleFlowCookie, googleRequestOrigin, googleReturnCookie, safeAuthPath } from "@/lib/supabase/google-redirect";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const origin = googleRequestOrigin(request);
  const next = safeAuthPath(url.searchParams.get("next"));
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: new URL(googleCallbackPath, origin).href,
      skipBrowserRedirect: true,
      queryParams: { prompt: "select_account" },
    },
  });

  const response = NextResponse.redirect(error || !data.url ? googleErrorUrl(next, origin) : data.url, 303);
  response.headers.set("Cache-Control", "no-store");
  if (!error && data.url) {
    const cookieOptions = {
      path: googleCallbackPath,
      httpOnly: true,
      secure: url.protocol === "https:",
      sameSite: "lax" as const,
      maxAge: 15 * 60,
    };
    response.cookies.set(googleReturnCookie, next, cookieOptions);
    response.cookies.set(googleFlowCookie, data.flowId ?? "", { ...cookieOptions, maxAge: data.flowId ? cookieOptions.maxAge : 0 });
  }
  return response;
}
