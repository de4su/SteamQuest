import React, { useState, useCallback, useEffect, useRef } from 'react';
import { QuizAnswers, RecommendationResponse, RawgGame, Suggestion, SteamUser, GameFilters } from './types';
import { getGameRecommendations, searchSpecificGame } from './services/aiFunctionality';
import {
  searchGamesWithFilters,
  getGamesByDeveloper,
  getGamesByPublisher,
} from './services/rawgService';
import Quiz from './components/Quiz';
import GameCard from './components/GameCard';
import HexBackground from './components/HexBackground';
import SearchAutocomplete from './components/SearchAutocomplete';
import RawgGameCard from './components/RawgGameCard';
import LoginButton from './components/LoginButton';
import ProfilePage from './components/ProfilePage';
import SearchFilters from './components/SearchFilters';

type AppView = 'welcome' | 'quiz' | 'loading' | 'results' | 'rawg' | 'profile';
type RawgMode = 'search' | 'developer' | 'publisher';

const App: React.FC = () => {
  const [view, setView] = useState<AppView>('welcome');
  const [results, setResults] = useState<RecommendationResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [steamUser, setSteamUser] = useState<SteamUser | null>(null);
  const [retryInfo, setRetryInfo] = useState<{ attempt: number; max: number } | null>(null);
  const lastActionRef = useRef<(() => void) | null>(null);

  // RAWG results state
  const [rawgGames, setRawgGames] = useState<RawgGame[]>([]);
  const [rawgMode, setRawgMode] = useState<RawgMode>('search');
  const [rawgLabel, setRawgLabel] = useState('');
  const [rawgPage, setRawgPage] = useState(1);
  const [rawgTotal, setRawgTotal] = useState(0);
  const [rawgEntityId, setRawgEntityId] = useState<number | null>(null);
  const [rawgLoadingMore, setRawgLoadingMore] = useState(false);

  // Search filter state
  const [searchFilters, setSearchFilters] = useState<GameFilters>({});
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [currentSearchQuery, setCurrentSearchQuery] = useState<string>('');

  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => r.json())
      .then((user: SteamUser | null) => {
        if (user?.steamId) setSteamUser(user);
      })
      .catch(() => {});

    const url = new URL(window.location.href);
    if (url.searchParams.has('loggedIn')) {
      url.searchParams.delete('loggedIn');
      window.history.replaceState({}, '', url.toString());
    }
  }, []);

  const handleLogout = useCallback(async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    setSteamUser(null);
    if (view === 'profile') setView('welcome');
  }, [view]);

  const handleQuizComplete = async (answers: QuizAnswers) => {
    setView('loading');
    setError(null);
    setRetryInfo(null);
    lastActionRef.current = () => handleQuizComplete(answers);
    try {
      const data = await getGameRecommendations(answers, steamUser?.steamId, (attempt, max) => {
        setRetryInfo({ attempt, max });
      });
      lastActionRef.current = null;
      setRetryInfo(null);
      setResults(data);
      setView('results');
    } catch (err: unknown) {
      console.error(err);
      const message = err instanceof Error ? err.message : 'Connection to the Steam archives lost. Check your API key.';
      setError(message);
      setView('welcome');
    }
  };

  // RAWG suggestion handler
  const handleSuggestionSelect = useCallback(async (suggestion: Suggestion) => {
    setView('loading');
    setError(null);
    setSearchFilters({});
    setFiltersOpen(false);
    try {
      let res;
      if (suggestion.kind === 'game') {
        setRawgMode('search');
        setCurrentSearchQuery(suggestion.name);
        res = await searchGamesWithFilters(suggestion.name, {});
        setRawgLabel(`Search: ${suggestion.name}`);
        setRawgEntityId(null);
      } else if (suggestion.kind === 'developer') {
        setRawgMode('developer');
        setCurrentSearchQuery(suggestion.name);
        res = await getGamesByDeveloper(suggestion.id, 1, 20);
        setRawgLabel(`Developer: ${suggestion.name}`);
        setRawgEntityId(suggestion.id);
      } else {
        setRawgMode('publisher');
        setCurrentSearchQuery(suggestion.name);
        res = await getGamesByPublisher(suggestion.id, 1, 20);
        setRawgLabel(`Publisher: ${suggestion.name}`);
        setRawgEntityId(suggestion.id);
      }
      setRawgGames(res.results);
      setRawgTotal(res.count);
      setRawgPage(1);
      setView('rawg');
    } catch (err) {
      console.error(err);
      setError('Search failed. Please try again.');
      setView('welcome');
    }
  }, []);

  const handleLoadMore = useCallback(async () => {
    const nextPage = rawgPage + 1;
    setRawgLoadingMore(true);
    try {
      let res;
      if (rawgMode === 'search') {
        res = await searchGamesWithFilters(currentSearchQuery, { ...searchFilters, page: nextPage });
      } else if (rawgMode === 'developer' && rawgEntityId !== null) {
        res = await getGamesByDeveloper(rawgEntityId, nextPage, 20);
      } else if (rawgMode === 'publisher' && rawgEntityId !== null) {
        res = await getGamesByPublisher(rawgEntityId, nextPage, 20);
      } else {
        return;
      }
      setRawgGames((prev) => [...prev, ...res.results]);
      setRawgPage(nextPage);
    } catch (err) {
      console.error(err);
    } finally {
      setRawgLoadingMore(false);
    }
  }, [rawgPage, rawgMode, currentSearchQuery, rawgEntityId, searchFilters]);

  const handleFilterChange = useCallback(async (newFilters: GameFilters) => {
    setSearchFilters(newFilters);
    setView('loading');
    try {
      let res;
      if (rawgMode === 'search') {
        res = await searchGamesWithFilters(currentSearchQuery, newFilters);
      } else if (rawgMode === 'developer' && rawgEntityId !== null) {
        res = await getGamesByDeveloper(rawgEntityId, 1, 20);
      } else if (rawgMode === 'publisher' && rawgEntityId !== null) {
        res = await getGamesByPublisher(rawgEntityId, 1, 20);
      }
      if (res) {
        setRawgGames(res.results);
        setRawgTotal(res.count);
        setRawgPage(1);
      }
      setView('rawg');
    } catch (err) {
      console.error(err);
      setView('rawg');
    }
  }, [rawgMode, currentSearchQuery, rawgEntityId]);

  const handleRawgGameClick = useCallback(async (rawgGame: RawgGame) => {
    setView('loading');
    setError(null);
    setRetryInfo(null);
    lastActionRef.current = () => handleRawgGameClick(rawgGame);
    try {
      const enriched = await searchSpecificGame(rawgGame.name, (attempt, max) => {
        setRetryInfo({ attempt, max });
      });
      lastActionRef.current = null;
      setRetryInfo(null);
      setResults({
        recommendations: [enriched],
        accuracy: {
          percentage: enriched.suitabilityScore ?? 100,
          reasoning: `Enriched result for "${rawgGame.name}" selected from RAWG search.`,
        },
      });
      setView('results');
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to enrich game. Please try again.');
      setView('rawg');
    }
  }, []);

  return (
    <div className="min-h-screen relative overflow-x-hidden">
      <HexBackground />

      {/* pointer-events-none on this wrapper lets the hex background receive mouse events;
          each interactive section restores pointer events with pointer-events-auto */}
      <div className="relative z-10 min-h-screen flex flex-col pointer-events-none">
        <nav className="p-6 border-b border-white/5 sticky top-0 bg-[#171a21]/70 backdrop-blur-2xl z-50 pointer-events-auto">
          <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
            <div 
              onClick={() => setView('welcome')} 
              className="cursor-pointer flex items-center group"
            >
              <img
                src="/logo.png"
                alt="SteamQuest"
                className="h-16 w-auto object-contain transition-opacity group-hover:opacity-80"
              />
            </div>
            <SearchAutocomplete onSelect={handleSuggestionSelect} />
            <LoginButton
              user={steamUser}
              onProfileClick={() => setView('profile')}
              onLogout={handleLogout}
            />
          </div>
        </nav>

        <main className="flex-grow max-w-7xl mx-auto px-6 py-12 w-full flex flex-col items-center justify-center">
          {view === 'welcome' && (
            <div className="text-center py-20 welcome-container pointer-events-auto">
              <h1 className="text-6xl md:text-8xl font-black text-white mb-6 tracking-tighter leading-none drop-shadow-[0_10px_10px_rgba(0,0,0,0.5)] select-none pointer-events-none">
                DISCOVER YOUR<br/>
                NEXT OBSESSION
              </h1>
              <p className="text-gray-300 mb-12 max-w-xl mx-auto text-lg font-medium bg-black/40 backdrop-blur-sm p-4 rounded-2xl border border-white/5 select-none pointer-events-none">
                Our AI analyzes thousands of Steam titles to find games that match your specific playstyle and time constraints.
              </p>
              <button 
                onClick={() => setView('quiz')}
                 className="px-16 py-5 bg-[#66c0f4] hover:bg-[#00d2ff] text-[#0d1117] rounded-full font-black text-xl shadow-[0_0_40px_rgba(102,192,244,0.4)] transition-all active:scale-95 hover:scale-110 active:shadow-none"
              >
                START THE QUIZ
              </button>
              {error && (
                <div className="mt-12 p-4 bg-red-950/40 border border-red-500/30 text-red-200 font-mono text-sm rounded-lg max-w-md mx-auto backdrop-blur-md">
                  {error}
                  {lastActionRef.current && (
                    <button
                      onClick={() => lastActionRef.current?.()}
                      className="mt-3 w-full px-4 py-2 bg-red-700/40 hover:bg-red-600/50 text-red-100 rounded-md font-black text-xs uppercase tracking-widest transition-all border border-red-500/30"
                    >
                      ↺ Retry
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {view === 'loading' && (
            <div className="py-40 text-center flex flex-col items-center animate-pulse pointer-events-none">
              <div className="w-20 h-20 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-8 shadow-[0_0_30px_rgba(37,99,235,0.3)]"></div>
              <h3 className="text-2xl font-black text-white tracking-widest uppercase">Querying Steam Database...</h3>
              <p className="text-gray-300 mt-2">Determining playtimes and compatibility scores</p>
              {retryInfo && (
                <p className="text-yellow-400 mt-3 text-sm font-mono">
                  Retrying… (attempt {retryInfo.attempt} of {retryInfo.max})
                </p>
              )}
            </div>
          )}

          {view === 'results' && results && (
            <div className="animate-results w-full pointer-events-auto">
              <div className="mb-10 p-10 steam-card border-l-8 border-l-blue-600 rounded-2xl flex flex-col md:flex-row justify-between items-center gap-8 shadow-2xl">
                <div className="text-center md:text-left">
                  <h2 className="text-3xl font-black text-white mb-2 uppercase tracking-tight">Curation Complete</h2>
                  <p className="text-gray-300 text-lg max-w-2xl font-medium leading-relaxed italic">
                    "{results.accuracy?.reasoning}"
                  </p>
                </div>
                <div className="flex flex-col items-center bg-blue-600/10 p-6 rounded-2xl border border-blue-500/20">
                  <span className="text-6xl font-stats text-blue-500 drop-shadow-[0_0_10px_rgba(102,192,244,0.3)]">{results.accuracy?.percentage || 0}%</span>
                  <span className="text-[10px] font-black text-blue-500 tracking-widest mt-1">MATCH STRENGTH</span>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {results.recommendations.map((game, idx) => (
                  <GameCard key={game.id || idx} game={game} user={steamUser} />
                ))}
              </div>

              <div className="mt-20 text-center">
                <button 
                  onClick={() => setView('quiz')}
                  className="px-10 py-4 bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white rounded-full transition-all text-sm font-black tracking-widest uppercase border border-white/5 backdrop-blur-xl"
                >
                  &larr; Refine Parameters
                </button>
              </div>
            </div>
          )}

          {view === 'rawg' && (
            <div className="animate-results w-full pointer-events-auto">
              <div className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                  <h2 className="text-2xl font-black text-white uppercase tracking-tight">{rawgLabel}</h2>
                  <p className="text-gray-300 text-sm mt-1">{rawgTotal.toLocaleString()} results found</p>
                </div>
                <div className="flex gap-4 shrink-0">
                  {rawgMode === 'search' && (
                    <SearchFilters
                      filters={searchFilters}
                      onChange={handleFilterChange}
                      isOpen={filtersOpen}
                      onToggle={() => setFiltersOpen(!filtersOpen)}
                    />
                  )}
                  <button
                    onClick={() => setView('welcome')}
                    className="px-6 py-2 bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white rounded-full transition-all text-xs font-black tracking-widest uppercase border border-white/5 backdrop-blur-xl"
                  >
                    &larr; Back
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {rawgGames.map((game) => (
                  <RawgGameCard key={game.id} game={game} onClick={handleRawgGameClick} user={steamUser} />
                ))}
              </div>

              {rawgGames.length < rawgTotal && (
                <div className="mt-12 text-center">
                  <button
                    onClick={handleLoadMore}
                    disabled={rawgLoadingMore}
                    className="px-10 py-4 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-full font-black text-sm uppercase tracking-widest transition-all shadow-[0_0_30px_rgba(37,99,235,0.3)]"
                  >
                    {rawgLoadingMore ? (
                      <span className="flex items-center gap-2">
                        <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin inline-block" />
                        Loading…
                      </span>
                    ) : (
                      `Load More (${rawgGames.length} / ${rawgTotal})`
                    )}
                  </button>
                </div>
              )}
            </div>
          )}

          {view === 'quiz' && (
            <div className="w-full pointer-events-auto">
              <Quiz onComplete={handleQuizComplete} user={steamUser} />
            </div>
          )}

          {view === 'profile' && steamUser && (
            <ProfilePage user={steamUser} onBack={() => setView('welcome')} />
          )}
        </main>
      </div>
    </div>
  );
};

export default App;
