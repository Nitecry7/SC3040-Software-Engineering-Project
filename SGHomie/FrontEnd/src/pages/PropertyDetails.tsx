// Import React and its hooks for managing state and side effects.
import { useEffect, useState } from 'react';
// Import routing hooks to extract parameters from URL and create links.
import { useParams } from 'react-router-dom';
// Import various icons from lucide-react for UI elements.
import { MapPin, Phone, Calendar, Home, Maximize, Bath, Heart, ChevronLeft, ChevronRight, Store, Train, Trees as Tree, Mail, School, ShoppingBag, HeartPulse, Utensils, UsersRound, type LucideIcon } from 'lucide-react';
// Import Leaflet components for displaying maps.
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
// Import the Icon constructor from Leaflet to create custom markers.
import { divIcon } from 'leaflet';
// Import the Supabase client for backend operations.
import { supabase } from '../lib/supabase';
// Import the custom authentication context to access user data.
import { useAuth } from '../contexts/AuthContext';
// Import the Property type definition.
import type { Property } from '../types/supabase';
import { AMENITY_CATEGORIES, filterAndSortAmenities, formatAmenityDistance, getAmenityCategoryLabel, getAmenityCategoryMetadata, isDemoAmenity, type Amenity, type AmenityCategory } from '../lib/amenities';
// Import toast for displaying notifications.
import toast from 'react-hot-toast';
// Import Leaflet CSS for proper map styling.
import 'leaflet/dist/leaflet.css';

// Define interface for SellerInfo.
interface SellerInfo {
  name: string;
  email: string;
  phone: string;
}

// Default coordinates for Singapore to fallback to if property coordinates are missing.
const DEFAULT_COORDINATES = {
  latitude: 1.3521,
  longitude: 103.8198
};

const PROPERTY_MAP_ICON = divIcon({
  className: 'property-location-icon',
  html: '<span class="property-location-marker" aria-label="Property location"></span>',
  iconSize: [36, 42],
  iconAnchor: [18, 42],
  popupAnchor: [0, -40],
});

const createAmenityMapIcon = (type: string) => divIcon({
  className: 'nearby-marker-icon',
  html: `<span class="nearby-marker amenity-tone--${getAmenityCategoryMetadata(type).tone}" aria-hidden="true"></span>`,
  iconSize: [23, 23],
  iconAnchor: [11, 11],
  popupAnchor: [0, -11],
});

const AMENITY_MAP_ICONS = Object.fromEntries(
  [...AMENITY_CATEGORIES.filter(({ value }) => value !== 'all').map(({ value }) => value), 'Other']
    .map((type) => [type, createAmenityMapIcon(type)]),
 ) as Record<string, ReturnType<typeof divIcon>>;

const AMENITY_LIST_ICONS: Record<string, LucideIcon> = {
  Transport: Train,
  School,
  Shopping: ShoppingBag,
  Healthcare: HeartPulse,
  Food: Utensils,
  Park: Tree,
  Community: UsersRound,
};

const getAmenityIcon = (type: string): LucideIcon => AMENITY_LIST_ICONS[type] ?? MapPin;

// Main functional component for displaying the property details page.
const PropertyDetails = () => {
  // Extract the property ID from the URL parameters.
  const { id } = useParams();
  // Get the currently authenticated user from the custom Auth context.
  const { user } = useAuth();
  // Local state to store the fetched property details.
  const [property, setProperty] = useState<Property | null>(null);
  // State to hold a list of amenities related to the property.
  const [amenities, setAmenities] = useState<Amenity[]>([]);
  const [amenitiesLoading, setAmenitiesLoading] = useState(true);
  const [amenitiesError, setAmenitiesError] = useState(false);
  const [amenityCategory, setAmenityCategory] = useState<AmenityCategory>('all');
  // State to track loading state while fetching data.
  const [loading, setLoading] = useState(true);
  // State to track the currently displayed image index in the gallery.
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  // State to store the number of users who showed interest in this property.
  const [interestCount, setInterestCount] = useState(0);
  // Boolean state that indicates if the current user has expressed interest in the property.
  const [isInterested, setIsInterested] = useState(false);
  // State to store the seller's information.
  const [sellerInfo, setSellerInfo] = useState<SellerInfo | null>(null);

  // Function to navigate to the previous image in the gallery.
  const prevImage = () => {
    const photos = property?.photos ?? [];
    if (photos.length === 0) return;
    setCurrentImageIndex((prevIndex) => 
      prevIndex === 0 ? photos.length - 1 : prevIndex - 1
    );
  };

  // Function to navigate to the next image in the gallery.
  const nextImage = () => {
    const photos = property?.photos ?? [];
    if (photos.length === 0) return;
    setCurrentImageIndex((prevIndex) => 
      prevIndex === photos.length - 1 ? 0 : prevIndex + 1
    );
  };

  // useEffect hook to fetch property details, seller info, amenities, and interest count.
  useEffect(() => {
    setLoading(true);
    setProperty(null);
    setAmenities([]);
    setAmenitiesLoading(true);
    setAmenitiesError(false);
    setAmenityCategory('all');
    let cancelled = false;

    const fetchAmenities = async (propertyId: string) => {
      setAmenitiesLoading(true);
      setAmenitiesError(false);
      try {
        const { data: amenitiesData, error: amenitiesError } = await supabase
          .from('property_amenities')
          .select('*')
          .eq('property_id', propertyId);

        if (amenitiesError) throw amenitiesError;
        if (!cancelled) setAmenities((amenitiesData ?? []) as Amenity[]);
      } catch (error) {
        console.error('Error fetching property amenities:', error);
        if (!cancelled) {
          setAmenities([]);
          setAmenitiesError(true);
        }
      } finally {
        if (!cancelled) setAmenitiesLoading(false);
      }
    };

    const fetchPropertyDetails = async () => {
      try {
        // Fetch property details from the "properties" table using the given id.
        const { data: propertyData, error: propertyError } = await supabase
          .from('properties')
          .select('*')
          .eq('id', id)
          .maybeSingle();

        if (propertyError) throw propertyError;
        if (!propertyData) {
          setProperty(null);
          toast.error('This property is unavailable or has not been approved yet');
          return;
        }

        // Set the fetched property data.
        setProperty(propertyData);

        // Use the public seller details stored on the property. Reading another
        // user's private profile or Auth email is blocked by RLS and caused
        // PostgREST 406 errors for buyers viewing property details.
        setSellerInfo({
          name: propertyData.seller_name || 'Unknown',
          phone: propertyData.seller_phone || 'Not provided',
          email: 'Not provided',
        });

        void fetchAmenities(propertyData.id);

        // Fetch the current count of "interest" records for this property.
        const { count, error: countError } = await supabase
          .from('property_interests')
          .select('*', { count: 'exact' })
          .eq('property_id', id);

        if (countError) throw countError;
        // Set the interest count state.
        setInterestCount(count || 0);

        // If a user is logged in, check whether the current user has expressed interest in this property.
        if (user) {
          const { data: interestData, error: interestError } = await supabase
            .from('property_interests')
            .select('*')
            .eq('property_id', id)
            .eq('user_id', user.id)
            .maybeSingle();

          if (interestError) throw interestError;
          // Set isInterested state based on whether the interest record exists.
          setIsInterested(!!interestData);
        }

        // Subscribe to real-time updates for the interest count on this property.
        const channel = supabase
          .channel('interests')
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'property_interests',
              filter: `property_id=eq.${id}`
            },
            async () => {
              // When any change occurs, re-fetch the interest count.
              const { count: newCount } = await supabase
                .from('property_interests')
                .select('*', { count: 'exact' })
                .eq('property_id', id);
              
              setInterestCount(newCount || 0);
            }
          )
          .subscribe();

        // Cleanup function: Unsubscribe from real-time updates when component unmounts.
        return () => {
          supabase.removeChannel(channel);
        };
      } catch (error) {
        // Log the error and show a notification if fetching fails.
        console.error('Error fetching property details:', error);
        toast.error('Failed to load property details');
      } finally {
        // Turn off the loading spinner once all operations complete.
        setLoading(false);
      }
    };

    // Invoke the async function to fetch property details.
    fetchPropertyDetails();

    return () => {
      cancelled = true;
    };
  }, [id, user]);

  // Function to toggle the interest status for the current user.
  const toggleInterest = async () => {
    // If no user is logged in, trigger the authentication modal (custom event).
    if (!user) {
      window.dispatchEvent(new CustomEvent('toggle-auth-modal'));
      return;
    }

    try {
      if (isInterested) {
        // If the user is already interested, remove their interest.
        const { error } = await supabase
          .from('property_interests')
          .delete()
          .eq('property_id', id)
          .eq('user_id', user.id);

        if (error) throw error;
        // Update local state to reflect removal of interest.
        setIsInterested(false);
        setInterestCount(prev => prev - 1);
        toast.success('Removed from interests');
      } else {
        // Otherwise, add a new interest record.
        const { error } = await supabase
          .from('property_interests')
          .insert([{ property_id: id, user_id: user.id }]);

        if (error) throw error;
        // Update state indicating the user is now interested.
        setIsInterested(true);
        setInterestCount(prev => prev + 1);
        toast.success('Added to interests');
      }
    } catch (error) {
      // Log any error and notify the user if the operation fails.
      console.error('Error toggling interest:', error);
      toast.error('Failed to update interest');
    }
  };

  // Display a loading screen while property details are being fetched.
  if (loading) {
    return (
      <div className="pt-16 min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-600">Loading property details...</div>
      </div>
    );
  }

  // If property data is not available, display a "not found" message.
  if (!property) {
    return (
      <div className="pt-16 min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-600">Property not found</div>
      </div>
    );
  }

  // Define coordinates for the map: use property's coordinates or fallback to default.
  const coordinates = {
    latitude: property.latitude ?? DEFAULT_COORDINATES.latitude,
    longitude: property.longitude ?? DEFAULT_COORDINATES.longitude
  };
  const visibleAmenities = filterAndSortAmenities(amenities, amenityCategory);
  const hasDemoAmenities = visibleAmenities.some(isDemoAmenity);

  // Main rendered output for the PropertyDetails page.
  return (
    <div className="pt-16 min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-xl shadow-lg overflow-hidden">
          {/* Image Gallery Section */}
          <div className="relative h-[500px]">
            <img
              src={property.photos?.[currentImageIndex] || property.image_url}
              alt={property.title}
              className="w-full h-full object-cover"
            />
            {/* Render navigation buttons if multiple photos exist */}
            {property.photos && property.photos.length > 1 && (
              <>
                <button
                  onClick={prevImage}
                  className="absolute left-4 top-1/2 -translate-y-1/2 bg-black/50 text-white p-2 rounded-full hover:bg-black/70 transition-colors"
                >
                  <ChevronLeft className="h-6 w-6" />
                </button>
                <button
                  onClick={nextImage}
                  className="absolute right-4 top-1/2 -translate-y-1/2 bg-black/50 text-white p-2 rounded-full hover:bg-black/70 transition-colors"
                >
                  <ChevronRight className="h-6 w-6" />
                </button>
                {/* Dot indicators for each image */}
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex space-x-2">
                  {property.photos.map((_, index) => (
                    <button
                      key={index}
                      onClick={() => setCurrentImageIndex(index)}
                      className={`w-2 h-2 rounded-full ${index === currentImageIndex ? 'bg-white' : 'bg-white/50'}`}
                    />
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Property Details Section */}
          <div className="p-8">
            <div className="flex justify-between items-start">
              {/* Property Title and Location */}
              <div>
                <h1 className="text-3xl font-bold text-gray-900">{property.title}</h1>
                <div className="mt-2 flex items-center text-gray-600">
                  <MapPin className="h-5 w-5 mr-2" />
                  <span>{property.detailed_location}</span>
                </div>
              </div>
              {/* Property Price Information */}
              <div className="text-right">
                <div className="text-3xl font-bold text-blue-600">
                  S${property.price.toLocaleString()}
                </div>
                <div className="text-sm text-gray-500 mt-1">
                  S${Math.round(property.price / property.area_sqft).toLocaleString()} per sqft
                </div>
              </div>
            </div>

            {/* Interest Button Section */}
            <div className="mt-8 flex items-center space-x-4">
              <button
                onClick={toggleInterest}
                className={`flex items-center space-x-2 px-6 py-3 rounded-full transition-colors ${
                  isInterested
                    ? 'bg-red-100 text-red-600 hover:bg-red-200'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                <Heart className={`h-5 w-5 ${isInterested ? 'fill-current' : ''}`} />
                <span>{isInterested ? 'Interested' : 'Show Interest'}</span>
              </button>
              <div className="text-gray-600">
                <span className="font-semibold">{interestCount}</span> people interested
              </div>
            </div>

            {/* Key Features Section */}
            <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-6">
              <div className="flex items-center">
                <Home className="h-6 w-6 text-blue-600 mr-3" />
                <div>
                  <div className="text-sm text-gray-500">Rooms</div>
                  <div className="font-semibold">{property.bedrooms} Bedrooms</div>
                </div>
              </div>
              <div className="flex items-center">
                <Bath className="h-6 w-6 text-blue-600 mr-3" />
                <div>
                  <div className="text-sm text-gray-500">Bathrooms</div>
                  <div className="font-semibold">{property.bathrooms} Bathrooms</div>
                </div>
              </div>
              <div className="flex items-center">
                <Maximize className="h-6 w-6 text-blue-600 mr-3" />
                <div>
                  <div className="text-sm text-gray-500">Floor Area</div>
                  <div className="font-semibold">{property.area_sqft} sqft</div>
                </div>
              </div>
              <div className="flex items-center">
                <Calendar className="h-6 w-6 text-blue-600 mr-3" />
                <div>
                  <div className="text-sm text-gray-500">Built Year</div>
                  <div className="font-semibold">{property.built_year}</div>
                </div>
              </div>
            </div>

            {/* Description Section */}
            <div className="mt-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Description</h2>
              <p className="text-gray-600 leading-relaxed">{property.description}</p>
            </div>

            {/* Nearby location context */}
            <section className="mt-10" aria-labelledby="nearby-heading">
              <div className="mb-5">
                <p className="text-sm font-semibold uppercase tracking-wide text-blue-700">Location context</p>
                <h2 id="nearby-heading" className="mt-1 text-2xl font-bold text-gray-900">What’s nearby</h2>
                <p className="mt-1 text-sm text-gray-600">Explore nearby categories and their mapped positions.</p>
              </div>

              <div className="mb-5 flex gap-2 overflow-x-auto pb-2" role="group" aria-label="Filter nearby categories">
                {AMENITY_CATEGORIES.map((category) => (
                  <button
                    key={category.value}
                    type="button"
                    aria-pressed={amenityCategory === category.value}
                    onClick={() => setAmenityCategory(category.value)}
                    data-amenity-tone={category.tone}
                    className={`nearby-category-chip amenity-tone--${category.tone} shrink-0 rounded-full border px-4 py-2 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-700 ${
                      amenityCategory === category.value
                        ? 'is-selected border-slate-900 bg-slate-900 font-semibold text-white'
                        : 'border-gray-200 bg-white text-gray-700 hover:border-gray-400 hover:bg-gray-50'
                    }`}
                  >
                    <span className="nearby-category-chip__dot" aria-hidden="true" />
                    {category.label}
                  </button>
                ))}
              </div>

              {hasDemoAmenities && (
                <p className="mb-4 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-900">
                  Illustrative demo locations, not verified facilities or walking routes.
                </p>
              )}

              <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(280px,0.8fr)_minmax(0,1.5fr)]">
                <div className="order-2 rounded-xl border border-gray-200 bg-white p-4 sm:p-5 lg:order-1">
                  <div className="mb-4 flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-gray-900">Nearby places</h3>
                    {!amenitiesLoading && !amenitiesError && amenities.length > 0 && (
                      <span className="text-sm text-gray-500">{visibleAmenities.length} shown</span>
                    )}
                  </div>

                  {amenitiesLoading ? (
                    <p className="rounded-lg bg-gray-50 p-5 text-sm text-gray-600" role="status">Loading nearby information…</p>
                  ) : amenitiesError ? (
                    <p className="rounded-lg bg-amber-50 p-5 text-sm text-amber-900" role="status">
                      Nearby amenity information could not be loaded. The property details are still available.
                    </p>
                  ) : amenities.length === 0 ? (
                    <p className="rounded-lg bg-gray-50 p-5 text-sm text-gray-600">
                      Nearby amenity information is not available yet.
                    </p>
                  ) : visibleAmenities.length === 0 ? (
                    <p className="rounded-lg bg-gray-50 p-5 text-sm text-gray-600">
                      No amenities are available in this category.
                    </p>
                  ) : (
                    <ul className="max-h-[420px] divide-y divide-gray-100 overflow-y-auto pr-1">
                      {visibleAmenities.map((amenity) => {
                        const AmenityIcon = getAmenityIcon(amenity.type);
                        const category = getAmenityCategoryMetadata(amenity.type);
                        return (
                          <li key={amenity.id} className="flex items-start justify-between gap-3 py-4 first:pt-1 last:pb-1">
                            <div className="flex min-w-0 items-center gap-3">
                              <span className={`amenity-list-icon amenity-tone--${category.tone} flex h-10 w-10 shrink-0 items-center justify-center rounded-full`}>
                                <AmenityIcon className="h-5 w-5" aria-hidden="true" />
                              </span>
                              <div className="min-w-0 pt-0.5">
                                <p className="break-words font-medium leading-5 text-gray-900">{amenity.name}</p>
                                <p className={`amenity-category-label amenity-tone--${category.tone} mt-0.5 text-sm font-medium`}>{category.label}</p>
                              </div>
                            </div>
                            <span className={`amenity-distance-badge amenity-tone--${category.tone} mt-1 shrink-0 rounded-full px-2.5 py-1 text-xs font-medium`}>
                              {formatAmenityDistance(amenity.distance)}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>

                <div className="order-1 h-[360px] overflow-hidden rounded-xl border border-gray-200 bg-gray-100 sm:h-[420px] lg:order-2 lg:h-[500px]">
                  <MapContainer
                    key={property.id}
                    center={[coordinates.latitude, coordinates.longitude]}
                    zoom={15}
                    style={{ height: '100%', width: '100%' }}
                  >
                    <TileLayer
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    />
                    <Marker position={[coordinates.latitude, coordinates.longitude]} icon={PROPERTY_MAP_ICON}>
                      <Popup>
                        <div className="font-semibold">{property.title}</div>
                        <div className="text-sm text-gray-600">{property.detailed_location}</div>
                      </Popup>
                    </Marker>
                    {!amenitiesError && visibleAmenities.map((amenity) => (
                      <Marker
                        key={amenity.id}
                        position={[amenity.latitude, amenity.longitude]}
                        icon={AMENITY_MAP_ICONS[amenity.type] ?? AMENITY_MAP_ICONS.Other}
                      >
                        <Popup>
                          <div className="font-semibold">{amenity.name}</div>
                          <div className="text-sm text-gray-600">
                            {getAmenityCategoryLabel(amenity.type)} · {formatAmenityDistance(amenity.distance)}
                          </div>
                          {isDemoAmenity(amenity) && <div className="mt-1 text-xs text-amber-800">Demo location</div>}
                        </Popup>
                      </Marker>
                    ))}
                  </MapContainer>
                </div>
              </div>
            </section>
            {/* Seller Contact Information Section */}
            <div className="mt-8 bg-blue-50 rounded-lg p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Contact Information</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="flex items-center">
                  <div className="bg-blue-100 p-3 rounded-full">
                    <Store className="h-6 w-6 text-blue-600" />
                  </div>
                  <div className="ml-4">
                    <div className="text-sm text-gray-500">Seller Name</div>
                    <div className="font-semibold">{sellerInfo?.name || property.seller_name}</div>
                  </div>
                </div>
                <div className="flex items-center">
                  <div className="bg-blue-100 p-3 rounded-full">
                    <Phone className="h-6 w-6 text-blue-600" />
                  </div>
                  <div className="ml-4">
                    <div className="text-sm text-gray-500">Contact Number</div>
                    <div className="font-semibold">{sellerInfo?.phone || property.seller_phone}</div>
                  </div>
                </div>
                <div className="flex items-center">
                  <div className="bg-blue-100 p-3 rounded-full">
                    <Mail className="h-6 w-6 text-blue-600" />
                  </div>
                  <div className="ml-4">
                    <div className="text-sm text-gray-500">Email</div>
                    <div className="font-semibold">{sellerInfo?.email}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Export the PropertyDetails component as the default export.
export default PropertyDetails;
