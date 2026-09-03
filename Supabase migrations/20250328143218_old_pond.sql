-- Add phone column to user_profiles if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'user_profiles' AND column_name = 'phone'
  ) THEN
    ALTER TABLE user_profiles
    ADD COLUMN phone text;
  END IF;
END $$;

-- Add rejection_reason column to properties if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'properties' AND column_name = 'rejection_reason'
  ) THEN
    ALTER TABLE properties
    ADD COLUMN rejection_reason text;
  END IF;
END $$;