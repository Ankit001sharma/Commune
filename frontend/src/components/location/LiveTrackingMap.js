import React from 'react';
import { MapPinIcon } from '../Icons';
import LeafletLocationMap from './LeafletLocationMap';

const formatUpdatedLabel = (updatedAt) => {
  if (!updatedAt) return null;
  const updated = new Date(updatedAt);
  const seconds = Math.floor((Date.now() - updated.getTime()) / 1000);
  if (!Number.isFinite(seconds) || seconds < 0) return null;
  if (seconds < 60) return `Last updated ${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `Last updated ${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Last updated ${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `Last updated ${days}d ago`;
};

const LiveTrackingMap = ({ location, title = 'Product location', showMapsLink = true }) => {
  const coords = location?.coordinates || {};
  const lat = Number(coords.lat);
  const lng = Number(coords.lng);
  const locationText = typeof location === 'string'
    ? location
    : location?.locationText || location?.address;
  const lastUpdatedLabel = formatUpdatedLabel(location?.updatedAt);
  const mapsUrl = Number.isFinite(lat) && Number.isFinite(lng)
    ? `https://www.google.com/maps?q=${lat},${lng}`
    : null;

  if (!lat || !lng) {
    return (
      <div className="tracking-card">
        <div className="tracking-header"><MapPinIcon size={18} /> Product Tracking</div>
        <p className="text-muted">Seller added a manual location: {locationText || 'Campus'}</p>
      </div>
    );
  }

  return (
    <div className="tracking-card">
      <div className="tracking-header">
        <MapPinIcon size={18} />
        <span>{title}</span>
        {location?.trackingActive && <span className="live-pill">Live tracking</span>}
      </div>
      <LeafletLocationMap lat={lat} lng={lng} label={locationText || title} className="tracking-map" />
      <div className="tracking-route">
        <span className="route-dot active" />
        <span className="route-line" />
        <span className="route-dot" />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <p className="text-muted">{locationText || 'Live detected location'} - Leaflet OpenStreetMap live view</p>
        {lastUpdatedLabel && <span className="text-muted" style={{ fontSize: '0.82rem' }}>{lastUpdatedLabel}</span>}
        {mapsUrl && showMapsLink && (
          <a className="btn btn-ghost" href={mapsUrl} target="_blank" rel="noreferrer">
            Open in Google Maps
          </a>
        )}
      </div>
    </div>
  );
};

export default LiveTrackingMap;
