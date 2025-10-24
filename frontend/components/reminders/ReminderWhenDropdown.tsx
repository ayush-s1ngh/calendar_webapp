"use client"

import * as React from "react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { ChevronDown, CalendarClock } from "lucide-react"
import { format } from "date-fns"
import {
  ReminderFormValue,
  ReminderFormMode,
  TimedPreset,
  AllDayPreset,
  DEFAULT_ALL_DAY_HOUR,
} from "@/components/reminders"

function labelForTimedPreset(p: TimedPreset) {
  switch (p) {
    case "at_start":
      return "At event start"
    case "min_5":
      return "5 minutes before"
    case "min_10":
      return "10 minutes before"
    case "min_15":
      return "15 minutes before"
    case "min_30":
      return "30 minutes before"
    case "hr_1":
      return "1 hour before"
  }
}

function labelForAllDayPreset(p: AllDayPreset) {
  switch (p) {
    case "same_day_9am":
      return `On event day at ${DEFAULT_ALL_DAY_HOUR}:00`
    case "day_1_before_9am":
      return `1 day before at ${DEFAULT_ALL_DAY_HOUR}:00`
    case "day_2_before_9am":
      return `2 days before at ${DEFAULT_ALL_DAY_HOUR}:00`
    case "week_1_before_9am":
      return `1 week before at ${DEFAULT_ALL_DAY_HOUR}:00`
  }
}

function currentLabel(
  v: ReminderFormValue,
  isAllDay: boolean
) {
  if (!isAllDay) {
    if (v.mode === "preset" && v.preset) return labelForTimedPreset(v.preset as TimedPreset)
    if (v.mode === "custom" && typeof v.customMinutes === "number") {
      const m = Math.max(0, Math.floor(v.customMinutes))
      if (m === 0) return "At event start"
      if (m < 60) return `${m} minutes before`
      const hrs = Math.floor(m / 60)
      return `${hrs} hour${hrs > 1 ? "s" : ""} before`
    }
    return "Remind me..."
  }

  if (v.mode === "preset" && v.preset) return labelForAllDayPreset(v.preset as AllDayPreset)
  if (v.mode === "custom" && v.customDateTime) {
    return format(v.customDateTime, "EEE, MMM d, h:mm a")
  }
  return "Remind me..."
}

export function ReminderWhenDropdown({
  isAllDay,
  value,
  onChange,
  onOpenCustomTimed,
  onOpenCustomAllDay,
  disabled,
}: {
  isAllDay: boolean
  value: ReminderFormValue
  onChange: (v: ReminderFormValue) => void
  onOpenCustomTimed?: () => void
  onOpenCustomAllDay?: () => void
  disabled?: boolean
}) {
  const [open, setOpen] = React.useState(false)

  const selectPreset = (preset: TimedPreset | AllDayPreset) => {
    const next: ReminderFormValue = {
      ...value,
      mode: "preset" as ReminderFormMode,
      preset,
      customMinutes: undefined,
      customDateTime: undefined,
    }
    onChange(next)
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          // Fixed width from md+; full-width on mobile. Truncate long labels.
          className="justify-between w-full md:w-[220px] md:shrink-0"
          disabled={disabled}
          aria-label="Select reminder time"
        >
          <CalendarClock className="size-4 align-center" />
          <span className="truncate">{currentLabel(value, isAllDay)}</span>
          <ChevronDown className="size-4 opacity-70" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-64">
        {!isAllDay ? (
          <>
            <DropdownMenuItem onSelect={(e) => { e.preventDefault(); selectPreset("at_start") }}>
              At event start
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={(e) => { e.preventDefault(); selectPreset("min_5") }}>
              5 minutes before
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={(e) => { e.preventDefault(); selectPreset("min_10") }}>
              10 minutes before
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={(e) => { e.preventDefault(); selectPreset("min_15") }}>
              15 minutes before
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={(e) => { e.preventDefault(); selectPreset("min_30") }}>
              30 minutes before
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={(e) => { e.preventDefault(); selectPreset("hr_1") }}>
              1 hour before
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={(e) => {
                e.preventDefault()
                onOpenCustomTimed?.()
              }}
            >
              Custom...
            </DropdownMenuItem>
          </>
        ) : (
          <>
            {/* Removed "On event day at 9:00 AM" option */}
            <DropdownMenuItem onSelect={(e) => { e.preventDefault(); selectPreset("day_1_before_9am") }}>
              1 day before at {DEFAULT_ALL_DAY_HOUR}:00
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={(e) => { e.preventDefault(); selectPreset("day_2_before_9am") }}>
              2 days before at {DEFAULT_ALL_DAY_HOUR}:00
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={(e) => { e.preventDefault(); selectPreset("week_1_before_9am") }}>
              1 week before at {DEFAULT_ALL_DAY_HOUR}:00
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={(e) => {
                e.preventDefault()
                onOpenCustomAllDay?.()
              }}
            >
              Custom...
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}