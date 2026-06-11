-- SabbathCue device registration: max 2 devices per account.
-- Apply via Supabase SQL Editor (operator action, CP-06).

CREATE TABLE IF NOT EXISTS public.devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  device_id text NOT NULL,
  os text,
  app_version text,
  label text,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT devices_user_device_unique UNIQUE (user_id, device_id)
);

CREATE INDEX IF NOT EXISTS devices_user_id_idx ON public.devices (user_id);

ALTER TABLE public.devices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS users_read_own_devices ON public.devices;

CREATE POLICY users_read_own_devices
  ON public.devices
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

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

REVOKE ALL ON FUNCTION public.register_device(text, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.register_device(text, text, text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.register_device(text, text, text, text) TO authenticated;
