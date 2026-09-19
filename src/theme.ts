/**
 * DutchUp design tokens ("Delft": porcelain ground, Delft-navy surfaces, cobalt links,
 * small orange accents). Values are copied 1:1 from the approved design.
 */
export const colors = {
  bg: '#F4F3EE', // porcelain
  surface: '#FFFFFF',
  ink: '#1C140D',
  muted: '#7A6A58',
  line: '#E3E2DA',
  ctrl: '#9C8B76', // borders of inputs / chips / outline buttons
  deep: '#4A2A14', // saddle brown (was Delft navy)
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
  // "Ledger Leather" treatment — warm, tactile, on-theme with DutchUp as a shared ledger.
  // Used for cards and buttons (flat, no gradient); Hero/auth screens stay on `deep`.
  leather: '#D6A579', // light cognac
  leatherThread: 'rgba(58,28,10,0.4)',
} as const;

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
