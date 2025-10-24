"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { StyledFullCalendar } from "./StyledFullCalendar"
import { fetchEvents } from "./useCalendarEvents"
import { DateRangeInput } from "./types-internal"
import type { EventDropArg, EventApi, EventInput, DatesSetArg, EventClickArg, DateSelectArg } from "@fullcalendar/core"
import type FullCalendar from "@fullcalendar/react"
import type { EventResizeDoneArg } from "@fullcalendar/interaction"
import { CalendarToolbar } from "./CalendarToolbar"
import { cn } from "@/lib/utils"
import api from "@/lib/api"
import { toast } from "sonner"
import { addDays, addHours, startOfDay, isSameDay } from "date-fns"
import { categoryStore } from "@/store/category"
import { useDebounce } from "@/hooks/useDebounce"
import { ViewEventDialog, CreateEventDialog, EditEventDialog } from "@/components/events"
import { utcIsoToLocalDate } from "@/lib/time"

function extractMessage(err: unknown, fallback: string) {
  return (
    (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
    fallback
  )
}

function getOldEventFromDropArg(arg: EventDropArg): EventApi | undefined {
  const maybe = arg as unknown as { oldEvent?: EventApi }
  return maybe.oldEvent
}

type EventData = {
  id: string | number
  title: string
  description?: string
  start_datetime: string
  end_datetime?: string
  is_all_day?: boolean
  color?: string
  categories?: Array<{ id: number; name: string; color?: string }>
  is_recurring?: boolean
  recurrence_id?: string | null
}

export function Calendar() {
  const calendarRef = useRef<FullCalendar | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const calendarBoxRef = useRef<HTMLDivElement | null>(null)

  const [events, setEvents] = useState<EventInput[]>([])
  const [title, setTitle] = useState("")
  const [currentView, setCurrentView] = useState("dayGridMonth")
  const [initialLoading, setInitialLoading] = useState(true)
  const initialLoadedRef = useRef(false)
  const lastRangeRef = useRef<DateRangeInput | null>(null)

  // Sidebar filters
  const { loadCategories, selectedCategoryIds, searchTerm } = categoryStore()
  const debouncedSearch = useDebounce(searchTerm, 400)
  const selectedCatKey = useMemo(
    () => Array.from(selectedCategoryIds).sort((a, b) => a - b).join(","),
    [selectedCategoryIds]
  )

  // Dialog states
  const [viewOpen, setViewOpen] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [selectedEvent, setSelectedEvent] = useState<EventData | null>(null)
  const [createInitialDate, setCreateInitialDate] = useState<Date | undefined>(undefined)
  const [createInitialStart, setCreateInitialStart] = useState<Date | undefined>(undefined)
  const [createInitialEnd, setCreateInitialEnd] = useState<Date | undefined>(undefined)
  const [createInitialAllDay, setCreateInitialAllDay] = useState(false)

  // Load categories once
  useEffect(() => {
    void loadCategories()
  }, [loadCategories])

  const loadRange = useCallback(async (range: DateRangeInput) => {
    try {
      lastRangeRef.current = range
      const data = await fetchEvents(range, {
        includeRecurring: true,
        categoryIds: Array.from(selectedCategoryIds),
        search: debouncedSearch || undefined,
      })
      setEvents(data)
    } catch (err) {
      toast.error(extractMessage(err, "Failed to load events"))
      setEvents([])
    } finally {
      if (!initialLoadedRef.current) {
        setInitialLoading(false)
        initialLoadedRef.current = true
      }
    }
  }, [selectedCategoryIds, debouncedSearch])

  const handleDatesSet = useCallback(
    (arg: DatesSetArg) => {
      setTitle(arg.view.title)
      setCurrentView(arg.view.type)
      loadRange({ start: arg.start, end: arg.end })
    },
    [loadRange]
  )

  // Reload when filters change
  useEffect(() => {
    if (lastRangeRef.current) {
      void loadRange(lastRangeRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCatKey, debouncedSearch])

  const handleEventDrop = useCallback(
      async (arg: EventDropArg) => {
        const ev = arg.event
        const id = ev.id
        const start = ev.start
        const currentEnd = ev.end
        if (!start) return
    
        const wasAllDay = getOldEventFromDropArg(arg)?.allDay ?? false
        const isAllDay = Boolean(ev.allDay)
    
        let nextStart: Date
        let nextEnd: Date
        let is_all_day = isAllDay
    
        if (isAllDay) {
          // All-day event: FullCalendar gives exclusive end, backend needs inclusive
          const dayStart = startOfDay(start)
          
          if (!currentEnd || currentEnd <= start) {
            // Single-day all-day event
            nextEnd = new Date(dayStart)
            nextEnd.setHours(23, 59, 59, 999)
          } else {
            // Multi-day: FullCalendar's end is exclusive (e.g., Oct 3 00:00 means ends on Oct 2)
            // Backend needs inclusive (Oct 2 23:59:59.999)
            const inclusiveEndDay = addDays(currentEnd, -1) // Convert exclusive to inclusive
            nextEnd = new Date(startOfDay(inclusiveEndDay))
            nextEnd.setHours(23, 59, 59, 999)
          }
          
          nextStart = dayStart
          is_all_day = true
        } else {
          // Timed event
          if (wasAllDay) {
            // Transitioning from all-day to timed
            nextEnd = addHours(start, 1)
          } else {
            nextEnd = currentEnd && currentEnd > start ? currentEnd : addHours(start, 1)
          }
          nextStart = start
          is_all_day = false
        }
    
        const payload = {
          start_datetime: nextStart.toISOString(),
          end_datetime: nextEnd.toISOString(),
          is_all_day,
        }
    
        try {
          await api.put(`/events/${encodeURIComponent(id)}`, payload)
          toast.success("Event updated")
          if (lastRangeRef.current) await loadRange(lastRangeRef.current)
        } catch (err) {
          arg.revert()
          toast.error(extractMessage(err, "Failed to update event"))
        }
      },
      [loadRange]
    )

  const handleEventResize = useCallback(
      async (arg: EventResizeDoneArg) => {
        const ev = arg.event
        const id = ev.id
        const start = ev.start
        const currentEnd = ev.end
        if (!start) return
    
        let nextEnd: Date
    
        if (ev.allDay) {
          // All-day resize: convert exclusive to inclusive
          const dayStart = startOfDay(start)
          
          if (!currentEnd || currentEnd <= start) {
            // Shouldn't happen, but fallback to single-day
            nextEnd = new Date(dayStart)
            nextEnd.setHours(23, 59, 59, 999)
          } else {
            // FullCalendar gives exclusive end (e.g., Oct 13 00:00 for ending on Oct 12)
            const inclusiveEndDay = addDays(currentEnd, -1)
            nextEnd = new Date(startOfDay(inclusiveEndDay))
            nextEnd.setHours(23, 59, 59, 999)
          }
        } else {
          // Timed event: end is already correct
          if (!currentEnd || currentEnd <= start) {
            nextEnd = addHours(start, 1)
          } else {
            nextEnd = currentEnd
          }
        }
    
        const payload = {
          start_datetime: start.toISOString(),
          end_datetime: nextEnd.toISOString(),
          is_all_day: Boolean(ev.allDay),
        }
    
        try {
          await api.put(`/events/${encodeURIComponent(id)}`, payload)
          toast.success("Event resized")
          if (lastRangeRef.current) await loadRange(lastRangeRef.current)
        } catch (err) {
          arg.revert()
          toast.error(extractMessage(err, "Failed to resize event"))
        }
      },
      [loadRange]
    )

  const handleEventClick = useCallback(async (arg: EventClickArg) => {
    const id = arg.event.id
    try {
      const res = await api.get(`/events/${encodeURIComponent(id)}`)
      const root = res?.data as unknown
      let eventData: unknown
      if (typeof root === "object" && root && "data" in (root as Record<string, unknown>)) {
        eventData = (root as Record<string, unknown>).data
      } else {
        eventData = root
      }
      if (typeof eventData === "object" && eventData && "event" in (eventData as Record<string, unknown>)) {
        eventData = (eventData as Record<string, unknown>).event
      }
      setSelectedEvent(eventData as EventData)
      setViewOpen(true)
    } catch (err) {
      toast.error(extractMessage(err, "Failed to load event details"))
    }
  }, [])

  const handleDateSelect = useCallback((arg: DateSelectArg) => {
      setCreateInitialDate(undefined)

      if (arg.allDay) {
        // FullCalendar gives exclusive end for all-day selections
        // User clicks Oct 15 → start=Oct 15 00:00, end=Oct 16 00:00 (exclusive)
        // User drags Oct 23-28 → start=Oct 23 00:00, end=Oct 29 00:00 (exclusive)

        const isSingleDay = isSameDay(arg.start, addDays(arg.end, -1))

        if (isSingleDay) {
          // Single day: both start and end should be the same date
          setCreateInitialStart(arg.start)
          setCreateInitialEnd(arg.start)
        } else {
          // Multi-day: convert exclusive to inclusive for the dialog
          setCreateInitialStart(arg.start)
          setCreateInitialEnd(addDays(arg.end, -1)) // Oct 29 → Oct 28
        }
      } else {
        // Timed slot selection
        setCreateInitialStart(arg.start)
        setCreateInitialEnd(arg.end)
      }

      setCreateInitialAllDay(arg.allDay)
      setCreateOpen(true)
      calendarRef.current?.getApi().unselect()
    }, [])

  const handleAddEvent = useCallback(() => {
    setCreateInitialDate(new Date())
    setCreateInitialStart(undefined)
    setCreateInitialEnd(undefined)
    setCreateInitialAllDay(false)
    setCreateOpen(true)
  }, [])

  const handleEventCreated = useCallback(() => {
    if (lastRangeRef.current) void loadRange(lastRangeRef.current)
  }, [loadRange])

  const handleEventUpdated = useCallback(() => {
    if (lastRangeRef.current) void loadRange(lastRangeRef.current)
  }, [loadRange])

  const handleEventDeleted = useCallback(() => {
    if (lastRangeRef.current) void loadRange(lastRangeRef.current)
  }, [loadRange])

  const handleEditClick = useCallback(() => {
    setViewOpen(false)
    setEditOpen(true)
  }, [])

  // ResizeObserver for sidebar transitions
  useEffect(() => {
    if (!containerRef.current) return
    const ro = new ResizeObserver(() => {
      calendarRef.current?.getApi().updateSize()
    })
    ro.observe(containerRef.current)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    const onResize = () => {
      calendarRef.current?.getApi().updateSize()
    }
    window.addEventListener("resize", onResize)
    return () => {
      window.removeEventListener("resize", onResize)
    }
  }, [])

  const apiRef = () => calendarRef.current?.getApi()
  const changeView = (view: string) => apiRef()?.changeView(view)
  const prev = () => apiRef()?.prev()
  const next = () => apiRef()?.next()
  const today = () => apiRef()?.today()

  return (
    <>
      <div ref={containerRef} className="flex flex-col flex-1 min-h-[calc(100vh-64px)]">
        <CalendarToolbar
          title={title}
          currentView={currentView}
          onChangeView={changeView}
          onPrev={prev}
          onNext={next}
          onToday={today}
          onAddEvent={handleAddEvent}
        />

        <div className="relative flex-1">
          {initialLoading && (
            <div className={cn("absolute inset-0 bg-muted/50 animate-in fade-in-0 rounded-xl")} />
          )}
          <div
            ref={calendarBoxRef}
            className={cn(
              "h-full rounded-xl border bg-background overflow-hidden",
              initialLoading && "opacity-0"
            )}
          >
            <StyledFullCalendar
              calendarRef={calendarRef}
              events={events}
              onDatesSet={handleDatesSet}
              onEventDrop={handleEventDrop}
              onEventResize={handleEventResize}
              onEventClick={handleEventClick}
              onDateSelect={handleDateSelect}
            />
          </div>
        </div>
      </div>

      <ViewEventDialog
        open={viewOpen}
        onOpenChange={setViewOpen}
        event={selectedEvent}
        onEditClick={handleEditClick}
        onDeleted={handleEventDeleted}
      />

      <CreateEventDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={handleEventCreated}
        initialDate={createInitialDate}
        initialStart={createInitialStart}
        initialEnd={createInitialEnd}
        initialAllDay={createInitialAllDay}
      />

      <EditEventDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        event={selectedEvent}
        onUpdated={handleEventUpdated}
      />
    </>
  )
}