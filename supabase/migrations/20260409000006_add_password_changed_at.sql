-- Add password_changed_at to users table for HIPAA password expiry enforcement
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS password_changed_at timestamptz DEFAULT now();

-- Seed existing users with now() so they aren't immediately expired
UPDATE public.users
  SET password_changed_at = now()
  WHERE password_changed_at IS NULL;

-- Update handle_new_user() trigger to set password_changed_at on insert
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (id, username, password_changed_at)
  VALUES (new.id, new.raw_user_meta_data->>'username', now())
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$;
