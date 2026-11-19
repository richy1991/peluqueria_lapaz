import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import { useAppearance } from '@/lib/appearance';

/** Shared native card surface, using the active app palette. */
export function GlassSurface({
  children,
  style,
  radius = 16,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  radius?: number;
}) {
  const { colors } = useAppearance();
  return (
    <View style={[styles.surface, { backgroundColor: colors.surface, borderColor: colors.glassBorder, borderRadius: radius }, style]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  surface: {
    position: 'relative',
    overflow: 'hidden',
    borderWidth: 1,
    shadowColor: '#000000',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 1,
  },
});
