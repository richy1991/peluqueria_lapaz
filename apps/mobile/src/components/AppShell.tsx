import type { LucideIcon } from 'lucide-react-native';
import { ArrowLeft, MessageCircle } from 'lucide-react-native';
import { router, type Href } from 'expo-router';
import { Image, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import Animated, { Extrapolation, FadeIn, interpolate, useAnimatedScrollHandler, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import type { SharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

import brandMark from '../../assets/images/legend-club-icon.png';
import { palette } from '@/components/ui';
import { useAppearance } from '@/lib/appearance';

export type AppTab = { key: string; label: string; href: string; icon: LucideIcon };
type FloatingHeaderRenderer = (scrollY: SharedValue<number>) => React.ReactNode;

export function AppShell({
  title, roleLabel, activeTab, tabs, children, onRefresh, refreshing = false, backHref, onBack, showChat = true, floatingHeader, floatingHeaderHeight = 390,
}: {
  title: string;
  roleLabel: string;
  activeTab?: string;
  tabs: AppTab[];
  children: React.ReactNode;
  onRefresh?: () => void;
  refreshing?: boolean;
  backHref?: string;
  onBack?: () => void;
  showChat?: boolean;
  floatingHeader?: FloatingHeaderRenderer;
  floatingHeaderHeight?: number;
}) {
  const insets = useSafeAreaInsets();
  const { colors } = useAppearance();
  const scrollY = useSharedValue(0);
  const previousY = useSharedValue(0);
  const navHidden = useSharedValue(0);

  const onScroll = useAnimatedScrollHandler({
    onScroll: (event) => {
      const y = Math.max(0, event.contentOffset.y);
      const delta = y - previousY.value;
      // eslint-disable-next-line react-hooks/immutability
      scrollY.value = y;
      // Reanimated shared values are updated on the UI thread.
      // eslint-disable-next-line react-hooks/immutability
      if (delta > 3 && y > 45) navHidden.value = withTiming(1, { duration: 190 });
      else if (delta < -3 || y < 45) navHidden.value = withTiming(0, { duration: 220 });
      // eslint-disable-next-line react-hooks/immutability
      previousY.value = y;
    },
  });
  const navStyle = useAnimatedStyle(() => ({ opacity: 1 - navHidden.value, transform: [{ translateY: navHidden.value * 110 }] }));
  const floatingHeaderStyle = useAnimatedStyle(() => ({
    height: interpolate(scrollY.value, [0, 160], [floatingHeaderHeight, insets.top + 76], Extrapolation.CLAMP),
  }));
  const hasFloatingHeader = Boolean(floatingHeader);

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {hasFloatingHeader ? <StatusBar style="light" /> : null}
      {!hasFloatingHeader ? <View style={[styles.topBar, { top: 0, paddingTop: insets.top + 7, paddingLeft: insets.left + 18, paddingRight: insets.right + 18, backgroundColor: colors.header, borderBottomColor: '#ffffff12' }]}>
        {backHref ? (
          <Pressable onPress={onBack ?? (() => router.replace(backHref as Href))} style={styles.backButton} accessibilityRole="button" accessibilityLabel="Volver">
            <ArrowLeft size={19} color={palette.gold} />
          </Pressable>
        ) : (
          <View style={styles.brandBadge}><Image source={brandMark} style={styles.brandImage} alt="LEGEND CLUB" accessibilityLabel="LEGEND CLUB" /></View>
        )}
        <View style={styles.brandCopy}>
          <Text numberOfLines={1} style={styles.brandName}>{backHref ? title : 'LEGEND CLUB'}</Text>
          <Text numberOfLines={1} style={styles.brandLocation}>{backHref ? roleLabel : 'BARBERÍA · LA PAZ'}</Text>
        </View>
        {showChat ? (
          <Pressable onPress={() => router.push((tabs[0]?.href.startsWith('/client') ? '/client/chat' : '/barber/chat') as Href)} style={styles.iconButton} accessibilityRole="button" accessibilityLabel="Abrir chat de soporte">
            <MessageCircle size={19} color={palette.gold} />
          </Pressable>
        ) : null}
      </View> : null}

      <Animated.ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.scrollContent, hasFloatingHeader && styles.immersiveScrollContent, { paddingTop: hasFloatingHeader ? floatingHeaderHeight : insets.top + 83, paddingBottom: insets.bottom + (tabs.length ? 112 : 28), paddingLeft: hasFloatingHeader ? 0 : insets.left + 16, paddingRight: hasFloatingHeader ? 0 : insets.right + 16 }]}
        refreshControl={onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} colors={[colors.accent]} progressViewOffset={hasFloatingHeader ? insets.top + 12 : insets.top + 76} /> : undefined}
        onScroll={onScroll}
        scrollEventThrottle={16}>
        <Animated.View entering={FadeIn.duration(260)} style={[styles.pageContent, hasFloatingHeader && styles.immersivePageContent]}>{children}</Animated.View>
      </Animated.ScrollView>

      {floatingHeader ? (
        <Animated.View pointerEvents="box-none" style={[styles.floatingHeader, { backgroundColor: colors.background }, floatingHeaderStyle]}>
          {floatingHeader(scrollY)}
        </Animated.View>
      ) : null}

      {tabs.length ? (
        <Animated.View style={[styles.tabBar, { left: 15 + insets.left, right: 15 + insets.right, bottom: Math.max(8, insets.bottom + 5), backgroundColor: colors.glassSurface, borderColor: colors.glassBorder }, navStyle]}>
          {tabs.map(({ key, label, href, icon: Icon }) => {
            const selected = key === activeTab;
            return (
              <Pressable key={key} onPress={() => router.replace(href as Href)} style={[styles.tab, selected && { backgroundColor: colors.accentSoft }]} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected }}>
                <View style={styles.tabIcon}>
                  <Icon size={20} color={selected ? colors.accent : colors.muted} strokeWidth={selected ? 2.3 : 1.7} />
                  {selected ? <View style={[styles.selectedMark, { backgroundColor: colors.accent }]} /> : null}
                </View>
                <Text numberOfLines={1} style={[styles.tabLabel, { color: selected ? colors.accent : colors.muted }]}>{label}</Text>
              </Pressable>
            );
          })}
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  topBar: { position: 'absolute', left: 0, right: 0, zIndex: 5, minHeight: 70, flexDirection: 'row', alignItems: 'center', gap: 11, paddingHorizontal: 18, paddingBottom: 9, borderBottomWidth: StyleSheet.hairlineWidth },
  brandBadge: { width: 39, height: 39, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: '#20242A', overflow: 'hidden' },
  brandImage: { width: 39, height: 39, resizeMode: 'cover' },
  backButton: { width: 39, height: 39, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: '#ffffff12', borderWidth: 1, borderColor: '#ffffff1a' },
  brandCopy: { flex: 1, minWidth: 0, gap: 3 },
  brandName: { color: '#f8f4ed', fontSize: 13, fontWeight: '900', letterSpacing: 1.1 },
  brandLocation: { color: '#9AA2AC', fontSize: 8, letterSpacing: 1.2, fontWeight: '700', textTransform: 'uppercase' },
  iconButton: { width: 40, height: 40, borderRadius: 14, backgroundColor: '#ffffff12', borderWidth: 1, borderColor: '#ffffff1a', alignItems: 'center', justifyContent: 'center' },
  scrollContent: { flexGrow: 1, paddingHorizontal: 16, maxWidth: 760, width: '100%', alignSelf: 'center' },
  immersiveScrollContent: { paddingHorizontal: 0 },
  floatingHeader: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 8, overflow: 'hidden', elevation: 8 },
  pageContent: { gap: 13 },
  immersivePageContent: { gap: 0 },
  tabBar: { position: 'absolute', left: 15, right: 15, minHeight: 72, paddingHorizontal: 5, paddingTop: 5, paddingBottom: 5, flexDirection: 'row', justifyContent: 'space-around', borderWidth: 1, borderRadius: 22, shadowColor: '#000', shadowOpacity: 0.24, shadowRadius: 15, shadowOffset: { width: 0, height: 5 }, elevation: 10 },
  tab: { flex: 1, minWidth: 42, alignItems: 'center', justifyContent: 'center', gap: 3, paddingHorizontal: 3, borderRadius: 16 },
  tabIcon: { minHeight: 25, justifyContent: 'center', alignItems: 'center' },
  selectedMark: { position: 'absolute', top: -6, width: 20, height: 3, borderRadius: 5 },
  tabLabel: { maxWidth: '100%', fontSize: 9, fontWeight: '700' },
});
