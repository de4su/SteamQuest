import React from 'react';
import { SteamUser } from '../types';
import ExportableCard from './ExportableCard';
import TabButton from './TabButton';
import { useProfileData } from '../hooks/useProfileData';
import { PLATFORM_ICONS, COUNTRY_FLAGS } from '../constants';
import { formatHours, relativeTime, toHours, formatSteamPlaytime } from '../utils/formatters';

interface ProfilePageProps {
  user: SteamUser;
  onBack: () => void;
}

const ProfilePage: React.FC<ProfilePageProps> = ({ user, onBack }) => {
  const {
    activeTab, setActiveTab,
    history, favorites,
    loading, error,
    expanded, setExpanded,
    steamStats,
    globalStats, statsLoading, statsError,
    exportCard, setExportCard,
    statsFetched,
    isGameOwned,
    handleRemoveFavorite,
    handleRefreshStats,
    handleExportQuizCard,
    handleExportFavoritesCard,
  } = useProfileData(user);

  return (
    <div className="animate-results w-full max-w-4xl mx-auto pointer-events-auto">
      {/* PNG export modal (rendered when user clicks "Export as PNG") */}
      {exportCard && (
        <ExportableCard
          user={user}
          games={exportCard.games}
          label={exportCard.label}
          genres={exportCard.genres}
          onClose={() => setExportCard(null)}
        />
      )}
      {/* Header */}
      <div className="mb-10 p-8 steam-card rounded-2xl flex flex-col md:flex-row items-center md:items-start gap-6 shadow-2xl border-l-8 border-l-blue-600">
        {user.avatarUrl ? (
          <img
            src={user.avatarUrl}
            alt={user.username}
            className="w-20 h-20 rounded-full border-4 border-blue-500/50 shadow-[0_0_20px_rgba(37,99,235,0.4)]"
          />
        ) : (
          <div className="w-20 h-20 rounded-full bg-blue-600 flex items-center justify-center text-white text-3xl font-black">
            {user.username.slice(0, 1).toUpperCase()}
          </div>
        )}
        <div className="text-center md:text-left">
          <h2 className="text-3xl font-black text-white uppercase tracking-tight mb-1">{user.username}</h2>
          <p className="text-gray-300 text-sm font-mono">Steam ID: {user.steamId}</p>
          <p className="text-blue-400 text-sm mt-2 font-semibold">
            {history.length} quiz result{history.length !== 1 ? 's' : ''} &bull; {favorites.length} favorite{favorites.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          onClick={onBack}
          className="md:ml-auto px-6 py-2 bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white rounded-full transition-all text-xs font-black tracking-widest uppercase border border-white/5"
        >
          &larr; Back
        </button>
      </div>

      {/* Content */}
      {loading && (
        <div className="py-20 text-center flex flex-col items-center animate-pulse">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4" />
          <p className="text-gray-300 font-black uppercase tracking-widest text-sm">Loading Profile…</p>
        </div>
      )}

      {error && (
        <div className="p-4 bg-red-950/40 border border-red-500/30 text-red-200 font-mono text-sm rounded-lg">
          {error}
        </div>
      )}

      {!loading && !error && (
        <>
          {/* Tabs */}
          <div className="flex gap-2 mb-6 border-b border-white/5 pb-4">
            <TabButton active={activeTab === 'history'} onClick={() => setActiveTab('history')} color="blue">
              Quiz History ({history.length})
            </TabButton>
            <TabButton active={activeTab === 'favorites'} onClick={() => setActiveTab('favorites')} color="pink">
              ♥ Wishlist ({favorites.length})
            </TabButton>
            <TabButton active={activeTab === 'stats'} onClick={() => setActiveTab('stats')} color="emerald">
              📊 Steam Stats
            </TabButton>
          </div>

          {/* Quiz History Tab */}
          {activeTab === 'history' && (
            <>
              {history.length === 0 && (
                <div className="py-20 text-center">
                  <p className="text-gray-400 font-black uppercase tracking-widest text-sm">No quiz results yet.</p>
                  <p className="text-gray-700 text-xs mt-2">Complete a quiz to see your history here.</p>
                </div>
              )}
              {history.length > 0 && (
                <div className="space-y-4">
                  {history.map((record) => {
                    const date = new Date(record.created_at).toLocaleDateString(undefined, {
                      year: 'numeric', month: 'short', day: 'numeric',
                    });
                    const isOpen = expanded === record.id;

                    return (
                      <div key={record.id} className="steam-card rounded-xl overflow-hidden shadow-xl">
                        <button
                          className="w-full p-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-3 text-left hover:bg-white/5 transition-colors"
                          onClick={() => setExpanded(isOpen ? null : record.id)}
                        >
                          <div>
                            <p className="text-white font-black uppercase tracking-tight text-sm">
                              {record.answers.preferredGenres.join(', ') || 'Any Genre'} &mdash; {record.answers.playstyle}
                            </p>
                            <p className="text-gray-300 text-xs mt-0.5">
                              {record.results.recommendations.length} recommendations &bull; {record.answers.timeAvailability} session &bull; {date}
                            </p>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-blue-400 font-black text-xl">
                              {record.results.accuracy?.percentage ?? 0}%
                            </span>
                            <span className="text-gray-400 text-xs">{isOpen ? '▲' : '▼'}</span>
                          </div>
                        </button>

                        {isOpen && (
                          <div className="border-t border-white/5 p-4 space-y-2">
                            {/* Export button for this quiz result */}
                            <div className="flex justify-end mb-1">
                              <button
                                onClick={() => handleExportQuizCard(record)}
                                className="text-[10px] font-black uppercase tracking-widest px-3 py-1 bg-blue-600/15 border border-blue-500/30 text-blue-400 hover:text-white hover:bg-blue-600/30 rounded-full transition-all"
                              >
                                ⬇ Export as PNG
                              </button>
                            </div>
                            {record.results.recommendations.map((game, idx) => {
                              // Pull live Steam stats for this game if available
                              const stats = steamStats[String(game.steamAppId)];
                              const hasPlaytime = stats?.playtimeMinutes !== null && stats?.playtimeMinutes !== undefined;
                              const hasAchievements =
                                stats?.achievementsUnlocked !== null &&
                                stats?.achievementsTotal !== null &&
                                stats?.achievementsTotal !== undefined &&
                                stats.achievementsTotal > 0;

                              return (
                              <div
                                key={game.steamAppId ?? idx}
                                className="flex items-center gap-3 p-3 bg-white/5 hover:bg-white/8 rounded-lg border border-white/5 hover:border-blue-500/20 transition-all group"
                              >
                                {/* Game artwork */}
                                <img
                                  src={`https://cdn.akamai.steamstatic.com/steam/apps/${game.steamAppId}/header.jpg`}
                                  alt={game.title}
                                  draggable={false}
                                  className="w-20 h-12 object-cover rounded-md shrink-0 select-none"
                                  onDragStart={(e) => e.preventDefault()}
                                  onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                  style={{ pointerEvents: 'none' }}
                                />
                                {/* Game info */}
                                <div className="flex-1 min-w-0">
                                  <p className="text-white text-xs font-black truncate group-hover:text-blue-400 transition-colors mb-0.5">
                                    {game.title}
                                  </p>
                                  <div className="flex items-center gap-2 flex-wrap">
                                    {/* Steam games are always PC platform */}
                                    <span className="text-[10px] font-black uppercase px-1.5 py-0.5 bg-[#66c0f4]/10 border border-[#66c0f4]/20 text-[#66c0f4] rounded">PC</span>
                                    {/* Live Steam playtime takes priority over HLTB estimate */}
                                    {hasPlaytime && (stats?.playtimeMinutes ?? 0) > 0 ? (
                                      <span className="text-green-400 text-[10px] font-mono">
                                        🎮 {formatSteamPlaytime(stats?.playtimeMinutes ?? 0)}
                                      </span>
                                    ) : game.mainStoryTime > 0 ? (
                                      <span className="text-gray-400 text-[10px] font-mono">⏱ {game.mainStoryTime}h main{game.completionistTime > 0 ? ` · ${game.completionistTime}h full` : ''}</span>
                                    ) : null}
                                    {/* Achievement progress */}
                                    {hasAchievements && (
                                      <span className="text-yellow-500/70 text-[10px] font-mono">
                                        🏆 {stats?.achievementsUnlocked}/{stats?.achievementsTotal}
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <div className="shrink-0 flex flex-col items-end gap-1.5">
                                  {/* "Already Owned" badge when the game is in the user's library */}
                                  {isGameOwned(game.steamAppId) ? (
                                    <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 bg-green-500/10 border border-green-500/30 text-green-400 rounded-full">
                                      ✓ Owned
                                    </span>
                                  ) : (
                                    <div className="flex gap-1.5">
                                      <a
                                        href={`https://store.steampowered.com/app/${game.steamAppId}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-[10px] font-black uppercase tracking-wide px-2 py-0.5 bg-[#66c0f4]/10 border border-[#66c0f4]/20 text-[#66c0f4] hover:text-white rounded transition-all"
                                      >
                                        Steam{game.steamPrice ? ` · ${game.steamPrice}` : ''}
                                      </a>
                                      {game.dealUrl && (
                                        <a
                                          href={game.dealUrl}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="text-[10px] font-black uppercase tracking-wide px-2 py-0.5 bg-green-500/10 border border-green-500/20 text-green-400 hover:text-white rounded transition-all"
                                        >
                                          Deal
                                        </a>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </div>
                            );})}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}

          {/* Favorites Tab */}
          {activeTab === 'favorites' && (
            <>
              {favorites.length === 0 && (
                <div className="py-20 text-center">
                  <p className="text-gray-400 font-black uppercase tracking-widest text-sm">No favorites yet.</p>
                  <p className="text-gray-700 text-xs mt-2">Click the ♥ on any game to add it to your wishlist.</p>
                </div>
              )}
              {favorites.length > 0 && (
                <div className="space-y-2">
                  {favorites.map((fav) => {
                    const isSteam = fav.game_source === 'steam';
                    const data = fav.game_data as Record<string, unknown> | null;

                    // Parse RAWG parent_platforms for non-Steam favorites
                    const rawgParents = (data?.parent_platforms as Array<{ platform: { slug: string; name: string } }> | undefined) ?? [];
                    // True when a RAWG game lists PC as one of its platforms
                    const rawgIsOnPC = !isSteam && rawgParents.some((p) => p.platform.slug === 'pc');

                    // Platform badges with icons: Steam → 'PC'; RAWG → all parent platforms
                    const platforms: string[] = isSteam
                      ? ['🖥️ PC']
                      : rawgParents
                          .slice(0, 5)
                          .map((p) => PLATFORM_ICONS[p.platform.slug] ?? p.platform.name);

                    // Steam store link: Steam games use direct app URL; RAWG PC games use search
                    const storeUrl = isSteam
                      ? `https://store.steampowered.com/app/${fav.game_id}`
                      : rawgIsOnPC
                      ? `https://store.steampowered.com/search/?term=${encodeURIComponent(fav.game_title)}`
                      : undefined;

                    // gg.deals link: Steam games use stored dealUrl; RAWG PC games get search URL
                    const dealUrl = isSteam
                      ? (data?.dealUrl as string | undefined)
                      : rawgIsOnPC
                      ? `https://gg.deals/search/?title=${encodeURIComponent(fav.game_title)}`
                      : undefined;

                    // Steam price label (only available for Steam-sourced recommendations)
                    const steamPrice = isSteam ? (data?.steamPrice as string | undefined) : undefined;

                    // Genres for display (Steam: string[]; RAWG: {name}[])
                    const genres: string[] = data
                      ? isSteam
                        ? (data.genres as string[] | undefined) ?? []
                        : ((data.genres as Array<{ name: string }> | undefined) ?? []).map((g) => g.name)
                      : [];

                    // Playtime: live Steam takes priority, then HLTB/RAWG estimate
                    const mainTime = isSteam ? (data?.mainStoryTime as number | undefined) : undefined;
                    const completionistTime = isSteam ? (data?.completionistTime as number | undefined) : undefined;
                    const rawgPlaytime = !isSteam ? (data?.playtime as number | undefined) : undefined;

                    // Live Steam stats — only for Steam-sourced games
                    const stats = isSteam ? steamStats[String(fav.game_id)] : undefined;
                    const hasLivePlaytime = (stats?.playtimeMinutes ?? null) !== null;
                    const hasAchievements =
                      stats?.achievementsUnlocked !== null &&
                      stats?.achievementsTotal !== null &&
                      stats?.achievementsTotal !== undefined &&
                      stats.achievementsTotal > 0;

                    return (
                      <div
                        key={fav.id}
                        className="flex items-center gap-4 p-3 steam-card rounded-xl border border-white/5 hover:border-blue-500/20 transition-all group"
                      >
                        {/* Game artwork */}
                        {fav.game_image ? (
                          <img
                            src={fav.game_image}
                            alt={fav.game_title}
                            draggable={false}
                            className="w-24 h-14 object-cover rounded-lg shrink-0 select-none"
                            onDragStart={(e) => e.preventDefault()}
                            onError={(e) => { e.currentTarget.style.display = 'none'; }}
                            style={{ pointerEvents: 'none' }}
                          />
                        ) : (
                          <div className="w-24 h-14 bg-gray-800/50 rounded-lg shrink-0 flex items-center justify-center">
                            <span className="text-gray-700 text-[10px]">No Art</span>
                          </div>
                        )}

                        {/* Game info */}
                        <div className="flex-1 min-w-0">
                          <p className="text-white text-sm font-black uppercase tracking-tight truncate group-hover:text-blue-400 transition-colors mb-1">
                            {fav.game_title}
                          </p>
                          {/* Platform badges — all real gaming platforms with icons.
                              PC platforms get the Steam blue tint; others get a neutral style. */}
                          {platforms.length > 0 && (
                            <div className="flex flex-wrap gap-1 mb-1">
                              {platforms.map((p) => (
                                <span
                                  key={p}
                                  className={`text-[10px] font-black px-1.5 py-0.5 rounded border ${
                                    p.includes('PC')
                                      ? 'bg-[#66c0f4]/10 border-[#66c0f4]/20 text-[#66c0f4]'
                                      : p.includes('PlayStation')
                                      ? 'bg-blue-900/20 border-blue-700/30 text-blue-300'
                                      : p.includes('Xbox')
                                      ? 'bg-green-900/20 border-green-700/30 text-green-300'
                                      : p.includes('Nintendo')
                                      ? 'bg-red-900/20 border-red-700/30 text-red-300'
                                      : 'bg-white/5 border-white/10 text-gray-300'
                                  }`}
                                >
                                  {p}
                                </span>
                              ))}
                            </div>
                          )}
                          {/* Genre labels (subtle) */}
                          {genres.length > 0 && (
                            <div className="flex flex-wrap gap-1 mb-1">
                              {genres.slice(0, 3).map((g) => (
                                <span key={g} className="text-[10px] text-gray-400 font-medium">{g}</span>
                              ))}
                            </div>
                          )}
                          {/* Playtime: live Steam playtime takes priority over HLTB/RAWG estimates.
                              Falls back to "~10h avg" for Steam games when the user doesn't own
                              the game or their profile is private. */}
                          {hasLivePlaytime && (stats?.playtimeMinutes ?? 0) > 0 ? (
                            <p className="text-green-400 text-[10px] font-mono">
                              🎮 {formatSteamPlaytime(stats?.playtimeMinutes ?? 0)}
                            </p>
                          ) : (mainTime || completionistTime || rawgPlaytime) ? (
                            <p className="text-gray-400 text-[10px] font-mono">
                              {mainTime ? `⏱ ${mainTime}h main` : ''}
                              {completionistTime ? ` · ${completionistTime}h full` : ''}
                              {rawgPlaytime && !mainTime ? `⏱ ~${rawgPlaytime}h avg` : ''}
                            </p>
                          ) : isSteam ? (
                            /* Fallback: user doesn't own the game or API is unavailable */
                            <p className="text-gray-700 text-[10px] font-mono">⏱ ~10h avg play time</p>
                          ) : null}
                          {/* Achievement progress (Steam only).
                              Shows "N/A" when the game has no achievements or the user doesn't own it. */}
                          {isSteam && (
                            hasAchievements ? (
                              <p className="text-yellow-500/70 text-[10px] font-mono mt-0.5">
                                🏆 {stats?.achievementsUnlocked} / {stats?.achievementsTotal} achievements
                              </p>
                            ) : (
                              <p className="text-gray-700 text-[10px] font-mono mt-0.5">
                                🏆 Achievements: N/A
                              </p>
                            )
                          )}
                        </div>

                        {/* store/deal links + remove */}
                        <div className="flex flex-col items-end gap-2 shrink-0">
                          {/* "Already Owned" badge for Steam games the user owns */}
                          {isSteam && isGameOwned(fav.game_id) ? (
                            <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 bg-green-500/10 border border-green-500/30 text-green-400 rounded-full">
                              ✓ Owned
                            </span>
                          ) : (
                            <div className="flex gap-1.5 flex-wrap justify-end">
                              {storeUrl && (
                                <a
                                  href={storeUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-[10px] font-black uppercase tracking-wide px-2 py-0.5 bg-[#66c0f4]/10 border border-[#66c0f4]/20 text-[#66c0f4] hover:text-white rounded transition-all"
                                >
                                  Steam{steamPrice ? ` · ${steamPrice}` : ''}
                                </a>
                              )}
                              {dealUrl && (
                                <a
                                  href={dealUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-[10px] font-black uppercase tracking-wide px-2 py-0.5 bg-green-500/10 border border-green-500/20 text-green-400 hover:text-white rounded transition-all"
                                >
                                  Deal
                                </a>
                              )}
                            </div>
                          )}
                          <button
                            onClick={() => handleRemoveFavorite(fav)}
                            className="text-[10px] font-black uppercase tracking-widest text-red-400 hover:text-red-300 transition-colors"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}

          {/* Steam Stats Tab */}
          {activeTab === 'stats' && (
            <div className="space-y-6">
              {/* Header row: last-updated note + refresh button */}
              <div className="flex items-center justify-between">
                <p className="text-gray-300 text-xs">
                  {globalStats
                    ? `Last updated: ${relativeTime(globalStats.updatedAt)}`
                    : statsLoading
                    ? 'Loading stats…'
                    : 'Stats not yet loaded'}
                </p>
                <button
                  onClick={handleRefreshStats}
                  disabled={statsLoading}
                  className="text-[10px] font-black uppercase tracking-widest px-3 py-1.5 bg-emerald-600/15 border border-emerald-500/30 text-emerald-400 hover:text-white hover:bg-emerald-600/30 rounded-full transition-all disabled:opacity-50"
                >
                  {statsLoading ? '⟳ Refreshing…' : '⟳ Refresh Stats'}
                </button>
              </div>

              {/* Error state */}
              {statsError && (
                <div className="p-4 bg-red-950/40 border border-red-500/30 text-red-200 font-mono text-sm rounded-lg">
                  {statsError}
                  <button
                    onClick={handleRefreshStats}
                    className="ml-4 text-[10px] font-black uppercase tracking-widest px-3 py-1 bg-emerald-600/15 border border-emerald-500/30 text-emerald-400 hover:text-white hover:bg-emerald-600/30 rounded-full transition-all"
                  >
                    Try Refresh
                  </button>
                </div>
              )}

              {/* Loading spinner */}
              {statsLoading && !globalStats && (
                <div className="py-16 text-center flex flex-col items-center animate-pulse">
                  <div className="w-10 h-10 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mb-4" />
                  <p className="text-gray-300 font-black uppercase tracking-widest text-xs">Fetching Steam data…</p>
                </div>
              )}

              {/* Empty / private profile state */}
              {!statsLoading && !statsError && globalStats === null && statsFetched && (
                <div className="py-20 text-center steam-card rounded-2xl p-8">
                  <p className="text-gray-200 font-black uppercase tracking-widest text-sm mb-2">No stats available</p>
                  <p className="text-gray-400 text-xs mb-6">Your Steam profile may be set to private, or the API is temporarily unavailable.</p>
                  <button
                    onClick={handleRefreshStats}
                    className="text-[10px] font-black uppercase tracking-widest px-4 py-2 bg-emerald-600/15 border border-emerald-500/30 text-emerald-400 hover:text-white hover:bg-emerald-600/30 rounded-full transition-all"
                  >
                    ⟳ Try Refresh
                  </button>
                </div>
              )}

              {globalStats && (
                <>
                  {/* Overview cards */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                      {
                        icon: '🎮',
                        label: 'Total Games',
                        value: globalStats.totalGames !== null ? globalStats.totalGames.toLocaleString() : '—',
                      },
                      {
                        icon: '▶️',
                        label: 'Played',
                        value:
                          globalStats.gamesPlayed !== null
                            ? `${globalStats.gamesPlayed.toLocaleString()}${
                                globalStats.totalGames
                                  ? ` (${((globalStats.gamesPlayed / globalStats.totalGames) * 100).toFixed(0)}%)`
                                  : ''
                              }`
                            : '—',
                      },
                      {
                        icon: '⏱️',
                        label: 'Total Playtime',
                        value:
                          globalStats.totalPlaytimeMinutes !== null
                            ? formatHours(globalStats.totalPlaytimeMinutes)
                            : '—',
                      },
                      {
                        icon: '📈',
                        label: 'Avg / Game',
                        value:
                          globalStats.avgPlaytimeMinutes !== null
                            ? formatHours(globalStats.avgPlaytimeMinutes)
                            : '—',
                      },
                    ].map((card) => (
                      <div key={card.label} className="steam-card rounded-xl p-4 text-center">
                        <p className="text-2xl mb-1">{card.icon}</p>
                        <p className="text-white font-black text-lg leading-tight">{card.value}</p>
                        <p className="text-gray-300 text-[10px] uppercase tracking-widest mt-0.5">{card.label}</p>
                      </div>
                    ))}
                  </div>

                  {/* Steam Level + Account Age cards side-by-side */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {/* Steam Level card */}
                    {globalStats.steamLevel !== null && (
                      <div className="steam-card rounded-xl p-5">
                        <div className="flex items-center gap-4 mb-3">
                          <span className="text-5xl font-black text-[#66c0f4] leading-none">
                            {globalStats.steamLevel}
                          </span>
                          <div>
                            <p className="text-white font-black uppercase tracking-tight text-sm">Steam Level</p>
                            {globalStats.xpToNextLevel !== null && globalStats.xpEarnedInLevel !== null && (
                              <p className="text-gray-300 text-xs">
                                {globalStats.xpEarnedInLevel.toLocaleString()} / {globalStats.xpToNextLevel.toLocaleString()} XP
                              </p>
                            )}
                          </div>
                        </div>
                        {globalStats.xpToNextLevel !== null && globalStats.xpEarnedInLevel !== null && globalStats.xpToNextLevel > 0 && (
                          <>
                            <div className="w-full bg-white/10 rounded-full h-2 overflow-hidden">
                              <div
                                className="bg-[#66c0f4] h-2 rounded-full transition-all"
                                style={{
                                  width: `${Math.min(100, (globalStats.xpEarnedInLevel / globalStats.xpToNextLevel) * 100).toFixed(1)}%`,
                                }}
                              />
                            </div>
                            <p className="text-gray-400 text-[10px] mt-1">
                              {(globalStats.xpToNextLevel - globalStats.xpEarnedInLevel).toLocaleString()} XP to next level
                            </p>
                          </>
                        )}
                      </div>
                    )}

                    {/* Account Age card */}
{(globalStats.countryCode || globalStats.accountCreated) && (
  <div className="steam-card rounded-xl p-5">
    <div className="flex items-center gap-4 mb-3">
      <span className="text-5xl font-black text-[#66c0f4] leading-none">
        {globalStats.accountCreated
          ? Math.floor((Date.now() / 1000 - globalStats.accountCreated) / (365.25 * 24 * 3600))
          : '—'}
      </span>
      <div>
        <p className="text-white font-black uppercase tracking-tight text-sm">Account Age</p>
        <p className="text-gray-400 text-xs">years on Steam</p>
      </div>
    </div>
    {globalStats.countryCode && (
      <p className="text-gray-300 text-xs font-semibold">
        {COUNTRY_FLAGS[globalStats.countryCode] ?? '🌐'} {globalStats.countryCode}
      </p>
    )}
  </div>
)}
                    
                  </div>

                  {/* Recently Played + Top Played side-by-side */}
                  {(globalStats.recentlyPlayed.length > 0 || globalStats.topPlayed.length > 0) && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Recently Played */}
                      {globalStats.recentlyPlayed.length > 0 && (
                        <div className="steam-card rounded-xl p-5">
                          <p className="text-white font-black uppercase tracking-tight text-sm mb-3">🕐 Recently Played</p>
                          <div className="space-y-2">
                            {globalStats.recentlyPlayed.map((g) => (
                              <div key={g.appid} className="flex items-center gap-3 p-2 bg-white/5 rounded-lg">
                                <img
                                  src={g.headerImage || `https://cdn.akamai.steamstatic.com/steam/apps/${g.appid}/header.jpg`}
                                  alt={g.name}
                                  className="w-20 h-12 object-cover rounded-md shrink-0"
                                  onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                />
                                <div className="flex-1 min-w-0">
                                  <p className="text-white text-xs font-black truncate">{g.name}</p>
                                  <p className="text-gray-300 text-[10px] font-mono">
                                    {g.playtime2weeks != null ? `${toHours(g.playtime2weeks)} this week` : ''}
                                    {g.playtime2weeks != null && g.playtimeForever > 0 ? ' · ' : ''}
                                    {g.playtimeForever > 0 ? `${toHours(g.playtimeForever)} total` : ''}
                                  </p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Top Played */}
                      {globalStats.topPlayed.length > 0 && (
                        <div className="steam-card rounded-xl p-5">
                          <p className="text-white font-black uppercase tracking-tight text-sm mb-3">🏆 Top Played</p>
                          <div className="space-y-2">
                            {globalStats.topPlayed.map((g) => (
                              <div key={g.appid} className="flex items-center gap-3 p-2 bg-white/5 rounded-lg">
                                <img
                                  src={g.headerImage || `https://cdn.akamai.steamstatic.com/steam/apps/${g.appid}/header.jpg`}
                                  alt={g.name}
                                  className="w-20 h-12 object-cover rounded-md shrink-0"
                                  onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                />
                                <div className="flex-1 min-w-0">
                                  <p className="text-white text-xs font-black truncate">{g.name}</p>
                                  <p className="text-gray-300 text-[10px] font-mono">
                                    {g.playtimeForever > 0 ? `${toHours(g.playtimeForever)} total` : 'No playtime recorded'}
                                  </p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default ProfilePage;