"use client";

import { useCallback, useEffect, useRef } from "react";

const overlayStateKey = "__legendOverlay";

export function useNativeOverlay(open: boolean, onClose: () => void, name: string) {
  const closeRef = useRef(onClose);
  const markerRef = useRef("");
  const activeRef = useRef(false);

  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);

  const close = useCallback(() => {
    if (activeRef.current && window.history.state?.[overlayStateKey] === markerRef.current) {
      window.history.back();
      return;
    }
    activeRef.current = false;
    closeRef.current();
  }, []);

  useEffect(() => {
    if (!open || activeRef.current) return;
    const marker = `${name}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    markerRef.current = marker;
    activeRef.current = true;
    window.history.pushState({ ...window.history.state, [overlayStateKey]: marker }, "", window.location.href);

    const onPopState = () => {
      if (!activeRef.current) return;
      activeRef.current = false;
      closeRef.current();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };

    window.addEventListener("popstate", onPopState);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("popstate", onPopState);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [close, name, open]);

  return close;
}
