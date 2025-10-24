import { format, parseISO } from "date-fns"

// Convert a UTC ISO string to a local Date object
export function utcIsoToLocalDate(iso: string) {
  // new Date(iso) creates a Date in the local timezone representing the same instant
  return new Date(iso)
}

// Format an ISO (UTC) string in the local timezone
export function formatUtcIsoInLocal(iso: string, fmt: string) {
  const d = parseISO(iso)
  return format(d, fmt)
}

// Convert a local Date to UTC ISO string (Z)
// Important: do not adjust manually by timezone offset; Date already encodes the instant.
export function localDateToUtcIso(date: Date) {
  return date.toISOString()
}