-- Update existing enquiries to use uppercase status
UPDATE enquiries SET status = 'PENDING' WHERE status = 'pending';
UPDATE enquiries SET status = 'RESPONDED' WHERE status = 'responded';

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