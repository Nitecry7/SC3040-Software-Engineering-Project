/*
  # Add seller features

  1. Changes
    - Add is_seller column to user_profiles
    - Add status column to properties
    - Add seller_id column to properties
    - Add RLS policies for sellers

  2. Security
    - Enable RLS policies for sellers to manage their properties
    - Allow admins to manage all properties
*/

-- Add seller-related columns
ALTER TABLE user_profiles
ADD COLUMN is_seller boolean DEFAULT false;

-- Add status column to properties
ALTER TABLE properties
ADD COLUMN status text DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
ADD COLUMN seller_id uuid REFERENCES auth.users(id);

-- Update RLS policies for properties
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