import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createHmac } from 'crypto';

function parseCookies(cookieHeader: string): Record<string, string> {
  const cookies: Record<string, string> = {};
  for (const part of cookieHeader.split(';')) {
    const eqIdx = part.indexOf('=');
    if (eqIdx < 0) continue;
    const name = part.slice(0, eqIdx).trim();
    const value = part.slice(eqIdx + 1).trim();
    if (name) cookies[name] = decodeURIComponent(value);
  }
  return cookies;
}

function verifyCookieSig(encoded: string, sig: string, secret: string): boolean {
  const hmac = createHmac('sha256', secret);
  hmac.update(encoded);
  return hmac.digest('hex') === sig;
}

export default function handler(req: VercelRequest, res: VercelResponse) {
  const cookies = parseCookies(req.headers.cookie ?? '');
  const raw = cookies['steamUser'] ?? '';

  if (!raw) {
    res.status(200).json(null);
    return;
  }

  const dotIdx = raw.lastIndexOf('.');
  if (dotIdx < 0) {
    res.status(200).json(null);
    return;
  }

  const encoded = raw.slice(0, dotIdx);
  const sig = raw.slice(dotIdx + 1);
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    console.error('AUTH_SECRET environment variable is not set');
    res.status(500).send('Authentication service is not configured');
    return;
  }

  if (!verifyCookieSig(encoded, sig, secret)) {
    res.status(200).json(null);
    return;
  }

  try {
    const user = JSON.parse(Buffer.from(encoded, 'base64').toString('utf8'));
    res.status(200).json(user);
  } catch {
    res.status(200).json(null);
  }
}
