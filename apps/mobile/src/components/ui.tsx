import type { LucideIcon } from 'lucide-react-native';
import { ActivityIndicator, ImageBackground, Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import type { TextInputProps } from 'react-native';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';

import salonHeader from '../../assets/images/salon-header.jpg';

export const palette = {
  background: '#171310',
  surface: '#211b17',
  surfaceRaised: '#2b231e',
  border: '#40352b',
  text: '#f7f0e7',
  muted: '#afa296',
  gold: '#d9ad5d',
  goldDark: '#aa7e37',
  wine: '#9d3d56',
  green: '#48c292',
  red: '#ed7c80',
};

export function PageHeading({ eyebrow, title, description }: { eyebrow?: string; title: string; description?: string }) {
  return (
    <Animated.View entering={FadeInUp.duration(500)} style={styles.headingFrame}>
      <ImageBackground source={salonHeader} resizeMode="cover" imageStyle={styles.headingImage} style={styles.heading}>
        <View pointerEvents="none" style={styles.headingShade} />
        <View style={styles.headingContent}>
          {eyebrow ? <Text style={styles.eyebrow}>{eyebrow.toUpperCase()}</Text> : null}
          <Text style={styles.pageTitle}>{title}</Text>
          {description ? <Text style={styles.description}>{description}</Text> : null}
        </View>
      </ImageBackground>
    </Animated.View>
  );
}

export function Card({ children, style }: { children: React.ReactNode; style?: object }) {
  return <Animated.View entering={FadeInDown.duration(420)} style={[styles.card, style]}>{children}</Animated.View>;
}

export function CardTitle({ icon: Icon, title, subtitle }: { icon?: LucideIcon; title: string; subtitle?: string }) {
  return (
    <View style={styles.cardHeading}>
      {Icon ? <View style={styles.cardIcon}><Icon size={19} color={palette.gold} strokeWidth={1.8} /></View> : null}
      <View style={styles.cardHeadingCopy}>
        <Text style={styles.cardTitle}>{title}</Text>
        {subtitle ? <Text style={styles.cardSubtitle}>{subtitle}</Text> : null}
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
  const foreground = tone === 'primary' ? '#20180f' : tone === 'danger' ? palette.red : palette.text;
  const background = tone === 'primary' ? palette.gold : tone === 'danger' ? '#382027' : tone === 'secondary' ? palette.surfaceRaised : 'transparent';
  const borderColor = tone === 'primary' ? palette.gold : tone === 'danger' ? '#684050' : tone === 'secondary' ? palette.border : 'transparent';
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        compact && styles.buttonCompact,
        { backgroundColor: background, borderColor },
        (disabled || loading) && styles.buttonDisabled,
        pressed && !(disabled || loading) && styles.buttonPressed,
      ]}>
      {loading ? <ActivityIndicator size="small" color={foreground} /> : Icon ? <Icon size={17} color={foreground} strokeWidth={2} /> : null}
      <Text style={[styles.buttonText, { color: foreground }]}>{loading ? 'Un momento…' : label}</Text>
    </Pressable>
  );
}

export function TextField({ label, ...props }: TextInputProps & { label: string }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        placeholderTextColor="#82776e"
        selectionColor={palette.gold}
        style={[styles.input, props.multiline && styles.inputMultiline]}
        {...props}
      />
    </View>
  );
}

export function SwitchRow({ label, description, value, onValueChange }: { label: string; description?: string; value: boolean; onValueChange: (value: boolean) => void }) {
  return (
    <View style={styles.switchRow}>
      <View style={styles.switchCopy}>
        <Text style={styles.switchLabel}>{label}</Text>
        {description ? <Text style={styles.cardSubtitle}>{description}</Text> : null}
      </View>
      <Switch value={value} onValueChange={onValueChange} trackColor={{ false: '#4b4138', true: '#8a6531' }} thumbColor={value ? palette.gold : '#d6c9ba'} />
    </View>
  );
}

export function StatCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
      {hint ? <Text style={styles.cardSubtitle}>{hint}</Text> : null}
    </View>
  );
}

export function EmptyState({ title, description }: { title: string; description?: string }) {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyTitle}>{title}</Text>
      {description ? <Text style={styles.cardSubtitle}>{description}</Text> : null}
    </View>
  );
}

export function InlineMessage({ children, tone = 'error' }: { children: string; tone?: 'error' | 'success' | 'info' }) {
  const color = tone === 'success' ? palette.green : tone === 'info' ? palette.gold : palette.red;
  return <Text style={[styles.inlineMessage, { color }]}>{children}</Text>;
}

const styles = StyleSheet.create({
  headingFrame: { marginHorizontal: -17, marginTop: -18, marginBottom: 2, overflow: 'hidden', borderBottomLeftRadius: 25, borderBottomRightRadius: 25 },
  heading: { minHeight: 218, justifyContent: 'flex-end', paddingHorizontal: 23, paddingTop: 22, paddingBottom: 26, backgroundColor: '#161310' },
  headingImage: { opacity: 0.5 },
  headingShade: { ...StyleSheet.absoluteFill, backgroundColor: '#090807a8' },
  headingContent: { gap: 7 },
  eyebrow: { color: palette.gold, fontSize: 9, fontWeight: '900', letterSpacing: 2.1 },
  pageTitle: { color: '#fffaf1', fontSize: 31, lineHeight: 36, fontWeight: '800', letterSpacing: -0.8 },
  description: { color: '#d1c5b7', fontSize: 12, lineHeight: 18, maxWidth: 480 },
  card: { backgroundColor: '#1d1916', borderColor: '#40352b', borderWidth: 1, borderRadius: 18, padding: 17, gap: 14, shadowColor: '#000', shadowOpacity: 0.14, shadowRadius: 13, shadowOffset: { width: 0, height: 5 }, elevation: 3 },
  cardHeading: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  cardIcon: { width: 38, height: 38, borderRadius: 12, backgroundColor: '#34291f', borderColor: '#58452b', borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  cardHeadingCopy: { flex: 1, gap: 3 },
  cardTitle: { color: palette.text, fontSize: 17, fontWeight: '700' },
  cardSubtitle: { color: palette.muted, fontSize: 12, lineHeight: 18 },
  button: { minHeight: 48, borderRadius: 13, borderWidth: 1, paddingHorizontal: 15, paddingVertical: 12, flexDirection: 'row', gap: 9, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.14, shadowRadius: 7, shadowOffset: { width: 0, height: 3 }, elevation: 2 },
  buttonCompact: { minHeight: 40, paddingHorizontal: 12, paddingVertical: 8 },
  buttonText: { fontSize: 13, fontWeight: '800' },
  buttonDisabled: { opacity: 0.5 },
  buttonPressed: { opacity: 0.86, transform: [{ scale: 0.985 }, { translateY: 1 }] },
  field: { gap: 7 },
  fieldLabel: { color: palette.text, fontSize: 12, fontWeight: '700' },
  input: { minHeight: 47, borderRadius: 12, borderWidth: 1, borderColor: palette.border, backgroundColor: '#191512', paddingHorizontal: 13, color: palette.text, fontSize: 14 },
  inputMultiline: { minHeight: 96, paddingTop: 12, textAlignVertical: 'top' },
  switchRow: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 14, borderBottomColor: palette.border, borderBottomWidth: StyleSheet.hairlineWidth },
  switchCopy: { flex: 1, gap: 4 },
  switchLabel: { color: palette.text, fontSize: 13, fontWeight: '700' },
  statCard: { flex: 1, minWidth: 130, minHeight: 112, backgroundColor: palette.surfaceRaised, borderColor: palette.border, borderWidth: 1, borderLeftColor: palette.goldDark, borderLeftWidth: 3, borderRadius: 15, padding: 14, justifyContent: 'space-between', gap: 8 },
  statLabel: { color: palette.muted, fontSize: 11, fontWeight: '700' },
  statValue: { color: palette.gold, fontSize: 25, fontWeight: '800' },
  empty: { backgroundColor: '#1b1613', borderColor: palette.border, borderWidth: 1, borderRadius: 13, padding: 15, gap: 6 },
  emptyTitle: { color: palette.text, fontSize: 14, fontWeight: '700' },
  inlineMessage: { fontSize: 12, fontWeight: '600', lineHeight: 18 },
});
