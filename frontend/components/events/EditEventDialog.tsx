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
import { localDateToUtcIso, utcIsoToLocalDate } from "@/lib/time"
import { getErrorMessage } from "@/lib/errors"
import { EventBasicsFields } from "./EventBasicsFields"
import { eventSchema, type EventFormValues, type EventData } from "./event-utils"

// Reminders
import {
  ReminderFormValue,
  ReminderFormRow,
  MAX_REMINDERS_PER_EVENT,
  isDuplicateReminder,
  getReminderComparisonKey,
  validateRelativeReminder,
  ApiReminder,
  NotificationType,
  presetToMinutes,
  calculateAbsoluteReminderTime,
  detectAllDayPresetFromAbsolute,
  detectAllDayPresetFromMinutesBefore,
  allDayPresetToMinutesBefore,
  roundToNearestFiveMinutes,
  minutesToTimedPreset,
  type AllDayPreset,
  type TimedPreset,
} from "@/components/reminders"

type ReminderPayload = {
  minutes_before?: number
  reminder_time?: string
  notification_type: NotificationType
}

// Centralized fetcher for event reminders (shape-tolerant, no any)
async function fetchRemindersForEvent(eventId: string | number): Promise<ApiReminder[]> {
  try {
    const res = await api.get(`/reminders/event/${encodeURIComponent(String(eventId))}/reminders`)
    const root = res?.data as unknown

    if (Array.isArray(root)) return root as ApiReminder[]
    if (root && typeof root === "object") {
      const obj = root as Record<string, unknown>
      const fromKey = (key: string): ApiReminder[] => {
        const val = obj[key]
        return Array.isArray(val) ? (val as ApiReminder[]) : []
      }
      if (Array.isArray(obj.reminders)) return obj.reminders as ApiReminder[]
      if (Array.isArray(obj.data)) return obj.data as ApiReminder[]
      if (obj.data && typeof obj.data === "object") {
        const dataObj = obj.data as Record<string, unknown>
        if (Array.isArray(dataObj.reminders)) return dataObj.reminders as ApiReminder[]
      }
      const attempts = fromKey("reminders") || fromKey("data")
      if (attempts.length) return attempts
    }
    return []
  } catch {
    return []
  }
}

export function EditEventDialog({
  open,
  onOpenChangeAction,
  event,
  onUpdatedAction,
  openManageInitially = false,
}: {
  open: boolean
  onOpenChangeAction: (v: boolean) => void
  event: EventData | null
  onUpdatedAction?: () => void
  openManageInitially?: boolean
}): JSX.Element | null {
  const categories = categoryStore((s) => s.categories)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    watch,
    reset,
    control,
  } = useForm<EventFormValues>({
    resolver: zodResolver(eventSchema),
  })

  // Reminders local state
  const [reminders, setReminders] = React.useState<ReminderFormValue[]>([])
  const [originalApiReminders, setOriginalApiReminders] = React.useState<ApiReminder[]>([])
  const [remindersLoading, setRemindersLoading] = React.useState(false)
  const [manageOpen, setManageOpen] = React.useState(false)

  // Load event details into form and fetch reminders
  React.useEffect(() => {
    async function init() {
      if (!open || !event) return
      setManageOpen(openManageInitially)

      const startDate = utcIsoToLocalDate(event.start_datetime)
      const endDate = event.end_datetime
        ? utcIsoToLocalDate(event.end_datetime)
        : new Date(startDate.getTime() + 60 * 60 * 1000)
      const isAllDay = Boolean(event.is_all_day)

      reset({
        title: event.title,
        description: event.description || "",
        is_all_day: isAllDay,
        start_date: startDate,
        start_time: roundToNearestFiveMinutes(startDate),
        end_date: endDate,
        end_time: roundToNearestFiveMinutes(endDate),
        category_ids: event.categories?.map((c) => c.id) || [],
      })

      // Compute local event start for mapping presets and minutes
      const eventLocalStartForMapping = (() => {
        if (isAllDay) {
          const d = new Date(startDate)
          d.setHours(0, 0, 0, 0)
          return d
        }
        return new Date(startDate)
      })()

      setRemindersLoading(true)
      try {
        const apiRems = await fetchRemindersForEvent(event.id)
        setOriginalApiReminders(apiRems)
        const mapped = mapApiRemindersToForm(apiRems, isAllDay, eventLocalStartForMapping)
        setReminders(mapped)
      } catch {
        setOriginalApiReminders([])
        setReminders([])
      } finally {
        setRemindersLoading(false)
      }
    }
    void init()
  }, [open, event, reset, openManageInitially])

  const isAllDay = watch("is_all_day")
  const startDate = watch("start_date")
  const startTime = watch("start_time")

  // Compute event's local start Date for reminder calculations
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

  // Convert reminders when toggling event type
  const prevIsAllDayRef = React.useRef<boolean | null>(null)
  React.useEffect(() => {
    if (prevIsAllDayRef.current === null) {
      prevIsAllDayRef.current = isAllDay
      return
    }
    if (prevIsAllDayRef.current !== isAllDay) {
      setReminders((list) =>
        list.map((r) =>
          isAllDay
            ? { notificationType: r.notificationType, mode: "preset", preset: "day_1_before_9am" }
            : { notificationType: r.notificationType, mode: "preset", preset: "at_start" }
        )
      )
      prevIsAllDayRef.current = isAllDay
    }
  }, [isAllDay])

  function mapApiRemindersToForm(
    apiRems: ApiReminder[],
    isAllDayEvent: boolean,
    eventLocalStartForMapping: Date
  ): ReminderFormValue[] {
    return apiRems.map((rem) => {
      if (isAllDayEvent) {
        // Prefer mapping to preset if recognizable
        if (rem.is_relative && typeof rem.minutes_before === "number") {
          const m = Math.max(0, Math.floor(rem.minutes_before))
          const p = detectAllDayPresetFromMinutesBefore(m)
          if (p) {
            return {
              id: rem.id,
              mode: "preset",
              preset: p,
              notificationType: rem.notification_type,
            }
          }
          // Fall back: show as custom absolute derived from minutes
          const abs = new Date(eventLocalStartForMapping.getTime() - m * 60000)
          return {
            id: rem.id,
            mode: "custom",
            customDateTime: abs,
            notificationType: rem.notification_type,
          }
        }

        if (rem.reminder_time) {
          const absLocal = new Date(rem.reminder_time)
          const preset = detectAllDayPresetFromAbsolute(absLocal, eventLocalStartForMapping)
          if (preset) {
            return {
              id: rem.id,
              mode: "preset",
              preset,
              notificationType: rem.notification_type,
            }
          }
          return {
            id: rem.id,
            mode: "custom",
            customDateTime: absLocal,
            notificationType: rem.notification_type,
          }
        }

        // Fallback default
        return {
          id: rem.id,
          mode: "preset",
          preset: "day_1_before_9am",
          notificationType: rem.notification_type,
        }
      } else {
        const m = typeof rem.minutes_before === "number" ? rem.minutes_before : undefined
        if (typeof m === "number") {
          const preset = minutesToTimedPreset(m)
          if (preset) {
            return {
              id: rem.id,
              mode: "preset",
              preset,
              notificationType: rem.notification_type,
            }
          }
          return {
            id: rem.id,
            mode: "custom",
            customMinutes: Math.max(0, Math.floor(m)),
            notificationType: rem.notification_type,
          }
        }
        // Fallback to "at_start"
        return {
          id: rem.id,
          mode: "preset",
          preset: "at_start",
          notificationType: rem.notification_type,
        }
      }
    })
  }

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
      (c) => !isDuplicateReminder(reminders, c, !isAllDay, eventLocalStart)
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
        let minutes: number | undefined
        if (r.mode === "custom" && typeof r.customMinutes === "number") {
          minutes = Math.max(0, Math.floor(r.customMinutes))
        }
        if (typeof minutes === "number") {
          if (!validateRelativeReminder(minutes, eventLocalStart)) {
            toast.error("Relative reminders must be at or before the event start")
            return false
          }
        }
      }
    }
    return true
  }

  // Build the expected API shape from a form reminder (for equality checks and API calls)
  function expectedFromForm(
    r: ReminderFormValue,
    opts: { isAllDay: boolean; eventLocalStart: Date }
  ): ReminderPayload {
    if (opts.isAllDay) {
      if (r.mode === "custom" && r.customDateTime) {
        const dt = new Date(r.customDateTime)
        if (dt.getTime() < opts.eventLocalStart.getTime()) {
          const diffMin = Math.max(
            0,
            Math.floor((opts.eventLocalStart.getTime() - dt.getTime()) / 60000)
          )
          return { minutes_before: diffMin, notification_type: r.notificationType }
        }
        return { reminder_time: localDateToUtcIso(dt), notification_type: r.notificationType }
      }
      const preset: AllDayPreset = (r.preset as AllDayPreset | undefined) ?? "day_1_before_9am"
      if (preset === "same_day_9am") {
        return {
          reminder_time: calculateAbsoluteReminderTime(opts.eventLocalStart, preset),
          notification_type: r.notificationType,
        }
      }
      const minutes = allDayPresetToMinutesBefore(opts.eventLocalStart, preset)
      return { minutes_before: minutes, notification_type: r.notificationType }
    }
    const minutes =
      r.mode === "custom" && typeof r.customMinutes === "number"
        ? Math.max(0, Math.floor(r.customMinutes))
        : presetToMinutes(((r.preset as TimedPreset | undefined) ?? "at_start"))
    return { minutes_before: minutes, notification_type: r.notificationType }
  }

  function areEqualReminder(
    apiRem: ApiReminder,
    form: ReminderFormValue,
    opts: { isAllDay: boolean; eventLocalStart: Date }
  ) {
    const expect = expectedFromForm(form, opts)
    if (apiRem.is_relative) {
      const m = typeof apiRem.minutes_before === "number" ? apiRem.minutes_before : undefined
      return (
        typeof expect.minutes_before === "number" &&
        m === expect.minutes_before &&
        apiRem.notification_type === expect.notification_type
      )
    }
    if (apiRem.reminder_time) {
      return (
        typeof expect.reminder_time === "string" &&
        apiRem.reminder_time === expect.reminder_time &&
        apiRem.notification_type === expect.notification_type
      )
    }
    return false
  }

  async function syncReminders(eventId: number | string) {
    const byIdCurrent = new Map<number, ReminderFormValue>()
    const creates: ReminderPayload[] = []
    const updates: Array<{ id: number; payload: ReminderPayload }> = []
    const deleteIds: number[] = []

    for (const r of reminders) {
      if (typeof r.id === "number") byIdCurrent.set(r.id, r)
    }

    for (const apiR of originalApiReminders) {
      if (!byIdCurrent.has(apiR.id)) {
        deleteIds.push(apiR.id)
      }
    }

    for (const r of reminders) {
      if (typeof r.id !== "number") {
        const payload = expectedFromForm(r, { isAllDay, eventLocalStart })
        creates.push({ ...payload })
      } else {
        const original = originalApiReminders.find((x) => x.id === r.id)
        if (!original) continue
        if (!areEqualReminder(original, r, { isAllDay, eventLocalStart })) {
          const payload = expectedFromForm(r, { isAllDay, eventLocalStart })
          updates.push({ id: r.id, payload })
        }
      }
    }

    try {
      if (deleteIds.length > 0) {
        await api.delete(`/reminders/bulk`, { data: { reminder_ids: deleteIds } })
      }
      if (creates.length > 0) {
        const event_id = Number(eventId)
        const body = { reminders: creates.map((c) => ({ event_id, ...c })) }
        await api.post(`/reminders/bulk`, body)
      }
      if (updates.length > 0) {
        await Promise.all(
          updates.map((u) =>
            api.put(`/reminders/${encodeURIComponent(String(u.id))}`, u.payload)
          )
        )
      }
      return { ok: true, deleted: deleteIds.length, created: creates.length, updated: updates.length }
    } catch (e) {
      return { ok: false, error: e }
    }
  }

  const onSubmit = async (values: EventFormValues) => {
    if (!event) return
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

      // Update event fields only
      const payload: {
        title: string
        description?: string
        start_datetime: string
        end_datetime: string
        is_all_day: boolean
        category_ids: number[]
      } = {
        title: values.title,
        description: values.description || undefined,
        start_datetime,
        end_datetime,
        is_all_day: values.is_all_day,
        category_ids: values.category_ids,
      }

      await api.put(`/events/${encodeURIComponent(String(event.id))}`, payload)

      // Now sync reminders via dedicated endpoints
      const res = await syncReminders(event.id)
      if (!res.ok) {
        toast.warning("Event updated, but reminders could not be fully synced. Please retry.")
      } else if (res.deleted || res.created || res.updated) {
        toast.success("Event updated. Reminders synced.")
      } else {
        toast.success("Event updated")
      }

      try {
        window.dispatchEvent(new CustomEvent("reminders:refresh"))
      } catch {}

      onOpenChangeAction(false)
      onUpdatedAction?.()
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Failed to update event"))
    }
  }

  if (!event) return null

  return (
    <Dialog open={open} onOpenChange={(v) => !isSubmitting && onOpenChangeAction(v)}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Event</DialogTitle>
        </DialogHeader>
        <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
          {event.is_recurring && (
            <div className="rounded-md border bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
              Reminder applies to this instance only.
            </div>
          )}

          <EventBasicsFields
            control={control}
            register={register}
            errors={errors}
            categories={categories}
            isAllDay={isAllDay}
            disabled={isSubmitting}
          />

          {/* Reminders Section (summary + manage) */}
          <div className="mt-2 border rounded-md">
            <div className="flex items-center justify-between px-3 py-2">
              <div className="text-sm font-medium">
                Reminders{remindersLoading ? " (loading...)" : reminders.length ? ` (${reminders.length} set)` : " (none)"}
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setManageOpen((v) => !v)}
              >
                {manageOpen ? "Hide" : "Manage Reminders"}
              </Button>
            </div>

            {manageOpen && (
              <div className="px-3 pb-3 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-xs text-muted-foreground">
                    Maximum {MAX_REMINDERS_PER_EVENT}. Duplicates are not allowed.
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={addDefaultReminder}
                    disabled={reminders.length >= MAX_REMINDERS_PER_EVENT}
                    data-testid="reminder-add"
                  >
                    + Add
                  </Button>
                </div>

                {reminders.length === 0 && !remindersLoading && (
                  <div className="text-xs text-muted-foreground">
                    No reminders added yet.
                  </div>
                )}

                <div className="space-y-2">
                  {reminders.map((r, idx) => (
                    <ReminderFormRow
                      key={r.id ?? idx}
                      value={r}
                      isAllDay={isAllDay}
                      eventLocalStart={eventLocalStart}
                      onChangeAction={(v) => updateReminderAt(idx, v)}
                      onDeleteAction={() => deleteReminderAt(idx)}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChangeAction(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting} data-testid="event-save">
              {isSubmitting ? "Saving..." : "Save changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}