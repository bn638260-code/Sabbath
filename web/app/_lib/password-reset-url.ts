export const PASSWORD_RESET_PATH = "/reset-password/";

export const PASSWORD_RESET_REDIRECT_URL =
  process.env.NEXT_PUBLIC_PASSWORD_RESET_REDIRECT_URL?.trim() ||
  "https://bongisto.github.io/SabbathCue/reset-password/";
