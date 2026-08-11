export function dispatchDashboardToast(type: "success" | "error", message: string) {
  window.dispatchEvent(new CustomEvent("legend-dashboard-toast", { detail: { type, message } }));
}

export function dispatchDashboardSuccess(message = "Operación completada correctamente.") {
  window.dispatchEvent(new Event("legend-dashboard-operation-success"));
  dispatchDashboardToast("success", message);
}

export function dispatchDashboardError(message: string) {
  dispatchDashboardToast("error", message);
}

export function clearFormErrors(form: HTMLFormElement) {
  Array.from(form.elements).forEach((element) => {
    if (!(element instanceof HTMLInputElement || element instanceof HTMLSelectElement || element instanceof HTMLTextAreaElement)) return;
    element.classList.remove("field-error");
    element.removeAttribute("aria-invalid");
    element.setCustomValidity("");
  });
}

function getErrorMessage(reason: unknown) {
  if (reason instanceof Error) return reason.message;
  if (reason && typeof reason === "object" && "message" in reason) return String((reason as { message: unknown }).message);
  return "No se pudo completar la operación.";
}

function fieldNames(form: HTMLFormElement) {
  return Array.from(form.elements)
    .map((element) => (element instanceof HTMLInputElement || element instanceof HTMLSelectElement || element instanceof HTMLTextAreaElement ? element.name : ""))
    .filter((name): name is string => Boolean(name));
}

function focusField(form: HTMLFormElement, name: string, message: string) {
  const element = form.elements.namedItem(name);
  const control = element instanceof HTMLInputElement || element instanceof HTMLSelectElement || element instanceof HTMLTextAreaElement ? element : null;
  if (!control) return false;
  control.classList.add("field-error");
  control.setAttribute("aria-invalid", "true");
  control.setCustomValidity(message);
  control.reportValidity();
  return true;
}

function inferFieldName(form: HTMLFormElement, message: string) {
  const lower = message.toLowerCase();
  const directNames = Array.from(message.matchAll(/"([^"]+)"/g)).map((match) => match[1]);
  for (const name of directNames) {
    if (form.elements.namedItem(name)) return name;
  }

  const patterns: Array<[RegExp, string[]]> = [
    [/correo|email|e-mail/, ["email", "account_email", "target_email"]],
    [/telefono|tel|phone|whatsapp/, ["phone", "guest_phone", "whatsapp"]],
    [/codigo|code|slug|identificador/, ["code", "slug", "promotion_code", "referral_code", "redemption_code"]],
    [/nombre|name|titulo|title|concepto|concept/, ["name", "public_name", "display_name", "business_name", "guest_name", "concept"]],
    [/precio|monto|amount|discount|descuento|points|puntos|saldo|opening|counted/, ["amount", "price", "discount", "points", "opening", "counted", "points_cost", "max_discount"]],
    [/fecha|date|hora|start|end/, ["starts_at", "start_date", "end_date", "date"]],
    [/peluquero|barber/, ["barber_id", "target_barber_id", "target_barber"]],
    [/producto|product/, ["product_id", "target_product_id"]],
    [/cliente|client/, ["client_id", "target_client_id"]],
    [/imagen|image|archivo|file/, ["image"]],
    [/autoriz|consent/, ["client_consent"]],
    [/stock|cantidad|quantity|qty/, ["stock", "quantity"]],
    [/duracion|duration|gracia|grace/, ["duration_minutes", "grace_minutes"]],
  ];

  for (const [pattern, candidates] of patterns) {
    if (!pattern.test(lower)) continue;
    for (const candidate of candidates) {
      if (form.elements.namedItem(candidate)) return candidate;
    }
  }

  return fieldNames(form)[0];
}

export function reportFormError(form: HTMLFormElement | undefined, reason: unknown, preferredField?: string) {
  const message = getErrorMessage(reason);
  if (form) {
    const fieldName = preferredField ?? inferFieldName(form, message);
    if (fieldName) focusField(form, fieldName, message);
  }
  return message;
}
