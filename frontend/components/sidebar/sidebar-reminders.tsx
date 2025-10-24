"use client"

import * as React from "react"
import { addDays, format, isSameDay } from "date-fns"
import { ChevronDown, ChevronUp, Clock, Calendar as CalendarIcon, Pencil } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
} from "@/components/ui/sidebar"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import api from "@/lib/api"

import { ViewEventDialog } from "@/components/events/ViewEventDialog"
import { EditEventDialog } from "@/components/events/EditEventDialog"
import { EventData } from "@/components/events/event-utils"
import {
  ApiReminder,
  formatReminderTimingForDisplay,
  formatNotificationTypeLabel,
  getReminderLocalTriggerDate,
} from "@/components/reminders"

type EventWithReminders = {
  event: EventData
  reminders: ApiReminder[]
  nextTrigger: Date
}

function extractEventsUnknown(root: any): EventData[] {
  // Try to be resilient to multiple shapes
  if (Array.isArray(root)) return root as EventData[]
  if (Array.isArray(root?.events)) return root.events as EventData[]
  if (Array.isArray(root?.data)) return root.data as EventData[]
  if (Array.isArray(root?.data?.events)) return root.data.events as EventData[]
  return []
}

async function fetchEventReminders(eventId: string | number): Promise<ApiReminder[]> {
  try {
    const res = await api.get(`/reminders/event/${encodeURIComponent(String(eventId))}/reminders`)
    const d = res?.data
    if (Array.isArray(d)) return d as ApiReminder[]
    if (Array.isArray(d?.reminders)) return d.reminders as ApiReminder[]
    if (Array.isArray(d?.data)) return d.data as ApiReminder[]
    if (Array.isArray(d?.data?.reminders)) return d.data.reminders as ApiReminder[]
    return []
  } catch {
    return []
  }
}

export function SidebarReminders() {
  const [open, setOpen] = React.useState(false)
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [groups, setGroups] = React.useState<EventWithReminders[]>([])
  const [stale, setStale] = React.useState(false)

  // Dialog state
  const [viewOpen, setViewOpen] = React.useState(false)
  const [editOpen, setEditOpen] = React.useState(false)
  const [activeEvent, setActiveEvent] = React.useState<EventData | null>(null)

  const rangeNow = React.useMemo(() => new Date(), [])
  const rangeEnd = React.useMemo(() => addDays(rangeNow, 30), [rangeNow])
  // Safety: fetch events out to 37 days to catch "1 week before" reminders that still fall within the next 30 days
  const eventsFetchEnd = React.useMemo(() => addDays(rangeNow, 45), [rangeNow])

  const withinWindowOrPastToday = React.useCallback((dt: Date) => {
    const now = new Date()
    const startOfToday = new Date(now)
    startOfToday.setHours(0, 0, 0, 0)
    // in-window future reminder
    if (dt >= now && dt <= rangeEnd) return true
    // today-but-past reminder
    if (isSameDay(dt, now) && dt < now) return true
    return false
  }, [rangeEnd])

  const load = React.useCallback(async () => {
    setLoading(true)
    setError(null)
    setStale(false)
    try {
      // 1) Fetch events in a broad enough window
      const res = await api.get("/events", {
        params: {
          start_date: rangeNow.toISOString(),
          end_date: eventsFetchEnd.toISOString(),
          include_recurring: true,
          per_page: 100,
        },
      })
      const events = extractEventsUnknown(res?.data)

      // 2) For each event, fetch reminders
      const results: EventWithReminders[] = []
      // Fetch reminders sequentially to avoid overwhelming API; short-circuit if we already have >5 viable groups
      for (const ev of events) {
        const reminders = await fetchEventReminders(ev.id)
        if (!reminders.length) continue

        // Compute trigger times and keep ones in our window (or earlier today)
        const withTriggers = reminders
          .map((r) => {
            const trigger = getReminderLocalTriggerDate(r, ev.start_datetime)
            return { r, trigger }
          })
          .filter(({ trigger }) => withinWindowOrPastToday(trigger))
          .sort((a, b) => a.trigger.getTime() - b.trigger.getTime())

        if (withTriggers.length === 0) continue

        const nextTrigger = withTriggers[0].trigger
        results.push({
          event: ev,
          reminders: withTriggers.map((x) => x.r),
          nextTrigger,
        })

        // Continue scanning all events to ensure correct global ordering, then we will slice to first 5
      }

      // 3) Sort groups by their next upcoming trigger and keep the first 5
      results.sort((a, b) => a.nextTrigger.getTime() - b.nextTrigger.getTime())
      setGroups(results.slice(0, 5))
    } catch (e: any) {
      setError(e?.response?.data?.message || "Unable to load reminders")
      setGroups([])
    } finally {
      setLoading(false)
    }
  }, [rangeNow, eventsFetchEnd, withinWindowOrPastToday])

  // Lazy load on open
  React.useEffect(() => {
    if (open && (stale || groups.length === 0) && !loading) {
      void load()
    }
  }, [open, stale, groups.length, loading, load])

  // Auto-refresh when dialogs signal changes
  React.useEffect(() => {
    const handler = () => {
      if (open) {
        void load()
      } else {
        setStale(true)
      }
    }
    window.addEventListener("reminders:refresh", handler as any)
    return () => window.removeEventListener("reminders:refresh", handler as any)
  }, [open, load])

  // Helpers for display
  function formatEventLine(ev: EventData) {
    const start = new Date(ev.start_datetime)
    const end = ev.end_datetime ? new Date(ev.end_datetime) : null
    if (ev.is_all_day) {
      if (end && !isSameDay(start, end)) {
        return `${format(start, "EEE, MMM d")} – ${format(end, "EEE, MMM d")}`
      }
      return format(start, "EEE, MMM d")
    }
    if (end && !isSameDay(start, end)) {
      return `${format(start, "EEE, MMM d")} – ${format(end, "EEE, MMM d")}`
    }
    return `${format(start, "EEE, MMM d")} • ${format(start, "h:mm a")}${end ? ` – ${format(end, "h:mm a")}` : ""}`
  }

  // Click handlers
  function openView(ev: EventData) {
    setActiveEvent(ev)
    setViewOpen(true)
  }
  function openEdit(ev: EventData) {
    setActiveEvent(ev)
    setEditOpen(true)
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
            <SidebarGroupContent className="mt-2 space-y-2">
              {loading && (
                <div className="space-y-2">
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="rounded-md border p-2">
                      <Skeleton className="h-4 w-2/3" />
                      <div className="mt-2 space-y-1">
                        <Skeleton className="h-3 w-1/2" />
                        <Skeleton className="h-3 w-1/3" />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {!loading && error && (
                <div className="rounded-md border p-3 text-sm">
                  <div className="text-destructive mb-2">{error}</div>
                  <Button variant="outline" size="sm" onClick={() => void load()}>
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
                  {groups.map((g) => (
                    <div
                      key={String(g.event.id)}
                      className="rounded-md border p-2 hover:bg-accent/50 transition-colors"
                    >
                      <button
                        className="text-left w-full"
                        onClick={() => openView(g.event)}
                        aria-label={`Open event ${g.event.title}`}
                        title="Open event"
                      >
                        <div className="flex items-center gap-2">
                          <CalendarIcon className="size-4 text-muted-foreground" />
                          <div className="text-sm font-medium truncate">{g.event.title}</div>
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                          <Clock className="size-3" />
                          <span>{formatEventLine(g.event)}</span>
                        </div>
                      </button>

                      <div className="mt-2 space-y-1">
                        {g.reminders.map((r) => (
                          <div key={r.id} className="text-xs flex items-center justify-between">
                            <span className="text-muted-foreground">
                              • {formatReminderTimingForDisplay(r, g.event.start_datetime)}
                            </span>
                            <span className="text-muted-foreground">
                              {formatNotificationTypeLabel(r.notification_type)}
                            </span>
                          </div>
                        ))}
                      </div>

                      <div className="mt-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openEdit(g.event)}
                          aria-label="Edit Event"
                          title="Edit Event"
                        >
                          <Pencil className="size-4" />
                          Edit Event
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </SidebarGroupContent>
          </CollapsibleContent>
        </Collapsible>
      </SidebarGroup>

      {/* View Event Dialog */}
      <ViewEventDialog
        open={viewOpen}
        onOpenChange={setViewOpen}
        event={activeEvent}
        onEditClick={() => {
          setViewOpen(false)
          setTimeout(() => setEditOpen(true), 10)
        }}
        onDeleted={() => {
          // Make the sidebar refresh if the active event was deleted
          window.dispatchEvent(new CustomEvent("reminders:refresh"))
        }}
      />

      {/* Edit Event Dialog (Manage Reminders pre-expanded) */}
      <EditEventDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        event={activeEvent}
        onUpdated={() => {
          window.dispatchEvent(new CustomEvent("reminders:refresh"))
        }}
        openManageInitially
      />
    </>
  )
}