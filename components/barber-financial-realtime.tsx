"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function BarberFinancialRealtime({ barberId }: { barberId?: string }) {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    let refreshTimer: number | undefined;
    const refresh = () => {
      if (refreshTimer) window.clearTimeout(refreshTimer);
      refreshTimer = window.setTimeout(() => router.refresh(), 180);
    };
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    const channelName = `barber-financials-${barberId ?? "team"}`;
    let channel = supabase.channel(channelName);

    if (barberId) {
      channel = channel
        .on("postgres_changes", { event: "*", schema: "public", table: "barber_earnings", filter: `barber_id=eq.${barberId}` }, refresh)
        .on("postgres_changes", { event: "*", schema: "public", table: "payouts", filter: `barber_id=eq.${barberId}` }, refresh);
    } else {
      channel = channel
        .on("postgres_changes", { event: "*", schema: "public", table: "barber_earnings" }, refresh)
        .on("postgres_changes", { event: "*", schema: "public", table: "payouts" }, refresh);
    }

    channel.subscribe();
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => {
      document.removeEventListener("visibilitychange", refreshWhenVisible);
      if (refreshTimer) window.clearTimeout(refreshTimer);
      void supabase.removeChannel(channel);
    };
  }, [barberId, router]);

  return null;
}
