type IconProps = { size?: number; className?: string };

export function StraightRazorIcon({ size = 28, className }: IconProps) {
  return <svg className={className} width={size} height={size} viewBox="0 0 48 48" fill="none" aria-hidden="true"><path d="M6 12h27c4 0 7 3 7 7v2H13c-4 0-7-3-7-7v-2Z" stroke="currentColor" strokeWidth="2.4"/><path d="m14 22 22 16M12 39h28" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"/><circle cx="13" cy="22" r="2.8" fill="currentColor"/></svg>;
}

export function BearPawIcon({ size = 28, className }: IconProps) {
  return <svg className={className} width={size} height={size} viewBox="0 0 48 48" fill="none" aria-hidden="true"><ellipse cx="24" cy="31" rx="11" ry="9" stroke="currentColor" strokeWidth="2.4"/><circle cx="10" cy="20" r="4" stroke="currentColor" strokeWidth="2.4"/><circle cx="20" cy="13" r="4" stroke="currentColor" strokeWidth="2.4"/><circle cx="30" cy="13" r="4" stroke="currentColor" strokeWidth="2.4"/><circle cx="39" cy="21" r="4" stroke="currentColor" strokeWidth="2.4"/></svg>;
}

export function LegendCrownIcon({ size = 28, className }: IconProps) {
  return <svg className={className} width={size} height={size} viewBox="0 0 48 48" fill="none" aria-hidden="true"><path d="m7 16 10 8 7-13 7 13 10-8-4 21H11L7 16Z" stroke="currentColor" strokeWidth="2.4" strokeLinejoin="round"/><path d="M12 32h24M15 41h18" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"/><path d="M24 19c-5 4-5 9 0 12 5-3 5-8 0-12Z" fill="currentColor"/></svg>;
}

export function LegendDivider() {
  return <div className="legend-divider" aria-hidden="true"><span/><StraightRazorIcon size={25}/><BearPawIcon size={24}/><LegendCrownIcon size={25}/><span/></div>;
}
