const { getDefaultConfig } = require('expo/metro-config');
const path = require('node:path');
const fs = require('node:fs');
const { FileStore } = require('metro-cache');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

config.maxWorkers = 6;

// Expo's default blockList only excludes __tests__/ folders -- this
// project colocates tests next to their source instead (*.test.jsx), which
// Expo Router's file-based routing otherwise picks up as real routes and
// tries to bundle, pulling in @testing-library/react-native (a
// Node-only-compatible test dependency) into the app bundle itself.
config.resolver.blockList = [...config.resolver.blockList, /\.test\.(js|jsx|ts|tsx)$/];

const WEB_ALIASES = {
  'expo-secure-store': path.resolve(__dirname, './polyfills/web/secureStore.web.ts'),
  'react-native-webview': path.resolve(__dirname, './polyfills/web/webview.web.tsx'),
  'react-native-safe-area-context': path.resolve(
    __dirname,
    './polyfills/web/safeAreaContext.web.jsx'
  ),
  'react-native-maps': path.resolve(__dirname, './polyfills/web/maps.web.jsx'),
  'react-native-web/dist/exports/SafeAreaView': path.resolve(
    __dirname,
    './polyfills/web/SafeAreaView.web.jsx'
  ),
  'react-native-web/dist/exports/Alert': path.resolve(__dirname, './polyfills/web/alerts.web.tsx'),
  'react-native-web/dist/exports/RefreshControl': path.resolve(
    __dirname,
    './polyfills/web/refreshControl.web.tsx'
  ),
  'expo-status-bar': path.resolve(__dirname, './polyfills/web/statusBar.web.tsx'),
  'expo-location': path.resolve(__dirname, './polyfills/web/location.web.ts'),
  './layouts/Tabs': path.resolve(__dirname, './polyfills/web/tabbar.web.jsx'),
  'expo-notifications': path.resolve(__dirname, './polyfills/web/notifications.web.tsx'),
  'expo-contacts': path.resolve(__dirname, './polyfills/web/contacts.web.ts'),
  'expo-font': path.resolve(__dirname, './polyfills/web/expo-font.web.ts'),
  'react-native-google-mobile-ads': path.resolve(
    __dirname,
    './polyfills/web/google-mobile-ads.web.tsx'
  ),
  'react-native-web/dist/exports/ScrollView': path.resolve(
    __dirname,
    './polyfills/web/scrollview.web.jsx'
  ),
};
const NATIVE_ALIASES = {
  './Libraries/Components/TextInput/TextInput': path.resolve(
    __dirname,
    './polyfills/native/textinput.native.jsx'
  ),
};
const SHARED_ALIASES = {
  'expo-image': path.resolve(__dirname, './polyfills/shared/expo-image.tsx'),
};
config.watchFolders = [...config.watchFolders, path.resolve(__dirname, '../shared')];

// tsconfig.json maps "react" -> ./node_modules/@types/react so TypeScript
// can resolve `react`'s types from ../shared's files (they sit outside any
// node_modules ancestor, so Node-style resolution alone can't find it).
// Metro (via expo/metro-config) also follows tsconfig `paths` for *runtime*
// resolution, which picks up that same mapping -- but @types/react is a
// types-only package with no real `main` entry, so bundling a real import
// through it fails. Force `react` back to the actual package here,
// regardless of what tsconfig says, so both tools get what they need.
const REACT_MODULE_PATH = path.resolve(__dirname, 'node_modules/react');

// Add web-specific alias configuration through resolveRequest
config.resolver.resolveRequest = (context, moduleName, platform) => {
  // Applies everywhere, including polyfills below -- every importer needs
  // the real `react`, not whatever tsconfig's `paths` would otherwise send
  // it to.
  if (moduleName === 'react') {
    return context.resolveRequest(context, REACT_MODULE_PATH, platform);
  }
  // Polyfills are not resolved by Metro
  if (
    context.originModulePath.startsWith(`${__dirname}/polyfills/native`) ||
    context.originModulePath.startsWith(`${__dirname}/polyfills/web`) ||
    context.originModulePath.startsWith(`${__dirname}/polyfills/shared`)
  ) {
    return context.resolveRequest(context, moduleName, platform);
  }
  // Wildcard alias for Expo Google Fonts
  if (moduleName.startsWith('@expo-google-fonts/') && moduleName !== '@expo-google-fonts/dev') {
    return context.resolveRequest(context, '@expo-google-fonts/dev', platform);
  }
  if (SHARED_ALIASES[moduleName] && !moduleName.startsWith('./polyfills/')) {
    return context.resolveRequest(context, SHARED_ALIASES[moduleName], platform);
  }
  if (platform === 'web') {
    // Only apply aliases if the module is one of our polyfills
    if (WEB_ALIASES[moduleName] && !moduleName.startsWith('./polyfills/')) {
      return context.resolveRequest(context, WEB_ALIASES[moduleName], platform);
    }
    return context.resolveRequest(context, moduleName, platform);
  }

  if (NATIVE_ALIASES[moduleName] && !moduleName.startsWith('./polyfills/')) {
    return context.resolveRequest(context, NATIVE_ALIASES[moduleName], platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

const cacheDir = path.join(__dirname, 'caches');

config.cacheStores = () => [
  new FileStore({
    root: path.join(cacheDir, '.metro-cache'),
  }),
];
config.resetCache = false;
config.fileMapCacheDirectory = cacheDir;

const originalGetTransformOptions = config.transformer.getTransformOptions;

config.transformer = {
  ...config.transformer,
  getTransformOptions: async (entryPoints, options) => {
    if (options.dev === false) {
      fs.rmSync(cacheDir, { recursive: true, force: true });
      fs.mkdirSync(cacheDir);
    }
    return await originalGetTransformOptions(entryPoints, options);
  },
};

module.exports = config;
