/**
 * CulinAIre Kitchen design tokens.
 *
 * Two materials (paper + ink), one accent (copper), spice rack for status.
 * Source of truth: the design bundle's Surface.jsx PALETTE (chat transcript
 * line ~1849 confirms `paper: #F3EFE4` is the user's final iterated value).
 * The bundle's `colors_and_type.css` is stale (`--paper: #E8E2D6`).
 *
 * Use semantic tokens from `theme` in product code. Reach into `palette`
 * only when defining new semantic tokens or in test fixtures.
 */
import type { TextStyle } from 'react-native';
import { Platform } from 'react-native';
// Easing comes from Reanimated, not react-native: it's used inside
// `withTiming` worklets in CopperButton / GhostButton, and worklets
// require the worklet-compatible Easing implementation from Reanimated.
import { Easing } from 'react-native-reanimated';

export const palette = {
  paper: '#F3EFE4',
  paperDeep: '#E8E2D6',
  paperEdge: '#C9C2B3',
  paperSoft: '#F8F4EA',

  ink: '#101418',
  inkSoft: '#2A2F36',
  inkMuted: '#6B6F76',
  inkFaint: '#A8A39A',

  copper: '#B87840',
  copperDeep: '#8A5530',
  copperBright: '#D89868',
  copperTint: '#F0E0CE',

  ember: '#C24A28',
  herb: '#3F5B3A',
  saffron: '#D9A441',

  textOnInk: '#EDE6D7',
  textOnCopper: '#FFF7EC',
} as const;

export const theme = {
  bg: palette.paper,
  bgElev: palette.paperDeep,
  bgSunk: '#DDD6C7',
  surface: palette.paperDeep,
  surface2: '#F2EDE3',
  border: palette.paperEdge,
  borderStrong: '#B7AE9C',

  text: palette.ink,
  textSoft: palette.inkSoft,
  textMuted: palette.inkMuted,
  textFaint: palette.inkFaint,
  textOnInk: palette.textOnInk,
  textOnCopper: palette.textOnCopper,

  accent: palette.copper,
  accentHover: palette.copperBright,
  accentPress: palette.copperDeep,
  accentSoft: palette.copperTint,

  positive: palette.herb,
  warning: palette.saffron,
  danger: palette.ember,
} as const;

export const fonts = {
  display: 'Fraunces_600SemiBold',
  displayBold: 'Fraunces_700Bold',
  body: 'Fraunces_400Regular',
  bodyMedium: 'Fraunces_500Medium',
  ui: 'Inter_500Medium',
  uiBold: 'Inter_600SemiBold',
  script: 'Caveat_600SemiBold',
} as const;

/**
 * Typography scale matching the bundle's CSS tokens
 * (`colors_and_type.css` lines 62-75).
 */
export const type = {
  display: { fontFamily: fonts.displayBold, fontSize: 56, lineHeight: 56 * 1.02 } as TextStyle,
  h1: { fontFamily: fonts.display, fontSize: 36, lineHeight: 36 * 1.08 } as TextStyle,
  h2: { fontFamily: fonts.display, fontSize: 28, lineHeight: 28 * 1.15 } as TextStyle,
  h3: { fontFamily: fonts.display, fontSize: 22, lineHeight: 22 * 1.2 } as TextStyle,
  h4: { fontFamily: fonts.display, fontSize: 18, lineHeight: 18 * 1.25 } as TextStyle,
  body: { fontFamily: fonts.body, fontSize: 16, lineHeight: 16 * 1.45 } as TextStyle,
  bodySm: { fontFamily: fonts.body, fontSize: 14, lineHeight: 14 * 1.45 } as TextStyle,
  ui: { fontFamily: fonts.ui, fontSize: 15, lineHeight: 15 * 1.3 } as TextStyle,
  uiSm: { fontFamily: fonts.ui, fontSize: 13, lineHeight: 13 * 1.3 } as TextStyle,
  caption: { fontFamily: fonts.ui, fontSize: 12, lineHeight: 12 * 1.3 } as TextStyle,
  eyebrow: {
    fontFamily: fonts.uiBold,
    fontSize: 11,
    lineHeight: 11 * 1.1,
    letterSpacing: 11 * 0.16,
    textTransform: 'uppercase',
  } as TextStyle,
  script: { fontFamily: fonts.script, fontSize: 36, lineHeight: 36 } as TextStyle,
} as const;

export const spacing = {
  s1: 4,
  s2: 8,
  s3: 12,
  s4: 16,
  s5: 20,
  s6: 24,
  s8: 32,
  s10: 40,
  s14: 56,
  s20: 80,
} as const;

export const radii = {
  xs: 6,
  sm: 10,
  md: 16,
  lg: 24,
  xl: 32,
  pill: 999,
} as const;

/**
 * Warm shadows cast through ink, never pure black.
 * Translated from CSS `box-shadow` per token to RN's split shadow props
 * (iOS) + `elevation` (Android). Android elevation differs from iOS
 * shadow rendering — verify on Moto G86 Power and tune if needed.
 */
export const shadows = {
  e0: {},
  e1: Platform.select({
    ios: {
      shadowColor: palette.ink,
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.06,
      shadowRadius: 2,
    },
    android: { elevation: 1 },
    default: {},
  }),
  e2: Platform.select({
    ios: {
      shadowColor: palette.ink,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.18,
      shadowRadius: 9,
    },
    android: { elevation: 4 },
    default: {},
  }),
  e3: Platform.select({
    ios: {
      shadowColor: palette.ink,
      shadowOffset: { width: 0, height: 18 },
      shadowOpacity: 0.3,
      shadowRadius: 20,
    },
    android: { elevation: 12 },
    default: {},
  }),
  ring: {
    shadowColor: palette.copper,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
  },
} as const;

export const motion = {
  durations: { micro: 160, base: 240, page: 360 },
  easing: Easing.bezier(0.2, 0.7, 0.2, 1),
  easingOut: Easing.bezier(0.16, 1, 0.3, 1),
} as const;

export const layout = {
  tap: 44,
} as const;
