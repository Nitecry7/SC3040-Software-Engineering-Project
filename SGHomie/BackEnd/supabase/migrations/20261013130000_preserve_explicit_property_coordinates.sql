/*
  Keep complete coordinates supplied by a trusted write. The town centroid is
  only a fallback when an inserted/updated row lacks one or when the location
  changes without a corresponding coordinate change.
*/

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
