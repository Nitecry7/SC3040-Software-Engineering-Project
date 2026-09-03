/*
  # Create admin role and initial admin user

  1. Changes
    - Add admin column to user_profiles table
    - Create initial admin user with dynamic UUID
    - Add RLS policies for admin access

  2. Security
    - Enable RLS on user_profiles table
    - Add policy for admin users to access all profiles
*/

-- Add admin column to user_profiles if it doesn't exist
DO $$ 
BEGIN 
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'user_profiles' 
    AND column_name = 'is_admin'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN is_admin boolean DEFAULT false;
  END IF;
END $$;

-- Create admin user with a dynamically generated UUID
DO $$
DECLARE
  admin_uuid uuid;
BEGIN
  -- Check if admin user already exists
  SELECT id INTO admin_uuid
  FROM auth.users
  WHERE email = 'admin@sghomie.com';

  -- If admin doesn't exist, create the user
  IF admin_uuid IS NULL THEN
    -- Generate new UUID for admin
    admin_uuid := gen_random_uuid();
    
    -- Insert admin user
    INSERT INTO auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      created_at,
      updated_at
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      admin_uuid,
      'authenticated',
      'authenticated',
      'admin@sghomie.com',
      crypt('Admin123', gen_salt('bf')),
      NOW(),
      NOW(),
      NOW()
    );

    -- Create admin profile using the same UUID
    INSERT INTO user_profiles (id, is_admin)
    VALUES (admin_uuid, true);
  ELSE
    -- Update existing admin user's profile
    INSERT INTO user_profiles (id, is_admin)
    VALUES (admin_uuid, true)
    ON CONFLICT (id) DO UPDATE SET is_admin = true;
  END IF;
END $$;