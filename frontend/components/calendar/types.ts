export interface CalendarCategory {
  id: string
  name: string
  colorVar: string // CSS variable reference e.g. var(--chart-1)
}

export interface RecurrenceRule {
  frequency: "WEEKLY"
  daysOfWeek: string[] // ["MON","WED"]
  interval?: number
}

export interface BaseTemplateEvent {
  id: string
  title: string
  startTime: string // "HH:MM"
  endTime: string   // "HH:MM"
  categoryId: string
  recurrence?: RecurrenceRule
  isAllDay?: boolean
}

export interface GeneratedEventMeta {
  templateId?: string
  categoryId: string
  categoryName: string
  categoryColorVar: string
  isRecurringInstance?: boolean
}