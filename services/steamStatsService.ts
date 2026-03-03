import { supabase } from './supabaseClient';
import { CachedSteamStats } from '../types';

interface SteamStatsCacheRow {
  steam_id: string;
  stats: CachedSteamStats;
  updated_at: string;
}

/**
 * Retrieve cached Steam stats for the given Steam ID from Supabase.
 * Returns null when no cached entry exists or on error.
 *
 * Table (run once in Supabase SQL editor):
 * CREATE TABLE IF NOT EXISTS steam_stats_cache (
 *   steam_id   text PRIMARY KEY,
 *   stats      jsonb NOT NULL,
 *   updated_at timestamptz DEFAULT now()
 * );
 */
export async function getCachedSteamStats(steamId: string): Promise<CachedSteamStats | null> {
  try {
    const { data, error } = await supabase
      .from('steam_stats_cache')
      .select('stats, updated_at')
      .eq('steam_id', steamId)
      .maybeSingle();

    if (error || !data) return null;

    const row = data as { stats: CachedSteamStats; updated_at: string };
    return { ...row.stats, updatedAt: row.updated_at };
  } catch {
    return null;
  }
}

/**
 * Upsert Steam stats for the given Steam ID into the Supabase cache.
 * Silently ignores errors — the cache is best-effort.
 */
export async function saveSteamStats(steamId: string, stats: CachedSteamStats): Promise<void> {
  try {
    await supabase.from('steam_stats_cache').upsert(
      {
        steam_id: steamId,
        stats,
        updated_at: new Date().toISOString(),
      } as SteamStatsCacheRow,
      { onConflict: 'steam_id' }
    );
  } catch {
    // Non-fatal
  }
}
