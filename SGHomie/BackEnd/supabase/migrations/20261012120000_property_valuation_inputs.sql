/*
  Structured inputs for the frozen HDB valuation contract.

  Existing properties remain incomplete. The source default labels existing and
  future unspecified rows as legacy; this migration does not populate model
  inputs or change HDB verification state.
*/

ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS flat_type text,
  ADD COLUMN IF NOT EXISTS flat_model text,
  ADD COLUMN IF NOT EXISTS storey_mid numeric,
  ADD COLUMN IF NOT EXISTS remaining_lease_months integer,
  ADD COLUMN IF NOT EXISTS remaining_lease_as_of_month date,
  ADD COLUMN IF NOT EXISTS valuation_inputs_source text NOT NULL DEFAULT 'legacy';

ALTER TABLE public.properties
  DROP CONSTRAINT IF EXISTS properties_valuation_inputs_source_check,
  DROP CONSTRAINT IF EXISTS properties_flat_type_check,
  DROP CONSTRAINT IF EXISTS properties_flat_model_check,
  DROP CONSTRAINT IF EXISTS properties_storey_mid_check,
  DROP CONSTRAINT IF EXISTS properties_remaining_lease_months_check,
  DROP CONSTRAINT IF EXISTS properties_remaining_lease_as_of_month_check,
  DROP CONSTRAINT IF EXISTS properties_demo_valuation_inputs_check;

ALTER TABLE public.properties
  ADD CONSTRAINT properties_valuation_inputs_source_check
    CHECK (valuation_inputs_source IN ('legacy', 'demo', 'seller_supplied')),
  ADD CONSTRAINT properties_flat_type_check
    CHECK (flat_type IS NULL OR (length(flat_type) <= 40 AND flat_type ~ '[^[:space:]]')),
  ADD CONSTRAINT properties_flat_model_check
    CHECK (flat_model IS NULL OR (length(flat_model) <= 100 AND flat_model ~ '[^[:space:]]')),
  ADD CONSTRAINT properties_storey_mid_check
    CHECK (storey_mid IS NULL OR storey_mid BETWEEN 1 AND 100),
  ADD CONSTRAINT properties_remaining_lease_months_check
    CHECK (remaining_lease_months IS NULL OR remaining_lease_months BETWEEN 1 AND 1200),
  ADD CONSTRAINT properties_remaining_lease_as_of_month_check
    CHECK (
      remaining_lease_as_of_month IS NULL
      OR date_trunc('month', remaining_lease_as_of_month)::date = remaining_lease_as_of_month
    ),
  ADD CONSTRAINT properties_demo_valuation_inputs_check
    CHECK (
      valuation_inputs_source <> 'demo'
      OR (
        flat_type IS NOT NULL
        AND length(flat_type) <= 40
        AND flat_type ~ '[^[:space:]]'
        AND flat_model IS NOT NULL
        AND length(flat_model) <= 100
        AND flat_model ~ '[^[:space:]]'
        AND storey_mid IS NOT NULL
        AND storey_mid BETWEEN 1 AND 100
        AND remaining_lease_months IS NOT NULL
        AND remaining_lease_months BETWEEN 1 AND 1200
        AND remaining_lease_as_of_month IS NOT NULL
        AND date_trunc('month', remaining_lease_as_of_month)::date = remaining_lease_as_of_month
        AND town IS NOT NULL
        AND length(town) <= 100
        AND town ~ '[^[:space:]]'
        AND block_number IS NOT NULL
        AND length(block_number) <= 20
        AND block_number ~ '[^[:space:]]'
        AND street_name IS NOT NULL
        AND length(street_name) <= 120
        AND street_name ~ '[^[:space:]]'
        AND area_sqft > 0
        AND hdb_verified = false
      )
    );
