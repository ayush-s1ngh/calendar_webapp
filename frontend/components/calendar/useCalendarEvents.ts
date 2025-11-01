/**
 * Fetch and map events from the API to FullCalendar inputs.
 * - Handles inclusive (backend) vs exclusive (FullCalendar) end for all-day events
 * - Tolerant to envelope shapes: data, events, or raw arrays
 */
import { DateRangeInput } from "./types-internal"
import type { EventInput } from "@fullcalendar/core"
import api from "@/lib/api"
import { localDateToUtcIso, utcIsoToLocalDate } from "@/lib/time"
import { addDays, startOfDay } from "date-fns"

interface ApiCategory {
  id: number
  name: string
  color?: string
}

interface ApiEvent {
  id: number | string
  title: string
  description?: string
  start_datetime: string
  end_datetime?: string
  is_all_day?: boolean
  color?: string | null
  is_recurring?: boolean
  recurrence_id?: string | null
  categories?: ApiCategory[]
}

export type EventFilters = {
  categoryIds?: number[]
  search?: string
  includeRecurring?: boolean
}

function mapApiEventToEventInput(ev: ApiEvent): EventInput {
  const startLocal = utcIsoToLocalDate(ev.start_datetime)
  let endLocal = ev.end_datetime ? utcIsoToLocalDate(ev.end_datetime) : undefined
  const primaryCategory = ev.categories?.[0]
  const color = primaryCategory?.color || ev.color || undefined
  const allDay = Boolean(ev.is_all_day)

  // Convert backend's inclusive end → FullCalendar exclusive end (all-day only)
  if (allDay && endLocal) {
    const inclusiveDayStart = startOfDay(endLocal) // e.g., Oct 2 00:00
    endLocal = addDays(inclusiveDayStart, 1) // → Oct 3 00:00
  }

  return {
    id: String(ev.id),
    title: ev.title,
    start: startLocal,
    end: endLocal,
    allDay,
    backgroundColor: color || undefined,
    borderColor: color || undefined,
    classNames: [allDay ? "ev-allday" : "ev-timed"],
    extendedProps: {
      description: ev.description,
      categoryIds: (ev.categories || []).map((c) => c.id),
      categoryName: primaryCategory?.name,
      categoryColorVar: color || undefined,
      is_recurring: ev.is_recurring,
      recurrence_id: ev.recurrence_id ?? undefined,
    },
  }
}

function buildBaseQuery(range: DateRangeInput, filters?: EventFilters) {
  const params: Record<string, string | number | boolean> = {
    start_date: localDateToUtcIso(range.start),
    end_date: localDateToUtcIso(range.end),
    include_recurring: filters?.includeRecurring !== false,
    per_page: 100,
  }
  if (filters?.search) params.search = filters.search
  return params
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null
}

function extractEventsFromResponse(root: unknown): ApiEvent[] {
  let candidate: unknown = root
  if (isRecord(root) && "data" in root) {
    candidate = (root as Record<string, unknown>).data
  }
  if (isRecord(candidate) && "events" in candidate) {
    const evs = (candidate as Record<string, unknown>).events
    return Array.isArray(evs) ? (evs as ApiEvent[]) : []
  }
  return Array.isArray(candidate) ? (candidate as ApiEvent[]) : []
}

export async function fetchEvents(
  range: DateRangeInput,
  filters?: EventFilters
): Promise<EventInput[]> {
  const selected = filters?.categoryIds ?? []
  const baseParams = buildBaseQuery(range, filters)

  const fetchOne = async (categoryId?: number) => {
    const params = { ...baseParams } as Record<string, string | number | boolean>
    if (typeof categoryId === "number") {
      params.category_id = categoryId
    }
    const res = await api.get("/events", { params })
    return extractEventsFromResponse(res.data)
  }

    let apiEvents: ApiEvent[];

  if (selected.length === 0) {
    apiEvents = await fetchOne()
  } else if (selected.length === 1) {
    apiEvents = await fetchOne(selected[0])
  } else {
    const results = await Promise.all(selected.map((id) => fetchOne(id)))
    const seen = new Set<string>()
    const merged: ApiEvent[] = []
    for (const list of results) {
      for (const ev of list) {
        const key = `${String(ev.id)}::${ev.start_datetime}`
        if (!seen.has(key)) {
          seen.add(key)
          merged.push(ev)
        }
      }
    }
    apiEvents = merged
  }

  return apiEvents.map(mapApiEventToEventInput)
}