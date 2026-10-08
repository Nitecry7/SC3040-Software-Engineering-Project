// Import React and its hooks for state management and side effects.
import { useState, useEffect } from 'react';
// Import icons from lucide-react for visual representation.
import { Building2, MapPin } from 'lucide-react';
// Import useNavigate hook from react-router-dom for navigation actions.
import { useNavigate } from 'react-router-dom';
// Import the Supabase client (if needed for data fetching within this component or its children).
// Import child components for featured listings and notifications.
import FeaturedListings from '../components/FeaturedListings';
import NotificationPanel from '../components/NotificationPanel';
import { supabase } from '../lib/supabase';
import { loadListingCounts, type ListingCounts } from '../lib/listingCounts';

// Home component for the landing page of SG Homie.
const Home = () => {
  // Get the navigation function for programmatic routing.
  const navigate = useNavigate();

  const [listingCounts, setListingCounts] = useState<ListingCounts | null>(null);
  const [countsError, setCountsError] = useState(false);
  const [countsRefresh, setCountsRefresh] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setListingCounts(null);
    setCountsError(false);
    void loadListingCounts(supabase, controller.signal).then(counts => {
      if (!controller.signal.aborted) setListingCounts(counts);
    }).catch(() => {
      if (!controller.signal.aborted) setCountsError(true);
    });
    return () => controller.abort();
  }, [countsRefresh]);
  const countValue = (value: number | undefined) => countsError ? 'Unavailable' : value === undefined ? 'Loading…' : value.toLocaleString('en-SG');

  // Array of testimonial objects to be used in the Testimonials Section.
  const testimonials = [
    {
      name: "Sarah Chen",
      role: "First-time Homebuyer",
      image: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=150&h=150&q=80",
      quote: "SG Homie made finding my first home a breeze. The AI recommendations were spot-on!"
    },
    {
      name: "Michael Tan",
      role: "Property Investor",
      image: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=150&h=150&q=80",
      quote: "The market analytics helped me make informed investment decisions. Highly recommended!"
    },
    {
      name: "Lisa Wong",
      role: "Family Home Buyer",
      image: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=150&h=150&q=80",
      quote: "Found our dream family home through SG Homie. The process was smooth and efficient."
    }
  ];

  return (
    <div className="relative">
      {/* Hero Section: Compact introduction above the listing counts */}
      <div className="relative flex items-center justify-center overflow-hidden bg-slate-950 pt-36 pb-32 sm:pt-40 sm:pb-36">
        {/* Background image container */}
        <div className="absolute inset-0">
          <img
            src="https://images.unsplash.com/photo-1565967511849-76a60a516170?auto=format&fit=crop&w=2000&q=80"
            alt="Singapore Skyline"
            className="w-full h-full object-cover"
          />
          {/* Keep text readable even over the brightest parts of the photo. */}
          <div className="absolute inset-0 bg-slate-950/70"></div>
        </div>

        {/* Content container for hero text; placed above the background */}
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
          <div className="text-center max-w-4xl mx-auto">
            {/* Generous line boxes and gradient padding preserve letter descenders. */}
            <h1 className="text-4xl/snug sm:text-5xl/snug md:text-6xl/snug lg:text-7xl/snug font-bold text-white mb-6">
              Find Your Perfect
              <span className="block bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text pb-1 text-transparent">
                Home in Singapore
              </span>
            </h1>
            
            {/* Subheading describing the service */}
            <p className="text-lg md:text-2xl text-slate-100 max-w-2xl mx-auto leading-relaxed">
              Discover your dream home with our AI-powered property search platform
            </p>
          </div>
        </div>
      </div>

      {/* Stats Section: Displays key market statistics in card format */}
      <div className="relative z-10 -mt-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Card: Total Properties Listed */}
            <div className="bg-white rounded-2xl p-8 shadow-xl transform hover:-translate-y-2 transition-all duration-300">
              <div className="flex items-center space-x-4">
                <div className="p-3 bg-blue-100 rounded-lg">
                  <Building2 className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-gray-900" aria-live="polite">{countValue(listingCounts?.properties)}</div>
                  <div className="text-gray-600">Properties Listed</div>
                </div>
              </div>
            </div>
            {/* Card: Total Locations */}
            <div className="bg-white rounded-2xl p-8 shadow-xl transform hover:-translate-y-2 transition-all duration-300">
              <div className="flex items-center space-x-4">
                <div className="p-3 bg-emerald-100 rounded-lg">
                  <MapPin className="h-6 w-6 text-emerald-600" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-gray-900" aria-live="polite">{countValue(listingCounts?.locations)}</div>
                  <div className="text-gray-600">Locations</div>
                </div>
              </div>
            </div>
          </div>
          <p className="mt-4 text-sm text-gray-600">
            Counts cover approved HDB listings in SG Homie and their distinct towns, including any approved demo listings.
            {countsError && <button type="button" onClick={() => setCountsRefresh(value => value + 1)} className="ml-2 font-medium text-blue-600 underline">Retry counts</button>}
          </p>
        </div>
      </div>

      {/* How It Works Section: Explains the process with step cards */}
      <div className="py-24 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900">How SG Homie Works</h2>
            <p className="mt-4 text-xl text-gray-600">Simple steps to find your perfect home</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
            {/* Step 1: Create Your Profile */}
            <div className="relative">
              <div className="bg-white rounded-2xl p-8 shadow-xl h-full transform hover:-translate-y-2 transition-all duration-300">
                {/* Step number badge positioned above the card */}
                <div className="absolute -top-6 left-1/2 -translate-x-1/2">
                  <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center text-white text-xl font-bold">1</div>
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mt-6 mb-4">Create Your Profile</h3>
                <p className="text-gray-600">Set up your buyer account and indicate your preferences (can be changed later).</p>
              </div>
            </div>
            {/* Step 2: Talk to AI Assistant */}
            <div className="relative">
              <div className="bg-white rounded-2xl p-8 shadow-xl h-full transform hover:-translate-y-2 transition-all duration-300">
                <div className="absolute -top-6 left-1/2 -translate-x-1/2">
                  <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center text-white text-xl font-bold">2</div>
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mt-6 mb-4">Talk to Our AI Consultant</h3>
                <p className="text-gray-600">Communicate with the consultant your needs to find recommendations based on insights.</p>
              </div>
            </div>
            {/* Step 3: Make It Yours */}
            <div className="relative">
              <div className="bg-white rounded-2xl p-8 shadow-xl h-full transform hover:-translate-y-2 transition-all duration-300">
                <div className="absolute -top-6 left-1/2 -translate-x-1/2">
                  <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center text-white text-xl font-bold">3</div>
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mt-6 mb-4">Make It Yours</h3>
                <p className="text-gray-600">Found your dream home? Directly contact the seller to get the deal done!</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Featured Listings Section: Renders a component displaying featured property listings */}
      <div className="mt-24">
        <FeaturedListings />
      </div>

      {/* Testimonials Section: Displays user testimonials in a grid */}
      <div className="py-24 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900">What Our Users Say</h2>
            <p className="mt-4 text-xl text-gray-600">Join thousands of satisfied homeowners</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Map over testimonials array to render each testimonial card */}
            {testimonials.map((testimonial, index) => (
              <div key={index} className="bg-white rounded-2xl p-8 shadow-xl">
                <div className="flex items-center mb-6">
                  {/* User image */}
                  <img
                    src={testimonial.image}
                    alt={testimonial.name}
                    className="w-16 h-16 rounded-full"
                  />
                  <div className="ml-4">
                    <h3 className="text-lg font-semibold text-gray-900">{testimonial.name}</h3>
                    <p className="text-gray-600">{testimonial.role}</p>
                  </div>
                </div>
                <p className="text-gray-600 italic">"{testimonial.quote}"</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* CTA Section: Call-to-action prompting users to start searching */}
      <div className="relative py-24 bg-blue-600">
        <div className="absolute inset-0 overflow-hidden">
          {/* Background image with low opacity to serve as a decorative element */}
          <img
            src="https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=2000&q=80"
            alt="Background"
            className="w-full h-full object-cover opacity-10"
          />
        </div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-4xl font-bold text-white mb-8">Ready to Find Your Dream Home?</h2>
          <p className="text-xl text-blue-100 mb-12 max-w-2xl mx-auto">
            Join thousands of satisfied homeowners who found their perfect home with SG Homie
          </p>
          {/* Button to navigate to the search page */}
          <button
            onClick={() => navigate('/search')}
            className="px-8 py-4 bg-white text-blue-600 rounded-full hover:bg-blue-50 transition-all duration-300 transform hover:scale-105 text-lg font-medium shadow-xl"
          >
            Start Your Search Today
          </button>
        </div>
      </div>

      {/* Notification Panel: Fixed component to display notifications */}
      <div className="fixed top-20 right-4 z-50">
        <NotificationPanel />
      </div>
    </div>
  );
};

// Export the Home component as the default export.
export default Home;
