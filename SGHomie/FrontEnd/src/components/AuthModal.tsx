// Import React and hooks needed for managing state and side effects in the component
import React, { useEffect, useState } from 'react';
// Import icon components from the lucide-react library for visual elements in the UI
import { X, Mail, Lock, UserPlus, LogIn } from 'lucide-react';
// Import the Supabase client instance configured for your project, used for authentication and database calls
import { supabase } from '../lib/supabase';
// Import the toast notification library for showing pop-up messages (success/error) to the user
import toast from 'react-hot-toast';

// Define the AuthModal component, a pop-up modal used for user sign in and account creation
const AuthModal = () => {
  // isOpen: controls if the modal is visible or hidden
  const [isOpen, setIsOpen] = useState(false);
  // isRegister: selects account registration rather than sign in
  const [isRegister, setIsRegister] = useState(false);
  // loading: indicates if a request is in progress (displays "Processing..." to the user)
  const [loading, setLoading] = useState(false);
  const [registration, setRegistration] = useState<{ email: string; requiresVerification: boolean } | null>(null);
  // formData: stores the input values for email and password entered by the user
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });

  // useEffect hook to attach an event listener to the window that toggles the modal visibility
  // when a "toggle-auth-modal" custom event is fired. The event listener is cleaned up on unmount.
  useEffect(() => {
    const handleToggle = () => {
      setRegistration(null);
      setIsOpen(prev => !prev);
    };
    window.addEventListener('toggle-auth-modal', handleToggle);
    return () => window.removeEventListener('toggle-auth-modal', handleToggle);
  }, []);

  const closeModal = () => {
    setIsOpen(false);
    setRegistration(null);
    setFormData({ email: '', password: '' });
  };

  // Function to handle registration and sign in
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); // Prevent the default browser behavior for form submission
    setLoading(true);   // Set the loading state to true to indicate processing

    try {
      // Destructure email and password from formData for ease of use
      const { email, password } = formData;
      
      // If the modal is in registration mode, attempt to create a new account using Supabase's signUp method
      if (isRegister) {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
        });
        
        // If there is an error during registration, throw the error to be caught
        if (error) throw error;
        // Keep the confirmation visible until the user dismisses it or returns to sign in.
        setRegistration({ email, requiresVerification: !data.session });
        setFormData({ email: '', password: '' });
        return;
      } else {
        // Sign in all accounts through the same Supabase flow. AuthContext reads the user's role.
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

  // If the modal is not open, do not render anything (return null)
  if (!isOpen) return null;

  // Render the AuthModal component
  return (
    // The outer container covers the entire screen and ensures the modal is on top of other content
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center px-4">
        {/* A semi-transparent backdrop that also closes the modal when clicked */}
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity" onClick={closeModal}></div>
        
        {/* The modal window container */}
        <div role="dialog" aria-modal="true" aria-labelledby="auth-modal-title" className="relative w-full max-w-md transform overflow-hidden rounded-2xl bg-white p-8 shadow-xl transition-all">
          {/* Button to manually close the modal */}
          <button
            type="button"
            aria-label="Close authentication popup"
            onClick={closeModal}
            className="absolute right-4 top-4 text-gray-400 hover:text-gray-500 focus:outline-none"
          >
            <X className="h-6 w-6" />
          </button>
          
          {registration ? (
            <div className="text-center">
              <div role="status" aria-live="polite">
                <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-blue-50 text-blue-600">
                  <Mail className="h-7 w-7" aria-hidden="true" />
                </div>
                <h2 id="auth-modal-title" className="text-2xl font-bold text-gray-900">
                  {registration.requiresVerification ? 'Verification email sent' : 'Registration successful'}
                </h2>
                {registration.requiresVerification ? (
                  <>
                    <p className="mt-4 text-gray-600">
                      We've sent a verification link to <span className="break-words font-medium text-gray-900">{registration.email}</span>.
                    </p>
                    <p className="mt-3 text-sm leading-relaxed text-gray-600">
                      Open the link to verify your account, then return here to sign in. If you don't see the email, check your spam folder.
                    </p>
                  </>
                ) : (
                  <p className="mt-4 text-gray-600">Your account is ready and you're signed in.</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => {
                  if (!registration.requiresVerification) {
                    closeModal();
                    return;
                  }
                  setFormData({ email: registration.email, password: '' });
                  setRegistration(null);
                  setIsRegister(false);
                }}
                className="mt-6 w-full rounded-lg bg-blue-600 px-4 py-3 font-medium text-white hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
              >
                {registration.requiresVerification ? 'Back to Sign In' : 'Done'}
              </button>
            </div>
          ) : (
            <>
              {/* Modal header section with title and subtitle */}
              <div className="text-center mb-8">
                {/* Display the current authentication mode. */}
                <h2 id="auth-modal-title" className="text-3xl font-bold text-gray-900">
                  {isRegister ? 'Register' : 'Welcome Back'}
                </h2>
                {/* Subheader message to guide the user */}
                <p className="mt-2 text-gray-600">
                  {isRegister ? 'Create your SG Homie account' : 'Sign in to your account'}
                </p>
              </div>

              {/* Authentication form for registration and sign in. */}
              <form onSubmit={handleSubmit} className="space-y-6">
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

                {/* Submit button for sign in or registration. */}
                <button
                  type="submit"
                  disabled={loading} // Disable button during loading
                  className="w-full flex items-center justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  {/* Show a loading label while the authentication request is in progress. */}
                  {loading ? (
                    'Processing...'
                  ) : isRegister ? (
                    <>
                      <UserPlus className="h-5 w-5 mr-2" />
                      Register
                    </>
                  ) : (
                    <>
                      <LogIn className="h-5 w-5 mr-2" />
                      Sign In
                    </>
                  )}
                </button>
              </form>

              <div className="mt-6">
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => setIsRegister(!isRegister)}
                  className="w-full text-center text-sm text-blue-600 hover:text-blue-500"
                >
                  {isRegister ? 'Already have an account? Sign in' : "Don't have an account? Register"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

// Export the AuthModal component so it can be imported and used in other parts of the application
export default AuthModal;
