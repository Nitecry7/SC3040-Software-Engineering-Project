/*
  # Add policy for users to view their own enquiries

  1. Changes
    - Add RLS policy allowing users to view their own enquiries based on email
    - Use direct email comparison instead of a function

  2. Security
    - Users can only view enquiries with their email address
    - Maintains existing admin and creation policies
*/

-- Allow users to view their own enquiries
CREATE POLICY "Users can view their own enquiries"
  ON enquiries
  FOR SELECT
  TO public
  USING (
    email IN (
      SELECT email 
      FROM auth.users 
      WHERE id = auth.uid()
    )
  );