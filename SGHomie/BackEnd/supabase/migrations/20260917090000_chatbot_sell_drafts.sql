/*
  Allow the chatbot to create an incomplete seller-owned listing that can be
  completed from the Seller Dashboard.
*/

ALTER TABLE public.properties
  DROP CONSTRAINT IF EXISTS properties_status_check;

ALTER TABLE public.properties
  ADD CONSTRAINT properties_status_check
  CHECK (status IN ('draft', 'pending', 'approved', 'rejected'));

DROP POLICY IF EXISTS "Sellers can insert their own properties"
  ON public.properties;
CREATE POLICY "Sellers can insert their own properties"
  ON public.properties
  FOR INSERT
  TO authenticated
  WITH CHECK (
    seller_id = auth.uid()
    AND status IN ('draft', 'pending')
    AND EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid() AND is_seller = true
    )
  );

DROP POLICY IF EXISTS "Sellers can update their own properties"
  ON public.properties;
CREATE POLICY "Sellers can update their own properties"
  ON public.properties
  FOR UPDATE
  TO authenticated
  USING (
    seller_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid() AND is_seller = true
    )
  )
  WITH CHECK (
    seller_id = auth.uid()
    AND status IN ('draft', 'pending')
    AND EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid() AND is_seller = true
    )
  );
