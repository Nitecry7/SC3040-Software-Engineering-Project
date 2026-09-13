/*
  # Create properties table for SG Homie

  1. New Tables
    - `properties`
      - `id` (uuid, primary key)
      - `title` (text)
      - `price` (numeric)
      - `location` (text)
      - `type` (text)
      - `image_url` (text)
      - `bedrooms` (integer)
      - `bathrooms` (integer)
      - `area_sqft` (numeric)
      - `description` (text)
      - `created_at` (timestamp)
      - `user_id` (uuid, foreign key to auth.users)

  2. Security
    - Enable RLS on `properties` table
    - Add policies for:
      - Anyone can view properties
      - Only authenticated users can create properties
      - Only property owners can update/delete their properties
*/

CREATE TABLE properties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  price numeric NOT NULL,
  location text NOT NULL,
  type text NOT NULL,
  image_url text NOT NULL,
  bedrooms integer NOT NULL,
  bathrooms integer NOT NULL,
  area_sqft numeric NOT NULL,
  description text,
  created_at timestamptz DEFAULT now(),
  user_id uuid REFERENCES auth.users(id)
);

ALTER TABLE properties ENABLE ROW LEVEL SECURITY;

-- Allow anyone to view properties
CREATE POLICY "Anyone can view properties"
  ON properties
  FOR SELECT
  USING (true);

-- Allow authenticated users to create properties
CREATE POLICY "Authenticated users can create properties"
  ON properties
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Allow users to update their own properties
CREATE POLICY "Users can update own properties"
  ON properties
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Allow users to delete their own properties
CREATE POLICY "Users can delete own properties"
  ON properties
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);