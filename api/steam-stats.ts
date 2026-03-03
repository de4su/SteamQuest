import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * GET /api/steam-stats?steamid=XXXX
 *
 * Makes 4 parallel Steam Web API calls (no per-game fan-out) and returns a
 * comprehensive snapshot of the user's Steam profile statistics.
 *
 * If any sub-call fails (private profile, etc.) those fields return null —
 * the endpoint never fails as a whole.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { steamid } = req.query;

  if (!steamid || typeof steamid !== 'string') {
    res.status(400).json({ error: 'Missing steamid' });
    return;
  }

  const apiKey = process.env.STEAM_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: 'Steam API key not configured' });
    return;
  }

  // Prevent browser caching so refreshes always reflect current data
  res.setHeader('Cache-Control', 'no-store');

  const [ownedResult, recentResult, badgesResult, summaryResult] = await Promise.allSettled([
    fetch(
      `https://api.steampowered.com/IPlayerService/GetOwnedGames/v0001/` +
        `?key=${apiKey}&steamid=${steamid}&include_appinfo=1&include_played_free_games=1&format=json`
    ).then((r) => r.json()),
    fetch(
      `https://api.steampowered.com/IPlayerService/GetRecentlyPlayedGames/v0001/` +
        `?key=${apiKey}&steamid=${steamid}&count=5&format=json`
    ).then((r) => r.json()),
    fetch(
      `https://api.steampowered.com/IPlayerService/GetBadges/v1/` +
        `?key=${apiKey}&steamid=${steamid}&format=json`
    ).then((r) => r.json()),
    fetch(
      `https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v0002/` +
        `?key=${apiKey}&steamids=${steamid}&format=json`
    ).then((r) => r.json()),
  ]);

  // --- Owned games ---
  type OwnedGame = { appid: number; name: string; playtime_forever: number; img_icon_url?: string };
  const ownedGames: OwnedGame[] =
    ownedResult.status === 'fulfilled'
      ? ((ownedResult.value as { response?: { games?: OwnedGame[] } })?.response?.games ?? [])
      : [];

  const totalGames = ownedResult.status === 'fulfilled' ? ownedGames.length : null;
  const gamesPlayed =
    totalGames !== null ? ownedGames.filter((g) => g.playtime_forever > 0).length : null;
  const totalPlaytimeMinutes =
    totalGames !== null
      ? ownedGames.reduce((sum, g) => sum + (g.playtime_forever ?? 0), 0)
      : null;
  const avgPlaytimeMinutes =
    gamesPlayed !== null && gamesPlayed > 0 && totalPlaytimeMinutes !== null
      ? Math.round(totalPlaytimeMinutes / gamesPlayed)
      : null;

  const ownedAppIds: number[] = ownedGames.map((g) => g.appid);

  // Top 5 most-played games
  const topPlayed = [...ownedGames]
    .sort((a, b) => b.playtime_forever - a.playtime_forever)
    .slice(0, 5)
    .map((g) => ({
      appid: g.appid,
      name: g.name,
      playtimeForever: g.playtime_forever,
      headerImage: `https://cdn.akamai.steamstatic.com/steam/apps/${g.appid}/header.jpg`,
    }));

  // --- Recently played ---
  type RecentGame = {
    appid: number;
    name: string;
    playtime_2weeks: number;
    playtime_forever: number;
  };
  const recentGames: RecentGame[] =
    recentResult.status === 'fulfilled'
      ? ((recentResult.value as { response?: { games?: RecentGame[] } })?.response?.games ?? [])
      : [];

  const recentlyPlayed = recentGames.slice(0, 5).map((g) => ({
    appid: g.appid,
    name: g.name,
    playtime2weeks: g.playtime_2weeks,
    playtimeForever: g.playtime_forever,
    headerImage: `https://cdn.akamai.steamstatic.com/steam/apps/${g.appid}/header.jpg`,
  }));

  // --- Badges / level ---
  type BadgesResponse = {
    response?: {
      player_level?: number;
      player_xp?: number;
      player_xp_needed_to_level_up?: number;
      player_xp_needed_current_level?: number;
    };
  };
  const badgesData =
    badgesResult.status === 'fulfilled' ? (badgesResult.value as BadgesResponse) : null;
  const steamLevel = badgesData?.response?.player_level ?? null;
  const xp = badgesData?.response?.player_xp ?? null;
  const xpToNextLevel = badgesData?.response?.player_xp_needed_to_level_up ?? null;
  // xp earned in current level = total XP - XP at start of current level
  const xpAtLevelStart = badgesData?.response?.player_xp_needed_current_level ?? null;
  const xpEarnedInLevel =
    xp !== null && xpAtLevelStart !== null ? xp - xpAtLevelStart : null;

  // --- Player summary ---
  type PlayerSummary = {
    profileurl?: string;
    loccountrycode?: string;
    timecreated?: number;
    personastate?: number;
  };
  type SummaryResponse = { response?: { players?: PlayerSummary[] } };
  const summaryData =
    summaryResult.status === 'fulfilled' ? (summaryResult.value as SummaryResponse) : null;
  const player = summaryData?.response?.players?.[0] ?? null;
  const countryCode = player?.loccountrycode ?? null;
  const accountCreated = player?.timecreated ?? null;

  res.status(200).json({
    totalGames,
    gamesPlayed,
    totalPlaytimeMinutes,
    avgPlaytimeMinutes,
    steamLevel,
    xp,
    xpToNextLevel,
    xpEarnedInLevel,
    countryCode,
    accountCreated,
    recentlyPlayed,
    topPlayed,
    ownedAppIds,
  });
}
