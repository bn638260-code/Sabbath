-- SabbathCue: close the device-limit race in register_device.
-- Apply via Supabase SQL Editor AFTER 002_account_management.sql.
--
-- Two concurrent first-time registrations could both pass the count check and
-- exceed the 2-device cap. A per-user transaction-scoped advisory lock
-- serializes registrations for the same account; different accounts are
-- unaffected.

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

  -- Serialize device registration per user so the count-then-insert below
  -- cannot race past the device cap. Released at transaction end.
  PERFORM pg_advisory_xact_lock(hashtext('register_device:' || v_user_id::text));

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
