import { formatMiles } from '../lib/distance';
import type { Facility } from '../lib/types';

interface CourtCardProps {
  facility: Facility;
  distanceMiles: number | null;
  selected: boolean;
  onSelect: (id: string) => void;
}

const SURFACE_LABEL: Record<Facility['surface'], string> = {
  hard: 'Hard',
  clay: 'Clay',
  grass: 'Grass',
  unknown: 'Surface n/a',
};

export function CourtCard({ facility, distanceMiles, selected, onSelect }: CourtCardProps) {
  const location = facility.city
    ? `${facility.city}, ${facility.state}`
    : facility.state;

  return (
    <li>
      <button
        type="button"
        className={`court-card${selected ? ' is-selected' : ''}`}
        onClick={() => onSelect(facility.id)}
      >
        <div className="court-card-top">
          <h3 className="court-card-name">{facility.name}</h3>
          {distanceMiles !== null && (
            <span className="court-card-distance">{formatMiles(distanceMiles)}</span>
          )}
        </div>
        <div className="court-card-meta">
          <span className="badge badge-neutral">
            🎾 {facility.courtCount} {facility.courtCount === 1 ? 'court' : 'courts'}
          </span>
          <span className="badge badge-surface" data-surface={facility.surface}>
            {SURFACE_LABEL[facility.surface]}
          </span>
          {facility.lighted === true && (
            <span className="badge badge-neutral" title="Lighted courts">
              💡 Lights
            </span>
          )}
          {facility.indoor === true && <span className="badge badge-indoor">Indoor</span>}
          {facility.tags.permitRequired === true && (
            <span className="badge badge-permit">Permit</span>
          )}
          <span>{location}</span>
        </div>
      </button>
    </li>
  );
}
