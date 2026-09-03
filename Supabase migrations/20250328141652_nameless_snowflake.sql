/*
  # Add seller features and property approval system

  1. Changes
    - Add is_seller column to user_profiles
    - Add status and seller_id columns to properties
    - Add RLS policies for sellers

  2. Security
    - Enable RLS policies for sellers to manage their properties
    - Allow admins to manage all properties
    - Ensure proper references to auth.users table
*/

-- Add seller-related columns
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'user_profiles' AND column_name = 'is_seller'
  ) THEN
    ALTER TABLE user_profiles
    ADD COLUMN is_seller boolean DEFAULT false;
  END IF;
END $$;

-- Add status and seller_id columns to properties
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'properties' AND column_name = 'status'
  ) THEN
    ALTER TABLE properties
    ADD COLUMN status text DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'properties' AND column_name = 'seller_id'
  ) THEN
    ALTER TABLE properties
    ADD COLUMN seller_id uuid REFERENCES auth.users(id);
  END IF;
END $$;

-- Drop existing policies if they exist
DO $$ 
BEGIN
  DROP POLICY IF EXISTS "Sellers can insert their own properties" ON properties;
  DROP POLICY IF EXISTS "Sellers can update their own properties" ON properties;
EXCEPTION
  WHEN undefined_object THEN
    NULL;
END $$;

-- Create new policies
CREATE POLICY "Sellers can insert their own properties"
ON properties
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid()
    AND (is_seller = true OR is_admin = true)
  )
);

CREATE POLICY "Sellers can update their own properties"
ON properties
FOR UPDATE
TO authenticated
USING (
  seller_id = auth.uid() OR
  EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid()
    AND is_admin = true
  )
)
WITH CHECK (
  seller_id = auth.uid() OR
  EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid()
    AND is_admin = true
  )
);