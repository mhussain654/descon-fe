import 'react-native-url-polyfill/auto';
global.Buffer = require('buffer').Buffer;

import '@expo/metro-runtime';
import { renderRootComponent } from 'expo-router/build/renderRootComponent';
import { AppRegistry } from 'react-native';
import { DeviceErrorBoundaryWrapper } from './__create/DeviceErrorBoundary';
import App from './entrypoint';

AppRegistry.setWrapperComponentProvider(() => ({ children }) => {
  return <DeviceErrorBoundaryWrapper>{children}</DeviceErrorBoundaryWrapper>;
});

renderRootComponent(App);
