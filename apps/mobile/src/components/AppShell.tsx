import type { LucideIcon } from 'lucide-react-native';
import { ArrowLeft, ExternalLink, MessageCircle, Scissors } from 'lucide-react-native';
import { router, type Href } from 'expo-router';
import { Linking, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { publicSiteUrl } from '@/lib/links';
import { palette } from '@/components/ui';

export type AppTab = { key: string; label: string; href: string; icon: LucideIcon };

export function AppShell({
  title,
  roleLabel,
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
  return (
    <SafeAreaView style={styles.root} edges={['top', 'left', 'right']}>
      <View style={styles.topBar}>
        {backHref ? (
          <Pressable onPress={() => router.replace(backHref as Href)} style={styles.brandMark} accessibilityRole="button" accessibilityLabel="Volver">
            <ArrowLeft size={18} color={palette.gold} />
          </Pressable>
        ) : (
          <View style={styles.brandMark}><Scissors size={19} color={palette.gold} /></View>
        )}
        <View style={styles.brandCopy}>
          <Text style={styles.brandName}>LEGEND CLUB</Text>
          <Text style={styles.role} accessibilityLabel={`${roleLabel}: ${title}`}>{roleLabel}</Text>
        </View>
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

      <View style={styles.tabBar}>
        {tabs.map(({ key, label, href, icon: Icon }) => {
          const selected = key === activeTab;
          return (
            <Pressable key={key} onPress={() => router.replace(href as Href)} style={styles.tab} accessibilityRole="button" accessibilityState={{ selected }}>
              <Icon size={19} color={selected ? palette.gold : palette.muted} strokeWidth={selected ? 2.5 : 1.8} />
              <Text numberOfLines={1} style={[styles.tabLabel, selected && styles.tabLabelActive]}>{label}</Text>
            </Pressable>
          );
        })}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.background },
  topBar: { minHeight: 62, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', gap: 11, borderBottomColor: '#302720', borderBottomWidth: StyleSheet.hairlineWidth },
  brandMark: { width: 37, height: 37, alignItems: 'center', justifyContent: 'center', backgroundColor: '#32271d', borderRadius: 12, borderWidth: 1, borderColor: '#53432e' },
  brandCopy: { flex: 1, gap: 2 },
  brandName: { color: palette.text, fontSize: 12, fontWeight: '900', letterSpacing: 1.5 },
  role: { color: palette.muted, fontSize: 10, fontWeight: '600' },
  siteLink: { width: 38, height: 38, borderRadius: 12, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border, alignItems: 'center', justifyContent: 'center' },
  scrollContent: { paddingHorizontal: 17, paddingTop: 21, paddingBottom: 28, gap: 14, maxWidth: 760, width: '100%', alignSelf: 'center' },
  tabBar: { minHeight: 64, paddingHorizontal: 5, paddingTop: 7, paddingBottom: 4, flexDirection: 'row', justifyContent: 'space-around', borderTopColor: '#382e27', borderTopWidth: 1, backgroundColor: '#1b1714' },
  tab: { flex: 1, minWidth: 54, alignItems: 'center', justifyContent: 'center', gap: 4, paddingHorizontal: 3 },
  tabLabel: { maxWidth: '100%', color: palette.muted, fontSize: 9, fontWeight: '700' },
  tabLabelActive: { color: palette.gold },
});
