/**
 * favoritesService.ts
 *
 * CRUD helpers for the user_favorites table in Supabase.
 * Users can favorite games from any source (RAWG universal search or Steam library)
 * so that they can revisit them later and get purchase links via Steam / GG.deals.
 */
import { supabase } from './supabaseClient';
import { FavoriteGame } from '../types';

/**
 * Retrieves all favorited games for a given Steam user, newest first.
 *
 * @param steamId - The Steam ID of the logged-in user.
 * @returns Array of FavoriteGame records ordered by creation date (descending).
 */
export async function getFavorites(steamId: string): Promise<FavoriteGame[]> {
  const { data, error } = await supabase
    .from('user_favorites')
    .select('*')
    .eq('steam_id', steamId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data as FavoriteGame[]) ?? [];
}

/**
 * Adds a game to the user's favorites list.
 * Works for games from any source — RAWG (universal search) or Steam.
 * After favoriting, the profile page shows Steam / GG.deals purchase links.
 *
 * @param steamId   - The Steam ID of the logged-in user.
 * @param gameId    - Platform-specific game identifier (RAWG id or Steam App ID).
 * @param gameSource - Origin of the game data ('rawg' | 'steam').
 * @param gameTitle - Human-readable game title stored for display.
 * @param gameImage - Header/cover image URL (may be null).
 * @param gameData  - Full game payload stored as JSONB for later use.
 */
export async function addFavorite(
  steamId: string,
  gameId: string,
  gameSource: 'rawg' | 'steam',
  gameTitle: string,
  gameImage: string | null,
  gameData: Record<string, unknown> | null,
): Promise<void> {
  const { error } = await supabase.from('user_favorites').insert({
    steam_id: steamId,
    game_id: gameId,
    game_source: gameSource,
    game_title: gameTitle,
    game_image: gameImage,
    game_data: gameData,
  });
  if (error) throw error;
}

/**
 * Removes a specific game from the user's favorites.
 *
 * @param steamId   - The Steam ID of the logged-in user.
 * @param gameId    - Platform-specific game identifier.
 * @param gameSource - Origin of the game data ('rawg' | 'steam').
 */
export async function removeFavorite(steamId: string, gameId: string, gameSource: 'rawg' | 'steam'): Promise<void> {
  const { error } = await supabase
    .from('user_favorites')
    .delete()
    .eq('steam_id', steamId)
    .eq('game_id', gameId)
    .eq('game_source', gameSource);
  if (error) throw error;
}

/**
 * Checks whether a specific game is already in the user's favorites.
 *
 * @param steamId   - The Steam ID of the logged-in user.
 * @param gameId    - Platform-specific game identifier.
 * @param gameSource - Origin of the game data ('rawg' | 'steam').
 * @returns True if the game is favorited, false otherwise.
 */
export async function isFavorite(steamId: string, gameId: string, gameSource: 'rawg' | 'steam'): Promise<boolean> {
  const { data, error } = await supabase
    .from('user_favorites')
    .select('id')
    .eq('steam_id', steamId)
    .eq('game_id', gameId)
    .eq('game_source', gameSource)
    .maybeSingle();
  if (error) throw error;
  return data !== null;
}
