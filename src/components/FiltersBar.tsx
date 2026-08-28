import { DEFAULT_FILTERS, isDefaultFilters, type CourtFilters, type SurfaceFilter } from '../lib/filters';

interface FiltersBarProps {
  filters: CourtFilters;
  onChange: (filters: CourtFilters) => void;
}

const SURFACE_OPTIONS: { value: SurfaceFilter; label: string }[] = [
  { value: 'all', label: 'Any surface' },
  { value: 'hard', label: 'Hard' },
  { value: 'clay', label: 'Clay' },
  { value: 'grass', label: 'Grass' },
  { value: 'unknown', label: 'Unknown' },
];

const MIN_COURT_OPTIONS = [1, 2, 4, 6, 8];

export function FiltersBar({ filters, onChange }: FiltersBarProps) {
  const set = (patch: Partial<CourtFilters>) => onChange({ ...filters, ...patch });

  return (
    <div className="filters" role="search" aria-label="Filter courts">
      <input
        className="filters-search"
        type="search"
        placeholder="Search name or city…"
        value={filters.query}
        onChange={(e) => set({ query: e.target.value })}
        aria-label="Search courts by name or city"
      />
      <button
        type="button"
        className="chip"
        aria-pressed={filters.lightedOnly}
        onClick={() => set({ lightedOnly: !filters.lightedOnly })}
      >
        💡 Lighted
      </button>
      <button
        type="button"
        className="chip"
        aria-pressed={filters.indoorOnly}
        onClick={() => set({ indoorOnly: !filters.indoorOnly })}
      >
        🏠 Indoor
      </button>
      <select
        className="chip-select"
        value={filters.surface}
        onChange={(e) => set({ surface: e.target.value as SurfaceFilter })}
        aria-label="Surface"
      >
        {SURFACE_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      <select
        className="chip-select"
        value={filters.minCourts}
        onChange={(e) => set({ minCourts: Number(e.target.value) })}
        aria-label="Minimum court count"
      >
        {MIN_COURT_OPTIONS.map((n) => (
          <option key={n} value={n}>
            {n === 1 ? 'Any # courts' : `${n}+ courts`}
          </option>
        ))}
      </select>
      {!isDefaultFilters(filters) && (
        <button
          type="button"
          className="chip chip-clear"
          onClick={() => onChange({ ...DEFAULT_FILTERS })}
        >
          ✕ Clear
        </button>
      )}
    </div>
  );
}
