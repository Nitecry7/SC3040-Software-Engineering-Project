/*
  Public listing column contract.

  Callers who are not signed in (the anon role) can read only an explicit
  allow-list of columns on public.properties. The row policy is unchanged and
  still limits those callers to approved rows. Signed-in access
  (authenticated, service_role) is unchanged.

  Allow-list, derived from the queries that run without a signed-in user:
    home page featured listings  id, image_url, title, type, price, location,
                                 bedrooms, bathrooms, area_sqft (order by created_at)
    listing counts and chatbot   id, town, location (filter on status and type,
    onboarding                   order by id)
    new-listing notice           id, location

  Every other column, including any column added later, is not readable by
  anon until it is granted explicitly here or in a later migration.

  Revoking the table-level privilege also removes any column-level privilege
  that anon already holds, so the grant below defines the complete set.
*/

REVOKE SELECT ON public.properties FROM anon;

GRANT SELECT (
  id,
  title,
  price,
  location,
  town,
  type,
  image_url,
  bedrooms,
  bathrooms,
  area_sqft,
  status,
  created_at
) ON public.properties TO anon;
