import { SteamStats, FavoriteGame, QuizResultRecord } from '../types';
import { CardGame } from '../components/ExportableCard';
import { PLATFORM_ICONS } from '../constants';

/**
 * Return true when the user owns the game — either via per-app Steam live stats
 * or the full owned-app-id set from the global stats cache.
 */
export function isGameOwned(
  appId: string | number,
  steamStats: Record<string, SteamStats>,
  ownedAppIdSet: Set<string>,
): boolean {
  const key = String(appId);
  const appStats = steamStats[key];
  return (
    (appStats?.playtimeMinutes !== null && appStats?.playtimeMinutes !== undefined) ||
    ownedAppIdSet.has(key)
  );
}

/**
 * Build the CardGame array for a quiz-result export card.
 */
export function buildExportCard(
  record: QuizResultRecord,
  steamStats: Record<string, SteamStats>,
): CardGame[] {
  return record.results.recommendations.map((game) => {
    const stats = steamStats[String(game.steamAppId)];
    const ach =
      stats?.achievementsUnlocked !== null &&
      stats?.achievementsTotal !== null &&
      stats.achievementsTotal > 0
        ? `${stats.achievementsUnlocked} / ${stats.achievementsTotal}`
        : stats !== undefined
        ? 'N/A'
        : null;
    return {
      title: game.title,
      imageUrl:
        game.imageUrl ??
        `https://cdn.akamai.steamstatic.com/steam/apps/${game.steamAppId}/header.jpg`,
      platforms: ['PC'],
      suitabilityScore: game.suitabilityScore,
      mainStoryTime: game.mainStoryTime > 0 ? game.mainStoryTime : null,
      completionistTime: game.completionistTime > 0 ? game.completionistTime : null,
      steamPlaytimeMinutes: stats?.playtimeMinutes ?? null,
      achievements: ach,
      reasonForPick: game.reasonForPick || null,
    };
  });
}

/**
 * Build the CardGame array for a favorites/wishlist export card.
 */
export function buildFavoritesExportCard(
  favorites: FavoriteGame[],
  steamStats: Record<string, SteamStats>,
): CardGame[] {
  return favorites.map((fav) => {
    const isSteam = fav.game_source === 'steam';
    const data = fav.game_data as Record<string, unknown> | null;

    const rawgParents =
      (data?.parent_platforms as Array<{ platform: { slug: string; name: string } }> | undefined) ?? [];
    const platforms: string[] = isSteam
      ? ['PC']
      : rawgParents.slice(0, 3).map((p) => PLATFORM_ICONS[p.platform.slug] ?? p.platform.name);

    const mainTime = isSteam ? (data?.mainStoryTime as number | undefined) ?? null : null;
    const stats = isSteam ? steamStats[String(fav.game_id)] : undefined;

    const ach =
      stats?.achievementsUnlocked !== null &&
      stats?.achievementsTotal !== null &&
      stats.achievementsTotal > 0
        ? `${stats.achievementsUnlocked} / ${stats.achievementsTotal}`
        : isSteam
        ? 'N/A'
        : null;

    return {
      title: fav.game_title,
      imageUrl: fav.game_image,
      platforms,
      suitabilityScore: null,
      mainStoryTime: mainTime,
      completionistTime: null,
      steamPlaytimeMinutes: stats?.playtimeMinutes ?? null,
      achievements: ach,
      genres: [],
      reasonForPick: null,
    };
  });
}
