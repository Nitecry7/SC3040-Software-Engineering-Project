import { useEffect } from 'react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { divIcon, latLngBounds, type Point } from 'leaflet';
import { MapContainer, Marker, Popup, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import type { Property } from '../types/supabase';
import 'leaflet/dist/leaflet.css';

const SINGAPORE_CENTER: [number, number] = [1.3521, 103.8198];

type MappableProperty = Property & { latitude: number; longitude: number };

const hasCoordinates = (property: Property): property is MappableProperty =>
  property.latitude !== null &&
  property.longitude !== null &&
  Number.isFinite(Number(property.latitude)) &&
  Number.isFinite(Number(property.longitude));

const createPriceIcon = (price: number, active: boolean) =>
  divIcon({
    className: 'map-price-marker-wrap',
    html: `<span class="map-price-marker${active ? ' map-price-marker-active' : ''}">S$${Math.round(price / 1000)}k</span>`,
    iconSize: [84, 36],
    iconAnchor: [42, 18],
  });

const createClusterIcon = (count: number) =>
  divIcon({
    className: 'map-cluster-marker-wrap',
    html: `<span class="map-cluster-marker">${count}</span>`,
    iconSize: [46, 46],
    iconAnchor: [23, 23],
  });

type ListingCluster = {
  properties: MappableProperty[];
  position: [number, number];
};

const clusterProperties = (
  properties: MappableProperty[],
  project: (property: MappableProperty) => Point,
): ListingCluster[] => {
  if (properties.length === 0) return [];

  const cellSize = 64;
  const points = properties.map(project);
  const parent = properties.map((_, index) => index);
  const find = (index: number): number => {
    if (parent[index] !== index) parent[index] = find(parent[index]);
    return parent[index];
  };
  const unite = (left: number, right: number) => {
    const leftRoot = find(left);
    const rightRoot = find(right);
    if (leftRoot !== rightRoot) parent[rightRoot] = leftRoot;
  };
  const grid = new Map<string, number[]>();

  points.forEach((point, index) => {
    const cellX = Math.floor(point.x / cellSize);
    const cellY = Math.floor(point.y / cellSize);
    for (let x = cellX - 1; x <= cellX + 1; x += 1) {
      for (let y = cellY - 1; y <= cellY + 1; y += 1) {
        for (const neighbor of grid.get(`${x}:${y}`) || []) {
          if (point.distanceTo(points[neighbor]) <= cellSize) unite(index, neighbor);
        }
      }
    }
    const key = `${cellX}:${cellY}`;
    grid.set(key, [...(grid.get(key) || []), index]);
  });

  const groups = new Map<number, MappableProperty[]>();
  properties.forEach((property, index) => {
    const root = find(index);
    groups.set(root, [...(groups.get(root) || []), property]);
  });

  return [...groups.values()].map((group) => ({
    properties: group,
    position: [
      group.reduce((sum, property) => sum + property.latitude, 0) / group.length,
      group.reduce((sum, property) => sum + property.longitude, 0) / group.length,
    ],
  }));
};

type MapViewportProps = {
  properties: MappableProperty[];
  selectedProperty: Property | null;
  onZoomChange: (zoom: number) => void;
  onClearSelection: () => void;
};

const MapViewport = ({ properties, selectedProperty, onZoomChange, onClearSelection }: MapViewportProps) => {
  const map = useMap();

  useMapEvents({
    zoomend: () => onZoomChange(map.getZoom()),
    click: onClearSelection,
  });

  useEffect(() => {
    if (properties.length === 0) return;
    const points = properties.map((property) => [property.latitude, property.longitude] as [number, number]);
    if (points.length === 1) {
      map.setView(points[0], 15);
      return;
    }
    map.fitBounds(latLngBounds(points), { padding: [36, 36], maxZoom: 15 });
  }, [map, properties]);

  useEffect(() => {
    if (!selectedProperty || !hasCoordinates(selectedProperty)) return;
    map.flyTo([selectedProperty.latitude, selectedProperty.longitude], 16, { duration: 0.6 });
  }, [map, selectedProperty]);

  return null;
};

type PropertyMarkersProps = {
  properties: MappableProperty[];
  selectedProperty: Property | null;
  zoom: number;
  onSelectProperty: (property: Property | null) => void;
};

const PropertyMarkers = ({ properties, selectedProperty, zoom, onSelectProperty }: PropertyMarkersProps) => {
  const map = useMap();
  const clusters = useMemo(
    () => clusterProperties(properties, (property) => map.project([property.latitude, property.longitude], zoom)),
    [map, properties, zoom],
  );

  const zoomIntoCluster = (cluster: ListingCluster) => {
    onSelectProperty(null);
    if (cluster.properties.length === 1) {
      const property = cluster.properties[0];
      map.flyTo([property.latitude, property.longitude], Math.min(16, zoom + 3), { duration: 0.6 });
      return;
    }
    map.fitBounds(latLngBounds(cluster.properties.map((property) => [property.latitude, property.longitude])), {
      padding: [48, 48],
      maxZoom: Math.min(15, zoom + 4),
    });
  };

  if (zoom <= 13) {
    return <>
      {clusters.map((cluster) => (
        <Marker
          key={cluster.properties.map((property) => property.id).join('-')}
          position={cluster.position}
          icon={createClusterIcon(cluster.properties.length)}
          eventHandlers={{ click: () => zoomIntoCluster(cluster) }}
        >
          <Popup>{cluster.properties.length} {cluster.properties.length === 1 ? 'available flat' : 'available flats'} in this area</Popup>
        </Marker>
      ))}
    </>;
  }

  return <>
    {properties.map((property) => (
      <Marker
        key={property.id}
        position={[property.latitude, property.longitude]}
        icon={createPriceIcon(property.price, selectedProperty?.id === property.id)}
        eventHandlers={{ click: () => onSelectProperty(property) }}
      >
        <Popup>
          <div className="min-w-48">
            <p className="font-semibold text-slate-900">{property.title}</p>
            <p className="mt-1 text-sm text-slate-600">{property.location} · {property.bedrooms} room</p>
            <p className="mt-1 font-bold text-blue-700">S${property.price.toLocaleString()}</p>
            <Link className="mt-2 inline-block font-medium text-blue-700 underline" to={`/property/${property.id}`}>
              View home
            </Link>
          </div>
        </Popup>
      </Marker>
    ))}
  </>;
};

type MarketplaceMapProps = {
  properties: Property[];
  selectedProperty: Property | null;
  onSelectProperty: (property: Property | null) => void;
};

const MarketplaceMap = ({ properties, selectedProperty, onSelectProperty }: MarketplaceMapProps) => {
  const [zoom, setZoom] = useState(11);
  const mappableProperties = useMemo(() => properties.filter(hasCoordinates), [properties]);
  const unlocatedCount = properties.length - mappableProperties.length;

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm" aria-label="Property map">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
        <div>
          <h2 className="font-semibold text-slate-900">Homes on the map</h2>
          <p className="text-xs text-slate-500">
            {mappableProperties.length} {mappableProperties.length === 1 ? 'home' : 'homes'} shown
            {unlocatedCount > 0 ? ` · ${unlocatedCount} without map location` : ''}
          </p>
        </div>
        <span className="text-xs text-slate-500">Scroll to zoom · Select a group to zoom in</span>
      </div>
      <div className="relative h-[420px] sm:h-[520px] lg:h-[min(68vh,760px)]">
        <MapContainer
          center={SINGAPORE_CENTER}
          zoom={11}
          maxZoom={19}
          scrollWheelZoom
          className="h-full w-full"
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            maxZoom={19}
          />
          <MapViewport
            properties={mappableProperties}
            selectedProperty={selectedProperty}
            onZoomChange={setZoom}
            onClearSelection={() => onSelectProperty(null)}
          />
          <PropertyMarkers
            properties={mappableProperties}
            selectedProperty={selectedProperty}
            zoom={zoom}
            onSelectProperty={onSelectProperty}
          />
        </MapContainer>
        {properties.length > 0 && mappableProperties.length === 0 && (
          <div className="absolute inset-0 z-[500] flex items-center justify-center bg-white/90 p-6 text-center">
            <p className="max-w-sm text-sm text-slate-600">
              These listings do not have map coordinates yet. You can still open each listing from the results.
            </p>
          </div>
        )}
      </div>
      <div className="border-t border-slate-100 px-4 py-2 text-xs text-slate-500">
        Map data &copy; OpenStreetMap contributors
      </div>
    </section>
  );
};

export default MarketplaceMap;
