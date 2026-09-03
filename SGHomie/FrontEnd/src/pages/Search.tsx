// Import React hooks for managing state and side effects.
import React, { useState, useEffect } from 'react';
// Import icons from lucide-react for use in the UI.
import { Search as SearchIcon, Home, DollarSign } from 'lucide-react';
// Import Supabase client to fetch data from your database.
import { supabase } from '../lib/supabase';
// Import useNavigate for programmatic navigation between routes.
import { useNavigate } from 'react-router-dom';
// Import custom Auth context to access current user data.
import { useAuth } from '../contexts/AuthContext';
// Import the Property type definition.
import type { Property } from '../types/supabase';

// Define a constant array for location filters. "ALL" is used to reset the filter.
const LOCATIONS = [
  'ALL',
  'ANG MO KIO', 'BEDOK', 'BISHAN', 'BUKIT BATOK', 'BUKIT MERAH',
  'BUKIT PANJANG', 'BUKIT TIMAH', 'CENTRAL AREA', 'CHOA CHU KANG',
  'CLEMENTI', 'GEYLANG', 'HOUGANG', 'JURONG EAST', 'JURONG WEST',
  'KALLANG/WHAMPOA', 'MARINE PARADE', 'PASIR RIS', 'PUNGGOL',
  'QUEENSTOWN', 'SEMBAWANG', 'SENGKANG', 'SERANGOON', 'TAMPINES',
  'TOA PAYOH', 'WOODLANDS', 'YISHUN'
].sort();

// Define a constant array for room type filters, including an "ALL" option.
const ROOM_TYPES = ['ALL', '2 ROOM', '3 ROOM', '4 ROOM', 'EXECUTIVE'];

// Main Search component.
const Search = () => {
  // Get the navigate function for routing.
  const navigate = useNavigate();
  // Destructure the current user from the authentication context.
  const { user } = useAuth();

  // State to hold the list of properties fetched from the database.
  const [properties, setProperties] = useState<Property[]>([]);
  // State to track if a search operation is in progress.
  const [loading, setLoading] = useState(false);
  // State to determine whether to use profile-based recommendations for filters.
  const [useProfileRecommendations, setUseProfileRecommendations] = useState(true);
  // State to hold the logged-in user's profile data (preferences).
  const [userProfile, setUserProfile] = useState<{
    preferred_locations: string[];
    preferred_property_type: string;
  } | null>(null);
  // State to hold the current search filters.
  const [filters, setFilters] = useState({
    location: 'ALL',
    roomType: 'ALL',
    minPrice: '',
    maxPrice: '',
  });

  // useEffect to fetch the user's profile once the component is mounted and when the user changes.
  useEffect(() => {
    const fetchUserProfile = async () => {
      if (!user) return; // If no user is logged in, do nothing.

      try {
        // Query Supabase for the user's profile preferences.
        const { data, error } = await supabase
          .from('user_profiles')
          .select('preferred_locations, preferred_property_type')
          .eq('id', user.id)
          .single();

        // Throw error if the query fails.
        if (error) throw error;

        // Save the fetched profile data.
        setUserProfile(data);
        // If profile recommendations are enabled, update filters with the user's preferences.
        if (data && useProfileRecommendations) {
          setFilters(prev => ({
            ...prev,
            location: data.preferred_locations?.[0] || 'ALL',
            roomType: data.preferred_property_type || 'ALL'
          }));
        }
      } catch (error) {
        console.error('Error fetching user profile:', error);
      }
    };

    // Execute the function to fetch user profile information.
    fetchUserProfile();
  }, [user]);

  // Function to handle search form submission.
  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault(); // Prevent the default form submission behavior.
    setLoading(true);   // Set loading state to true during the fetch.

    try {
      // Construct a query from Supabase filtering for approved HDB properties.
      let query = supabase
        .from('properties')
        .select('*')
        .eq('type', 'HDB')
        .eq('status', 'approved'); // Retrieve only approved properties.

      // If a specific location is selected (not "ALL"), add a location filter.
      if (filters.location !== 'ALL') {
        query = query.eq('location', filters.location);
      }
      // If a specific room type is selected (not "ALL"), filter by the number of bedrooms.
      if (filters.roomType !== 'ALL') {
        // Assumes room type string is formatted like "4 ROOM" and extracts the first number.
        query = query.eq('bedrooms', parseInt(filters.roomType.split(' ')[0]));
      }
      // Apply minimum price filter if provided.
      if (filters.minPrice) {
        query = query.gte('price', parseFloat(filters.minPrice));
      }
      // Apply maximum price filter if provided.
      if (filters.maxPrice) {
        query = query.lte('price', parseFloat(filters.maxPrice));
      }

      // Execute the query.
      const { data, error } = await query;
      if (error) throw error; // Handle any errors from the query.
      // Update the properties state with the fetched data.
      setProperties(data || []);
    } catch (error) {
      console.error('Error searching properties:', error);
    } finally {
      setLoading(false);  // Stop the loading spinner regardless of the result.
    }
  };

  // Function to handle changes in filter inputs.
  // Prevents updating location and roomType filters if profile recommendations are in use.
  const handleFilterChange = (field: string, value: string) => {
    if (useProfileRecommendations && (field === 'location' || field === 'roomType')) {
      return; // Do not allow manual changes when recommendations are enabled.
    }
    setFilters(prev => ({ ...prev, [field]: value }));
  };

  // Function to toggle the use of profile recommendations.
  const toggleProfileRecommendations = () => {
    setUseProfileRecommendations(!useProfileRecommendations);
    if (!useProfileRecommendations && userProfile) {
      // When enabling recommendations, apply the user's profile preferences.
      setFilters(prev => ({
        ...prev,
        location: userProfile.preferred_locations?.[0] || 'ALL',
        roomType: userProfile.preferred_property_type || 'ALL'
      }));
    }
  };

  return (
    <div className="pt-20 min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Page Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900">Find Your Dream HDB</h1>
          <p className="mt-4 text-lg text-gray-600">
            Search through our curated list of HDB properties across Singapore
          </p>
        </div>

        {/* Search Filters Form */}
        <form onSubmit={handleSearch} className="bg-white rounded-2xl shadow-xl p-8 mb-12">
          {/* Display a checkbox for profile recommendation usage (only if user is logged in). */}
          {user && (
            <div className="mb-6">
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={useProfileRecommendations}
                  onChange={toggleProfileRecommendations}
                  className="form-checkbox h-5 w-5 text-blue-600 rounded focus:ring-blue-500"
                />
                <span className="text-gray-700">Use recommendations from profile</span>
              </label>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {/* Location Filter Dropdown */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                Location
              </label>
              <div className="relative">
                <select
                  value={filters.location}
                  onChange={(e) => handleFilterChange('location', e.target.value)}
                  className={`block w-full pl-3 pr-10 py-3 text-base border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                    useProfileRecommendations ? 'bg-gray-100 cursor-not-allowed' : ''
                  }`}
                  disabled={useProfileRecommendations}
                >
                  {LOCATIONS.map((location) => (
                    <option key={location} value={location}>
                      {location}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Room Type Filter Dropdown */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                Room Type
              </label>
              <div className="relative">
                <select
                  value={filters.roomType}
                  onChange={(e) => handleFilterChange('roomType', e.target.value)}
                  className={`block w-full pl-3 pr-10 py-3 text-base border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                    useProfileRecommendations ? 'bg-gray-100 cursor-not-allowed' : ''
                  }`}
                  disabled={useProfileRecommendations}
                >
                  {ROOM_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Minimum Price Input */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                Minimum Price
              </label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="number"
                  placeholder="Min Price"
                  value={filters.minPrice}
                  onChange={(e) => handleFilterChange('minPrice', e.target.value)}
                  className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            {/* Maximum Price Input */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                Maximum Price
              </label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="number"
                  placeholder="Max Price"
                  value={filters.maxPrice}
                  onChange={(e) => handleFilterChange('maxPrice', e.target.value)}
                  className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Search Button */}
          <div className="mt-8 flex justify-center">
            <button
              type="submit"
              disabled={loading}
              className="flex items-center justify-center px-8 py-3 border border-transparent text-base font-medium rounded-lg text-white bg-blue-600 hover:bg-blue-700 md:py-4 md:text-lg md:px-10 transition-all duration-300 transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              <SearchIcon className="h-5 w-5 mr-2" />
              {loading ? 'Searching...' : 'Search Properties'}
            </button>
          </div>
        </form>

        {/* Results Section: Display the list of properties from the search */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {properties.map((property) => (
            <div
              key={property.id}
              className="bg-white rounded-xl shadow-lg overflow-hidden transform transition-all duration-300 hover:scale-105 cursor-pointer"
              onClick={() => navigate(`/property/${property.id}`)}
            >
              <img
                src={property.image_url}
                alt={property.title}
                className="w-full h-48 object-cover"
              />
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">
                    {property.bedrooms} Room HDB
                  </span>
                  <span className="text-lg font-bold text-gray-900">
                    S${property.price.toLocaleString()}
                  </span>
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">{property.title}</h3>
                <div className="flex items-center text-gray-600 mb-4">
                  <Home className="h-5 w-5 mr-2" />
                  <span>{property.location}</span>
                </div>
                <div className="flex items-center justify-between text-sm text-gray-500">
                  <span>{property.bathrooms} Bathrooms</span>
                  <span>{property.area_sqft.toLocaleString()} sqft</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* No Results Message: Displayed if no properties are found and not loading */}
        {properties.length === 0 && !loading && (
          <div className="text-center py-12">
            <div className="text-gray-500 text-lg">
              No properties found. Try adjusting your search filters.
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// Export the Search component as the default export.
export default Search;
