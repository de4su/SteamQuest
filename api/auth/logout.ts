import type { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(_req: VercelRequest, res: VercelResponse) {
  res.setHeader('Set-Cookie', 'steamUser=; Path=/; SameSite=Lax; Max-Age=0; HttpOnly');
  res.status(200).json({ success: true });
}
