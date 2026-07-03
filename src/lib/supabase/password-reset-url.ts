/** Where Supabase sends users after they click the password-reset link in email. */
export const PASSWORD_RESET_REDIRECT_URL =
  import.meta.env.VITE_PASSWORD_RESET_REDIRECT_URL?.trim() ||
  "https://bongisto.github.io/SabbathCue/reset-password/"
