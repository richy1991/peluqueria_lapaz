import type { ConfigContext, ExpoConfig } from 'expo/config';

const googlePluginName = 'react-native-nitro-google-signin';

export default ({ config }: ConfigContext): ExpoConfig => {
  const iosUrlScheme = process.env.EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME?.trim()
    || 'com.googleusercontent.apps.google-ios-client-not-configured';
  const plugins = (config.plugins ?? []).filter((plugin) => {
    const pluginName = Array.isArray(plugin) ? plugin[0] : plugin;
    return pluginName !== googlePluginName;
  });

  return {
    ...config,
    plugins: [
      ...plugins,
      [googlePluginName, { iosUrlScheme }],
    ],
  } as ExpoConfig;
};
