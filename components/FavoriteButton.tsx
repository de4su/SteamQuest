import React, { useState, useEffect } from 'react';
import { SteamUser } from '../types';
import { addFavorite, removeFavorite, isFavorite } from '../services/favoritesService';

interface FavoriteButtonProps {
  user: SteamUser | null;
  gameId: string;
  gameSource: 'rawg' | 'steam';
  gameTitle: string;
  gameImage: string | null;
  gameData?: Record<string, unknown>;
}

const FavoriteButton: React.FC<FavoriteButtonProps> = ({
  user,
  gameId,
  gameSource,
  gameTitle,
  gameImage,
  gameData,
}) => {
  const [favorited, setFavorited] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user) return;
    isFavorite(user.steamId, gameId, gameSource)
      .then(setFavorited)
      .catch((err) => { console.error('Failed to check favorite status:', err); });
  }, [user, gameId, gameSource]);

  if (!user) return null;

  const handleClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setLoading(true);
    try {
      if (favorited) {
        await removeFavorite(user.steamId, gameId, gameSource);
        setFavorited(false);
      } else {
        await addFavorite(user.steamId, gameId, gameSource, gameTitle, gameImage, gameData ?? null);
        setFavorited(true);
      }
    } catch (err) {
      console.error('Favorite toggle error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      title={favorited ? 'Remove from wishlist' : 'Add to wishlist'}
      className={`p-1.5 rounded-full transition-all border ${
        favorited
          ? 'bg-pink-600/20 border-pink-500/50 text-pink-400 hover:bg-pink-600/40'
          : 'bg-white/5 border-white/10 text-gray-500 hover:text-pink-400 hover:border-pink-500/50'
      } disabled:opacity-50`}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill={favorited ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth={2}
        className="w-4 h-4"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z"
        />
      </svg>
    </button>
  );
};

export default FavoriteButton;
