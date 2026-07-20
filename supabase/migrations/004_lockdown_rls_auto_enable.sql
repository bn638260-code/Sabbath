-- SabbathCue: lock down public.rls_auto_enable() flagged by the Supabase linter.
-- Apply via Supabase SQL Editor AFTER 003_register_device_race_fix.sql.
--
-- This function is not part of the app (it does not appear in this repo); it
-- was created directly in the project, likely by a dashboard snippet that
-- auto-enables RLS on new tables. As a SECURITY DEFINER function executable by
-- `anon`, it is callable by anyone on the internet without signing in via
-- /rest/v1/rpc/rls_auto_enable. The app never calls it, so revoke all API
-- access. It remains usable by the owner (e.g. as an event-trigger helper).
--
-- Before running, you can inspect what it does with:
--   SELECT prosrc FROM pg_proc
--   WHERE proname = 'rls_auto_enable'
--     AND pronamespace = 'public'::regnamespace;
-- If it turns out to be unused entirely, prefer dropping it:
--   DROP FUNCTION public.rls_auto_enable();
-- (If that fails because an event trigger depends on it, keep the revokes.)

DO $$
BEGIN
  IF to_regprocedure('public.rls_auto_enable()') IS NOT NULL THEN
    EXECUTE 'REVOKE ALL ON FUNCTION public.rls_auto_enable() FROM PUBLIC, anon, authenticated';
  END IF;
END;
$$;
