"use client"

import {
  addDays,
  addMinutes,
  differenceInDays,
  format,
  isSameDay,
  setHours,
  setMilliseconds,
  setMinutes,
  setSeconds,
  startOfDay,
} from "date-fns"
import { localDateToUtcIso } from "@/lib/time"

export type NotificationType = "email" | "push" | "sms"

export type TimedPreset =
  | "at_start"
  | "min_5"
  | "min_10"
  | "min_15"
  | "min_30"
  | "hr_1"

export type AllDayPreset =
  | "same_day_9am"
  | "day_1_before_9am"
  | "day_2_before_9am"
  | "week_1_before_9am"

export type ReminderFormMode = "preset" | "custom"

// Local (form) representation of a reminder row.
// - For timed events, use customMinutes for custom mode.
// - For all-day events, use customDateTime for custom mode.
export type ReminderFormValue = {
  id?: number // Present when editing an existing reminder
  mode: ReminderFormMode
  preset?: TimedPreset | AllDayPreset
  customMinutes?: number // for timed custom
  customDateTime?: Date // for all-day custom
  notificationType: NotificationType
}

// Backend (API) reminder object
export type ApiReminder = {
  id: number
  event_id: number
  reminder_time: string | null // ISO 8601 (UTC) for absolute reminder
  notification_sent: boolean
  notification_type: NotificationType
  minutes_before: number | null // for relative reminder
  is_relative: boolean
}

// Payload to create/update a reminder via API.
// Exactly one of minutes_before or reminder_time must be provided.
export type ReminderCreatePayload =
  | { minutes_before: number; reminder_time?: undefined; notification_type: NotificationType }
  | { reminder_time: string; minutes_before?: undefined; notification_type: NotificationType }

export const MAX_REMINDERS_PER_EVENT = 3
export const DEFAULT_ALL_DAY_HOUR = 9 // 9:00 AM local

const TIMED_PRESET_TO_MINUTES: Record<TimedPreset, number> = {
  at_start: 0,
  min_5: 5,
  min_10: 10,
  min_15: 15,
  min_30: 30,
  hr_1: 60,
}

export function presetToMinutes(preset: TimedPreset): number {
  return TIMED_PRESET_TO_MINUTES[preset] ?? 0
}

export function minutesToTimedPreset(minutes: number): TimedPreset | undefined {
  const entries = Object.entries(TIMED_PRESET_TO_MINUTES) as Array<[TimedPreset, number]>
  const match = entries.find(([, v]) => v === minutes)
  return match?.[0]
}

/**
 * Compute local Date for an all-day preset relative to the event's date (start of event local day).
 */
export function allDayPresetToLocalDate(
  eventLocalDate: Date,
  preset: AllDayPreset,
  defaultHour = DEFAULT_ALL_DAY_HOUR
): Date {
  // Ensure we operate from the start of the event local day
  const baseDay = startOfDay(eventLocalDate)
  const setHour = (d: Date) => {
    const withHour = setHours(d, defaultHour)
    return setSeconds(setMilliseconds(setMinutes(withHour, 0), 0), 0)
  }

  switch (preset) {
    case "same_day_9am":
      return setHour(baseDay)
    case "day_1_before_9am":
      return setHour(addDays(baseDay, -1))
    case "day_2_before_9am":
      return setHour(addDays(baseDay, -2))
    case "week_1_before_9am":
      return setHour(addDays(baseDay, -7))
    default:
      return setHour(baseDay)
  }
}

/**
 * Compute absolute reminder time (UTC ISO string) for an all-day event.
 * - If customDateTime is provided, use it.
 * - Otherwise compute from preset at defaultHour (local), then convert to UTC ISO.
 */
export function calculateAbsoluteReminderTime(
  eventLocalDate: Date,
  preset?: AllDayPreset,
  customDateTime?: Date,
  defaultHour = DEFAULT_ALL_DAY_HOUR
): string {
  const localDate = customDateTime
    ? new Date(customDateTime)
    : allDayPresetToLocalDate(eventLocalDate, preset || "day_1_before_9am", defaultHour)
  return localDateToUtcIso(localDate)
}

export function buildReminderPayloadFromForm(
  reminders: ReminderFormValue[],
  options: {
    isAllDay: boolean
    eventLocalStart: Date // local Date of event start
  }
): ReminderCreatePayload[] {
  const { isAllDay, eventLocalStart } = options

  return reminders
    .map((r) => {
      if (isAllDay) {
        if (r.mode === "custom" && r.customDateTime) {
          return {
            reminder_time: localDateToUtcIso(r.customDateTime),
            notification_type: r.notificationType,
          } as ReminderCreatePayload
        }
        // preset for all-day
        const preset = ((r.preset as AllDayPreset | undefined) ?? "day_1_before_9am")
        return {
          reminder_time: calculateAbsoluteReminderTime(eventLocalStart, preset),
          notification_type: r.notificationType,
        } as ReminderCreatePayload
      } else {
        // timed event (relative)
        if (r.mode === "custom" && typeof r.customMinutes === "number") {
          return {
            minutes_before: Math.max(0, Math.floor(r.customMinutes)),
            notification_type: r.notificationType,
          } as ReminderCreatePayload
        }
        const preset = (r.preset as TimedPreset | undefined) ?? "at_start"
        return {
          minutes_before: presetToMinutes(preset),
          notification_type: r.notificationType,
        } as ReminderCreatePayload
      }
    })
    .filter(Boolean) as ReminderCreatePayload[]
}

/**
 * Validate that a relative reminder is not after the event start.
 * - Allows 0 minutes (at start).
 */
export function validateRelativeReminder(minutesBefore: number, eventLocalStart: Date): boolean {
  if (minutesBefore < 0) return false
  const reminderLocal = addMinutes(eventLocalStart, -minutesBefore)
  // Allow equality (at start)
  return reminderLocal.getTime() <= eventLocalStart.getTime()
}

/**
 * Check if an absolute reminder time (local Date) is in the past.
 */
export function isPastAbsoluteReminder(localDateTime: Date): boolean {
  return localDateTime.getTime() < Date.now()
}

/**
 * Create a comparable key for duplicate detection.
 * - For timed events: "rel::<minutes>"
 * - For all-day: "abs::<utcIso>"
 */
export function getReminderComparisonKey(
  r: ReminderFormValue,
  isTimedEvent: boolean,
  eventLocalStart: Date
): string {
  if (isTimedEvent) {
    const minutes =
      r.mode === "custom" && typeof r.customMinutes === "number"
        ? Math.max(0, Math.floor(r.customMinutes))
        : presetToMinutes((r.preset as TimedPreset) || "at_start")
    return `rel::${minutes}`
  }
  // all-day
  const iso =
    r.mode === "custom" && r.customDateTime
      ? localDateToUtcIso(r.customDateTime)
      : calculateAbsoluteReminderTime(eventLocalStart, (r.preset as AllDayPreset) || "day_1_before_9am")
  return `abs::${iso}`
}

/**
 * Returns true if adding candidate would duplicate an existing reminder (same time).
 * Notification type is ignored for duplicate checks.
 */
export function isDuplicateReminder(
  list: ReminderFormValue[],
  candidate: ReminderFormValue,
  isTimedEvent: boolean,
  eventLocalStart: Date
): boolean {
  const targetKey = getReminderComparisonKey(candidate, isTimedEvent, eventLocalStart)
  return list.some((r) => getReminderComparisonKey(r, isTimedEvent, eventLocalStart) === targetKey)
}

/**
 * Format a reminder timing for display in dialogs/sidebars.
 * - For relative reminders: "At event start", "15 min before", "2 hours before"
 * - For absolute reminders: "On event day at 9:00 AM", "1 day before at 9:00 AM"
 */
export function formatReminderTimingForDisplay(
  reminder: ApiReminder,
  eventStartUtcIso: string
): string {
  if (reminder.is_relative && typeof reminder.minutes_before === "number") {
    const m = reminder.minutes_before
    if (m === 0) return "At event start"
    if (m < 60) return `${m} min before`
    const hrs = Math.floor(m / 60)
    return `${hrs} hour${hrs > 1 ? "s" : ""} before`
  }

  if (reminder.reminder_time) {
    // Convert both to local dates for presentation
    const reminderLocal = new Date(reminder.reminder_time)
    const eventLocal = new Date(eventStartUtcIso)

    if (isSameDay(reminderLocal, eventLocal)) {
      return `On event day at ${format(reminderLocal, "h:mm a")}`
    }

    const daysDiff = differenceInDays(startOfDay(eventLocal), startOfDay(reminderLocal))
    if (daysDiff === 1) return `1 day before at ${format(reminderLocal, "h:mm a")}`
    if (daysDiff === 7) return `1 week before at ${format(reminderLocal, "h:mm a")}`
    if (daysDiff > 1) return `${daysDiff} days before at ${format(reminderLocal, "h:mm a")}`

    // Fallback: full date/time if it doesn't match typical presets
    return format(reminderLocal, "EEE, MMM d, h:mm a")
  }

  // Unknown shape fallback
  return "Reminder"
}

/**
 * Human labels for notification types.
 */
export function formatNotificationTypeLabel(type: NotificationType): string {
  switch (type) {
    case "email":
      return "Email"
    case "push":
      return "Push"
    case "sms":
      return "SMS"
    default:
      return type
  }
}

/**
 * Round a date to the nearest 5-minute mark (down if >=60).
 */
export function roundToNearestFiveMinutes(date: Date): Date {
  const d = new Date(date)
  const minutes = d.getMinutes()
  const rounded = Math.round(minutes / 5) * 5
  d.setMinutes(rounded >= 60 ? 55 : rounded, 0, 0)
  return d
}

/**
 * Compute the local trigger Date for a reminder given the event start (UTC ISO).
 * - For relative reminders: eventStart - minutes_before
 * - For absolute reminders: new Date(reminder_time)
 */
export function getReminderLocalTriggerDate(reminder: ApiReminder, eventStartUtcIso: string): Date {
  if (reminder.is_relative && typeof reminder.minutes_before === "number") {
    const eventLocal = new Date(eventStartUtcIso)
    return addMinutes(eventLocal, -Math.max(0, Math.floor(reminder.minutes_before)))
  }
  if (reminder.reminder_time) {
    return new Date(reminder.reminder_time)
  }
  // Fallback: just use event start if shape is unexpected
  return new Date(eventStartUtcIso)
}