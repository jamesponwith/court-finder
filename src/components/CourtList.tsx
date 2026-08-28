import type { FacilityWithDistance } from '../lib/filters';
import { CourtCard } from './CourtCard';

interface CourtListProps {
  items: FacilityWithDistance[];
  loading: boolean;
  selectedId: string | null;
  hasActiveFilters: boolean;
  onSelect: (id: string) => void;
  onClearFilters: () => void;
}

function SkeletonCard() {
  return (
    <li aria-hidden="true">
      <div className="skeleton-card">
        <div className="skeleton-line w-60" />
        <div className="skeleton-line w-80" />
        <div className="skeleton-line w-40" />
      </div>
    </li>
  );
}

export function CourtList({
  items,
  loading,
  selectedId,
  hasActiveFilters,
  onSelect,
  onClearFilters,
}: CourtListProps) {
  if (loading) {
    return (
      <ul className="court-list" aria-busy="true" aria-label="Loading courts">
        {Array.from({ length: 6 }, (_, i) => (
          <SkeletonCard key={i} />
        ))}
      </ul>
    );
  }

  if (items.length === 0) {
    return (
      <div className="state-block" role="status">
        <span aria-hidden="true" style={{ fontSize: '1.8rem' }}>
          🎾
        </span>
        <h3>No courts match</h3>
        <p style={{ margin: 0 }}>
          {hasActiveFilters
            ? 'Try loosening a filter or clearing your search.'
            : 'No courts found in this region yet.'}
        </p>
        {hasActiveFilters && (
          <button type="button" className="btn-accent" onClick={onClearFilters}>
            Clear filters
          </button>
        )}
      </div>
    );
  }

  return (
    <ul className="court-list">
      {items.map(({ facility, distanceMiles }) => (
        <CourtCard
          key={facility.id}
          facility={facility}
          distanceMiles={distanceMiles}
          selected={facility.id === selectedId}
          onSelect={onSelect}
        />
      ))}
    </ul>
  );
}
