import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createHmac } from 'crypto';
const STEAM_OPENID_URL = 'https://steamcommunity.com/openid/login';

function buildCookieValue(userData: object, secret: string): string {
  const json = JSON.stringify(userData);
  const encoded = Buffer.from(json).toString('base64');
  const hmac = createHmac('sha256', secret);
  hmac.update(encoded);
  const sig = hmac.digest('hex');
  return `${encoded}.${sig}`;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const query = req.query as Record<string, string>;

  // Re-verify the OpenID assertion with Steam to prevent forgery.
  const verifyParams = new URLSearchParams(query);
  verifyParams.set('openid.mode', 'check_authentication');

  let verifyText = '';
  try {
    const verifyRes = await fetch(STEAM_OPENID_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: verifyParams.toString(),
    });
    verifyText = await verifyRes.text();
  } catch (err) {
    console.error('Steam OpenID verification request failed:', err);
    res.status(500).send('Steam verification failed');
    return;
  }

  if (!verifyText.includes('is_valid:true')) {
    res.status(401).send('Invalid Steam OpenID assertion');
    return;
  }

  // Extract Steam ID from claimed_id (e.g. https://steamcommunity.com/openid/id/76561198XXXXXXXXX)
  const claimedId = query['openid.claimed_id'] ?? '';
  const steamIdMatch = claimedId.match(/\/(\d+)$/);
  if (!steamIdMatch) {
    res.status(400).send('Could not extract Steam ID from OpenID response');
    return;
  }
  const steamId = steamIdMatch[1];

  // Fetch public profile; fall back to a derived username if unavailable.
  let username = `SteamUser${steamId.slice(-4)}`;
  let avatarUrl = '';
  const apiKey = process.env.STEAM_API_KEY ?? '';
  if (apiKey) {
    try {
      const profileRes = await fetch(
        `https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/?key=${apiKey}&steamids=${steamId}`,
      );
      const profileData = (await profileRes.json()) as {
        response?: { players?: Array<{ personaname: string; avatarfull: string }> };
      };
      const player = profileData?.response?.players?.[0];
      if (player) {
        username = player.personaname;
        avatarUrl = player.avatarfull;
      }
    } catch (err) {
      console.error('Failed to fetch Steam player summary:', err);
    }
  }

  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    console.error('AUTH_SECRET environment variable is not set');
    res.status(500).send('Authentication service is not configured');
    return;
  }
  const cookieValue = buildCookieValue({ steamId, username, avatarUrl }, secret);
  const maxAge = 7 * 24 * 3600; // 7 days

  res.setHeader(
    'Set-Cookie',
    `steamUser=${cookieValue}; Path=/; SameSite=Lax; Max-Age=${maxAge}; HttpOnly`,
  );

  const host = req.headers.host ?? '';
  const proto = host.startsWith('localhost') ? 'http' : 'https';
  const baseUrl = process.env.APP_URL ?? `${proto}://${host}`;
  res.redirect(302, `${baseUrl}/?loggedIn=1`);
}
