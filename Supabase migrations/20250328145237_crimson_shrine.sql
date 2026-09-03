/*
  # Fix enquiries table policies

  1. Changes
    - Update the policy to correctly check user email
    - Ensure proper access control for enquiries

  2. Security
    - Maintain RLS on enquiries table
    - Fix email comparison in policies
*/

-- First, ensure RLS is enabled
ALTER TABLE enquiries ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Anyone can create enquiries" ON enquiries;
DROP POLICY IF EXISTS "Users can view their own enquiries" ON enquiries;
DROP POLICY IF EXISTS "Admins can manage all enquiries" ON enquiries;

-- Create new policies
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
  email = (SELECT email FROM auth.users WHERE id = auth.uid())
  OR EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid()
    AND is_admin = true
  )
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