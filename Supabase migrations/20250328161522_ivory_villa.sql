-- Create a function to automatically add amenities when a property is created
CREATE OR REPLACE FUNCTION add_default_amenities()
RETURNS TRIGGER AS $$
BEGIN
  -- Add MRT Station
  INSERT INTO property_amenities (
    id, property_id, name, type, distance, latitude, longitude
  ) VALUES (
    gen_random_uuid(),
    NEW.id,
    'Nearest MRT Station',
    'Transport',
    round((random() * 0.5 + 0.2)::numeric, 2),
    NEW.latitude + (random() * 0.002 - 0.001),
    NEW.longitude + (random() * 0.002 - 0.001)
  );

  -- Add Shopping Mall
  INSERT INTO property_amenities (
    id, property_id, name, type, distance, latitude, longitude
  ) VALUES (
    gen_random_uuid(),
    NEW.id,
    'Shopping Mall',
    'Shopping',
    round((random() * 0.8 + 0.3)::numeric, 2),
    NEW.latitude + (random() * 0.002 - 0.001),
    NEW.longitude + (random() * 0.002 - 0.001)
  );

  -- Add Park
  INSERT INTO property_amenities (
    id, property_id, name, type, distance, latitude, longitude
  ) VALUES (
    gen_random_uuid(),
    NEW.id,
    'Neighborhood Park',
    'Park',
    round((random() * 0.4 + 0.1)::numeric, 2),
    NEW.latitude + (random() * 0.002 - 0.001),
    NEW.longitude + (random() * 0.002 - 0.001)
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create the trigger
DROP TRIGGER IF EXISTS add_amenities_trigger ON properties;
CREATE TRIGGER add_amenities_trigger
  AFTER INSERT ON properties
  FOR EACH ROW
  EXECUTE FUNCTION add_default_amenities();

-- Set default coordinates for Singapore regions
CREATE OR REPLACE FUNCTION get_location_coordinates(location_name text)
RETURNS TABLE (lat numeric, lng numeric) AS $$
BEGIN
  RETURN QUERY
  SELECT
    CASE location_name
      WHEN 'ANG MO KIO' THEN 1.3691
      WHEN 'BEDOK' THEN 1.3236
      WHEN 'BISHAN' THEN 1.3526
      WHEN 'BUKIT BATOK' THEN 1.3590
      WHEN 'BUKIT MERAH' THEN 1.2819
      WHEN 'BUKIT PANJANG' THEN 1.3774
      WHEN 'BUKIT TIMAH' THEN 1.3294
      WHEN 'CENTRAL AREA' THEN 1.3048
      WHEN 'CHOA CHU KANG' THEN 1.3840
      WHEN 'CLEMENTI' THEN 1.3162
      WHEN 'GEYLANG' THEN 1.3201
      WHEN 'HOUGANG' THEN 1.3612
      WHEN 'JURONG EAST' THEN 1.3329
      WHEN 'JURONG WEST' THEN 1.3404
      WHEN 'KALLANG/WHAMPOA' THEN 1.3100
      WHEN 'MARINE PARADE' THEN 1.3028
      WHEN 'PASIR RIS' THEN 1.3721
      WHEN 'PUNGGOL' THEN 1.3984
      WHEN 'QUEENSTOWN' THEN 1.2942
      WHEN 'SEMBAWANG' THEN 1.4491
      WHEN 'SENGKANG' THEN 1.3868
      WHEN 'SERANGOON' THEN 1.3554
      WHEN 'TAMPINES' THEN 1.3496
      WHEN 'TOA PAYOH' THEN 1.3343
      WHEN 'WOODLANDS' THEN 1.4382
      WHEN 'YISHUN' THEN 1.4304
      ELSE 1.3521
    END as lat,
    CASE location_name
      WHEN 'ANG MO KIO' THEN 103.8454
      WHEN 'BEDOK' THEN 103.9273
      WHEN 'BISHAN' THEN 103.8352
      WHEN 'BUKIT BATOK' THEN 103.7637
      WHEN 'BUKIT MERAH' THEN 103.8239
      WHEN 'BUKIT PANJANG' THEN 103.7719
      WHEN 'BUKIT TIMAH' THEN 103.8021
      WHEN 'CENTRAL AREA' THEN 103.8318
      WHEN 'CHOA CHU KANG' THEN 103.7470
      WHEN 'CLEMENTI' THEN 103.7649
      WHEN 'GEYLANG' THEN 103.8918
      WHEN 'HOUGANG' THEN 103.8863
      WHEN 'JURONG EAST' THEN 103.7436
      WHEN 'JURONG WEST' THEN 103.7090
      WHEN 'KALLANG/WHAMPOA' THEN 103.8651
      WHEN 'MARINE PARADE' THEN 103.9074
      WHEN 'PASIR RIS' THEN 103.9493
      WHEN 'PUNGGOL' THEN 103.9068
      WHEN 'QUEENSTOWN' THEN 103.7861
      WHEN 'SEMBAWANG' THEN 103.8185
      WHEN 'SENGKANG' THEN 103.8914
      WHEN 'SERANGOON' THEN 103.8679
      WHEN 'TAMPINES' THEN 103.9454
      WHEN 'TOA PAYOH' THEN 103.8563
      WHEN 'WOODLANDS' THEN 103.7886
      WHEN 'YISHUN' THEN 103.8354
      ELSE 103.8198
    END as lng;
END;
$$ LANGUAGE plpgsql;

-- Create a trigger to automatically set coordinates based on location
CREATE OR REPLACE FUNCTION set_location_coordinates()
RETURNS TRIGGER AS $$
DECLARE
  coords record;
BEGIN
  SELECT * INTO coords FROM get_location_coordinates(NEW.location);
  NEW.latitude := coords.lat;
  NEW.longitude := coords.lng;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create the trigger
DROP TRIGGER IF EXISTS set_coordinates_trigger ON properties;
CREATE TRIGGER set_coordinates_trigger
  BEFORE INSERT ON properties
  FOR EACH ROW
  EXECUTE FUNCTION set_location_coordinates();