/*
  # Update user profiles table

  1. Changes
    - Add name column
    - Add family_members column
    - Remove max_budget column

  2. Security
    - Maintain existing RLS policies
*/

-- Add new columns
ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS name text,
ADD COLUMN IF NOT EXISTS family_members integer;

-- Remove max_budget column if it exists
DO $$ 
BEGIN 
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'user_profiles' 
    AND column_name = 'max_budget'
  ) THEN
    ALTER TABLE user_profiles DROP COLUMN max_budget;
  END IF;
END $$;