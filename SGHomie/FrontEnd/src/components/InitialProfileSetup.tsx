import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';

const INCOME_RANGES = [
  '0-3000',
  '3001-6000',
  '6001-9000',
  '9001-12000',
  '12001+'
];

const PROPERTY_TYPES = [
  '2 ROOM',
  '3 ROOM',
  '4 ROOM',
  'EXECUTIVE'
];

const LOCATIONS = [
  'ANG MO KIO', 'BEDOK', 'BISHAN', 'BUKIT BATOK', 'BUKIT MERAH',
  'BUKIT PANJANG', 'BUKIT TIMAH', 'CENTRAL AREA', 'CHOA CHU KANG',
  'CLEMENTI', 'GEYLANG', 'HOUGANG', 'JURONG EAST', 'JURONG WEST',
  'KALLANG/WHAMPOA', 'MARINE PARADE', 'PASIR RIS', 'PUNGGOL',
  'QUEENSTOWN', 'SEMBAWANG', 'SENGKANG', 'SERANGOON', 'TAMPINES',
  'TOA PAYOH', 'WOODLANDS', 'YISHUN'
].sort();

interface InitialProfileSetupProps {
  onComplete: () => void;
  userId: string;
}

const InitialProfileSetup = ({ onComplete, userId }: InitialProfileSetupProps) => {
  const [formData, setFormData] = useState({
    name: '',
    income_range: '',
    preferred_property_type: '',
    preferred_locations: [] as string[],
    family_members: '',
  });

  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase
        .from('user_profiles')
        .upsert({
          id: userId,
          name: formData.name,
          income_range: formData.income_range,
          preferred_property_type: formData.preferred_property_type,
          preferred_locations: [formData.preferred_locations[0]],
          family_members: parseInt(formData.family_members),
        });

      if (error) throw error;

      toast.success('Profile setup completed!');
      onComplete();
    } catch (error) {
      console.error('Error setting up profile:', error);
      toast.error('Failed to set up profile');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl max-w-2xl w-full p-8">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold text-gray-900">Complete Your Profile</h2>
          <p className="mt-2 text-gray-600">
            Please provide some information to help us personalize your experience
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Full Name *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="mt-1 block w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Monthly Income Range *
            </label>
            <select
              value={formData.income_range}
              onChange={(e) => setFormData({ ...formData, income_range: e.target.value })}
              className="mt-1 block w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              required
            >
              <option value="">Select Income Range</option>
              {INCOME_RANGES.map((range) => (
                <option key={range} value={range}>
                  ${range}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Preferred Property Type *
            </label>
            <select
              value={formData.preferred_property_type}
              onChange={(e) => setFormData({ ...formData, preferred_property_type: e.target.value })}
              className="mt-1 block w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              required
            >
              <option value="">Select Property Type</option>
              {PROPERTY_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Preferred Location *
            </label>
            <select
              value={formData.preferred_locations[0] || ''}
              onChange={(e) => setFormData({ ...formData, preferred_locations: [e.target.value] })}
              className="mt-1 block w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
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

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Number of Family Members *
            </label>
            <input
              type="number"
              min="1"
              max="10"
              value={formData.family_members}
              onChange={(e) => setFormData({ ...formData, family_members: e.target.value })}
              className="mt-1 block w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Setting up...' : 'Complete Setup'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default InitialProfileSetup;