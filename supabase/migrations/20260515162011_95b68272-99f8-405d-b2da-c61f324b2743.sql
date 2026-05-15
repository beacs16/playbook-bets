
-- 1. Profiles: prevent balance tampering on UPDATE
DROP POLICY IF EXISTS "Users update own profile" ON public.profiles;
CREATE POLICY "Users update own profile"
ON public.profiles
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (
  auth.uid() = user_id
  AND balance = (SELECT balance FROM public.profiles WHERE user_id = auth.uid())
);

-- 2. Profiles: prevent balance tampering on INSERT
-- Profile rows are created by the handle_new_user trigger (SECURITY DEFINER).
-- Remove the client-side INSERT policy so users cannot set arbitrary balance.
DROP POLICY IF EXISTS "Users insert own profile" ON public.profiles;

-- 3. Lock down SECURITY DEFINER functions
-- handle_new_user is a trigger function; revoke direct execute access.
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- place_bet must remain callable by authenticated users (that's its purpose),
-- but should not be exposed to anon.
REVOKE EXECUTE ON FUNCTION public.place_bet(uuid, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.place_bet(uuid, numeric) TO authenticated;
