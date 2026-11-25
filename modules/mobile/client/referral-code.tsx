"use client";

import QRCode from "react-qr-code";
import { Share2 } from "lucide-react";
import { useState } from "react";

export function ReferralCode({ code }: { code: string }) {
  const [feedback, setFeedback] = useState("");

  async function share() {
    setFeedback("");
    const text = `Usa mi código ${code} en tu primera atención en Barbería LEGEND CLUB.`;
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title: "LEGEND CLUB", text });
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(text);
      setFeedback("Código copiado.");
    } catch {
      setFeedback("Selecciona el código para copiarlo manualmente.");
    }
  }

  return <div className="client-points-referral">
    <div className="client-points-qr"><QRCode value={code} size={104} bgColor="#FFFFFF" fgColor="#0D0D0D" title="Código QR de recomendación" /></div>
    <div>
      <strong>{code}</strong>
      <button type="button" onClick={share}><Share2 size={15} aria-hidden="true" /> Compartir código</button>
      {feedback && <p className="client-points-feedback" role="status">{feedback}</p>}
    </div>
  </div>;
}
