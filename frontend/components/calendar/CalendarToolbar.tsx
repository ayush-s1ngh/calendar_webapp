"use client"

/**
 * Lightweight toolbar for FullCalendar views.
 * - Avoids unnecessary re-renders via React memo
 * - Provides accessible controls for navigation and view switching
 */
import {JSX, memo, useCallback} from "react"
import { Button } from "@/components/ui/button"
import { Toggle } from "@/components/ui/toggle"
import { cn } from "@/lib/utils"
import { Plus } from "lucide-react"

interface CalendarToolbarProps {
  title: string
  currentView: string
  onChangeView: (view: string) => void
  onPrev: () => void
  onNext: () => void
  onToday: () => void
  onAddEvent: () => void
}

const VIEWS = [
  { id: "dayGridMonth", label: "Month" },
  { id: "timeGridWeek", label: "Week" },
  { id: "timeGridDay", label: "Day" },
  { id: "listWeek", label: "List" },
] as const

export const CalendarToolbar = memo(function CalendarToolbar({
  title,
  currentView,
  onChangeView,
  onPrev,
  onNext,
  onToday,
  onAddEvent,
}: CalendarToolbarProps): JSX.Element {
  const handleView = useCallback(
    (id: string) => {
      if (id !== currentView) onChangeView(id)
    },
    [currentView, onChangeView]
  )

  return (
    <div className="flex flex-col gap-3 py-2 px-1 md:px-0">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          onClick={onAddEvent}
          size="sm"
          className="bg-primary text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="size-4" />
          Add Event
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={onToday}
          aria-label="Go to today"
          className="font-medium"
        >
          Today
        </Button>
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon-sm"
            onClick={onPrev}
            aria-label="Previous period"
          >
            ‹
          </Button>
          <Button
            variant="outline"
            size="icon-sm"
            onClick={onNext}
            aria-label="Next period"
          >
            ›
          </Button>
        </div>
        <h2 className="font-semibold text-sm md:text-base ml-1 md:ml-2 select-none">
          {title}
        </h2>

        <div className="ml-auto flex items-center rounded-full bg-muted/60 p-1 gap-1 border border-border/60">
          {VIEWS.map((v) => (
            <Toggle
              key={v.id}
              pressed={currentView === v.id}
              onPressedChange={() => handleView(v.id)}
              aria-label={`Switch to ${v.label} view`}
              className={cn(
                "text-xs font-medium px-3 h-7 rounded-full data-[state=on]:bg-background data-[state=on]:shadow-sm data-[state=on]:text-foreground",
                "uppercase tracking-wide"
              )}
            >
              {v.label}
            </Toggle>
          ))}
        </div>
      </div>
    </div>
  )
})