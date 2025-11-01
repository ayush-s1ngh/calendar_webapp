"use client"

/**
 * Upcoming reminders preview (next 30 days).
 * - Fetches events (45-day window) then loads reminders per event in parallel
 * - Sorts by next trigger time and shows top 5 groups
 * - Listens to `reminders:refresh` to refresh on changes
 */
import * as React from "react"
import { JSX } from "react"
import { addDays, format, isSameDay } from "date-fns"
import { Calendar as CalendarIcon, ChevronDown, ChevronUp, Clock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
} from "@/components/ui/sidebar"
import api from "@/lib/api"
import type { EventData } from "@/components/events"
import {
  ApiReminder,
  getReminderLocalTriggerDate,
  fetchRemindersForEvent,
  ReminderTypeIcon,
} from "@/components/reminders"
import { ViewEventDialog } from "@/components/events/ViewEventDialog"
import { EditEventDialog } from "@/components/events/EditEventDialog"

const UPCOMING_WINDOW_DAYS = 30
const EVENTS_FETCH_PAD_DAYS = 45
const EVENTS_PER_PAGE = 100

type EventWithReminders = {
  event: EventData
  reminders: ApiReminder[]
  nextTrigger: Date
}

function extractEventsUnknown(root: unknown): EventData[] {
  const r = root as Record<string, unknown> | unknown[]
  if (Array.isArray(r)) return r as EventData[]
  if (r && typeof r === "object") {
    const obj = r as Record<string, unknown>
    if (Array.isArray((obj as { events?: unknown }).events)) {
      return (obj as { events: EventData[] }).events
    }
    if (Array.isArray((obj as { data?: unknown }).data)) {
      return (obj as { data: EventData[] }).data
    }
    if (obj.data && typeof obj.data === "object") {
      const d = obj.data as Record<string, unknown>
      const maybeEvents = (d as { events?: unknown }).events
      if (Array.isArray(maybeEvents)) return maybeEvents as EventData[]
    }
  }
  return []
}

type ErrorLike = { response?: { data?: { message?: string } } }
function getMessage(err: unknown, fallback: string) {
  return (err as ErrorLike)?.response?.data?.message ?? fallback
}

export function SidebarReminders(): JSX.Element {
  const [open, setOpen] = React.useState(false)
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [groups, setGroups] = React.useState<EventWithReminders[]>([])
  const [stale, setStale] = React.useState(false)
  const [loadedOnce, setLoadedOnce] = React.useState(false)

  const [viewOpen, setViewOpen] = React.useState(false)
  const [editOpen, setEditOpen] = React.useState(false)
  const [activeEvent, setActiveEvent] = React.useState<EventData | null>(null)

  const nowRef = React.useRef(new Date())
  const rangeNow = nowRef.current
  const rangeEnd = React.useMemo(() => addDays(rangeNow, UPCOMING_WINDOW_DAYS), [rangeNow])
  const eventsFetchEnd = React.useMemo(() => addDays(rangeNow, EVENTS_FETCH_PAD_DAYS), [rangeNow])

  const withinWindowOrPastToday = React.useCallback(
    (dt: Date) => {
      const now = new Date()
      if (dt >= now && dt <= rangeEnd) return true
      if (isSameDay(dt, now) && dt < now) return true
      return false
    },
    [rangeEnd]
  )

  const load = React.useCallback(async () => {
    setLoading(true)
    setError(null)
    setStale(false)
    setLoadedOnce(true)
    try {
      const res = await api.get("/events", {
        params: {
          start_date: rangeNow.toISOString(),
          end_date: eventsFetchEnd.toISOString(),
          include_recurring: true,
          per_page: EVENTS_PER_PAGE,
        },
      })
      const events = extractEventsUnknown(res?.data)

      const settled = await Promise.allSettled(
        events.map(async (ev) => {
          const reminders = await fetchRemindersForEvent(ev.id)
          if (!reminders.length) return null

          const withTriggers = reminders
            .map((r) => ({ r, trigger: getReminderLocalTriggerDate(r, ev.start_datetime) }))
            .filter(({ trigger }) => withinWindowOrPastToday(trigger))
            .sort((a, b) => a.trigger.getTime() - b.trigger.getTime())

          if (withTriggers.length === 0) return null

          const nextTrigger = withTriggers[0].trigger
          const group: EventWithReminders = {
            event: ev,
            reminders: withTriggers.map((x) => x.r),
            nextTrigger,
          }
          return group
        })
      )

      const results: EventWithReminders[] = []
      for (const s of settled) {
        if (s.status === "fulfilled" && s.value) results.push(s.value)
      }

      results.sort((a, b) => a.nextTrigger.getTime() - b.nextTrigger.getTime())
      setGroups(results.slice(0, 5))
    } catch (e: unknown) {
      setError(getMessage(e, "Unable to load reminders"))
      setGroups([])
    } finally {
      setLoading(false)
    }
  }, [eventsFetchEnd, rangeNow, withinWindowOrPastToday])

  React.useEffect(() => {
    if (open && !loading && (stale || !loadedOnce)) {
      void load()
    }
  }, [open, loading, stale, loadedOnce, load])

  React.useEffect(() => {
    const handler: EventListener = () => {
      if (open) {
        void load()
      } else {
        setStale(true)
      }
    }
    window.addEventListener("reminders:refresh", handler)
    return () => window.removeEventListener("reminders:refresh", handler)
  }, [open, load])

  function openView(ev: EventData) {
    setActiveEvent(ev)
    setViewOpen(true)
  }

  function primaryCategoryColor(ev: EventData) {
    const color = ev.categories?.[0]?.color
    return color || "var(--sidebar-ring)"
  }

  function formatEventDate(ev: EventData) {
    const d = new Date(ev.start_datetime)
    return format(d, "EEE, MMM d, yyyy")
  }

  function formatEventTime(ev: EventData) {
    if (ev.is_all_day) return "All day"
    const start = new Date(ev.start_datetime)
    return format(start, "h:mm a")
  }

  function formatReminderExact(trigger: Date) {
    return format(trigger, "EEE, MMM d, h:mm a")
  }

  return (
    <>
      <SidebarGroup className="group-data-[collapsible=icon]:hidden">
        <Collapsible open={open} onOpenChange={setOpen}>
          <div className="flex items-center justify-between">
            <SidebarGroupLabel>Reminders</SidebarGroupLabel>
            <CollapsibleTrigger asChild>
              <Button variant="outline" size="sm">
                {open ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
                {open ? "Hide" : "Show"}
              </Button>
            </CollapsibleTrigger>
          </div>

          <CollapsibleContent>
            <SidebarGroupContent className="mt-2 space-y-2" aria-busy={loading}>
              {loading && (
                <div className="space-y-2">
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="relative rounded-md border p-3">
                      <div className="absolute left-0 top-0 bottom-0 w-1 rounded-l-md bg-accent" />
                      <Skeleton className="h-4 w-2/3" />
                      <div className="mt-2 flex items-center justify-between gap-2">
                        <Skeleton className="h-3 w-28" />
                        <Skeleton className="h-3 w-16" />
                      </div>
                      <div className="mt-2 space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <Skeleton className="h-3 w-40" />
                          <Skeleton className="h-3 w-5" />
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <Skeleton className="h-3 w-32" />
                          <Skeleton className="h-3 w-5" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {!loading && error && (
                <div className="rounded-md border p-3 text-sm">
                  <div className="text-destructive mb-2">{error}</div>
                  <Button type="button" variant="outline" size="sm" onClick={() => void load()}>
                    Retry
                  </Button>
                </div>
              )}

              {!loading && !error && groups.length === 0 && (
                <div className="rounded-md border p-3 text-sm text-muted-foreground">
                  <div>No upcoming reminders</div>
                  <div>Add reminders to events to get notified.</div>
                </div>
              )}

              {!loading && !error && groups.length > 0 && (
                <div className="space-y-2">
                  {groups.map((g) => {
                    const color = primaryCategoryColor(g.event)
                    const remindersWithTrigger = g.reminders
                      .map((r) => ({ r, trigger: getReminderLocalTriggerDate(r, g.event.start_datetime) }))
                      .sort((a, b) => a.trigger.getTime() - b.trigger.getTime())

                    return (
                      <div
                        key={String(g.event.id)}
                        className="relative rounded-md border p-3 hover:bg-accent/50 transition-colors"
                      >
                        <div
                          className="absolute left-0 top-0 bottom-0 w-1 rounded-l-md"
                          style={{ background: color }}
                        />
                        <button
                          type="button"
                          className="text-left w-full"
                          onClick={() => openView(g.event)}
                          aria-label={`Open event ${g.event.title}`}
                          title="Open event"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="text-sm font-medium truncate pr-8">{g.event.title}</div>
                          </div>
                          <div className="text-xs text-muted-foreground mt-1 flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1">
                              <CalendarIcon className="size-3" />
                              <span>{formatEventDate(g.event)}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              {!g.event.is_all_day && <Clock className="size-3" />}
                              <span>{formatEventTime(g.event)}</span>
                            </div>
                          </div>

                          <div className="mt-2 space-y-1">
                            {remindersWithTrigger.map(({ r, trigger }) => (
                              <div key={r.id} className="text-xs flex items-center justify-between gap-2">
                                <span className="text-muted-foreground">
                                  • {formatReminderExact(trigger)}
                                </span>
                                <ReminderTypeIcon type={r.notification_type} className="size-4 text-muted-foreground" />
                              </div>
                            ))}
                          </div>
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}
            </SidebarGroupContent>
          </CollapsibleContent>
        </Collapsible>
      </SidebarGroup>

      <ViewEventDialog
        open={viewOpen}
        onOpenChangeAction={setViewOpen}
        event={activeEvent}
        onEditClickAction={() => {
          setViewOpen(false)
          setTimeout(() => setEditOpen(true), 10)
        }}
        onDeletedAction={() => {
          try {
            window.dispatchEvent(new CustomEvent("reminders:refresh"))
          } catch {}
        }}
      />

      <EditEventDialog
        open={editOpen}
        onOpenChangeAction={setEditOpen}
        event={activeEvent}
        onUpdatedAction={() => {
          try {
            window.dispatchEvent(new CustomEvent("reminders:refresh"))
          } catch {}
        }}
        openManageInitially
      />
    </>
  )
}