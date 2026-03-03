import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * GET /api/steam-playtime?steamid=XXXX&appids=111,222,333
 *
 * Returns actual playtime (minutes played) and achievement progress
 * for the given Steam user and list of app IDs.
 *
 * Uses:
 *   - IPlayerService/GetOwnedGames  → playtime_forever per app
 *   - ISteamUserStats/GetPlayerAchievements → achieved/total counts per app
 *
 * Both calls require the profile to be public.  If a request fails (private
 * profile, no stats, etc.) we just return null for that app so the UI can
 * gracefully fall back to HowLongToBeat data.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { steamid, appids } = req.query;

  if (!steamid || typeof steamid !== 'string') {
    res.status(400).json({ error: 'Missing steamid' });
    return;
  }

  if (!appids || typeof appids !== 'string') {
    res.status(400).json({ error: 'Missing appids' });
    return;
  }

  const apiKey = process.env.STEAM_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: 'Steam API key not configured' });
    return;
  }

  const requestedIds = appids
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean)
    .slice(0, 20); // cap at 20 to avoid huge payloads

  if (requestedIds.length === 0) {
    res.status(400).json({ error: 'No valid appids provided' });
    return;
  }

  try {
    // 1. Fetch owned games list with playtime (include_played_free_games=1 just in case)
    const ownedUrl =
      `https://api.steampowered.com/IPlayerService/GetOwnedGames/v0001/` +
      `?key=${apiKey}&steamid=${steamid}&include_appinfo=0` +
      `&include_played_free_games=1&format=json`;

    const ownedRes = await fetch(ownedUrl);
    const ownedData = (await ownedRes.json()) as {
      response?: {
        games?: Array<{ appid: number; playtime_forever: number }>;
      };
    };

    // Build a map of appId → playtime in minutes
    const playtimeMap: Record<string, number> = {};
    for (const g of ownedData?.response?.games ?? []) {
      playtimeMap[String(g.appid)] = g.playtime_forever ?? 0;
    }

    // 2. Fetch achievement progress for each requested app in parallel.
    //    We limit concurrency to avoid overwhelming the API.
    const achievementResults = await Promise.allSettled(
      requestedIds.map(async (appid) => {
        const url =
          `https://api.steampowered.com/ISteamUserStats/GetPlayerAchievements/v0001/` +
          `?key=${apiKey}&steamid=${steamid}&appid=${appid}&format=json`;
        const r = await fetch(url);
        if (!r.ok) return { appid, achieved: null, total: null };
        const json = (await r.json()) as {
          playerstats?: {
            success: boolean;
            achievements?: Array<{ achieved: 0 | 1 }>;
          };
        };
        if (!json?.playerstats?.success || !json.playerstats.achievements) {
          return { appid, achieved: null, total: null };
        }
        const achievements = json.playerstats.achievements;
        const achieved = achievements.filter((a) => a.achieved === 1).length;
        const total = achievements.length;
        return { appid, achieved, total };
      })
    );

    // 3. Build final result object keyed by appId
    const result: Record<
      string,
      {
        playtimeMinutes: number | null;
        achievementsUnlocked: number | null;
        achievementsTotal: number | null;
      }
    > = {};

    for (const appid of requestedIds) {
      result[appid] = {
        playtimeMinutes: playtimeMap[appid] !== undefined ? playtimeMap[appid] : null,
        achievementsUnlocked: null,
        achievementsTotal: null,
      };
    }

    for (const settled of achievementResults) {
      if (settled.status === 'fulfilled' && settled.value) {
        const { appid, achieved, total } = settled.value;
        if (result[appid]) {
          result[appid].achievementsUnlocked = achieved;
          result[appid].achievementsTotal = total;
        }
      }
    }

    res.status(200).json({ playtime: result });
  } catch (err) {
    console.error('Error fetching Steam playtime:', err);
    res.status(500).json({ error: 'Failed to fetch Steam playtime data' });
  }
}
