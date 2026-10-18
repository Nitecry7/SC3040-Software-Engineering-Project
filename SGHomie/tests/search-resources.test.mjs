import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const searchSource = readFileSync(new URL('../FrontEnd/src/pages/Search.tsx', import.meta.url), 'utf8');
const mapSource = readFileSync(new URL('../FrontEnd/src/components/MarketplaceMap.tsx', import.meta.url), 'utf8');

test('Explore selects only the card and map fields and keeps query controls explicit', () => {
  assert.match(searchSource, /\.select\(SEARCH_PROPERTY_COLUMNS\)/);
  assert.match(searchSource, /const SEARCH_PROPERTY_COLUMNS = 'id,title,price,location,image_url,bedrooms,bathrooms,area_sqft,latitude,longitude'/);
  assert.doesNotMatch(searchSource, /\.select\('\*'\)/);
  for (const field of ['type', 'status', 'location', 'bedrooms', 'price', 'created_at']) {
    assert.match(searchSource, new RegExp(`\\.(?:eq|gte|lte|order)\\('${field}'`));
  }
});

test('Explore keeps the first two card images eager and lazily decodes later images', () => {
  assert.match(searchSource, /loading=\{index < 2 \? 'eager' : 'lazy'\}/);
  assert.match(searchSource, /decoding="async"/);
  assert.match(searchSource, /fetchPriority=\{index < 2 \? 'high' : 'auto'\}/);
});

test('Explore map remains mounted as a primary search feature with its existing tile source', () => {
  assert.match(searchSource, /<MarketplaceMap/);
  assert.match(mapSource, /<MapContainer/);
  assert.match(mapSource, /https:\/\/\{s\}\.tile\.openstreetmap\.org\/\{z\}\/\{x\}\/\{y\}\.png/);
});
