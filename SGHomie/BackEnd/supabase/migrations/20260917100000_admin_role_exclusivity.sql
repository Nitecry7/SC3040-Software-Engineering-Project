-- Administrators and sellers are separate application roles. An admin must
-- not be able to register as a seller, even if the client is bypassed.

UPDATE public.user_profiles
SET is_seller = false
WHERE is_admin = true
  AND is_seller = true;

CREATE OR REPLACE FUNCTION public.prevent_admin_seller_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.is_admin = true AND NEW.is_seller = true THEN
    RAISE EXCEPTION 'An administrator cannot also be a seller';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_admin_seller_role_trigger ON public.user_profiles;

CREATE TRIGGER prevent_admin_seller_role_trigger
  BEFORE INSERT OR UPDATE OF is_admin, is_seller ON public.user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_admin_seller_role();
