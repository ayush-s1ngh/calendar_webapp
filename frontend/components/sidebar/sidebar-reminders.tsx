"use client"

import * as React from "react"
import { addDays, format, isSameDay } from "date-fns"
import { Calendar as CalendarIcon, ChevronDown, ChevronUp, Clock, Mail, Smartphone, MessageCircle } from "lucide-react"
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
  NotificationType,
} from "@/components/reminders"
import { ViewEventDialog } from "@/components/events/ViewEventDialog"
import { EditEventDialog } from "@/components/events/EditEventDialog"

type EventWithReminders = {
  event: EventData
  reminders: ApiReminder[]
  nextTrigger: Date
}

function extractEventsUnknown(root: any): EventData[] {
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

function TypeIcon({ type, className }: { type: NotificationType; className?: string }) {
  if (type === "email") return <Mail className={className ?? "size-4"} />
  if (type === "push") return <Smartphone className={className ?? "size-4"} />
  return <MessageCircle className={className ?? "size-4"} />
}

export function SidebarReminders() {
  const [open, setOpen] = React.useState(false)
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [groups, setGroups] = React.useState<EventWithReminders[]>([])
  const [stale, setStale] = React.useState(false)

  // Dialogs
  const [viewOpen, setViewOpen] = React.useState(false)
  const [editOpen, setEditOpen] = React.useState(false)
  const [activeEvent, setActiveEvent] = React.useState<EventData | null>(null)

  const nowRef = React.useRef(new Date())
  const rangeNow = nowRef.current
  const rangeEnd = React.useMemo(() => addDays(rangeNow, 30), [rangeNow])
  // Fetch a little beyond 30d so we catch reminders that are "X before" for events slightly outside the 30d window
  const eventsFetchEnd = React.useMemo(() => addDays(rangeNow, 45), [rangeNow])

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
    try {
      const res = await api.get("/events", {
        params: {
          start_date: rangeNow.toISOString(),
          end_date: eventsFetchEnd.toISOString(),
          include_recurring: true,
          per_page: 100,
        },
      })
      const events = extractEventsUnknown(res?.data)

      const results: EventWithReminders[] = []
      for (const ev of events) {
        const reminders = await fetchEventReminders(ev.id)
        if (!reminders.length) continue

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
      }

      results.sort((a, b) => a.nextTrigger.getTime() - b.nextTrigger.getTime())
      setGroups(results.slice(0, 5))
    } catch (e: any) {
      setError(e?.response?.data?.message || "Unable to load reminders")
      setGroups([])
    } finally {
      setLoading(false)
    }
  }, [eventsFetchEnd, rangeNow, withinWindowOrPastToday])

  // Lazy load on open
  React.useEffect(() => {
    if (open && (stale || groups.length === 0) && !loading) {
      void load()
    }
  }, [open, stale, groups.length, loading, load])

  // Auto refresh signal
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
            <SidebarGroupContent className="mt-2 space-y-2">
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
                        {/* Category color strip */}
                        <div
                          className="absolute left-0 top-0 bottom-0 w-1 rounded-l-md"
                          style={{ background: color }}
                        />
                        {/* Clickable area for opening View dialog */}
                        <button
                          className="text-left w-full"
                          onClick={() => openView(g.event)}
                          aria-label={`Open event ${g.event.title}`}
                          title="Open event"
                        >
                          {/* Second row: Event Date (left) | Event Time (right) */}
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

                          {/* Reminders list: bullet + exact date/time | type icon */}
                          <div className="mt-2 space-y-1">
                            {remindersWithTrigger.map(({ r, trigger }) => (
                              <div key={r.id} className="text-xs flex items-center justify-between gap-2">
                                <span className="text-muted-foreground">
                                  • {formatReminderExact(trigger)}
                                </span>
                                <TypeIcon type={r.notification_type} className="size-4 text-muted-foreground" />
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

      {/* View Event Dialog */}
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

      {/* Edit Event Dialog */}
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