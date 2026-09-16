/*
  SG Homie initial schema.

  This migration is intended for a fresh Supabase project. The historical
  migrations are kept under archived_migrations/ for reference only.
*/

-- Required by gen_random_uuid(). Create it before any table uses the function.
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

CREATE TABLE public.user_profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id),
  income_range text,
  preferred_locations text[],
  preferred_property_type text,
  max_budget numeric,
  name text,
  family_members integer,
  phone text,
  is_admin boolean NOT NULL DEFAULT false,
  is_seller boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.properties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  price numeric NOT NULL,
  location text NOT NULL,
  type text NOT NULL,
  image_url text NOT NULL,
  bedrooms integer NOT NULL,
  bathrooms integer NOT NULL,
  area_sqft numeric NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  -- Retained for compatibility with the historical schema.
  user_id uuid REFERENCES auth.users(id),
  detailed_location text,
  town text,
  seller_name text,
  seller_phone text,
  built_year integer,
  photos text[],
  latitude numeric,
  longitude numeric,
  status text NOT NULL DEFAULT 'pending',
  seller_id uuid REFERENCES auth.users(id),
  rejection_reason text,
  CONSTRAINT properties_status_check CHECK (status IN ('pending', 'approved', 'rejected'))
);

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

CREATE TABLE public.property_interests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT property_interests_property_user_key UNIQUE (property_id, user_id)
);

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

CREATE INDEX properties_seller_id_idx ON public.properties (seller_id);
CREATE INDEX properties_status_idx ON public.properties (status);
CREATE INDEX property_interests_property_id_idx ON public.property_interests (property_id);
CREATE INDEX property_amenities_property_id_idx ON public.property_amenities (property_id);

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

-- Prevent authenticated users from setting or changing their own admin flag.
-- Trusted SQL/service-role operations have auth.uid() = NULL and remain allowed.
CREATE OR REPLACE FUNCTION public.prevent_admin_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF auth.uid() IS NOT NULL
     AND (
       (TG_OP = 'INSERT' AND NEW.is_admin IS DISTINCT FROM false)
       OR (
         TG_OP = 'UPDATE'
         AND auth.uid() = OLD.id
         AND NEW.is_admin IS DISTINCT FROM OLD.is_admin
       )
     ) THEN
    RAISE EXCEPTION 'Only a trusted server can change administrator status';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER prevent_admin_escalation_trigger
  BEFORE INSERT OR UPDATE OF is_admin ON public.user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_admin_escalation();

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

CREATE TRIGGER user_profiles_set_updated_at
  BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER enquiries_set_updated_at
  BEFORE UPDATE ON public.enquiries
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- Profile policies. The insert check is defense in depth with the trigger.
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own profile"
  ON public.user_profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.user_profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON public.user_profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id AND is_admin = false);

-- Replace seller_id with user_id when importing historical property rows.
UPDATE public.properties
SET seller_id = user_id
WHERE seller_id IS NULL AND user_id IS NOT NULL;

-- Property policies.
ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;

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
    AND status = 'pending'
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
    AND status = 'pending'
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

-- Enquiry policies.
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

CREATE TRIGGER add_amenities_trigger
  AFTER INSERT ON public.properties
  FOR EACH ROW
  EXECUTE FUNCTION public.add_default_amenities();
