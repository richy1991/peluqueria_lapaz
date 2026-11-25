export const googleReturnCookie = "legend-google-return";
export const googleFlowCookie = "legend-google-flow";
export const googleCallbackPath = "/auth/callback";

export function safeAuthPath(value?: string | null) {
  if (!value?.startsWith("/") || value.startsWith("//") || value.includes("\\")) return "/panel";

  const origin = "https://legend.invalid";
  const url = new URL(value, origin);
  return url.origin === origin && !url.pathname.startsWith("//")
    ? `${url.pathname}${url.search}${url.hash}`
    : "/panel";
}

export function googleRequestOrigin(request: Request) {
  const url = new URL(request.url);
  const host = request.headers.get("host");
  // Next's development server can normalize a loopback URL to localhost.
  if (process.env.NODE_ENV === "development" && host && /^(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/.test(host)) {
    url.host = host;
  }
  return url.origin;
}

export function googleSignInPath(next: string) {
  return `/auth/google?next=${encodeURIComponent(next)}`;
}

export function googleErrorUrl(next: string, origin: string, message = "No pudimos completar el acceso con Google. Intenta otra vez.") {
  const destination = new URL(next, origin);
  if (destination.pathname !== "/reservar" || destination.searchParams.get("auth") !== "complete") {
    const adminEntry = destination.pathname === "/admin" || destination.pathname.startsWith("/admin/");
    destination.pathname = adminEntry ? "/admin/login" : "/login";
    destination.search = "";
    destination.hash = "";
    destination.searchParams.set("next", next);
  }
  destination.searchParams.set("auth_error", message);
  return destination;
}
