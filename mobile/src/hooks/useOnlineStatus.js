import NetInfo from "@react-native-community/netinfo";
import { useEffect, useState } from "react";

/** Tracks device connectivity via NetInfo. Not wired into any screen yet. */
export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      setIsOnline(state.isConnected !== false && state.isInternetReachable !== false);
    });
    return unsubscribe;
  }, []);

  return isOnline;
}
