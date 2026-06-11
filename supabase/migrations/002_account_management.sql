-- SabbathCue account management: suspension, self-delete, creator admin RPCs.
-- Apply via Supabase SQL Editor AFTER 001_devices_and_register_rpc.sql.
--
-- IMPORTANT (one-time operator step): after applying, register yourself as admin:
--   insert into public.app_admins (user_id)
--   select id from auth.users where email = 'bonga6557@gmail.com'
--   on conflict do nothing;

-- Admins: accounts allowed to call admin_* RPCs.
CREATE TABLE IF NOT EXISTS public.app_admins (
  user_id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.app_admins ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS admins_read_own_row ON public.app_admins;
CREATE POLICY admins_read_own_row
  ON public.app_admins
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Suspension flags (absence of a row = active account).
CREATE TABLE IF NOT EXISTS public.account_flags (
  user_id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  suspended boolean NOT NULL DEFAULT false,
  suspended_at timestamptz,
  suspend_reason text
);

ALTER TABLE public.account_flags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS users_read_own_flags ON public.account_flags;
CREATE POLICY users_read_own_flags
  ON public.account_flags
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.is_app_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.app_admins WHERE user_id = auth.uid()
  );
$$;

-- register_device v2: suspended accounts are blocked before any device write.
CREATE OR REPLACE FUNCTION public.register_device(
  p_device_id text,
  p_os text DEFAULT NULL,
  p_app_version text DEFAULT NULL,
  p_label text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_device_count integer;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated'
      USING ERRCODE = '28000';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.account_flags
    WHERE user_id = v_user_id AND suspended
  ) THEN
    RETURN jsonb_build_object('status', 'suspended');
  END IF;

  IF p_device_id IS NULL OR btrim(p_device_id) = '' THEN
    RAISE EXCEPTION 'device_id is required'
      USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.devices
    WHERE user_id = v_user_id
      AND device_id = p_device_id
  ) THEN
    UPDATE public.devices
    SET
      last_seen_at = now(),
      os = COALESCE(p_os, os),
      app_version = COALESCE(p_app_version, app_version),
      label = COALESCE(p_label, label)
    WHERE user_id = v_user_id
      AND device_id = p_device_id;

    RETURN jsonb_build_object('status', 'ok');
  END IF;

  SELECT count(*)::integer
  INTO v_device_count
  FROM public.devices
  WHERE user_id = v_user_id;

  IF v_device_count >= 2 THEN
    RETURN jsonb_build_object('status', 'device_limit_reached');
  END IF;

  INSERT INTO public.devices (user_id, device_id, os, app_version, label)
  VALUES (v_user_id, p_device_id, p_os, p_app_version, p_label);

  RETURN jsonb_build_object('status', 'ok');
END;
$$;

-- Self-service: permanently delete the calling user's own account.
-- Cascades remove devices and account_flags rows.
CREATE OR REPLACE FUNCTION public.delete_own_account()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated'
      USING ERRCODE = '28000';
  END IF;

  -- Admins must be demoted (row removed from app_admins) before self-deleting,
  -- so the creator account cannot be destroyed by a stray click.
  IF EXISTS (SELECT 1 FROM public.app_admins WHERE user_id = v_user_id) THEN
    RAISE EXCEPTION 'Admin accounts cannot be self-deleted'
      USING ERRCODE = '42501';
  END IF;

  DELETE FROM auth.users WHERE id = v_user_id;
END;
$$;

-- Admin: list every account with device usage and suspension state.
CREATE OR REPLACE FUNCTION public.admin_list_accounts()
RETURNS TABLE (
  user_id uuid,
  email text,
  created_at timestamptz,
  suspended boolean,
  suspend_reason text,
  device_count bigint,
  last_seen_at timestamptz,
  is_admin boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.app_admins a WHERE a.user_id = auth.uid()) THEN
    RAISE EXCEPTION 'Admin access required'
      USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    u.id,
    u.email::text,
    u.created_at,
    COALESCE(f.suspended, false),
    f.suspend_reason,
    count(d.id),
    max(d.last_seen_at),
    EXISTS (SELECT 1 FROM public.app_admins a WHERE a.user_id = u.id)
  FROM auth.users u
  LEFT JOIN public.account_flags f ON f.user_id = u.id
  LEFT JOIN public.devices d ON d.user_id = u.id
  GROUP BY u.id, u.email, u.created_at, f.suspended, f.suspend_reason
  ORDER BY u.created_at DESC;
END;
$$;

-- Admin: suspend or reinstate an account. Admin accounts cannot be suspended.
CREATE OR REPLACE FUNCTION public.admin_set_suspended(
  p_user_id uuid,
  p_suspended boolean,
  p_reason text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.app_admins WHERE user_id = auth.uid()) THEN
    RAISE EXCEPTION 'Admin access required'
      USING ERRCODE = '42501';
  END IF;

  IF EXISTS (SELECT 1 FROM public.app_admins WHERE user_id = p_user_id) THEN
    RAISE EXCEPTION 'Admin accounts cannot be suspended'
      USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.account_flags (user_id, suspended, suspended_at, suspend_reason)
  VALUES (
    p_user_id,
    p_suspended,
    CASE WHEN p_suspended THEN now() ELSE NULL END,
    CASE WHEN p_suspended THEN p_reason ELSE NULL END
  )
  ON CONFLICT (user_id) DO UPDATE SET
    suspended = EXCLUDED.suspended,
    suspended_at = EXCLUDED.suspended_at,
    suspend_reason = EXCLUDED.suspend_reason;
END;
$$;

-- Admin: permanently delete another account. Admin accounts are protected.
CREATE OR REPLACE FUNCTION public.admin_delete_account(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.app_admins WHERE user_id = auth.uid()) THEN
    RAISE EXCEPTION 'Admin access required'
      USING ERRCODE = '42501';
  END IF;

  IF EXISTS (SELECT 1 FROM public.app_admins WHERE user_id = p_user_id) THEN
    RAISE EXCEPTION 'Admin accounts cannot be deleted'
      USING ERRCODE = '42501';
  END IF;

  DELETE FROM auth.users WHERE id = p_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.is_app_admin() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.delete_own_account() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_list_accounts() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_set_suspended(uuid, boolean, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_delete_account(uuid) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.is_app_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_own_account() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_accounts() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_suspended(uuid, boolean, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_delete_account(uuid) TO authenticated;
