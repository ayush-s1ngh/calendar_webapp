"use client"

/**
 * FullCalendar wrapper with unified plugins and custom event rendering.
 * Keeps config localized so CalendarWrapper stays focused on data/UX.
 */
import FullCalendar from "@fullcalendar/react"
import type { EventDropArg, DatesSetArg, EventContentArg, EventInput, EventClickArg, DateSelectArg } from "@fullcalendar/core"
import type { EventResizeDoneArg } from "@fullcalendar/interaction"
import dayGridPlugin from "@fullcalendar/daygrid"
import timeGridPlugin from "@fullcalendar/timegrid"
import listPlugin from "@fullcalendar/list"
import interactionPlugin from "@fullcalendar/interaction"
import {JSX, useCallback} from "react"
import "./FullCalendarStyles.css"

export interface StyledFullCalendarProps {
  events: EventInput[]
  onDatesSet?: (arg: DatesSetArg) => void
  calendarRef: React.RefObject<FullCalendar | null>
  onEventDrop?: (arg: EventDropArg) => void
  onEventResize?: (arg: EventResizeDoneArg) => void
  onEventClick?: (arg: EventClickArg) => void
  onDateSelect?: (arg: DateSelectArg) => void
}

type CalendarEventExt = {
  description?: string
  categoryIds?: number[]
  categoryName?: string
  categoryColorVar?: string
  is_recurring?: boolean
  recurrence_id?: string | null
}

export function StyledFullCalendar({
  events,
  onDatesSet,
  calendarRef,
  onEventDrop,
  onEventResize,
  onEventClick,
  onDateSelect,
}: StyledFullCalendarProps): JSX.Element {
  const renderEventContent = useCallback((arg: EventContentArg) => {
    const meta = arg.event.extendedProps as Partial<CalendarEventExt>
    const categoryColor = meta?.categoryColorVar
    const isList = arg.view.type.startsWith("list")
    const isAllDay = arg.event.allDay

    if (isList) {
      return {
        domNodes: [
          (() => {
            const outer = document.createElement("div")
            outer.className = "fc-custom-list-event flex items-center gap-2"
            const bullet = document.createElement("span")
            bullet.className = "inline-block size-2.5 rounded-full flex-shrink-0"
            if (categoryColor) bullet.style.background = String(categoryColor)
            const time = document.createElement("span")
            time.className = "text-xs tabular-nums text-muted-foreground"
            time.textContent = arg.timeText || ""
            const title = document.createElement("span")
            title.className = "font-medium truncate"
            title.textContent = arg.event.title
            outer.appendChild(bullet)
            if (arg.timeText) outer.appendChild(time)
            outer.appendChild(title)
            return outer
          })(),
        ],
      }
    }

    return {
      domNodes: [
        (() => {
          const container = document.createElement("div")
          container.className = "fc-custom-event flex items-center gap-1 overflow-hidden w-full"

          const bullet = document.createElement("span")
          bullet.className = "fc-custom-bullet inline-block size-2 rounded-full flex-shrink-0"
          if (categoryColor) bullet.style.background = String(categoryColor)

          const title = document.createElement("span")
          title.className = "truncate text-[11px] leading-tight"
          title.textContent = arg.event.title

          container.appendChild(bullet)
          container.appendChild(title)

          if (!isAllDay && arg.timeText) {
            const time = document.createElement("span")
            time.className = "fc-event-time tabular-nums text-[11px] text-muted-foreground"
            time.textContent = arg.timeText
            container.appendChild(time)
          }

          return container
        })(),
      ],
    }
  }, [])

  return (
    <FullCalendar
      ref={calendarRef as unknown as React.RefObject<FullCalendar>}
      height="100%"
      expandRows
      timeZone="local"
      firstDay={1}
      plugins={[dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin]}
      initialView="dayGridMonth"
      headerToolbar={false}
      events={events}
      eventContent={renderEventContent}
      datesSet={(arg) => onDatesSet?.(arg)}
      selectable
      select={onDateSelect}
      editable
      nowIndicator
      allDaySlot
      slotMinTime="00:00:00"
      slotMaxTime="24:00:00"
      dayMaxEventRows
      navLinks
      eventDrop={onEventDrop}
      eventResize={onEventResize}
      eventClick={onEventClick}
      navLinkDayClick={(date) => {
        calendarRef.current?.getApi().changeView("timeGridDay", date)
      }}
      slotLabelFormat={{
        hour: "numeric",
        minute: "2-digit",
        meridiem: "narrow",
        omitZeroMinute: true,
      }}
      eventTimeFormat={{
        hour: "numeric",
        minute: "2-digit",
        meridiem: "narrow",
        omitZeroMinute: true,
      }}
      views={{
        dayGridMonth: { dayHeaderFormat: { weekday: "short" } },
        timeGridWeek: {
          slotDuration: "00:30:00",
          dayHeaderFormat: { weekday: "short", day: "numeric" },
        },
        timeGridDay: {
          slotDuration: "00:30:00",
          dayHeaderFormat: { weekday: "short", month: "short", day: "numeric" },
        },
        listWeek: {
          dayHeaderFormat: { weekday: "long", month: "short", day: "numeric" },
        },
      }}
    />
  )
}