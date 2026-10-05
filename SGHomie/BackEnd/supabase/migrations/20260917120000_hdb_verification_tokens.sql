/*
  Bind HDB lookup results to subsequent property writes.

  The lookup Edge Function issues short-lived bearer tokens through the
  service role. A trigger uses the token's address data on seller writes,
  so clients cannot simply set hdb_verified or fabricate coordinates.
*/

ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS hdb_verification_token uuid;

CREATE TABLE IF NOT EXISTS public.hdb_location_verifications (
  token uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  postal_code text NOT NULL,
  block_number text NOT NULL,
  street_name text NOT NULL,
  town text NOT NULL DEFAULT '',
  built_year integer,
  latitude numeric NOT NULL,
  longitude numeric NOT NULL,
  verified_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '15 minutes')
);

ALTER TABLE public.hdb_location_verifications ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.hdb_location_verifications FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.hdb_location_verifications TO service_role;

CREATE INDEX IF NOT EXISTS hdb_location_verifications_seller_expiry_idx
  ON public.hdb_location_verifications (seller_id, expires_at);

CREATE OR REPLACE FUNCTION public.apply_hdb_location_verification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  verification public.hdb_location_verifications%ROWTYPE;
  requires_verification boolean := false;
BEGIN
  -- Trusted seed/service-role writes are allowed to preserve legacy data
  -- loading and administrative operations.
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    requires_verification := true;
  ELSE
    requires_verification := NEW.hdb_verification_token IS NOT NULL
      OR NEW.hdb_verified IS DISTINCT FROM OLD.hdb_verified
      OR NEW.postal_code IS DISTINCT FROM OLD.postal_code
      OR NEW.block_number IS DISTINCT FROM OLD.block_number
      OR NEW.street_name IS DISTINCT FROM OLD.street_name
      OR NEW.location_verified_at IS DISTINCT FROM OLD.location_verified_at
      OR NEW.latitude IS DISTINCT FROM OLD.latitude
      OR NEW.longitude IS DISTINCT FROM OLD.longitude;
  END IF;

  IF NOT requires_verification THEN
    RETURN NEW;
  END IF;

  IF NEW.hdb_verification_token IS NULL THEN
    RAISE EXCEPTION 'A current HDB postal-code verification is required';
  END IF;

  SELECT * INTO verification
  FROM public.hdb_location_verifications
  WHERE token = NEW.hdb_verification_token
    AND seller_id = NEW.seller_id
    AND expires_at > now();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'The HDB postal-code verification is invalid or expired';
  END IF;

  NEW.postal_code := verification.postal_code;
  NEW.block_number := verification.block_number;
  NEW.street_name := verification.street_name;
  NEW.location := COALESCE(NULLIF(verification.town, ''), 'PENDING');
  NEW.town := NULLIF(verification.town, '');
  NEW.built_year := verification.built_year;
  NEW.latitude := verification.latitude;
  NEW.longitude := verification.longitude;
  NEW.hdb_verified := true;
  NEW.location_verified_at := verification.verified_at;
  NEW.hdb_verification_token := NULL;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS apply_hdb_location_verification_trigger ON public.properties;
CREATE TRIGGER apply_hdb_location_verification_trigger
  BEFORE INSERT OR UPDATE ON public.properties
  FOR EACH ROW
  EXECUTE FUNCTION public.apply_hdb_location_verification();
