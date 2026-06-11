import { createClient, type SupabaseClient } from "@supabase/supabase-js"

let client: SupabaseClient | null = null

function requireSupabaseEnv(): { url: string; anonKey: string } {
  const url = import.meta.env.VITE_SUPABASE_URL
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

  if (!url?.trim() || !anonKey?.trim()) {
    throw new Error(
      "Missing Supabase configuration. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your local .env file.",
    )
  }

  return { url: url.trim(), anonKey: anonKey.trim() }
}

export function getSupabaseClient(): SupabaseClient {
  if (client) return client

  const { url, anonKey } = requireSupabaseEnv()
  client = createClient(url, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })

  return client
}

/** Test-only reset so each Vitest file gets a fresh singleton. */
export function resetSupabaseClientForTests(): void {
  client = null
}
