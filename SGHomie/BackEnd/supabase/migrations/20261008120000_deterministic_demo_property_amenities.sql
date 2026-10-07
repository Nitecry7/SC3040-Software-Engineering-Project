-- Demo-only nearby amenities. Remove the property trigger when real amenity
-- ingestion becomes authoritative; real records should use their own source.

ALTER TABLE public.property_amenities
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'legacy';

-- These exact rows are the placeholders created by the historical random
-- trigger. Other pre-existing rows remain classified as legacy.
UPDATE public.property_amenities
SET source = 'demo'
WHERE source = 'legacy'
  AND (name, type) IN (
    ('Nearest MRT Station', 'Transport'),
    ('Shopping Mall', 'Shopping'),
    ('Neighbourhood Park', 'Park')
  );

-- If the old demo trigger was manually replayed, retain one recognized legacy
-- placeholder per property/category so the demo-only index can be installed.
WITH ranked_placeholders AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY property_id, type
      ORDER BY created_at, id
    ) AS placeholder_rank
  FROM public.property_amenities
  WHERE source = 'demo'
    AND (name, type) IN (
      ('Nearest MRT Station', 'Transport'),
      ('Shopping Mall', 'Shopping'),
      ('Neighbourhood Park', 'Park')
    )
)
DELETE FROM public.property_amenities
USING ranked_placeholders
WHERE property_amenities.id = ranked_placeholders.id
  AND ranked_placeholders.placeholder_rank > 1;

-- A property may have one generated demo amenity per category. This does not
-- constrain real sources, which can contain multiple amenities per type.
CREATE UNIQUE INDEX IF NOT EXISTS property_amenities_demo_category_key
  ON public.property_amenities (property_id, type)
  WHERE source = 'demo';

CREATE OR REPLACE FUNCTION public.generate_demo_property_amenities(
  p_property_id uuid,
  p_property_latitude numeric,
  p_property_longitude numeric
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
BEGIN
  IF p_property_id IS NULL
     OR p_property_latitude IS NULL
     OR p_property_longitude IS NULL
     OR p_property_latitude::text IN ('NaN', 'Infinity', '-Infinity')
     OR p_property_longitude::text IN ('NaN', 'Infinity', '-Infinity')
     OR p_property_latitude NOT BETWEEN 1.0 AND 1.6
     OR p_property_longitude NOT BETWEEN 103.4 AND 104.4 THEN
    RETURN;
  END IF;

  WITH categories (amenity_type, amenity_name) AS (
    VALUES
      ('Transport', 'Nearby MRT/LRT'),
      ('School', 'Nearby Primary School'),
      ('Shopping', 'Nearby Shopping Centre'),
      ('Healthcare', 'Nearby Clinic'),
      ('Food', 'Nearby Food Centre'),
      ('Park', 'Nearby Park'),
      ('Community', 'Nearby Community Club')
  ),
  offsets AS (
    SELECT
      categories.amenity_type,
      categories.amenity_name,
      (100 + mod(abs(hashtextextended(
        p_property_id::text || ':' || categories.amenity_type || ':distance', 42
      )::numeric), 1401))::double precision AS distance_metres,
      (mod(abs(hashtextextended(
        p_property_id::text || ':' || categories.amenity_type || ':bearing', 42
      )::numeric), 36000)::double precision / 100.0) * pi() / 180.0 AS bearing_radians,
      radians(p_property_latitude::double precision) AS origin_latitude,
      radians(p_property_longitude::double precision) AS origin_longitude
    FROM categories
  ),
  destination AS (
    SELECT
      amenity_type,
      amenity_name,
      origin_latitude,
      origin_longitude,
      radians(distance_metres / 6371000.0) AS angular_distance,
      bearing_radians,
      round(degrees(asin(
        sin(origin_latitude) * cos(radians(distance_metres / 6371000.0))
        + cos(origin_latitude) * sin(radians(distance_metres / 6371000.0))
        * cos(bearing_radians)
      ))::numeric, 7) AS amenity_latitude
    FROM offsets
  ),
  positioned AS (
    SELECT
      amenity_type,
      amenity_name,
      amenity_latitude,
      round(degrees(
        origin_longitude + atan2(
          sin(bearing_radians) * sin(angular_distance) * cos(origin_latitude),
          cos(angular_distance) - sin(origin_latitude)
            * sin(radians(amenity_latitude::double precision))
        )
      )::numeric, 7) AS amenity_longitude
    FROM destination
  ),
  measured AS (
    SELECT
      amenity_type,
      amenity_name,
      amenity_latitude,
      amenity_longitude,
      round((2 * 6371.0 * asin(sqrt(
        power(sin(radians(
          (amenity_latitude - p_property_latitude)::double precision
        ) / 2), 2)
        + cos(radians(p_property_latitude::double precision))
          * cos(radians(amenity_latitude::double precision))
          * power(sin(radians(
            (amenity_longitude - p_property_longitude)::double precision
          ) / 2), 2)
      )))::numeric, 6) AS distance_km
    FROM positioned
  )
  INSERT INTO public.property_amenities
    (property_id, name, type, distance, latitude, longitude, source)
  SELECT
    p_property_id,
    amenity_name,
    amenity_type,
    distance_km,
    amenity_latitude,
    amenity_longitude,
    'demo'
  FROM measured
  ON CONFLICT (property_id, type) WHERE source = 'demo'
  DO UPDATE SET
    name = EXCLUDED.name,
    distance = EXCLUDED.distance,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude;
END;
$$;

REVOKE ALL ON FUNCTION public.generate_demo_property_amenities(uuid, numeric, numeric)
  FROM PUBLIC, anon, authenticated;

-- Replace the old random trigger. The helper no-ops for missing, non-finite,
-- or out-of-bounds coordinates, and never modifies the property row.
CREATE OR REPLACE FUNCTION public.add_default_amenities()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
BEGIN
  PERFORM public.generate_demo_property_amenities(
    NEW.id, NEW.latitude, NEW.longitude
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS add_amenities_trigger ON public.properties;
CREATE TRIGGER add_amenities_trigger
  AFTER INSERT ON public.properties
  FOR EACH ROW
  EXECUTE FUNCTION public.add_default_amenities();

-- Regenerate only the exact legacy placeholders, then fill properties that
-- have no amenity rows at all. Unknown and non-demo rows are never deleted.
DO $$
DECLARE
  target record;
BEGIN
  FOR target IN
    SELECT DISTINCT properties.id, properties.latitude, properties.longitude
    FROM public.properties
    JOIN public.property_amenities
      ON property_amenities.property_id = properties.id
    WHERE property_amenities.source = 'demo'
  LOOP
    PERFORM public.generate_demo_property_amenities(
      target.id, target.latitude, target.longitude
    );
  END LOOP;

  FOR target IN
    SELECT properties.id, properties.latitude, properties.longitude
    FROM public.properties
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.property_amenities
      WHERE property_amenities.property_id = properties.id
    )
      AND properties.latitude IS NOT NULL
      AND properties.longitude IS NOT NULL
      AND properties.latitude::text NOT IN ('NaN', 'Infinity', '-Infinity')
      AND properties.longitude::text NOT IN ('NaN', 'Infinity', '-Infinity')
      AND properties.latitude BETWEEN 1.0 AND 1.6
      AND properties.longitude BETWEEN 103.4 AND 104.4
  LOOP
    PERFORM public.generate_demo_property_amenities(
      target.id, target.latitude, target.longitude
    );
  END LOOP;
END;
$$;
