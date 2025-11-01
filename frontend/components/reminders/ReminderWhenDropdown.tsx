"use client"

/**
 * Dropdown for choosing when a reminder should trigger.
 * - Provides timed and all-day presets
 * - Closes on selection
 * - Uses shared formatter for current label
 */
import { JSX } from "react"
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
import { formatReminderFormValueLabel, ReminderFormValue, ReminderFormMode, TimedPreset, AllDayPreset, DEFAULT_ALL_DAY_HOUR } from "@/components/reminders"
import { cn } from "@/lib/utils"

export function ReminderWhenDropdown({
  isAllDay,
  value,
  onChangeAction,
  onOpenCustomTimedAction,
  onOpenCustomAllDayAction,
  disabled,
  grow = false,
}: {
  isAllDay: boolean
  value: ReminderFormValue
  onChangeAction: (v: ReminderFormValue) => void
  onOpenCustomTimedAction?: () => void
  onOpenCustomAllDayAction?: () => void
  disabled?: boolean
  grow?: boolean
}): JSX.Element {
  const [open, setOpen] = React.useState(false)

  const selectPreset = (preset: TimedPreset | AllDayPreset) => {
    const next: ReminderFormValue = {
      ...value,
      mode: "preset" as ReminderFormMode,
      preset,
      customMinutes: undefined,
      customDateTime: undefined,
    }
    onChangeAction(next)
    setOpen(false)
  }

  const triggerClasses = cn(
    "justify-between w-full",
    grow ? "md:min-w-[220px] md:flex-1" : "md:w-[220px] md:shrink-0"
  )

  const label = formatReminderFormValueLabel(isAllDay, value)

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={triggerClasses}
          disabled={disabled}
          aria-label="Select reminder time"
        >
          <CalendarClock className="size-4" />
          <span className="truncate">{label}</span>
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
                setOpen(false)
                onOpenCustomTimedAction?.()
              }}
            >
              Custom...
            </DropdownMenuItem>
          </>
        ) : (
          <>
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
                setOpen(false)
                onOpenCustomAllDayAction?.()
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