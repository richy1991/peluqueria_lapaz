import type { LucideIcon } from 'lucide-react-native';
import { AlertCircle, CheckCircle2, Info, Monitor, Moon, Sun } from 'lucide-react-native';
import { ActivityIndicator, Pressable, StyleSheet, Switch, TextInput, View } from 'react-native';
import type { StyleProp, TextInputProps, ViewStyle } from 'react-native';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { useAppearance, type ThemePreference } from '@/lib/appearance';
import { ThemedText as Text } from '@/components/ThemedText';
import { GlassSurface } from '@/components/GlassSurface';

export const palette = {
  background: '#0B0D10',
  surface: '#15181C',
  surfaceRaised: '#20242A',
  border: '#2C3138',
  text: '#F2F4F7',
  muted: '#9AA2AC',
  gold: '#D7DDE5',
  goldDark: '#AEB8C5',
  wine: '#A94B60',
  green: '#58C69A',
  red: '#F08087',
};

export type PageHeadingProps = { eyebrow?: string; title: string; description?: string };

export function PageHeading({ eyebrow, title, description }: PageHeadingProps) {
  const { colors } = useAppearance();
  return (
    <Animated.View entering={FadeInUp.duration(320)} style={styles.headingFrame}>
      {eyebrow ? <Text style={[styles.eyebrow, { color: colors.accent }]}>{eyebrow.toUpperCase()}</Text> : null}
      <Text style={[styles.pageTitle, { color: colors.text }]}>{title}</Text>
      {description ? <Text style={[styles.description, { color: colors.muted }]}>{description}</Text> : null}
    </Animated.View>
  );
}

export function Card({ children, style, enteringDelay = 0 }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; enteringDelay?: number }) {
  return <Animated.View entering={FadeInDown.delay(enteringDelay).duration(280)}><GlassSurface radius={16} style={[styles.card, style]}>{children}</GlassSurface></Animated.View>;
}

export function CardTitle({ icon: Icon, title, subtitle }: { icon?: LucideIcon; title: string; subtitle?: string }) {
  const { colors } = useAppearance();
  return (
    <View style={styles.cardHeading}>
      {Icon ? <View style={[styles.cardIcon, { backgroundColor: colors.glassRaised, borderColor: colors.glassBorder }]}><Icon size={19} color={colors.accent} strokeWidth={1.8} /></View> : null}
      <View style={styles.cardHeadingCopy}>
        <Text style={[styles.cardTitle, { color: colors.text }]}>{title}</Text>
        {subtitle ? <Text style={[styles.cardSubtitle, { color: colors.muted }]}>{subtitle}</Text> : null}
      </View>
    </View>
  );
}

export function ActionButton({
  label,
  onPress,
  icon: Icon,
  tone = 'primary',
  disabled = false,
  loading = false,
  compact = false,
}: {
  label: string;
  onPress: () => void;
  icon?: LucideIcon;
  tone?: 'primary' | 'secondary' | 'danger' | 'quiet';
  disabled?: boolean;
  loading?: boolean;
  compact?: boolean;
}) {
  const { colors } = useAppearance();
  const foreground = tone === 'primary' ? colors.accentForeground : tone === 'danger' ? colors.danger : colors.text;
  const background = tone === 'primary' ? colors.accent : tone === 'danger' ? colors.dangerSoft : tone === 'secondary' ? colors.raised : 'transparent';
  const borderColor = tone === 'primary' ? colors.accent : tone === 'danger' ? colors.dangerBorder : tone === 'secondary' ? colors.border : 'transparent';
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled || loading}
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        compact && styles.buttonCompact,
        { backgroundColor: background, borderColor },
        (disabled || loading) && styles.buttonDisabled,
        pressed && !(disabled || loading) && styles.buttonPressed,
      ]}>
      {loading ? <ActivityIndicator size="small" color={foreground} /> : Icon ? <Icon size={17} color={foreground} strokeWidth={2} /> : null}
      <Text style={[styles.buttonText, { color: foreground, backgroundColor: 'transparent' }]}>{loading ? 'Un momento…' : label}</Text>
    </Pressable>
  );
}

export function TextField({ label, style: inputStyle, ...inputProps }: TextInputProps & { label: string }) {
  const { colors } = useAppearance();
  return (
    <View style={styles.field}>
      <Text style={[styles.fieldLabel, { color: colors.text }]}>{label}</Text>
      <TextInput
        placeholderTextColor={colors.muted}
        selectionColor={colors.accent}
        {...inputProps}
        style={[styles.input, { color: colors.text, borderColor: colors.glassBorder, backgroundColor: colors.glassRaised }, inputProps.multiline && styles.inputMultiline, inputStyle]}
      />
    </View>
  );
}

export function SwitchRow({ label, description, value, onValueChange, disabled = false }: { label: string; description?: string; value: boolean; onValueChange: (value: boolean) => void; disabled?: boolean }) {
  const { colors } = useAppearance();
  return (
    <View style={[styles.switchRow, { borderBottomColor: colors.border }]}>
      <View style={styles.switchCopy}>
        <Text style={[styles.switchLabel, { color: colors.text }]}>{label}</Text>
        {description ? <Text style={styles.cardSubtitle}>{description}</Text> : null}
      </View>
      <Switch value={value} onValueChange={onValueChange} disabled={disabled} trackColor={{ false: colors.border, true: colors.accent }} thumbColor={value ? '#FFFFFF' : colors.muted} />
    </View>
  );
}

export function ThemePreferenceControl() {
  const { preference, setPreference, colors } = useAppearance();
  const options: Array<{ value: ThemePreference; label: string; icon: LucideIcon }> = [
    { value: 'system', label: 'Sistema', icon: Monitor },
    { value: 'light', label: 'Claro', icon: Sun },
    { value: 'dark', label: 'Oscuro', icon: Moon },
  ];
  return <View style={[styles.themePicker, { backgroundColor: colors.glassRaised, borderColor: colors.glassBorder }]} accessibilityRole="radiogroup" accessibilityLabel="Tema de apariencia">
    {options.map(({ value, label, icon: Icon }) => {
      const selected = preference === value;
      return <Pressable key={value} onPress={() => setPreference(value)} accessibilityRole="radio" accessibilityState={{ checked: selected }} style={[styles.themeOption, selected && { backgroundColor: colors.accent }]}>
        <Icon size={15} color={selected ? colors.accentForeground : colors.muted} />
        <Text style={[styles.themeOptionLabel, { color: selected ? colors.accentForeground : colors.muted }]}>{label}</Text>
      </Pressable>;
    })}
  </View>;
}

export function StatCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  const { colors } = useAppearance();
  return (
    <GlassSurface style={[styles.statCard, { borderColor: colors.glassBorder, borderLeftColor: colors.accent }]} radius={18}>
      <Text style={[styles.statLabel, { color: colors.muted }]}>{label}</Text>
      <Text style={[styles.statValue, { color: colors.accent }]}>{value}</Text>
      {hint ? <Text style={[styles.cardSubtitle, { color: colors.muted }]}>{hint}</Text> : null}
    </GlassSurface>
  );
}

export function EmptyState({ title, description }: { title: string; description?: string }) {
  const { colors } = useAppearance();
  return (
    <View style={[styles.empty, { backgroundColor: colors.glassRaised, borderColor: colors.glassBorder }]}>
      <Text style={[styles.emptyTitle, { color: colors.text }]}>{title}</Text>
      {description ? <Text style={[styles.cardSubtitle, { color: colors.muted }]}>{description}</Text> : null}
    </View>
  );
}

export function LoadingState({ title = 'Cargando información…' }: { title?: string }) {
  const { colors } = useAppearance();
  return <View accessibilityRole="progressbar" style={[styles.loadingState, { backgroundColor: colors.glassRaised, borderColor: colors.glassBorder }]}>
    <ActivityIndicator color={colors.accent} />
    <Text style={[styles.cardSubtitle, { color: colors.muted }]}>{title}</Text>
  </View>;
}

export function InlineMessage({ children, tone = 'error' }: { children: string; tone?: 'error' | 'success' | 'info' }) {
  const { colors } = useAppearance();
  const color = tone === 'success' ? colors.success : tone === 'info' ? colors.accent : colors.danger;
  const Icon = tone === 'success' ? CheckCircle2 : tone === 'info' ? Info : AlertCircle;
  return <View accessibilityRole="alert" style={[styles.inlineMessageBox, { backgroundColor: tone === 'success' ? colors.successSoft : tone === 'info' ? colors.accentSoft : colors.dangerSoft, borderColor: tone === 'success' ? colors.successBorder : tone === 'info' ? colors.glassBorder : colors.dangerBorder }]}>
    <Icon size={16} color={color} />
    <Text style={[styles.inlineMessage, { color }]}>{children}</Text>
  </View>;
}

const styles = StyleSheet.create({
  headingFrame: { marginBottom: 2, paddingTop: 2, paddingBottom: 5, gap: 5 },
  eyebrow: { fontSize: 9, fontWeight: '900', letterSpacing: 1.7 },
  pageTitle: { fontSize: 31, lineHeight: 37, fontWeight: '800', letterSpacing: -0.8 },
  description: { fontSize: 13, lineHeight: 19, maxWidth: 520 },
  card: { padding: 18, gap: 14 },
  cardHeading: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  cardIcon: { width: 36, height: 36, borderRadius: 11, backgroundColor: '#20242A', borderColor: '#343A43', borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  cardHeadingCopy: { flex: 1, gap: 3 },
  cardTitle: { color: palette.text, fontSize: 18, fontWeight: '700' },
  cardSubtitle: { color: palette.muted, fontSize: 12, lineHeight: 18 },
  button: { minHeight: 48, borderRadius: 12, borderWidth: 1, paddingHorizontal: 16, paddingVertical: 11, flexDirection: 'row', gap: 9, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  buttonCompact: { minHeight: 40, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  buttonText: { fontSize: 13, fontWeight: '800' },
  buttonDisabled: { opacity: 0.5 },
  buttonPressed: { opacity: 0.86, transform: [{ scale: 0.985 }, { translateY: 1 }] },
  field: { gap: 8 },
  fieldLabel: { fontSize: 12, fontWeight: '700' },
  input: { minHeight: 48, borderRadius: 10, borderWidth: 1, borderColor: palette.border, backgroundColor: '#121519', paddingHorizontal: 14, color: palette.text, fontSize: 14 },
  inputMultiline: { minHeight: 96, paddingTop: 12, textAlignVertical: 'top' },
  switchRow: { minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: 14, borderBottomColor: palette.border, borderBottomWidth: StyleSheet.hairlineWidth },
  switchCopy: { flex: 1, gap: 4 },
  switchLabel: { color: palette.text, fontSize: 13, fontWeight: '700' },
  themePicker: { minHeight: 50, flexDirection: 'row', padding: 4, borderWidth: 1, borderRadius: 15, gap: 4 },
  themeOption: { flex: 1, minHeight: 42, borderRadius: 11, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  themeOptionLabel: { fontSize: 11, fontWeight: '800' },
  statCard: { flex: 1, minWidth: 0, minHeight: 104, borderLeftWidth: 3, padding: 14, justifyContent: 'space-between', gap: 8 },
  statLabel: { fontSize: 10, fontWeight: '700' },
  statValue: { fontSize: 24, fontWeight: '800' },
  empty: { padding: 15, gap: 6, borderWidth: 1, borderRadius: 15 },
  emptyTitle: { fontSize: 14, fontWeight: '700' },
  loadingState: { minHeight: 72, padding: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 11, borderWidth: 1, borderRadius: 15 },
  inlineMessageBox: { flexDirection: 'row', alignItems: 'flex-start', gap: 9, borderWidth: 1, borderRadius: 13, paddingVertical: 10, paddingHorizontal: 12 },
  inlineMessage: { flex: 1, fontSize: 12, fontWeight: '600', lineHeight: 18 },
});
