// Import React and its hooks for managing state and effects.
import React, { useEffect, useState } from 'react';
// Import useNavigate from react-router-dom for programmatic navigation.
import { useNavigate } from 'react-router-dom';
// Import custom Auth context to access current user information.
import { useAuth } from '../contexts/AuthContext';
// Import Supabase client to interact with your backend database.
import { supabase } from '../lib/supabase';
// Import icons from lucide-react for visual elements (UserCircle, CheckCircle, etc.).
import { UserCircle, CheckCircle } from 'lucide-react';
// Import toast to display popup notifications.
import toast from 'react-hot-toast';

// Define a constant array of location names for use in a select dropdown.
// The array is sorted alphabetically.
const LOCATIONS = [
  'ANG MO KIO', 'BEDOK', 'BISHAN', 'BUKIT BATOK', 'BUKIT MERAH',
  'BUKIT PANJANG', 'BUKIT TIMAH', 'CENTRAL AREA', 'CHOA CHU KANG',
  'CLEMENTI', 'GEYLANG', 'HOUGANG', 'JURONG EAST', 'JURONG WEST',
  'KALLANG/WHAMPOA', 'MARINE PARADE', 'PASIR RIS', 'PUNGGOL',
  'QUEENSTOWN', 'SEMBAWANG', 'SENGKANG', 'SERANGOON', 'TAMPINES',
  'TOA PAYOH', 'WOODLANDS', 'YISHUN'
].sort();

// SellerSignup component for registering as a seller.
const SellerSignup = () => {
  // Destructure the current user and signOut method from the Auth context.
  const { user } = useAuth();
  // Get navigate function from react-router-dom.
  const navigate = useNavigate();

  // Local state to track whether an operation (e.g., network call) is loading.
  const [loading, setLoading] = useState(false);
  // State to store profile information used for seller registration.
  // It includes name, location, email, phone, and whether the user agreed to terms.
  const [profile, setProfile] = useState({
    name: '',
    location: '',
    email: '',
    phone: '',
    agreed: false
  });

  // useEffect to fetch the user's profile data from Supabase on mount or when user changes.
  useEffect(() => {
    // If no authenticated user exists, navigate back to the home page.
    if (!user) {
      navigate('/');
      return;
    }

    // Async function to fetch profile data.
    const fetchProfile = async () => {
      try {
        // Query the "user_profiles" table for the current user's profile.
        const { data, error } = await supabase
          .from('user_profiles')
          .select('name, is_seller, phone, preferred_locations')
          .eq('id', user.id)
          .single();

        // If an error occurs, throw the error.
        if (error) throw error;

        // If the user is already a seller (is_seller flag is true), navigate to the seller dashboard.
        if (data?.is_seller) {
          navigate('/seller');
          return;
        }

        // Update the profile state with values from the fetched data.
        // Use the user's email from the auth context if available.
        setProfile(prev => ({
          ...prev,
          name: data?.name || '',
          phone: data?.phone || '',
          location: data?.preferred_locations?.[0] || '',
          email: user.email || ''
        }));
      } catch (error) {
        // Log the error and show an error notification.
        console.error('Error fetching profile:', error);
        toast.error('Failed to load profile');
      }
    };

    // Invoke the function to fetch profile details.
    fetchProfile();
  }, [user, navigate]);

  // Handler for form submission when the seller registers.
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); // Prevent the default behavior of the form.
    // Check if the user has agreed to the terms and conditions.
    if (!profile.agreed) {
      toast.error('Please agree to the terms and conditions');
      return;
    }

    // Validate the phone number format: must follow the format "+65 XXXX XXXX".
    const phoneRegex = /^\+65 [0-9]{4} [0-9]{4}$/;
    if (!phoneRegex.test(profile.phone)) {
      toast.error('Please enter a valid phone number in the format: +65 XXXX XXXX');
      return;
    }

    // Set loading state to true while processing the submission.
    setLoading(true);
    try {
      // Update the user's profile in the "user_profiles" table, setting the seller flag to true.
      const { error } = await supabase
        .from('user_profiles')
        .update({
          name: profile.name,
          phone: profile.phone,
          preferred_locations: [profile.location],
          is_seller: true
        })
        .eq('id', user?.id);

      // Throw an error if the update fails.
      if (error) throw error;

      // On success, show a success notification.
      toast.success('Successfully registered as a seller!');
      // Navigate the user to the seller dashboard.
      navigate('/seller');
    } catch (error) {
      // Log the error and display an error notification.
      console.error('Error updating profile:', error);
      toast.error('Failed to register as seller');
    } finally {
      // Set loading to false after the submission completes.
      setLoading(false);
    }
  };

  // The main render block for the SellerSignup component.
  return (
    <div className="pt-16 min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Container for the signup form with a white background and rounded corners */}
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
          <div className="px-6 py-8 sm:p-10">
            {/* Header section for the Seller Signup page */}
            <div className="text-center">
              <h2 className="text-3xl font-bold text-gray-900">Become a Seller</h2>
              <p className="mt-2 text-gray-600">
                Join our community of property sellers and start listing your properties
              </p>
            </div>

            {/* Seller Signup Form */}
            <form onSubmit={handleSubmit} className="mt-8 space-y-6">
              {/* Full Name Input Field */}
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Full Name
                </label>
                <input
                  type="text"
                  value={profile.name}
                  onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  required
                />
              </div>

              {/* Phone Number Input Field */}
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Phone Number
                </label>
                <input
                  type="tel"
                  value={profile.phone}
                  onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                  placeholder="+65 XXXX XXXX"
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  required
                />
                <p className="mt-1 text-sm text-gray-500">Format: +65 XXXX XXXX</p>
              </div>

              {/* Location Selector */}
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Location of Stay
                </label>
                <select
                  value={profile.location}
                  onChange={(e) => setProfile({ ...profile, location: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  required
                >
                  <option value="">Select Location</option>
                  {LOCATIONS.map(location => (
                    <option key={location} value={location}>{location}</option>
                  ))}
                </select>
              </div>

              {/* Email Address Field */}
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Email Address
                </label>
                <input
                  type="email"
                  value={profile.email}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm bg-gray-50"
                  disabled
                />
              </div>

              {/* Terms and Conditions Agreement */}
              <div className="flex items-start">
                <div className="flex items-center h-5">
                  <input
                    type="checkbox"
                    checked={profile.agreed}
                    onChange={(e) => setProfile({ ...profile, agreed: e.target.checked })}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                </div>
                <div className="ml-3 text-sm">
                  <label className="font-medium text-gray-700">
                    I agree to the terms and conditions
                  </label>
                  <p className="text-gray-500">
                    By becoming a seller, you agree to our terms of service and privacy policy.
                  </p>
                </div>
              </div>

              {/* Submit Button for Seller Registration */}
              <button
                type="submit"
                disabled={loading || !profile.agreed}
                className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Processing...' : 'Register as Seller'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

// Export the SellerSignup component as the default export.
export default SellerSignup;
