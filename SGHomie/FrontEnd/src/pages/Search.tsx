import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bath, BedDouble, MapPin, Ruler, Search as SearchIcon } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import MarketplaceMap from '../components/MarketplaceMap';
import type { Property } from '../types/supabase';

const LOCATIONS = [
  'ALL', 'ANG MO KIO', 'BEDOK', 'BISHAN', 'BUKIT BATOK', 'BUKIT MERAH',
  'BUKIT PANJANG', 'BUKIT TIMAH', 'CENTRAL AREA', 'CHOA CHU KANG',
  'CLEMENTI', 'GEYLANG', 'HOUGANG', 'JURONG EAST', 'JURONG WEST',
  'KALLANG/WHAMPOA', 'MARINE PARADE', 'PASIR RIS', 'PUNGGOL',
  'QUEENSTOWN', 'SEMBAWANG', 'SENGKANG', 'SERANGOON', 'TAMPINES',
  'TOA PAYOH', 'WOODLANDS', 'YISHUN',
].sort();

const ROOM_TYPES = ['ALL', '2 ROOM', '3 ROOM', '4 ROOM', 'EXECUTIVE'];

type SearchFilters = {
  location: string;
  roomType: string;
  minPrice: string;
  maxPrice: string;
};

const DEFAULT_FILTERS: SearchFilters = {
  location: 'ALL',
  roomType: 'ALL',
  minPrice: '',
  maxPrice: '',
};

const fetchProperties = async (filters: SearchFilters): Promise<Property[]> => {
  let query = supabase
    .from('properties')
    .select('*')
    .eq('type', 'HDB')
    .eq('status', 'approved');

  if (filters.location !== 'ALL') query = query.eq('location', filters.location);
  if (filters.roomType !== 'ALL') query = query.eq('bedrooms', parseInt(filters.roomType.split(' ')[0], 10));
  if (filters.minPrice) query = query.gte('price', Number(filters.minPrice));
  if (filters.maxPrice) query = query.lte('price', Number(filters.maxPrice));

  const { data, error } = await query.order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
};

const formatPrice = (price: number) => `S$${price.toLocaleString('en-SG')}`;

const Search = () => {
  const { user } = useAuth();
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchError, setSearchError] = useState('');
  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(null);
  const [useProfileRecommendations, setUseProfileRecommendations] = useState(false);
  const [userProfile, setUserProfile] = useState<{
    preferred_locations: string[];
    preferred_property_type: string;
  } | null>(null);
  const [filters, setFilters] = useState<SearchFilters>(DEFAULT_FILTERS);

  const selectedProperty = useMemo(
    () => properties.find((property) => property.id === selectedPropertyId) || null,
    [properties, selectedPropertyId],
  );

  const runSearch = useCallback(async (nextFilters: SearchFilters) => {
    setLoading(true);
    setSearchError('');
    try {
      const results = await fetchProperties(nextFilters);
      setProperties(results);
      setSelectedPropertyId(null);
    } catch (error) {
      console.error('Error searching properties:', error);
      setSearchError('We could not load homes right now. Please try again.');
      setProperties([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void runSearch(DEFAULT_FILTERS);
  }, [runSearch]);

  useEffect(() => {
    let cancelled = false;
    const fetchUserProfile = async () => {
      if (!user) {
        setUserProfile(null);
        setUseProfileRecommendations(false);
        return;
      }

      const { data, error } = await supabase
        .from('user_profiles')
        .select('preferred_locations, preferred_property_type')
        .eq('id', user.id)
        .maybeSingle();

      if (cancelled) return;
      if (error) {
        console.error('Error fetching user profile:', error);
        return;
      }
      setUserProfile(data);
    };

    void fetchUserProfile();
    return () => { cancelled = true; };
  }, [user]);

  const handleSearch = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void runSearch(filters);
  };

  const handleProfileRecommendations = (enabled: boolean) => {
    setUseProfileRecommendations(enabled);
    if (enabled && userProfile) {
      const recommendedFilters = {
        ...filters,
        location: userProfile.preferred_locations?.[0] || 'ALL',
        roomType: userProfile.preferred_property_type || 'ALL',
      };
      setFilters(recommendedFilters);
      void runSearch(recommendedFilters);
    }
  };

  const updateFilter = (field: keyof SearchFilters, value: string) => {
    setFilters((current) => ({ ...current, [field]: value }));
  };

  return (
    <div className="min-h-screen bg-slate-50 pt-24 pb-12">
      <div className="mx-auto max-w-[1500px] px-4 sm:px-6 lg:px-8">
        <header className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="mb-2 text-sm font-semibold uppercase tracking-[0.16em] text-blue-700">SG Homie · Explore</p>
            <h1 className="text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">Find a home on the map</h1>
            <p className="mt-2 max-w-2xl text-slate-600">Browse HDB listings across Singapore, compare prices, and open a home to see the details.</p>
          </div>
          <div className="hidden items-center gap-2 rounded-full bg-white px-4 py-2 text-sm text-slate-600 shadow-sm sm:flex">
            <MapPin className="h-4 w-4 text-blue-600" /> Singapore listings
          </div>
        </header>

        <form onSubmit={handleSearch} className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          {user && (
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div>
                <p className="font-medium text-slate-900">Personalise your search</p>
                <p className="text-sm text-slate-500">Use the locations and room type from your profile.</p>
              </div>
              <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={useProfileRecommendations}
                  onChange={(event) => handleProfileRecommendations(event.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                Use my preferences
              </label>
            </div>
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-[1.2fr_1fr_1fr_1fr_auto]">
            <label className="text-sm font-medium text-slate-700">
              Town
              <select value={filters.location} onChange={(event) => updateFilter('location', event.target.value)} disabled={useProfileRecommendations} className="mt-1.5 block w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm disabled:bg-slate-100">
                {LOCATIONS.map((location) => <option key={location} value={location}>{location === 'ALL' ? 'All towns' : location}</option>)}
              </select>
            </label>
            <label className="text-sm font-medium text-slate-700">
              Flat size
              <select value={filters.roomType} onChange={(event) => updateFilter('roomType', event.target.value)} disabled={useProfileRecommendations} className="mt-1.5 block w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm disabled:bg-slate-100">
                {ROOM_TYPES.map((type) => <option key={type} value={type}>{type === 'ALL' ? 'Any size' : type}</option>)}
              </select>
            </label>
            <label className="text-sm font-medium text-slate-700">
              Minimum price
              <input type="number" min="0" placeholder="No minimum" value={filters.minPrice} onChange={(event) => updateFilter('minPrice', event.target.value)} className="mt-1.5 block w-full rounded-xl border border-slate-200 px-3 py-3 text-sm" />
            </label>
            <label className="text-sm font-medium text-slate-700">
              Maximum price
              <input type="number" min="0" placeholder="No maximum" value={filters.maxPrice} onChange={(event) => updateFilter('maxPrice', event.target.value)} className="mt-1.5 block w-full rounded-xl border border-slate-200 px-3 py-3 text-sm" />
            </label>
            <button type="submit" disabled={loading} className="mt-auto inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-blue-700 px-5 py-3 font-semibold text-white hover:bg-blue-800 disabled:cursor-wait disabled:opacity-70">
              <SearchIcon className="h-4 w-4" /> {loading ? 'Searching' : 'Search homes'}
            </button>
          </div>
        </form>

        <div className="grid items-start gap-5 lg:grid-cols-[minmax(340px,0.85fr)_minmax(0,1.35fr)]">
          <section className="order-2 lg:order-1" aria-label="Property listings">
            <div className="mb-3 flex items-end justify-between">
              <div>
                <h2 className="text-xl font-bold text-slate-950">Available homes</h2>
                <p className="mt-0.5 text-sm text-slate-500">{loading ? 'Updating listings…' : `${properties.length} ${properties.length === 1 ? 'home' : 'homes'} found`}</p>
              </div>
            </div>

            {searchError && (
              <div role="alert" className="mb-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">{searchError}</div>
            )}

            {!loading && !searchError && properties.length === 0 && (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
                <MapPin className="mx-auto h-8 w-8 text-slate-400" />
                <p className="mt-3 font-semibold text-slate-800">No homes match these filters</p>
                <p className="mt-1 text-sm text-slate-500">Try a different town or widen your price range.</p>
              </div>
            )}

            <div className="space-y-3 lg:max-h-[min(68vh,760px)] lg:overflow-y-auto lg:pr-2">
              {properties.map((property) => (
                <article key={property.id} className={`overflow-hidden rounded-2xl border bg-white shadow-sm ${selectedPropertyId === property.id ? 'border-blue-500 ring-2 ring-blue-100' : 'border-slate-200'}`}>
                  <button type="button" onClick={() => setSelectedPropertyId(property.id)} aria-pressed={selectedPropertyId === property.id} className="flex w-full gap-4 p-3 text-left hover:bg-slate-50 sm:p-4">
                    <img src={property.image_url || 'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?auto=format&fit=crop&w=640&q=80'} alt="" className="h-28 w-32 shrink-0 rounded-xl object-cover sm:h-32 sm:w-40" />
                    <div className="min-w-0 flex-1 py-1">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <p className="line-clamp-2 font-semibold leading-snug text-slate-900">{property.title}</p>
                        <span className="shrink-0 font-bold text-blue-800">{formatPrice(property.price)}</span>
                      </div>
                      <p className="mt-2 flex items-center gap-1.5 text-sm text-slate-600"><MapPin className="h-4 w-4 shrink-0 text-slate-400" />{property.location}</p>
                      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                        <span className="inline-flex items-center gap-1"><BedDouble className="h-3.5 w-3.5" />{property.bedrooms} rooms</span>
                        <span className="inline-flex items-center gap-1"><Bath className="h-3.5 w-3.5" />{property.bathrooms} baths</span>
                        <span className="inline-flex items-center gap-1"><Ruler className="h-3.5 w-3.5" />{property.area_sqft.toLocaleString()} sqft</span>
                      </div>
                    </div>
                  </button>
                  <div className="flex justify-end border-t border-slate-100 px-4 py-2">
                    <Link to={`/property/${property.id}`} className="text-sm font-semibold text-blue-700 hover:text-blue-900">View home details →</Link>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <div className="order-1 lg:order-2 lg:sticky lg:top-24">
            <MarketplaceMap
              properties={properties}
              selectedProperty={selectedProperty}
              onSelectProperty={(property) => setSelectedPropertyId(property?.id ?? null)}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Search;
