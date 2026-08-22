import { SplashScreen } from 'expo-router/build/exports';
import * as Updates from 'expo-updates';
import React, { type ReactNode, useCallback, useEffect } from 'react';
import { Platform, View } from 'react-native';
import { Button, SharedErrorBoundary } from './SharedErrorBoundary';

type ErrorBoundaryState = { hasError: boolean; error: unknown | null };

const DeviceErrorBoundary = () => {
  useEffect(() => {
    SplashScreen.hideAsync().catch(() => {});
  }, []);
  const handleReload = useCallback(async () => {
    if (Platform.OS === 'web') {
      window.location.reload();
      return;
    }

    Updates.reloadAsync().catch(() => {
      // no-op, we don't want to show an error here
    });
  }, []);
  return (
    <SharedErrorBoundary
      isOpen
      description="It looks like an error occurred while trying to use your app. Please contact support if the problem continues."
    >
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Button color="primary" onPress={handleReload}>
          Restart app
        </Button>
      </View>
    </SharedErrorBoundary>
  );
};

export class DeviceErrorBoundaryWrapper extends React.Component<
  {
    children: ReactNode;
  },
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { hasError: false, error: null };

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: unknown, errorInfo: React.ErrorInfo): void {
    console.error(error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return <DeviceErrorBoundary />;
    }
    return this.props.children;
  }
}
