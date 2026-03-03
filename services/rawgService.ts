/**
 * rawgService.ts
 *
 * Thin wrapper around the RAWG Video Games Database API (https://rawg.io/api).
 * RAWG covers PC, PlayStation, Xbox, Nintendo, iOS, Android, and more — making
 * it the backbone of SteamQuest's universal cross-platform game search feature.
 *
 * All requests are deduplicated via an in-memory cache keyed by the full URL.
 * Retryable HTTP status codes (429, 5xx) are automatically retried with
 * exponential back-off up to three times.
 */
import {
  RawgGame,
  RawgDeveloper,
  RawgPublisher,
  RawgListResponse,
  RawgScreenshot,
  GameFilters,
} from '../types';

const BASE_URL = 'https://api.rawg.io/api';
const getKey = () => import.meta.env.VITE_RAWG_API_KEY as string ?? '';

const cache = new Map<string, unknown>();

const RAWG_RETRYABLE_STATUSES = new Set([429, 500, 502, 503, 504]);

async function rawgFetch<T>(
  path: string,
  params: Record<string, string | number>,
  signal?: AbortSignal,
): Promise<T> {
  const key = getKey();
  const url = new URL(`${BASE_URL}${path}`);
  url.searchParams.set('key', key);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, String(v));
  }

  const cacheKey = url.toString();
  if (cache.has(cacheKey)) {
    return cache.get(cacheKey) as T;
  }

  const maxRetries = 3;
  const baseDelayMs = 500;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (attempt > 0) {
      const backoffMs = baseDelayMs * Math.pow(2, attempt - 1);
      await new Promise<void>(resolve => setTimeout(resolve, backoffMs));
    }
    try {
      const response = await fetch(url.toString(), { signal });
      if (RAWG_RETRYABLE_STATUSES.has(response.status) && attempt < maxRetries) {
        console.warn(`[rawgFetch] Status ${response.status} on attempt ${attempt + 1}, retrying...`);
        continue;
      }
      if (!response.ok) {
        throw new Error(`RAWG API error: ${response.status} ${response.statusText}`);
      }
      const data = (await response.json()) as T;
      cache.set(cacheKey, data);
      return data;
    } catch (err: any) {
      if (err?.name === 'AbortError' || attempt === maxRetries) throw err;
      if (err?.name !== 'TypeError' && !/failed to fetch|networkerror/i.test(err?.message ?? '')) throw err;
      console.warn(`[rawgFetch] Attempt ${attempt + 1} network error: ${err.message}. Retrying...`);
    }
  }
  throw new Error('RAWG request failed after all retries');
}

const controllers = new Map<string, AbortController>();

function getController(key: string): AbortSignal {
  const prev = controllers.get(key);
  if (prev) prev.abort();
  const next = new AbortController();
  controllers.set(key, next);
  return next.signal;
}

/**
 * Searches for games across ALL platforms by keyword.
 *
 * @param query    - Search term (game title, keyword, etc.).
 * @param page     - Page number for pagination (default 1).
 * @param pageSize - Number of results per page (default 20).
 * @returns Paginated RAWG list of matching games.
 */
export async function searchGames(
  query: string,
  page = 1,
  pageSize = 20,
): Promise<RawgListResponse<RawgGame>> {
  return rawgFetch<RawgListResponse<RawgGame>>('/games', {
    search: query,
    page,
    page_size: pageSize,
  });
}

/**
 * Searches RAWG for game developers matching the given query.
 * Aborts any in-flight developer search before issuing a new one.
 *
 * @param query - Partial or full developer name.
 * @returns Paginated RAWG list of matching developer records.
 */
export async function searchDevelopers(
  query: string,
): Promise<RawgListResponse<RawgDeveloper>> {
  const signal = getController('searchDevelopers');
  return rawgFetch<RawgListResponse<RawgDeveloper>>(
    '/developers',
    { search: query, page_size: 5 },
    signal,
  );
}

/**
 * Searches RAWG for game publishers matching the given query.
 * Aborts any in-flight publisher search before issuing a new one.
 *
 * @param query - Partial or full publisher name.
 * @returns Paginated RAWG list of matching publisher records.
 */
export async function searchPublishers(
  query: string,
): Promise<RawgListResponse<RawgPublisher>> {
  const signal = getController('searchPublishers');
  return rawgFetch<RawgListResponse<RawgPublisher>>(
    '/publishers',
    { search: query, page_size: 5 },
    signal,
  );
}

/**
 * Returns a paginated list of games released by a specific developer.
 *
 * @param developerId - RAWG numeric developer ID.
 * @param page        - Page number (default 1).
 * @param pageSize    - Results per page (default 20).
 */
export async function getGamesByDeveloper(
  developerId: number,
  page = 1,
  pageSize = 20,
): Promise<RawgListResponse<RawgGame>> {
  return rawgFetch<RawgListResponse<RawgGame>>('/games', {
    developers: developerId,
    page,
    page_size: pageSize,
  });
}

/**
 * Returns a paginated list of games published by a specific publisher.
 *
 * @param publisherId - RAWG numeric publisher ID.
 * @param page        - Page number (default 1).
 * @param pageSize    - Results per page (default 20).
 */
export async function getGamesByPublisher(
  publisherId: number,
  page = 1,
  pageSize = 20,
): Promise<RawgListResponse<RawgGame>> {
  return rawgFetch<RawgListResponse<RawgGame>>('/games', {
    publishers: publisherId,
    page,
    page_size: pageSize,
  });
}

/**
 * Advanced search with optional platform, genre, tag, Metacritic, and ordering filters.
 * Used by the Search page's filter panel to narrow results across any platform.
 *
 * @param query   - Search term.
 * @param filters - Optional filter object (platforms, genres, tags, metacriticMin, ordering, pagination).
 * @param signal  - Optional AbortSignal to cancel the request.
 * @returns Paginated RAWG list of matching games.
 */
export async function searchGamesWithFilters(
  query: string,
  filters: GameFilters = {},
  signal?: AbortSignal,
): Promise<RawgListResponse<RawgGame>> {
  const params: Record<string, string | number> = {
    search: query,
    page: filters.page ?? 1,
    page_size: filters.pageSize ?? 20,
  };

  if (filters.platforms && filters.platforms.length > 0) {
    params.platforms = filters.platforms.join(',');
  }

  if (filters.genres && filters.genres.length > 0) {
    params.genres = filters.genres.join(',');
  }

  if (filters.tags && filters.tags.length > 0) {
    params.tags = filters.tags.join(',');
  }

  if (filters.metacriticMin !== undefined) {
    params.metacritic = `${filters.metacriticMin},100`;
  }

  if (filters.ordering) {
    params.ordering = filters.ordering;
  }

  return rawgFetch<RawgListResponse<RawgGame>>('/games', params, signal);
}

/** Fetches all available RAWG platforms (PC, PlayStation, Xbox, Nintendo, mobile, …). */
export async function fetchPlatforms(): Promise<RawgListResponse<{ id: number; name: string; slug: string }>> {
  return rawgFetch('/platforms', { page_size: 50 });
}

/** Fetches all available RAWG genres for use in search filters. */
export async function fetchGenres(): Promise<RawgListResponse<{ id: number; name: string; slug: string }>> {
  return rawgFetch('/genres', { page_size: 50 });
}

/** Fetches available RAWG tags for use in search filters. */
export async function fetchTags(): Promise<RawgListResponse<{ id: number; name: string; slug: string }>> {
  return rawgFetch('/tags', { page_size: 50 });
}

/**
 * Fetches screenshot URLs for a specific RAWG game.
 *
 * @param gameId - RAWG numeric game ID.
 * @returns Array of screenshot objects.
 */
export async function getGameScreenshots(gameId: number): Promise<RawgScreenshot[]> {
  const data = await rawgFetch<RawgListResponse<RawgScreenshot>>(
    `/games/${gameId}/screenshots`,
    {},
  );
  return data.results;
}

/**
 * Fetches autocomplete suggestions for the search bar — games, developers, and
 * publishers — in a single parallel request.  Any in-flight typeahead call is
 * cancelled before issuing the new one to avoid stale results.
 *
 * @param query - Current search term typed by the user.
 * @returns Object with `games`, `developers`, and `publishers` suggestion arrays.
 */
export async function fetchSuggestions(query: string): Promise<{
  games: RawgGame[];
  developers: RawgDeveloper[];
  publishers: RawgPublisher[];
}> {
  const signal = getController('typeahead');

  const [gamesRes, devsRes, pubsRes] = await Promise.all([
    rawgFetch<RawgListResponse<RawgGame>>(
      '/games',
      { search: query, page_size: 5 },
      signal,
    ),
    rawgFetch<RawgListResponse<RawgDeveloper>>(
      '/developers',
      { search: query, page_size: 3 },
      signal,
    ),
    rawgFetch<RawgListResponse<RawgPublisher>>(
      '/publishers',
      { search: query, page_size: 3 },
      signal,
    ),
  ]);

  return {
    games: gamesRes.results,
    developers: devsRes.results,
    publishers: pubsRes.results,
  };
}
