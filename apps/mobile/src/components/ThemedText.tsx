import { Text as NativeText, StyleSheet } from 'react-native';
import type { TextProps, TextStyle, StyleProp } from 'react-native';
import { useAppearance } from '@/lib/appearance';

type Props = TextProps & { style?: StyleProp<TextStyle> };

export function ThemedText({ style, ...props }: Props) {
  const { colors } = useAppearance();
  const flattened = StyleSheet.flatten(style);
  const sourceColor = flattened?.color;
  let resolvedColor = sourceColor;
  const sourceHex = typeof sourceColor === 'string' ? sourceColor.toLowerCase() : '';
  // Explicit pure white is used for text over dark images and accent buttons;
  // keep it white instead of remapping it to the current theme's body text.
  if (!sourceColor || ['#f7f0e7', '#fffaf1', '#f2f4f7'].includes(sourceHex)) resolvedColor = colors.text;
  else if (['#afa296', '#b9b0a3', '#d1c5b7', '#9aa2ac'].includes(sourceHex)) resolvedColor = colors.muted;
  else if (['#d7dde5', '#aeb8c5'].includes(sourceHex)) resolvedColor = colors.accent;
  return <NativeText {...props} style={[style, { color: resolvedColor }]} />;
}
