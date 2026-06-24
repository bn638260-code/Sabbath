-- SabbathCue cancellation requests.
-- Apply via Supabase SQL Editor AFTER 006_trial_access.sql.
--
-- A cancellation request records the user's intent to stop renewal/access.
-- It does not suspend, delete, refund, or shorten the current paid period.
-- Access continues to be enforced by account_flags.access_expires_at in
-- public.register_device().

CREATE TABLE IF NOT EXISTS public.account_cancellation_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  account_email text,
  requested_at timestamptz NOT NULL DEFAULT now(),
  access_expires_at_at_request timestamptz,
  disclaimer_accepted boolean NOT NULL DEFAULT true,
  status text NOT NULL DEFAULT 'requested'
    CHECK (status IN ('requested', 'processed', 'withdrawn')),
  processed_at timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS account_cancellation_requests_one_open_idx
  ON public.account_cancellation_requests (user_id)
  WHERE status = 'requested';

CREATE INDEX IF NOT EXISTS account_cancellation_requests_user_requested_idx
  ON public.account_cancellation_requests (user_id, requested_at DESC);

ALTER TABLE public.account_cancellation_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS users_read_own_cancellation_requests
  ON public.account_cancellation_requests;
CREATE POLICY users_read_own_cancellation_requests
  ON public.account_cancellation_requests
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.request_account_cancellation(
  p_account_email text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_access_expires_at timestamptz;
  v_request_id uuid;
  v_requested_at timestamptz;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated'
      USING ERRCODE = '28000';
  END IF;

  SELECT access_expires_at
  INTO v_access_expires_at
  FROM public.account_flags
  WHERE user_id = v_user_id;

  INSERT INTO public.account_cancellation_requests (
    user_id,
    account_email,
    access_expires_at_at_request,
    disclaimer_accepted,
    status
  )
  VALUES (
    v_user_id,
    NULLIF(btrim(p_account_email), ''),
    v_access_expires_at,
    true,
    'requested'
  )
  ON CONFLICT (user_id) WHERE status = 'requested'
  DO UPDATE SET
    account_email = COALESCE(
      NULLIF(btrim(EXCLUDED.account_email), ''),
      public.account_cancellation_requests.account_email
    ),
    requested_at = now(),
    access_expires_at_at_request = EXCLUDED.access_expires_at_at_request,
    disclaimer_accepted = true
  RETURNING id, requested_at
  INTO v_request_id, v_requested_at;

  RETURN jsonb_build_object(
    'status', 'requested',
    'request_id', v_request_id,
    'requested_at', v_requested_at,
    'access_expires_at', v_access_expires_at
  );
END;
$$;

REVOKE ALL ON FUNCTION public.request_account_cancellation(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.request_account_cancellation(text) TO authenticated;
