-- Managed device activations: inventory, approval, revocation, and a strict
-- two-approved-device limit. Apply after 008_church_organization_profiles.sql.

ALTER TABLE public.devices
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'approved',
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS revoked_at timestamptz,
  ADD COLUMN IF NOT EXISTS public_key text;

UPDATE public.devices
SET approved_at = COALESCE(approved_at, first_seen_at)
WHERE status = 'approved' AND approved_at IS NULL;

ALTER TABLE public.devices
  DROP CONSTRAINT IF EXISTS devices_status_valid;
ALTER TABLE public.devices
  ADD CONSTRAINT devices_status_valid
  CHECK (status IN ('pending', 'approved', 'revoked'));

CREATE INDEX IF NOT EXISTS devices_user_status_idx
  ON public.devices (user_id, status);

ALTER TABLE public.account_flags
  ADD COLUMN IF NOT EXISTS offline_lease_hours smallint NOT NULL DEFAULT 72;
ALTER TABLE public.account_flags
  DROP CONSTRAINT IF EXISTS account_flags_offline_lease_hours_valid;
ALTER TABLE public.account_flags
  ADD CONSTRAINT account_flags_offline_lease_hours_valid
  CHECK (offline_lease_hours BETWEEN 1 AND 168);

DROP FUNCTION IF EXISTS public.register_device(text, text, text, text);
CREATE FUNCTION public.register_device_verified(
  p_user_id uuid,
  p_device_id text,
  p_os text DEFAULT NULL,
  p_app_version text DEFAULT NULL,
  p_label text DEFAULT NULL,
  p_public_key text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := p_user_id;
  v_existing_status text;
  v_approved_count integer;
  v_access_expires_at timestamptz;
  v_is_admin boolean;
  v_return_access_expires_at timestamptz;
  v_is_church_organization boolean;
  v_church_name text;
  v_offline_lease_hours smallint;
BEGIN
  IF auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'Service role required' USING ERRCODE = '42501';
  END IF;
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'user_id is required' USING ERRCODE = '22023';
  END IF;
  IF p_device_id IS NULL OR btrim(p_device_id) = '' THEN
    RAISE EXCEPTION 'device_id is required' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.account_flags
    WHERE user_id = v_user_id AND suspended
  ) THEN
    RETURN jsonb_build_object('status', 'suspended');
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.app_admins WHERE user_id = v_user_id
  ) INTO v_is_admin;
  SELECT access_expires_at, is_church_organization, church_name, offline_lease_hours
  INTO v_access_expires_at, v_is_church_organization, v_church_name, v_offline_lease_hours
  FROM public.account_flags WHERE user_id = v_user_id;

  IF NOT v_is_admin AND (
    v_access_expires_at IS NULL OR v_access_expires_at <= now()
  ) THEN
    RETURN jsonb_build_object('status', 'trial_expired');
  END IF;

  v_return_access_expires_at := CASE
    WHEN v_is_admin THEN '9999-12-31 23:59:59+00'::timestamptz
    ELSE v_access_expires_at
  END;

  PERFORM pg_advisory_xact_lock(hashtext('register_device:' || v_user_id::text));

  SELECT status INTO v_existing_status
  FROM public.devices
  WHERE user_id = v_user_id AND device_id = p_device_id;

  IF v_existing_status = 'revoked' THEN
    RETURN jsonb_build_object('status', 'device_revoked');
  END IF;
  IF v_existing_status IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.devices
    WHERE user_id = v_user_id AND device_id = p_device_id
      AND public_key IS NOT NULL AND public_key <> p_public_key
  ) THEN
    RETURN jsonb_build_object('status', 'device_identity_mismatch');
  END IF;
  IF v_existing_status = 'pending' THEN
    UPDATE public.devices
    SET last_seen_at = now(), os = COALESCE(p_os, os),
        app_version = COALESCE(p_app_version, app_version),
        label = COALESCE(p_label, label),
        public_key = COALESCE(public_key, p_public_key)
    WHERE user_id = v_user_id AND device_id = p_device_id;
    RETURN jsonb_build_object('status', 'device_pending');
  END IF;
  IF v_existing_status = 'approved' THEN
    UPDATE public.devices
    SET last_seen_at = now(), os = COALESCE(p_os, os),
        app_version = COALESCE(p_app_version, app_version),
        label = COALESCE(p_label, label),
        public_key = COALESCE(public_key, p_public_key)
    WHERE user_id = v_user_id AND device_id = p_device_id;
    RETURN jsonb_build_object(
      'status', 'ok',
      'access_expires_at', v_return_access_expires_at,
      'is_church_organization', COALESCE(v_is_church_organization, false),
      'church_name', v_church_name,
      'offline_lease_hours', COALESCE(v_offline_lease_hours, 72)
    );
  END IF;

  SELECT count(*)::integer INTO v_approved_count
  FROM public.devices
  WHERE user_id = v_user_id AND status = 'approved';

  IF v_approved_count >= 2 THEN
    RETURN jsonb_build_object('status', 'device_limit_reached');
  END IF;

  INSERT INTO public.devices (
    user_id, device_id, os, app_version, label, status, approved_at, public_key
  ) VALUES (
    v_user_id, p_device_id, p_os, p_app_version, p_label,
    CASE WHEN v_approved_count = 0 THEN 'approved' ELSE 'pending' END,
    CASE WHEN v_approved_count = 0 THEN now() ELSE NULL END,
    p_public_key
  );

  IF v_approved_count > 0 THEN
    RETURN jsonb_build_object('status', 'device_pending');
  END IF;

  RETURN jsonb_build_object(
    'status', 'ok',
    'access_expires_at', v_return_access_expires_at,
    'is_church_organization', COALESCE(v_is_church_organization, false),
    'church_name', v_church_name,
    'offline_lease_hours', COALESCE(v_offline_lease_hours, 72)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.approve_device_verified(
  p_user_id uuid,
  p_approver_device_id text,
  p_approver_public_key text,
  p_target_device_id text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_approved_count integer;
BEGIN
  IF auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'Service role required' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.devices
    WHERE user_id = p_user_id AND device_id = p_approver_device_id
      AND status = 'approved' AND public_key = p_approver_public_key
  ) THEN
    RAISE EXCEPTION 'Approved installation proof required' USING ERRCODE = '42501';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtext('register_device:' || p_user_id::text));
  SELECT count(*)::integer INTO v_approved_count
  FROM public.devices
  WHERE user_id = p_user_id AND status = 'approved';
  IF v_approved_count >= 2 THEN
    RAISE EXCEPTION 'Two approved devices already exist' USING ERRCODE = '23514';
  END IF;
  UPDATE public.devices
  SET status = 'approved', approved_at = now(), revoked_at = NULL
  WHERE user_id = p_user_id AND device_id = p_target_device_id
    AND status = 'pending';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pending device not found' USING ERRCODE = 'P0002';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_set_offline_lease_hours(
  p_user_id uuid,
  p_hours integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.app_admins WHERE user_id = auth.uid()) THEN
    RAISE EXCEPTION 'Admin access required' USING ERRCODE = '42501';
  END IF;
  IF p_hours NOT IN (24, 72, 168) THEN
    RAISE EXCEPTION 'hours must be 24, 72, or 168' USING ERRCODE = '22023';
  END IF;
  UPDATE public.account_flags
  SET offline_lease_hours = p_hours
  WHERE user_id = p_user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Account not found' USING ERRCODE = 'P0002';
  END IF;
END;
$$;

DROP FUNCTION IF EXISTS public.admin_list_accounts();
CREATE FUNCTION public.admin_list_accounts()
RETURNS TABLE (
  user_id uuid, email text, created_at timestamptz, suspended boolean,
  suspend_reason text, access_expires_at timestamptz, device_count bigint,
  last_seen_at timestamptz, is_admin boolean, is_church_organization boolean,
  church_name text, offline_lease_hours smallint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.app_admins a WHERE a.user_id = auth.uid()) THEN
    RAISE EXCEPTION 'Admin access required' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  SELECT u.id, u.email::text, u.created_at, COALESCE(f.suspended, false),
    f.suspend_reason, f.access_expires_at,
    count(d.id) FILTER (WHERE d.status = 'approved'),
    max(d.last_seen_at) FILTER (WHERE d.status = 'approved'),
    EXISTS (SELECT 1 FROM public.app_admins a WHERE a.user_id = u.id),
    COALESCE(f.is_church_organization, false), f.church_name,
    COALESCE(f.offline_lease_hours, 72)::smallint
  FROM auth.users u
  LEFT JOIN public.account_flags f ON f.user_id = u.id
  LEFT JOIN public.devices d ON d.user_id = u.id
  GROUP BY u.id, u.email, u.created_at, f.suspended, f.suspend_reason,
    f.access_expires_at, f.is_church_organization, f.church_name,
    f.offline_lease_hours
  ORDER BY u.created_at DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.list_own_devices()
RETURNS TABLE (
  device_id text, os text, app_version text, label text,
  status text, first_seen_at timestamptz, last_seen_at timestamptz,
  approved_at timestamptz, revoked_at timestamptz, public_key text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT d.device_id, d.os, d.app_version, d.label, d.status,
         d.first_seen_at, d.last_seen_at, d.approved_at, d.revoked_at, d.public_key
  FROM public.devices d
  WHERE d.user_id = auth.uid()
  ORDER BY d.last_seen_at DESC;
$$;

CREATE OR REPLACE FUNCTION public.deactivate_own_device(p_device_id text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.devices
  SET status = 'revoked', revoked_at = now()
  WHERE user_id = auth.uid() AND device_id = p_device_id
    AND status <> 'revoked';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Active device not found' USING ERRCODE = 'P0002';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_list_devices(p_user_id uuid)
RETURNS TABLE (
  device_id text, os text, app_version text, label text,
  status text, first_seen_at timestamptz, last_seen_at timestamptz,
  approved_at timestamptz, revoked_at timestamptz, public_key text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.app_admins WHERE user_id = auth.uid()) THEN
    RAISE EXCEPTION 'Admin access required' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  SELECT d.device_id, d.os, d.app_version, d.label, d.status,
         d.first_seen_at, d.last_seen_at, d.approved_at, d.revoked_at, d.public_key
  FROM public.devices d
  WHERE d.user_id = p_user_id
  ORDER BY d.last_seen_at DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_set_device_status(
  p_user_id uuid,
  p_device_id text,
  p_status text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_approved_count integer;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.app_admins WHERE user_id = auth.uid()) THEN
    RAISE EXCEPTION 'Admin access required' USING ERRCODE = '42501';
  END IF;
  IF p_status NOT IN ('approved', 'revoked') THEN
    RAISE EXCEPTION 'status must be approved or revoked' USING ERRCODE = '22023';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtext('register_device:' || p_user_id::text));
  IF p_status = 'approved' THEN
    SELECT count(*)::integer INTO v_approved_count
    FROM public.devices
    WHERE user_id = p_user_id AND status = 'approved'
      AND device_id <> p_device_id;
    IF v_approved_count >= 2 THEN
      RAISE EXCEPTION 'Two approved devices already exist' USING ERRCODE = '23514';
    END IF;
  END IF;
  UPDATE public.devices
  SET status = p_status,
      approved_at = CASE WHEN p_status = 'approved' THEN now() ELSE approved_at END,
      revoked_at = CASE WHEN p_status = 'revoked' THEN now() ELSE NULL END
  WHERE user_id = p_user_id AND device_id = p_device_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Device not found' USING ERRCODE = 'P0002';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.list_own_devices() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.register_device_verified(uuid, text, text, text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.approve_device_verified(uuid, text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.deactivate_own_device(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_list_devices(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_set_device_status(uuid, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_set_offline_lease_hours(uuid, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_list_accounts() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_own_devices() TO authenticated;
GRANT EXECUTE ON FUNCTION public.register_device_verified(uuid, text, text, text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.approve_device_verified(uuid, text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.deactivate_own_device(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_devices(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_device_status(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_offline_lease_hours(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_accounts() TO authenticated;
