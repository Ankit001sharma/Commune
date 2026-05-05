import React from 'react';
import { MapPinIcon } from '../Icons';
import LeafletLocationMap from './LeafletLocationMap';

const LiveTrackingMap = ({ location, title = 'Product location' }) => {
  const coords = location?.coordinates || {};
  const lat = Number(coords.lat);
  const lng = Number(coords.lng);

  if (!lat || !lng) {
    return (
      <div className="tracking-card">
        <div className="tracking-header"><MapPinIcon size={18} /> Product Tracking</div>
        <p className="text-muted">Seller added a manual location: {typeof location === 'string' ? location : location?.address || 'Campus'}</p>
      </div>
    );
  }

  return (
    <div className="tracking-card">
      <div className="tracking-header">
        <MapPinIcon size={18} />
        <span>{title}</span>
        <span className="live-pill">Live map</span>
      </div>
      <LeafletLocationMap lat={lat} lng={lng} label={location?.address || title} className="tracking-map" />
      <div className="tracking-route">
        <span className="route-dot active" />
        <span className="route-line" />
        <span className="route-dot" />
      </div>
      <p className="text-muted">{location?.address || 'Live detected location'} - Leaflet OpenStreetMap live view</p>
    </div>
  );
};

export default LiveTrackingMap;
