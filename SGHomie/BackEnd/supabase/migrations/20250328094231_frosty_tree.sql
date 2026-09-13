/*
  SG Homie application schema

  The first two migrations create `properties` and `user_profiles`. This
  migration contains the remaining application schema and policies.

  Supabase Auth owns the `auth` schema. Do not create, alter, or seed
  `auth.users` from application migrations. Create an admin account in the
  Supabase Dashboard, then mark its public profile as an admin separately.
*/

-- Required by gen_random_uuid(). Keep extensions in Supabase's extensions schema.
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- Complete the profile columns used by the application.
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS name text,
  ADD COLUMN IF NOT EXISTS family_members integer,
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS is_admin boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_seller boolean DEFAULT false;

UPDATE public.user_profiles
SET is_admin = false
WHERE is_admin IS NULL;

UPDATE public.user_profiles
SET is_seller = false
WHERE is_seller IS NULL;

ALTER TABLE public.user_profiles
  ALTER COLUMN is_admin SET DEFAULT false,
  ALTER COLUMN is_admin SET NOT NULL,
  ALTER COLUMN is_seller SET DEFAULT false,
  ALTER COLUMN is_seller SET NOT NULL;

-- Complete the property columns used by search, seller, and admin screens.
ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS detailed_location text,
  ADD COLUMN IF NOT EXISTS town text,
  ADD COLUMN IF NOT EXISTS seller_name text,
  ADD COLUMN IF NOT EXISTS seller_phone text,
  ADD COLUMN IF NOT EXISTS built_year integer,
  ADD COLUMN IF NOT EXISTS photos text[],
  ADD COLUMN IF NOT EXISTS latitude numeric,
  ADD COLUMN IF NOT EXISTS longitude numeric,
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS seller_id uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS rejection_reason text;

UPDATE public.properties
SET status = 'pending'
WHERE status IS NULL;

ALTER TABLE public.properties
  ALTER COLUMN status SET DEFAULT 'pending',
  ALTER COLUMN status SET NOT NULL;

ALTER TABLE public.properties
  DROP CONSTRAINT IF EXISTS properties_status_check;

ALTER TABLE public.properties
  ADD CONSTRAINT properties_status_check
  CHECK (status IN ('pending', 'approved', 'rejected'));

-- Enquiries are submitted by visitors and read/managed by their owner or an admin.
CREATE TABLE public.enquiries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text NOT NULL,
  phone text NOT NULL,
  message text NOT NULL,
  status text NOT NULL DEFAULT 'PENDING',
  admin_response text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT enquiries_status_check CHECK (status IN ('PENDING', 'RESPONDED'))
);

-- Users can save their interest in a property once.
CREATE TABLE public.property_interests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT property_interests_property_user_key UNIQUE (property_id, user_id)
);

-- Nearby amenities displayed on a property details page.
CREATE TABLE public.property_amenities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  name text NOT NULL,
  type text NOT NULL,
  distance numeric NOT NULL,
  latitude numeric NOT NULL,
  longitude numeric NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS properties_seller_id_idx
  ON public.properties (seller_id);

CREATE INDEX IF NOT EXISTS properties_status_idx
  ON public.properties (status);

CREATE INDEX IF NOT EXISTS property_interests_property_id_idx
  ON public.property_interests (property_id);

CREATE INDEX IF NOT EXISTS property_amenities_property_id_idx
  ON public.property_amenities (property_id);

-- A small helper keeps admin checks consistent across RLS policies.
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_profiles
    WHERE id = auth.uid()
      AND is_admin = true
  );
$$;

REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin() TO anon, authenticated, service_role;

-- Prevent a signed-in user from promoting their own profile to admin.
CREATE OR REPLACE FUNCTION public.prevent_admin_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF auth.uid() IS NOT NULL
     AND auth.uid() = OLD.id
     AND NEW.is_admin IS DISTINCT FROM OLD.is_admin THEN
    RAISE EXCEPTION 'Only a trusted server can change administrator status';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_admin_escalation_trigger ON public.user_profiles;
CREATE TRIGGER prevent_admin_escalation_trigger
  BEFORE UPDATE OF is_admin ON public.user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_admin_escalation();

-- Keep updated_at values correct for profile and enquiry edits.
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS user_profiles_set_updated_at ON public.user_profiles;
CREATE TRIGGER user_profiles_set_updated_at
  BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS enquiries_set_updated_at ON public.enquiries;
CREATE TRIGGER enquiries_set_updated_at
  BEFORE UPDATE ON public.enquiries
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- Replace the two original property policies with the final access model.
DROP POLICY IF EXISTS "Anyone can view properties" ON public.properties;
DROP POLICY IF EXISTS "Authenticated users can create properties" ON public.properties;
DROP POLICY IF EXISTS "Users can update own properties" ON public.properties;
DROP POLICY IF EXISTS "Users can delete own properties" ON public.properties;
DROP POLICY IF EXISTS "Admins can manage all properties" ON public.properties;
DROP POLICY IF EXISTS "Sellers can insert their own properties" ON public.properties;
DROP POLICY IF EXISTS "Sellers can update their own properties" ON public.properties;

CREATE POLICY "Public can view approved properties"
  ON public.properties
  FOR SELECT
  TO anon, authenticated
  USING (status = 'approved' OR seller_id = auth.uid() OR public.is_admin());

CREATE POLICY "Sellers can insert their own properties"
  ON public.properties
  FOR INSERT
  TO authenticated
  WITH CHECK (
    seller_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid() AND is_seller = true
    )
  );

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
    AND EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid() AND is_seller = true
    )
  );

CREATE POLICY "Sellers can delete their own properties"
  ON public.properties
  FOR DELETE
  TO authenticated
  USING (
    seller_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid() AND is_seller = true
    )
  );

CREATE POLICY "Admins can manage all properties"
  ON public.properties
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Property-interest policies.
ALTER TABLE public.property_interests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view property interests"
  ON public.property_interests
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can create their own interests"
  ON public.property_interests
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own interests"
  ON public.property_interests
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Amenity policies.
ALTER TABLE public.property_amenities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view amenities"
  ON public.property_amenities
  FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Sellers can manage their property amenities"
  ON public.property_amenities
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.properties
      WHERE id = property_amenities.property_id
        AND seller_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.properties
      WHERE id = property_amenities.property_id
        AND seller_id = auth.uid()
    )
  );

CREATE POLICY "Admins can manage all amenities"
  ON public.property_amenities
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Enquiry policies. The JWT email is used directly; auth.users is never exposed.
ALTER TABLE public.enquiries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can create enquiries"
  ON public.enquiries
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Users can view their own enquiries"
  ON public.enquiries
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() IS NOT NULL
    AND lower(email) = lower(auth.jwt() ->> 'email')
  );

CREATE POLICY "Admins can manage all enquiries"
  ON public.enquiries
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- The admin Edge Function needs counts, but browser roles do not.
CREATE OR REPLACE VIEW public.user_property_counts AS
SELECT seller_id, count(*)::bigint AS property_count
FROM public.properties
WHERE seller_id IS NOT NULL
GROUP BY seller_id;

REVOKE ALL ON public.user_property_counts FROM anon, authenticated;
GRANT SELECT ON public.user_property_counts TO service_role;

-- Realtime is optional locally, but enable it when the publication exists.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
     AND NOT EXISTS (
       SELECT 1
       FROM pg_publication_tables
       WHERE pubname = 'supabase_realtime'
         AND schemaname = 'public'
         AND tablename = 'properties'
     ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.properties;
  END IF;
END;
$$;

-- Default nearby amenities for new listings.
CREATE OR REPLACE FUNCTION public.get_location_coordinates(location_name text)
RETURNS TABLE (lat numeric, lng numeric)
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
  SELECT
    CASE upper(trim(location_name))
      WHEN 'ANG MO KIO' THEN 1.3691 WHEN 'BEDOK' THEN 1.3236
      WHEN 'BISHAN' THEN 1.3526 WHEN 'BUKIT BATOK' THEN 1.3590
      WHEN 'BUKIT MERAH' THEN 1.2819 WHEN 'BUKIT PANJANG' THEN 1.3774
      WHEN 'BUKIT TIMAH' THEN 1.3294 WHEN 'CENTRAL AREA' THEN 1.3048
      WHEN 'CHOA CHU KANG' THEN 1.3840 WHEN 'CLEMENTI' THEN 1.3162
      WHEN 'GEYLANG' THEN 1.3201 WHEN 'HOUGANG' THEN 1.3612
      WHEN 'JURONG EAST' THEN 1.3329 WHEN 'JURONG WEST' THEN 1.3404
      WHEN 'KALLANG/WHAMPOA' THEN 1.3100 WHEN 'MARINE PARADE' THEN 1.3028
      WHEN 'PASIR RIS' THEN 1.3721 WHEN 'PUNGGOL' THEN 1.3984
      WHEN 'QUEENSTOWN' THEN 1.2942 WHEN 'SEMBAWANG' THEN 1.4491
      WHEN 'SENGKANG' THEN 1.3868 WHEN 'SERANGOON' THEN 1.3554
      WHEN 'TAMPINES' THEN 1.3496 WHEN 'TOA PAYOH' THEN 1.3343
      WHEN 'WOODLANDS' THEN 1.4382 WHEN 'YISHUN' THEN 1.4304
      ELSE 1.3521
    END::numeric,
    CASE upper(trim(location_name))
      WHEN 'ANG MO KIO' THEN 103.8454 WHEN 'BEDOK' THEN 103.9273
      WHEN 'BISHAN' THEN 103.8352 WHEN 'BUKIT BATOK' THEN 103.7637
      WHEN 'BUKIT MERAH' THEN 103.8239 WHEN 'BUKIT PANJANG' THEN 103.7719
      WHEN 'BUKIT TIMAH' THEN 103.8021 WHEN 'CENTRAL AREA' THEN 103.8318
      WHEN 'CHOA CHU KANG' THEN 103.7470 WHEN 'CLEMENTI' THEN 103.7649
      WHEN 'GEYLANG' THEN 103.8918 WHEN 'HOUGANG' THEN 103.8863
      WHEN 'JURONG EAST' THEN 103.7436 WHEN 'JURONG WEST' THEN 103.7090
      WHEN 'KALLANG/WHAMPOA' THEN 103.8651 WHEN 'MARINE PARADE' THEN 103.9074
      WHEN 'PASIR RIS' THEN 103.9493 WHEN 'PUNGGOL' THEN 103.9068
      WHEN 'QUEENSTOWN' THEN 103.7861 WHEN 'SEMBAWANG' THEN 103.8185
      WHEN 'SENGKANG' THEN 103.8914 WHEN 'SERANGOON' THEN 103.8679
      WHEN 'TAMPINES' THEN 103.9454 WHEN 'TOA PAYOH' THEN 103.8563
      WHEN 'WOODLANDS' THEN 103.7886 WHEN 'YISHUN' THEN 103.8354
      ELSE 103.8198
    END::numeric;
$$;

CREATE OR REPLACE FUNCTION public.set_location_coordinates()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  coords record;
BEGIN
  IF TG_OP = 'INSERT'
     OR NEW.location IS DISTINCT FROM OLD.location
     OR NEW.latitude IS NULL
     OR NEW.longitude IS NULL THEN
    SELECT * INTO coords
    FROM public.get_location_coordinates(NEW.location);
    NEW.latitude := coords.lat;
    NEW.longitude := coords.lng;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_coordinates_trigger ON public.properties;
CREATE TRIGGER set_coordinates_trigger
  BEFORE INSERT OR UPDATE OF location ON public.properties
  FOR EACH ROW
  EXECUTE FUNCTION public.set_location_coordinates();

CREATE OR REPLACE FUNCTION public.add_default_amenities()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
BEGIN
  INSERT INTO public.property_amenities
    (property_id, name, type, distance, latitude, longitude)
  VALUES
    (NEW.id, 'Nearest MRT Station', 'Transport',
     round((random() * 0.5 + 0.2)::numeric, 2),
     NEW.latitude + (random() * 0.002 - 0.001),
     NEW.longitude + (random() * 0.002 - 0.001)),
    (NEW.id, 'Shopping Mall', 'Shopping',
     round((random() * 0.8 + 0.3)::numeric, 2),
     NEW.latitude + (random() * 0.002 - 0.001),
     NEW.longitude + (random() * 0.002 - 0.001)),
    (NEW.id, 'Neighbourhood Park', 'Park',
     round((random() * 0.4 + 0.1)::numeric, 2),
     NEW.latitude + (random() * 0.002 - 0.001),
     NEW.longitude + (random() * 0.002 - 0.001));

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS add_amenities_trigger ON public.properties;
CREATE TRIGGER add_amenities_trigger
  AFTER INSERT ON public.properties
  FOR EACH ROW
  EXECUTE FUNCTION public.add_default_amenities();
