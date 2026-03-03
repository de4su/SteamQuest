// Auth types

export interface SteamUser {
  steamId: string;
  username: string;
  avatarUrl: string;
}

// RAWG API types

export interface RawgGame {
  id: number;
  name: string;
  background_image: string | null;
  released: string | null;
  rating: number;
  ratings_count: number;
  metacritic: number | null;
  genres: Array<{ id: number; name: string }>;
  tags?: Array<{ id: number; name: string; slug: string }>;
  parent_platforms?: Array<{ platform: { id: number; name: string; slug: string } }>;
  platforms?: Array<{ platform: { id: number; name: string; slug: string } }>;
  developers?: Array<{ id: number; name: string; slug: string }>;
  publishers?: Array<{ id: number; name: string; slug: string }>;
  description_raw?: string;
}

export interface RawgScreenshot {
  id: number;
  image: string;
}

export interface RawgDeveloper {
  id: number;
  name: string;
  slug: string;
  games_count: number;
  image_background: string | null;
}

export interface RawgPublisher {
  id: number;
  name: string;
  slug: string;
  games_count: number;
  image_background: string | null;
}

export interface RawgListResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export type SuggestionKind = 'game' | 'developer' | 'publisher';

export interface Suggestion {
  kind: SuggestionKind;
  id: number;
  name: string;
  imageUrl: string | null;
  extra?: string; // e.g. genre list for games, games_count for devs/pubs
}

// Game recommendation types

export interface GameRecommendation {
  id: string;
  steamAppId: string;
  title: string;
  description: string;
  genres: string[];
  tags: string[];
  mainStoryTime: number; // Hours
  completionistTime: number; // Hours
  suitabilityScore: number; // 0-100
  imageUrl: string;
  developer: string;
  reasonForPick: string;
  steamPrice?: string; // Official Steam Store price
  cheapestPrice?: string; // Absolute cheapest price found on gg.deals
  dealUrl?: string; // Link to gg.deals
}

export interface QuizAnswers {
  preferredGenres: string[];
  playstyle: 'casual' | 'balanced' | 'hardcore';
  timeAvailability: 'short' | 'medium' | 'long';
  specificKeywords: string;
  /** Future work: difficulty filter — collected by the type system but not yet surfaced in the Quiz UI steps. */
  difficultyPreference: 'easy' | 'normal' | 'challenging';
  excludeOwned?: boolean;
}

export interface QuizAccuracy {
  percentage: number;
  reasoning: string;
}

export interface RecommendationResponse {
  recommendations: GameRecommendation[];
  accuracy: QuizAccuracy;
}

// Search filter options

export interface GameFilters {
  platforms?: number[];
  genres?: number[];
  tags?: number[];
  metacriticMin?: number;
  ordering?: string;
  page?: number;
  pageSize?: number;
}

// Favorites/wishlist

export interface FavoriteGame {
  id: string;
  steam_id: string;
  game_id: string;
  game_source: 'rawg' | 'steam';
  game_title: string;
  game_image: string | null;
  game_data: Record<string, unknown> | null;
  created_at: string;
}

// Steam Stats cache

export interface SteamStatGame {
  appid: number;
  name: string;
  playtimeForever: number;
  headerImage: string;
  playtime2weeks?: number;
}

export interface CachedSteamStats {
  totalGames: number | null;
  gamesPlayed: number | null;
  totalPlaytimeMinutes: number | null;
  avgPlaytimeMinutes: number | null;
  steamLevel: number | null;
  xp: number | null;
  xpToNextLevel: number | null;
  xpEarnedInLevel: number | null;
  countryCode: string | null;
  accountCreated: number | null;
  recentlyPlayed: SteamStatGame[];
  topPlayed: SteamStatGame[];
  ownedAppIds: number[];
  updatedAt: string;
}

// Quiz history

export interface QuizResultRecord {
  id: string;
  steam_id: string;
  answers_hash: string;
  answers: QuizAnswers;
  results: RecommendationResponse;
  created_at: string;
}
