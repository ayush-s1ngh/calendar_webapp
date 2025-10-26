"use client"

import * as React from "react"
import { useForm, Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { toast } from "sonner"
import { Calendar as CalendarIcon, ChevronDown, ChevronUp } from "lucide-react"
import api from "@/lib/api"
import { categoryStore } from "@/store/category"
import { format } from "date-fns"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { SimpleTimePicker } from "@/components/ui/time-picker"
import { cn } from "@/lib/utils"
import { localDateToUtcIso, utcIsoToLocalDate } from "@/lib/time"
import { eventSchema, EventFormValues, EventData, getErrorMessage } from "./event-utils"

// Reminders
import {
  ReminderFormValue,
  ReminderFormRow,
  MAX_REMINDERS_PER_EVENT,
  isDuplicateReminder,
  getReminderComparisonKey,
  validateRelativeReminder,
  ApiReminder,
  minutesToTimedPreset,
  NotificationType,
  presetToMinutes,
  calculateAbsoluteReminderTime,
  detectAllDayPresetFromAbsolute,
  detectAllDayPresetFromMinutesBefore,
  allDayPresetToMinutesBefore,
} from "@/components/reminders"

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
}) {
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

      // Round times to 5-minute increments for picker
      const roundToNearestFiveMinutes = (date: Date): Date => {
        const rounded = new Date(date)
        const minutes = rounded.getMinutes()
        const roundedMinutes = Math.round(minutes / 5) * 5
        rounded.setMinutes(roundedMinutes >= 60 ? 55 : roundedMinutes, 0, 0)
        return rounded
      }

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

      // fetch reminders for this event
      setRemindersLoading(true)
      try {
        const res = await api.get(`/reminders/event/${encodeURIComponent(String(event.id))}/reminders`)

        // Primary shape: { success: true, data: { reminders: [...] } }, but support fallbacks too
        const extractReminders = (root: any): ApiReminder[] => {
          if (Array.isArray(root)) return root
          if (Array.isArray(root?.reminders)) return root.reminders
          if (Array.isArray(root?.data)) return root.data
          if (Array.isArray(root?.data?.reminders)) return root.data.reminders
          return []
        }

        const apiRems = extractReminders(res?.data)
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
          const p = minutesToTimedPreset(m)
          if (p) {
            return {
              id: rem.id,
              mode: "preset",
              preset: p,
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
  ): { minutes_before?: number; reminder_time?: string; notification_type: NotificationType } {
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
      const preset = (r.preset as any) || "day_1_before_9am"
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
        : presetToMinutes((r.preset as any) || "at_start")
    return { minutes_before: minutes, notification_type: r.notificationType }
  }

  function areEqualReminder(apiRem: ApiReminder, form: ReminderFormValue, opts: { isAllDay: boolean; eventLocalStart: Date }) {
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
    const creates: Array<{ minutes_before?: number; reminder_time?: string; notification_type: NotificationType }> = []
    const updates: Array<{ id: number; payload: { minutes_before?: number; reminder_time?: string; notification_type: NotificationType } }> = []
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

    // Perform API calls
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
      const payload: any = {
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

          <div className="space-y-2">
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              placeholder="Event title"
              {...register("title")}
              aria-invalid={!!errors.title}
            />
            {errors.title && <p className="text-destructive text-xs">{errors.title.message}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              rows={3}
              placeholder="Add details about your event"
              {...register("description")}
            />
          </div>

          <div className="space-y-2">
            <Label>Category *</Label>
            <Controller
              name="category_ids"
              control={control}
              render={({ field }) => (
                <Select
                  value={field.value[0]?.toString() || ""}
                  onValueChange={(val) => field.onChange([parseInt(val, 10)])}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select a category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id.toString()}>
                        <div className="flex items-center gap-2">
                          <span
                            className="inline-block size-2.5 rounded-full"
                            style={{ background: cat.color || "var(--sidebar-ring)" }}
                          />
                          {cat.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {errors.category_ids && (
              <p className="text-destructive text-xs">{errors.category_ids.message}</p>
            )}
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="is_all_day"
              {...register("is_all_day")}
              className="size-4 rounded border-input"
            />
            <Label htmlFor="is_all_day" className="cursor-pointer">
              All day
            </Label>
          </div>

          {!isAllDay && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Start Date *</Label>
                  <Controller
                    name="start_date"
                    control={control}
                    render={({ field }) => (
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={cn(
                              "w-full justify-start text-left font-normal",
                              !field.value && "text-muted-foreground"
                            )}
                          >
                            <CalendarIcon className="mr-2 size-4" />
                            {field.value ? format(field.value, "PPP") : "Pick a date"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0">
                          <Calendar
                            mode="single"
                            selected={field.value}
                            onSelect={(date) => date && field.onChange(date)}
                            autoFocus={true}
                          />
                        </PopoverContent>
                      </Popover>
                    )}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Start Time *</Label>
                  <Controller
                    name="start_time"
                    control={control}
                    render={({ field }) => (
                      <SimpleTimePicker
                        value={field.value || new Date()}
                        onChange={field.onChange}
                        use12HourFormat
                      />
                    )}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>End Date *</Label>
                  <Controller
                    name="end_date"
                    control={control}
                    render={({ field }) => (
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={cn(
                              "w-full justify-start text-left font-normal",
                              !field.value && "text-muted-foreground"
                            )}
                          >
                            <CalendarIcon className="mr-2 size-4" />
                            {field.value ? format(field.value, "PPP") : "Pick a date"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0">
                          <Calendar
                            mode="single"
                            selected={field.value}
                            onSelect={(date) => date && field.onChange(date)}
                            autoFocus={true}
                          />
                        </PopoverContent>
                      </Popover>
                    )}
                  />
                </div>
                <div className="space-y-2">
                  <Label>End Time *</Label>
                  <Controller
                    name="end_time"
                    control={control}
                    render={({ field }) => (
                      <SimpleTimePicker
                        value={field.value || new Date()}
                        onChange={field.onChange}
                        use12HourFormat
                      />
                    )}
                  />
                </div>
              </div>
            </>
          )}

          {isAllDay && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Start Date *</Label>
                <Controller
                  name="start_date"
                  control={control}
                  render={({ field }) => (
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal",
                            !field.value && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 size-4" />
                          {field.value ? format(field.value, "PPP") : "Pick a date"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar
                          mode="single"
                          selected={field.value}
                          onSelect={(date) => date && field.onChange(date)}
                          autoFocus={true}
                        />
                      </PopoverContent>
                    </Popover>
                  )}
                />
              </div>
              <div className="space-y-2">
                <Label>End Date *</Label>
                <Controller
                  name="end_date"
                  control={control}
                  render={({ field }) => (
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal",
                            !field.value && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 size-4" />
                          {field.value ? format(field.value, "PPP") : "Pick a date"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar
                          mode="single"
                          selected={field.value}
                          onSelect={(date) => date && field.onChange(date)}
                          autoFocus={true}
                        />
                      </PopoverContent>
                    </Popover>
                  )}
                />
              </div>
            </div>
          )}

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
                {manageOpen ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
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
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : "Save changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}