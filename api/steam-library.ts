import type { VercelRequest, VercelResponse } from '@vercel/node';

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

  try {
    const url = `https://api.steampowered.com/IPlayerService/GetOwnedGames/v0001/?key=${apiKey}&steamid=${steamid}&format=json`;
    const response = await fetch(url);

    if (!response.ok) {
      res.status(response.status).json({ error: 'Steam API request failed' });
      return;
    }

    const data = await response.json() as { response?: { games?: Array<{ appid: number }> } };
    const games = data?.response?.games ?? [];
    const appIds: string[] = games.map((g) => String(g.appid));

    res.status(200).json({ appIds });
  } catch (err) {
    console.error('Error fetching Steam library:', err);
    res.status(500).json({ error: 'Failed to fetch Steam library' });
  }
}
