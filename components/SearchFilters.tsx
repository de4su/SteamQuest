import React, { useEffect, useState } from 'react';
import { GameFilters } from '../types';
import { fetchPlatforms, fetchGenres, fetchTags } from '../services/rawgService';

interface FilterOption {
  id: number;
  name: string;
  slug: string;
}

interface SearchFiltersProps {
  filters: GameFilters;
  onChange: (filters: GameFilters) => void;
  isOpen: boolean;
  onToggle: () => void;
}

const MAX_DISPLAYED_TAGS = 20;

const ORDERING_OPTIONS = [
  { value: '', label: 'Relevance' },
  { value: '-rating', label: 'Rating (High → Low)' },
  { value: 'rating', label: 'Rating (Low → High)' },
  { value: '-metacritic', label: 'Metacritic (High → Low)' },
  { value: '-released', label: 'Newest First' },
  { value: 'released', label: 'Oldest First' },
  { value: '-added', label: 'Most Added' },
];

const SearchFilters: React.FC<SearchFiltersProps> = ({ filters, onChange, isOpen, onToggle }) => {
  const [platforms, setPlatforms] = useState<FilterOption[]>([]);
  const [genres, setGenres] = useState<FilterOption[]>([]);
  const [tags, setTags] = useState<FilterOption[]>([]);

  useEffect(() => {
    fetchPlatforms()
      .then((res) => setPlatforms(res.results))
      .catch((err) => { console.error('Failed to fetch platforms:', err); });
    fetchGenres()
      .then((res) => setGenres(res.results))
      .catch((err) => { console.error('Failed to fetch genres:', err); });
    fetchTags()
      .then((res) => setTags(res.results))
      .catch((err) => { console.error('Failed to fetch tags:', err); });
  }, []);

  const toggleId = (current: number[] | undefined, id: number): number[] => {
    const arr = current ?? [];
    return arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id];
  };

  const hasActiveFilters =
    (filters.platforms && filters.platforms.length > 0) ||
    (filters.genres && filters.genres.length > 0) ||
    (filters.tags && filters.tags.length > 0) ||
    filters.metacriticMin !== undefined ||
    (filters.ordering && filters.ordering !== '');

  return (
    <div className="relative">
      <button
        onClick={onToggle}
        className={`px-5 py-2 rounded-full transition-all text-xs font-black tracking-widest uppercase border ${
          hasActiveFilters
            ? 'bg-blue-600/20 border-blue-500/50 text-blue-400 hover:bg-blue-600/30'
            : 'bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white border-white/5'
        }`}
      >
        {hasActiveFilters ? '⚙ Filters (active)' : '⚙ Filters'}
      </button>

      {isOpen && (
        <div className="absolute right-0 top-12 w-80 bg-[#1b2838] border border-white/10 rounded-2xl shadow-2xl z-50 p-5 space-y-5">
          {/* Platforms */}
          {platforms.length > 0 && (
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">Platform</p>
              <div className="flex flex-wrap gap-1.5">
                {platforms.slice(0, 12).map((p) => {
                  const active = filters.platforms?.includes(p.id);
                  return (
                    <button
                      key={p.id}
                      onClick={() => onChange({ ...filters, platforms: toggleId(filters.platforms, p.id) })}
                      className={`px-2.5 py-1 text-[10px] font-black uppercase rounded-full border transition-all ${
                        active
                          ? 'bg-blue-600/30 border-blue-500/50 text-blue-300'
                          : 'bg-white/5 border-white/10 text-gray-400 hover:border-white/20 hover:text-white'
                      }`}
                    >
                      {p.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Genres */}
          {genres.length > 0 && (
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">Genre</p>
              <div className="flex flex-wrap gap-1.5">
                {genres.slice(0, 12).map((g) => {
                  const active = filters.genres?.includes(g.id);
                  return (
                    <button
                      key={g.id}
                      onClick={() => onChange({ ...filters, genres: toggleId(filters.genres, g.id) })}
                      className={`px-2.5 py-1 text-[10px] font-black uppercase rounded-full border transition-all ${
                        active
                          ? 'bg-blue-600/30 border-blue-500/50 text-blue-300'
                          : 'bg-white/5 border-white/10 text-gray-400 hover:border-white/20 hover:text-white'
                      }`}
                    >
                      {g.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Tags */}
          {tags.length > 0 && (
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2 pb-2 border-b border-white/5">Tags</p>
              <div className="flex flex-wrap gap-1.5">
                {tags.slice(0, MAX_DISPLAYED_TAGS).map((t) => {
                  const active = filters.tags?.includes(t.id);
                  return (
                    <button
                      key={t.id}
                      onClick={() => onChange({ ...filters, tags: toggleId(filters.tags, t.id) })}
                      className={`px-2.5 py-1 text-[10px] font-black uppercase rounded-full border transition-all ${
                        active
                          ? 'bg-green-600/30 border-green-500/50 text-green-300'
                          : 'bg-white/5 border-white/10 text-gray-400 hover:border-white/20 hover:text-white cursor-pointer'
                      }`}
                    >
                      {t.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Metacritic minimum */}
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">
              Min Metacritic: {filters.metacriticMin ?? 'Any'}
            </p>
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={filters.metacriticMin ?? 0}
              onChange={(e) => {
                const val = Number(e.target.value);
                onChange({ ...filters, metacriticMin: val === 0 ? undefined : val });
              }}
              className="w-full accent-blue-500"
            />
          </div>

          {/* Ordering */}
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">Sort By</p>
            <select
              value={filters.ordering ?? ''}
              onChange={(e) => onChange({ ...filters, ordering: e.target.value || undefined })}
              className="w-full bg-[#0f1923] border border-white/10 text-gray-300 text-xs rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500/50"
            >
              {ORDERING_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          {/* Clear */}
          {hasActiveFilters && (
            <button
              onClick={() => onChange({})}
              className="w-full py-2 text-xs font-black uppercase tracking-widest text-red-400 hover:text-red-300 border border-red-500/20 hover:border-red-500/40 rounded-full transition-all"
            >
              Clear All Filters
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default SearchFilters;
