// Repo-root entry so Vercel's zero-config detects /api/reviews when the
// knfcpilot project deploys with Root Directory "." Re-exports the real handler.
export { default } from "../landing-knfcpilot/api/reviews.js";
