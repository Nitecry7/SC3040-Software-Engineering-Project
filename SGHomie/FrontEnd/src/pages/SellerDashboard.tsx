// Import React and necessary hooks for state management and side effects.
import React, { useEffect, useState } from 'react';
// useNavigate is used for programmatic navigation between routes.
import { useNavigate } from 'react-router-dom';
// useAuth provides user authentication context (current user info).
import { useAuth } from '../contexts/AuthContext';
// Import the Supabase client for interacting with your database.
import { supabase } from '../lib/supabase';
// Import various icons from lucide-react for visual elements.
import { Plus, Home, Clock, CheckCircle, XCircle, Edit, Trash2, Image as ImageIcon, X } from 'lucide-react';
// Import toast for displaying notifications.
import toast from 'react-hot-toast';

// Define a TypeScript interface representing the structure of a Property record.
interface Property {
  id: string;
  title: string;
  price: number;
  location: string;
  type: string;
  bedrooms: number;
  bathrooms: number;
  area_sqft: number;
  status: string;
  created_at: string;
  image_url: string;
  photos: string[];
  description: string;
  detailed_location: string;
  built_year: number;
  seller_name: string;
  seller_phone: string;
  latitude: number | null;
  longitude: number | null;
}

// Define an array of location names for use in property forms, sorted alphabetically.
const LOCATIONS = [
  'ANG MO KIO', 'BEDOK', 'BISHAN', 'BUKIT BATOK', 'BUKIT MERAH',
  'BUKIT PANJANG', 'BUKIT TIMAH', 'CENTRAL AREA', 'CHOA CHU KANG',
  'CLEMENTI', 'GEYLANG', 'HOUGANG', 'JURONG EAST', 'JURONG WEST',
  'KALLANG/WHAMPOA', 'MARINE PARADE', 'PASIR RIS', 'PUNGGOL',
  'QUEENSTOWN', 'SEMBAWANG', 'SENGKANG', 'SERANGOON', 'TAMPINES',
  'TOA PAYOH', 'WOODLANDS', 'YISHUN'
].sort();

// Main functional component for the Seller Dashboard.
const SellerDashboard = () => {
  // Get the current user from the Auth context.
  const { user } = useAuth();
  // useNavigate hook for redirection/navigation.
  const navigate = useNavigate();
  
  // Local state for storing the list of properties belonging to the seller.
  const [properties, setProperties] = useState<Property[]>([]);
  // State to indicate whether data is still being loaded.
  const [loading, setLoading] = useState(true);
  // State controlling the display of the Add/Edit Property modal.
  const [showModal, setShowModal] = useState(false);
  // State to track if the modal is in editing mode or adding a new property.
  const [isEditing, setIsEditing] = useState(false);
  // State to store the property selected for editing.
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  
  // State to hold the form data for adding or editing a property.
  const [formData, setFormData] = useState({
    title: '',
    price: '',
    location: '',
    type: 'HDB',
    bedrooms: '',
    bathrooms: '',
    area_sqft: '',
    description: '',
    image_url: '',
    photos: [] as string[],
    detailed_location: '',
    built_year: '',
    seller_name: '',
    seller_phone: '',
    latitude: '',
    longitude: '',
  });
  
  // State to manage a new image URL input for additional photos.
  const [newImageUrl, setNewImageUrl] = useState('');
  // State for previewing an image before it's added to the form.
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  // State to hold any error message encountered during operations.
  const [error, setError] = useState<string | null>(null);

  // useEffect hook to fetch the seller's properties when component mounts or user changes.
  useEffect(() => {
    // If there is no authenticated user, navigate back to the homepage.
    if (!user) {
      navigate('/');
      return;
    }

    // Async function to fetch properties from Supabase.
    const fetchUserAndProperties = async () => {
      try {
        // Reset any previous error.
        setError(null);
        
        // Fetch properties where the seller_id matches the current user's id.
        const { data: propertiesData, error: propertiesError } = await supabase
          .from('properties')
          .select('*')
          .eq('seller_id', user.id)
          .order('created_at', { ascending: false });

        // If there's an error during fetch, throw it.
        if (propertiesError) throw propertiesError;
        // Update properties state with fetched data or an empty array.
        setProperties(propertiesData || []);
      } catch (error) {
        // Log error and show error notification via toast.
        console.error('Error fetching data:', error);
        setError(error instanceof Error ? error.message : 'Failed to load data');
        toast.error('Failed to load data');
      } finally {
        // End loading state after data fetching is complete.
        setLoading(false);
      }
    };

    // Execute the async function to fetch properties.
    fetchUserAndProperties();
  }, [user, navigate]);

  // Handler for editing a property.
  // Pre-fills the formData with the selected property's details.
  const handleEditClick = (property: Property) => {
    // Set the selected property state.
    setSelectedProperty(property);
    // Update formData state with property details, converting numbers to strings for form inputs.
    setFormData({
      title: property.title,
      price: property.price.toString(),
      location: property.location,
      type: property.type,
      bedrooms: property.bedrooms.toString(),
      bathrooms: property.bathrooms.toString(),
      area_sqft: property.area_sqft.toString(),
      description: property.description || '',
      image_url: property.image_url,
      photos: property.photos || [],
      detailed_location: property.detailed_location || '',
      built_year: property.built_year.toString(),
      seller_name: property.seller_name || '',
      seller_phone: property.seller_phone || '',
      latitude: property.latitude?.toString() || '',
      longitude: property.longitude?.toString() || '',
    });
    // Enable editing mode and display the modal.
    setIsEditing(true);
    setShowModal(true);
  };

  // Handler for adding a new property.
  // Resets formData to empty values and opens the modal.
  const handleAddClick = () => {
    // Clear selected property (since this is a new property).
    setSelectedProperty(null);
    // Reset all form fields.
    setFormData({
      title: '',
      price: '',
      location: '',
      type: 'HDB',
      bedrooms: '',
      bathrooms: '',
      area_sqft: '',
      description: '',
      image_url: '',
      photos: [],
      detailed_location: '',
      built_year: '',
      seller_name: '',
      seller_phone: '',
      latitude: '',
      longitude: '',
    });
    // Set editing mode to false for new property and open the modal.
    setIsEditing(false);
    setShowModal(true);
  };

  // Handler to delete a property.
  // Asks for confirmation before deletion, then updates the database and local state.
  const handleDelete = async (propertyId: string) => {
    // Confirm if the user really wants to delete this property.
    if (!confirm('Are you sure you want to delete this property?')) return;

    try {
      // Delete the property from the Supabase 'properties' table.
      const { error } = await supabase
        .from('properties')
        .delete()
        .eq('id', propertyId);

      if (error) throw error;
      // Remove the property from the local state.
      setProperties(prev => prev.filter(p => p.id !== propertyId));
      // Display a success notification.
      toast.success('Property deleted successfully');
    } catch (error) {
      // Log and notify the user if deletion fails.
      console.error('Error deleting property:', error);
      toast.error('Failed to delete property');
    }
  };

  // Handler for adding an image URL to the additional photos.
  const handleAddImage = () => {
    if (!newImageUrl.trim()) return; // Do nothing if the URL is empty.
    
    try {
      // Validate the URL format by attempting to construct a new URL object.
      new URL(newImageUrl);
      // Update formData state by appending the new image URL to the photos array.
      setFormData(prev => ({
        ...prev,
        photos: [...prev.photos, newImageUrl.trim()]
      }));
      // Reset newImageUrl and previewImage states.
      setNewImageUrl('');
      setPreviewImage(null);
    } catch (e) {
      // Show an error notification if the URL is invalid.
      toast.error('Please enter a valid URL');
    }
  };

  // Handler to remove an image from the photos array based on its index.
  const handleRemoveImage = (index: number) => {
    setFormData(prev => ({
      ...prev,
      photos: prev.photos.filter((_, i) => i !== index)
    }));
  };

  // Handler to update the image preview.
  // Sets the newImageUrl for input and updates the preview image.
  const handleImagePreview = (url: string) => {
    setNewImageUrl(url);
    setPreviewImage(url);
  };

  // Validates the phone number format. Expected format: "+65 XXXX XXXX"
  const validatePhoneNumber = (phone: string) => {
    const phoneRegex = /^\+65 [0-9]{4} [0-9]{4}$/;
    return phoneRegex.test(phone);
  };

  // Handler for form submission, processing both the add and update scenarios.
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); // Prevent default form submission behavior.
    if (!user) return;

    // Validate the seller's phone number format.
    if (!validatePhoneNumber(formData.seller_phone)) {
      toast.error('Please enter a valid phone number in the format: +65 XXXX XXXX');
      return;
    }

    try {
      // Construct an object with property data from formData, converting string fields to numbers where needed.
      const propertyData = {
        title: formData.title,
        price: parseFloat(formData.price),
        location: formData.location,
        type: formData.type,
        bedrooms: parseInt(formData.bedrooms),
        bathrooms: parseInt(formData.bathrooms),
        area_sqft: parseFloat(formData.area_sqft),
        description: formData.description,
        image_url: formData.image_url,
        photos: formData.photos,
        detailed_location: formData.detailed_location,
        built_year: parseInt(formData.built_year),
        seller_name: formData.seller_name,
        seller_phone: formData.seller_phone,
        seller_id: user.id,
        status: 'pending' // New properties are submitted with a default status of 'pending'.
      };

      // Check if the form is in editing mode.
      if (isEditing && selectedProperty) {
        // Update the existing property record.
        const { error } = await supabase
          .from('properties')
          .update(propertyData)
          .eq('id', selectedProperty.id);

        if (error) throw error;
        // Notify success and update the local state with new property data.
        toast.success('Property updated successfully');
        setProperties(prev => prev.map(p => 
          p.id === selectedProperty.id ? { ...p, ...propertyData } : p
        ));
      } else {
        // Insert a new property record into Supabase.
        const { data, error } = await supabase
          .from('properties')
          .insert([propertyData])
          .select()
          .single();

        if (error) throw error;
        // If data is returned, add the new property to the beginning of the properties array.
        if (data) {
          setProperties(prev => [data, ...prev]);
        }
        toast.success('Property submitted for approval');
      }

      // Close the modal after submission.
      setShowModal(false);
    } catch (error) {
      console.error('Error saving property:', error);
      // Display an error notification based on whether we are editing or adding.
      toast.error(isEditing ? 'Failed to update property' : 'Failed to add property');
    }
  };

  // Function to render a status badge based on a property's status.
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return (
          <span className="flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
            <CheckCircle className="w-4 h-4 mr-1" />
            Approved
          </span>
        );
      case 'rejected':
        return (
          <span className="flex items-center px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-800">
            <XCircle className="w-4 h-4 mr-1" />
            Rejected
          </span>
        );
      default:
        return (
          <span className="flex items-center px-3 py-1 rounded-full text-sm font-medium bg-yellow-100 text-yellow-800">
            <Clock className="w-4 h-4 mr-1" />
            Pending
          </span>
        );
    }
  };

  // If the data is still loading, render a loading message.
  if (loading) {
    return (
      <div className="pt-16 min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  // In case an error occurred, render an error message with a retry button.
  if (error) {
    return (
      <div className="pt-16 min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Error</h2>
          <p className="text-gray-600">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Render the Seller Dashboard interface.
  return (
    <div className="pt-16 min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Dashboard Header: Title and "Add Property" button */}
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Seller Dashboard</h1>
          <button
            onClick={handleAddClick}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-5 h-5 mr-2" />
            Add Property
          </button>
        </div>

        {/* Properties Table */}
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Property
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Location
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Price
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {/* Map through each property and render a table row */}
                {properties.map((property) => (
                  <tr key={property.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        {/* Property Thumbnail */}
                        <div className="h-10 w-10 flex-shrink-0">
                          <img
                            className="h-10 w-10 rounded-lg object-cover"
                            src={property.image_url}
                            alt={property.title}
                          />
                        </div>
                        <div className="ml-4">
                          {/* Property Title */}
                          <div className="text-sm font-medium text-gray-900">
                            {property.title}
                          </div>
                          {/* Property Summary: number of bedrooms, bathrooms, and floor area */}
                          <div className="text-sm text-gray-500">
                            {property.bedrooms} bed • {property.bathrooms} bath • {property.area_sqft} sqft
                          </div>
                        </div>
                      </div>
                    </td>
                    {/* Property Location */}
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {property.location}
                    </td>
                    {/* Property Price */}
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      S${property.price.toLocaleString()}
                    </td>
                    {/* Property Status Badge */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getStatusBadge(property.status)}
                    </td>
                    {/* Action Buttons for Edit and Delete */}
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex space-x-2">
                        <button 
                          onClick={() => handleEditClick(property)}
                          className="text-blue-600 hover:text-blue-900"
                        >
                          <Edit className="h-5 w-5" />
                        </button>
                        <button 
                          onClick={() => handleDelete(property.id)}
                          className="text-red-600 hover:text-red-900"
                        >
                          <Trash2 className="h-5 w-5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {/* If there are no properties, show a message prompting to add one */}
                {properties.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-6 py-4 text-center text-gray-500">
                      No properties found. Click "Add Property" to create your first listing.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Modal for Adding or Editing a Property */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-lg max-w-4xl w-full p-6">
            {/* Modal Header */}
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-gray-900">
                {isEditing ? 'Edit Property' : 'Add New Property'}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="h-6 w-6" />
              </button>
            </div>
            
            {/* Property Form */}
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Basic Information Section */}
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">Basic Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Title Input */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Title</label>
                    <input
                      type="text"
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                      required
                    />
                  </div>
                  {/* Price Input */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Price (SGD)</label>
                    <input
                      type="number"
                      value={formData.price}
                      onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                      required
                    />
                  </div>
                  {/* Location Dropdown */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Location</label>
                    <select
                      value={formData.location}
                      onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                      required
                    >
                      <option value="">Select Location</option>
                      {LOCATIONS.map(location => (
                        <option key={location} value={location}>{location}</option>
                      ))}
                    </select>
                  </div>
                  {/* Detailed Location Input */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Detailed Location</label>
                    <input
                      type="text"
                      value={formData.detailed_location}
                      onChange={(e) => setFormData({ ...formData, detailed_location: e.target.value })}
                      placeholder="e.g., Block 123, Street Name"
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Property Details Section */}
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">Property Details</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Bedrooms Input */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Bedrooms</label>
                    <input
                      type="number"
                      value={formData.bedrooms}
                      onChange={(e) => setFormData({ ...formData, bedrooms: e.target.value })}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                      required
                    />
                  </div>
                  {/* Bathrooms Input */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Bathrooms</label>
                    <input
                      type="number"
                      value={formData.bathrooms}
                      onChange={(e) => setFormData({ ...formData, bathrooms: e.target.value })}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                      required
                    />
                  </div>
                  {/* Floor Area Input */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Area (sqft)</label>
                    <input
                      type="number"
                      value={formData.area_sqft}
                      onChange={(e) => setFormData({ ...formData, area_sqft: e.target.value })}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                      required
                    />
                  </div>
                  {/* Built Year Input */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Built Year</label>
                    <input
                      type="number"
                      value={formData.built_year}
                      onChange={(e) => setFormData({ ...formData, built_year: e.target.value })}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Contact Information Section */}
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">Contact Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Seller Name Input */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Seller Name</label>
                    <input
                      type="text"
                      value={formData.seller_name}
                      onChange={(e) => setFormData({ ...formData, seller_name: e.target.value })}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                      required
                    />
                  </div>
                  {/* Seller Phone Input */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Contact Number</label>
                    <input
                      type="tel"
                      value={formData.seller_phone}
                      onChange={(e) => setFormData({ ...formData, seller_phone: e.target.value })}
                      placeholder="+65 XXXX XXXX"
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                      required
                    />
                    <p className="mt-1 text-sm text-gray-500">Format: +65 XXXX XXXX</p>
                  </div>
                </div>
              </div>

              {/* Property Images Section */}
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">Property Images</h3>
                
                {/* Input for Main Image URL */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700">Main Image URL</label>
                  <input
                    type="url"
                    value={formData.image_url}
                    onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    required
                  />
                </div>

                {/* Section for Additional Images */}
                <div>
                  <label className="block text-sm font-medium text-gray-700">Additional Images</label>
                  <div className="mt-1 flex items-center space-x-2">
                    <input
                      type="url"
                      value={newImageUrl}
                      onChange={(e) => handleImagePreview(e.target.value)}
                      placeholder="Enter image URL"
                      className="flex-1 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    />
                    <button
                      type="button"
                      onClick={handleAddImage}
                      className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                    >
                      Add
                    </button>
                  </div>

                  {/* Preview for the new image being added */}
                  {previewImage && (
                    <div className="mt-2">
                      <img
                        src={previewImage}
                        alt="Preview"
                        className="h-20 w-20 object-cover rounded-lg"
                        onError={() => setPreviewImage(null)}
                      />
                    </div>
                  )}

                  {/* Display thumbnails for all additional photos */}
                  <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4">
                    {formData.photos.map((url, index) => (
                      <div key={index} className="relative group">
                        <img
                          src={url}
                          alt={`Property ${index + 1}`}
                          className="h-24 w-full object-cover rounded-lg"
                        />
                        <button
                          type="button"
                          onClick={() => handleRemoveImage(index)}
                          className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Description Section */}
              <div>
                <label className="block text-sm font-medium text-gray-700">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={4}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  required
                />
              </div>

              {/* Form Action Buttons */}
              <div className="flex justify-end space-x-3">
                {/* Cancel button to close the modal without saving changes */}
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md"
                >
                  Cancel
                </button>
                {/* Submit button to add or update the property */}
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md"
                >
                  {isEditing ? 'Update Property' : 'Add Property'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

// Export the SellerDashboard component as the default export.
export default SellerDashboard;
