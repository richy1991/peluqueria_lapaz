import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { router, type Href } from 'expo-router';
import { Image, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { Easing, Extrapolation, FadeIn, FadeInDown, interpolate, useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import type { SharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { ArrowLeft, Globe2, MessageCircle } from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';

import salonHeader from '../../assets/images/salon-header.jpg';
import brandMark from '../../assets/images/legend-club-icon.png';
import { palette } from '@/components/ui';

export function useClientHeaderHeight(contentHeight: number) {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  return Math.max(Math.ceil(width / 1.5), insets.top + contentHeight);
}

export function FloatingPageHeader({
  scrollY, expandedHeight, title, eyebrow, description, compact = false, onBack, showChat = true,
  chatHref = '/client/chat',
  brandAccessory, actionLabel, actionIcon: ActionIcon = Globe2, onActionPress,
  expandedContentHeight = 124, titleSize = 31, titleLineHeight: configuredTitleLineHeight, descriptionFontSize = 14, descriptionLineHeight = 20,
}: {
  scrollY: SharedValue<number>;
  expandedHeight: number;
  title: string;
  eyebrow?: string;
  description: string;
  compact?: boolean;
  onBack?: () => void;
  showChat?: boolean;
  chatHref?: Href;
  brandAccessory?: ReactNode;
  actionLabel?: string;
  actionIcon?: LucideIcon;
  onActionPress?: () => void;
  expandedContentHeight?: number;
  titleSize?: number;
  titleLineHeight?: number;
  descriptionFontSize?: number;
  descriptionLineHeight?: number;
}) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const imageWidth = Math.max(width, Math.ceil(expandedHeight * 1.5));
  const textWidth = Math.max(0, width - 36);
  const textReveal = useSharedValue(0);
  const hasAction = Boolean(actionLabel && onActionPress);
  const titleLineHeight = configuredTitleLineHeight ?? Math.round(titleSize * 1.2);
  useEffect(() => {
    // Reanimated shared values must be updated from this animation effect.
    // eslint-disable-next-line react-hooks/immutability
    textReveal.value = withDelay(150, withTiming(1, { duration: 720, easing: Easing.out(Easing.cubic) }));
  }, [textReveal]);
  const imageStyle = useAnimatedStyle(() => ({ transform: [{ translateX: width - imageWidth }, { translateY: interpolate(scrollY.value, [0, 160], [0, -28], Extrapolation.CLAMP) }] }));
  const textRevealStyle = useAnimatedStyle(() => ({ width: interpolate(textReveal.value, [0, 1], [0, textWidth], Extrapolation.CLAMP) }));
  const logoStyle = useAnimatedStyle(() => {
    const progress = compact ? 1 : interpolate(scrollY.value, [0, 160], [0, 1], Extrapolation.CLAMP);
    const size = interpolate(progress, [0, 1], [42, 31]);
    return { width: size, height: size, borderRadius: interpolate(progress, [0, 1], [11, 9]) };
  });
  const locationStyle = useAnimatedStyle(() => {
    const progress = compact ? 1 : interpolate(scrollY.value, [0, 100], [0, 1], Extrapolation.CLAMP);
    return { opacity: 1 - progress, height: interpolate(progress, [0, 1], [10, 0]), overflow: 'hidden' };
  });
  const contentStyle = useAnimatedStyle(() => {
    const progress = compact ? 1 : interpolate(scrollY.value, [0, 160], [0, 1], Extrapolation.CLAMP);
    return { height: interpolate(progress, [0, 1], [expandedContentHeight, 24]), marginTop: interpolate(progress, [0, 1], [20, 3]), overflow: 'hidden' };
  });
  const eyebrowStyle = useAnimatedStyle(() => {
    const progress = compact ? 1 : interpolate(scrollY.value, [0, 80], [0, 1], Extrapolation.CLAMP);
    return { opacity: 1 - progress, height: interpolate(progress, [0, 1], [12, 0]), overflow: 'hidden' };
  });
  const titleStyle = useAnimatedStyle(() => {
    const progress = compact ? 1 : interpolate(scrollY.value, [0, 160], [0, 1], Extrapolation.CLAMP);
    return { fontSize: interpolate(progress, [0, 1], [titleSize, 17]), lineHeight: interpolate(progress, [0, 1], [titleLineHeight, 21]) };
  });
  const descriptionStyle = useAnimatedStyle(() => {
    const progress = compact ? 1 : interpolate(scrollY.value, [0, 90], [0, 1], Extrapolation.CLAMP);
    return { opacity: 1 - progress, height: interpolate(progress, [0, 1], [descriptionLineHeight * 2, 0]), marginTop: interpolate(progress, [0, 1], [6, 0]), overflow: 'hidden' };
  });
  const accessoryStyle = useAnimatedStyle(() => ({
    width: interpolate(scrollY.value, [0, 90], [112, 0], Extrapolation.CLAMP),
    opacity: interpolate(scrollY.value, [0, 70], [1, 0], Extrapolation.CLAMP),
    overflow: 'hidden',
  }));
  const actionStyle = useAnimatedStyle(() => {
    const progress = compact ? 1 : interpolate(scrollY.value, [0, 100], [0, 1], Extrapolation.CLAMP);
    return { opacity: 1 - progress, height: interpolate(progress, [0, 1], [34, 0]), marginTop: interpolate(progress, [0, 1], [14, 0]), overflow: 'hidden' };
  });

  return <View pointerEvents="box-none" style={styles.hero}>
    <Animated.Image pointerEvents="none" source={salonHeader} resizeMode="cover" entering={FadeIn.duration(420)} style={[styles.heroImage, { width: imageWidth, height: expandedHeight }, imageStyle]} alt="Interior de LEGEND CLUB" accessibilityLabel="Interior de LEGEND CLUB" />
    <Svg pointerEvents="none" style={StyleSheet.absoluteFill} width="100%" height="100%">
      <Defs><LinearGradient id="client-page-hero-shade" x1="0%" y1="0%" x2="0%" y2="100%">
        <Stop offset="0%" stopColor="#0d0d0d" stopOpacity="0.72" />
        <Stop offset="45%" stopColor="#0d0d0d" stopOpacity="0.69" />
        <Stop offset="100%" stopColor="#0d0d0d" stopOpacity="0.92" />
      </LinearGradient></Defs>
      <Rect x="0" y="0" width="100%" height="100%" fill="url(#client-page-hero-shade)" />
    </Svg>
    <Animated.View entering={FadeInDown.delay(80).duration(360)} style={[styles.top, compact && styles.compactTop, { paddingTop: insets.top + 9 }]}>
      {onBack ? <Pressable onPress={onBack} style={styles.backButton} accessibilityRole="button" accessibilityLabel="Volver"><ArrowLeft size={18} color={palette.gold} /></Pressable> : null}
      {compact ? <View style={styles.compactHeading}><Animated.Text numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.72} style={[styles.title, styles.compactTitle]}>{title}</Animated.Text></View> : <View style={styles.brand}>
        <Animated.View style={[styles.badge, logoStyle]}><Image source={brandMark} style={styles.brandImage} alt="Logo LEGEND CLUB" accessibilityLabel="Logo LEGEND CLUB" /></Animated.View>
        <View style={styles.brandCopy}>
          <Animated.Text numberOfLines={1} style={styles.brandName}>LEGEND CLUB</Animated.Text>
          <Animated.View style={locationStyle}><Animated.Text numberOfLines={1} style={styles.location}>BARBERÍA · LA PAZ</Animated.Text></Animated.View>
        </View>
      </View>}
      {brandAccessory ? <Animated.View pointerEvents="none" style={[styles.brandAccessory, accessoryStyle]}>{brandAccessory}</Animated.View> : null}
      {showChat ? <Pressable onPress={() => router.push(chatHref)} style={styles.chatButton} accessibilityRole="button" accessibilityLabel="Abrir chat de soporte">
        <MessageCircle size={20} color={palette.gold} />
      </Pressable> : null}
    </Animated.View>
    {!compact ? <Animated.View entering={FadeInDown.delay(190).duration(380)} style={[styles.content, contentStyle]}>
      <Animated.View style={[styles.textReveal, textRevealStyle]}>
        <View style={{ width: textWidth }}>
          {eyebrow ? <Animated.View style={eyebrowStyle}><Animated.Text numberOfLines={1} style={styles.eyebrow}>{eyebrow}</Animated.Text></Animated.View> : null}
          <Animated.Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.72} style={[styles.title, titleStyle]}>{title}</Animated.Text>
          {description ? <Animated.View style={[styles.descriptionClip, descriptionStyle]}><Animated.Text numberOfLines={2} style={[styles.description, { fontSize: descriptionFontSize, lineHeight: descriptionLineHeight }]}>{description}</Animated.Text></Animated.View> : null}
          {hasAction ? <Animated.View style={actionStyle}><Pressable style={styles.actionLink} onPress={onActionPress} accessibilityRole="link">
            <ActionIcon size={17} color={palette.gold} />
            <Animated.Text style={styles.actionLabel}>{actionLabel}</Animated.Text>
          </Pressable></Animated.View> : null}
        </View>
      </Animated.View>
    </Animated.View> : null}
  </View>;
}

export const ClientPageHeader = FloatingPageHeader;

const styles = StyleSheet.create({
  hero: { flex: 1, width: '100%', overflow: 'hidden', borderBottomLeftRadius: 22, borderBottomRightRadius: 22, backgroundColor: '#090a0c' },
  heroImage: { position: 'absolute', top: 0, left: 0 },
  top: { paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', gap: 10 },
  compactTop: { flex: 1 },
  compactHeading: { flex: 1, minWidth: 0, justifyContent: 'center' },
  backButton: { width: 37, height: 37, alignItems: 'center', justifyContent: 'center', borderRadius: 13, borderWidth: 1, borderColor: '#D7DDE570', backgroundColor: '#11141899' },
  brand: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 9 },
  brandAccessory: { maxWidth: 112, flexShrink: 0 },
  badge: { width: 42, height: 42, borderRadius: 11, overflow: 'hidden', borderWidth: 1, borderColor: '#fff9', backgroundColor: '#f4f0e6' },
  brandImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  brandCopy: { flex: 1, minWidth: 0, gap: 2 },
  brandName: { color: '#F8F4ED', fontSize: 12, fontWeight: '900', letterSpacing: 1.1 },
  location: { color: '#E5E7EB', fontSize: 7, fontWeight: '700', letterSpacing: 1 },
  chatButton: { width: 39, height: 39, alignItems: 'center', justifyContent: 'center', borderRadius: 14, borderWidth: 1, borderColor: '#D7DDE570', backgroundColor: '#11141899' },
  content: { width: '100%', paddingHorizontal: 18 },
  textReveal: { overflow: 'hidden' },
  eyebrow: { color: palette.gold, fontSize: 9, fontWeight: '900', letterSpacing: 2.1, lineHeight: 12 },
  title: { color: '#FFFFFF', fontSize: 31, lineHeight: 37, fontWeight: '900', letterSpacing: -0.9 },
  compactTitle: { fontSize: 21, lineHeight: 26, letterSpacing: -0.35 },
  descriptionClip: { width: '100%' },
  description: { maxWidth: 360, color: '#E5E7EB', fontSize: 14, lineHeight: 20 },
  actionLink: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 9, paddingVertical: 3 },
  actionLabel: { color: palette.gold, fontSize: 13, fontWeight: '800' },
});
