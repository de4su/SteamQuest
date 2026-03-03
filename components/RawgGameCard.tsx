import React, { useState, useRef, useEffect } from 'react';
import { RawgGame, SteamUser } from '../types';
import { getGameScreenshots } from '../services/rawgService';
import FavoriteButton from './FavoriteButton';

interface RawgGameCardProps {
  game: RawgGame;
  onClick?: (game: RawgGame) => void;
  user?: SteamUser | null;
}

const PLATFORM_DISPLAY_NAMES: Record<number, string> = {
  // PC
  4: 'PC',
  // PlayStation
  187: 'PS5',
  18: 'PS4',
  16: 'PS3',
  15: 'PS2',
  27: 'PS1',
  19: 'PS Vita',
  17: 'PSP',
  // Xbox
  186: 'Xbox Series X/S',
  1: 'Xbox One',
  14: 'Xbox 360',
  80: 'Xbox',
  // Nintendo
  7: 'Switch',
  10: 'Wii U',
  11: 'Wii',
  105: 'GameCube',
  8: '3DS',
  9: 'DS',
  83: 'Game Boy',
  // Mobile
  3: 'iOS',
  21: 'Android',
  // Others
  5: 'macOS',
  6: 'Linux',
  171: 'Web',
};

const PLATFORM_FAMILIES: Record<string, number[]> = {
  PlayStation: [187, 18, 16, 15, 27, 19, 17],
  Xbox: [186, 1, 14, 80],
  Nintendo: [7, 10, 11, 105, 8, 9, 83],
};

const RawgGameCard: React.FC<RawgGameCardProps> = ({ game, onClick, user }) => {
  const ratingColor =
    game.rating >= 4 ? 'text-green-400' : game.rating >= 3 ? 'text-blue-400' : 'text-yellow-400';

  const [isHovered, setIsHovered] = useState(false);
  const [screenshots, setScreenshots] = useState<string[]>([]);
  const [screenshotsRequested, setScreenshotsRequested] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const imageUrls: string[] = React.useMemo(() => {
    if (screenshots.length > 0) return screenshots;
    return game.background_image ? [game.background_image] : [];
  }, [screenshots, game.background_image]);

  // Fetch screenshots on first hover
  useEffect(() => {
    if (!isHovered || screenshotsRequested) return;
    setScreenshotsRequested(true);
    getGameScreenshots(game.id)
      .then((results) => {
        setScreenshots(results.map((s) => s.image));
      })
      .catch((err) => {
        console.error('RAWG screenshot fetch error for game', game.id, err);
      });
  }, [isHovered, screenshotsRequested, game.id]);

  // Slideshow when hovered
  useEffect(() => {
    if (isHovered && imageUrls.length > 1) {
      intervalRef.current = setInterval(() => {
        setCurrentImageIndex((prev) => (prev + 1) % imageUrls.length);
      }, 1500);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      setCurrentImageIndex(0);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isHovered, imageUrls.length]);

  const platforms = React.useMemo(() => {
    if (!game.platforms || game.platforms.length === 0) return [];

    const platformsByFamily = new Map<string, Set<number>>();
    const standalone: number[] = [];

    game.platforms.forEach(({ platform }) => {
      let foundFamily = false;
      for (const [family, ids] of Object.entries(PLATFORM_FAMILIES)) {
        if (ids.includes(platform.id)) {
          if (!platformsByFamily.has(family)) {
            platformsByFamily.set(family, new Set());
          }
          platformsByFamily.get(family)!.add(platform.id);
          foundFamily = true;
          break;
        }
      }
      if (!foundFamily) {
        standalone.push(platform.id);
      }
    });

    const result: string[] = [];

    for (const [family, platformIds] of platformsByFamily.entries()) {
      const sortedIds = Array.from(platformIds).sort((a, b) => {
        const familyIds = PLATFORM_FAMILIES[family];
        return familyIds.indexOf(a) - familyIds.indexOf(b);
      });

      if (sortedIds.length === 1) {
        result.push(PLATFORM_DISPLAY_NAMES[sortedIds[0]] || family);
      } else {
        const shortNames = sortedIds.map((id) => {
          const name = PLATFORM_DISPLAY_NAMES[id];
          if (!name) return '';
          if (family === 'PlayStation') {
            if (name === 'PS5') return '5';
            if (name === 'PS4') return '4';
            if (name === 'PS3') return '3';
            if (name === 'PS2') return '2';
            if (name === 'PS1') return '1';
            if (name === 'PS Vita') return 'Vita';
            if (name === 'PSP') return 'PSP';
          } else if (family === 'Xbox') {
            if (name === 'Xbox Series X/S') return 'Series X/S';
            if (name === 'Xbox One') return 'One';
            if (name === 'Xbox 360') return '360';
            // Original Xbox has no generation suffix; omit from condensed label
            if (name === 'Xbox') return '';
          } else if (family === 'Nintendo') {
            return name;
          }
          return name;
        }).filter(Boolean);

        if (family === 'PlayStation') {
          result.push(`PS ${shortNames.join('/')}`);
        } else if (family === 'Xbox') {
          result.push(`Xbox ${shortNames.join('/')}`);
        } else {
          result.push(shortNames.join('/'));
        }
      }
    }

    standalone.forEach((id) => {
      const name = PLATFORM_DISPLAY_NAMES[id];
      if (name) result.push(name);
    });

    return result;
  }, [game.platforms]);

  return (
    <div
      className="steam-card rounded-2xl overflow-hidden flex flex-col h-full shadow-2xl group cursor-pointer"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={() => onClick?.(game)}
    >
      <div className="relative h-48 w-full overflow-hidden bg-black group-hover:shadow-[0_0_30px_rgba(102,192,244,0.3)] transition-all duration-500">
        {imageUrls.length > 0 ? (
          imageUrls.map((url, idx) => (
            <img
              key={idx}
              src={url}
              alt={`${game.name} screenshot ${idx + 1}`}
              loading="lazy"
              draggable={false}
              onDragStart={(e) => e.preventDefault()}
              onError={(e) => { e.currentTarget.style.display = 'none'; }}
              className={`absolute inset-0 w-full h-full object-cover select-none transition-all duration-700 ease-in-out ${
                isHovered && idx === currentImageIndex
                  ? 'scale-110 opacity-100'
                  : !isHovered && idx === 0
                  ? 'scale-100 opacity-100'
                  : 'opacity-0 scale-105'
              }`}
              style={{ zIndex: idx === currentImageIndex ? 2 : 1 }}
            />
          ))
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-700 text-xs font-black uppercase tracking-widest">
            No Image
          </div>
        )}

        {isHovered && imageUrls.length > 1 && (
          <div className="absolute top-4 right-4 flex items-center gap-2 px-2 py-1 bg-black/60 backdrop-blur-md border border-blue-500/50 rounded text-[10px] font-black text-white z-20">
            <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
            GALLERY
          </div>
        )}

        {game.metacritic !== null && (
          <div className="absolute top-3 left-3 px-2 py-0.5 bg-green-700/90 border border-green-500/50 rounded text-[10px] font-black text-white backdrop-blur-sm z-10">
            MC {game.metacritic}
          </div>
        )}
      </div>

      <div className="p-5 flex flex-col flex-grow">
        <h3 className="text-base font-black text-white group-hover:text-blue-400 transition-colors uppercase tracking-tight line-clamp-2 mb-2">
          {game.name}
        </h3>

        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className={`text-sm font-bold ${ratingColor}`}>★ {game.rating.toFixed(1)}</span>
            <span className="text-xs text-gray-400">({game.ratings_count.toLocaleString()} ratings)</span>
          </div>
          <FavoriteButton
            user={user ?? null}
            gameId={String(game.id)}
            gameSource="rawg"
            gameTitle={game.name}
            gameImage={game.background_image}
            gameData={game as unknown as Record<string, unknown>}
          />
        </div>

        {game.genres && game.genres.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {game.genres.slice(0, 3).map((g) => (
              <span
                key={g.id}
                className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 bg-blue-600/10 border border-blue-500/20 text-blue-400 rounded-full"
              >
                {g.name}
              </span>
            ))}
          </div>
        )}

        {platforms.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {platforms.slice(0, 5).map((p) => (
              <span
                key={p}
                className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 bg-white/5 border border-white/10 text-gray-300 rounded-full"
              >
                {p}
              </span>
            ))}
          </div>
        )}

        <div className="mt-auto flex items-center justify-between">
          {game.released && (
            <p className="text-[11px] text-gray-400 font-medium">
              Released: {game.released}
            </p>
          )}
          {onClick && (
            <span className="text-[10px] font-black uppercase tracking-widest text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity">
              Enrich →
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

export default RawgGameCard;
