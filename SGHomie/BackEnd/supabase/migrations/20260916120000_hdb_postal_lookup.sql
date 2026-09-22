/*
  HDB postal-code verification metadata.

  Unit numbers live in a private one-to-one table so the public properties
  endpoint can never expose them accidentally through select('*').
*/

ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS postal_code text,
  ADD COLUMN IF NOT EXISTS block_number text,
  ADD COLUMN IF NOT EXISTS street_name text,
  ADD COLUMN IF NOT EXISTS hdb_verified boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS location_verified_at timestamptz;

ALTER TABLE public.properties
  DROP CONSTRAINT IF EXISTS properties_postal_code_check;

ALTER TABLE public.properties
  ADD CONSTRAINT properties_postal_code_check
  CHECK (postal_code IS NULL OR postal_code ~ '^[0-9]{6}$');

CREATE TABLE IF NOT EXISTS public.property_private_details (
  property_id uuid PRIMARY KEY REFERENCES public.properties(id) ON DELETE CASCADE,
  unit_number text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.property_private_details
  DROP CONSTRAINT IF EXISTS property_private_details_unit_number_check;

ALTER TABLE public.property_private_details
  ADD CONSTRAINT property_private_details_unit_number_check
  CHECK (unit_number ~ '^#?[0-9]{1,3}-[0-9]{1,4}$');

CREATE INDEX IF NOT EXISTS property_private_details_property_id_idx
  ON public.property_private_details (property_id);

DROP TRIGGER IF EXISTS property_private_details_set_updated_at
  ON public.property_private_details;

CREATE TRIGGER property_private_details_set_updated_at
  BEFORE UPDATE ON public.property_private_details
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.property_private_details ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Sellers can view their private property details"
  ON public.property_private_details;
CREATE POLICY "Sellers can view their private property details"
  ON public.property_private_details
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.properties
      WHERE properties.id = property_private_details.property_id
        AND properties.seller_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Sellers can create their private property details"
  ON public.property_private_details;
CREATE POLICY "Sellers can create their private property details"
  ON public.property_private_details
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.properties
      WHERE properties.id = property_private_details.property_id
        AND properties.seller_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Sellers can update their private property details"
  ON public.property_private_details;
CREATE POLICY "Sellers can update their private property details"
  ON public.property_private_details
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.properties
      WHERE properties.id = property_private_details.property_id
        AND properties.seller_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.properties
      WHERE properties.id = property_private_details.property_id
        AND properties.seller_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Sellers can delete their private property details"
  ON public.property_private_details;
CREATE POLICY "Sellers can delete their private property details"
  ON public.property_private_details
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.properties
      WHERE properties.id = property_private_details.property_id
        AND properties.seller_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Admins can manage private property details"
  ON public.property_private_details;
CREATE POLICY "Admins can manage private property details"
  ON public.property_private_details
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE OR REPLACE FUNCTION public.set_location_coordinates()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  coords record;
BEGIN
  -- Preserve authoritative OneMap coordinates supplied by the postal lookup.
  -- Legacy rows without coordinates still receive the existing town fallback.
  IF NEW.latitude IS NULL OR NEW.longitude IS NULL THEN
    SELECT * INTO coords
    FROM public.get_location_coordinates(NEW.location);
    NEW.latitude := coords.lat;
    NEW.longitude := coords.lng;
  END IF;
  RETURN NEW;
END;
$$;
