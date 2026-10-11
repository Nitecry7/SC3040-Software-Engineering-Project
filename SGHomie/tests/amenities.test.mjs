import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  AMENITY_CATEGORIES,
  filterAndSortAmenities,
  formatAmenityDistance,
  getAmenityCategoryLabel,
  getAmenityCategoryMetadata,
  isDemoAmenity,
  isUsableSingaporeCoordinates,
} from '../FrontEnd/src/lib/amenities.ts';

const amenities = [
  { id: 'school-2', name: 'Nearby Secondary School', type: 'School', distance: 0.8, latitude: 1.3, longitude: 103.8, source: 'demo' },
  { id: 'park', name: 'Nearby Park', type: 'Park', distance: 0.25, latitude: 1.3, longitude: 103.8, source: 'demo' },
  { id: 'school-1', name: 'Nearby Primary School', type: 'School', distance: 0.8, latitude: 1.3, longitude: 103.8, source: 'demo' },
  { id: 'clinic', name: 'Clinic', type: 'Healthcare', distance: 1.2, latitude: 1.3, longitude: 103.8, source: 'onemap' },
  { id: 'future', name: 'Future amenity', type: 'Library', distance: 0.5, latitude: 1.3, longitude: 103.8, source: 'legacy' },
];

test('amenities sort by distance and use stable name and id tie breaks', () => {
  assert.deepEqual(
    filterAndSortAmenities(amenities, 'all').map(({ id }) => id),
    ['park', 'future', 'school-1', 'school-2', 'clinic'],
  );
});

test('category selection filters without mutating the source list', () => {
  const originalIds = amenities.map(({ id }) => id);
  assert.deepEqual(
    filterAndSortAmenities(amenities, 'School').map(({ id }) => id),
    ['school-1', 'school-2'],
  );
  assert.deepEqual(amenities.map(({ id }) => id), originalIds);
});

test('All includes known and future categories', () => {
  assert.equal(filterAndSortAmenities(amenities, 'all').length, amenities.length);
  assert.equal(getAmenityCategoryLabel('Library'), 'Library');
  assert.equal(getAmenityCategoryLabel(''), 'Other');
});

test('supported categories expose shared visual metadata and unknown categories use neutral tone', () => {
  const categories = AMENITY_CATEGORIES.filter(({ value }) => value !== 'all');
  assert.equal(categories.length, 7);
  for (const category of categories) {
    assert.ok(category.label);
    assert.ok(category.tone);
    assert.deepEqual(getAmenityCategoryMetadata(category.value), {
      label: category.label,
      tone: category.tone,
    });
  }
  assert.deepEqual(getAmenityCategoryMetadata('Library'), {
    label: 'Library',
    tone: 'neutral',
  });
  assert.deepEqual(getAmenityCategoryMetadata(''), {
    label: 'Other',
    tone: 'neutral',
  });
});

test('distance displays metres below one kilometre and kilometres at or above it', () => {
  assert.equal(formatAmenityDistance(0.37), '370 m away');
  assert.equal(formatAmenityDistance(0.999), '999 m away');
  assert.equal(formatAmenityDistance(1), '1.0 km away');
  assert.equal(formatAmenityDistance(1.24), '1.2 km away');
  assert.equal(formatAmenityDistance(Number.NaN), 'Distance unavailable');
  assert.equal(formatAmenityDistance(-1), 'Distance unavailable');
});

test('demo source is explicit and non-demo sources remain distinguishable', () => {
  assert.equal(isDemoAmenity(amenities[0]), true);
  assert.equal(isDemoAmenity(amenities[3]), false);
});

test('coordinate validation rejects missing, non-finite, zero and out-of-bound values', () => {
  for (const coordinates of [
    [null, 103.8],
    [1.3, undefined],
    [Number.NaN, 103.8],
    [1.3, Number.POSITIVE_INFINITY],
    [0, 0],
    [0.99, 103.8],
    [1.3, 103.39],
    [1.61, 103.8],
    [1.3, 104.41],
  ]) {
    assert.equal(isUsableSingaporeCoordinates(...coordinates), false);
  }
});

test('coordinate validation accepts inclusive Singapore sanity-bound edges', () => {
  assert.equal(isUsableSingaporeCoordinates(1.0, 103.4), true);
  assert.equal(isUsableSingaporeCoordinates(1.6, 104.4), true);
  assert.equal(isUsableSingaporeCoordinates(1.3521, 103.8198), true);
});
