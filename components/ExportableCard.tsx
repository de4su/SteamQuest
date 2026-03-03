/**
 * ExportableCard.tsx
 *
 * A visually polished card component that can be exported as a PNG image.
 * Used for both quiz-result exports and favorites/wishlist exports.
 *
 * Layout: compact 3-column grid of tiles so more games fit per export and
 * the image stays manageable in size.  Quiz exports include a genre header
 * strip showing the genres chosen for that session.
 *
 * Usage:
 *   <ExportableCard
 *     user={steamUser}
 *     games={[...]}           // CardGame[] built from recommendations or favorites
 *     label="My Wishlist"
 *     genres={['Action', 'RPG']}  // optional — shown only for quiz exports
 *     onClose={() => {}}
 *   />
 */

import React, { useRef, useState } from 'react';
import { toPng } from 'html-to-image';
import { SteamUser } from '../types';

// ─── Shared types ────────────────────────────────────────────────────────────

export interface CardGame {
  /** Display title */
  title: string;
  /** Cover / header image URL */
  imageUrl: string | null;
  /** Platform labels to show (e.g. ['PC'] or ['PC', 'PlayStation']) */
  platforms: string[];
  /** Suitability / match percentage (0-100), null if not applicable */
  suitabilityScore: number | null;
  /** How-Long-To-Beat main story hours */
  mainStoryTime: number | null;
  /** How-Long-To-Beat completionist hours */
  completionistTime: number | null;
  /** Steam actual playtime in minutes (from the user's library) */
  steamPlaytimeMinutes: number | null;
  /** Achievement progress string, e.g. "12 / 47", or "N/A" */
  achievements: string | null;
  /** AI-generated reason for this pick, displayed in italic */
  reasonForPick: string | null;
}

interface ExportableCardProps {
  user: SteamUser;
  games: CardGame[];
  /** Short label shown at the top of the card, e.g. "Quiz Results" or "My Wishlist" */
  label: string;
  /**
   * Quiz genres chosen for this session (e.g. ['Action', 'RPG']).
   * When provided a genre strip is rendered beneath the card header.
   * Omit or leave empty for favorites exports.
   */
  genres?: string[];
  /** Called when the user dismisses the export modal */
  onClose: () => void;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Format minutes → "Xh" or "Xh Ym" */
function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

// ─── Component ────────────────────────────────────────────────────────────────

const ExportableCard: React.FC<ExportableCardProps> = ({ user, games, label, genres, onClose }) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [copyLabel, setCopyLabel] = useState<'idle' | 'copied' | 'failed'>('idle');

  // Cap at 12 games (4 rows × 3 columns) so the grid card stays readable
  const displayGames = games.slice(0, 12);

  /** Trigger PNG download */
  const handleExport = async () => {
    if (!cardRef.current) return;
    setExporting(true);
    setExportError(null);
    try {
      // Use a 2× pixel ratio for a crisp PNG on HiDPI screens
      const dataUrl = await toPng(cardRef.current, { pixelRatio: 2 });
      const link = document.createElement('a');
      link.download = `steamquest-${label.toLowerCase().replace(/\s+/g, '-')}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('PNG export failed:', err);
      setExportError('Export failed. Try again or use a browser screenshot.');
    } finally {
      setExporting(false);
    }
  };

  /** Copy the card as PNG to the clipboard */
  const handleCopy = async () => {
    if (!cardRef.current) return;
    try {
      const dataUrl = await toPng(cardRef.current, { pixelRatio: 2 });
      const res = await fetch(dataUrl);
      const blob = await res.blob();
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      setCopyLabel('copied');
      setTimeout(() => setCopyLabel('idle'), 2000);
    } catch (err) {
      console.error('Copy to clipboard failed:', err);
      setCopyLabel('failed');
      setTimeout(() => setCopyLabel('idle'), 2000);
    }
  };

  return (
    /* Modal overlay */
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="flex flex-col items-center gap-4 w-full max-w-xl">
        {/* Action buttons */}
        <div className="flex gap-3 self-end">
          <button
            onClick={handleCopy}
            className="px-5 py-2 bg-blue-600/20 hover:bg-blue-500/30 text-blue-300 hover:text-white rounded-full font-black text-xs uppercase tracking-widest transition-all border border-blue-500/30"
          >
            {copyLabel === 'copied' ? '✓ Copied!' : copyLabel === 'failed' ? 'Copy failed' : 'Copy to Clipboard'}
          </button>
          <button
            onClick={handleExport}
            disabled={exporting}
            className="px-5 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-full font-black text-xs uppercase tracking-widest transition-all shadow-[0_0_20px_rgba(37,99,235,0.4)]"
          >
            {exporting ? 'Exporting…' : 'Save as PNG'}
          </button>
          <button
            onClick={onClose}
            className="px-5 py-2 bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white rounded-full font-black text-xs uppercase tracking-widest transition-all border border-white/10"
          >
            Close
          </button>
        </div>

        {exportError && (
          <p className="text-red-400 text-xs font-mono">{exportError}</p>
        )}

        {/* ── The actual exported card ── */}
        <div
          ref={cardRef}
          style={{
            width: 640,
            background: 'linear-gradient(135deg, #0e1521 0%, #1b2838 60%, #0e1521 100%)',
            borderRadius: 16,
            overflow: 'hidden',
            fontFamily: '"Inter", "Segoe UI", sans-serif',
            color: '#ffffff',
          }}
        >
          {/* Card header: branding + user info */}
          <div
            style={{
              background: 'linear-gradient(90deg, #1560a8 0%, #1a73c2 100%)',
              padding: '18px 22px',
              display: 'flex',
              alignItems: 'center',
              gap: 14,
            }}
          >
            {/* Logo mark */}
            <img
              src="/logo.png"
              alt="SteamQuest"
              style={{ height: 60, width: 'auto', objectFit: 'contain' }}
            />

            {/* Avatar + name */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginLeft: 'auto' }}>
              {user.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={user.avatarUrl}
                  alt={user.username}
                  width={34}
                  height={34}
                  style={{ borderRadius: '50%', border: '2px solid rgba(255,255,255,0.3)' }}
                />
              ) : (
                <div
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: '50%',
                    background: '#1565c0',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 16,
                    fontWeight: 900,
                  }}
                >
                  {user.username.slice(0, 1).toUpperCase()}
                </div>
              )}
              <div>
                <div style={{ fontSize: 13, fontWeight: 800, lineHeight: 1 }}>{user.username}</div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)', marginTop: 2 }}>{label}</div>
              </div>
            </div>
          </div>

          {/* Genre strip — shown only for quiz exports when genres are provided */}
          {genres && genres.length > 0 && (
            <div
              style={{
                padding: '8px 16px',
                background: 'rgba(21,96,168,0.25)',
                borderBottom: '1px solid rgba(102,192,244,0.15)',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                flexWrap: 'wrap',
              }}
            >
              <span style={{ fontSize: 8, fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: 1, marginRight: 4 }}>
                Genres:
              </span>
              {genres.map((g) => (
                <span
                  key={g}
                  style={{
                    fontSize: 8,
                    fontWeight: 700,
                    padding: '2px 7px',
                    background: 'rgba(102,192,244,0.15)',
                    border: '1px solid rgba(102,192,244,0.3)',
                    borderRadius: 4,
                    color: '#90caf9',
                    textTransform: 'uppercase',
                    letterSpacing: 0.5,
                  }}
                >
                  {g}
                </span>
              ))}
            </div>
          )}

          {/* Game grid — 3 columns of compact tiles */}
          <div
            style={{
              padding: '12px 12px',
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: 8,
            }}
          >
            {displayGames.map((game, idx) => (
              <div
                key={idx}
                style={{
                  background: 'rgba(255,255,255,0.04)',
                  borderRadius: 8,
                  border: '1px solid rgba(255,255,255,0.06)',
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                {/* Cover art — fixed height */}
                {game.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={game.imageUrl}
                    alt={game.title}
                    style={{ width: '100%', height: 150, objectFit: 'cover', display: 'block', flexShrink: 0 }}
                  />
                ) : (
                  <div
                    style={{
                      width: '100%',
                      height: 150,
                      background: 'rgba(255,255,255,0.05)',
                      flexShrink: 0,
                    }}
                  />
                )}

                {/* Tile info */}
                <div style={{ padding: '7px 8px', flex: 1, display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {/* Title */}
                  <div
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      overflow: 'hidden',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      lineHeight: 1.3,
                    }}
                  >
                    {game.title}
                  </div>

                  {/* Playtime line */}
                  {(() => {
                    const hasMain = game.mainStoryTime !== null && game.mainStoryTime > 0;
                    const hasComp = game.completionistTime !== null && game.completionistTime > 0;
                    return (
                      <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {hasMain && <span>⏱ {game.mainStoryTime}h</span>}
                        {hasMain && hasComp && <span>|</span>}
                        {hasComp && <span>🎯 {game.completionistTime}h</span>}
                      </div>
                    );
                  })()}

                  {/* Spacer */}
                  <div style={{ flex: 1 }} />

                  {/* Reason for pick */}
                  {game.reasonForPick && (
                    <div
                      style={{
                        fontSize: 8,
                        color: 'rgba(255,255,255,0.38)',
                        fontStyle: 'italic',
                        overflow: 'hidden',
                        display: '-webkit-box',
                        WebkitLineClamp: 3,
                        WebkitBoxOrient: 'vertical',
                        lineHeight: 1.35,
                      }}
                    >
                      "{game.reasonForPick}"
                    </div>
                  )}

                  {/* Spacer */}
                  <div style={{ flex: 1 }} />

                  {/* Match score (quiz only) */}
                  {game.suitabilityScore !== null && (
                    <div style={{ fontSize: 10, fontWeight: 700, color: '#66c0f4' }}>
                      {game.suitabilityScore}% Match
                    </div>
                  )}

                  {/* Achievements */}
                  {game.achievements && (
                    <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)' }}>
                      🏆 {game.achievements}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Card footer */}
          <div
            style={{
              padding: '10px 16px',
              borderTop: '1px solid rgba(255,255,255,0.05)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.2)', letterSpacing: 1, textTransform: 'uppercase' }}>
              Generated by SteamQuest
            </span>
            <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.2)' }}>
              {new Date().toLocaleDateString()}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExportableCard;