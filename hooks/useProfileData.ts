import { useEffect, useState } from 'react';
import { SteamUser, QuizResultRecord, FavoriteGame, CachedSteamStats, SteamStats } from '../types';
import { supabase } from '../services/supabaseClient';
import { getFavorites, removeFavorite } from '../services/favoritesService';
import { getCachedSteamStats, saveSteamStats } from '../services/steamStatsService';
import { CardGame } from '../components/ExportableCard';
import { buildExportCard, buildFavoritesExportCard } from '../utils/gameHelpers';
import { isGameOwned as checkGameOwned } from '../utils/gameHelpers';

type ProfileTab = 'history' | 'favorites' | 'stats';

interface ExportCardState {
  games: CardGame[];
  label: string;
  genres?: string[];
}

export interface ProfileData {
  activeTab: ProfileTab;
  setActiveTab: (tab: ProfileTab) => void;
  history: QuizResultRecord[];
  favorites: FavoriteGame[];
  loading: boolean;
  error: string | null;
  expanded: string | null;
  setExpanded: (id: string | null) => void;
  steamStats: Record<string, SteamStats>;
  globalStats: CachedSteamStats | null;
  statsLoading: boolean;
  statsError: string | null;
  ownedAppIdSet: Set<string>;
  exportCard: ExportCardState | null;
  setExportCard: (card: ExportCardState | null) => void;
  statsFetched: boolean;
  isGameOwned: (appId: string | number) => boolean;
  handleRemoveFavorite: (fav: FavoriteGame) => Promise<void>;
  handleRefreshStats: () => Promise<void>;
  handleExportQuizCard: (record: QuizResultRecord) => void;
  handleExportFavoritesCard: () => void;
}

export function useProfileData(user: SteamUser): ProfileData {
  const [activeTab, setActiveTab] = useState<ProfileTab>('history');
  const [history, setHistory] = useState<QuizResultRecord[]>([]);
  const [favorites, setFavorites] = useState<FavoriteGame[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const [steamStats, setSteamStats] = useState<Record<string, SteamStats>>({});

  const [globalStats, setGlobalStats] = useState<CachedSteamStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [statsError, setStatsError] = useState<string | null>(null);
  const [statsFetched, setStatsFetched] = useState(false);
  const [ownedAppIdSet, setOwnedAppIdSet] = useState<Set<string>>(new Set());

  const [exportCard, setExportCard] = useState<ExportCardState | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const [{ data, error: fetchError }, favs] = await Promise.all([
          supabase
            .from('quiz_results')
            .select('*')
            .eq('steam_id', user.steamId)
            .order('created_at', { ascending: false }),
          getFavorites(user.steamId).catch(() => [] as FavoriteGame[]),
        ]);

        if (fetchError) throw fetchError;
        const records = (data as QuizResultRecord[]) ?? [];
        setHistory(records);
        setFavorites(favs);

        const appIdSet = new Set<string>();
        for (const record of records) {
          for (const game of record.results.recommendations) {
            if (game.steamAppId) appIdSet.add(String(game.steamAppId));
          }
        }
        for (const fav of favs) {
          if (fav.game_source === 'steam' && fav.game_id) appIdSet.add(String(fav.game_id));
        }

        if (appIdSet.size > 0) {
          try {
            const appidsParam = Array.from(appIdSet).join(',');
            const r = await fetch(
              `/api/steam-playtime?steamid=${user.steamId}&appids=${encodeURIComponent(appidsParam)}`
            );
            if (r.ok) {
              const json = (await r.json()) as { playtime: Record<string, SteamStats> };
              setSteamStats(json.playtime ?? {});
            }
          } catch {
            // Non-fatal: Steam stats are supplemental and optional
          }
        }
      } catch (err: unknown) {
        console.error('Failed to fetch profile data:', err);
        setError('Failed to load profile data. Please try again.');
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [user.steamId]);

  // Lazy-load global stats when the user first opens the Stats tab
  useEffect(() => {
    if (activeTab === 'stats' && !statsFetched) {
      void loadGlobalStats();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  const applyGlobalStats = (stats: CachedSteamStats) => {
    setGlobalStats(stats);
    setOwnedAppIdSet(new Set(stats.ownedAppIds.map(String)));
  };

  const loadGlobalStats = async () => {
    setStatsLoading(true);
    setStatsError(null);
    try {
      const cached = await getCachedSteamStats(user.steamId);
      if (cached) {
        applyGlobalStats(cached);
      } else {
        const r = await fetch(`/api/steam-stats?steamid=${user.steamId}`);
        if (!r.ok) throw new Error('API error');
        const data = (await r.json()) as Omit<CachedSteamStats, 'updatedAt'>;
        const withTs: CachedSteamStats = { ...data, updatedAt: new Date().toISOString() };
        await saveSteamStats(user.steamId, withTs);
        applyGlobalStats(withTs);
      }
    } catch {
      setStatsError(
        'Could not load Steam stats. Your profile may be private, or the API is temporarily unavailable.'
      );
    } finally {
      setStatsLoading(false);
      setStatsFetched(true);
    }
  };

  const handleRefreshStats = async () => {
    setStatsLoading(true);
    setStatsError(null);
    try {
      const r = await fetch(`/api/steam-stats?steamid=${user.steamId}`);
      if (!r.ok) throw new Error('API error');
      const data = (await r.json()) as Omit<CachedSteamStats, 'updatedAt'>;
      const withTs: CachedSteamStats = { ...data, updatedAt: new Date().toISOString() };
      await saveSteamStats(user.steamId, withTs);
      applyGlobalStats(withTs);
    } catch {
      setStatsError('Refresh failed. Please try again later.');
    } finally {
      setStatsLoading(false);
    }
  };

  const handleRemoveFavorite = async (fav: FavoriteGame) => {
    try {
      await removeFavorite(user.steamId, fav.game_id, fav.game_source);
      setFavorites((prev) => prev.filter((f) => f.id !== fav.id));
    } catch (err) {
      console.error('Failed to remove favorite:', err);
    }
  };

  const isGameOwnedBound = (appId: string | number): boolean =>
    checkGameOwned(appId, steamStats, ownedAppIdSet);

  const handleExportQuizCard = (record: QuizResultRecord) => {
    const cardGames = buildExportCard(record, steamStats);
    setExportCard({ games: cardGames, label: 'Quiz Results', genres: record.answers.preferredGenres });
  };

  const handleExportFavoritesCard = () => {
    const cardGames = buildFavoritesExportCard(favorites, steamStats);
    setExportCard({ games: cardGames, label: 'My Wishlist' });
  };

  return {
    activeTab,
    setActiveTab,
    history,
    favorites,
    loading,
    error,
    expanded,
    setExpanded,
    steamStats,
    globalStats,
    statsLoading,
    statsError,
    ownedAppIdSet,
    exportCard,
    setExportCard,
    statsFetched,
    isGameOwned: isGameOwnedBound,
    handleRemoveFavorite,
    handleRefreshStats,
    handleExportQuizCard,
    handleExportFavoritesCard,
  };
}
