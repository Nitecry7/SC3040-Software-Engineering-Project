/*
  # Fix enquiries display and policies

  1. Changes
    - Create a view for enquiries with user emails
    - Update RLS policies to use proper email comparison
    - Ensure proper case handling for status

  2. Security
    - Maintain RLS on enquiries table
    - Add proper access control
*/

-- Create a view to help with email lookups
CREATE OR REPLACE VIEW public.user_emails AS
SELECT id, email
FROM auth.users;

-- First, ensure RLS is enabled
ALTER TABLE enquiries ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Anyone can create enquiries" ON enquiries;
DROP POLICY IF EXISTS "Users can view their own enquiries" ON enquiries;
DROP POLICY IF EXISTS "Admins can manage all enquiries" ON enquiries;

-- Create new policies with proper email comparison
CREATE POLICY "Anyone can create enquiries"
ON enquiries
FOR INSERT
TO public
WITH CHECK (true);

CREATE POLICY "Users can view their own enquiries"
ON enquiries
FOR SELECT
TO public
USING (
  CASE 
    WHEN auth.uid() IS NULL THEN false
    WHEN EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
      AND is_admin = true
    ) THEN true
    ELSE email = (
      SELECT email 
      FROM user_emails 
      WHERE id = auth.uid()
    )
  END
);

CREATE POLICY "Admins can manage all enquiries"
ON enquiries
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid()
    AND is_admin = true
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid()
    AND is_admin = true
  )
);

-- Update any existing enquiries to use uppercase status
UPDATE enquiries
SET status = UPPER(status)
WHERE status != UPPER(status);

-- Add a check constraint to ensure status is always uppercase
ALTER TABLE enquiries
DROP CONSTRAINT IF EXISTS enquiries_status_check;

ALTER TABLE enquiries
ADD CONSTRAINT enquiries_status_check
CHECK (status IN ('PENDING', 'RESPONDED'));