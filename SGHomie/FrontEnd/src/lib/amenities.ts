export const AMENITY_CATEGORIES = [
  { value: 'all', label: 'All', tone: 'neutral' },
  { value: 'Transport', label: 'MRT/LRT', tone: 'transport' },
  { value: 'School', label: 'Schools', tone: 'school' },
  { value: 'Shopping', label: 'Shopping', tone: 'shopping' },
  { value: 'Healthcare', label: 'Healthcare', tone: 'healthcare' },
  { value: 'Food', label: 'Food', tone: 'food' },
  { value: 'Park', label: 'Parks', tone: 'park' },
  { value: 'Community', label: 'Community', tone: 'community' },
] as const;

export type AmenityCategory = (typeof AMENITY_CATEGORIES)[number]['value'];
export type AmenityTone = (typeof AMENITY_CATEGORIES)[number]['tone'];

export type Amenity = {
  id: string;
  property_id?: string;
  name: string;
  type: string;
  distance: number;
  latitude: number;
  longitude: number;
  source: string;
};

export function filterAndSortAmenities(
  amenities: Amenity[],
  category: AmenityCategory,
): Amenity[] {
  return amenities
    .filter((amenity) => category === 'all' || amenity.type === category)
    .slice()
    .sort((left, right) => {
      const byDistance = left.distance - right.distance;
      if (byDistance !== 0) return byDistance;
      const byName = left.name.localeCompare(right.name);
      return byName !== 0 ? byName : left.id.localeCompare(right.id);
    });
}

export function getAmenityCategoryMetadata(type: string): {
  label: string;
  tone: AmenityTone;
} {
  const category = AMENITY_CATEGORIES.find((item) => item.value === type);
  return category
    ? { label: category.label, tone: category.tone }
    : { label: type || 'Other', tone: 'neutral' };
}

export function getAmenityCategoryLabel(type: string): string {
  return getAmenityCategoryMetadata(type).label;
}

export function isDemoAmenity(amenity: Amenity): boolean {
  return amenity.source === 'demo';
}

export function formatAmenityDistance(distanceKm: number): string {
  if (!Number.isFinite(distanceKm) || distanceKm < 0) {
    return 'Distance unavailable';
  }
  if (distanceKm < 1) return `${Math.round(distanceKm * 1000)} m away`;
  return `${distanceKm.toFixed(1)} km away`;
}

export function isUsableSingaporeCoordinates(
  latitude: number | null | undefined,
  longitude: number | null | undefined,
): boolean {
  if (typeof latitude !== 'number' || typeof longitude !== 'number') return false;
  return Number.isFinite(latitude)
    && Number.isFinite(longitude)
    && latitude >= 1.0
    && latitude <= 1.6
    && longitude >= 103.4
    && longitude <= 104.4;
}
