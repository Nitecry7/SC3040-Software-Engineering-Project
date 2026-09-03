/*
  # Fix property amenities RLS policies

  1. Changes
    - Update RLS policies for property_amenities table
    - Allow sellers to manage amenities for their own properties
    - Allow admins to manage all amenities
    - Ensure proper cascading permissions

  2. Security
    - Enable RLS on property_amenities table
    - Add proper access control policies
    - Maintain existing security model
*/

-- First ensure RLS is enabled
ALTER TABLE property_amenities ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Anyone can view amenities" ON property_amenities;
DROP POLICY IF EXISTS "Admins can manage amenities" ON property_amenities;

-- Create new policies

-- Allow anyone to view amenities
CREATE POLICY "Anyone can view amenities"
ON property_amenities
FOR SELECT
USING (true);

-- Allow sellers to manage amenities for their own properties
CREATE POLICY "Sellers can manage their property amenities"
ON property_amenities
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM properties
    WHERE properties.id = property_amenities.property_id
    AND properties.seller_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM properties
    WHERE properties.id = property_amenities.property_id
    AND properties.seller_id = auth.uid()
  )
);

-- Allow admins to manage all amenities
CREATE POLICY "Admins can manage all amenities"
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

-- Update trigger function to handle RLS
CREATE OR REPLACE FUNCTION add_default_amenities()
RETURNS TRIGGER AS $$
DECLARE
  v_user_id uuid;
BEGIN
  -- Get the current user ID
  v_user_id := auth.uid();
  
  -- Only proceed if the user has permission
  IF EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = v_user_id
    AND (is_admin = true OR v_user_id = NEW.seller_id)
  ) THEN
    -- Add MRT Station
    INSERT INTO property_amenities (
      id, property_id, name, type, distance, latitude, longitude
    ) VALUES (
      gen_random_uuid(),
      NEW.id,
      'Nearest MRT Station',
      'Transport',
      round((random() * 0.5 + 0.2)::numeric, 2),
      NEW.latitude + (random() * 0.002 - 0.001),
      NEW.longitude + (random() * 0.002 - 0.001)
    );

    -- Add Shopping Mall
    INSERT INTO property_amenities (
      id, property_id, name, type, distance, latitude, longitude
    ) VALUES (
      gen_random_uuid(),
      NEW.id,
      'Shopping Mall',
      'Shopping',
      round((random() * 0.8 + 0.3)::numeric, 2),
      NEW.latitude + (random() * 0.002 - 0.001),
      NEW.longitude + (random() * 0.002 - 0.001)
    );

    -- Add Park
    INSERT INTO property_amenities (
      id, property_id, name, type, distance, latitude, longitude
    ) VALUES (
      gen_random_uuid(),
      NEW.id,
      'Neighborhood Park',
      'Park',
      round((random() * 0.4 + 0.1)::numeric, 2),
      NEW.latitude + (random() * 0.002 - 0.001),
      NEW.longitude + (random() * 0.002 - 0.001)
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;