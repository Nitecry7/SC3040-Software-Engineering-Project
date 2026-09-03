/*
  # Enhance properties table with additional fields

  1. Changes
    - Add new columns to properties table:
      - detailed_location (text): Full address
      - town (text): Town/district name
      - seller_name (text)
      - seller_phone (text)
      - built_year (integer)
      - photos (text[]): Array of photo URLs
    
  2. Security
    - Update RLS policies to include admin access
    - Add policy for admins to manage all properties
*/

-- Add new columns to properties table
ALTER TABLE properties
ADD COLUMN IF NOT EXISTS detailed_location text,
ADD COLUMN IF NOT EXISTS town text,
ADD COLUMN IF NOT EXISTS seller_name text,
ADD COLUMN IF NOT EXISTS seller_phone text,
ADD COLUMN IF NOT EXISTS built_year integer,
ADD COLUMN IF NOT EXISTS photos text[];

-- Add admin access policy
CREATE POLICY "Admins can manage all properties"
  ON properties
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.is_admin = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.is_admin = true
    )
  );

-- Insert sample properties
INSERT INTO properties (
  title,
  price,
  location,
  type,
  image_url,
  bedrooms,
  bathrooms,
  area_sqft,
  description,
  detailed_location,
  town,
  seller_name,
  seller_phone,
  built_year,
  photos
) VALUES
(
  'Cozy 4-Room HDB in Tampines',
  550000,
  'TAMPINES',
  'HDB',
  'https://images.unsplash.com/photo-1568605114967-8130f3a36994?auto=format&fit=crop&w=1200&q=80',
  4,
  2,
  1100,
  'Beautiful 4-room HDB with excellent amenities nearby',
  'Block 123 Tampines Street 11',
  'TAMPINES',
  'John Tan',
  '+65 9123 4567',
  2010,
  ARRAY['https://images.unsplash.com/photo-1568605114967-8130f3a36994?auto=format&fit=crop&w=1200&q=80',
        'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?auto=format&fit=crop&w=1200&q=80']
),
(
  'Spacious 5-Room HDB in Woodlands',
  620000,
  'WOODLANDS',
  'HDB',
  'https://images.unsplash.com/photo-1560449752-094a9f0e0abe?auto=format&fit=crop&w=1200&q=80',
  5,
  2,
  1300,
  'Renovated 5-room HDB with modern fixtures',
  'Block 456 Woodlands Drive 16',
  'WOODLANDS',
  'Mary Lim',
  '+65 9876 5432',
  2015,
  ARRAY['https://images.unsplash.com/photo-1560449752-094a9f0e0abe?auto=format&fit=crop&w=1200&q=80',
        'https://images.unsplash.com/photo-1560185893-a55cbc8c57e8?auto=format&fit=crop&w=1200&q=80']
),
(
  'Charming 3-Room HDB in Bedok',
  450000,
  'BEDOK',
  'HDB',
  'https://images.unsplash.com/photo-1560185127-6ed189bf02f4?auto=format&fit=crop&w=1200&q=80',
  3,
  2,
  800,
  'Well-maintained 3-room HDB near Bedok MRT',
  'Block 789 Bedok North Road',
  'BEDOK',
  'Sarah Wong',
  '+65 9234 5678',
  2008,
  ARRAY['https://images.unsplash.com/photo-1560185127-6ed189bf02f4?auto=format&fit=crop&w=1200&q=80',
        'https://images.unsplash.com/photo-1560185007-cde436f6a4d0?auto=format&fit=crop&w=1200&q=80']
);