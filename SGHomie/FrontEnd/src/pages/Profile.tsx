// Import React and its hooks for state management and side effects.
import React, { useEffect, useState } from 'react';
// Import useNavigate for programmatic navigation.
import { useNavigate } from 'react-router-dom';
// Import custom authentication context to access the current user and sign out functionality.
import { useAuth } from '../contexts/AuthContext';
// Import the Supabase client to interact with the backend database.
import { supabase } from '../lib/supabase';
// Import icons from lucide-react for visual elements.
import { UserCircle, Save, LogOut, Edit } from 'lucide-react';
// Import toast for showing notifications to the user.
import toast from 'react-hot-toast';

// Define a constant array of locations for property preferences, sorted alphabetically.
const LOCATIONS = [
  'ANG MO KIO', 'BEDOK', 'BISHAN', 'BUKIT BATOK', 'BUKIT MERAH',
  'BUKIT PANJANG', 'BUKIT TIMAH', 'CENTRAL AREA', 'CHOA CHU KANG',
  'CLEMENTI', 'GEYLANG', 'HOUGANG', 'JURONG EAST', 'JURONG WEST',
  'KALLANG/WHAMPOA', 'MARINE PARADE', 'PASIR RIS', 'PUNGGOL',
  'QUEENSTOWN', 'SEMBAWANG', 'SENGKANG', 'SERANGOON', 'TAMPINES',
  'TOA PAYOH', 'WOODLANDS', 'YISHUN'
].sort();

// Define the TypeScript interface for a user profile as stored in the database.
interface UserProfile {
  id: string;
  name: string | null;
  income_range: string | null;
  preferred_locations: string[] | null;
  preferred_property_type: string | null;
  family_members: number | null;
}

// Main Profile component for displaying and editing a user's profile information.
const Profile = () => {
  // Access the current user and the signOut function from the custom authentication context.
  const { user, signOut } = useAuth();
  // Get the navigate function from react-router-dom to redirect users as needed.
  const navigate = useNavigate();

  // Local state to track if data is loading.
  const [loading, setLoading] = useState(true);
  // State to store the fetched user profile data.
  const [profile, setProfile] = useState<UserProfile | null>(null);
  // State to control whether the profile is in editing mode.
  const [isEditing, setIsEditing] = useState(false);
  // State to hold the form data when editing the profile.
  const [formData, setFormData] = useState<UserProfile | null>(null);

  // useEffect hook to fetch the user's profile data on component mount or when the user changes.
  useEffect(() => {
    // If there is no user, redirect to the homepage.
    if (!user) {
      navigate('/');
      return;
    }

    // Asynchronous function to fetch profile data from Supabase.
    const fetchProfile = async () => {
      try {
        // Query the "user_profiles" table for the current user's profile.
        let { data, error } = await supabase
          .from('user_profiles')
          .select(`
            id,
            name,
            income_range,
            preferred_locations,
            preferred_property_type,
            family_members
          `)
          .eq('id', user.id)
          .maybeSingle();

        // If there is an error with the query, throw it.
        if (error) throw error;

        // If no profile data exists, create a new profile with default values.
        if (!data) {
          const newProfile = {
            id: user.id,
            name: null,
            income_range: null,
            preferred_locations: [],
            preferred_property_type: null,
            family_members: null
          };

          // Insert the new profile record into the "user_profiles" table.
          const { data: createdProfile, error: createError } = await supabase
            .from('user_profiles')
            .insert([newProfile])
            .select()
            .single();

          if (createError) throw createError;
          data = createdProfile;
        }

        // Update the local state with the fetched (or newly created) profile data.
        setProfile(data);
        // Also set the form data with the profile details, for editing.
        setFormData(data);
      } catch (error) {
        // Log error and display an error notification if fetching fails.
        console.error('Error fetching profile:', error);
        toast.error('Failed to load profile');
      } finally {
        // Turn off the loading state once the operation completes.
        setLoading(false);
      }
    };

    // Call fetchProfile to initiate data loading.
    fetchProfile();
  }, [user, navigate]);

  // Handler for submitting updated profile information.
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();  // Prevent the default form submission behavior.
    if (!user || !formData) return;  // Do nothing if user or form data is missing.

    try {
      // Upsert the profile data to the "user_profiles" table.
      const { error } = await supabase
        .from('user_profiles')
        .upsert({
          ...formData,
          id: user.id, // Ensure that the profile is associated with the current user.
        });

      if (error) throw error;  // If an error occurs, throw it.

      // Update the local profile state with the submitted data.
      setProfile(formData);
      // Exit editing mode.
      setIsEditing(false);
      // Notify the user that the profile was updated successfully.
      toast.success('Profile updated successfully');
    } catch (error) {
      // Log and notify in case of any errors during profile update.
      console.error('Error updating profile:', error);
      toast.error('Failed to update profile');
    }
  };

  // Handler function for signing out the user.
  const handleSignOut = async () => {
    try {
      // Call the signOut function from the auth context.
      await signOut();
      // Redirect the user to the homepage.
      navigate('/');
      // Notify the user about successful sign out.
      toast.success('Signed out successfully');
    } catch (error) {
      // Log and display an error notification if sign out fails.
      console.error('Error signing out:', error);
      toast.error('Failed to sign out');
    }
  };

  // If there's no user (shouldn't be the case here) return null.
  if (!user) {
    return null;
  }

  // If data is still loading, display a loading message.
  if (loading) {
    return (
      <div className="pt-16 min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-600">Loading profile...</div>
      </div>
    );
  }

  // Main rendered output for the Profile component.
  return (
    <div className="pt-16 min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          {/* Profile Header Section */}
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-8">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                {/* Display the user's avatar if available, otherwise show a default icon */}
                {user.user_metadata.avatar_url ? (
                  <img
                    src={user.user_metadata.avatar_url}
                    alt="Profile"
                    className="h-20 w-20 rounded-full border-4 border-white"
                  />
                ) : (
                  <UserCircle className="h-20 w-20 text-white" />
                )}
                <div className="ml-6">
                  {/* Display the user's name or a welcome message if not set */}
                  <h1 className="text-2xl font-bold text-white">
                    {profile?.name || 'Welcome!'}
                  </h1>
                  {/* Display the user's email and membership date */}
                  <p className="text-blue-100">{user.email}</p>
                  <p className="text-blue-100 text-sm">Member since {new Date(user.created_at).toLocaleDateString()}</p>
                </div>
              </div>
              {/* If not editing, show an edit profile button */}
              {!isEditing && (
                <button
                  onClick={() => setIsEditing(true)}
                  className="bg-white/20 text-white px-4 py-2 rounded-lg hover:bg-white/30 transition-colors flex items-center space-x-2"
                >
                  <Edit className="h-5 w-5" />
                  <span>Edit Profile</span>
                </button>
              )}
            </div>
          </div>

          {/* Profile Information Section */}
          <div className="p-6">
            {isEditing ? (
              // Render the profile edit form when in editing mode.
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Name Input Field */}
                  <div>
                    <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                      Full Name
                    </label>
                    <input
                      type="text"
                      id="name"
                      value={formData?.name || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev!, name: e.target.value }))}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                      required
                    />
                  </div>

                  {/* Email Field (read-only) */}
                  <div>
                    <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                      Email Address
                    </label>
                    <input
                      type="email"
                      id="email"
                      value={user.email}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm bg-gray-50 cursor-not-allowed"
                      disabled
                    />
                  </div>

                  {/* Income Range Selector */}
                  <div>
                    <label htmlFor="income_range" className="block text-sm font-medium text-gray-700">
                      Monthly Income Range
                    </label>
                    <select
                      id="income_range"
                      value={formData?.income_range || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev!, income_range: e.target.value }))}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                      required
                    >
                      <option value="">Select Income Range</option>
                      <option value="0-3000">$0 - $3,000</option>
                      <option value="3001-6000">$3,001 - $6,000</option>
                      <option value="6001-9000">$6,001 - $9,000</option>
                      <option value="9001-12000">$9,001 - $12,000</option>
                      <option value="12001+">$12,001+</option>
                    </select>
                  </div>

                  {/* Number of Family Members Input */}
                  <div>
                    <label htmlFor="family_members" className="block text-sm font-medium text-gray-700">
                      Number of Family Members
                    </label>
                    <input
                      type="number"
                      id="family_members"
                      min="1"
                      max="10"
                      value={formData?.family_members || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev!, family_members: parseInt(e.target.value) }))}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                      required
                    />
                  </div>

                  {/* Preferred Property Type Selector */}
                  <div>
                    <label htmlFor="preferred_property_type" className="block text-sm font-medium text-gray-700">
                      Preferred Property Type
                    </label>
                    <select
                      id="preferred_property_type"
                      value={formData?.preferred_property_type || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev!, preferred_property_type: e.target.value }))}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                      required
                    >
                      <option value="">Select Property Type</option>
                      <option value="2 ROOM">2 ROOM</option>
                      <option value="3 ROOM">3 ROOM</option>
                      <option value="4 ROOM">4 ROOM</option>
                      <option value="EXECUTIVE">EXECUTIVE</option>
                    </select>
                  </div>

                  {/* Preferred Location Selector */}
                  <div>
                    <label htmlFor="preferred_locations" className="block text-sm font-medium text-gray-700">
                      Preferred Location
                    </label>
                    <select
                      id="preferred_locations"
                      value={formData?.preferred_locations?.[0] || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev!, preferred_locations: [e.target.value] }))}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                      required
                    >
                      <option value="">Select Location</option>
                      {LOCATIONS.map((location) => (
                        <option key={location} value={location}>
                          {location}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Form Actions: Save/Cancel buttons and Sign Out button */}
                <div className="flex justify-between pt-6 border-t">
                  <div className="flex space-x-3">
                    {/* Save Changes Button */}
                    <button
                      type="submit"
                      className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 flex items-center space-x-2 transition-colors"
                    >
                      <Save className="h-5 w-5" />
                      <span>Save Changes</span>
                    </button>
                    {/* Cancel Button: Revert changes by restoring original profile data */}
                    <button
                      type="button"
                      onClick={() => {
                        setFormData(profile);
                        setIsEditing(false);
                      }}
                      className="bg-gray-200 text-gray-700 px-6 py-2 rounded-lg hover:bg-gray-300 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>

                  {/* Sign Out Button */}
                  <button
                    type="button"
                    onClick={handleSignOut}
                    className="bg-red-600 text-white px-6 py-2 rounded-lg hover:bg-red-700 flex items-center space-x-2 transition-colors"
                  >
                    <LogOut className="h-5 w-5" />
                    <span>Sign Out</span>
                  </button>
                </div>
              </form>
            ) : (
              // When not editing, display read-only profile information.
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h3 className="text-sm font-medium text-gray-500">Full Name</h3>
                    <p className="mt-1 text-lg text-gray-900">{profile?.name || 'Not set'}</p>
                  </div>

                  <div>
                    <h3 className="text-sm font-medium text-gray-500">Email Address</h3>
                    <p className="mt-1 text-lg text-gray-900">{user.email}</p>
                  </div>

                  <div>
                    <h3 className="text-sm font-medium text-gray-500">Monthly Income Range</h3>
                    <p className="mt-1 text-lg text-gray-900">{profile?.income_range || 'Not set'}</p>
                  </div>

                  <div>
                    <h3 className="text-sm font-medium text-gray-500">Number of Family Members</h3>
                    <p className="mt-1 text-lg text-gray-900">{profile?.family_members || 'Not set'}</p>
                  </div>

                  <div>
                    <h3 className="text-sm font-medium text-gray-500">Preferred Property Type</h3>
                    <p className="mt-1 text-lg text-gray-900">{profile?.preferred_property_type || 'Not set'}</p>
                  </div>

                  <div>
                    <h3 className="text-sm font-medium text-gray-500">Preferred Location</h3>
                    <p className="mt-1 text-lg text-gray-900">{profile?.preferred_locations?.[0] || 'Not set'}</p>
                  </div>
                </div>

                {/* Sign Out button for the read-only view */}
                <div className="pt-6 border-t flex justify-end">
                  <button
                    type="button"
                    onClick={handleSignOut}
                    className="bg-red-600 text-white px-6 py-2 rounded-lg hover:bg-red-700 flex items-center space-x-2 transition-colors"
                  >
                    <LogOut className="h-5 w-5" />
                    <span>Sign Out</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// Export the Profile component as the default export.
export default Profile;
