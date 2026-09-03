// Import React and its hooks for state management and side effects.
import React, { useState, useEffect } from 'react';
// Import icons from lucide-react for visual representation.
import { Search, TrendingUp, Building2, ArrowRight, MapPin, DollarSign, CheckCircle, Users, Clock, Shield, ChevronRight, PlayCircle } from 'lucide-react';
// Import useNavigate hook from react-router-dom for navigation actions.
import { useNavigate } from 'react-router-dom';
// Import the Supabase client (if needed for data fetching within this component or its children).
import { supabase } from '../lib/supabase';
// Import child components for featured listings and notifications.
import FeaturedListings from '../components/FeaturedListings';
import NotificationPanel from '../components/NotificationPanel';

// Home component for the landing page of SG Homie.
const Home = () => {
  // Get the navigation function for programmatic routing.
  const navigate = useNavigate();

  // State for the search input value.
  const [searchQuery, setSearchQuery] = useState('');
  // State to track if the page has been scrolled past a threshold (used for UI effects).
  const [scrolled, setScrolled] = useState(false);
  // State for the active tab, currently set to 'buy'; may be used for future extensions.
  const [activeTab, setActiveTab] = useState('buy');

  // useEffect to update the 'scrolled' state based on window scroll position.
  useEffect(() => {
    // Handler function to update 'scrolled' when window is scrolled past 50 pixels.
    const handleScroll = () => {
      setScrolled(window.scrollY > 50);
    };

    // Add the scroll event listener.
    window.addEventListener('scroll', handleScroll);
    // Cleanup: remove the event listener when the component unmounts.
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Function to handle the search form submission.
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault(); // Prevent default form submission behavior.
    // Navigate to the search page with the encoded search query as a URL parameter.
    navigate(`/search?q=${encodeURIComponent(searchQuery)}`);
  };

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
      {/* Hero Section: Full-screen background image with overlay, title, and search form */}
      <div className="relative h-screen flex items-center justify-center overflow-hidden">
        {/* Background image container */}
        <div className="absolute inset-0">
          <img
            src="https://images.unsplash.com/photo-1565967511849-76a60a516170?auto=format&fit=crop&w=2000&q=80"
            alt="Singapore Skyline"
            className="w-full h-full object-cover"
          />
          {/* Gradient overlay for improved text readability */}
          <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/60 to-transparent"></div>
        </div>

        {/* Content container for hero text and search form; placed above the background */}
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
          <div className="text-center max-w-4xl mx-auto">
            {/* Main headline with gradient text effect */}
            <h1 className="text-6xl md:text-7xl lg:text-8xl font-bold text-white mb-8 leading-tight">
              Find Your Perfect
              <span className="block bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent">
                Home in Singapore
              </span>
            </h1>
            
            {/* Subheading describing the service */}
            <p className="text-xl md:text-2xl text-gray-300 mb-12 max-w-2xl mx-auto leading-relaxed">
              Discover your dream home with our AI-powered property search platform
            </p>

            {/* Search form */}
            <form onSubmit={handleSearch} className="relative max-w-3xl mx-auto group">
              {/* Background effect behind search input */}
              <div className="absolute inset-0 bg-blue-500 rounded-full blur-xl opacity-20 group-hover:opacity-30 transition-opacity duration-300"></div>
              <input
                type="text"
                placeholder="Where would you like to live?"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-8 py-6 rounded-full bg-white/95 backdrop-blur-sm shadow-2xl focus:outline-none focus:ring-4 focus:ring-blue-500/30 transition-all duration-300 pr-40 text-lg"
              />
              {/* Search button inside the search form */}
              <button
                type="submit"
                className="absolute right-2 top-1/2 -translate-y-1/2 bg-gradient-to-r from-blue-600 to-blue-800 text-white px-8 py-4 rounded-full hover:shadow-lg hover:from-blue-700 hover:to-blue-900 transition-all duration-300 flex items-center space-x-2"
              >
                <Search className="h-5 w-5" />
                <span>Search</span>
              </button>
            </form>

            {/* Call-to-action buttons beneath the search form */}
            <div className="mt-12 flex flex-wrap justify-center gap-6">
              {/* Button to navigate to the search page */}
              <button
                onClick={() => navigate('/search')}
                className="px-8 py-4 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition-all duration-300 transform hover:scale-105 flex items-center space-x-2 group"
              >
                <span>Start Exploring</span>
                <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform duration-300" />
              </button>
              {/* Button to navigate to the analytics page */}
              <button
                onClick={() => navigate('/analytics')}
                className="px-8 py-4 bg-white/90 text-gray-900 rounded-full hover:bg-white transition-all duration-300 transform hover:scale-105 flex items-center space-x-2"
              >
                <TrendingUp className="h-5 w-5" />
                <span>View Market Trends</span>
              </button>
            </div>
          </div>
        </div>

        {/* Scroll Indicator: Guides users to scroll down; fades out when scrolled */}
        <div className={`absolute bottom-8 left-1/2 -translate-x-1/2 transition-opacity duration-500 ${scrolled ? 'opacity-0' : 'opacity-100'}`}>
          <div className="w-6 h-10 border-2 border-white/50 rounded-full flex justify-center">
            <div className="w-1 h-3 bg-white/50 rounded-full mt-2 animate-bounce"></div>
          </div>
        </div>
      </div>

      {/* Stats Section: Displays key market statistics in card format */}
      <div className="relative z-10 -mt-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Card: Total Properties Listed */}
            <div className="bg-white rounded-2xl p-8 shadow-xl transform hover:-translate-y-2 transition-all duration-300">
              <div className="flex items-center space-x-4">
                <div className="p-3 bg-blue-100 rounded-lg">
                  <Building2 className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-gray-900">50,000+</div>
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
                  <div className="text-2xl font-bold text-gray-900">25+</div>
                  <div className="text-gray-600">Locations</div>
                </div>
              </div>
            </div>
            {/* Card: Success Rate */}
            <div className="bg-white rounded-2xl p-8 shadow-xl transform hover:-translate-y-2 transition-all duration-300">
              <div className="flex items-center space-x-4">
                <div className="p-3 bg-purple-100 rounded-lg">
                  <DollarSign className="h-6 w-6 text-purple-600" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-gray-900">98%</div>
                  <div className="text-gray-600">Success Rate</div>
                </div>
              </div>
            </div>
          </div>
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
                <p className="text-gray-600">Tell us your preferences and let our AI match you with perfect properties.</p>
              </div>
            </div>
            {/* Step 2: Browse Properties */}
            <div className="relative">
              <div className="bg-white rounded-2xl p-8 shadow-xl h-full transform hover:-translate-y-2 transition-all duration-300">
                <div className="absolute -top-6 left-1/2 -translate-x-1/2">
                  <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center text-white text-xl font-bold">2</div>
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mt-6 mb-4">Browse Properties</h3>
                <p className="text-gray-600">Explore our curated list of properties with detailed information and virtual tours.</p>
              </div>
            </div>
            {/* Step 3: Make It Yours */}
            <div className="relative">
              <div className="bg-white rounded-2xl p-8 shadow-xl h-full transform hover:-translate-y-2 transition-all duration-300">
                <div className="absolute -top-6 left-1/2 -translate-x-1/2">
                  <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center text-white text-xl font-bold">3</div>
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mt-6 mb-4">Make It Yours</h3>
                <p className="text-gray-600">Connect with agents and make informed decisions with our market insights.</p>
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
