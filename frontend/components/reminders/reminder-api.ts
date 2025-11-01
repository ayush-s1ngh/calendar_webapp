/* API helpers for reminders (client-only). */
import api from "@/lib/api"
import type { ApiReminder } from "./reminder-time"

/**
 * Fetch reminders for an event id while tolerating various API envelope shapes.
 */
export async function fetchRemindersForEvent(eventId: string | number): Promise<ApiReminder[]> {
  try {
    const res = await api.get(`/reminders/event/${encodeURIComponent(String(eventId))}/reminders`)
    const d: unknown = res?.data
    if (Array.isArray(d)) return d as ApiReminder[]
    const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null
    if (isObj(d)) {
      const reminders = d["reminders"]
      if (Array.isArray(reminders)) return reminders as ApiReminder[]
      const data = d["data"]
      if (isObj(data)) {
        if (Array.isArray(data["reminders"])) return data["reminders"] as ApiReminder[]
      }
      if (Array.isArray(d["data"])) return d["data"] as ApiReminder[]
    }
    return []
  } catch {
    return []
  }
}