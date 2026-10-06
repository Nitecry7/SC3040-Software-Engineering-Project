import { useEffect } from 'react';
import { MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet';
import { Icon } from 'leaflet';
import 'leaflet/dist/leaflet.css';

const SINGAPORE_CENTER: [number, number] = [1.3521, 103.8198];

const locationIcon = new Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
  iconRetinaUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

type MapFlyToProps = {
  latitude: number | null;
  longitude: number | null;
};

const MapFlyTo = ({ latitude, longitude }: MapFlyToProps) => {
  const map = useMap();

  useEffect(() => {
    if (latitude === null || longitude === null) return;

    map.flyTo([latitude, longitude], 17, {
      duration: 1.2,
    });
  }, [latitude, longitude, map]);

  return null;
};

type LocationMapPreviewProps = {
  latitude: number | null;
  longitude: number | null;
  address?: string;
};

const LocationMapPreview = ({ latitude, longitude, address }: LocationMapPreviewProps) => {
  const hasCoordinates = latitude !== null && longitude !== null;

  return (
    <div className="h-64 overflow-hidden rounded-lg border border-gray-200">
      <MapContainer
        center={hasCoordinates ? [latitude, longitude] : SINGAPORE_CENTER}
        zoom={hasCoordinates ? 17 : 11}
        style={{ height: '100%', width: '100%' }}
        scrollWheelZoom={false}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />
        <MapFlyTo latitude={latitude} longitude={longitude} />
        {hasCoordinates && (
          <Marker position={[latitude, longitude]} icon={locationIcon}>
            <Popup>{address || 'Verified HDB block'}</Popup>
          </Marker>
        )}
      </MapContainer>
    </div>
  );
};

export default LocationMapPreview;
