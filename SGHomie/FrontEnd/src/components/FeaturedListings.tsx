import React, { useEffect, useState } from 'react';
import { MapPin, Building2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Property } from '../types/supabase';

const FeaturedListings = () => {
  const [listings, setListings] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchListings = async () => {
      try {
        const { data, error } = await supabase
          .from('properties')
          .select('*')
          .limit(3)
          .order('created_at', { ascending: false });

        if (error) throw error;
        setListings(data || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch listings');
      } finally {
        setLoading(false);
      }
    };

    fetchListings();
  }, []);

  if (loading) {
    return (
      <div className="bg-gray-50 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">Loading properties...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-gray-50 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center text-red-600">Error: {error}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-50 py-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <h2 className="text-3xl font-bold text-gray-900">Featured Properties</h2>
          <p className="mt-4 text-lg text-gray-600">
            Explore our hand-picked selection of premium properties
          </p>
        </div>

        <div className="mt-12 grid gap-8 md:grid-cols-2 lg:grid-cols-3">
          {listings.map((listing) => (
            <div key={listing.id} className="bg-white rounded-lg shadow-md overflow-hidden">
              <img
                src={listing.image_url}
                alt={listing.title}
                className="w-full h-48 object-cover"
              />
              <div className="p-6">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-blue-600">{listing.type}</span>
                  <span className="text-lg font-bold text-gray-900">S${listing.price.toLocaleString()}</span>
                </div>
                <h3 className="mt-2 text-xl font-semibold text-gray-900">{listing.title}</h3>
                <div className="mt-4 flex items-center text-gray-600">
                  <MapPin className="h-5 w-5 text-gray-400" />
                  <span className="ml-2">{listing.location}</span>
                </div>
                <div className="mt-2 text-sm text-gray-600">
                  {listing.bedrooms} Beds • {listing.bathrooms} Baths • {listing.area_sqft.toLocaleString()} sqft
                </div>
                <button className="mt-4 w-full bg-blue-600 text-white py-2 rounded-md hover:bg-blue-700">
                  View Details
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default FeaturedListings;