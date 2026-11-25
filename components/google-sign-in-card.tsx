"use client";

import { useId, type ReactNode } from "react";
import Image from "next/image";
import styles from "./google-sign-in-card.module.css";

type GoogleSignInCardProps = {
  title: string;
  description: string;
  heading: "h1" | "h3";
  loading: boolean;
  error: string;
  onSignIn: () => Promise<void>;
  layout?: "page" | "embedded";
  secondaryAction?: ReactNode;
  actionsClassName?: string;
};

export function GoogleSignInCard({
  title,
  description,
  heading: Heading,
  loading,
  error,
  onSignIn,
  layout = "embedded",
  secondaryAction,
  actionsClassName = "",
}: GoogleSignInCardProps) {
  const titleId = useId();

  return (
    <section className={layout === "page" ? `${styles.card} ${styles.pageCard}` : styles.card} aria-labelledby={titleId}>
      <div className={styles.copy}>
        <Heading className={styles.title} id={titleId}>{title}</Heading>
        <p className={styles.description}>{description}</p>
        {error && <p className={styles.error} role="alert">{error}</p>}
        <div className={`${styles.actions} ${actionsClassName}`}>
          {secondaryAction}
          <button type="button" className={styles.googleButton} disabled={loading} aria-busy={loading} onClick={onSignIn}>
            <Image src="/brand/google-g.png" alt="" width={20} height={20} unoptimized />
            {loading ? "Conectando…" : "Continuar con Google"}
          </button>
        </div>
      </div>
      <div className={styles.photo} aria-hidden="true" />
    </section>
  );
}
