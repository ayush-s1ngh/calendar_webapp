"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { Trash2, Pencil } from "lucide-react"
import {
  ReminderFormValue,
  ReminderFormMode,
  TimedPreset,
  AllDayPreset,
} from "@/components/reminders"
import { ReminderWhenDropdown } from "./ReminderWhenDropdown"
import { ReminderHowDropdown } from "./ReminderHowDropdown"
import { CustomReminderDialog } from "./CustomReminderDialog"
import { CustomAllDayReminderDialog } from "./CustomAllDayReminderDialog"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

export function ReminderFormRow({
  value,
  isAllDay,
  eventLocalStart,
  onChange,
  onDelete,
  disabled,
}: {
  value: ReminderFormValue
  isAllDay: boolean
  eventLocalStart: Date
  onChange: (v: ReminderFormValue) => void
  onDelete: () => void
  disabled?: boolean
}) {
  const [openCustomTimed, setOpenCustomTimed] = React.useState(false)
  const [openCustomAllDay, setOpenCustomAllDay] = React.useState(false)

  const handleSaveCustomMinutes = (m: number) => {
    onChange({
      ...value,
      mode: "custom" as ReminderFormMode,
      customMinutes: m,
      preset: undefined,
      customDateTime: undefined,
    })
  }

  const handleSaveCustomDateTime = (dt: Date) => {
    onChange({
      ...value,
      mode: "custom" as ReminderFormMode,
      customDateTime: dt,
      preset: undefined,
      customMinutes: undefined,
    })
  }

  return (
    <div className="flex flex-col md:flex-row items-stretch md:items-center gap-2 rounded-md border bg-card/60 px-3 py-2">
      <div className="flex-1 flex flex-col sm:flex-row gap-2">
        <ReminderWhenDropdown
          isAllDay={isAllDay}
          eventLocalStart={eventLocalStart}
          value={value}
          onChange={(v) => onChange(v)}
          onOpenCustomTimed={() => setOpenCustomTimed(true)}
          onOpenCustomAllDay={() => setOpenCustomAllDay(true)}
          disabled={disabled}
        />
        <ReminderHowDropdown
          value={value.notificationType}
          onChange={(t) => onChange({ ...value, notificationType: t })}
          disabled={disabled}
        />
      </div>

      <div className="flex items-center gap-1 ml-auto">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              aria-label="Edit reminder"
              title="Edit"
              onClick={() => {
                if (isAllDay) setOpenCustomAllDay(true)
                else setOpenCustomTimed(true)
              }}
              disabled={disabled}
            >
              <Pencil className="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Edit</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="destructive"
              size="icon-sm"
              aria-label="Delete reminder"
              title="Delete"
              onClick={onDelete}
              disabled={disabled}
            >
              <Trash2 className="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Delete</TooltipContent>
        </Tooltip>
      </div>

      {!isAllDay && (
        <CustomReminderDialog
          open={openCustomTimed}
          onOpenChange={setOpenCustomTimed}
          initialMinutes={
            value.mode === "custom" && typeof value.customMinutes === "number"
              ? value.customMinutes
              : 15
          }
          onSave={handleSaveCustomMinutes}
        />
      )}

      {isAllDay && (
        <CustomAllDayReminderDialog
          open={openCustomAllDay}
          onOpenChange={setOpenCustomAllDay}
          initialDateTime={value.mode === "custom" ? value.customDateTime : undefined}
          onSave={handleSaveCustomDateTime}
        />
      )}
    </div>
  )
}