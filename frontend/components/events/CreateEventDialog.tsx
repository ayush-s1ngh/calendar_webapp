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
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { toast } from "sonner"
import { Calendar as CalendarIcon, Plus } from "lucide-react"
import api from "@/lib/api"
import { categoryStore } from "@/store/category"
import { format } from "date-fns"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { SimpleTimePicker } from "@/components/ui/time-picker"
import { cn } from "@/lib/utils"
import { localDateToUtcIso } from "@/lib/time"
import { eventSchema, EventFormValues, getErrorMessage } from "./event-utils"

// Reminders
import {
  ReminderFormValue,
  ReminderFormRow,
  MAX_REMINDERS_PER_EVENT,
  isDuplicateReminder,
  getReminderComparisonKey,
  validateRelativeReminder,
  DEFAULT_ALL_DAY_HOUR,
  AllDayPreset,
  TimedPreset,
} from "@/components/reminders"

type ReminderPayload = { minutes_before?: number; reminder_time?: string; notification_type: string }

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
}) {
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
    if (open) {
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
      // reset reminders when dialog opens
      setReminders([])
      prevIsAllDayRef.current = initialAllDay
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const isAllDay = watch("is_all_day")
  const startDate = watch("start_date")
  const startTime = watch("start_time")

  // Reminders state (managed outside react-hook-form)
  const [reminders, setReminders] = React.useState<ReminderFormValue[]>([])

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

  // Auto-convert reminders when event type toggles (timed <-> all-day)
  const prevIsAllDayRef = React.useRef<boolean>(initialAllDay)
  React.useEffect(() => {
    if (prevIsAllDayRef.current !== isAllDay) {
      setReminders((list) =>
        list.map((r) =>
          isAllDay
            ? {
                // Timed -> All-day: default to 1 day before at 9 AM (stays before start, safe for backend)
                notificationType: r.notificationType,
                mode: "preset",
                preset: "day_1_before_9am",
              }
            : {
                // All-day -> Timed: default to at_start
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
    // Duplicates check
    const seen = new Set<string>()
    for (const r of reminders) {
      const key = getReminderComparisonKey(r, !isAllDay, eventLocalStart)
      if (seen.has(key)) {
        toast.error("Duplicate reminders are not allowed")
        return false
      }
      seen.add(key)
    }

    // Relative validation for timed events
    if (!isAllDay) {
      for (const r of reminders) {
        let minutes: number | undefined
        if (r.mode === "custom" && typeof r.customMinutes === "number") {
          minutes = Math.max(0, Math.floor(r.customMinutes))
        } else if (r.mode === "preset") {
          // For timed presets, they map to fixed minutes; handled server-side anyway
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

  // Helpers for building all-day relative minutes for presets
  function allDayPresetTargetLocalDate(eventStartLocalMidnight: Date, preset: AllDayPreset): Date {
    const base = new Date(eventStartLocalMidnight)
    const target = new Date(base)
    switch (preset) {
      case "same_day_9am": {
        target.setHours(DEFAULT_ALL_DAY_HOUR, 0, 0, 0)
        return target
      }
      case "day_1_before_9am": {
        target.setDate(target.getDate() - 1)
        target.setHours(DEFAULT_ALL_DAY_HOUR, 0, 0, 0)
        return target
      }
      case "day_2_before_9am": {
        target.setDate(target.getDate() - 2)
        target.setHours(DEFAULT_ALL_DAY_HOUR, 0, 0, 0)
        return target
      }
      case "week_1_before_9am": {
        target.setDate(target.getDate() - 7)
        target.setHours(DEFAULT_ALL_DAY_HOUR, 0, 0, 0)
        return target
      }
      default: {
        target.setHours(DEFAULT_ALL_DAY_HOUR, 0, 0, 0)
        return target
      }
    }
  }

  function allDayPresetToMinutesBefore(eventStartLocalMidnight: Date, preset: AllDayPreset): number {
    const target = allDayPresetTargetLocalDate(eventStartLocalMidnight, preset)
    const diffMin = Math.floor((eventStartLocalMidnight.getTime() - target.getTime()) / 60000)
    return Math.max(0, diffMin)
  }

  // Build reminders payload locally to ensure all-day presets use minutes_before (so they follow date changes)
  function buildRemindersPayload(
    list: ReminderFormValue[],
    opts: { isAllDay: boolean; eventLocalStart: Date }
  ): ReminderPayload[] {
    const { isAllDay, eventLocalStart } = opts
    return list.map((r) => {
      if (!isAllDay) {
        // Timed events: always relative
        let minutes: number
        if (r.mode === "custom" && typeof r.customMinutes === "number") {
          minutes = Math.max(0, Math.floor(r.customMinutes))
        } else {
          const preset = (r.preset as TimedPreset) || "at_start"
          const map: Record<TimedPreset, number> = {
            at_start: 0,
            min_5: 5,
            min_10: 10,
            min_15: 15,
            min_30: 30,
            hr_1: 60,
          }
          minutes = map[preset] ?? 0
        }
        return { minutes_before: minutes, notification_type: r.notificationType }
      }

      // All-day events:
      if (r.mode === "custom" && r.customDateTime) {
        const dt = new Date(r.customDateTime)
        if (dt.getTime() < eventLocalStart.getTime()) {
          const minutes = Math.max(
            0,
            Math.floor((eventLocalStart.getTime() - dt.getTime()) / 60000)
          )
          return { minutes_before: minutes, notification_type: r.notificationType }
        }
        return { reminder_time: localDateToUtcIso(dt), notification_type: r.notificationType }
      }

      const preset = (r.preset as AllDayPreset) || "day_1_before_9am"
      if (preset === "same_day_9am") {
        // This preset is after midnight; keep absolute to avoid backend "after start" validation
        const abs = allDayPresetTargetLocalDate(eventLocalStart, preset)
        return { reminder_time: localDateToUtcIso(abs), notification_type: r.notificationType }
      }
      const minutes = allDayPresetToMinutesBefore(eventLocalStart, preset)
      return { minutes_before: minutes, notification_type: r.notificationType }
    })
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
        reminders?: ReminderPayload[]
      } = {
        title: values.title,
        description: values.description || undefined,
        start_datetime,
        end_datetime,
        is_all_day: values.is_all_day,
        category_ids: values.category_ids,
      }

      if (reminders.length > 0) {
        payload.reminders = buildRemindersPayload(reminders, {
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

          {errors.end_date && (
            <p className="text-destructive text-xs">{errors.end_date.message}</p>
          )}

          <div className="mt-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-sm font-medium">Reminders</div>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={addDefaultReminder}
                      disabled={addDisabled}
                    >
                      <Plus className="size-4" />
                      Add Reminder
                    </Button>
                  </span>
                </TooltipTrigger>
                {addDisabled && (
                  <TooltipContent>Maximum {MAX_REMINDERS_PER_EVENT} reminders per event</TooltipContent>
                )}
              </Tooltip>
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
                  eventLocalStart={eventLocalStart}
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
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Creating..." : "Create Event"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}