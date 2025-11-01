import { z } from "zod"

/**
 * Category utilities and schema.
 * - COLOR_OPTIONS: curated mid-tone palette used by ColorPicker and dialogs
 * - categorySchema: validates name and hex color; optional description
 */
export interface UpcomingEvent {
  id: string
  title: string
  start: Date
  end?: Date
  allDay: boolean
}

// 10 distinguishable mid-tone shades
export const COLOR_OPTIONS = [
  { key: "indigo", label: "Indigo", value: "#4F46E5" },
  { key: "blue", label: "Blue", value: "#2563EB" },
  { key: "cyan", label: "Cyan", value: "#0891B2" },
  { key: "teal", label: "Teal", value: "#0D9488" },
  { key: "emerald", label: "Emerald", value: "#059669" },
  { key: "lime", label: "Lime", value: "#65A30D" },
  { key: "amber", label: "Amber", value: "#D97706" },
  { key: "orange", label: "Orange", value: "#EA580C" },
  { key: "rose", label: "Rose", value: "#E11D48" },
  { key: "violet", label: "Violet", value: "#7C3AED" },
] as const

const hexColorRegex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/

export const categorySchema = z.object({
  name: z.string().min(1, "Name is required"),
  color: z.string().regex(hexColorRegex, "Color must be a valid hex value"),
  description: z.string().optional(),
})

export type CategoryFormValues = z.infer<typeof categorySchema>