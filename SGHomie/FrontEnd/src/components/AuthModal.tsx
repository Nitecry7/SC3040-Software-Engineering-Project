// Import React and hooks needed for managing state and side effects in the component
import React, { useEffect, useState } from 'react';
// Import icon components from the lucide-react library for visual elements in the UI
import { X, Mail, Lock, UserPlus, LogIn, ShieldCheck } from 'lucide-react';
// Import the Supabase client instance configured for your project, used for authentication and database calls
import { supabase } from '../lib/supabase';
// Import the toast notification library for showing pop-up messages (success/error) to the user
import toast from 'react-hot-toast';

// Define the AuthModal component, a pop-up modal used for user sign in and account creation
const AuthModal = () => {
  // isOpen: controls if the modal is visible or hidden
  const [isOpen, setIsOpen] = useState(false);
  // isSignUp: determines if the modal is in "sign up" mode (account creation) or "sign in" mode
  const [isSignUp, setIsSignUp] = useState(false);
  // isAdminMode: toggles between regular user login and admin login modes
  const [isAdminMode, setIsAdminMode] = useState(false);
  // loading: indicates if a request is in progress (displays "Processing..." to the user)
  const [loading, setLoading] = useState(false);
  // formData: stores the input values for email and password entered by the user
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });

  // useEffect hook to attach an event listener to the window that toggles the modal visibility
  // when a "toggle-auth-modal" custom event is fired. The event listener is cleaned up on unmount.
  useEffect(() => {
    const handleToggle = () => setIsOpen(prev => !prev);
    window.addEventListener('toggle-auth-modal', handleToggle);
    return () => window.removeEventListener('toggle-auth-modal', handleToggle);
  }, []);

  // Function to handle form submission for both signing up and signing in regular users
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); // Prevent the default browser behavior for form submission
    setLoading(true);   // Set the loading state to true to indicate processing

    try {
      // Destructure email and password from formData for ease of use
      const { email, password } = formData;
      
      // If the modal is in sign up mode, attempt to create a new account using Supabase's signUp method
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({
          email,
          password,
        });
        
        // If there is an error during sign up, throw the error to be caught
        if (error) throw error;
        // Notify user of successful sign up and prompt them to verify their account via email
        toast.success('Sign up successful! Please check your email to verify your account.');
      } else {
        // Otherwise, if the modal is in sign in mode, attempt to sign in using Supabase's signInWithPassword method
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        
        // If there is an error during sign in, throw the error to be caught
        if (error) throw error;
        // Notify the user that they have successfully signed in
        toast.success('Successfully signed in!');
      }

      // Close the modal after successful authentication
      setIsOpen(false);
      // Reset the form inputs by clearing email and password fields
      setFormData({ email: '', password: '' });
    } catch (error) {
      // If an error occurs, log it to the console and show an error message to the user
      console.error('Authentication error:', error);
      toast.error(error instanceof Error ? error.message : 'Authentication failed');
    } finally {
      // Regardless of success or error, stop the loading indicator
      setLoading(false);
    }
  };

  // Function specifically for handling admin login submissions
  const handleAdminSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); // Prevent default form submission behavior
    setLoading(true);   // Set loading state to true

    try {
      // Destructure email and password from formData
      const { email, password } = formData;
      // Attempt to sign in with the provided credentials
      const { data: { user }, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      // If there is an error during sign in, throw the error
      if (error) throw error;

      // After signing in, verify if the logged-in user has admin privileges
      const { data: profile } = await supabase
        .from('user_profiles') // Query the 'user_profiles' table for admin status
        .select('is_admin')
        .eq('id', user?.id)
        .single();

      // If the profile does not indicate the user is an admin, throw an error
      if (!profile?.is_admin) {
        throw new Error('Access denied. Admin privileges required.');
      }

      // Notify the user of successful admin authentication
      toast.success('Successfully signed in as admin!');
      // Close the modal
      setIsOpen(false);
      // Reset the form inputs
      setFormData({ email: '', password: '' });
    } catch (error) {
      // Log the error and show an error message to the admin user if authentication fails
      console.error('Admin login error:', error);
      toast.error(error instanceof Error ? error.message : 'Admin authentication failed');
    } finally {
      // Stop the loading indicator whether the operation was successful or not
      setLoading(false);
    }
  };

  // If the modal is not open, do not render anything (return null)
  if (!isOpen) return null;

  // Render the AuthModal component
  return (
    // The outer container covers the entire screen and ensures the modal is on top of other content
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center px-4">
        {/* A semi-transparent backdrop that also closes the modal when clicked */}
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity" onClick={() => setIsOpen(false)}></div>
        
        {/* The modal window container */}
        <div className="relative w-full max-w-md transform overflow-hidden rounded-2xl bg-white p-8 shadow-xl transition-all">
          {/* Button to manually close the modal */}
          <button
            onClick={() => setIsOpen(false)}
            className="absolute right-4 top-4 text-gray-400 hover:text-gray-500 focus:outline-none"
          >
            <X className="h-6 w-6" />
          </button>
          
          {/* Modal header section with title and subtitle */}
          <div className="text-center mb-8">
            {/* Display different header text based on whether admin mode or sign up mode is active */}
            <h2 className="text-3xl font-bold text-gray-900">
              {isAdminMode ? 'Admin Login' : (isSignUp ? 'Create Account' : 'Welcome Back')}
            </h2>
            {/* Subheader message to guide the user */}
            <p className="mt-2 text-gray-600">
              {isAdminMode 
                ? 'Sign in with your admin credentials' 
                : (isSignUp ? 'Join our community today' : 'Sign in to your account')}
            </p>
          </div>

          {/* Authentication form which submits either through handleAdminSubmit or handleSubmit based on admin mode */}
          <form onSubmit={isAdminMode ? handleAdminSubmit : handleSubmit} className="space-y-6">
            {/* Email input field */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                Email Address
              </label>
              <div className="mt-1 relative">
                {/* Email icon inside the input field */}
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="email"
                  id="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>
            </div>

            {/* Password input field */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                Password
              </label>
              <div className="mt-1 relative">
                {/* Lock icon inside the input field */}
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="password"
                  id="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>
            </div>

            {/* Submit button for either sign in/sign up or admin sign in */}
            <button
              type="submit"
              disabled={loading} // Disable button during loading
              className="w-full flex items-center justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              {/* Conditional rendering: show "Processing..." during loading, otherwise show icons and text based on mode */}
              {loading ? (
                'Processing...'
              ) : isAdminMode ? (
                <>
                  <ShieldCheck className="h-5 w-5 mr-2" />
                  Sign In as Admin
                </>
              ) : isSignUp ? (
                <>
                  <UserPlus className="h-5 w-5 mr-2" />
                  Sign Up
                </>
              ) : (
                <>
                  <LogIn className="h-5 w-5 mr-2" />
                  Sign In
                </>
              )}
            </button>
          </form>

          {/* Section for toggling between sign up and sign in for regular users (not shown in admin mode) */}
          {!isAdminMode && (
            <div className="mt-6">
              <button
                onClick={() => setIsSignUp(!isSignUp)}
                className="w-full text-center text-sm text-blue-600 hover:text-blue-500"
              >
                {isSignUp ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
              </button>
            </div>
          )}

          {/* Section for switching between admin mode and regular sign in */}
          <div className="mt-6">
            <div className="relative">
              {/* Divider line for visual separation */}
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300"></div>
              </div>
              {/* "Or" text displayed in the center of the divider */}
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-gray-500">Or</span>
              </div>
            </div>

            {/* Button to toggle admin mode */}
            <button
              onClick={() => {
                setIsAdminMode(!isAdminMode);
                // Reset form data when switching modes
                setFormData({ email: '', password: '' });
                // Ensure sign up mode is turned off when toggling admin mode
                setIsSignUp(false);
              }}
              className="mt-6 w-full flex items-center justify-center py-3 px-4 border border-gray-300 rounded-lg shadow-sm text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              {/* Change button text based on the current mode */}
              {isAdminMode ? (
                <>Back to Regular Sign In</>
              ) : (
                <>Sign in as Admin</>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// Export the AuthModal component so it can be imported and used in other parts of the application
export default AuthModal;
