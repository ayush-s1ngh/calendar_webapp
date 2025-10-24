# Frontend Date Handling Patch Fixes - Documentation

**Project:** Calendar WebApp Frontend

---

## Executive Summary

The frontend implements **date conversion patches** to bridge the gap between:
- **Backend Storage:** All-day events use **inclusive end dates** (e.g., Oct 10 23:59:59.999 means "ends on Oct 10")
- **FullCalendar Display:** Expects **exclusive end dates** (e.g., Oct 11 00:00:00 means "ends on Oct 10")

These patches are **localized to 4 files** and convert dates at the **display boundary** (backend ↔ FullCalendar).

---

## Problem Statement

### The Core Issue
**All-day events** in FullCalendar use an **exclusive end date convention**:
- A 3-day event from Oct 8-10 is represented as:
  - `start: Oct 8 00:00:00`
  - `end: Oct 11 00:00:00` ← **Exclusive** (means "ends before Oct 11 starts")

**Our backend** stores the same event as:
- `start_datetime: Oct 8 00:00:00 UTC`
- `end_datetime: Oct 10 23:59:59.999 UTC` ← **Inclusive** (means "ends at the last moment of Oct 10")

**Without conversion:**
- Backend sends Oct 10 23:59:59 → FullCalendar interprets this as "almost Oct 11" → Displays only Oct 8-9

---

## 🔧 Patch Locations

### 1️⃣ **File:** `useCalendarEvents.ts`
**Purpose:** Convert backend data → FullCalendar format

```typescript
if (allDay && endLocal) {
  // Backend: Oct 10 23:59:59.999 (inclusive end of Oct 10)
  // FullCalendar needs: Oct 11 00:00:00 (exclusive - next day midnight)
  const exclusiveEnd = addDays(startOfDay(endLocal), 1)
  endLocal = exclusiveEnd
}
```

**What it does:**
- Takes backend's inclusive end (Oct 10 23:59:59)
- Strips time to start-of-day (Oct 10 00:00:00)
- Adds 1 day (Oct 11 00:00:00)
- FullCalendar now displays Oct 8-10 correctly

---

### **File:** `CalendarWrapper.tsx` → `handleEventDrop`
**Purpose:** Convert FullCalendar's exclusive end → backend's inclusive end when dragging events

```typescript
// Lines ~145-160
if (isAllDay) {
  const dayStart = startOfDay(start)
  if (!currentEnd || currentEnd <= start) {
    // Single-day: Set to end-of-day
    nextEnd = new Date(dayStart)
    nextEnd.setHours(23, 59, 59, 999)
  } else {
    // Multi-day: Convert exclusive to inclusive
    const inclusiveEndDay = addDays(currentEnd, -1) // Oct 11 → Oct 10
    nextEnd = new Date(startOfDay(inclusiveEndDay))
    nextEnd.setHours(23, 59, 59, 999) // Oct 10 23:59:59
  }
}
```

**What it does:**
- User drags event in FullCalendar
- FullCalendar gives us Oct 11 00:00:00 (exclusive)
- We convert to Oct 10 23:59:59.999 (inclusive)
- Backend receives and stores correct date

---

###  **File:** `CalendarWrapper.tsx` → `handleEventResize`
**Purpose:** Same as drag/drop, but for resizing events

```typescript
// Lines ~190-205
if (ev.allDay && currentEnd) {
  const inclusiveEndDay = addDays(currentEnd, -1) // Exclusive → Inclusive
  nextEnd = new Date(startOfDay(inclusiveEndDay))
  nextEnd.setHours(23, 59, 59, 999)
}
```

---

### **File:** `CalendarWrapper.tsx` → `handleDateSelect`
**Purpose:** Handle date selection (clicking/dragging to create events)

```typescript
// Lines ~230-245
if (arg.allDay) {
  const isSingleDay = isSameDay(arg.start, addDays(arg.end, -1))
  
  if (isSingleDay) {
    // Click on Oct 15: Both start and end = Oct 15
    setCreateInitialEnd(arg.start)
  } else {
    // Drag Oct 23-28: Convert Oct 29 (exclusive) → Oct 28 (inclusive)
    setCreateInitialEnd(addDays(arg.end, -1))
  }
}
```

**What it does:**
- Single-day click: Set both start/end to same date
- Multi-day drag: Convert FullCalendar's exclusive end to inclusive for the dialog

---

### **File:** `ViewEventDialog.tsx`
**Purpose:** Display logic for multi-day timed events

```typescript
// Lines ~60-75
{!isAllDay && !isSameDayEvent ? (
  // Multi-day timed: Show both dates
  <>
    <div className="font-medium">
      {format(startDate, "EEEE, MMMM d, yyyy")} – {format(endDate, "EEEE, MMMM d, yyyy")}
    </div>
    <div className="text-muted-foreground flex items-center gap-1">
      <Clock className="size-3" />
      {format(startDate, "h:mm a")} – {format(endDate, "h:mm a")}
    </div>
  </>
) : (
  // Single-day: Show date once
  ...
)}
```

---

### **File:** `EditEventDialog.tsx`
**Purpose:** Round times to 5-minute intervals when toggling from all-day to timed

```typescript
// Lines ~75-85
const roundToNearestFiveMinutes = (date: Date): Date => {
  const rounded = new Date(date)
  const minutes = rounded.getMinutes()
  const roundedMinutes = Math.round(minutes / 5) * 5
  rounded.setMinutes(roundedMinutes >= 60 ? 55 : roundedMinutes)
  rounded.setSeconds(0)
  rounded.setMilliseconds(0)
  return rounded
}
```

**Why needed:** Backend stores all-day end as 23:59:59.999, but time picker expects 5-min intervals (00, 05, 10...55).

---

## Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         USER INTERACTION                         │
└─────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                         FULLCALENDAR                             │
│  All-day events use EXCLUSIVE end dates                          │
│  (Oct 8-10 stored as start=Oct 8, end=Oct 11)                   │
└─────────────────────────────────────────────────────────────────┘
                                 │
                    ┌────────────┴────────────┐
                    │                         │
                    ▼                         ▼
            ┌───────────────┐         ┌───────────────┐
            │   DISPLAY     │         │   SAVE        │
            │   (Read)      │         │   (Write)     │
            └───────────────┘         └───────────────┘
                    │                         │
                    ▼                         ▼
        ┌────────────────────┐   ┌────────────────────┐
        │ useCalendarEvents  │   │ CalendarWrapper    │
        │ .ts                │   │ .tsx               │
        │                    │   │                    │
        │ CONVERTS:          │   │ CONVERTS:          │
        │ Oct 10 23:59:59    │   │ Oct 11 00:00:00    │
        │ (inclusive)        │   │ (exclusive)        │
        │      ↓             │   │      ↓             │
        │ Oct 11 00:00:00    │   │ Oct 10 23:59:59    │
        │ (exclusive)        │   │ (inclusive)        │
        └────────────────────┘   └────────────────────┘
                    │                         │
                    └────────────┬────────────┘
                                 ▼
                    ┌────────────────────────┐
                    │       BACKEND API      │
                    │  (Stores INCLUSIVE)    │
                    │  Oct 10 23:59:59.999   │
                    └────────────────────────┘
```
---

## Known Limitations

1. **Backend Format:** If backend changes to exclusive dates, ALL patches must be removed
2. **Timezone Handling:** Assumes UTC → local conversion via `utcIsoToLocalDate`
3. **Time Picker:** Hardcoded to 5-minute intervals (00, 05...55)
4. **DST Transitions:** Not explicitly tested for edge cases

---

## Future Migration Path

### Option 1: Keep Patches (Current)
**Pros:** Works now, no backend changes  
**Cons:** Requires developer awareness

### Option 2: Backend Standardization (Recommended for v2.0)
Change backend to store **exclusive end dates** for all-day events:
- `end_datetime: Oct 11 00:00:00` instead of `Oct 10 23:59:59`
- **Migration needed:** Update existing event data
- **Frontend impact:** Remove ALL 6 patches


---

## Developer Notes

When working with all-day events:
Remember: Backend = inclusive, FullCalendar = exclusive
- Check if modifying `useCalendarEvents.ts` → affects display
- Check if modifying `CalendarWrapper.tsx` → affects save operations
- Test both single-day and multi-day scenarios
- Verify drag/drop, resize, and date selection
- Check ViewEventDialog for display consistency