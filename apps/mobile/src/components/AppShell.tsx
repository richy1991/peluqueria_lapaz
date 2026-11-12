import type { LucideIcon } from 'lucide-react-native';
import { ArrowLeft, ExternalLink, MessageCircle, Scissors } from 'lucide-react-native';
import { router, type Href } from 'expo-router';
import { Image, Linking, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import brandMark from '../../assets/images/legend-club-icon.png';
import { publicSiteUrl } from '@/lib/links';
import { palette } from '@/components/ui';

export type AppTab = { key: string; label: string; href: string; icon: LucideIcon };

export function AppShell({
  title,
  activeTab,
  tabs,
  children,
  onRefresh,
  refreshing = false,
  backHref,
  showChat = true,
}: {
  title: string;
  roleLabel: string;
  activeTab?: string;
  tabs: AppTab[];
  children: React.ReactNode;
  onRefresh?: () => void;
  refreshing?: boolean;
  backHref?: string;
  showChat?: boolean;
}) {
  const chatHref = tabs[0]?.href.startsWith('/barber') ? '/barber/chat' : '/client/chat';
  const isClient = tabs[0]?.href.startsWith('/client');
  return (
    <SafeAreaView style={styles.root} edges={['top', 'left', 'right', 'bottom']}>
      <View style={styles.topBar}>
        {backHref ? (
          <Pressable onPress={() => router.replace(backHref as Href)} style={styles.brandBadge} accessibilityRole="button" accessibilityLabel="Volver">
            <ArrowLeft size={18} color={palette.gold} />
          </Pressable>
        ) : (
          <View style={styles.brandBadge}><Image source={brandMark} style={styles.brandImage} alt="LEGEND CLUB" accessibilityLabel="LEGEND CLUB" /></View>
        )}
        <View style={styles.brandCopy}>
          <Text style={styles.brandName}>LEGEND CLUB</Text>
          <Text style={styles.routeLabel} accessibilityLabel={title}>{title}</Text>
        </View>
        {isClient ? <Pressable onPress={() => router.push('/client/book-appointment')} style={styles.primaryQuickAction} accessibilityRole="button" accessibilityLabel="Reservar cita"><Scissors size={17} color="#17130e" /></Pressable> : null}
        {showChat ? <Pressable onPress={() => router.push(chatHref as Href)} style={styles.siteLink} accessibilityRole="button" accessibilityLabel="Abrir conversación con LEGEND CLUB"><MessageCircle size={17} color={palette.gold} /></Pressable> : null}
        <Pressable onPress={() => Linking.openURL(publicSiteUrl)} style={styles.siteLink} accessibilityRole="link" accessibilityLabel="Abrir sitio público">
          <ExternalLink size={16} color={palette.gold} />
        </Pressable>
      </View>

      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.scrollContent}
        refreshControl={onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={palette.gold} colors={[palette.gold]} /> : undefined}>
        {children}
      </ScrollView>

      {tabs.length ? <View style={styles.tabBar}>
        {tabs.map(({ key, label, href, icon: Icon }) => {
          const selected = key === activeTab;
          return (
            <Pressable key={key} onPress={() => router.replace(href as Href)} style={[styles.tab, selected && styles.tabActive]} accessibilityRole="button" accessibilityState={{ selected }}>
              <Animated.View key={selected ? 'selected' : 'idle'} entering={FadeIn.duration(180)} style={styles.tabIcon}>
                <Icon size={19} color={selected ? palette.gold : palette.muted} strokeWidth={selected ? 2.5 : 1.8} />
              </Animated.View>
              <Text numberOfLines={1} style={[styles.tabLabel, selected && styles.tabLabelActive]}>{label}</Text>
            </Pressable>
          );
        })}
      </View> : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.background },
  topBar: { minHeight: 67, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomColor: '#302720', borderBottomWidth: StyleSheet.hairlineWidth, backgroundColor: '#171310' },
  brandBadge: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f4ead8', borderRadius: 14, borderWidth: 1, borderColor: '#8f6b37', overflow: 'hidden' },
  brandImage: { width: 42, height: 42, resizeMode: 'cover' },
  brandCopy: { flex: 1, gap: 2 },
  brandName: { color: palette.text, fontSize: 12, fontWeight: '900', letterSpacing: 1.5 },
  routeLabel: { color: '#a79e92', fontSize: 10, fontWeight: '700' },
  siteLink: { width: 39, height: 39, borderRadius: 14, backgroundColor: '#241e19', borderWidth: 1, borderColor: '#4b3c2d', alignItems: 'center', justifyContent: 'center' },
  primaryQuickAction: { width: 40, height: 40, borderRadius: 14, backgroundColor: '#d9ad5d', alignItems: 'center', justifyContent: 'center', shadowColor: '#d9ad5d', shadowOpacity: 0.23, shadowRadius: 8, elevation: 3 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 26, gap: 12, maxWidth: 760, width: '100%', alignSelf: 'center' },
  tabBar: { minHeight: 69, marginHorizontal: 10, marginTop: 5, marginBottom: 5, paddingHorizontal: 5, paddingTop: 6, paddingBottom: 5, flexDirection: 'row', justifyContent: 'space-around', borderColor: '#463b2c', borderWidth: 1, borderRadius: 22, backgroundColor: '#211d19f5', shadowColor: '#000', shadowOpacity: 0.24, shadowRadius: 14, shadowOffset: { width: 0, height: -4 }, elevation: 8 },
  tab: { flex: 1, minWidth: 48, alignItems: 'center', justifyContent: 'center', gap: 3, paddingHorizontal: 3, borderRadius: 14 },
  tabActive: { backgroundColor: '#3a2f21' },
  tabIcon: { minHeight: 22, justifyContent: 'center', alignItems: 'center' },
  tabLabel: { maxWidth: '100%', color: palette.muted, fontSize: 10, fontWeight: '700' },
  tabLabelActive: { color: palette.gold },
});
