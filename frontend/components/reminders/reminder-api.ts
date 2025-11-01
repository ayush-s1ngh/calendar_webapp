/* API helpers for reminders (client-only). */
import api from "@/lib/api"
import type { ApiReminder } from "./reminder-time"

/**
 * Fetch reminders for an event id while tolerating various API envelope shapes.
 */
export async function fetchRemindersForEvent(eventId: string | number): Promise<ApiReminder[]> {
  try {
    const res = await api.get(`/reminders/event/${encodeURIComponent(String(eventId))}/reminders`)
    const d = res?.data as any
    if (Array.isArray(d)) return d as ApiReminder[]
    if (Array.isArray(d?.reminders)) return d.reminders as ApiReminder[]
    if (Array.isArray(d?.data)) return d.data as ApiReminder[]
    if (Array.isArray(d?.data?.reminders)) return d.data.reminders as ApiReminder[]
    return []
  } catch {
    return []
  }
}