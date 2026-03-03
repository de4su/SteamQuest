import React, { useState, useRef, useEffect } from 'react';
import { GameRecommendation, SteamUser } from '../types';
import FavoriteButton from './FavoriteButton';

interface GameCardProps {
  game: GameRecommendation;
  user?: SteamUser | null;
}

interface SteamMedia {
  screenshots: string[];
}

const GameCard: React.FC<GameCardProps> = ({ game, user }) => {
  const [isHovered, setIsHovered] = useState(false);

  const [media, setMedia] = useState<SteamMedia>({
    screenshots: [],
  });

  const [mediaLoaded, setMediaLoaded] = useState(false);
  const [mediaError, setMediaError] = useState(false);
  const [mediaRequested, setMediaRequested] = useState(false);

  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fallbackStatic = `https://cdn.akamai.steamstatic.com/steam/apps/${game.steamAppId}/header.jpg`;

  const imageUrls: string[] = React.useMemo(() => {
    const list = media.screenshots.length > 0 ? media.screenshots : [fallbackStatic];
    return Array.from(new Set(list));
  }, [media.screenshots, fallbackStatic]);

  const storeUrl = `https://store.steampowered.com/app/${game.steamAppId}`;

  const getScoreColor = (score: number) => {
    if (score >= 90) return 'text-green-400 border-green-500 bg-green-500/20';
    if (score >= 75) return 'text-blue-400 border-blue-500 bg-blue-500/20';
    return 'text-yellow-400 border-yellow-500 bg-yellow-500/20';
  };

  // Fetch media on first hover
  useEffect(() => {
    if (!isHovered) return;
    if (mediaRequested || mediaLoaded || mediaError) return;

    setMediaRequested(true);

    fetch(`/api/steam-appdetails?appid=${game.steamAppId}`)
      .then((res) => {
        if (!res.ok) throw new Error('Failed to fetch media');
        return res.json();
      })
      .then((data: SteamMedia) => {
        setMedia({
          screenshots: data.screenshots || [],
        });
        setMediaLoaded(true);
      })
      .catch((err) => {
        console.error('Steam media fetch error for app', game.steamAppId, err);
        setMediaError(true);
      });
  }, [isHovered, mediaRequested, mediaLoaded, mediaError, game.steamAppId]);

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
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isHovered, imageUrls.length]);

  return (
    <div
      className="steam-card rounded-2xl overflow-hidden flex flex-col h-full group shadow-2xl relative"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="relative h-56 w-full overflow-hidden bg-black group-hover:shadow-[0_0_30px_rgba(102,192,244,0.3)] transition-all duration-500">
        {imageUrls.map((url, idx) => (
          <img
            key={idx}
            src={url}
            alt={`${game.title} screenshot ${idx + 1}`}
            loading="lazy"
            draggable={false}
            onDragStart={(e) => e.preventDefault()}
            onError={(e) => {
              // if a screenshot fails, hide it
              e.currentTarget.style.display = 'none';
            }}
            className={`absolute inset-0 w-full h-full object-cover select-none transition-all duration-700 ease-in-out ${
              isHovered && idx === currentImageIndex
                ? 'scale-110 opacity-100'
                : !isHovered && idx === 0
                ? 'scale-100 opacity-100'
                : 'opacity-0 scale-105'
            }`}
            style={{ zIndex: idx === currentImageIndex ? 2 : 1 }}
          />
        ))}

        {isHovered && imageUrls.length > 1 && (
          <div className="absolute top-4 right-4 flex items-center gap-2 px-2 py-1 bg-black/60 backdrop-blur-md border border-blue-500/50 rounded text-[10px] font-black text-white z-20">
            <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
            GALLERY
          </div>
        )}

        <div
          className={`absolute top-4 left-4 px-3 py-1 rounded-md border font-black text-xs z-10 backdrop-blur-xl ${getScoreColor(
            game.suitabilityScore
          )} shadow-lg`}
        >
          {game.suitabilityScore}% MATCH
        </div>

      </div>

      <div className="p-6 flex flex-col flex-grow">
        <div className="flex justify-between items-start mb-4">
          <h3 className="text-xl font-black text-white group-hover:text-blue-400 transition-colors line-clamp-2 uppercase tracking-tight flex-1">
            {game.title}
          </h3>
          <FavoriteButton
            user={user ?? null}
            gameId={game.steamAppId}
            gameSource="steam"
            gameTitle={game.title}
            gameImage={game.imageUrl ?? null}
            gameData={game as unknown as Record<string, unknown>}
          />
        </div>

        <div className="grid grid-cols-2 gap-px bg-white/5 border border-white/5 rounded-xl overflow-hidden mb-6">
          <div className="bg-[#1b2838]/80 p-4 flex flex-col items-center">
            <div className="text-[9px] text-blue-400/70 font-black uppercase tracking-[0.2em] mb-1">
              Main Quest
            </div>
            <div className="text-2xl font-stats text-white leading-none">
              {game.mainStoryTime}
              <span className="text-xs text-blue-500 font-normal ml-0.5">hrs</span>
            </div>
          </div>
          <div className="bg-[#1b2838]/80 p-4 flex flex-col items-center">
            <div className="text-[9px] text-purple-400/70 font-black uppercase tracking-[0.2em] mb-1">
              Completionist
            </div>
            <div className="text-2xl font-stats text-white leading-none">
              {game.completionistTime}
              <span className="text-xs text-purple-500 font-normal ml-0.5">hrs</span>
            </div>
          </div>
        </div>

        <p className="text-sm text-gray-300 line-clamp-3 mb-6 font-medium leading-relaxed italic opacity-75 group-hover:opacity-100 transition-opacity">
          "{game.description}"
        </p>

        <div className="mt-auto flex flex-col gap-3">
          <div className="flex items-start gap-3 p-3 bg-blue-500/5 rounded-lg border border-blue-500/10 group-hover:border-blue-500/30 transition-colors mb-2">
            <div className="bg-blue-600 p-1 rounded shrink-0">
              <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <p className="text-[11px] text-blue-300/80 font-semibold leading-tight">
              {game.reasonForPick}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                window.open(storeUrl, '_blank');
              }}
              className="py-3 bg-[#66c0f4]/10 hover:bg-[#66c0f4]/20 border border-[#66c0f4]/20 rounded-lg text-[10px] font-black text-[#66c0f4] hover:text-white uppercase tracking-wider transition-all flex flex-col items-center justify-center gap-0.5"
            >
              <span>STEAM</span>
              <span className="text-white text-xs">{game.steamPrice || 'CHECK'}</span>
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (game.dealUrl) window.open(game.dealUrl, '_blank');
              }}
              className="py-3 bg-green-500/10 hover:bg-green-500/20 border border-green-500/20 rounded-lg text-[10px] font-black text-green-400 hover:text-white uppercase tracking-wider transition-all flex flex-col items-center justify-center gap-0.5"
            >
              <span>CHEAPEST</span>
              <span className="text-white text-xs">{game.cheapestPrice || 'DEAL'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GameCard;
