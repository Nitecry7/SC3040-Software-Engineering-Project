/*
  # Fix user_emails view and related policies

  1. Changes
    - Drop dependent policies first
    - Recreate view with proper schema reference
    - Recreate policies with updated view

  2. Security
    - Maintain RLS policies
    - Ensure proper access control
*/

-- First drop the dependent policy
DROP POLICY IF EXISTS "Users can view their own enquiries" ON enquiries;

-- Now we can safely drop and recreate the view
DROP VIEW IF EXISTS public.user_emails;

CREATE OR REPLACE VIEW public.user_emails AS
SELECT id, email
FROM auth.users;

-- Recreate the policy with the updated view
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
    )::text
  END
);