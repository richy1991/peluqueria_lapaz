import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { googleCallbackPath, googleErrorUrl, googleFlowCookie, googleRequestOrigin, googleReturnCookie, safeAuthPath } from "@/lib/supabase/google-redirect";

const expiredMessage = "El intento de acceso venció o se abrió en otro navegador. Vuelve a continuar con Google desde esta pestaña.";
const providerMessage = "Google regresó, pero no se pudo iniciar tu sesión. Intenta otra vez desde esta pestaña.";

export async function GET(request: NextRequest) {
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
  const origin = googleRequestOrigin(request);
  const next = safeAuthPath(requestUrl.searchParams.get("next") ?? request.cookies.get(googleReturnCookie)?.value);
  const flowId = request.cookies.get(googleFlowCookie)?.value;
  const providerError = requestUrl.searchParams.get("error_code") ?? requestUrl.searchParams.get("error");
  let failure = providerError ?? "missing_code";
  let message = providerError === "access_denied"
    ? "El acceso con Google se canceló. Puedes intentarlo otra vez."
    : providerError ? providerMessage : expiredMessage;
  let destination: URL | undefined;

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code, flowId ? { flowId } : undefined);

    if (data.session) {
      destination = new URL(next, origin);
    } else {
      failure = error?.code ?? error?.name ?? "missing_session";
      message = /^(AuthPKCECodeVerifierMissingError|bad_code_verifier|flow_state_not_found|flow_state_expired)$/.test(failure)
        ? expiredMessage
        : providerMessage;
    }
  }

  if (!destination && process.env.NODE_ENV === "development") {
    console.warn("[Google OAuth] callback:", /^[a-zA-Z0-9_]+$/.test(failure) ? failure : "auth_error");
  }
  const response = NextResponse.redirect(destination ?? googleErrorUrl(next, origin, message), 303);
  response.headers.set("Cache-Control", "no-store");
  for (const cookie of [googleReturnCookie, googleFlowCookie]) {
    response.cookies.set(cookie, "", { path: googleCallbackPath, maxAge: 0 });
  }
  return response;
}
