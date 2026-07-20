-- Require confirmed accounts for pilot redemption and bootstrap the designated owner.

CREATE OR REPLACE FUNCTION public.bootstrap_sabbathcue_admin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF lower(COALESCE(NEW.email, '')) = 'fanelesibonge50@gmail.com' THEN
    INSERT INTO public.app_admins (user_id) VALUES (NEW.id)
    ON CONFLICT (user_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS bootstrap_sabbathcue_admin_on_user_created ON auth.users;
CREATE TRIGGER bootstrap_sabbathcue_admin_on_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.bootstrap_sabbathcue_admin();

INSERT INTO public.app_admins (user_id)
SELECT id FROM auth.users
WHERE lower(COALESCE(email, '')) = 'fanelesibonge50@gmail.com'
ON CONFLICT (user_id) DO NOTHING;

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
  IF NOT EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = v_user_id AND email_confirmed_at IS NOT NULL
  ) THEN
    RETURN jsonb_build_object('status', 'email_confirmation_required');
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

REVOKE ALL ON FUNCTION public.bootstrap_sabbathcue_admin() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.redeem_pilot_invite(text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.redeem_pilot_invite(text, boolean) TO authenticated;
