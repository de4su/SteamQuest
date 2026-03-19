/** Genre list used in the Quiz genre-selection step. */
export const GENRES = [
  'Action', 'RPG', 'Strategy', 'Indie', 'Adventure',
  'Simulation', 'Horror', 'Puzzle', 'Sports', 'Racing',
];

/**
 * Maps RAWG parent_platform slugs to a short display label with emoji icon.
 * Used in the Favorites tab to show all real gaming platforms, not DB sources.
 */
export const PLATFORM_ICONS: Record<string, string> = {
  pc:          '🖥️ PC',
  playstation: '🎮 PlayStation',
  xbox:        '🎮 Xbox',
  nintendo:    '🕹️ Nintendo',
  ios:         '📱 iOS',
  android:     '📱 Android',
  mac:         '🍎 macOS',
  linux:       '🐧 Linux',
  web:         '🌐 Web',
  atari:       '🕹️ Atari',
  sega:        '🕹️ SEGA',
};

/**
 * Maps country code (ISO 3166-1 alpha-2) to a flag emoji.
 * Only the most common codes are listed; others render as the code itself.
 */
export const COUNTRY_FLAGS: Record<string, string> = {
  US: '🇺🇸', GB: '🇬🇧', DE: '🇩🇪', FR: '🇫🇷', RU: '🇷🇺', CA: '🇨🇦',
  AU: '🇦🇺', BR: '🇧🇷', PL: '🇵🇱', NL: '🇳🇱', SE: '🇸🇪', NO: '🇳🇴',
  FI: '🇫🇮', DK: '🇩🇰', TR: '🇹🇷', ES: '🇪🇸', IT: '🇮🇹', JP: '🇯🇵',
  KR: '🇰🇷', CN: '🇨🇳', UA: '🇺🇦', CZ: '🇨🇿', HU: '🇭🇺', PT: '🇵🇹',
  AR: '🇦🇷', MX: '🇲🇽', IN: '🇮🇳', BE: '🇧🇪', CH: '🇨🇭', AT: '🇦🇹',
};

/** Ordering options for the RAWG game search filter. */
export const ORDERING_OPTIONS = [
  { value: '',           label: 'Relevance' },
  { value: '-rating',    label: 'Rating (High → Low)' },
  { value: 'rating',     label: 'Rating (Low → High)' },
  { value: '-metacritic', label: 'Metacritic (High → Low)' },
  { value: '-released',  label: 'Newest First' },
  { value: 'released',   label: 'Oldest First' },
  { value: '-added',     label: 'Most Added' },
];
