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

export type ReminderFormValue = {
  id?: number
  mode: ReminderFormMode
  preset?: TimedPreset | AllDayPreset
  customMinutes?: number
  customDateTime?: Date
  notificationType: NotificationType
}

export type ApiReminder = {
  id: number
  event_id: number
  reminder_time: string | null
  notification_sent: boolean
  notification_type: NotificationType
  minutes_before: number | null
  is_relative: boolean
}

export type ReminderCreatePayload =
  | { minutes_before: number; reminder_time?: undefined; notification_type: NotificationType }
  | { reminder_time: string; minutes_before?: undefined; notification_type: NotificationType }

export const MAX_REMINDERS_PER_EVENT = 3
export const DEFAULT_ALL_DAY_HOUR = 9

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

export function allDayPresetToLocalDate(
  eventLocalDate: Date,
  preset: AllDayPreset,
  defaultHour = DEFAULT_ALL_DAY_HOUR
): Date {
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
    eventLocalStart: Date
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
        const preset = ((r.preset as AllDayPreset | undefined) ?? "day_1_before_9am")
        return {
          reminder_time: calculateAbsoluteReminderTime(eventLocalStart, preset),
          notification_type: r.notificationType,
        } as ReminderCreatePayload
      } else {
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

export function validateRelativeReminder(minutesBefore: number, eventLocalStart: Date): boolean {
  if (minutesBefore < 0) return false
  const reminderLocal = addMinutes(eventLocalStart, -minutesBefore)
  return reminderLocal.getTime() <= eventLocalStart.getTime()
}

export function isPastAbsoluteReminder(localDateTime: Date): boolean {
  return localDateTime.getTime() < Date.now()
}

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
  const iso =
    r.mode === "custom" && r.customDateTime
      ? localDateToUtcIso(r.customDateTime)
      : calculateAbsoluteReminderTime(eventLocalStart, (r.preset as AllDayPreset) || "day_1_before_9am")
  return `abs::${iso}`
}

export function isDuplicateReminder(
  list: ReminderFormValue[],
  candidate: ReminderFormValue,
  isTimedEvent: boolean,
  eventLocalStart: Date
): boolean {
  const targetKey = getReminderComparisonKey(candidate, isTimedEvent, eventLocalStart)
  return list.some((r) => getReminderComparisonKey(r, isTimedEvent, eventLocalStart) === targetKey)
}

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
    const reminderLocal = new Date(reminder.reminder_time)
    const eventLocal = new Date(eventStartUtcIso)

    if (isSameDay(reminderLocal, eventLocal)) {
      return `On event day at ${format(reminderLocal, "h:mm a")}`
    }

    const daysDiff = differenceInDays(startOfDay(eventLocal), startOfDay(reminderLocal))
    if (daysDiff === 1) return `1 day before at ${format(reminderLocal, "h:mm a")}`
    if (daysDiff === 7) return `1 week before at ${format(reminderLocal, "h:mm a")}`
    if (daysDiff > 1) return `${daysDiff} days before at ${format(reminderLocal, "h:mm a")}`

    return format(reminderLocal, "EEE, MMM d, h:mm a")
  }
  return "Reminder"
}

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

export function roundToNearestFiveMinutes(date: Date): Date {
  const d = new Date(date)
  const minutes = d.getMinutes()
  const rounded = Math.round(minutes / 5) * 5
  d.setMinutes(rounded >= 60 ? 55 : rounded, 0, 0)
  return d
}

/**
 * Compute the local trigger Date for a reminder given the event start (UTC ISO).
 * - Relative reminders: eventStart - minutes_before
 * - Absolute reminders: new Date(reminder_time)
 */
export function getReminderLocalTriggerDate(reminder: ApiReminder, eventStartUtcIso: string): Date {
  if (reminder.is_relative && typeof reminder.minutes_before === "number") {
    const eventLocal = new Date(eventStartUtcIso)
    return addMinutes(eventLocal, -Math.max(0, Math.floor(reminder.minutes_before)))
  }
  if (reminder.reminder_time) {
    return new Date(reminder.reminder_time)
  }
  return new Date(eventStartUtcIso)
}