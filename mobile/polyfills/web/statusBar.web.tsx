import React from "react";
import {
  StatusBar as ExpoStatusBar,
  type StatusBarStyle,
  type StatusBarAnimation,
  type StatusBarProps,
} from "expo-status-bar";
import * as ExpoSB from "expo-status-bar";

export const StatusBar = React.forwardRef<any, StatusBarProps>(
  function StatusBar({ style = "auto", ...props }, ref) {
    return <ExpoStatusBar ref={ref} style={style} {...props} />;
  }
);

export const setStatusBarStyle = (style: StatusBarStyle, animated?: boolean) =>
  ExpoSB.setStatusBarStyle(style, animated);

export const setStatusBarHidden = (
  hidden: boolean,
  animation?: StatusBarAnimation
) => ExpoSB.setStatusBarHidden(hidden, animation);

export const setStatusBarBackgroundColor = (
  backgroundColor: string,
  animated?: boolean
) => ExpoSB.setStatusBarBackgroundColor(backgroundColor as any, animated);

export const setStatusBarNetworkActivityIndicatorVisible = (visible: boolean) =>
  ExpoSB.setStatusBarNetworkActivityIndicatorVisible(visible);

export const setStatusBarTranslucent = (translucent: boolean) =>
  ExpoSB.setStatusBarTranslucent(translucent);

export type { StatusBarStyle, StatusBarAnimation, StatusBarProps };
