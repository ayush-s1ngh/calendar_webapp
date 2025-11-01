"use client"

import { JSX } from "react"
import * as React from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { toast } from "sonner"
import api from "@/lib/api"
import { categoryStore } from "@/store/category"
import { localDateToUtcIso } from "@/lib/time"
import { getErrorMessage } from "@/lib/errors"
import { EventBasicsFields } from "./EventBasicsFields"
import { eventSchema, type EventFormValues } from "./event-utils"
import {
  ReminderFormRow,
  ReminderFormValue,
  MAX_REMINDERS_PER_EVENT,
  getReminderComparisonKey,
  validateRelativeReminder,
  buildReminderPayloadFromForm,
  type ReminderCreatePayload,
} from "@/components/reminders"

export function CreateEventDialog({
  open,
  onOpenChangeAction,
  onCreatedAction,
  initialDate,
  initialStart,
  initialEnd,
  initialAllDay = false,
}: {
  open: boolean
  onOpenChangeAction: (v: boolean) => void
  onCreatedAction?: () => void
  initialDate?: Date
  initialStart?: Date
  initialEnd?: Date
  initialAllDay?: boolean
}): JSX.Element {
  const categories = categoryStore((s) => s.categories)

  const defaultStart = initialStart || initialDate || new Date()
  const defaultEnd =
    initialEnd ||
    (initialStart
      ? new Date(initialStart.getTime() + 60 * 60 * 1000)
      : new Date(defaultStart.getTime() + 60 * 60 * 1000))

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    watch,
    reset,
    control,
  } = useForm<EventFormValues>({
    resolver: zodResolver(eventSchema),
    defaultValues: {
      title: "",
      description: "",
      is_all_day: initialAllDay,
      start_date: defaultStart,
      start_time: defaultStart,
      end_date: defaultEnd,
      end_time: defaultEnd,
      category_ids: [],
    },
  })

  React.useEffect(() => {
    if (!open) return
    const defStart = initialStart || initialDate || new Date()
    const defEnd =
      initialEnd ||
      (initialStart
        ? new Date(initialStart.getTime() + 60 * 60 * 1000)
        : new Date(defStart.getTime() + 60 * 60 * 1000))
    reset({
      title: "",
      description: "",
      is_all_day: initialAllDay,
      start_date: defStart,
      start_time: defStart,
      end_date: defEnd,
      end_time: defEnd,
      category_ids: [],
    })
    setReminders([])
    prevIsAllDayRef.current = initialAllDay
  }, [open, initialAllDay, initialDate, initialStart, initialEnd, reset])

  const isAllDay = watch("is_all_day")
  const startDate = watch("start_date")
  const startTime = watch("start_time")

  const [reminders, setReminders] = React.useState<ReminderFormValue[]>([])

  const eventLocalStart = React.useMemo(() => {
    if (isAllDay) {
      const d = new Date(startDate || new Date())
      d.setHours(0, 0, 0, 0)
      return d
    } else {
      const d = new Date(startDate || new Date())
      const t = startTime || new Date()
      d.setHours(t.getHours(), t.getMinutes(), 0, 0)
      return d
    }
  }, [isAllDay, startDate, startTime])

  const prevIsAllDayRef = React.useRef<boolean>(initialAllDay)
  React.useEffect(() => {
    if (prevIsAllDayRef.current !== isAllDay) {
      setReminders((list) =>
        list.map((r) =>
          isAllDay
            ? {
                notificationType: r.notificationType,
                mode: "preset",
                preset: "day_1_before_9am",
              }
            : {
                notificationType: r.notificationType,
                mode: "preset",
                preset: "at_start",
              }
        )
      )
      prevIsAllDayRef.current = isAllDay
    }
  }, [isAllDay])

  function addDefaultReminder() {
    if (reminders.length >= MAX_REMINDERS_PER_EVENT) return
    const candidates: ReminderFormValue[] = isAllDay
      ? [
          { mode: "preset", preset: "day_1_before_9am", notificationType: "email" },
          { mode: "preset", preset: "day_2_before_9am", notificationType: "email" },
          { mode: "preset", preset: "week_1_before_9am", notificationType: "email" },
        ]
      : [
          { mode: "preset", preset: "at_start", notificationType: "email" },
          { mode: "preset", preset: "min_5", notificationType: "email" },
          { mode: "preset", preset: "min_10", notificationType: "email" },
          { mode: "preset", preset: "min_15", notificationType: "email" },
          { mode: "preset", preset: "min_30", notificationType: "email" },
          { mode: "preset", preset: "hr_1", notificationType: "email" },
        ]
    const pick = candidates.find(
      (c) =>
        !getReminderComparisonKey(c, !isAllDay, eventLocalStart) ||
        !reminders.some(
          (r) =>
            getReminderComparisonKey(r, !isAllDay, eventLocalStart) ===
            getReminderComparisonKey(c, !isAllDay, eventLocalStart)
        )
    )
    setReminders((prev) => [...prev, pick ?? candidates[0]])
  }

  function updateReminderAt(index: number, next: ReminderFormValue) {
    setReminders((prev) => {
      const copy = [...prev]
      copy[index] = next
      return copy
    })
  }

  function deleteReminderAt(index: number) {
    setReminders((prev) => prev.filter((_, i) => i !== index))
  }

  function validateRemindersOrToast(): boolean {
    const seen = new Set<string>()
    for (const r of reminders) {
      const key = getReminderComparisonKey(r, !isAllDay, eventLocalStart)
      if (seen.has(key)) {
        toast.error("Duplicate reminders are not allowed")
        return false
      }
      seen.add(key)
    }
    if (!isAllDay) {
      for (const r of reminders) {
        if (r.mode === "custom" && typeof r.customMinutes === "number") {
          const minutes = Math.max(0, Math.floor(r.customMinutes))
          if (!validateRelativeReminder(minutes, eventLocalStart)) {
            toast.error("Relative reminders must be at or before the event start")
            return false
          }
        }
      }
    }
    return true
  }

  const onSubmit = async (values: EventFormValues) => {
    try {
      if (!validateRemindersOrToast()) return

      let start_datetime: string
      let end_datetime: string

      if (values.is_all_day) {
        const startD = new Date(values.start_date)
        startD.setHours(0, 0, 0, 0)
        const endD = new Date(values.end_date)
        endD.setHours(23, 59, 59, 999)
        start_datetime = localDateToUtcIso(startD)
        end_datetime = localDateToUtcIso(endD)
      } else {
        if (!values.start_time || !values.end_time) {
          toast.error("Start and end times are required for timed events")
          return
        }
        const startD = new Date(values.start_date)
        startD.setHours(values.start_time.getHours(), values.start_time.getMinutes(), 0, 0)
        const endD = new Date(values.end_date)
        endD.setHours(values.end_time.getHours(), values.end_time.getMinutes(), 0, 0)
        start_datetime = localDateToUtcIso(startD)
        end_datetime = localDateToUtcIso(endD)
      }

      const payload: {
        title: string
        description?: string
        start_datetime: string
        end_datetime: string
        is_all_day: boolean
        category_ids: number[]
        reminders?: ReminderCreatePayload[]
      } = {
        title: values.title,
        description: values.description || undefined,
        start_datetime,
        end_datetime,
        is_all_day: values.is_all_day,
        category_ids: values.category_ids,
      }

      if (reminders.length > 0) {
        payload.reminders = buildReminderPayloadFromForm(reminders, {
          isAllDay,
          eventLocalStart,
        })
      }

      await api.post("/events", payload)
      try {
        window.dispatchEvent(new CustomEvent("reminders:refresh"))
      } catch {}
      toast.success("Event created")
      onOpenChangeAction(false)
      onCreatedAction?.()
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Failed to create event"))
    }
  }

  const addDisabled = reminders.length >= MAX_REMINDERS_PER_EVENT

  return (
    <Dialog open={open} onOpenChange={(v) => !isSubmitting && onOpenChangeAction(v)}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Event</DialogTitle>
        </DialogHeader>
        <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
          <EventBasicsFields
            control={control}
            register={register}
            errors={errors}
            categories={categories}
            isAllDay={isAllDay}
            disabled={isSubmitting}
          />

          <div className="mt-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-sm font-medium">Reminders</div>
              <span>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={addDefaultReminder}
                  disabled={addDisabled}
                  data-testid="reminder-add"
                >
                  + Add
                </Button>
              </span>
            </div>

            {reminders.length === 0 && (
              <div className="text-xs text-muted-foreground">
                No reminders added. You can add up to {MAX_REMINDERS_PER_EVENT}.
              </div>
            )}

            <div className="space-y-2">
              {reminders.map((r, idx) => (
                <ReminderFormRow
                  key={idx}
                  value={r}
                  isAllDay={isAllDay}
                  onChangeAction={(v) => updateReminderAt(idx, v)}
                  onDeleteAction={() => deleteReminderAt(idx)}
                  expandWhenOnDesktop
                />
              ))}
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChangeAction(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting} data-testid="event-submit">
              {isSubmitting ? "Creating..." : "Create Event"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}