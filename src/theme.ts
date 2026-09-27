/**
 * DutchUp design tokens ("Delft" origins, now a warm cognac "Ledger Leather" palette).
 * `colors` is a single mutable object — every screen imports it once and reads
 * `colors.x` at render time. Switching theme mode mutates these same values in
 * place (see `applyColorScheme` in `lib/theme-context.tsx`) and forces one
 * remount at the root, so no screen needs to import a hook to stay theme-aware.
 */
type Palette = Record<string, string>;

const light: Palette = {
  bg: '#F4F3EE', // porcelain
  surface: '#FFFFFF',
  ink: '#1C140D',
  muted: '#7A6A58',
  line: '#E3E2DA',
  ctrl: '#9C8B76', // borders of inputs / chips / outline buttons
  deep: '#4A2A14', // saddle brown
  ivory: '#F6F3EA',
  onDeep: '#D9B99A',
  hairDeep: 'rgba(246,243,234,0.16)',
  cobalt: '#B8752F',
  cobaltLight: '#F0DCC4',
  orange: '#FF7A3D',
  green: '#0E7A52',
  greenTint: '#E3F3EB',
  greenDark: '#0B4F36',
  red: '#C0392B',
  mint: '#7EE2B5',
  coral: '#FF9E8F',
  tile: '#F3E4D3',
  tileFg: '#7A4A22',
  track: '#EDE3D6',
  motif: '#8A5A34',
  motifWelcome: '#B98455',
  // "Ledger Leather" treatment — cards and buttons (flat, no gradient); Hero/auth screens use `deep`.
  leather: '#D6A579',
  leatherThread: 'rgba(58,28,10,0.4)',
  // balanced/unbalanced strips (add-expense split + payer totals)
  balancedBg: '#E3F3EB',
  balancedFg: '#0B4F36',
  warnBg: '#FBE9E6',
  warnFg: '#C0392B',
};

const dark: Palette = {
  bg: '#17120C',
  surface: '#241A10',
  ink: '#F1E8DD',
  muted: '#B3A08A',
  line: '#3A2E20',
  ctrl: '#6E5A44',
  deep: '#5C371C',
  ivory: '#F6F3EA',
  onDeep: '#D9B99A',
  hairDeep: 'rgba(246,243,234,0.16)',
  cobalt: '#E3A05C',
  cobaltLight: 'rgba(227,160,92,0.18)',
  orange: '#FF8A54',
  green: '#2FAE81',
  greenTint: 'rgba(47,174,129,0.16)',
  greenDark: '#6FE3B8',
  red: '#FF9E8F',
  mint: '#7EE2B5',
  coral: '#FF9E8F',
  tile: '#3A2A18',
  tileFg: '#EAC79A',
  track: '#2C2115',
  motif: '#8A5A34',
  motifWelcome: '#B98455',
  leather: '#7A4E2A',
  leatherThread: 'rgba(255,230,200,0.35)',
  balancedBg: 'rgba(47,174,129,0.16)',
  balancedFg: '#6FE3B8',
  warnBg: 'rgba(255,158,143,0.16)',
  warnFg: '#FF9E8F',
};

export const palettes = { light, dark };

/** Mutable — do not destructure at module scope; read `colors.x` inside render/style so theme switches apply. */
export const colors: Palette = { ...light };

export function applyColorScheme(scheme: 'light' | 'dark') {
  Object.assign(colors, palettes[scheme]);
}

/** Font family names as registered by @expo-google-fonts (one family per weight on native). */
export const fonts = {
  serif: 'InstrumentSerif_400Regular',
  serifItalic: 'InstrumentSerif_400Regular_Italic',
  regular: 'Manrope_400Regular',
  medium: 'Manrope_500Medium',
  semibold: 'Manrope_600SemiBold',
  bold: 'Manrope_700Bold',
} as const;

export const radii = {
  hero: 22,
  card: 18,
  strip: 16,
  input: 12,
  button: 14,
  chip: 999,
} as const;

/** The design reserves 52 px at the top (status bar area is left empty). */
export const TOP_INSET = 52;
export const SIDE = 20;
export const FRAME_WIDTH = 390;
