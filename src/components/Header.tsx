import { REGIONS, type Region } from '../lib/types';

interface HeaderProps {
  region: Region;
  onRegionChange: (region: Region) => void;
}

export function Header({ region, onRegionChange }: HeaderProps) {
  return (
    <header className="header">
      <div className="header-brand">
        <svg className="header-logo" viewBox="0 0 64 64" aria-hidden="true">
          <defs>
            <radialGradient id="hdr-ball" cx="38%" cy="32%" r="75%">
              <stop offset="0%" stopColor="#eef79a" />
              <stop offset="55%" stopColor="#d4e157" />
              <stop offset="100%" stopColor="#a8b83a" />
            </radialGradient>
          </defs>
          <circle cx="32" cy="32" r="26" fill="url(#hdr-ball)" />
          <path
            d="M11.5 20 C 25 25, 25 39, 11.5 44"
            fill="none"
            stroke="#ffffff"
            strokeWidth="3.5"
            strokeLinecap="round"
          />
          <path
            d="M52.5 20 C 39 25, 39 39, 52.5 44"
            fill="none"
            stroke="#ffffff"
            strokeWidth="3.5"
            strokeLinecap="round"
          />
        </svg>
        <div className="header-titles">
          <h1 className="header-title">Court Finder</h1>
          <p className="header-subtitle">by All About Tennis</p>
        </div>
      </div>
      <div className="region-switcher">
        <label className="visually-hidden" htmlFor="region-select">
          Region
        </label>
        <select
          id="region-select"
          className="region-select"
          value={region}
          onChange={(e) => onRegionChange(e.target.value as Region)}
        >
          {(Object.keys(REGIONS) as Region[]).map((key) => (
            <option key={key} value={key}>
              {REGIONS[key].label}
            </option>
          ))}
        </select>
      </div>
    </header>
  );
}
