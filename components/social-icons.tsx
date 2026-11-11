type SocialIconProps = { size?: number };

export function InstagramIcon({ size = 22 }: SocialIconProps) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5" stroke="currentColor" strokeWidth="2"/><circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="2"/><circle cx="17.5" cy="6.8" r="1.2" fill="currentColor"/></svg>;
}

export function FacebookIcon({ size = 22 }: SocialIconProps) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M13.55 21v-8.2h2.76l.42-3.2h-3.18V7.56c0-.93.26-1.56 1.6-1.56h1.7V3.14A22.3 22.3 0 0 0 14.37 3c-2.46 0-4.15 1.5-4.15 4.25V9.6H7.44v3.2h2.78V21h3.33Z"/></svg>;
}

export function TikTokIcon({ size = 22 }: SocialIconProps) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M19.6 7.2a6.5 6.5 0 0 1-4.1-1.45v8.1a5.75 5.75 0 1 1-5.75-5.75c.36 0 .72.04 1.06.1v3.2a2.6 2.6 0 1 0 1.55 2.38V3h3.2c.3 2.16 1.76 3.87 4.04 4.18v.02Z"/></svg>;
}

export function WhatsAppIcon({ size = 22 }: SocialIconProps) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M20.3 11.8a8.3 8.3 0 0 1-12.25 7.3L3 20.3l1.23-4.9A8.3 8.3 0 1 1 20.3 11.8Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/><path d="M8.4 7.4c-.3.34-.7.88-.7 1.72 0 .84.58 1.83.76 2.08.17.25 1.33 2.17 3.27 3.02 1.61.7 1.94.56 2.3.52.37-.03 1.18-.48 1.35-.94.17-.47.17-.86.12-.95-.05-.08-.2-.13-.42-.25l-1.4-.68c-.2-.08-.35-.12-.5.12-.15.25-.57.73-.7.88-.13.15-.26.17-.47.05-.22-.12-.91-.34-1.73-1.08-.64-.57-1.07-1.28-1.2-1.49-.13-.2-.02-.32.1-.43.1-.1.22-.26.32-.39.11-.13.15-.22.22-.36.08-.15.04-.28-.02-.4l-.62-1.5c-.16-.39-.32-.4-.47-.41h-.4c-.14 0-.37.05-.55.25Z" fill="currentColor"/></svg>;
}
