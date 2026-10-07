export interface AnalyticsListing {
  price: number | string | null;
  location: string | null;
  town: string | null;
}

export interface TownSummary {
  town: string;
  count: number;
  price: number | null;
}

export function summarizeListings(listings: AnalyticsListing[]) {
  let total = 0;
  let pricedCount = 0;
  const groups = new Map<string, { count: number; total: number; pricedCount: number }>();
  for (const listing of listings) {
    const price = listing.price === null || typeof listing.price === 'string' && !listing.price.trim() ? NaN : Number(listing.price);
    const priced = Number.isFinite(price) && price >= 0;
    if (priced) { total += price; pricedCount++; }
    const town = (listing.town?.trim() || listing.location?.trim() || '').toUpperCase();
    if (!town || town === 'PENDING') continue;
    const group = groups.get(town) ?? { count: 0, total: 0, pricedCount: 0 };
    group.count++;
    if (priced) { group.total += price; group.pricedCount++; }
    groups.set(town, group);
  }
  const towns: TownSummary[] = [...groups].map(([town, group]) => ({
    town, count: group.count, price: group.pricedCount ? group.total / group.pricedCount : null,
  })).sort((a, b) => a.town.localeCompare(b.town));
  const highestCount = Math.max(0, ...towns.map(town => town.count));
  const popularTowns = towns.filter(town => town.count === highestCount);
  return { count: listings.length, averagePrice: pricedCount ? total / pricedCount : null, towns, popularTowns };
}
