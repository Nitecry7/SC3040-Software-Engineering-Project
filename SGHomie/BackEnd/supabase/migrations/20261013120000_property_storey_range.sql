/*
  Preserve the observed storey range for deterministic local demo fixtures.
  storey_mid remains the model-facing value; this column is not a seller input
  contract and is not required for seller_supplied eligibility.
*/

ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS storey_range text;

ALTER TABLE public.properties
  DROP CONSTRAINT IF EXISTS properties_storey_range_check;

ALTER TABLE public.properties
  ADD CONSTRAINT properties_storey_range_check
    CHECK (
      storey_range IS NULL
      OR CASE
        WHEN storey_range ~ '^[0-9]{2} TO [0-9]{2}$' THEN
          substring(storey_range FROM 1 FOR 2)::integer BETWEEN 1 AND 99
          AND substring(storey_range FROM 7 FOR 2)::integer BETWEEN 1 AND 99
          AND substring(storey_range FROM 1 FOR 2)::integer <= substring(storey_range FROM 7 FOR 2)::integer
          AND (
            storey_mid IS NULL
            OR storey_mid = (
              substring(storey_range FROM 1 FOR 2)::numeric
              + substring(storey_range FROM 7 FOR 2)::numeric
            ) / 2
          )
        ELSE false
      END
    );
