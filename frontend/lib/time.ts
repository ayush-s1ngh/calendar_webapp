/**
 * Time and date helpers (SSR-safe).
 * - Conversions between UTC ISO strings and local Date
 * - Common formatting helpers
 * - Normalizers for start/end of day
 *
 * Invariants:
 * - new Date(iso) yields a Date representing the same instant in the local TZ.
 * - localDateToUtcIso(date) returns an ISO string with Z (UTC) without manual offset math.
 */
import { format, parseISO } from "date-fns"

// Convert a UTC ISO string to a local Date object
export function utcIsoToLocalDate(iso: string): Date {
  return new Date(iso)
}

// Format an ISO (UTC) string in the local timezone
export function formatUtcIsoInLocal(iso: string, fmt: string): string {
  const d = parseISO(iso)
  return format(d, fmt)
}

// Convert a local Date to UTC ISO string (Z)
export function localDateToUtcIso(date: Date): string {
  return date.toISOString()
}

// Normalize a date to start of local day (00:00:00.000)
export function normalizeToStartOfDay(date: Date): Date {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

// Normalize a date to end of local day (23:59:59.999)
export function normalizeToEndOfDay(date: Date): Date {
  const d = new Date(date)
  d.setHours(23, 59, 59, 999)
  return d
}