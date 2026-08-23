// Canonical design tokens shared by web and mobile (MPS-F102).
//
// Web derives its Tailwind theme from these same values (see
// web/tailwind.config.js -- Tailwind's config loader runs in plain Node and
// cannot import this TypeScript module directly, so the literal values are
// mirrored there with a comment pointing back here). Mobile imports this
// module directly for its React Native StyleSheet-based components.
//
// Values mirror the approved prototype's existing visual language (see the
// dashboard/status pages' `#0066CC` brand blue, `#10B981` success green,
// `#F59E0B` warning amber, gray-200/500/900 neutrals) rather than inventing a
// new palette.

export const colors = {
  brand: {
    subtle: '#E6F2FF',
    default: '#0066CC',
    emphasis: '#0052A3',
    on: '#FFFFFF',
  },
  success: {
    subtle: '#E6F9F0',
    default: '#10B981',
    emphasis: '#047857',
    on: '#FFFFFF',
  },
  warning: {
    subtle: '#FFF7E6',
    default: '#F59E0B',
    emphasis: '#B45309',
    on: '#1A1A1A',
  },
  danger: {
    subtle: '#FEE2E2',
    default: '#DC2626',
    emphasis: '#991B1B',
    on: '#FFFFFF',
  },
  info: {
    subtle: '#E0F2FE',
    default: '#0284C7',
    emphasis: '#075985',
    on: '#FFFFFF',
  },
  text: {
    primary: '#111827',
    secondary: '#6B7280',
    tertiary: '#9CA3AF',
    disabled: '#C1C5CB',
    inverse: '#FFFFFF',
  },
  surface: {
    background: '#F8F9FA',
    raised: '#FFFFFF',
    sunken: '#F3F4F6',
    overlay: 'rgba(17, 24, 39, 0.5)',
  },
  border: {
    default: '#E5E7EB',
    strong: '#D1D5DB',
    focus: '#0066CC',
  },
} as const;

/** 4px-based scale, keyed to match Tailwind's default spacing scale so mobile and web stay numerically aligned without forcing a shared build step. */
export const spacing = {
  0: 0,
  0.5: 2,
  1: 4,
  1.5: 6,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
  10: 40,
  12: 48,
  16: 64,
  20: 80,
  24: 96,
} as const;

export const radii = {
  none: 0,
  sm: 8,
  md: 10,
  lg: 12,
  xl: 16,
  full: 9999,
} as const;

export const fontWeights = {
  regular: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
} as const;

/** Font size / line height pairs, both in px. */
export const typeScale = {
  caption: { fontSize: 12, lineHeight: 16 },
  bodySmall: { fontSize: 14, lineHeight: 20 },
  body: { fontSize: 16, lineHeight: 24 },
  bodyLarge: { fontSize: 18, lineHeight: 28 },
  heading3: { fontSize: 20, lineHeight: 28 },
  heading2: { fontSize: 24, lineHeight: 32 },
  heading1: { fontSize: 30, lineHeight: 38 },
  display: { fontSize: 36, lineHeight: 44 },
} as const;

/** Semantic stacking layers. Web maps these directly to CSS z-index; mobile only needs relative ordering for overlays it renders itself (dialogs, toasts). */
export const zIndex = {
  dropdown: 1000,
  sticky: 1100,
  fixed: 1200,
  overlay: 1300,
  modal: 1400,
  toast: 1600,
  tooltip: 1700,
} as const;

export const motion = {
  duration: {
    fast: 120,
    base: 200,
    slow: 320,
  },
  easing: {
    standard: 'cubic-bezier(0.4, 0, 0.2, 1)',
    decelerate: 'cubic-bezier(0, 0, 0.2, 1)',
    accelerate: 'cubic-bezier(0.4, 0, 1, 1)',
  },
} as const;

/** Mirrors Tailwind's default `screens` config; informative for mobile width checks, not used to reconfigure Tailwind on web. */
export const breakpoints = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  xxl: 1536,
} as const;

/** Minimum recommended touch target size in px (WCAG 2.1 SC 2.5.5 / iOS HIG). */
export const minTouchTarget = 44;

export type SemanticColor = 'brand' | 'success' | 'warning' | 'danger' | 'info';
