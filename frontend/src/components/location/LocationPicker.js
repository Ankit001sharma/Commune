import React, { useEffect, useRef, useState } from 'react';
import { MapPinIcon } from '../Icons';
import LeafletLocationMap from './LeafletLocationMap';
import { toast } from '../ui/Toast';

const LocationPicker = ({ value, onChange }) => {
  const [detecting, setDetecting] = useState(false);
  const [trackingActive, setTrackingActive] = useState(false);
  const watchIdRef = useRef(null);
  const lastUpdateRef = useRef(0);
  const location = value || { address: '', mode: 'manual', coordinates: { lat: '', lng: '' } };
  const lat = Number(location.coordinates?.lat);
  const lng = Number(location.coordinates?.lng);

  const update = (patch) => onChange({ ...location, ...patch });

  const stopLiveTracking = () => {
    if (watchIdRef.current !== null && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setTrackingActive(false);
    setDetecting(false);
  };

  const startLiveTracking = () => {
    if (!navigator.geolocation) {
      toast.error('Geolocation not supported in this browser');
      return;
    }

    if (watchIdRef.current !== null) {
      return;
    }

    setDetecting(true);
    setTrackingActive(true);

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const now = Date.now();
        if (now - lastUpdateRef.current < 2000) return;
        lastUpdateRef.current = now;

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
      (error) => {
        stopLiveTracking();
        if (error?.code === 1) {
          toast.error('Location permission denied');
        } else if (error?.code === 3) {
          toast.error('Location request timed out');
        } else {
          toast.error('Unable to fetch live location');
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 }
    );
  };

  useEffect(() => () => stopLiveTracking(), []);

  return (
    <div className="location-picker">
      <div className="segmented-control" role="tablist" aria-label="Location mode">
        <button
          type="button"
          className={location.mode !== 'live' ? 'active' : ''}
          onClick={() => {
            stopLiveTracking();
            update({ mode: 'manual' });
          }}
        >
          Manual
        </button>
        <button
          type="button"
          className={location.mode === 'live' ? 'active' : ''}
          onClick={trackingActive ? stopLiveTracking : startLiveTracking}
        >
          {detecting ? 'Detecting...' : trackingActive ? 'Stop Live' : 'Live'}
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
