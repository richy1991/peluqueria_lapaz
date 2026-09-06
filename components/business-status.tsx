"use client";

import { useEffect, useState } from "react";
import { isBusinessOpenNow, type BusinessHour } from "@/lib/business-hours";

type Props = {
  configuredStatus: string;
  initialStatus: string;
  statusMessage: string;
  timezone: string;
  hours: BusinessHour[];
};

function resolveStatus(configuredStatus: string, hours: BusinessHour[], timezone: string) {
  const followsSchedule = configuredStatus === "open" || configuredStatus === "appointment_only";
  return followsSchedule && !isBusinessOpenNow(hours, timezone) ? "schedule_closed" : configuredStatus;
}

export function BusinessStatus({ configuredStatus, initialStatus, statusMessage, timezone, hours }: Props) {
  const [status, setStatus] = useState(initialStatus);

  useEffect(() => {
    const update = () => setStatus(resolveStatus(configuredStatus, hours, timezone));
    update();
    const interval = window.setInterval(update, 30_000);
    return () => window.clearInterval(interval);
  }, [configuredStatus, hours, timezone]);

  const isOpen = status === "open" || status === "appointment_only";
  const text = isOpen
    ? status === "appointment_only" ? "Atención solo con reserva" : "Abierto ahora"
    : status === "emergency_closed" ? "Cerrado por emergencia" : status === "schedule_closed" ? "Cerrado ahora" : "Cerrado temporalmente";
  const message = status === "schedule_closed" ? "Fuera del horario de atención" : statusMessage;

  return <div className={`open-pill ${isOpen ? "" : "closed-pill"}`} aria-live="polite"><span /> {text}{message ? ` · ${message}` : ""}</div>;
}
