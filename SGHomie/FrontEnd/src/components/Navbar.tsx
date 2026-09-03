import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Menu, X, Home, UserCircle, MessageSquare, Store } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false);
  const { user, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState(false);
  const [isSeller, setIsSeller] = useState(false);

  React.useEffect(() => {
    const checkUserStatus = async () => {
      if (!user) return;

      try {
        const { data } = await supabase
          .from('user_profiles')
          .select('is_admin, is_seller')
          .eq('id', user.id)
          .single();

        setIsAdmin(data?.is_admin || false);
        setIsSeller(data?.is_seller || false);
      } catch (error) {
        console.error('Error checking user status:', error);
      }
    };

    checkUserStatus();
  }, [user]);

  const navigation = user ? [
    { name: 'Start Exploring', href: '/search' },
    { name: 'Explore', href: '/analytics' },
    { name: 'Enquiry', href: '/enquiry' },
    { name: isSeller ? 'Seller Dashboard' : 'Become a Seller', href: isSeller ? '/seller' : '/seller/signup' },
  ] : [
    { name: 'Get Started', href: '/search' },
    { name: 'Explore', href: '/analytics' },
    { name: 'Enquiry', href: '/enquiry' },
  ];

  return (
    <nav className="bg-white/80 backdrop-blur-md shadow-lg fixed w-full z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-20">
          <div className="flex items-center">
            <Link to="/" className="flex items-center group">
              <div className="relative">
                <Home className="h-8 w-8 text-blue-600 transform group-hover:rotate-12 transition-transform duration-300" />
                <div className="absolute -inset-2 bg-blue-100 rounded-full opacity-0 group-hover:opacity-30 transition-opacity duration-300"></div>
              </div>
              <span className="ml-3 text-2xl font-bold bg-gradient-to-r from-blue-600 to-blue-400 bg-clip-text text-transparent hover:from-blue-500 hover:to-blue-300 transition-all duration-300">
                SG Homie
              </span>
            </Link>
          </div>
          
          <div className="hidden md:flex items-center space-x-8">
            {navigation.map((item) => (
              <Link
                key={item.name}
                to={item.href}
                className={`${
                  location.pathname === item.href
                    ? 'text-blue-600 font-semibold'
                    : 'text-gray-700 hover:text-blue-600'
                } transition-all duration-300 hover:scale-105 px-4 py-2 rounded-full hover:bg-blue-50 flex items-center space-x-2`}
              >
                {item.name === 'Seller Dashboard' && <Store className="h-5 w-5" />}
                <span>{item.name}</span>
              </Link>
            ))}
            
            {user ? (
              <div className="relative ml-3 flex items-center space-x-4">
                {isAdmin && (
                  <Link
                    to="/admin"
                    className="text-gray-700 hover:text-blue-600 transition-colors duration-200"
                  >
                    Admin
                  </Link>
                )}
                <Link 
                  to="/profile" 
                  className="flex items-center group relative"
                >
                  <div className="relative">
                    {user.user_metadata.avatar_url ? (
                      <img
                        src={user.user_metadata.avatar_url}
                        alt="Profile"
                        className="h-10 w-10 rounded-full ring-2 ring-blue-600 ring-offset-2 transition-transform duration-300 group-hover:scale-110"
                      />
                    ) : (
                      <UserCircle className="h-10 w-10 text-blue-600 transition-transform duration-300 group-hover:scale-110" />
                    )}
                    <div className="absolute -inset-2 bg-blue-100 rounded-full opacity-0 group-hover:opacity-30 transition-opacity duration-300"></div>
                  </div>
                </Link>
              </div>
            ) : (
              <button
                onClick={() => window.dispatchEvent(new CustomEvent('toggle-auth-modal'))}
                className="bg-blue-600 text-white px-6 py-2.5 rounded-full hover:bg-blue-700 transform hover:scale-105 transition-all duration-300 shadow-md hover:shadow-lg"
              >
                Sign In
              </button>
            )}
          </div>

          <div className="md:hidden flex items-center">
            <button 
              onClick={() => setIsOpen(!isOpen)} 
              className="text-gray-700 hover:text-blue-600 transition-colors duration-300"
            >
              {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      {isOpen && (
        <div className="md:hidden absolute w-full bg-white/95 backdrop-blur-md shadow-lg">
          <div className="px-4 pt-2 pb-3 space-y-2">
            {navigation.map((item) => (
              <Link
                key={item.name}
                to={item.href}
                className="block px-4 py-2 text-gray-700 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all duration-300"
                onClick={() => setIsOpen(false)}
              >
                {item.name}
              </Link>
            ))}
            {isAdmin && (
              <Link
                to="/admin"
                className="block px-4 py-2 text-gray-700 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all duration-300"
                onClick={() => setIsOpen(false)}
              >
                Admin
              </Link>
            )}
            {!user && (
              <button
                onClick={() => {
                  window.dispatchEvent(new CustomEvent('toggle-auth-modal'));
                  setIsOpen(false);
                }}
                className="w-full mt-2 bg-blue-600 text-white px-4 py-2.5 rounded-lg hover:bg-blue-700 transition-all duration-300"
              >
                Sign In
              </button>
            )}
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;