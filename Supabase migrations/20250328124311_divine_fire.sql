/*
  # Add property interests and amenities

  1. New Tables
    - `property_interests`
      - `id` (uuid, primary key)
      - `property_id` (uuid, references properties)
      - `user_id` (uuid, references auth.users)
      - `created_at` (timestamp)

    - `property_amenities`
      - `id` (uuid, primary key)
      - `property_id` (uuid, references properties)
      - `name` (text)
      - `type` (text)
      - `distance` (numeric)
      - `latitude` (numeric)
      - `longitude` (numeric)

  2. New Columns
    - Add to properties:
      - `latitude` (numeric)
      - `longitude` (numeric)

  3. Security
    - Enable RLS on new tables
    - Add appropriate policies
*/

-- Add coordinates to properties
ALTER TABLE properties
ADD COLUMN latitude numeric,
ADD COLUMN longitude numeric;

-- Create property interests table
CREATE TABLE property_interests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid REFERENCES properties(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(property_id, user_id)
);

-- Create property amenities table
CREATE TABLE property_amenities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid REFERENCES properties(id) ON DELETE CASCADE,
  name text NOT NULL,
  type text NOT NULL,
  distance numeric NOT NULL,
  latitude numeric NOT NULL,
  longitude numeric NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE property_interests ENABLE ROW LEVEL SECURITY;
ALTER TABLE property_amenities ENABLE ROW LEVEL SECURITY;

-- Policies for property_interests
CREATE POLICY "Users can view all property interests"
  ON property_interests
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can create their own interests"
  ON property_interests
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own interests"
  ON property_interests
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Policies for property_amenities
CREATE POLICY "Anyone can view amenities"
  ON property_amenities
  FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage amenities"
  ON property_amenities
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

-- Update sample properties with coordinates
UPDATE properties
SET 
  latitude = 1.3521,
  longitude = 103.8198
WHERE location = 'TAMPINES';

UPDATE properties
SET 
  latitude = 1.4382,
  longitude = 103.7891
WHERE location = 'WOODLANDS';

UPDATE properties
SET 
  latitude = 1.3236,
  longitude = 103.9273
WHERE location = 'BEDOK';

-- Insert sample amenities
INSERT INTO property_amenities (property_id, name, type, distance, latitude, longitude)
SELECT 
  p.id,
  unnest(ARRAY['Tampines Mall', 'Tampines MRT', 'Our Tampines Hub']) as name,
  unnest(ARRAY['Shopping', 'Transport', 'Community']) as type,
  unnest(ARRAY[0.3, 0.5, 0.7]) as distance,
  p.latitude + random() * 0.002 - 0.001 as latitude,
  p.longitude + random() * 0.002 - 0.001 as longitude
FROM properties p
WHERE p.location = 'TAMPINES';

INSERT INTO property_amenities (property_id, name, type, distance, latitude, longitude)
SELECT 
  p.id,
  unnest(ARRAY['Causeway Point', 'Woodlands MRT', 'Woodlands Waterfront']) as name,
  unnest(ARRAY['Shopping', 'Transport', 'Park']) as type,
  unnest(ARRAY[0.4, 0.3, 0.8]) as distance,
  p.latitude + random() * 0.002 - 0.001 as latitude,
  p.longitude + random() * 0.002 - 0.001 as longitude
FROM properties p
WHERE p.location = 'WOODLANDS';

INSERT INTO property_amenities (property_id, name, type, distance, latitude, longitude)
SELECT 
  p.id,
  unnest(ARRAY['Bedok Mall', 'Bedok MRT', 'Bedok Reservoir']) as name,
  unnest(ARRAY['Shopping', 'Transport', 'Park']) as type,
  unnest(ARRAY[0.2, 0.4, 0.6]) as distance,
  p.latitude + random() * 0.002 - 0.001 as latitude,
  p.longitude + random() * 0.002 - 0.001 as longitude
FROM properties p
WHERE p.location = 'BEDOK';