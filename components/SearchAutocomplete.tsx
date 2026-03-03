import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Suggestion, SuggestionKind } from '../types';
import { fetchSuggestions } from '../services/rawgService';

interface Props {
  onSelect: (suggestion: Suggestion) => void;
}

const DEBOUNCE_MS = 200;

const kindLabel: Record<SuggestionKind, string> = {
  game: 'GAMES',
  developer: 'DEVELOPERS',
  publisher: 'PUBLISHERS',
};

const SearchAutocomplete: React.FC<Props> = ({ onSelect }) => {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const buildSuggestions = useCallback(async (q: string) => {
    if (!q.trim()) {
      setSuggestions([]);
      setOpen(false);
      return;
    }
    setLoading(true);
    try {
      const { games, developers, publishers } = await fetchSuggestions(q);
      const items: Suggestion[] = [
        ...games.map((g) => ({
          kind: 'game' as SuggestionKind,
          id: g.id,
          name: g.name,
          imageUrl: g.background_image,
          extra: g.genres?.map((x) => x.name).join(', '),
        })),
        ...developers.map((d) => ({
          kind: 'developer' as SuggestionKind,
          id: d.id,
          name: d.name,
          imageUrl: d.image_background,
          extra: `${d.games_count} games`,
        })),
        ...publishers.map((p) => ({
          kind: 'publisher' as SuggestionKind,
          id: p.id,
          name: p.name,
          imageUrl: p.image_background,
          extra: `${p.games_count} games`,
        })),
      ];
      setSuggestions(items);
      setOpen(items.length > 0);
      setActiveIndex(-1);
    } catch {
      // aborted or failed – ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => buildSuggestions(query), DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, buildSuggestions]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, -1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (activeIndex >= 0 && activeIndex < suggestions.length) {
        handleSelect(suggestions[activeIndex]);
      } else if (query.trim()) {
        // Submit as a game search
        handleSelect({
          kind: 'game',
          id: 0,
          name: query.trim(),
          imageUrl: null,
        });
      }
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  const handleSelect = (s: Suggestion) => {
    setQuery('');
    setSuggestions([]);
    setOpen(false);
    setActiveIndex(-1);
    onSelect(s);
  };

  // Scroll active item into view
  useEffect(() => {
    if (activeIndex >= 0 && listRef.current) {
      const item = listRef.current.children[activeIndex] as HTMLElement | undefined;
      item?.scrollIntoView({ block: 'nearest' });
    }
  }, [activeIndex]);

  // Group suggestions by kind for rendering
  const groups: SuggestionKind[] = ['game', 'developer', 'publisher'];

  return (
    <div className="relative w-full md:w-96">
      <input
        ref={inputRef}
        type="text"
        placeholder="Search games, developers, publishers…"
        className="w-full bg-black/60 border border-white/10 rounded-full px-6 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500 transition-all placeholder:text-gray-600 shadow-2xl"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={handleKeyDown}
        onFocus={() => suggestions.length > 0 && setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        autoComplete="off"
      />

      {loading && (
        <div className="absolute right-4 top-1/2 -translate-y-1/2 w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      )}

      {open && suggestions.length > 0 && (
        <ul
          ref={listRef}
          className="absolute left-0 right-0 top-full mt-2 bg-[#1b2838] border border-white/10 rounded-xl shadow-2xl z-[100] max-h-80 overflow-y-auto"
        >
          {groups.map((kind) => {
            const items = suggestions.filter((s) => s.kind === kind);
            if (items.length === 0) return null;
            return (
              <React.Fragment key={kind}>
                <li className="px-4 py-1.5 text-[10px] font-black tracking-widest text-blue-400/70 uppercase border-b border-white/5 select-none">
                  {kindLabel[kind]}
                </li>
                {items.map((s, i) => {
                  const globalIdx = suggestions.indexOf(s);
                  const isActive = globalIdx === activeIndex;
                  return (
                    <li
                      key={`${kind}-${s.id}-${i}`}
                      className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors ${
                        isActive ? 'bg-blue-600/30' : 'hover:bg-white/5'
                      }`}
                      onMouseDown={() => handleSelect(s)}
                      onMouseEnter={() => setActiveIndex(globalIdx)}
                    >
                      {s.imageUrl ? (
                        <img
                          src={s.imageUrl}
                          alt=""
                          className="w-10 h-7 object-cover rounded shrink-0"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-10 h-7 bg-white/5 rounded shrink-0" />
                      )}
                      <div className="min-w-0">
                        <p className="text-sm text-white font-semibold truncate">{s.name}</p>
                        {s.extra && (
                          <p className="text-[10px] text-gray-400 truncate">{s.extra}</p>
                        )}
                      </div>
                      <span className="ml-auto text-[9px] font-black text-gray-400 uppercase shrink-0">
                        {kind}
                      </span>
                    </li>
                  );
                })}
              </React.Fragment>
            );
          })}
        </ul>
      )}
    </div>
  );
};

export default SearchAutocomplete;
