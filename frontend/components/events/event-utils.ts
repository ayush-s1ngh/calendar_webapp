import { z } from "zod"

export type ApiErrorShape = {
  response?: { data?: { message?: string } }
  message?: string
}

export function getErrorMessage(err: unknown, fallback: string) {
  if (typeof err === "object" && err !== null) {
    const e = err as ApiErrorShape
    return e.response?.data?.message ?? e.message ?? fallback
  }
  return fallback
}

export interface EventData {
  id: string | number
  title: string
  description?: string
  start_datetime: string
  end_datetime?: string
  is_all_day?: boolean
  color?: string
  categories?: Array<{ id: number; name: string; color?: string }>
  is_recurring?: boolean
  recurrence_id?: string | null
}

// Schema for creating/editing events
export const eventSchema = z
  .object({
    title: z.string().min(1, "Title is required"),
    description: z.string().optional(),
    is_all_day: z.boolean(),
    start_date: z.date(),
    start_time: z.date().optional(),
    end_date: z.date(),
    end_time: z.date().optional(),
    category_ids: z.array(z.number()).min(1, "Please select at least one category"),
  })
  .refine(
    (data) => {
      if (data.is_all_day) {
        return data.end_date >= data.start_date
      }
      if (!data.start_time || !data.end_time) return false
      const start = new Date(data.start_date)
      start.setHours(data.start_time.getHours(), data.start_time.getMinutes(), 0, 0)
      const end = new Date(data.end_date)
      end.setHours(data.end_time.getHours(), data.end_time.getMinutes(), 0, 0)
      return end > start
    },
    {
      message: "End date/time must be after start date/time",
      path: ["end_date"],
    }
  )

export type EventFormValues = z.infer<typeof eventSchema>