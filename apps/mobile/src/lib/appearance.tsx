import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';

export type ThemePreference = 'system' | 'light' | 'dark';
export type AppColors = {
  background: string; surface: string; raised: string; border: string; text: string; muted: string; accent: string; accentForeground: string; accentSoft: string; header: string;
  glassSurface: string; glassRaised: string; glassBorder: string; glassHighlight: string;
  success: string; successSoft: string; successBorder: string; danger: string; dangerSoft: string; dangerBorder: string;
};

const palettes: Record<'light' | 'dark', AppColors> = {
  dark: { background: '#0B0D10', surface: '#15181C', raised: '#101216', border: '#2C3138', text: '#F2F4F7', muted: '#9AA2AC', accent: '#D7DDE5', accentForeground: '#171A1F', accentSoft: 'rgba(215,221,229,0.10)', header: '#0B0D10', glassSurface: 'rgba(21,24,28,0.96)', glassRaised: 'rgba(255,255,255,0.045)', glassBorder: 'rgba(176,186,199,0.20)', glassHighlight: 'rgba(255,255,255,0.08)', success: '#58C69A', successSoft: 'rgba(48,151,108,0.15)', successBorder: 'rgba(88,198,154,0.3)', danger: '#F08087', dangerSoft: 'rgba(170,65,78,0.16)', dangerBorder: 'rgba(240,128,135,0.3)' },
  light: { background: '#F1F3F5', surface: '#FFFFFF', raised: '#F6F7F8', border: '#DCE0E5', text: '#171A1F', muted: '#6B737E', accent: '#46515E', accentForeground: '#FFFFFF', accentSoft: '#E9EDF1', header: '#111418', glassSurface: 'rgba(255,255,255,0.96)', glassRaised: 'rgba(23,26,31,0.035)', glassBorder: 'rgba(77,88,101,0.18)', glassHighlight: 'rgba(255,255,255,0.78)', success: '#18794E', successSoft: '#E8F5EE', successBorder: '#B8E3CA', danger: '#AE3947', dangerSoft: '#FCEDEE', dangerBorder: '#F0C2C7' },
};

type AppearanceContextValue = { preference: ThemePreference; resolved: 'light' | 'dark'; colors: AppColors; setPreference: (mode: ThemePreference) => void };
const AppearanceContext = createContext<AppearanceContextValue | null>(null);
const preferenceKey = 'legend-club-appearance';

export function AppearanceProvider({ children }: { children: React.ReactNode }) {
  const systemMode = useColorScheme() === 'light' ? 'light' : 'dark';
  const [preference, setPreferenceState] = useState<ThemePreference>(() => {
    try {
      const stored = globalThis.localStorage?.getItem(preferenceKey);
      if (stored === 'light' || stored === 'dark' || stored === 'system') return stored;
    } catch { /* storage may be unavailable before the native database is ready */ }
    return 'system';
  });

  const setPreference = useCallback((mode: ThemePreference) => {
    setPreferenceState(mode);
    try { globalThis.localStorage?.setItem(preferenceKey, mode); } catch { /* keep the selection in memory */ }
  }, []);
  const resolved = preference === 'system' ? systemMode : preference;
  const value = useMemo(() => ({ preference, resolved, colors: palettes[resolved], setPreference }), [preference, resolved, setPreference]);

  return <AppearanceContext.Provider value={value}>{children}</AppearanceContext.Provider>;
}

export function useAppearance() {
  const context = useContext(AppearanceContext);
  if (!context) throw new Error('useAppearance debe usarse dentro de AppearanceProvider');
  return context;
}
