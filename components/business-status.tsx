"use client";

import { useEffect, useState } from "react";
import { resolveBusinessStatus, type BusinessHour } from "@/lib/business-hours";

type Props = {
  configuredStatus: string;
  initialStatus: string;
  statusMessage: string;
  timezone: string;
  hours: BusinessHour[];
  variant?: "public" | "client";
};

export function BusinessStatus({ configuredStatus, initialStatus, statusMessage, timezone, hours, variant = "public" }: Props) {
  const [status, setStatus] = useState(initialStatus);

  useEffect(() => {
    const update = () => setStatus(resolveBusinessStatus(configuredStatus, hours, timezone));
    update();
    const interval = window.setInterval(update, 30_000);
    return () => window.clearInterval(interval);
  }, [configuredStatus, hours, timezone]);

  const isOpen = status === "open" || status === "appointment_only";
  const text = isOpen
    ? status === "appointment_only" ? "Atención solo con reserva" : "Abierto ahora"
    : status === "emergency_closed" ? "Cerrado por emergencia" : status === "schedule_closed" ? "Cerrado ahora" : "Cerrado temporalmente";
  const message = status === "schedule_closed" ? "Fuera del horario de atención" : statusMessage;
  const compact = variant === "client";

  return <div className={`open-pill business-status ${isOpen ? "" : "closed-pill"} ${compact ? "client-business-status" : ""}`} aria-live="polite" title={compact && message ? message : undefined}><span /> <strong>{text}</strong>{!compact && message ? ` · ${message}` : ""}</div>;
}
