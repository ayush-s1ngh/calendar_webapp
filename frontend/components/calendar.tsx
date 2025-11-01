// Compatibility re-export for Calendar
// This proxy keeps import paths stable (e.g., `@/components/calendar`)
// even if the Calendar implementation moves internally.
export { Calendar } from "./calendar/CalendarWrapper"