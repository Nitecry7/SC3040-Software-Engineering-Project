-- Local development seed data only.
--
-- This file is loaded by `supabase db reset` and is never pushed by
-- `supabase db push`. Keep demo data here so a hosted database starts empty.
-- The property trigger creates the default nearby amenities automatically.

INSERT INTO public.properties (
  title,
  price,
  location,
  type,
  image_url,
  bedrooms,
  bathrooms,
  area_sqft,
  description,
  detailed_location,
  town,
  seller_name,
  seller_phone,
  built_year,
  photos,
  status
) VALUES
(
  'Cozy 4-Room HDB in Tampines',
  550000,
  'TAMPINES',
  'HDB',
  'https://images.unsplash.com/photo-1568605114967-8130f3a36994?auto=format&fit=crop&w=1200&q=80',
  4,
  2,
  1100,
  'Beautiful 4-room HDB with excellent amenities nearby',
  'Block 123 Tampines Street 11',
  'TAMPINES',
  'Demo Seller',
  '+65 9000 0001',
  2010,
  ARRAY[
    'https://images.unsplash.com/photo-1568605114967-8130f3a36994?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?auto=format&fit=crop&w=1200&q=80'
  ],
  'approved'
),
(
  'Spacious 5-Room HDB in Woodlands',
  620000,
  'WOODLANDS',
  'HDB',
  'https://images.unsplash.com/photo-1560449752-094a9f0e0abe?auto=format&fit=crop&w=1200&q=80',
  5,
  2,
  1300,
  'Renovated 5-room HDB with modern fixtures',
  'Block 456 Woodlands Drive 16',
  'WOODLANDS',
  'Demo Seller',
  '+65 9000 0002',
  2015,
  ARRAY[
    'https://images.unsplash.com/photo-1560449752-094a9f0e0abe?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1560185893-a55cbc8c57e8?auto=format&fit=crop&w=1200&q=80'
  ],
  'approved'
),
(
  'Charming 3-Room HDB in Bedok',
  450000,
  'BEDOK',
  'HDB',
  'https://images.unsplash.com/photo-1560185127-6ed189bf02f4?auto=format&fit=crop&w=1200&q=80',
  3,
  2,
  800,
  'Well-maintained 3-room HDB near Bedok MRT',
  'Block 789 Bedok North Road',
  'BEDOK',
  'Demo Seller',
  '+65 9000 0003',
  2008,
  ARRAY[
    'https://images.unsplash.com/photo-1560185127-6ed189bf02f4?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1560185007-cde436f6a4d0?auto=format&fit=crop&w=1200&q=80'
  ],
  'approved'
),
(
  'Cozy 3-Room Flat in Ang Mo Kio Central',
  380000,
  'ANG MO KIO',
  'HDB',
  'https://images.unsplash.com/photo-1560448075-bb485b067938?auto=format&fit=crop&w=800&q=80',
  3,
  2,
  721,
  'Well-maintained 3-room flat with modern renovations. Near amenities and transportation.',
  'Block 556 Ang Mo Kio Avenue 10',
  'ANG MO KIO',
  'Demo Seller',
  '+65 9000 0004',
  1980,
  ARRAY[
    'https://images.unsplash.com/photo-1560448075-bb485b067938?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1560448082-4d5ae885a1d2?auto=format&fit=crop&w=800&q=80'
  ],
  'approved'
),
(
  'Spacious 4-Room with City View',
  520000,
  'ANG MO KIO',
  'HDB',
  'https://images.unsplash.com/photo-1560449016-39c6291d4dd8?auto=format&fit=crop&w=800&q=80',
  4,
  2,
  1001,
  'High-floor unit with unblocked views. Recently renovated with quality finishes.',
  'Block 342 Ang Mo Kio Avenue 1',
  'ANG MO KIO',
  'Demo Seller',
  '+65 9000 0005',
  1985,
  ARRAY[
    'https://images.unsplash.com/photo-1560449016-39c6291d4dd8?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1560449016-b4a3242d7eaa?auto=format&fit=crop&w=800&q=80'
  ],
  'approved'
),
(
  'Modern Executive Apartment in Tampines',
  680000,
  'TAMPINES',
  'HDB',
  'https://images.unsplash.com/photo-1560185127-2e5e53bf4575?auto=format&fit=crop&w=800&q=80',
  5,
  3,
  1453,
  'Luxurious executive apartment with premium renovations. Close to Tampines Mall.',
  'Block 823 Tampines Street 81',
  'TAMPINES',
  'Demo Seller',
  '+65 9000 0006',
  1995,
  ARRAY[
    'https://images.unsplash.com/photo-1560185127-2e5e53bf4575?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1560185127-2e5e53bf4576?auto=format&fit=crop&w=800&q=80'
  ],
  'approved'
),
(
  'Affordable 2-Room Starter Home',
  280000,
  'WOODLANDS',
  'HDB',
  'https://images.unsplash.com/photo-1560185127-6ed189bf02f4?auto=format&fit=crop&w=800&q=80',
  2,
  1,
  485,
  'Perfect starter home for young couples. Well-maintained with good amenities nearby.',
  'Block 167 Woodlands Street 11',
  'WOODLANDS',
  'Demo Seller',
  '+65 9000 0007',
  1990,
  ARRAY['https://images.unsplash.com/photo-1560185127-6ed189bf02f4?auto=format&fit=crop&w=800&q=80'],
  'approved'
),
(
  'Waterfront 4-Room with Balcony',
  550000,
  'PUNGGOL',
  'HDB',
  'https://images.unsplash.com/photo-1560185127-8b0d56ea4954?auto=format&fit=crop&w=800&q=80',
  4,
  2,
  990,
  'Beautiful waterfront unit with unobstructed views. Modern amenities and great location.',
  'Block 268C Punggol Field',
  'PUNGGOL',
  'Demo Seller',
  '+65 9000 0008',
  2015,
  ARRAY[
    'https://images.unsplash.com/photo-1560185127-8b0d56ea4954?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1560185127-8b0d56ea4955?auto=format&fit=crop&w=800&q=80'
  ],
  'approved'
),
(
  'Renovated 3-Room near Bedok Mall',
  420000,
  'BEDOK',
  'HDB',
  'https://images.unsplash.com/photo-1560449015-88a0ca7b9b98?auto=format&fit=crop&w=800&q=80',
  3,
  2,
  750,
  'Fully renovated unit with modern kitchen. Walking distance to Bedok Mall and MRT.',
  'Block 123 Bedok North Street 2',
  'BEDOK',
  'Demo Seller',
  '+65 9000 0009',
  1982,
  ARRAY['https://images.unsplash.com/photo-1560449015-88a0ca7b9b98?auto=format&fit=crop&w=800&q=80'],
  'approved'
);
