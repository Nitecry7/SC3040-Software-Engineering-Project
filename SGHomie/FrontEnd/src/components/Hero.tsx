import React, { useState } from 'react';
import { Search } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';

const Hero = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const navigate = useNavigate();
  const { user } = useAuth();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      toast.error('Please sign in to search properties');
      window.dispatchEvent(new CustomEvent('toggle-auth-modal'));
      return;
    }
    navigate(`/search?q=${encodeURIComponent(searchQuery)}`);
  };

  const handleExploreClick = () => {
    if (!user) {
      toast.error('Please sign in to start exploring');
      window.dispatchEvent(new CustomEvent('toggle-auth-modal'));
      return;
    }
    navigate('/search');
  };

  const handleAnalyticsClick = () => {
    if (!user) {
      toast.error('Please sign in to view market insights');
      window.dispatchEvent(new CustomEvent('toggle-auth-modal'));
      return;
    }
    navigate('/analytics');
  };

  return (
    <div className="relative min-h-screen">
      <div className="absolute inset-0">
        <img
          className="w-full h-full object-cover"
          src="https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=2000&q=80"
          alt="Modern Singapore Residential Area"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/50 to-transparent"></div>
      </div>
      
      <div className="relative min-h-screen flex flex-col justify-center">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-32">
          <div className="text-center max-w-3xl mx-auto">
            <h1 className="text-5xl tracking-tight font-extrabold text-white sm:text-6xl md:text-7xl">
              <span className="block">Start Navigating</span>
              <span className="block bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-emerald-400">
                Your Dream Home
              </span>
            </h1>
            <p className="mt-6 text-xl text-gray-300 max-w-2xl mx-auto leading-relaxed">
              Discover exceptional properties in Singapore with our AI-powered platform. 
              Find your perfect home with personalized recommendations.
            </p>
          </div>

          <div className="mt-12 max-w-xl mx-auto">
            <form onSubmit={handleSearch} className="relative group">
              <input
                type="text"
                placeholder="Search by location, property type, or keywords..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-8 py-5 rounded-full bg-white/95 backdrop-blur-sm shadow-xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-300 pr-36 text-lg"
              />
              <button 
                type="submit"
                className="absolute right-2 top-1/2 -translate-y-1/2 bg-gradient-to-r from-blue-600 to-blue-700 text-white px-8 py-3 rounded-full hover:from-blue-700 hover:to-blue-800 transition-all duration-300 flex items-center space-x-2 shadow-lg hover:shadow-blue-500/25"
              >
                <Search className="h-5 w-5" />
                <span>Search</span>
              </button>
            </form>

            <div className="mt-10 flex flex-col sm:flex-row justify-center items-center space-y-4 sm:space-y-0 sm:space-x-6">
              <button
                onClick={handleExploreClick}
                className="w-full sm:w-auto px-8 py-4 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-full hover:from-blue-700 hover:to-blue-800 transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl text-lg font-medium"
              >
                {user ? 'Start Exploring' : 'Get Started'}
              </button>
              <button
                onClick={handleAnalyticsClick}
                className="w-full sm:w-auto px-8 py-4 bg-white/90 backdrop-blur-sm text-gray-900 rounded-full hover:bg-white transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl text-lg font-medium"
              >
                View Market Insights
              </button>
            </div>
          </div>

          {/* Feature highlights */}
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-20">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="bg-white/90 backdrop-blur-sm p-6 rounded-2xl shadow-lg">
                <div className="text-blue-600 font-semibold">Smart Search</div>
                <p className="text-gray-600 mt-2">Advanced filters and AI-powered property matching</p>
              </div>
              <div className="bg-white/90 backdrop-blur-sm p-6 rounded-2xl shadow-lg">
                <div className="text-blue-600 font-semibold">Market Analysis</div>
                <p className="text-gray-600 mt-2">Real-time insights and price predictions</p>
              </div>
              <div className="bg-white/90 backdrop-blur-sm p-6 rounded-2xl shadow-lg">
                <div className="text-blue-600 font-semibold">Virtual Tours</div>
                <p className="text-gray-600 mt-2">Immersive 3D property viewings</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Hero;