// Import React, hooks and necessary libraries.
import React, { useState, useEffect } from 'react';
// Import icons from lucide-react for visual elements.
import { Mail, Phone, MapPin, Send, Building, Clock, CheckCircle, XCircle } from 'lucide-react';
// Import Supabase client to interact with the backend database.
import { supabase } from '../lib/supabase';
// Import custom Auth context to get the currently authenticated user.
import { useAuth } from '../contexts/AuthContext';
// Import toast for showing notifications/messages to the user.
import toast from 'react-hot-toast';

// Define the TypeScript interface for an Enquiry record.
interface EnquiryType {
  id: string;
  name: string;
  email: string;
  phone: string;
  message: string;
  status: string;
  admin_response: string | null;
  created_at: string;
}

// Main functional component for the Enquiry page.
const Enquiry = () => {
  // Retrieve the current user from the authentication context.
  const { user } = useAuth();
  
  // State to hold form data for submitting a new enquiry.
  // If the user is logged in, pre-fill the email field with the user's email.
  const [formData, setFormData] = useState({
    name: '',
    email: user?.email || '',
    phone: '',
    message: ''
  });
  
  // State to manage the loading state during form submission.
  const [loading, setLoading] = useState(false);
  // State to store the list of enquiries for the current user.
  const [enquiries, setEnquiries] = useState<EnquiryType[]>([]);
  // State to track if the enquiries are being fetched from the database.
  const [loadingEnquiries, setLoadingEnquiries] = useState(true);

  // useEffect hook to fetch the current user's enquiries from Supabase when the component mounts
  // and whenever the user changes.
  useEffect(() => {
    const fetchEnquiries = async () => {
      // If there is no user email available, do not proceed with fetching.
      if (!user?.email) return;

      try {
        // Query the "enquiries" table from Supabase, filtering by the user's email.
        // Results are sorted in descending order by created_at date.
        const { data, error } = await supabase
          .from('enquiries')
          .select('*')
          .eq('email', user.email)
          .order('created_at', { ascending: false });

        // Throw any error encountered during the query.
        if (error) throw error;
        // Set enquiries state with the retrieved data or an empty array if none.
        setEnquiries(data || []);
      } catch (error) {
        // Log any errors and show an error notification to the user.
        console.error('Error fetching enquiries:', error);
        toast.error('Failed to load enquiries');
      } finally {
        // Once the fetch process is complete, update the loadingEnquiries state.
        setLoadingEnquiries(false);
      }
    };

    // Invoke fetchEnquiries when component mounts.
    fetchEnquiries();
  }, [user]);

  // Handler function for form submission.
  // This function is called when the user submits the enquiry form.
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); // Prevent default form submission behavior.
    setLoading(true);   // Set the loading state to true while processing.

    try {
      // Prepare the enquiry data object, ensuring the email is taken from the user if available.
      const enquiryData = {
        ...formData,
        email: user?.email || formData.email,
        status: 'PENDING'  // Default status for a new enquiry.
      };

      // Insert the enquiry data into the "enquiries" table in Supabase.
      const { error } = await supabase
        .from('enquiries')
        .insert([enquiryData]);

      // If there is an error inserting the data, throw it.
      if (error) throw error;

      // Show a success notification that the enquiry has been sent.
      toast.success('Enquiry submitted successfully! We will get back to you soon.');
      // Reset the form data fields.
      setFormData({ name: '', email: user?.email || '', phone: '', message: '' });
      
      // Refresh the enquiries list by fetching the data again.
      if (user?.email) {
        const { data } = await supabase
          .from('enquiries')
          .select('*')
          .eq('email', user.email)
          .order('created_at', { ascending: false });
        
        // Update the state with the refreshed enquiries.
        setEnquiries(data || []);
      }
    } catch (error) {
      // Log and show an error notification if the enquiry submission fails.
      console.error('Error submitting enquiry:', error);
      toast.error('Failed to submit enquiry. Please try again.');
    } finally {
      // Always turn off the loading state when submission is complete.
      setLoading(false);
    }
  };

  // JSX rendering for the Enquiry component.
  return (
    <div className="pt-16 min-h-screen bg-gradient-to-b from-gray-50 to-gray-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Page Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">Get in Touch</h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Have questions about a property? Our team of experts is here to help you find your perfect home.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          {/* Contact Form Section */}
          <div className="bg-white rounded-2xl shadow-xl overflow-hidden transform hover:scale-[1.02] transition-transform duration-300">
            {/* Form Header */}
            <div className="bg-blue-600 px-8 py-6">
              <h2 className="text-2xl font-bold text-white">Send us a Message</h2>
              <p className="text-blue-100 mt-2">We'll get back to you within 24 hours</p>
            </div>
            
            {/* Enquiry Form */}
            <form onSubmit={handleSubmit} className="p-8 space-y-6">
              {/* Full Name Input */}
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                  Full Name
                </label>
                <div className="mt-1 relative rounded-md shadow-sm">
                  <input
                    type="text"
                    id="name"
                    name="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="block w-full rounded-lg border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 pl-4 pr-12 py-3"
                    required
                  />
                </div>
              </div>

              {/* Email Input: Pre-filled for logged-in users */}
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                  Email Address
                </label>
                <div className="mt-1 relative rounded-md shadow-sm">
                  <input
                    type="email"
                    id="email"
                    name="email"
                    value={user?.email || formData.email}
                    readOnly={!!user}  // Disable editing if user is logged in.
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className={`block w-full rounded-lg border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 pl-4 pr-12 py-3 ${user ? 'bg-gray-100' : ''}`}
                    required
                  />
                </div>
                {/* Informative note for logged-in users about the email field */}
                {user && (
                  <p className="mt-1 text-sm text-gray-500">
                    Using your account email
                  </p>
                )}
              </div>

              {/* Phone Number Input */}
              <div>
                <label htmlFor="phone" className="block text-sm font-medium text-gray-700">
                  Phone Number
                </label>
                <div className="mt-1 relative rounded-md shadow-sm">
                  <input
                    type="tel"
                    id="phone"
                    name="phone"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    pattern="^\+65 [0-9]{4} [0-9]{4}$"  // Enforces phone number format.
                    placeholder="+65 9123 4567"
                    className="block w-full rounded-lg border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 pl-4 pr-12 py-3"
                    required
                  />
                </div>
              </div>

              {/* Message Textarea */}
              <div>
                <label htmlFor="message" className="block text-sm font-medium text-gray-700">
                  Your Message
                </label>
                <div className="mt-1">
                  <textarea
                    id="message"
                    name="message"
                    rows={4}
                    value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                    className="block w-full rounded-lg border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 pl-4 pr-12 py-3"
                    required
                    placeholder="Tell us about your property interests or any questions you have..."
                  ></textarea>
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}  // Disable button when loading.
                className="w-full bg-blue-600 text-white py-4 px-6 rounded-lg hover:bg-blue-700 flex items-center justify-center space-x-2 transition-colors duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  'Sending...'
                ) : (
                  <>
                    <Send className="h-5 w-5" />
                    <span>Send Message</span>
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Enquiry History Section */}
          <div className="space-y-8">
            {/* Enquiry History Card */}
            <div className="bg-white rounded-2xl shadow-xl p-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">Your Enquiries</h2>
              
              {/* Conditional Rendering: Show a loading message, no enquiries message, or list of enquiries */}
              {loadingEnquiries ? (
                <div className="text-center text-gray-600">Loading enquiries...</div>
              ) : enquiries.length === 0 ? (
                <div className="text-center text-gray-600">No enquiries yet</div>
              ) : (
                <div className="space-y-6">
                  {enquiries.map((enquiry) => (
                    <div
                      key={enquiry.id}
                      className="border border-gray-200 rounded-lg p-6 hover:border-blue-500 transition-colors"
                    >
                      {/* Enquiry Header: displays submission date and status badge */}
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center space-x-2">
                          <Clock className="h-5 w-5 text-gray-400" />
                          <span className="text-sm text-gray-500">
                            {new Date(enquiry.created_at).toLocaleDateString()}
                          </span>
                        </div>
                        <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                          enquiry.status === 'RESPONDED'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-yellow-100 text-yellow-800'
                        }`}>
                          {enquiry.status === 'RESPONDED' ? (
                            <div className="flex items-center space-x-1">
                              <CheckCircle className="h-4 w-4" />
                              <span>RESPONDED</span>
                            </div>
                          ) : (
                            <div className="flex items-center space-x-1">
                              <Clock className="h-4 w-4" />
                              <span>PENDING</span>
                            </div>
                          )}
                        </span>
                      </div>

                      {/* Enquiry Content */}
                      <div className="space-y-4">
                        <div>
                          <h3 className="text-lg font-medium text-gray-900">Your Message:</h3>
                          <p className="mt-1 text-gray-600">{enquiry.message}</p>
                        </div>

                        {/* If admin has responded, display the response */}
                        {enquiry.admin_response && (
                          <div className="bg-blue-50 rounded-lg p-4">
                            <h3 className="text-lg font-medium text-blue-900">Response:</h3>
                            <p className="mt-1 text-blue-700">{enquiry.admin_response}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Contact Information Card */}
            <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-2xl shadow-xl p-8 text-white">
              <h2 className="text-2xl font-bold mb-6">Contact Information</h2>
              <div className="space-y-6">
                <div className="flex items-center space-x-4">
                  <Phone className="h-6 w-6" />
                  <div>
                    <p className="font-medium">Phone</p>
                    <p className="text-blue-100">+65 6789 0123</p>
                  </div>
                </div>
                <div className="flex items-center space-x-4">
                  <Mail className="h-6 w-6" />
                  <div>
                    <p className="font-medium">Email</p>
                    <p className="text-blue-100">contact@sghomie.com</p>
                  </div>
                </div>
                <div className="flex items-center space-x-4">
                  <MapPin className="h-6 w-6" />
                  <div>
                    <p className="font-medium">Address</p>
                    <p className="text-blue-100">123 Robinson Road, Singapore 068912</p>
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

// Export the Enquiry component as the default export.
export default Enquiry;
