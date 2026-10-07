import { Link } from 'react-router-dom';
import type { MouseEventHandler } from 'react';
import type { ListingSearchResult } from '../lib/chat';

const money = (value: number) => `S$${value.toLocaleString('en-SG')}`;
const SORT_LABELS = { price_asc: 'Lowest price first', price_desc: 'Highest price first', area_desc: 'Largest first', newest: 'Newest first' };

export default function ListingRecommendations({ result, compact = true, onListingOpen }: { result: ListingSearchResult; compact?: boolean; onListingOpen?: MouseEventHandler<HTMLAnchorElement> }) {
  const { filters, listings, total_matches: total } = result;
  const summary = [
    filters.locations?.join(' or '), filters.room_type,
    filters.bedrooms && `${filters.bedrooms} bedrooms`,
    filters.min_bedrooms && `${filters.min_bedrooms}+ bedrooms`,
    filters.min_price !== undefined && `From ${money(filters.min_price)}`,
    filters.max_price !== undefined && `Up to ${money(filters.max_price)}`,
    filters.min_bathrooms && `${filters.min_bathrooms}+ bathrooms`,
    filters.min_area_sqft !== undefined && `${filters.min_area_sqft.toLocaleString()}+ sqft`,
    filters.keywords?.join(', '),
  ].filter(Boolean).join(' · ');

  return (
    <div className="mt-3 space-y-3" aria-label="Property recommendations">
      <div className="text-xs text-gray-600">
        <p>{summary || 'All approved HDB listings'}</p>
        <p>{SORT_LABELS[filters.sort_by]} · {total} {total === 1 ? 'match' : 'matches'}</p>
        {filters.room_type && <p>Room type matched from listing descriptions.</p>}
      </div>
      <div className={compact ? 'space-y-2' : 'chat-listing-grid'}>
      {listings.slice(0, 3).map((listing, index) => (
        <Link key={listing.id} to={`/property/${encodeURIComponent(listing.id)}`}
          onClick={onListingOpen}
          className="block overflow-hidden rounded-lg border border-gray-200 bg-white hover:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500">
          {!compact && listing.image_url && <img src={listing.image_url} alt={listing.title} className="h-36 w-full object-cover" loading="lazy"
            onError={event => { event.currentTarget.style.display = 'none'; }} />}
          <div className={`${compact ? 'p-2.5' : 'p-3'} space-y-1 text-sm`}>
            <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-1">
              <p className="line-clamp-2 min-w-0 font-semibold text-gray-900">{index + 1}. {listing.title}</p>
              <p className="shrink-0 font-bold text-blue-700">{money(listing.price)}</p>
            </div>
            <p className="text-xs text-gray-600">{listing.location} · HDB</p>
            <p className="text-xs text-gray-500">{listing.bedrooms} {listing.bedrooms === 1 ? 'bedroom' : 'bedrooms'} listed · {listing.bathrooms} bath · {listing.area_sqft.toLocaleString()} sqft</p>
            {!compact && <p className="pt-1 font-medium text-blue-600">View listing →</p>}
          </div>
        </Link>
      ))}
      </div>
      {listings.length > 0 && <p className="text-xs text-gray-500">
        Showing {listings.length} of {total} matches.
      </p>}
    </div>
  );
}
