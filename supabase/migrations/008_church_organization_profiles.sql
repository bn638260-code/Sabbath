-- Optional self-declared church organization profiles.
-- Apply after 007_account_cancellation_requests.sql.

ALTER TABLE public.account_flags
  ADD COLUMN IF NOT EXISTS is_church_organization boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS church_name text;

ALTER TABLE public.account_flags
  DROP CONSTRAINT IF EXISTS account_flags_church_profile_valid;
ALTER TABLE public.account_flags
  ADD CONSTRAINT account_flags_church_profile_valid CHECK (
    (
      is_church_organization
      AND church_name IS NOT NULL
      AND char_length(btrim(church_name)) BETWEEN 2 AND 120
    )
    OR (
      NOT is_church_organization
      AND church_name IS NULL
    )
  );

CREATE OR REPLACE FUNCTION public.initialize_account_trial()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_church_name text;
  v_is_church_organization boolean;
BEGIN
  v_church_name := NULLIF(
    left(btrim(COALESCE(NEW.raw_user_meta_data ->> 'church_name', '')), 120),
    ''
  );
  v_is_church_organization :=
    lower(COALESCE(NEW.raw_user_meta_data ->> 'is_church_organization', 'false')) = 'true'
    AND v_church_name IS NOT NULL
    AND char_length(v_church_name) >= 2;

  INSERT INTO public.account_flags (
    user_id,
    access_expires_at,
    is_church_organization,
    church_name
  )
  VALUES (
    NEW.id,
    now() + interval '14 days',
    v_is_church_organization,
    CASE WHEN v_is_church_organization THEN v_church_name ELSE NULL END
  )
  ON CONFLICT (user_id) DO UPDATE SET
    access_expires_at = COALESCE(
      public.account_flags.access_expires_at,
      EXCLUDED.access_expires_at
    ),
    is_church_organization = EXCLUDED.is_church_organization,
    church_name = EXCLUDED.church_name;

  RETURN NEW;
END;
$$;

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
  v_access_expires_at timestamptz;
  v_is_admin boolean;
  v_return_access_expires_at timestamptz;
  v_is_church_organization boolean;
  v_church_name text;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.account_flags
    WHERE user_id = v_user_id AND suspended
  ) THEN
    RETURN jsonb_build_object('status', 'suspended');
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.app_admins WHERE user_id = v_user_id
  )
  INTO v_is_admin;

  SELECT
    access_expires_at,
    is_church_organization,
    church_name
  INTO
    v_access_expires_at,
    v_is_church_organization,
    v_church_name
  FROM public.account_flags
  WHERE user_id = v_user_id;

  IF NOT v_is_admin AND (
    v_access_expires_at IS NULL OR v_access_expires_at <= now()
  ) THEN
    RETURN jsonb_build_object('status', 'trial_expired');
  END IF;

  IF p_device_id IS NULL OR btrim(p_device_id) = '' THEN
    RAISE EXCEPTION 'device_id is required' USING ERRCODE = '22023';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('register_device:' || v_user_id::text));

  v_return_access_expires_at := CASE
    WHEN v_is_admin THEN '9999-12-31 23:59:59+00'::timestamptz
    ELSE v_access_expires_at
  END;

  IF EXISTS (
    SELECT 1 FROM public.devices
    WHERE user_id = v_user_id AND device_id = p_device_id
  ) THEN
    UPDATE public.devices
    SET
      last_seen_at = now(),
      os = COALESCE(p_os, os),
      app_version = COALESCE(p_app_version, app_version),
      label = COALESCE(p_label, label)
    WHERE user_id = v_user_id AND device_id = p_device_id;
  ELSE
    SELECT count(*)::integer
    INTO v_device_count
    FROM public.devices
    WHERE user_id = v_user_id;

    IF v_device_count >= 2 THEN
      RETURN jsonb_build_object('status', 'device_limit_reached');
    END IF;

    INSERT INTO public.devices (user_id, device_id, os, app_version, label)
    VALUES (v_user_id, p_device_id, p_os, p_app_version, p_label);
  END IF;

  RETURN jsonb_build_object(
    'status', 'ok',
    'access_expires_at', v_return_access_expires_at,
    'is_church_organization', COALESCE(v_is_church_organization, false),
    'church_name', v_church_name
  );
END;
$$;

DROP FUNCTION IF EXISTS public.admin_list_accounts();
CREATE FUNCTION public.admin_list_accounts()
RETURNS TABLE (
  user_id uuid,
  email text,
  created_at timestamptz,
  suspended boolean,
  suspend_reason text,
  access_expires_at timestamptz,
  device_count bigint,
  last_seen_at timestamptz,
  is_admin boolean,
  is_church_organization boolean,
  church_name text
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
  SELECT
    u.id,
    u.email::text,
    u.created_at,
    COALESCE(f.suspended, false),
    f.suspend_reason,
    f.access_expires_at,
    count(d.id),
    max(d.last_seen_at),
    EXISTS (SELECT 1 FROM public.app_admins a WHERE a.user_id = u.id),
    COALESCE(f.is_church_organization, false),
    f.church_name
  FROM auth.users u
  LEFT JOIN public.account_flags f ON f.user_id = u.id
  LEFT JOIN public.devices d ON d.user_id = u.id
  GROUP BY
    u.id,
    u.email,
    u.created_at,
    f.suspended,
    f.suspend_reason,
    f.access_expires_at,
    f.is_church_organization,
    f.church_name
  ORDER BY u.created_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.initialize_account_trial() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.register_device(text, text, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_list_accounts() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.register_device(text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_accounts() TO authenticated;
