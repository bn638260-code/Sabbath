import { getSupabaseClient } from "@/lib/supabase/client"
import { failureMessage } from "@/lib/supabase/errors"

export interface ActiveAnnouncement {
  id: string
  title: string
  body: string
  published_at: string | null
  expires_at: string | null
}

export interface AdminAnnouncementRow {
  id: string
  title: string
  body: string
  status: "draft" | "published" | "expired"
  published_at: string | null
  expires_at: string | null
  created_at: string
  updated_at: string
}

export type AnnouncementActionResult =
  | { ok: true }
  | { ok: false; message: string }

function isActiveAnnouncement(value: unknown): value is ActiveAnnouncement {
  if (!value || typeof value !== "object") return false
  const row = value as Record<string, unknown>
  return (
    typeof row.id === "string" &&
    typeof row.title === "string" &&
    typeof row.body === "string"
  )
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === "string"
}

function isAdminAnnouncementStatus(
  value: unknown
): value is AdminAnnouncementRow["status"] {
  return value === "draft" || value === "published" || value === "expired"
}

function isAdminAnnouncementRow(value: unknown): value is AdminAnnouncementRow {
  if (!value || typeof value !== "object") return false
  const row = value as Record<string, unknown>
  return (
    typeof row.id === "string" &&
    typeof row.title === "string" &&
    typeof row.body === "string" &&
    isAdminAnnouncementStatus(row.status) &&
    isNullableString(row.published_at) &&
    isNullableString(row.expires_at) &&
    typeof row.created_at === "string" &&
    typeof row.updated_at === "string"
  )
}

export async function fetchActiveAnnouncements(): Promise<
  | { ok: true; announcements: ActiveAnnouncement[] }
  | { ok: false; message: string }
> {
  try {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase.rpc("fetch_active_announcements")
    if (error) {
      return {
        ok: false,
        message: failureMessage(error, "Could not load announcements."),
      }
    }
    const announcements = Array.isArray(data)
      ? data.filter(isActiveAnnouncement)
      : []
    return { ok: true, announcements }
  } catch {
    return { ok: false, message: "Unable to reach the announcements service." }
  }
}

export async function adminListAnnouncements(): Promise<
  | { ok: true; announcements: AdminAnnouncementRow[] }
  | { ok: false; message: string }
> {
  try {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase.rpc("admin_list_announcements")
    if (error) {
      return {
        ok: false,
        message: failureMessage(error, "Could not load announcements."),
      }
    }
    const announcements = Array.isArray(data)
      ? data.filter(isAdminAnnouncementRow)
      : []
    return { ok: true, announcements }
  } catch {
    return { ok: false, message: "Unable to reach the announcements service." }
  }
}

export async function adminCreateAnnouncement(
  title: string,
  body: string
): Promise<{ ok: true; id: string } | { ok: false; message: string }> {
  try {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase.rpc("admin_create_announcement", {
      p_title: title,
      p_body: body,
    })
    if (error) {
      return {
        ok: false,
        message: failureMessage(error, "Could not create announcement."),
      }
    }
    if (typeof data !== "string") {
      return { ok: false, message: "Unexpected create response." }
    }
    return { ok: true, id: data }
  } catch {
    return { ok: false, message: "Unable to reach the announcements service." }
  }
}

export async function adminUpdateAnnouncement(input: {
  id: string
  title?: string
  body?: string
  status?: AdminAnnouncementRow["status"]
  expiresAt?: string | null
}): Promise<AnnouncementActionResult> {
  try {
    const supabase = getSupabaseClient()
    const params: {
      p_id: string
      p_title?: string | null
      p_body?: string | null
      p_status?: AdminAnnouncementRow["status"] | null
      p_expires_at?: string | null
    } = { p_id: input.id }

    if ("title" in input) params.p_title = input.title ?? null
    if ("body" in input) params.p_body = input.body ?? null
    if ("status" in input) params.p_status = input.status ?? null
    if ("expiresAt" in input) params.p_expires_at = input.expiresAt ?? null

    const { error } = await supabase.rpc("admin_update_announcement", params)
    if (error) {
      return {
        ok: false,
        message: failureMessage(error, "Could not update announcement."),
      }
    }
    return { ok: true }
  } catch {
    return { ok: false, message: "Unable to reach the announcements service." }
  }
}

export async function adminDeleteAnnouncement(
  id: string
): Promise<AnnouncementActionResult> {
  try {
    const supabase = getSupabaseClient()
    const { error } = await supabase.rpc("admin_delete_announcement", {
      p_id: id,
    })
    if (error) {
      return {
        ok: false,
        message: failureMessage(error, "Could not delete announcement."),
      }
    }
    return { ok: true }
  } catch {
    return { ok: false, message: "Unable to reach the announcements service." }
  }
}
