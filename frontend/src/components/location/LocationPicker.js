import React, { useState } from 'react';
import { MapPinIcon } from '../Icons';
import LeafletLocationMap from './LeafletLocationMap';

const LocationPicker = ({ value, onChange }) => {
  const [detecting, setDetecting] = useState(false);
  const location = value || { address: '', mode: 'manual', coordinates: { lat: '', lng: '' } };
  const lat = Number(location.coordinates?.lat);
  const lng = Number(location.coordinates?.lng);

  const update = (patch) => onChange({ ...location, ...patch });

  const detectLiveLocation = () => {
    if (!navigator.geolocation) return;
    setDetecting(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        onChange({
          ...location,
          mode: 'live',
          address: location.address || 'Live detected location',
          coordinates: {
            lat: pos.coords.latitude.toFixed(6),
            lng: pos.coords.longitude.toFixed(6),
          },
        });
        setDetecting(false);
      },
      () => setDetecting(false),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  return (
    <div className="location-picker">
      <div className="segmented-control" role="tablist" aria-label="Location mode">
        <button type="button" className={location.mode !== 'live' ? 'active' : ''} onClick={() => update({ mode: 'manual' })}>
          Manual
        </button>
        <button type="button" className={location.mode === 'live' ? 'active' : ''} onClick={detectLiveLocation}>
          {detecting ? 'Detecting...' : 'Live'}
        </button>
      </div>

      <div className="form-row">
        <div className="form-group">
          <label className="form-label" htmlFor="locationAddress">Location</label>
          <input
            id="locationAddress"
            type="text"
            className="form-input"
            placeholder="Hostel A, Library, Canteen"
            value={location.address || ''}
            onChange={(e) => update({ address: e.target.value })}
          />
        </div>
        <div className="form-group">
          <label className="form-label">Coordinates</label>
          <div className="location-coordinate-row">
            <input className="form-input" placeholder="Lat" value={location.coordinates?.lat || ''} onChange={(e) => update({ coordinates: { ...location.coordinates, lat: e.target.value } })} />
            <input className="form-input" placeholder="Lng" value={location.coordinates?.lng || ''} onChange={(e) => update({ coordinates: { ...location.coordinates, lng: e.target.value } })} />
          </div>
        </div>
      </div>

      {lat && lng ? (
        <LeafletLocationMap lat={lat} lng={lng} label={location.address || 'Selected location'} className="location-map-preview" />
      ) : (
        <div className="location-map-empty"><MapPinIcon size={22} /> Add live coordinates to preview the map</div>
      )}
    </div>
  );
};

export default LocationPicker;
