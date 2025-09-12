/**
 * Glass Morphism Design System
 * Yhtenäiset tyylimäärittelyt koko sovellukselle
 * 
 * Käyttö:
 * import { GLASS_STYLES, GLASS_COLORS, GLASS_ANIMATIONS } from '$lib/styles/glass-morphism';
 */

// ===== PERUS GLASS MORPHISM LUOKAT =====
export const GLASS_STYLES = {
  // Pääkortit ja kontainerit
  card: "bg-white/90 dark:bg-surface-900/90 backdrop-blur-lg rounded-2xl shadow-xl border border-white/20 dark:border-white/10",
  
  // Kevyemmät kortit (sisäkkäiset elementit)
  cardLight: "bg-white/50 dark:bg-surface-800/50 backdrop-blur-sm rounded-xl border border-white/30",
  
  // Navigaatio ja valikot
  nav: "bg-white/90 dark:bg-surface-900/90 backdrop-blur-lg rounded-2xl shadow-xl border border-white/20 dark:border-white/10",
  
  // Modaalit ja popupit
  modal: "bg-white/95 dark:bg-surface-900/95 backdrop-blur-lg rounded-2xl shadow-2xl border border-white/20 dark:border-white/10",
  modalBackdrop: "fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm",
  
  // Lomakeelementit
  input: "px-4 py-3 bg-white/50 dark:bg-surface-800/50 backdrop-blur-sm rounded-xl border border-white/30 focus:ring-2 focus:ring-primary-500 focus:outline-none transition-all duration-300",
  select: "px-4 py-3 bg-white/50 dark:bg-surface-800/50 backdrop-blur-sm rounded-xl border border-white/30 focus:ring-2 focus:ring-primary-500 focus:outline-none transition-all duration-300",
  
  // Painikkeet
  button: "px-6 py-3 backdrop-blur-sm rounded-xl border border-white/30 transition-all duration-300 hover:scale-[1.02] hover:shadow-lg",
  buttonPrimary: "px-6 py-3 bg-primary-500/80 text-white rounded-xl backdrop-blur-sm transition-all duration-300 hover:scale-[1.02] hover:shadow-lg border border-white/30",
  buttonSecondary: "px-6 py-3 bg-secondary-500/80 text-white rounded-xl backdrop-blur-sm transition-all duration-300 hover:scale-[1.02] hover:shadow-lg border border-white/30",
  buttonGhost: "px-6 py-3 bg-white/20 dark:bg-surface-800/50 backdrop-blur-sm rounded-xl border border-white/30 hover:bg-white/30 dark:hover:bg-surface-700/60 transition-all duration-300 hover:scale-[1.02] hover:shadow-lg",
  
  // Valintapainikkeet (toggle)
  toggleSelected: "bg-primary-500/80 text-white shadow-lg scale-[1.02]",
  toggleUnselected: "bg-white/20 dark:bg-surface-800/50 hover:bg-white/30 dark:hover:bg-surface-700/60 scale-95 shadow-inner",
} as const;

// ===== TAUSTAKUVIOT JA FLOATING ELEMENTIT =====
export const GLASS_BACKGROUNDS = {
  // Pääkontaineri gradientilla
  main: "relative min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 dark:from-gray-900 dark:to-blue-900",
  
  // Floating particles (sisällytettävä fixed inset-0 z-0 overflow-hidden pointer-events-none containeriin)
  floatingParticles: `
    <div class="absolute top-20 left-20 w-32 h-32 bg-blue-400/20 rounded-full blur-xl animate-pulse"></div>
    <div class="absolute top-40 right-32 w-24 h-24 bg-purple-400/20 rounded-full blur-lg animate-bounce"></div>
    <div class="absolute bottom-40 left-16 w-40 h-40 bg-pink-400/20 rounded-full blur-xl animate-pulse"></div>
    <div class="absolute bottom-20 right-20 w-28 h-28 bg-green-400/20 rounded-full blur-lg animate-bounce"></div>
    <div class="absolute top-1/2 left-1/3 w-20 h-20 bg-yellow-400/20 rounded-full blur-md animate-pulse"></div>
  `,
  
  // Content z-index
  contentLayer: "relative z-10",
} as const;

// ===== VÄRIT JA TEEMOITUS =====
export const GLASS_COLORS = {
  // Gradientit otsikoille
  titleGradient: "bg-gradient-to-r from-primary-500 to-secondary-500 bg-clip-text text-transparent",
  
  // Pelaajan värit (tietokannasta)
  playerColors: {
    default: "#3b82f6",
    // Lisää muita värejä tarpeen mukaan
  },
  
  // Virheiden korostukset
  error: "border-red-400/50 shadow-red-400/20",
  errorButton: "bg-red-500/80 text-white hover:bg-red-600/80",
  
  // Onnistumisen korostukset
  success: "border-green-400/50 shadow-green-400/20",
  successText: "text-green-500",
  
  // Tekstivärit
  textSecondary: "text-surface-600 dark:text-surface-400",
} as const;

// ===== ANIMAATIOT JA SIIRTYMÄT =====
export const GLASS_ANIMATIONS = {
  // Perussiirtymät
  transition: "transition-all duration-300",
  
  // Hover-efektit
  hoverScale: "hover:scale-[1.02]",
  hoverShadow: "hover:shadow-lg",
  
  // Valittu/ei-valittu tilat
  selected: "scale-[1.02]",
  unselected: "scale-95",
  
  // Loading-animaatio
  spinner: "animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500",
  
  // Floating-animaatiot
  pulse: "animate-pulse",
  bounce: "animate-bounce",
} as const;

// ===== LAYOUT JA SPACING =====
export const GLASS_LAYOUT = {
  // Kontainerit
  container: "max-w-7xl mx-auto px-4 py-6",
  section: "space-y-6",
  
  // Grid-layoutit
  statsGrid: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6",
  playerGrid: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6",
  categoryGrid: "grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3",
  roundGrid: "grid grid-cols-3 md:grid-cols-5 gap-3",
  
  // Flex-layoutit
  flexBetween: "flex justify-between items-center",
  flexCenter: "flex items-center justify-center",
  flexWrap: "flex flex-wrap gap-3",
  
  // Spacing
  padding: {
    card: "p-6",
    section: "p-6",
    modal: "p-6",
    button: "px-6 py-3",
    input: "px-4 py-3",
  },
  
  // Margins
  spacing: {
    small: "space-y-3",
    medium: "space-y-4",
    large: "space-y-6",
  },
} as const;

// ===== RESPONSIVE BREAKPOINTS =====
export const GLASS_RESPONSIVE = {
  // Mobile first approach
  mobile: "block", // default
  tablet: "md:block",
  desktop: "lg:block",
  
  // Grid responsive
  gridCols: {
    auto: "grid-cols-1",
    mobile: "grid-cols-1",
    tablet: "md:grid-cols-2",
    desktop: "lg:grid-cols-3",
    wide: "xl:grid-cols-4",
  },
  
  // Text sizes
  text: {
    title: "text-2xl md:text-3xl",
    subtitle: "text-lg md:text-xl",
    body: "text-sm md:text-base",
  },
} as const;

// ===== UTILITY FUNCTIONS =====
export const glassUtils = {
  /**
   * Yhdistää glass-luokat yhteen
   */
  combine: (...classes: string[]) => classes.filter(Boolean).join(" "),
  
  /**
   * Luo glass-kortin perustyylit
   */
  card: (extra?: string) => glassUtils.combine(GLASS_STYLES.card, extra || ""),
  
  /**
   * Luo glass-painikkeen tyyli
   */
  button: (variant: 'primary' | 'secondary' | 'ghost' = 'ghost', extra?: string) => {
    const baseStyle = GLASS_STYLES.button;
    const variantStyle = {
      primary: "bg-primary-500/80 text-white",
      secondary: "bg-secondary-500/80 text-white", 
      ghost: "bg-white/20 dark:bg-surface-800/50 hover:bg-white/30 dark:hover:bg-surface-700/60"
    }[variant];
    return glassUtils.combine(baseStyle, variantStyle, extra || "");
  },
  
  /**
   * Luo toggle-painikkeen tyyli
   */
  toggle: (selected: boolean, extra?: string) => {
    const baseStyle = GLASS_STYLES.button;
    const stateStyle = selected ? GLASS_STYLES.toggleSelected : GLASS_STYLES.toggleUnselected;
    return glassUtils.combine(baseStyle, stateStyle, extra || "");
  },
  
  /**
   * Luo lomakeelementin tyyli
   */
  input: (extra?: string) => glassUtils.combine(GLASS_STYLES.input, extra || ""),
  
  /**
   * Luo floating-tausta
   */
  floatingBackground: () => `
    <div class="fixed inset-0 z-0 overflow-hidden pointer-events-none">
      ${GLASS_BACKGROUNDS.floatingParticles}
    </div>
  `,
} as const;

// ===== KOMPONENTTIKOHTAISET TYYLIT =====
export const GLASS_COMPONENTS = {
  // Hero-kortti (etusivu)
  hero: {
    container: glassUtils.combine(GLASS_STYLES.card, "text-center", GLASS_LAYOUT.padding.card),
    title: glassUtils.combine("text-4xl md:text-6xl font-bold mb-4", GLASS_COLORS.titleGradient),
    subtitle: "text-lg md:text-xl mb-8 text-surface-600 dark:text-surface-400",
  },
  
  // Navigaatio
  navigation: {
    container: glassUtils.combine(GLASS_STYLES.nav, GLASS_LAYOUT.padding.section),
    tab: "px-6 py-3 rounded-xl border border-white/30 backdrop-blur-sm transition-all duration-300 hover:scale-[1.02]",
    tabActive: "bg-primary-500/80 text-white shadow-lg",
    tabInactive: "bg-white/20 dark:bg-surface-800/50 hover:bg-white/30 dark:hover:bg-surface-700/60",
  },
  
  // Pelaajan kortit
  player: {
    card: glassUtils.combine(GLASS_STYLES.card, GLASS_LAYOUT.padding.card),
    avatar: "w-16 h-16 rounded-full flex items-center justify-center text-white font-bold text-xl shadow-lg",
    name: "font-semibold text-lg",
    info: "text-sm text-surface-600 dark:text-surface-400",
  },
  
  // Kysymykset
  question: {
    card: glassUtils.combine(GLASS_STYLES.card, GLASS_LAYOUT.padding.card),
    header: "flex items-start justify-between gap-4 mb-4",
    title: "text-lg font-semibold mb-4 leading-tight",
    badge: "px-3 py-1 text-white text-sm rounded-lg",
  },
  
  // Tilastot
  stats: {
    card: glassUtils.combine(GLASS_STYLES.card, GLASS_LAYOUT.padding.card, "text-center"),
    icon: "text-4xl mb-3",
    value: "text-3xl font-bold mb-1",
    label: "text-sm text-surface-600 dark:text-surface-400",
  },
} as const;

// ===== KÄYTTÖESIMERKKEJÄ =====
export const GLASS_EXAMPLES = {
  // Peruskortti
  basicCard: `<div class="${GLASS_STYLES.card} ${GLASS_LAYOUT.padding.card}">Sisältö</div>`,
  
  // Painike
  primaryButton: `<button class="${glassUtils.button('primary')}">Klikkaa</button>`,
  
  // Lomake
  inputField: `<input class="${GLASS_STYLES.input}" placeholder="Kirjoita tähän...">`,
  
  // Toggle-painike
  toggleButton: `<button class="${glassUtils.toggle(true)}">Valittu</button>`,
  
  // Koko sivu floating-taustalla
  fullPage: `
    <div class="${GLASS_BACKGROUNDS.main}">
      ${glassUtils.floatingBackground()}
      <div class="${GLASS_BACKGROUNDS.contentLayer} ${GLASS_LAYOUT.container}">
        <div class="${GLASS_STYLES.card} ${GLASS_LAYOUT.padding.card}">
          <h1 class="${GLASS_COLORS.titleGradient} text-3xl font-bold">Otsikko</h1>
          <p>Sisältö tähän...</p>
        </div>
      </div>
    </div>
  `,
} as const;

// Type definitions for better TypeScript support
export type GlassStyleKey = keyof typeof GLASS_STYLES;
export type GlassColorKey = keyof typeof GLASS_COLORS;
export type GlassAnimationKey = keyof typeof GLASS_ANIMATIONS;
export type GlassLayoutKey = keyof typeof GLASS_LAYOUT;
export type ButtonVariant = 'primary' | 'secondary' | 'ghost';