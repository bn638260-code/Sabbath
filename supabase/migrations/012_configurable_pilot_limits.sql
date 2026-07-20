-- Make agreement capacity adjustable without redeploying application code.

ALTER TABLE public.pilots
  ADD COLUMN max_active_churches integer NOT NULL DEFAULT 10 CHECK (max_active_churches > 0),
  ADD COLUMN max_devices_per_church integer NOT NULL DEFAULT 2 CHECK (max_devices_per_church > 0),
  ADD COLUMN max_pilot_devices integer NOT NULL DEFAULT 20 CHECK (max_pilot_devices > 0),
  ADD CONSTRAINT pilot_device_limits_valid CHECK (max_pilot_devices >= max_devices_per_church);

CREATE OR REPLACE FUNCTION public.register_device_verified(
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
  v_is_admin boolean;
  v_church_id uuid;
  v_church_name text;
  v_pilot_id uuid;
  v_expiry timestamptz;
  v_existing_status text;
  v_church_approved integer;
  v_pilot_approved integer;
  v_offline_hours smallint;
  v_church_limit integer;
  v_pilot_limit integer;
BEGIN
  IF auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'Service role required' USING ERRCODE = '42501';
  END IF;
  IF p_user_id IS NULL OR p_device_id IS NULL OR btrim(p_device_id) = '' THEN
    RAISE EXCEPTION 'user_id and device_id are required' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (SELECT 1 FROM public.account_flags WHERE user_id = p_user_id AND suspended) THEN
    RETURN jsonb_build_object('status', 'suspended');
  END IF;

  SELECT EXISTS (SELECT 1 FROM public.app_admins WHERE user_id = p_user_id)
  INTO v_is_admin;
  SELECT COALESCE(offline_lease_hours, 72) INTO v_offline_hours
  FROM public.account_flags WHERE user_id = p_user_id;

  IF v_is_admin THEN
    v_expiry := '9999-12-31 23:59:59+00'::timestamptz;
  ELSE
    SELECT c.id, c.name, c.pilot_id,
      (p.expiry_date + interval '1 day')::timestamptz,
      p.max_devices_per_church, p.max_pilot_devices
    INTO v_church_id, v_church_name, v_pilot_id, v_expiry,
      v_church_limit, v_pilot_limit
    FROM public.pilot_memberships m
    JOIN public.pilot_churches c ON c.id = m.church_id
    JOIN public.pilots p ON p.id = c.pilot_id
    WHERE m.user_id = p_user_id AND m.status = 'active'
      AND m.training_acknowledged_at IS NOT NULL
      AND c.status = 'active'
      AND p.status = 'active'
      AND p.payment_confirmed_at IS NOT NULL
      AND p.onboarding_started_at IS NOT NULL
      AND p.commencement_date IS NOT NULL AND p.commencement_date <= current_date
      AND p.expiry_date IS NOT NULL AND p.expiry_date >= current_date;
    IF NOT FOUND THEN
      IF NOT EXISTS (
        SELECT 1 FROM public.pilot_memberships
        WHERE user_id = p_user_id AND status = 'active'
      ) THEN
        RETURN jsonb_build_object('status', 'invite_required');
      END IF;
      RETURN jsonb_build_object('status', 'pilot_inactive');
    END IF;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('pilot-device:' || COALESCE(v_pilot_id::text, p_user_id::text)));
  SELECT status INTO v_existing_status FROM public.devices
  WHERE user_id = p_user_id AND device_id = p_device_id;
  IF v_existing_status = 'revoked' THEN
    RETURN jsonb_build_object('status', 'device_revoked');
  END IF;
  IF v_existing_status IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.devices WHERE user_id = p_user_id AND device_id = p_device_id
      AND public_key IS NOT NULL AND public_key <> p_public_key
  ) THEN
    RETURN jsonb_build_object('status', 'device_identity_mismatch');
  END IF;
  IF v_existing_status = 'pending' THEN
    UPDATE public.devices SET last_seen_at = now(), os = COALESCE(p_os, os),
      app_version = COALESCE(p_app_version, app_version), label = COALESCE(p_label, label),
      public_key = COALESCE(public_key, p_public_key)
    WHERE user_id = p_user_id AND device_id = p_device_id;
    RETURN jsonb_build_object('status', 'device_pending');
  END IF;
  IF v_existing_status = 'approved' THEN
    UPDATE public.devices SET last_seen_at = now(), os = COALESCE(p_os, os),
      app_version = COALESCE(p_app_version, app_version), label = COALESCE(p_label, label),
      public_key = COALESCE(public_key, p_public_key)
    WHERE user_id = p_user_id AND device_id = p_device_id;
    RETURN jsonb_build_object('status', 'ok', 'access_expires_at', v_expiry,
      'is_church_organization', NOT v_is_admin, 'church_name', v_church_name,
      'offline_lease_hours', COALESCE(v_offline_hours, 72));
  END IF;

  IF v_is_admin THEN
    SELECT count(*)::integer INTO v_church_approved FROM public.devices
    WHERE user_id = p_user_id AND church_id IS NULL AND status = 'approved';
    IF v_church_approved >= 2 THEN
      RETURN jsonb_build_object('status', 'device_limit_reached');
    END IF;
  ELSE
    SELECT count(*)::integer INTO v_church_approved FROM public.devices
    WHERE church_id = v_church_id AND status = 'approved';
    SELECT count(*)::integer INTO v_pilot_approved FROM public.devices d
    JOIN public.pilot_churches c ON c.id = d.church_id
    WHERE c.pilot_id = v_pilot_id AND d.status = 'approved';
    IF v_church_approved >= v_church_limit OR v_pilot_approved >= v_pilot_limit THEN
      RETURN jsonb_build_object('status', 'device_limit_reached');
    END IF;
  END IF;

  INSERT INTO public.devices (
    user_id, church_id, device_id, os, app_version, label, status, approved_at, public_key
  ) VALUES (
    p_user_id, v_church_id, p_device_id, p_os, p_app_version, p_label,
    CASE WHEN COALESCE(v_church_approved, 0) = 0 THEN 'approved' ELSE 'pending' END,
    CASE WHEN COALESCE(v_church_approved, 0) = 0 THEN now() ELSE NULL END,
    p_public_key
  );
  IF COALESCE(v_church_approved, 0) > 0 THEN
    RETURN jsonb_build_object('status', 'device_pending');
  END IF;
  RETURN jsonb_build_object('status', 'ok', 'access_expires_at', v_expiry,
    'is_church_organization', NOT v_is_admin, 'church_name', v_church_name,
    'offline_lease_hours', COALESCE(v_offline_hours, 72));
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
  v_church_id uuid;
  v_pilot_id uuid;
  v_approved_count integer;
  v_pilot_count integer;
  v_church_limit integer;
  v_pilot_limit integer;
BEGIN
  IF auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'Service role required' USING ERRCODE = '42501';
  END IF;
  SELECT d.church_id INTO v_church_id
  FROM public.devices d
  WHERE d.user_id = p_user_id AND d.device_id = p_approver_device_id
    AND d.status = 'approved' AND d.public_key = p_approver_public_key;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Approved installation proof required' USING ERRCODE = '42501';
  END IF;
  IF v_church_id IS NULL THEN
    UPDATE public.devices SET status = 'approved', approved_at = now(), revoked_at = NULL
    WHERE user_id = p_user_id AND device_id = p_target_device_id AND status = 'pending';
    IF NOT FOUND THEN RAISE EXCEPTION 'Pending device not found' USING ERRCODE = 'P0002'; END IF;
    RETURN;
  END IF;
  SELECT pilot_id INTO v_pilot_id FROM public.pilot_churches WHERE id = v_church_id;
  SELECT max_devices_per_church, max_pilot_devices
  INTO v_church_limit, v_pilot_limit FROM public.pilots WHERE id = v_pilot_id;
  PERFORM pg_advisory_xact_lock(hashtext('pilot-device:' || v_pilot_id::text));
  SELECT count(*)::integer INTO v_approved_count FROM public.devices
  WHERE church_id = v_church_id AND status = 'approved';
  SELECT count(*)::integer INTO v_pilot_count FROM public.devices d
  JOIN public.pilot_churches c ON c.id = d.church_id
  WHERE c.pilot_id = v_pilot_id AND d.status = 'approved';
  IF v_approved_count >= v_church_limit OR v_pilot_count >= v_pilot_limit THEN
    RAISE EXCEPTION 'Pilot device limit reached' USING ERRCODE = '23514';
  END IF;
  UPDATE public.devices SET status = 'approved', approved_at = now(), revoked_at = NULL
  WHERE church_id = v_church_id AND device_id = p_target_device_id AND status = 'pending';
  IF NOT FOUND THEN RAISE EXCEPTION 'Pending device not found' USING ERRCODE = 'P0002'; END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_set_device_status(
  p_user_id uuid, p_device_id text, p_status text
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_church_id uuid; v_pilot_id uuid; v_church_count integer; v_pilot_count integer;
  v_church_limit integer; v_pilot_limit integer;
BEGIN
  IF NOT public.is_app_admin() THEN
    RAISE EXCEPTION 'Admin access required' USING ERRCODE = '42501';
  END IF;
  IF p_status NOT IN ('approved', 'revoked') THEN
    RAISE EXCEPTION 'status must be approved or revoked' USING ERRCODE = '22023';
  END IF;
  SELECT church_id INTO v_church_id FROM public.devices
  WHERE user_id = p_user_id AND device_id = p_device_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Device not found' USING ERRCODE = 'P0002'; END IF;
  IF p_status = 'approved' AND v_church_id IS NOT NULL THEN
    SELECT pilot_id INTO v_pilot_id FROM public.pilot_churches WHERE id = v_church_id;
    SELECT max_devices_per_church, max_pilot_devices
    INTO v_church_limit, v_pilot_limit FROM public.pilots WHERE id = v_pilot_id;
    PERFORM pg_advisory_xact_lock(hashtext('pilot-device:' || v_pilot_id::text));
    SELECT count(*)::integer INTO v_church_count FROM public.devices
    WHERE church_id = v_church_id AND status = 'approved' AND device_id <> p_device_id;
    SELECT count(*)::integer INTO v_pilot_count FROM public.devices d
    JOIN public.pilot_churches c ON c.id = d.church_id
    WHERE c.pilot_id = v_pilot_id AND d.status = 'approved'
      AND NOT (d.user_id = p_user_id AND d.device_id = p_device_id);
    IF v_church_count >= v_church_limit OR v_pilot_count >= v_pilot_limit THEN
      RAISE EXCEPTION 'Pilot device limit reached' USING ERRCODE = '23514';
    END IF;
  END IF;
  UPDATE public.devices SET status = p_status,
    approved_at = CASE WHEN p_status = 'approved' THEN now() ELSE approved_at END,
    revoked_at = CASE WHEN p_status = 'revoked' THEN now() ELSE NULL END
  WHERE user_id = p_user_id AND device_id = p_device_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_set_pilot_church_status(
  p_church_id uuid, p_status text
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_pilot_id uuid; v_active_count integer; v_limit integer;
BEGIN
  IF NOT public.is_app_admin() THEN
    RAISE EXCEPTION 'Admin access required' USING ERRCODE = '42501';
  END IF;
  IF p_status NOT IN ('active', 'replaced') THEN
    RAISE EXCEPTION 'Invalid church status' USING ERRCODE = '22023';
  END IF;
  SELECT pilot_id INTO v_pilot_id FROM public.pilot_churches WHERE id = p_church_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Church not found' USING ERRCODE = 'P0002'; END IF;
  IF p_status = 'active' THEN
    SELECT count(*)::integer INTO v_active_count FROM public.pilot_churches
    WHERE pilot_id = v_pilot_id AND status = 'active' AND id <> p_church_id;
    SELECT max_active_churches INTO v_limit FROM public.pilots WHERE id = v_pilot_id;
    IF v_active_count >= v_limit THEN
      RAISE EXCEPTION 'The pilot active church limit has been reached' USING ERRCODE = '23514';
    END IF;
  END IF;
  UPDATE public.pilot_churches SET status = p_status WHERE id = p_church_id;
END;
$$;

DROP FUNCTION public.admin_update_pilot(text, date, date, boolean, boolean);
CREATE FUNCTION public.admin_update_pilot(
  p_status text, p_commencement_date date, p_expiry_date date,
  p_payment_confirmed boolean, p_onboarding_started boolean,
  p_max_active_churches integer, p_max_devices_per_church integer,
  p_max_pilot_devices integer
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_pilot_id uuid; v_active_churches integer; v_max_church_devices integer;
  v_pilot_devices integer;
BEGIN
  IF NOT public.is_app_admin() THEN
    RAISE EXCEPTION 'Admin access required' USING ERRCODE = '42501';
  END IF;
  IF p_status NOT IN ('draft', 'active', 'suspended', 'expired') THEN
    RAISE EXCEPTION 'Invalid pilot status' USING ERRCODE = '22023';
  END IF;
  IF p_max_active_churches <= 0 OR p_max_devices_per_church <= 0 OR
     p_max_pilot_devices < p_max_devices_per_church THEN
    RAISE EXCEPTION 'Pilot limits must be positive and total devices must cover one church'
      USING ERRCODE = '22023';
  END IF;
  IF p_status = 'active' AND (
    p_commencement_date IS NULL OR p_expiry_date IS NULL OR
    NOT p_payment_confirmed OR NOT p_onboarding_started
  ) THEN
    RAISE EXCEPTION 'Dates, payment, and onboarding are required before activation'
      USING ERRCODE = '23514';
  END IF;
  SELECT id INTO v_pilot_id FROM public.pilots LIMIT 1;
  SELECT count(*)::integer INTO v_active_churches FROM public.pilot_churches
  WHERE pilot_id = v_pilot_id AND status = 'active';
  SELECT COALESCE(max(device_count), 0)::integer INTO v_max_church_devices
  FROM (
    SELECT count(*) AS device_count FROM public.devices d
    JOIN public.pilot_churches c ON c.id = d.church_id
    WHERE c.pilot_id = v_pilot_id AND d.status = 'approved'
    GROUP BY d.church_id
  ) counts;
  SELECT count(*)::integer INTO v_pilot_devices FROM public.devices d
  JOIN public.pilot_churches c ON c.id = d.church_id
  WHERE c.pilot_id = v_pilot_id AND d.status = 'approved';
  IF p_max_active_churches < v_active_churches OR
     p_max_devices_per_church < v_max_church_devices OR
     p_max_pilot_devices < v_pilot_devices THEN
    RAISE EXCEPTION 'Pilot limits cannot be lower than current usage' USING ERRCODE = '23514';
  END IF;
  UPDATE public.pilots SET status = p_status,
    commencement_date = p_commencement_date, expiry_date = p_expiry_date,
    payment_confirmed_at = CASE WHEN p_payment_confirmed THEN COALESCE(payment_confirmed_at, now()) ELSE NULL END,
    onboarding_started_at = CASE WHEN p_onboarding_started THEN COALESCE(onboarding_started_at, now()) ELSE NULL END,
    max_active_churches = p_max_active_churches,
    max_devices_per_church = p_max_devices_per_church,
    max_pilot_devices = p_max_pilot_devices,
    updated_at = now();
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_add_pilot_church(
  p_name text, p_primary_contact_name text DEFAULT NULL,
  p_primary_contact_email text DEFAULT NULL, p_district_pastor text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_id uuid; v_pilot_id uuid; v_limit integer;
BEGIN
  IF NOT public.is_app_admin() THEN
    RAISE EXCEPTION 'Admin access required' USING ERRCODE = '42501';
  END IF;
  IF char_length(btrim(COALESCE(p_name, ''))) < 2 THEN
    RAISE EXCEPTION 'Church name is required' USING ERRCODE = '22023';
  END IF;
  SELECT id, max_active_churches INTO v_pilot_id, v_limit FROM public.pilots LIMIT 1;
  IF (SELECT count(*) FROM public.pilot_churches WHERE pilot_id = v_pilot_id AND status = 'active') >= v_limit THEN
    RAISE EXCEPTION 'The pilot active church limit has been reached' USING ERRCODE = '23514';
  END IF;
  INSERT INTO public.pilot_churches (
    pilot_id, name, primary_contact_name, primary_contact_email, district_pastor
  ) VALUES (
    v_pilot_id, btrim(p_name), NULLIF(btrim(p_primary_contact_name), ''),
    NULLIF(btrim(p_primary_contact_email), ''), NULLIF(btrim(p_district_pastor), '')
  ) RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.register_device_verified(uuid, text, text, text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.approve_device_verified(uuid, text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_set_device_status(uuid, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_set_pilot_church_status(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_update_pilot(text, date, date, boolean, boolean, integer, integer, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_add_pilot_church(text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.register_device_verified(uuid, text, text, text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.approve_device_verified(uuid, text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_set_device_status(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_pilot_church_status(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_pilot(text, date, date, boolean, boolean, integer, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_add_pilot_church(text, text, text, text) TO authenticated;
