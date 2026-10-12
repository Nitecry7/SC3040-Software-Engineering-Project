/*
  Correct the demo valuation invariant for synthetic hosted listings whose
  seller/account IDs are legitimate fixture ownership metadata. The applied
  batch provenance migration is preserved; only its demo completeness check
  is replaced here.
*/

ALTER TABLE public.properties
  DROP CONSTRAINT IF EXISTS properties_demo_valuation_inputs_check;

ALTER TABLE public.properties
  ADD CONSTRAINT properties_demo_valuation_inputs_check
    CHECK (
      valuation_inputs_source <> 'demo'
      OR (
        demo_batch_id IS NOT NULL
        AND demo_batch_id IN (
          'sghomie-test-2026-10-07-2e3e55',
          'sghomie-test-2026-10-07-extra30-12f05f'
        )
        AND status = 'approved'
        AND flat_type IS NOT NULL
        AND length(flat_type) <= 40
        AND flat_type ~ '[^[:space:]]'
        AND flat_model IS NOT NULL
        AND length(flat_model) <= 100
        AND flat_model ~ '[^[:space:]]'
        AND storey_range IS NOT NULL
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
      )
    );
