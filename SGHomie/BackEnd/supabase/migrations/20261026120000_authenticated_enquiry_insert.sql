-- Enquiry submission is a registered-user feature. Keep read and admin
-- management policies unchanged while removing anonymous Data API inserts.
DROP POLICY IF EXISTS "Anyone can create enquiries"
  ON public.enquiries;

CREATE POLICY "Authenticated users can create enquiries"
  ON public.enquiries
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND lower(email) = lower(auth.jwt() ->> 'email')
    AND status = 'PENDING'
    AND admin_response IS NULL
  );
