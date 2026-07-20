-- KNFC pilot access: invitation-only church membership and church-scoped devices.
-- Apply after 009_device_activation_management.sql.

CREATE TABLE public.pilots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'active', 'suspended', 'expired')),
  commencement_date date,
  expiry_date date,
  payment_confirmed_at timestamptz,
  onboarding_started_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (expiry_date IS NULL OR commencement_date IS NULL OR expiry_date >= commencement_date)
);

INSERT INTO public.pilots (name) VALUES ('KNFC SabbathCue Pilot');

CREATE TABLE public.pilot_churches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pilot_id uuid NOT NULL REFERENCES public.pilots (id) ON DELETE CASCADE,
  name text NOT NULL,
  primary_contact_name text,
  primary_contact_email text,
  district_pastor text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'replaced')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (pilot_id, name)
);

CREATE TABLE public.pilot_memberships (
  user_id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  church_id uuid NOT NULL REFERENCES public.pilot_churches (id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('primary_contact', 'pastor', 'operator')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked')),
  training_acknowledged_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz
);

CREATE TABLE public.pilot_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id uuid NOT NULL REFERENCES public.pilot_churches (id) ON DELETE CASCADE,
  code_hash text NOT NULL UNIQUE,
  role text NOT NULL CHECK (role IN ('primary_contact', 'pastor', 'operator')),
  expires_at timestamptz NOT NULL,
  created_by uuid NOT NULL REFERENCES public.app_admins (user_id),
  created_at timestamptz NOT NULL DEFAULT now(),
  redeemed_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  redeemed_at timestamptz,
  revoked_at timestamptz,
  CHECK (expires_at > created_at)
);

ALTER TABLE public.pilots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pilot_churches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pilot_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pilot_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY members_read_own_membership ON public.pilot_memberships
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY members_read_own_church ON public.pilot_churches
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.pilot_memberships m
      WHERE m.user_id = auth.uid() AND m.church_id = pilot_churches.id
        AND m.status = 'active'
    )
  );
CREATE POLICY members_read_own_pilot ON public.pilots
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.pilot_memberships m
      JOIN public.pilot_churches c ON c.id = m.church_id
      WHERE m.user_id = auth.uid() AND c.pilot_id = pilots.id
        AND m.status = 'active'
    )
  );

ALTER TABLE public.devices
  ADD COLUMN church_id uuid REFERENCES public.pilot_churches (id) ON DELETE CASCADE;
CREATE INDEX devices_church_status_idx ON public.devices (church_id, status);
CREATE UNIQUE INDEX devices_church_device_unique
  ON public.devices (church_id, device_id) WHERE church_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.initialize_account_trial()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.account_flags (
    user_id, access_expires_at, is_church_organization, church_name
  ) VALUES (NEW.id, NULL, false, NULL)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.redeem_pilot_invite(
  p_code text,
  p_training_acknowledged boolean
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_invite public.pilot_invites%ROWTYPE;
  v_church_name text;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000';
  END IF;
  IF NOT COALESCE(p_training_acknowledged, false) THEN
    RETURN jsonb_build_object('status', 'training_required');
  END IF;
  IF p_code IS NULL OR char_length(btrim(p_code)) < 16 THEN
    RETURN jsonb_build_object('status', 'invalid_invite');
  END IF;
  IF EXISTS (SELECT 1 FROM public.app_admins WHERE user_id = v_user_id) THEN
    RETURN jsonb_build_object('status', 'admin');
  END IF;
  IF EXISTS (SELECT 1 FROM public.pilot_memberships WHERE user_id = v_user_id) THEN
    RETURN jsonb_build_object('status', 'already_redeemed');
  END IF;

  SELECT * INTO v_invite
  FROM public.pilot_invites
  WHERE code_hash = encode(digest(upper(btrim(p_code)), 'sha256'), 'hex')
  FOR UPDATE;

  IF NOT FOUND OR v_invite.revoked_at IS NOT NULL OR
     v_invite.redeemed_at IS NOT NULL OR v_invite.expires_at <= now() THEN
    RETURN jsonb_build_object('status', 'invalid_invite');
  END IF;

  SELECT c.name INTO v_church_name
  FROM public.pilot_churches c
  WHERE c.id = v_invite.church_id AND c.status = 'active';
  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'invalid_invite');
  END IF;

  INSERT INTO public.pilot_memberships (
    user_id, church_id, role, training_acknowledged_at
  ) VALUES (v_user_id, v_invite.church_id, v_invite.role, now());
  UPDATE public.pilot_invites
  SET redeemed_by = v_user_id, redeemed_at = now()
  WHERE id = v_invite.id;
  UPDATE public.account_flags
  SET is_church_organization = true, church_name = v_church_name
  WHERE user_id = v_user_id;
  RETURN jsonb_build_object('status', 'ok', 'church_name', v_church_name);
END;
$$;

DROP FUNCTION IF EXISTS public.register_device_verified(uuid, text, text, text, text, text);
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
  v_is_admin boolean;
  v_church_id uuid;
  v_church_name text;
  v_pilot_id uuid;
  v_expiry timestamptz;
  v_existing_status text;
  v_church_approved integer;
  v_pilot_approved integer;
  v_offline_hours smallint;
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
      (p.expiry_date + interval '1 day')::timestamptz
    INTO v_church_id, v_church_name, v_pilot_id, v_expiry
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
    IF v_church_approved >= 2 OR v_pilot_approved >= 20 THEN
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
  PERFORM pg_advisory_xact_lock(hashtext('pilot-device:' || v_pilot_id::text));
  SELECT count(*)::integer INTO v_approved_count FROM public.devices
  WHERE church_id = v_church_id AND status = 'approved';
  SELECT count(*)::integer INTO v_pilot_count FROM public.devices d
  JOIN public.pilot_churches c ON c.id = d.church_id
  WHERE c.pilot_id = v_pilot_id AND d.status = 'approved';
  IF v_approved_count >= 2 OR v_pilot_count >= 20 THEN
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
DECLARE v_church_id uuid; v_pilot_id uuid; v_church_count integer; v_pilot_count integer;
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
    PERFORM pg_advisory_xact_lock(hashtext('pilot-device:' || v_pilot_id::text));
    SELECT count(*)::integer INTO v_church_count FROM public.devices
    WHERE church_id = v_church_id AND status = 'approved' AND device_id <> p_device_id;
    SELECT count(*)::integer INTO v_pilot_count FROM public.devices d
    JOIN public.pilot_churches c ON c.id = d.church_id
    WHERE c.pilot_id = v_pilot_id AND d.status = 'approved'
      AND NOT (d.user_id = p_user_id AND d.device_id = p_device_id);
    IF v_church_count >= 2 OR v_pilot_count >= 20 THEN
      RAISE EXCEPTION 'Pilot device limit reached' USING ERRCODE = '23514';
    END IF;
  END IF;
  UPDATE public.devices SET status = p_status,
    approved_at = CASE WHEN p_status = 'approved' THEN now() ELSE approved_at END,
    revoked_at = CASE WHEN p_status = 'revoked' THEN now() ELSE NULL END
  WHERE user_id = p_user_id AND device_id = p_device_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_get_pilot()
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_pilot jsonb;
BEGIN
  IF NOT public.is_app_admin() THEN
    RAISE EXCEPTION 'Admin access required' USING ERRCODE = '42501';
  END IF;
  SELECT to_jsonb(p) || jsonb_build_object(
    'churches', COALESCE((
      SELECT jsonb_agg(to_jsonb(c) ORDER BY c.name) FROM public.pilot_churches c
      WHERE c.pilot_id = p.id
    ), '[]'::jsonb),
    'invites', COALESCE((
      SELECT jsonb_agg(to_jsonb(i) - 'code_hash' ORDER BY i.created_at DESC)
      FROM public.pilot_invites i JOIN public.pilot_churches c ON c.id = i.church_id
      WHERE c.pilot_id = p.id
    ), '[]'::jsonb),
    'memberships', COALESCE((
      SELECT jsonb_agg(to_jsonb(m) || jsonb_build_object('email', u.email::text) ORDER BY u.email)
      FROM public.pilot_memberships m
      JOIN auth.users u ON u.id = m.user_id
      JOIN public.pilot_churches c ON c.id = m.church_id
      WHERE c.pilot_id = p.id
    ), '[]'::jsonb)
  ) INTO v_pilot FROM public.pilots p LIMIT 1;
  RETURN v_pilot;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_set_pilot_church_status(
  p_church_id uuid, p_status text
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.is_app_admin() THEN
    RAISE EXCEPTION 'Admin access required' USING ERRCODE = '42501';
  END IF;
  IF p_status NOT IN ('active', 'replaced') THEN
    RAISE EXCEPTION 'Invalid church status' USING ERRCODE = '22023';
  END IF;
  UPDATE public.pilot_churches SET status = p_status WHERE id = p_church_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Church not found' USING ERRCODE = 'P0002'; END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_revoke_pilot_membership(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.is_app_admin() THEN
    RAISE EXCEPTION 'Admin access required' USING ERRCODE = '42501';
  END IF;
  UPDATE public.pilot_memberships
  SET status = 'revoked', revoked_at = now()
  WHERE user_id = p_user_id AND status = 'active';
  IF NOT FOUND THEN RAISE EXCEPTION 'Active membership not found' USING ERRCODE = 'P0002'; END IF;
  UPDATE public.devices SET status = 'revoked', revoked_at = now()
  WHERE user_id = p_user_id AND status <> 'revoked';
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_update_pilot(
  p_status text, p_commencement_date date, p_expiry_date date,
  p_payment_confirmed boolean, p_onboarding_started boolean
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.is_app_admin() THEN
    RAISE EXCEPTION 'Admin access required' USING ERRCODE = '42501';
  END IF;
  IF p_status NOT IN ('draft', 'active', 'suspended', 'expired') THEN
    RAISE EXCEPTION 'Invalid pilot status' USING ERRCODE = '22023';
  END IF;
  IF p_status = 'active' AND (
    p_commencement_date IS NULL OR p_expiry_date IS NULL OR
    NOT p_payment_confirmed OR NOT p_onboarding_started
  ) THEN
    RAISE EXCEPTION 'Dates, payment, and onboarding are required before activation'
      USING ERRCODE = '23514';
  END IF;
  UPDATE public.pilots SET status = p_status,
    commencement_date = p_commencement_date, expiry_date = p_expiry_date,
    payment_confirmed_at = CASE WHEN p_payment_confirmed THEN COALESCE(payment_confirmed_at, now()) ELSE NULL END,
    onboarding_started_at = CASE WHEN p_onboarding_started THEN COALESCE(onboarding_started_at, now()) ELSE NULL END,
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
DECLARE v_id uuid; v_pilot_id uuid;
BEGIN
  IF NOT public.is_app_admin() THEN
    RAISE EXCEPTION 'Admin access required' USING ERRCODE = '42501';
  END IF;
  IF char_length(btrim(COALESCE(p_name, ''))) < 2 THEN
    RAISE EXCEPTION 'Church name is required' USING ERRCODE = '22023';
  END IF;
  SELECT id INTO v_pilot_id FROM public.pilots LIMIT 1;
  IF (SELECT count(*) FROM public.pilot_churches WHERE pilot_id = v_pilot_id AND status = 'active') >= 10 THEN
    RAISE EXCEPTION 'The pilot already has ten active churches' USING ERRCODE = '23514';
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

CREATE OR REPLACE FUNCTION public.admin_create_pilot_invite(
  p_church_id uuid, p_role text, p_code text, p_expires_at timestamptz
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions
AS $$
DECLARE v_id uuid;
BEGIN
  IF NOT public.is_app_admin() THEN
    RAISE EXCEPTION 'Admin access required' USING ERRCODE = '42501';
  END IF;
  IF p_role NOT IN ('primary_contact', 'pastor', 'operator') OR
     p_expires_at <= now() OR char_length(btrim(COALESCE(p_code, ''))) < 16 THEN
    RAISE EXCEPTION 'Invalid invitation' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.pilot_churches WHERE id = p_church_id AND status = 'active') THEN
    RAISE EXCEPTION 'Active church not found' USING ERRCODE = 'P0002';
  END IF;
  INSERT INTO public.pilot_invites (church_id, code_hash, role, expires_at, created_by)
  VALUES (p_church_id, encode(digest(upper(btrim(p_code)), 'sha256'), 'hex'),
    p_role, p_expires_at, auth.uid()) RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_revoke_pilot_invite(p_invite_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.is_app_admin() THEN
    RAISE EXCEPTION 'Admin access required' USING ERRCODE = '42501';
  END IF;
  UPDATE public.pilot_invites SET revoked_at = now()
  WHERE id = p_invite_id AND redeemed_at IS NULL AND revoked_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'Active invitation not found' USING ERRCODE = 'P0002'; END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.redeem_pilot_invite(text, boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.register_device_verified(uuid, text, text, text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.approve_device_verified(uuid, text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_set_device_status(uuid, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_get_pilot() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_update_pilot(text, date, date, boolean, boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_add_pilot_church(text, text, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_set_pilot_church_status(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_revoke_pilot_membership(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_create_pilot_invite(uuid, text, text, timestamptz) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_revoke_pilot_invite(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_set_access(uuid, integer) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.redeem_pilot_invite(text, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.register_device_verified(uuid, text, text, text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.approve_device_verified(uuid, text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_set_device_status(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_pilot() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_pilot(text, date, date, boolean, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_add_pilot_church(text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_pilot_church_status(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_revoke_pilot_membership(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_create_pilot_invite(uuid, text, text, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_revoke_pilot_invite(uuid) TO authenticated;
