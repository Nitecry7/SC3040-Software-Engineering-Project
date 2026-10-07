// Import React and necessary hooks for state management and side effects.
import React, { useCallback, useEffect, useState } from 'react';
// useNavigate is used for programmatic navigation between routes.
import { useNavigate, useSearchParams } from 'react-router-dom';
// useAuth provides user authentication context (current user info).
import { useAuth } from '../contexts/AuthContext';
// Import the Supabase client for interacting with your database.
import { functionsSupabase, supabase } from '../lib/supabase';
// Import various icons from lucide-react for visual elements.
import { Plus, Clock, CheckCircle, XCircle, Edit, Trash2, X, Search, Loader2, MapPin, ChevronDown, RefreshCw } from 'lucide-react';
import LocationMapPreview from '../components/LocationMapPreview';
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
  description: string | null;
  detailed_location: string | null;
  built_year: number | null;
  seller_name: string;
  seller_phone: string;
  latitude: number | null;
  longitude: number | null;
  postal_code: string | null;
  block_number: string | null;
  street_name: string | null;
  hdb_verified: boolean;
  location_verified_at: string | null;
  unit_number?: string;
}

interface HdbLocationAddress {
  postalCode: string;
  blockNumber: string;
  streetName: string;
  displayAddress: string;
  town: string;
  builtYear: number | null;
  latitude: number;
  longitude: number;
  verificationToken: string;
  verificationExpiresAt: string;
}

interface HdbLocationLookupResponse {
  valid: boolean;
  address?: HdbLocationAddress;
  code?: string;
  message?: string;
}

interface PhoneCountry {
  name: string;
  flag: string;
  dialCode: string;
  minDigits: number;
  maxDigits: number;
  placeholder: string;
  hint: string;
}

const PHONE_COUNTRIES: PhoneCountry[] = [
  { name: 'Singapore', flag: '🇸🇬', dialCode: '+65', minDigits: 8, maxDigits: 8, placeholder: '9123 4567', hint: '8 digits, starting with 6, 8 or 9' },
  { name: 'Malaysia', flag: '🇲🇾', dialCode: '+60', minDigits: 9, maxDigits: 10, placeholder: '12 345 6789', hint: '9–10 digits' },
  { name: 'Indonesia', flag: '🇮🇩', dialCode: '+62', minDigits: 9, maxDigits: 12, placeholder: '812 3456 7890', hint: '9–12 digits' },
  { name: 'Thailand', flag: '🇹🇭', dialCode: '+66', minDigits: 9, maxDigits: 9, placeholder: '81 234 5678', hint: '9 digits' },
  { name: 'Philippines', flag: '🇵🇭', dialCode: '+63', minDigits: 10, maxDigits: 10, placeholder: '917 123 4567', hint: '10 digits' },
  { name: 'Vietnam', flag: '🇻🇳', dialCode: '+84', minDigits: 9, maxDigits: 10, placeholder: '912 345 678', hint: '9–10 digits' },
  { name: 'China', flag: '🇨🇳', dialCode: '+86', minDigits: 11, maxDigits: 11, placeholder: '138 0013 8000', hint: '11 digits' },
  { name: 'Hong Kong', flag: '🇭🇰', dialCode: '+852', minDigits: 8, maxDigits: 8, placeholder: '9123 4567', hint: '8 digits' },
  { name: 'Taiwan', flag: '🇹🇼', dialCode: '+886', minDigits: 9, maxDigits: 10, placeholder: '912 345 678', hint: '9–10 digits' },
  { name: 'Japan', flag: '🇯🇵', dialCode: '+81', minDigits: 10, maxDigits: 10, placeholder: '90 1234 5678', hint: '10 digits' },
  { name: 'South Korea', flag: '🇰🇷', dialCode: '+82', minDigits: 9, maxDigits: 10, placeholder: '10 1234 5678', hint: '9–10 digits' },
  { name: 'India', flag: '🇮🇳', dialCode: '+91', minDigits: 10, maxDigits: 10, placeholder: '98765 43210', hint: '10 digits' },
  { name: 'Australia', flag: '🇦🇺', dialCode: '+61', minDigits: 9, maxDigits: 9, placeholder: '412 345 678', hint: '9 digits' },
  { name: 'New Zealand', flag: '🇳🇿', dialCode: '+64', minDigits: 8, maxDigits: 10, placeholder: '21 123 4567', hint: '8–10 digits' },
  { name: 'United Kingdom', flag: '🇬🇧', dialCode: '+44', minDigits: 10, maxDigits: 10, placeholder: '7911 123456', hint: '10 digits' },
  { name: 'United States', flag: '🇺🇸', dialCode: '+1', minDigits: 10, maxDigits: 10, placeholder: '202 555 0123', hint: '10 digits' },
  { name: 'Canada', flag: '🇨🇦', dialCode: '+1', minDigits: 10, maxDigits: 10, placeholder: '416 555 0123', hint: '10 digits' },
  { name: 'United Arab Emirates', flag: '🇦🇪', dialCode: '+971', minDigits: 9, maxDigits: 9, placeholder: '50 123 4567', hint: '9 digits' },
  { name: 'France', flag: '🇫🇷', dialCode: '+33', minDigits: 9, maxDigits: 9, placeholder: '6 12 34 56 78', hint: '9 digits' },
  { name: 'Germany', flag: '🇩🇪', dialCode: '+49', minDigits: 10, maxDigits: 11, placeholder: '151 23456789', hint: '10–11 digits' },
  { name: 'Netherlands', flag: '🇳🇱', dialCode: '+31', minDigits: 9, maxDigits: 9, placeholder: '6 12345678', hint: '9 digits' },
  { name: 'Spain', flag: '🇪🇸', dialCode: '+34', minDigits: 9, maxDigits: 9, placeholder: '612 345 678', hint: '9 digits' },
  { name: 'Italy', flag: '🇮🇹', dialCode: '+39', minDigits: 9, maxDigits: 10, placeholder: '312 345 6789', hint: '9–10 digits' },
];

// Define an array of location names for use in property forms, sorted alphabetically.
const LOCATIONS = [
  'ANG MO KIO', 'BEDOK', 'BISHAN', 'BUKIT BATOK', 'BUKIT MERAH',
  'BUKIT PANJANG', 'BUKIT TIMAH', 'CENTRAL AREA', 'CHOA CHU KANG',
  'CLEMENTI', 'GEYLANG', 'HOUGANG', 'JURONG EAST', 'JURONG WEST',
  'KALLANG/WHAMPOA', 'MARINE PARADE', 'PASIR RIS', 'PUNGGOL',
  'QUEENSTOWN', 'SEMBAWANG', 'SENGKANG', 'SERANGOON', 'TAMPINES',
  'TOA PAYOH', 'WOODLANDS', 'YISHUN'
].sort();

const PROPERTY_IMAGE_BUCKET = 'property-images';
const MAX_PROPERTY_IMAGE_SIZE = 10 * 1024 * 1024;

// Main functional component for the Seller Dashboard.
const SellerDashboard = () => {
  // Get the current user from the Auth context.
  const { user, isAdmin } = useAuth();
  // useNavigate hook for redirection/navigation.
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  
  // Local state for storing the list of properties belonging to the seller.
  const [properties, setProperties] = useState<Property[]>([]);
  // State to indicate whether data is still being loaded.
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
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
    postal_code: '',
    block_number: '',
    street_name: '',
    unit_number: '',
    unit_verified: false,
    unit_number_touched: false,
    detailed_location: '',
    built_year: '',
    seller_name: '',
    seller_country_name: 'Singapore',
    seller_country_code: '+65',
    seller_phone: '',
    latitude: '',
    longitude: '',
    hdb_verified: false,
    location_verified_at: '',
    hdb_verification_token: '',
    hdb_verification_expires_at: '',
  });
  
  // Image files are uploaded to Supabase Storage when the property is saved.
  const [mainImageFile, setMainImageFile] = useState<File | null>(null);
  const [mainImagePreview, setMainImagePreview] = useState<string | null>(null);
  const [additionalImageFiles, setAdditionalImageFiles] = useState<File[]>([]);
  const [additionalImagePreviews, setAdditionalImagePreviews] = useState<string[]>([]);
  // State to hold any error message encountered during operations.
  const [error, setError] = useState<string | null>(null);
  // State for the server-side postal-code lookup.
  const [lookupLoading, setLookupLoading] = useState(false);
  const [countryPickerOpen, setCountryPickerOpen] = useState(false);
  const [countrySearch, setCountrySearch] = useState('');

  const parseStoredPhone = useCallback((phone: string) => {
    const compactPhone = phone.replace(/[\s().-]/g, '');
    const knownCountry = [...PHONE_COUNTRIES]
      .sort((left, right) => right.dialCode.length - left.dialCode.length)
      .find(country => compactPhone.startsWith(country.dialCode));

    if (knownCountry) {
      return {
        countryName: knownCountry.name,
        countryCode: knownCountry.dialCode,
        number: compactPhone.slice(knownCountry.dialCode.length),
      };
    }

    const match = phone.trim().match(/^(\+\d{1,3})[\s().-]*(.*)$/);
    const countryCode = match?.[1] || '+65';
    return {
      countryName: PHONE_COUNTRIES.find(country => country.dialCode === countryCode)?.name || 'Singapore',
      countryCode,
      number: match?.[2] || '',
    };
  }, []);

  const refreshDashboard = useCallback(async () => {
    if (!user) return;

    setIsRefreshing(true);
    try {
      setError(null);

      const { data: propertiesData, error: propertiesError } = await supabase
        .from('properties')
        .select('*')
        .eq('seller_id', user.id)
        .order('created_at', { ascending: false });

      if (propertiesError) throw propertiesError;

      const propertyIds = (propertiesData || []).map(property => property.id);
      const { data: privateDetails, error: privateDetailsError } = propertyIds.length
        ? await supabase
          .from('property_private_details')
          .select('property_id, unit_number')
          .in('property_id', propertyIds)
        : { data: [], error: null };

      if (privateDetailsError) throw privateDetailsError;

      const unitByPropertyId = new Map(
        (privateDetails || []).map(detail => [detail.property_id, detail.unit_number])
      );

      setProperties((propertiesData || []).map(property => ({
        ...property,
        unit_number: unitByPropertyId.get(property.id) || '',
      })));
    } catch (error) {
      console.error('Error fetching data:', error);
      setError(error instanceof Error ? error.message : 'Failed to load data');
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [user]);

  // Load the seller's listings on entry and whenever the authenticated user changes.
  useEffect(() => {
    if (!user) {
      navigate('/');
      return;
    }

    if (isAdmin) {
      navigate('/admin', { replace: true });
      return;
    }

    void refreshDashboard();
  }, [user, isAdmin, navigate, refreshDashboard]);

  // The chatbot dispatches this event after it creates a draft listing.
  useEffect(() => {
    const handleChatbotRefresh = () => {
      void refreshDashboard();
    };

    window.addEventListener('seller-dashboard-refresh', handleChatbotRefresh);
    return () => window.removeEventListener('seller-dashboard-refresh', handleChatbotRefresh);
  }, [refreshDashboard]);

  // Handler for editing a property.
  // Pre-fills the formData with the selected property's details.
  const handleEditClick = useCallback((property: Property) => {
    // Set the selected property state.
    setSelectedProperty(property);
    // Update formData state with property details, converting numbers to strings for form inputs.
    setFormData({
      title: property.title,
      price: property.price > 0 ? property.price.toString() : '',
      location: property.location,
      type: property.type,
      bedrooms: property.bedrooms > 0 ? property.bedrooms.toString() : '',
      bathrooms: property.bathrooms > 0 ? property.bathrooms.toString() : '',
      area_sqft: property.area_sqft > 0 ? property.area_sqft.toString() : '',
      description: property.description || '',
      image_url: property.image_url,
      photos: property.photos || [],
      detailed_location: property.detailed_location || '',
      built_year: property.built_year?.toString() || '',
      seller_name: property.seller_name || '',
      seller_country_name: parseStoredPhone(property.seller_phone || '').countryName,
      seller_country_code: parseStoredPhone(property.seller_phone || '').countryCode,
      seller_phone: parseStoredPhone(property.seller_phone || '').number,
      latitude: property.latitude?.toString() || '',
      longitude: property.longitude?.toString() || '',
      postal_code: property.postal_code || '',
      block_number: property.block_number || '',
      street_name: property.street_name || '',
      unit_number: property.unit_number || '',
      unit_verified: false,
      unit_number_touched: false,
      hdb_verified: property.hdb_verified,
      location_verified_at: property.location_verified_at || '',
      hdb_verification_token: '',
      hdb_verification_expires_at: '',
    });
    setMainImageFile(null);
    setMainImagePreview(property.image_url || null);
    setAdditionalImageFiles([]);
    setAdditionalImagePreviews([]);
    // Enable editing mode and display the modal.
    setIsEditing(true);
    setShowModal(true);
  }, [parseStoredPhone]);

  useEffect(() => {
    const draftId = searchParams.get('draft');
    if (!draftId || loading || isRefreshing || error) return;
    // Only open records already loaded by the current seller's RLS-protected query.
    const draft = properties.find(property => property.id === draftId && property.status === 'draft');
    if (draft) handleEditClick(draft);
    else toast.error('This draft could not be found in your Seller Dashboard');
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('draft');
    setSearchParams(nextParams, { replace: true });
  }, [searchParams, setSearchParams, properties, loading, isRefreshing, error, handleEditClick]);

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
      seller_country_name: 'Singapore',
      seller_country_code: '+65',
      seller_phone: '',
      latitude: '',
      longitude: '',
      postal_code: '',
      block_number: '',
      street_name: '',
      unit_number: '',
      unit_verified: false,
      unit_number_touched: false,
      hdb_verified: false,
      location_verified_at: '',
      hdb_verification_token: '',
      hdb_verification_expires_at: '',
    });
    setMainImageFile(null);
    setMainImagePreview(null);
    setAdditionalImageFiles([]);
    setAdditionalImagePreviews([]);
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

  // Handler to remove an image from the photos array based on its index.
  const handleRemoveImage = (index: number) => {
    setFormData(prev => ({
      ...prev,
      photos: prev.photos.filter((_, i) => i !== index)
    }));
  };

  const validateImageFile = (file: File) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      toast.error('Please upload a JPG, PNG or WebP image');
      return false;
    }

    if (file.size > MAX_PROPERTY_IMAGE_SIZE) {
      toast.error('Each image must be 10 MB or smaller');
      return false;
    }

    return true;
  };

  const handleMainImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!validateImageFile(file)) {
      event.target.value = '';
      return;
    }

    setMainImageFile(file);
    setMainImagePreview(URL.createObjectURL(file));
  };

  const handleAdditionalImagesChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    const validFiles = files.filter(validateImageFile);

    if (validFiles.length > 0) {
      setAdditionalImageFiles(prev => [...prev, ...validFiles]);
      setAdditionalImagePreviews(prev => [
        ...prev,
        ...validFiles.map(file => URL.createObjectURL(file)),
      ]);
    }

    event.target.value = '';
  };

  const handleRemoveAdditionalImage = (index: number) => {
    setAdditionalImageFiles(prev => prev.filter((_, fileIndex) => fileIndex !== index));
    setAdditionalImagePreviews(prev => prev.filter((_, previewIndex) => previewIndex !== index));
  };

  const uploadPropertyImages = async (propertyId: string, sellerId: string) => {
    const uploadedPaths: string[] = [];
    const mainImageUrl = mainImageFile ? null : formData.image_url;
    const additionalImageUrls: string[] = [];

    const extensionFor = (file: File) => {
      switch (file.type) {
        case 'image/png':
          return 'png';
        case 'image/webp':
          return 'webp';
        default:
          return 'jpg';
      }
    };

    const uploadFile = async (file: File) => {
      const path = `${sellerId}/${propertyId}/${crypto.randomUUID()}.${extensionFor(file)}`;
      const { error: uploadError } = await supabase.storage
        .from(PROPERTY_IMAGE_BUCKET)
        .upload(path, file, {
          cacheControl: '3600',
          contentType: file.type,
          upsert: false,
        });

      if (uploadError) throw uploadError;

      uploadedPaths.push(path);
      return supabase.storage.from(PROPERTY_IMAGE_BUCKET).getPublicUrl(path).data.publicUrl;
    };

    try {
      const uploadedMainImageUrl = mainImageFile ? await uploadFile(mainImageFile) : mainImageUrl;
      for (const file of additionalImageFiles) {
        additionalImageUrls.push(await uploadFile(file));
      }

      return {
        mainImageUrl: uploadedMainImageUrl || '',
        additionalImageUrls,
        uploadedPaths,
      };
    } catch (uploadError) {
      if (uploadedPaths.length > 0) {
        await supabase.storage.from(PROPERTY_IMAGE_BUCKET).remove(uploadedPaths);
      }
      throw uploadError;
    }
  };

  const selectedPhoneCountry = PHONE_COUNTRIES.find(country =>
    country.name === formData.seller_country_name
    && country.dialCode === formData.seller_country_code
  ) || PHONE_COUNTRIES[0];

  const filteredPhoneCountries = PHONE_COUNTRIES.filter(country => {
    const query = countrySearch.trim().toLowerCase();
    return !query
      || country.name.toLowerCase().includes(query)
      || country.dialCode.includes(query);
  });

  // Accept spaces, hyphens and brackets in the local number, then validate the
  // resulting digits against the selected country code.
  const validatePhoneNumber = (country: PhoneCountry, phone: string) => {
    const phoneText = phone.trim();
    const phoneDigits = phoneText.replace(/\D/g, '');

    if (!/^[0-9\s().-]+$/.test(phoneText) || phoneDigits.length === 0) {
      return false;
    }

    if (country.dialCode === '+65') {
      return /^[689]\d{7}$/.test(phoneDigits);
    }

    return phoneDigits.length >= country.minDigits
      && phoneDigits.length <= country.maxDigits;
  };

  const validateUnitNumber = (unitNumber: string) => {
    return /^#?\d{1,3}-\d{1,4}$/.test(unitNumber.trim());
  };

  const unitNumberInvalid = formData.unit_number_touched
    && !validateUnitNumber(formData.unit_number);

  const handleUnitNumberBlur = () => {
    const isValid = validateUnitNumber(formData.unit_number);
    setFormData(prev => ({
      ...prev,
      unit_number: prev.unit_number.trim(),
      unit_verified: isValid,
      unit_number_touched: true,
    }));
  };

  const handleCountrySelect = (country: PhoneCountry) => {
    setFormData(prev => ({
      ...prev,
      seller_country_name: country.name,
      seller_country_code: country.dialCode,
      seller_phone: '',
    }));
    setCountrySearch('');
    setCountryPickerOpen(false);
  };

  const handlePostalCodeChange = (postalCode: string) => {
    const normalisedPostalCode = postalCode.replace(/\D/g, '').slice(0, 6);

    setFormData(prev => ({
      ...prev,
      postal_code: normalisedPostalCode,
      block_number: '',
      street_name: '',
      detailed_location: '',
      location: '',
      built_year: '',
      latitude: '',
      longitude: '',
      unit_number: '',
      unit_verified: false,
      unit_number_touched: false,
      hdb_verified: false,
      location_verified_at: '',
      hdb_verification_token: '',
      hdb_verification_expires_at: '',
    }));
  };

  const lookupHdbAddress = async (postalCode: string): Promise<HdbLocationAddress> => {
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) {
      throw new Error('Please sign in again before looking up an address');
    }

    functionsSupabase.functions.setAuth(sessionData.session.access_token);
    const { data, error: lookupError } = await functionsSupabase.functions.invoke<HdbLocationLookupResponse>(
      'lookup-hdb-location',
      { body: { postalCode } }
    );

    if (lookupError) {
      const response = (lookupError as { context?: Response }).context;
      let message = lookupError.message;
      if (response) {
        try {
          const responseBody = await response.clone().json() as { message?: string; error?: string };
          message = responseBody.message || responseBody.error || message;
        } catch {
          // Keep the function client's message if the response is not JSON.
        }
      }
      throw new Error(message);
    }

    if (!data?.valid || !data.address) {
      throw new Error(data?.message || 'This postal code does not match a residential HDB block');
    }

    return data.address;
  };

  const handleHdbLookup = async () => {
    if (!/^\d{6}$/.test(formData.postal_code)) {
      toast.error('Enter a valid 6-digit Singapore postal code');
      return;
    }

    setLookupLoading(true);
    try {
      const address = await lookupHdbAddress(formData.postal_code);
      setFormData(prev => ({
        ...prev,
        postal_code: address.postalCode,
        block_number: address.blockNumber,
        street_name: address.streetName,
        detailed_location: `Block ${address.blockNumber} ${address.streetName}`,
        location: address.town || prev.location,
        built_year: address.builtYear?.toString() || prev.built_year,
        latitude: address.latitude.toString(),
        longitude: address.longitude.toString(),
        hdb_verified: true,
        location_verified_at: new Date().toISOString(),
        hdb_verification_token: address.verificationToken,
        hdb_verification_expires_at: address.verificationExpiresAt,
      }));
      toast.success('HDB address verified and map updated');
    } catch (lookupError) {
      console.error('Error looking up HDB address:', lookupError);
      toast.error('Unable to verify this postal code right now. Please try again.');
    } finally {
      setLookupLoading(false);
    }
  };

  // Handler for form submission, processing both the add and update scenarios.
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); // Prevent default form submission behavior.
    if (!user) return;

    if (!formData.image_url && !mainImageFile) {
      toast.error('Please upload a main property image');
      return;
    }

    // Validate the seller's phone number format.
    if (!validatePhoneNumber(selectedPhoneCountry, formData.seller_phone)) {
      toast.error('Please enter a valid phone number for the selected country code');
      return;
    }

    if (!formData.hdb_verified || !/^\d{6}$/.test(formData.postal_code)) {
      toast.error('Please verify a valid HDB postal code before submitting');
      return;
    }

    if (!validateUnitNumber(formData.unit_number)) {
      setFormData(prev => ({
        ...prev,
        unit_verified: false,
        unit_number_touched: true,
      }));
      toast.error('Please enter a unit number such as #08-123');
      return;
    }

    if (!formData.unit_verified) {
      setFormData(prev => ({ ...prev, unit_verified: true }));
    }

    let uploadedPaths: string[] = [];
    let propertyReferencesUploadedImages = false;

    try {
      const propertyId = isEditing && selectedProperty
        ? selectedProperty.id
        : crypto.randomUUID();
      const uploadedImages = await uploadPropertyImages(propertyId, user.id);
      uploadedPaths = uploadedImages.uploadedPaths;

      let hdbVerificationToken = formData.hdb_verification_token || null;
      const verificationExpiresAt = Date.parse(formData.hdb_verification_expires_at);
      if (
        hdbVerificationToken
        && (!Number.isFinite(verificationExpiresAt) || verificationExpiresAt <= Date.now() + 60_000)
      ) {
        // Refresh near-expiry tokens after uploads so the database write has a
        // full verification window even when preparing the listing took a while.
        const address = await lookupHdbAddress(formData.postal_code);
        hdbVerificationToken = address.verificationToken;
        setFormData(prev => ({
          ...prev,
          hdb_verification_token: address.verificationToken,
          hdb_verification_expires_at: address.verificationExpiresAt,
        }));
      }

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
        image_url: uploadedImages.mainImageUrl,
        photos: [...formData.photos, ...uploadedImages.additionalImageUrls],
        detailed_location: formData.detailed_location,
        town: formData.location,
        built_year: formData.built_year ? parseInt(formData.built_year) : null,
        seller_name: formData.seller_name,
        seller_phone: `+${formData.seller_country_code.replace(/\D/g, '')} ${formData.seller_phone.replace(/\D/g, '')}`,
        postal_code: formData.postal_code,
        block_number: formData.block_number,
        street_name: formData.street_name,
        hdb_verified: formData.hdb_verified,
        location_verified_at: formData.location_verified_at || new Date().toISOString(),
        latitude: parseFloat(formData.latitude),
        longitude: parseFloat(formData.longitude),
        seller_id: user.id,
        hdb_verification_token: hdbVerificationToken,
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
        propertyReferencesUploadedImages = true;

        const { error: privateDetailsError } = await supabase
          .from('property_private_details')
          .upsert({
            property_id: selectedProperty.id,
            unit_number: formData.unit_number.trim(),
          });

        if (privateDetailsError) throw privateDetailsError;

        // Notify success and update the local state with new property data.
        toast.success('Property updated successfully');
        setProperties(prev => prev.map(p => 
          p.id === selectedProperty.id ? { ...p, ...propertyData, unit_number: formData.unit_number.trim() } : p
        ));
      } else {
        // Insert a new property record into Supabase.
        const { data, error } = await supabase
          .from('properties')
          .insert([{ id: propertyId, ...propertyData }])
          .select()
          .single();

        if (error) throw error;
        propertyReferencesUploadedImages = true;

        const { error: privateDetailsError } = await supabase
          .from('property_private_details')
          .insert({
            property_id: data.id,
            unit_number: formData.unit_number.trim(),
          });

        if (privateDetailsError) {
          const { error: rollbackError } = await supabase
            .from('properties')
            .delete()
            .eq('id', data.id);
          if (!rollbackError) {
            propertyReferencesUploadedImages = false;
          } else {
            console.error('Unable to roll back property after private-details failure:', rollbackError);
          }
          throw privateDetailsError;
        }

        // If data is returned, add the new property to the beginning of the properties array.
        if (data) {
          setProperties(prev => [{ ...data, unit_number: formData.unit_number.trim() }, ...prev]);
        }
        toast.success('Property submitted for approval');
      }

      // The uploaded objects are now linked by the saved property record.
      uploadedPaths = [];

      // Close the modal after submission.
      setShowModal(false);
    } catch (error) {
      // Keep uploads that are already referenced by a committed property row.
      // Removing them here would leave that row pointing at broken URLs when
      // the separate private-details request fails.
      if (uploadedPaths.length > 0 && !propertyReferencesUploadedImages) {
        await supabase.storage.from(PROPERTY_IMAGE_BUCKET).remove(uploadedPaths);
      }
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
      case 'draft':
        return (
          <span className="flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
            <Edit className="w-4 h-4 mr-1" />
            Draft
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
        {/* Dashboard Header: Reload and "Add Property" buttons */}
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Seller Dashboard</h1>
          <div className="flex items-center gap-3">
            <button
              onClick={() => void refreshDashboard()}
              disabled={isRefreshing}
              className="flex items-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RefreshCw className={`mr-2 h-5 w-5 ${isRefreshing ? 'animate-spin' : ''}`} />
              Reload
            </button>
            <button
              onClick={handleAddClick}
              className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-5 h-5 mr-2" />
              Add Property
            </button>
          </div>
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
                          {property.image_url ? (
                            <img
                              className="h-10 w-10 rounded-lg object-cover"
                              src={property.image_url}
                              alt={property.title}
                            />
                          ) : (
                            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-xs font-medium text-blue-600">
                              Draft
                            </div>
                          )}
                        </div>
                        <div className="ml-4">
                          {/* Property Title */}
                          <div className="text-sm font-medium text-gray-900">
                            {property.title}
                          </div>
                          {/* Property Summary: number of bedrooms, bathrooms, and floor area */}
                          <div className="text-sm text-gray-500">
                            {property.bedrooms > 0 ? property.bedrooms : '—'} bed • {property.bathrooms > 0 ? property.bathrooms : '—'} bath • {property.area_sqft > 0 ? property.area_sqft : '—'} sqft
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
                      {property.price > 0 ? `S$${property.price.toLocaleString('en-SG')}` : 'Price not set'}
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
        <div className="fixed inset-x-0 top-20 bottom-0 z-[60] flex items-start justify-center overflow-hidden bg-black/50 p-4">
          <div className="flex max-h-[calc(100vh-6rem)] w-full max-w-4xl flex-col overflow-hidden rounded-lg bg-white">
            {/* Modal Header */}
            <div className="flex shrink-0 items-center justify-between border-b border-gray-200 p-6">
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
            <form onSubmit={handleSubmit} className="space-y-6 overflow-y-auto overscroll-contain p-6">
              {/* Basic Information Section */}
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">Basic Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Title Input */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Title <span className="text-red-600" aria-hidden="true">*</span>
                    </label>
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
                    <label className="block text-sm font-medium text-gray-700">
                      Price (SGD) <span className="text-red-600" aria-hidden="true">*</span>
                    </label>
                    <input
                      type="number"
                      value={formData.price}
                      onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                      required
                    />
                  </div>
                </div>

                <div className="mt-6 rounded-lg border border-blue-100 bg-blue-50 p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <h4 className="font-medium text-gray-900">Verify HDB address</h4>
                      <p className="text-sm text-gray-600">Enter the postal code first and we will fill in the block details.</p>
                    </div>
                    {formData.hdb_verified && (
                      <span className="flex items-center gap-1 text-sm font-medium text-green-700">
                        <CheckCircle className="h-4 w-4" /> Verified
                      </span>
                    )}
                  </div>

                  <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-[1fr_auto_1fr] md:items-end">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        Postal Code <span className="text-red-600" aria-hidden="true">*</span>
                      </label>
                      <input
                        type="text"
                        inputMode="numeric"
                        maxLength={6}
                        value={formData.postal_code}
                        onChange={(e) => handlePostalCodeChange(e.target.value)}
                        placeholder="e.g. 560123"
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                        required
                      />
                    </div>
                    <button
                      type="button"
                      onClick={handleHdbLookup}
                      disabled={lookupLoading || formData.postal_code.length !== 6}
                      className="inline-flex items-center justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {lookupLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
                      {lookupLoading ? 'Checking...' : 'Find Address'}
                    </button>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        Unit Number <span className="text-red-600" aria-hidden="true">*</span>
                      </label>
                      <input
                        type="text"
                        value={formData.unit_number}
                        onChange={(e) => setFormData({
                          ...formData,
                          unit_number: e.target.value,
                          unit_verified: false,
                        })}
                        onBlur={handleUnitNumberBlur}
                        placeholder="e.g. #08-123"
                        disabled={!formData.hdb_verified}
                        className={`mt-1 block w-full rounded-md shadow-sm focus:ring-blue-500 ${
                          unitNumberInvalid
                            ? 'border-red-500 focus:border-red-500'
                            : 'border-gray-300 focus:border-blue-500'
                        } disabled:cursor-not-allowed disabled:bg-gray-100`}
                        required
                      />
                      {unitNumberInvalid && (
                        <p className="mt-1 text-sm text-red-600">Unit number is not valid.</p>
                      )}
                    </div>
                  </div>

                  {formData.hdb_verified && (
                    <div className="mt-4 rounded-md bg-white p-3 text-sm text-gray-700">
                      <div className="flex items-start gap-2">
                        <MapPin className="mt-0.5 h-4 w-4 flex-shrink-0 text-blue-600" />
                        <div>
                          <p className="font-medium">{formData.detailed_location}</p>
                          <p className="text-gray-500">Postal code {formData.postal_code}. Unit number is kept private.</p>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        Location <span className="text-red-600" aria-hidden="true">*</span>
                      </label>
                      <select
                        value={formData.location}
                        className="mt-1 block w-full rounded-md border-gray-300 bg-gray-100 shadow-sm disabled:cursor-not-allowed disabled:bg-gray-100"
                        disabled
                        required
                      >
                        <option value="">Select Location</option>
                        {LOCATIONS.map(location => (
                          <option key={location} value={location}>{location}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        Detailed Location <span className="text-red-600" aria-hidden="true">*</span>
                      </label>
                      <input
                        type="text"
                        value={formData.detailed_location}
                        placeholder="Verified address will appear here"
                        className="mt-1 block w-full cursor-not-allowed rounded-md border-gray-300 bg-gray-100 shadow-sm"
                        disabled
                        required
                      />
                    </div>
                  </div>

                  {formData.hdb_verified && (
                    <div className="mt-4">
                      <LocationMapPreview
                        latitude={formData.latitude ? Number(formData.latitude) : null}
                        longitude={formData.longitude ? Number(formData.longitude) : null}
                        address={formData.detailed_location}
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Property Details Section */}
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">Property Details</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Bedrooms Input */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Bedrooms <span className="text-red-600" aria-hidden="true">*</span>
                    </label>
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
                    <label className="block text-sm font-medium text-gray-700">
                      Bathrooms <span className="text-red-600" aria-hidden="true">*</span>
                    </label>
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
                    <label className="block text-sm font-medium text-gray-700">
                      Area (sqft) <span className="text-red-600" aria-hidden="true">*</span>
                    </label>
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
                      className="mt-1 block w-full cursor-not-allowed rounded-md border-gray-300 bg-gray-100 shadow-sm"
                      disabled
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
                    <label className="block text-sm font-medium text-gray-700">
                      Seller Name <span className="text-red-600" aria-hidden="true">*</span>
                    </label>
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
                    <label className="block text-sm font-medium text-gray-700">
                      Contact Number <span className="text-red-600" aria-hidden="true">*</span>
                    </label>
                    <div className="mt-1 flex gap-2">
                      <div className="relative w-44">
                        <button
                          type="button"
                          onClick={() => setCountryPickerOpen(prev => !prev)}
                          className="flex w-full items-center justify-between rounded-md border border-gray-300 bg-white px-3 py-2 text-left shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                          aria-haspopup="listbox"
                          aria-expanded={countryPickerOpen}
                        >
                          <span className="truncate">{selectedPhoneCountry.flag} {selectedPhoneCountry.name} ({selectedPhoneCountry.dialCode})</span>
                          <ChevronDown className="ml-2 h-4 w-4 flex-shrink-0 text-gray-500" />
                        </button>

                        {countryPickerOpen && (
                          <div className="absolute left-0 top-full z-20 mt-1 w-72 overflow-hidden rounded-md border border-gray-200 bg-white shadow-xl">
                            <div className="border-b border-gray-200 p-2">
                              <input
                                type="search"
                                value={countrySearch}
                                onChange={(e) => setCountrySearch(e.target.value)}
                                placeholder="Filter country or code"
                                aria-label="Filter countries"
                                className="block w-full rounded-md border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500"
                                autoFocus
                              />
                            </div>
                            <div className="max-h-56 overflow-y-auto py-1" role="listbox">
                              {filteredPhoneCountries.map(country => (
                                <button
                                  key={`${country.name}-${country.dialCode}`}
                                  type="button"
                                  onClick={() => handleCountrySelect(country)}
                                  className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-blue-50 ${
                                    selectedPhoneCountry.name === country.name ? 'bg-blue-50 text-blue-700' : 'text-gray-700'
                                  }`}
                                  role="option"
                                  aria-selected={selectedPhoneCountry.name === country.name}
                                >
                                  <span>{country.flag} {country.name}</span>
                                  <span className="ml-2 text-gray-500">{country.dialCode}</span>
                                </button>
                              ))}
                              {filteredPhoneCountries.length === 0 && (
                                <p className="px-3 py-3 text-sm text-gray-500">No matching country</p>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                      <input
                        type="tel"
                        inputMode="tel"
                        value={formData.seller_phone}
                        onChange={(e) => setFormData({ ...formData, seller_phone: e.target.value })}
                        placeholder={selectedPhoneCountry.placeholder}
                        aria-label="Phone number"
                        className="block min-w-0 flex-1 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                        required
                      />
                    </div>
                    <p className="mt-1 text-sm text-gray-500">{selectedPhoneCountry.dialCode}: {selectedPhoneCountry.hint}. Spaces, hyphens and brackets are optional.</p>
                  </div>
                </div>
              </div>

              {/* Property Images Section */}
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">Property Images</h3>
                
                {/* Input for the main image upload */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700">
                    Main Image <span className="text-red-600" aria-hidden="true">*</span>
                  </label>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={handleMainImageChange}
                    required={!formData.image_url && !mainImageFile}
                    className="mt-1 block w-full rounded-md border border-gray-300 bg-white text-sm text-gray-700 file:mr-4 file:border-0 file:bg-blue-50 file:px-4 file:py-2 file:text-sm file:font-medium file:text-blue-700 hover:file:bg-blue-100"
                  />
                  <p className="mt-1 text-xs text-gray-500">JPG, PNG or WebP. Maximum 10 MB.</p>
                  {mainImagePreview && (
                    <img
                      src={mainImagePreview}
                      alt="Main property preview"
                      className="mt-3 h-32 w-48 rounded-lg object-cover"
                    />
                  )}
                </div>

                {/* Section for Additional Images */}
                <div>
                  <label className="block text-sm font-medium text-gray-700">Additional Images</label>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    multiple
                    onChange={handleAdditionalImagesChange}
                    className="mt-1 block w-full rounded-md border border-gray-300 bg-white text-sm text-gray-700 file:mr-4 file:border-0 file:bg-blue-50 file:px-4 file:py-2 file:text-sm file:font-medium file:text-blue-700 hover:file:bg-blue-100"
                  />
                  <p className="mt-1 text-xs text-gray-500">You can select multiple images. They will upload when you save.</p>

                  {/* Display thumbnails for existing and newly selected photos */}
                  <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4">
                    {formData.photos.map((url, index) => (
                      <div key={`existing-${index}`} className="relative group">
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
                    {additionalImagePreviews.map((url, index) => (
                      <div key={`new-${index}`} className="relative group">
                        <img
                          src={url}
                          alt={`New property image ${index + 1}`}
                          className="h-24 w-full object-cover rounded-lg"
                        />
                        <button
                          type="button"
                          onClick={() => handleRemoveAdditionalImage(index)}
                          className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                          aria-label={`Remove new image ${index + 1}`}
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
                <label className="block text-sm font-medium text-gray-700">
                  Description <span className="text-red-600" aria-hidden="true">*</span>
                </label>
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
                  disabled={!formData.hdb_verified || !validateUnitNumber(formData.unit_number)}
                  className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
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
