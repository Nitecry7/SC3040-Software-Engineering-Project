/*
  Keep verified HDB listings consistent with the verification that set them.

  Invariant: after any write by a signed-in user, a listing with
  hdb_verified = true carries location fields (postal code, block, street,
  location, town, built year, detailed location, coordinates) that match the
  verification token that set them.

  - Once a listing is verified, changing location, built_year or
    detailed_location requires a current verification token. town may be
    resent as the row's own location, which the seller edit form does on every
    save and which cannot move the listing because location is itself guarded.
  - When a token is applied, detailed_location is rebuilt from the token as
    "Block <block_number> <street_name>"; client-supplied text is not stored.
    An absent and an empty detailed location are treated as equal.
  - Coordinates already carried by a verified row are never replaced by a town
    centroid. The centroid fallback remains for unverified rows and for rows
    lacking either coordinate.

  The existing triggers are unchanged. The verification trigger fires first
  (name order), so NEW.hdb_verified already reflects a token applied by the
  same statement when the coordinate trigger runs.
*/

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
      OR NEW.longitude IS DISTINCT FROM OLD.longitude
      OR (
        OLD.hdb_verified
        AND (
          NEW.location IS DISTINCT FROM OLD.location
          OR NEW.built_year IS DISTINCT FROM OLD.built_year
          OR COALESCE(NEW.detailed_location, '') IS DISTINCT FROM COALESCE(OLD.detailed_location, '')
          OR (
            NEW.town IS DISTINCT FROM OLD.town
            AND NEW.town IS DISTINCT FROM NEW.location
          )
        )
      );
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
  NEW.detailed_location := 'Block ' || verification.block_number || ' ' || verification.street_name;
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

CREATE OR REPLACE FUNCTION public.set_location_coordinates()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  coords record;
  needs_fallback boolean := false;
BEGIN
  IF NEW.latitude IS NULL OR NEW.longitude IS NULL THEN
    needs_fallback := true;
  ELSIF TG_OP = 'UPDATE'
    AND NEW.hdb_verified IS NOT TRUE
    AND NEW.location IS DISTINCT FROM OLD.location
    AND NEW.latitude IS NOT DISTINCT FROM OLD.latitude
    AND NEW.longitude IS NOT DISTINCT FROM OLD.longitude THEN
    needs_fallback := true;
  END IF;

  IF needs_fallback THEN
    SELECT * INTO coords
    FROM public.get_location_coordinates(NEW.location);
    NEW.latitude := coords.lat;
    NEW.longitude := coords.lng;
  END IF;

  RETURN NEW;
END;
$$;
