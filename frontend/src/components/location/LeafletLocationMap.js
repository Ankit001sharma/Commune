import React, { useEffect, useMemo } from 'react';
import { MapContainer, Marker, Popup, TileLayer, ZoomControl, useMap } from 'react-leaflet';
import L from 'leaflet';

const markerIcon = new L.Icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

const shouldDebugLocation = () => {
  if (typeof window === 'undefined') return false;
  return window.localStorage?.getItem('cx_debug_location') === 'true';
};

const MapUpdater = ({ lat, lng }) => {
  const map = useMap();

  useEffect(() => {
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
    if (shouldDebugLocation()) {
      console.debug('[location] map update', { lat, lng });
    }
    map.setView([lat, lng], map.getZoom(), { animate: true });
  }, [lat, lng, map]);

  return null;
};

const LeafletLocationMap = ({ lat, lng, label = 'Selected location', className = 'leaflet-location-map' }) => {
  const position = useMemo(() => [Number(lat), Number(lng)], [lat, lng]);

  if (!position[0] || !position[1]) return null;

  return (
    <MapContainer center={position} zoom={16} scrollWheelZoom zoomControl={false} className={className}>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <ZoomControl position="bottomright" />
      <MapUpdater lat={position[0]} lng={position[1]} />
      <Marker position={position} icon={markerIcon}>
        <Popup>{label}</Popup>
      </Marker>
    </MapContainer>
  );
};

export default LeafletLocationMap;
