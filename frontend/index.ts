// src/theme/index.ts — Black & White Minimal Luxury Design System

export const Colors = {
  // Core palette
  black: '#000000',
  white: '#FFFFFF',

  // Grays
  gray100: '#111111',
  gray200: '#1A1A1A',
  gray300: '#222222',
  gray400: '#333333',
  gray500: '#555555',
  gray600: '#777777',
  gray700: '#999999',
  gray800: '#BBBBBB',
  gray900: '#DDDDDD',

  // Semantic
  background: '#000000',
  surface: '#111111',
  surfaceElevated: '#161616',
  border: '#222222',
  borderSubtle: '#1A1A1A',

  // Text
  textPrimary: '#FFFFFF',
  textSecondary: '#888888',
  textTertiary: '#555555',
  textInverse: '#000000',

  // Status
  success: '#22C55E',
  successDim: '#14532D',
  danger: '#EF4444',
  dangerDim: '#7F1D1D',
  warning: '#F59E0B',
  warningDim: '#78350F',
  info: '#3B82F6',

  // Glassmorphism
  glassBg: 'rgba(255,255,255,0.04)',
  glassBorder: 'rgba(255,255,255,0.08)',
  glassStrong: 'rgba(255,255,255,0.08)',

  // Overlays
  overlay30: 'rgba(0,0,0,0.3)',
  overlay60: 'rgba(0,0,0,0.6)',
  overlay80: 'rgba(0,0,0,0.8)',

  // Accent (subtle white glow)
  accent: '#FFFFFF',
  accentDim: 'rgba(255,255,255,0.15)',
} as const;

export const Typography = {
  // Font families (configure in app.json)
  fontDisplay: 'System', // Use custom font in production
  fontBody: 'System',
  fontMono: 'Courier New',

  // Sizes
  xs: 11,
  sm: 13,
  base: 15,
  md: 17,
  lg: 20,
  xl: 24,
  '2xl': 30,
  '3xl': 38,
  '4xl': 48,

  // Weights
  light: '300' as const,
  regular: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,

  // Letter spacing
  tight: -0.5,
  normal: 0,
  wide: 0.5,
  wider: 1,
  widest: 2,
} as const;

export const Spacing = {
  '0': 0,
  '1': 4,
  '2': 8,
  '3': 12,
  '4': 16,
  '5': 20,
  '6': 24,
  '8': 32,
  '10': 40,
  '12': 48,
  '16': 64,
  '20': 80,
} as const;

export const BorderRadius = {
  none: 0,
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  '2xl': 20,
  '3xl': 28,
  full: 9999,
} as const;

export const Shadows = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
    elevation: 3,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.9,
    shadowRadius: 8,
    elevation: 6,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 1,
    shadowRadius: 16,
    elevation: 12,
  },
  glow: {
    shadowColor: '#FFFFFF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
} as const;

export const Animation = {
  fast: 150,
  normal: 250,
  slow: 400,
  spring: {
    damping: 20,
    stiffness: 200,
    mass: 0.8,
  },
  springGentle: {
    damping: 25,
    stiffness: 120,
    mass: 1,
  },
} as const;

// Glassmorphism card style
export const GlassCard = {
  backgroundColor: Colors.glassBg,
  borderWidth: 1,
  borderColor: Colors.glassBorder,
  borderRadius: BorderRadius['2xl'],
  ...Shadows.md,
} as const;
