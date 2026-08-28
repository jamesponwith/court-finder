import { useEffect } from 'react';
import { FEEDBACK_EMAIL, buildCorrectionMailto } from '../lib/config';
import { formatMiles } from '../lib/distance';
import type { Facility } from '../lib/types';

interface CourtDetailProps {
  facility: Facility;
  regionLabel: string;
  distanceMiles: number | null;
  onClose: () => void;
}

const SURFACE_LABEL: Record<Facility['surface'], string> = {
  hard: 'Hard',
  clay: 'Clay',
  grass: 'Grass',
  unknown: 'Surface n/a',
};

const ACCESS_LABEL: Record<Facility['access'], string> = {
  public: 'Open to the public',
  customers: 'Customers / members',
  private: 'Private',
  unknown: 'Access unknown',
};

const SOURCE_LABEL: Record<Facility['source'], string> = {
  osm: 'OpenStreetMap',
  nycparks: 'NYC Parks Open Data',
  merged: 'OpenStreetMap + NYC Parks',
};

function yesNoUnknown(value: boolean | null): string {
  if (value === true) return 'Yes';
  if (value === false) return 'No';
  return 'Unknown';
}

export function CourtDetail({
  facility,
  regionLabel,
  distanceMiles,
  onClose,
}: CourtDetailProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${facility.lat},${facility.lng}`;
  const location = [facility.address, facility.city, facility.state]
    .filter(Boolean)
    .join(', ');
  const { hours, phone, website } = facility.tags;

  return (
    <div
      className="detail-overlay"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <section
        className="detail-panel"
        role="dialog"
        aria-modal="true"
        aria-label={facility.name}
      >
        <div className="detail-head">
          <h2 className="detail-title">{facility.name}</h2>
          <button type="button" className="detail-close" onClick={onClose} aria-label="Close details">
            ✕
          </button>
        </div>
        <p className="detail-sub">
          {location || 'Address unavailable'}
          {distanceMiles !== null && ` · ${formatMiles(distanceMiles)} away`}
        </p>

        <div className="detail-badges">
          <span className="badge badge-neutral">
            🎾 {facility.courtCount} {facility.courtCount === 1 ? 'court' : 'courts'}
          </span>
          <span className="badge badge-surface" data-surface={facility.surface}>
            {SURFACE_LABEL[facility.surface]}
          </span>
          {facility.lighted === true && <span className="badge badge-neutral">💡 Lights</span>}
          {facility.indoor === true && <span className="badge badge-indoor">Indoor</span>}
          {facility.tags.permitRequired === true && (
            <span className="badge badge-permit">Permit required</span>
          )}
        </div>

        {facility.tags.permitRequired === true && (
          <p className="permit-note">
            <strong>Heads up:</strong> These courts require a tennis permit to
            play (at least during peak season). Check with the facility or the
            local parks department for single-play and season permits.
          </p>
        )}

        <dl className="detail-facts">
          <dt>Access</dt>
          <dd>{ACCESS_LABEL[facility.access]}</dd>
          <dt>Lighted</dt>
          <dd>{yesNoUnknown(facility.lighted)}</dd>
          <dt>Indoor</dt>
          <dd>{yesNoUnknown(facility.indoor)}</dd>
          <dt>Fee</dt>
          <dd>{yesNoUnknown(facility.fee)}</dd>
          {typeof hours === 'string' && hours !== '' && (
            <>
              <dt>Hours</dt>
              <dd>{hours}</dd>
            </>
          )}
          {typeof phone === 'string' && phone !== '' && (
            <>
              <dt>Phone</dt>
              <dd>
                <a href={`tel:${phone}`}>{phone}</a>
              </dd>
            </>
          )}
          {typeof website === 'string' && website !== '' && (
            <>
              <dt>Website</dt>
              <dd>
                <a href={website} target="_blank" rel="noopener noreferrer">
                  {website}
                </a>
              </dd>
            </>
          )}
          <dt>Data source</dt>
          <dd>{SOURCE_LABEL[facility.source]}</dd>
        </dl>

        <div className="detail-actions">
          <a
            className="btn-accent"
            href={directionsUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            🧭 Directions
          </a>
          {FEEDBACK_EMAIL !== null && (
            <a
              className="btn-quiet"
              href={buildCorrectionMailto(FEEDBACK_EMAIL, facility, regionLabel)}
            >
              ✉️ Suggest a correction
            </a>
          )}
        </div>
      </section>
    </div>
  );
}
