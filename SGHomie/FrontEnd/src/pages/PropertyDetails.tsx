// Import React and its hooks for managing state and side effects.
import React, { useEffect, useState } from 'react';
// Import routing hooks to extract parameters from URL and create links.
import { useParams, Link } from 'react-router-dom';
// Import various icons from lucide-react for UI elements.
import { MapPin, Phone, Calendar, Home, Maximize, Bath, DollarSign, Heart, ChevronLeft, ChevronRight, Store, Train, Trees as Tree, Mail } from 'lucide-react';
// Import Leaflet components for displaying maps.
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
// Import the Icon constructor from Leaflet to create custom markers.
import { Icon } from 'leaflet';
// Import the Supabase client for backend operations.
import { supabase } from '../lib/supabase';
// Import the custom authentication context to access user data.
import { useAuth } from '../contexts/AuthContext';
// Import the Property type definition.
import type { Property } from '../types/supabase';
// Import toast for displaying notifications.
import toast from 'react-hot-toast';
// Import Leaflet CSS for proper map styling.
import 'leaflet/dist/leaflet.css';

// Define interface for an Amenity object.
interface Amenity {
  id: string;
  name: string;
  type: string;
  distance: number;
  latitude: number;
  longitude: number;
}

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
    if (!property?.photos) return;
    setCurrentImageIndex((prevIndex) => 
      prevIndex === 0 ? property.photos.length - 1 : prevIndex - 1
    );
  };

  // Function to navigate to the next image in the gallery.
  const nextImage = () => {
    if (!property?.photos) return;
    setCurrentImageIndex((prevIndex) => 
      prevIndex === property.photos.length - 1 ? 0 : prevIndex + 1
    );
  };

  // Define custom icons for different amenity types using Leaflet's Icon constructor.
  const amenityIcons = {
    Shopping: new Icon({
      iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
      iconSize: [25, 41],
      iconAnchor: [12, 41],
    }),
    Transport: new Icon({
      iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
      iconSize: [25, 41],
      iconAnchor: [12, 41],
    }),
    Park: new Icon({
      iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
      iconSize: [25, 41],
      iconAnchor: [12, 41],
    }),
    Community: new Icon({
      iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-yellow.png',
      iconSize: [25, 41],
      iconAnchor: [12, 41],
    }),
  };

  // Function to return a corresponding JSX icon component for an amenity type.
  const getAmenityIcon = (type: string) => {
    switch (type) {
      case 'Shopping':
        return <Store className="h-5 w-5 text-red-500" />;
      case 'Transport':
        return <Train className="h-5 w-5 text-blue-500" />;
      case 'Park':
        return <Tree className="h-5 w-5 text-green-500" />;
      default:
        return <MapPin className="h-5 w-5 text-yellow-500" />;
    }
  };

  // useEffect hook to fetch property details, seller info, amenities, and interest count.
  useEffect(() => {
    const fetchPropertyDetails = async () => {
      try {
        // Fetch property details from the "properties" table using the given id.
        const { data: propertyData, error: propertyError } = await supabase
          .from('properties')
          .select('*')
          .eq('id', id)
          .single();

        if (propertyError) throw propertyError;
        // Set the fetched property data.
        setProperty(propertyData);

        // Fetch the seller's information from the "user_profiles" table if a seller_id exists.
        if (propertyData.seller_id) {
          const { data: userData, error: userError } = await supabase
            .from('user_profiles')
            .select('name, phone')
            .eq('id', propertyData.seller_id)
            .single();

          if (userError) throw userError;

          // Also fetch seller's email from a view (auth_users_view) containing authenticated users' emails.
          const { data: authData, error: authError } = await supabase
            .from('auth_users_view')
            .select('email')
            .eq('id', propertyData.seller_id)
            .single();

          // If email is fetched successfully, update sellerInfo state.
          if (!authError && authData) {
            setSellerInfo({
              name: userData?.name || propertyData.seller_name || 'Unknown',
              phone: userData?.phone || propertyData.seller_phone || 'Not provided',
              email: authData.email || 'Not provided'
            });
          }
        }

        // Fetch related amenities from the "property_amenities" table.
        const { data: amenitiesData, error: amenitiesError } = await supabase
          .from('property_amenities')
          .select('*')
          .eq('property_id', id);

        if (amenitiesError) throw amenitiesError;
        // Set the amenities state with the fetched data.
        setAmenities(amenitiesData);

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

            {/* Map and Amenities Section */}
            <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Map Container */}
              <div className="bg-white rounded-xl shadow-lg overflow-hidden">
                <div className="h-[400px]">
                  <MapContainer
                    center={[coordinates.latitude, coordinates.longitude]}
                    zoom={15}
                    style={{ height: '100%', width: '100%' }}
                  >
                    {/* Base map layer from OpenStreetMap */}
                    <TileLayer
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    />
                    {/* Marker for the property location with a popup */}
                    <Marker position={[coordinates.latitude, coordinates.longitude]}>
                      <Popup>
                        <div className="font-semibold">{property.title}</div>
                        <div className="text-sm text-gray-600">{property.detailed_location}</div>
                      </Popup>
                    </Marker>
                    {/* Render markers for each amenity associated with this property */}
                    {amenities.map((amenity) => (
                      <Marker
                        key={amenity.id}
                        position={[amenity.latitude, amenity.longitude]}
                        icon={amenityIcons[amenity.type as keyof typeof amenityIcons]}
                      >
                        <Popup>
                          <div className="font-semibold">{amenity.name}</div>
                          <div className="text-sm text-gray-600">
                            {amenity.type} • {amenity.distance}km away
                          </div>
                        </Popup>
                      </Marker>
                    ))}
                  </MapContainer>
                </div>
              </div>

              {/* Amenities List */}
              <div className="bg-white rounded-xl shadow-lg p-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-6">Nearby Amenities</h2>
                <div className="space-y-4">
                  {amenities.map((amenity) => (
                    <div
                      key={amenity.id}
                      className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                    >
                      <div className="flex items-center space-x-4">
                        <div className="p-2 bg-white rounded-full">
                          {/* Display an icon corresponding to the amenity type */}
                          {getAmenityIcon(amenity.type)}
                        </div>
                        <div>
                          <div className="font-medium text-gray-900">{amenity.name}</div>
                          <div className="text-sm text-gray-600">{amenity.type}</div>
                        </div>
                      </div>
                      {/* Display the distance of the amenity from the property */}
                      <div className="text-sm font-medium text-gray-600">
                        {amenity.distance}km away
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

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
