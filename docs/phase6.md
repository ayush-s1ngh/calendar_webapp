# **Phase 6 Development Plan: Reminders**

## **Phase 6 Goals**
- Implement reminder management system for events
- Add reminder UI in Create/Edit Event dialogs with context-aware presets
- Add "Reminders" section in sidebar showing next 5 upcoming reminders
- Support relative (minutes_before) and absolute (reminder_time) reminders
- Integrate with existing event workflows and backend API
- Limit to 3 reminders per event with validation
- Keep styling consistent with shadcn/ui and Phase 5

---

## **Backend Endpoints to Use (from api_documentation.md)**

### **Reminders:**
- `POST /reminders/event/<event_id>/reminders` - Create single reminder
- `GET /reminders/event/<event_id>/reminders` - Get all reminders for an event
- `PUT /reminders/<reminder_id>` - Update a reminder
- `DELETE /reminders/<reminder_id>` - Delete a reminder
- `POST /reminders/bulk` - Create multiple reminders at once
- `DELETE /reminders/bulk` - Delete multiple reminders at once

### **Reminder Object Structure:**
```json
{
  "id": 1,
  "event_id": 1,
  "reminder_time": "2025-06-30T09:45:00Z",
  "notification_sent": false,
  "notification_type": "email", // email, push, sms
  "minutes_before": 15, // Not null if it's a relative reminder
  "is_relative": true
}
```

### **Reminder Types:**
- **Relative**: `minutes_before` (integer) - e.g., 15, 30, 60
- **Absolute**: `reminder_time` (ISO 8601 timestamp)
- **Important:** You must provide one, but not both. Reminders cannot be set for a time in the past.

---

## **Implementation Plan**

### **1) Reminder Storage Strategy**

**1.1. Storage decision based on event type**

**For Timed Events:**
- Store presets as `minutes_before` (relative)
- Examples: "At event start" → 0, "15 minutes before" → 15
- Custom: User enters number of minutes before

**For All-Day Events:**
- Store presets as absolute `reminder_time`
- Examples: "On event day at 9:00 AM" → calculate event date at 09:00:00
- Custom: User picks date + time with calendar and time picker

**Behavior on event time change:**
- Relative reminders (timed events) automatically adjust when event time changes
- Absolute reminders (all-day events) stay fixed at their original time

**Type conversion on event type toggle:**
- Timed → All-day: Convert all reminders to "On event day at 9:00 AM" (absolute)
- All-day → Timed: Convert all reminders to "At event start" (relative, minutes_before: 0)

---

### **2) Reminder UI in Event Dialogs**

**2.1. Create/Edit Event Dialog - Reminders Section**

**Default State:**
- No reminders pre-added by default
- Show "+ Add Reminder" button (primary action)

**When Editing Event with Existing Reminders:**
- Show summary: "3 reminders set" with "Manage Reminders" button
- Clicking expands to show all reminder rows (editable)

**Maximum Limit:**
- 3 reminders per event maximum
- When limit reached, disable "+ Add Reminder" button
- Show tooltip: "Maximum 3 reminders per event"

**2.2. Reminder Form Row Structure**

Each reminder row displays:
```
[When dropdown ▼] [How dropdown ▼] [Edit icon] [Delete icon]
```

**"When" Dropdown (Context-Aware):**

**For Timed Events** (is_all_day: false):
```
┌─ Remind me... ────────────────┐
│ ✓ At event start              │ ← Default
│   5 minutes before            │
│   10 minutes before           │
│   15 minutes before           │
│   30 minutes before           │
│   1 hour before               │
│   ────────────────────        │
│   Custom...                   │ ← Opens number input
└───────────────────────────────┘
```

**Custom Input (Timed):**
```
┌─ Custom reminder ─────────────┐
│ Remind me                     │
│ [___30___] minutes before     │ ← Number input
│                               │
│ [Cancel] [Save]               │
└───────────────────────────────┘
```

**For All-Day Events** (is_all_day: true):
```
┌─ Remind me... ────────────────┐
│ ✓ On event day at 9:00 AM     │ ← Default
│   1 day before at 9:00 AM     │
│   2 days before at 9:00 AM    │
│   1 week before at 9:00 AM    │
│   ────────────────────        │
│   Custom...                   │ ← Opens date + time picker
└───────────────────────────────┘
```

**Custom Input (All-Day):**
```
┌─ Custom reminder ─────────────┐
│ Date: [Jan 15, 2025 ▼]        │ ← Calendar popover (reuse shadcn Calendar)
│ Time: [09:00 AM     ▼]        │ ← Time picker (reuse SimpleTimePicker)
│                               │
│ [Cancel] [Save]               │
└───────────────────────────────┘
```

**"How" Dropdown (Notification Type):**
```
┌─ Notification type ───────────┐
│ ✓ Email                       │ ← Default, always enabled
│   Push notification           │ ← Enabled
│   SMS (Coming Soon)           │ ← Disabled with gray text
└───────────────────────────────┘
```

**2.3. Validation Rules**

**Enforced Validations:**
- ✅ Maximum 3 reminders per event
- ✅ No duplicate reminders (same time, ignore notification type)
- ✅ Relative reminders must be before event start
- ✅ Custom/absolute reminders CAN be after event start

**Duplicate Detection:**
- For timed events: Two reminders with `minutes_before: 15` are duplicates (even if different notification types)
- For all-day events: Two reminders with same absolute time are duplicates (whether preset or custom)

**Edge Case - Event Type Toggle:**
- When user toggles `is_all_day` checkbox:
  - Auto-convert all reminders to appropriate default:
    - Timed → All-day: Convert to "On event day at 9:00 AM"
    - All-day → Timed: Convert to "At event start"

**2.4. Reminder Row Actions**

**Edit in Place:**
- Clicking on a reminder row makes it editable
- User can change "When" and "How" dropdowns
- Changes save immediately (no explicit "Save" button needed for row edits)

**Delete:**
- Trash icon on each row
- Immediate removal from local state
- On Save, backend receives updated reminders array (without deleted one)

---

### **3) Reminder Sidebar Overview**

**3.1. Location & Structure**

**Sidebar Section:**
- Add "Reminders" section below "Search" and "Filters"
- Above "Menu" (Reminders/Tasks/Settings)

**Default View (Collapsed):**
```
┌─ Reminders ───────────────────┐
│ Reminders              [▼]    │ ← Click to expand
└───────────────────────────────┘
```

**Expanded View:**
```
┌─ Reminders ───────────────────┐
│ Reminders              [▲]    │
│                               │
│ Team Meeting | Oct 22, 3:00 PM│
│ • 1 day before at 9:00 AM • Email │
│ • 1 hour before • Push        │
│ • At event start • Email      │
│ [Edit Event]                  │
│                               │
│ Design Review | Oct 23, 10:00 AM│
│ • 15 min before • Email       │
│ [Edit Event]                  │
│                               │
│ (No more reminders)           │
└───────────────────────────────┘
```

**3.2. Display Rules**

**What to Show:**
- Show next **5 upcoming reminders** (grouped by event)
- Only show **reminders for next 30 days** (independent of calendar view)
- **Sort by reminder time** (when reminder will fire)

**Past Reminders:**
- Show past reminders **for today only**
- Example: "Reminder fired 2 hours ago" stays visible today
- Tomorrow it's hidden

**Format per event group:**
```
[Event Title] | [Event Date/Time]
• [Reminder timing] • [Notification type]
• [Reminder timing] • [Notification type]
[Edit Event]
```

**3.3. Loading & Refresh Behavior**

**Load Strategy:**
- Load reminders **on expand** (lazy loading)
- Do NOT load on page mount

**Auto-Refresh Triggers:**
- Reminder created/edited/deleted (from event dialogs)
- Event with reminders is modified
- Event with reminders is created

**No Refresh Button:**
- Auto-refresh handles updates
- Cleaner UI

**3.4. Loading & Error States**

**Loading State:**
- Show 3 skeleton loaders (shimmer effect) while fetching
- Use shadcn Skeleton component

**Empty State:**
```
┌─ Reminders ───────────────────┐
│ No upcoming reminders         │
│ Add reminders to events to    │
│ get notified.                 │
└───────────────────────────────┘
```

**Error State:**
```
┌─ Reminders ───────────────────┐
│ ⚠️ Unable to load reminders   │
│ [Retry]                       │
└───────────────────────────────┘
```
- Inline error message
- Manual retry button

**3.5. Interaction Behavior**

**Clicking on a Reminder Item:**
- Opens the **View Event dialog** for that event
- Dialog shows full event details

**Clicking "Edit Event":**
- Opens **Edit Event dialog**
- **Auto-expands "Manage Reminders" section** (pre-expanded state)
- No scrolling needed, just expanded

**Clicking Edit/Delete (if per-reminder actions were added):**
- Not implemented in Phase 6 - only "Edit Event" button per event group

**Collapse Behavior:**
- Section collapses when sidebar is in icon mode (consistent with other sections)

---

### **4) Backend Integration & API Strategy**

**4.1. Reminder CRUD Strategy**

**Creating Reminders (with Event):**
- Include `reminders` array in `POST /events` payload
- Backend creates event + reminders in single transaction
- Example payload:
```json
{
  "title": "Team Meeting",
  "start_datetime": "2025-10-22T15:00:00Z",
  "end_datetime": "2025-10-22T16:00:00Z",
  "is_all_day": false,
  "category_ids": [1],
  "reminders": [
    { "minutes_before": 15, "notification_type": "email" },
    { "minutes_before": 60, "notification_type": "push" }
  ]
}
```

**Updating Reminders (with Event):**
- Include `reminders` array in `PUT /events/<id>` payload
- Send full reminders array (backend handles diff internally)
- No need to track added/updated/deleted on frontend

**Deleting All Reminders:**
- Omit `reminders` key from PUT payload (backend keeps existing)
- To explicitly remove all: send empty array if backend supports, or delete individually

**4.2. Error Handling**

**Partial Success on Create:**
- Event created (201), but 1 reminder fails
- Show toast: "Event created, but 1 reminder failed to create. You can add it later."
- Close dialog and refresh calendar
- User can edit event to add missing reminder

**Partial Success on Update:**
- Event updated, but 1 reminder operation fails
- Toast: "Event updated, but 1 reminder could not be saved. Please try again."
- Close dialog and refresh
- User can re-open Edit dialog and retry

**Validation Errors:**
- Show field errors inline if backend returns validation errors
- Use sonner toast for generic failures

---

### **5) Component Structure**

**5.1. New Components to Create**

```
components/
├── reminders/
│   ├── ReminderForm.tsx              # Reminder row with When/How dropdowns
│   ├── ReminderWhenDropdown.tsx      # Context-aware "When" dropdown
│   ├── ReminderHowDropdown.tsx       # Notification type dropdown
│   ├── CustomReminderDialog.tsx      # Custom reminder input (timed)
│   ├── CustomAllDayReminderDialog.tsx # Custom reminder input (all-day)
│   ├── reminder-utils.ts             # Validation, helpers, types
│   └── index.ts                      # Barrel export
├── sidebar/
│   └── sidebar-reminders.tsx         # New sidebar reminders section
```

**5.2. Modified Components**

```
components/
├── events/
│   ├── CreateEventDialog.tsx         # Add reminders section
│   ├── EditEventDialog.tsx           # Add reminders section
│   └── event-utils.ts                # Add reminder types to EventFormValues
├── sidebar/
│   └── app-sidebar.tsx               # Import and add <SidebarReminders />
```

**5.3. Store (Optional - Can use component state)**

Since reminders are tightly coupled to events, **component state is sufficient**. No need for a separate Zustand store.

**Reminder state lives in:**
- Event dialog component state (for adding/editing reminders)
- Sidebar component state (for displaying upcoming reminders)

---

### **6) Data Flow & State Management**

**6.1. Event Dialog Reminder State**

**Form State Structure:**
```typescript
type ReminderFormValue = {
  id?: number // For existing reminders
  type: 'preset' | 'custom'
  preset?: string // 'at_start' | '5_min' | '15_min' | ...
  customMinutes?: number // For timed custom
  customDateTime?: Date // For all-day custom
  notificationType: 'email' | 'push' | 'sms'
}

type EventFormValues = {
  // ... existing fields
  reminders: ReminderFormValue[]
}
```

**On Submit (Create/Edit Event):**
```typescript
// Convert ReminderFormValue[] to API payload
const remindersPayload = formValues.reminders.map(r => {
  if (isTimedEvent) {
    return {
      minutes_before: r.type === 'preset' ? presetToMinutes(r.preset) : r.customMinutes,
      notification_type: r.notificationType
    }
  } else {
    return {
      reminder_time: calculateAbsoluteTime(r),
      notification_type: r.notificationType
    }
  }
})

const payload = {
  ...eventData,
  reminders: remindersPayload
}

await api.post('/events', payload) // or PUT for edit
```

**6.2. Sidebar Reminders State**

**Fetch Strategy:**
```typescript
// Fetch reminders for next 30 days
const fetchUpcomingReminders = async () => {
  const now = new Date()
  const future = addDays(now, 30)
  
  // Get all events with reminders for this range
  const params = {
    start_date: now.toISOString(),
    end_date: future.toISOString(),
    include_recurring: true,
    per_page: 100
  }
  
  const events = await api.get('/events', { params })
  
  // For each event, fetch its reminders
  const allReminders = []
  for (const event of events.data.events) {
    const reminders = await api.get(`/reminders/event/${event.id}/reminders`)
    allReminders.push({
      event,
      reminders: reminders.data
    })
  }
  
  // Filter and sort by reminder_time
  return processAndSortReminders(allReminders)
}
```

**Grouping Logic:**
```typescript
// Group reminders by event
type ReminderGroup = {
  event: EventData
  reminders: ReminderData[]
}

// Show only next 5 groups (events with reminders)
const displayGroups = groupedReminders.slice(0, 5)
```

---

### **7) Helper Functions & Utilities**

**7.1. Reminder Conversion Helpers**

```typescript
// components/reminders/reminder-utils.ts

// Convert preset to minutes_before
export function presetToMinutes(preset: string): number {
  const map: Record<string, number> = {
    'at_start': 0,
    '5_min': 5,
    '10_min': 10,
    '15_min': 15,
    '30_min': 30,
    '1_hour': 60,
  }
  return map[preset] ?? 0
}

// Calculate absolute reminder_time for all-day events
export function calculateAbsoluteReminderTime(
  eventDate: Date,
  preset: string,
  customDateTime?: Date
): string {
  if (customDateTime) {
    return customDateTime.toISOString()
  }
  
  const map: Record<string, Date> = {
    'same_day_9am': setHours(eventDate, 9),
    '1_day_before_9am': setHours(addDays(eventDate, -1), 9),
    '2_days_before_9am': setHours(addDays(eventDate, -2), 9),
    '1_week_before_9am': setHours(addDays(eventDate, -7), 9),
  }
  
  return (map[preset] ?? setHours(eventDate, 9)).toISOString()
}

// Check for duplicate reminders (same time)
export function isDuplicateReminder(
  reminders: ReminderFormValue[],
  newReminder: ReminderFormValue,
  isTimedEvent: boolean
): boolean {
  const newTime = isTimedEvent 
    ? presetToMinutes(newReminder.preset!)
    : calculateAbsoluteReminderTime(...)
  
  return reminders.some(r => {
    const existingTime = isTimedEvent ? presetToMinutes(r.preset!) : calculateAbsoluteReminderTime(...)
    return existingTime === newTime
  })
}

// Validate relative reminder is before event start
export function validateRelativeReminder(
  minutesBefore: number,
  eventStart: Date
): boolean {
  const reminderTime = addMinutes(eventStart, -minutesBefore)
  return reminderTime < eventStart
}
```

**7.2. Display Formatting Helpers**

```typescript
// Format reminder timing for display
export function formatReminderTiming(
  reminder: ReminderData,
  event: EventData
): string {
  if (reminder.is_relative && reminder.minutes_before !== null) {
    if (reminder.minutes_before === 0) return 'At event start'
    if (reminder.minutes_before < 60) return `${reminder.minutes_before} min before`
    const hours = Math.floor(reminder.minutes_before / 60)
    return `${hours} hour${hours > 1 ? 's' : ''} before`
  }
  
  // Absolute reminder
  const reminderDate = new Date(reminder.reminder_time)
  const eventDate = new Date(event.start_datetime)
  
  if (isSameDay(reminderDate, eventDate)) {
    return `On event day at ${format(reminderDate, 'h:mm a')}`
  }
  
  const daysDiff = differenceInDays(eventDate, reminderDate)
  if (daysDiff === 1) return `1 day before at ${format(reminderDate, 'h:mm a')}`
  if (daysDiff === 7) return `1 week before at ${format(reminderDate, 'h:mm a')}`
  return `${daysDiff} days before at ${format(reminderDate, 'h:mm a')}`
}
```

---

### **8) Acceptance Criteria**

**Event Dialog Reminders:**
- User can add up to 3 reminders in Create Event dialog
- User can add up to 3 reminders in Edit Event dialog
- Reminder presets differ based on is_all_day toggle
- Custom reminder input works for both timed and all-day events
- Notification type dropdown shows Email (enabled), Push (enabled), SMS (disabled "Coming Soon")
- Maximum 3 reminders enforced (button disabled with tooltip)
- Duplicate reminders blocked (same time)
- Relative reminders validated (must be before event start)
- Custom/absolute reminders allowed after event start
- Reminders auto-convert when event type toggles (all-day ↔ timed)
- Edit Event dialog shows "X reminders set" with "Manage Reminders" button
- Clicking "Manage Reminders" expands to show editable reminder rows
- User can edit reminder rows in place (change When/How)
- User can delete individual reminders with trash icon

**Sidebar Reminders:**
- "Reminders" section appears below Filters in sidebar
- Section loads reminders on expand (lazy loading)
- Shows next 5 upcoming reminders grouped by event
- Reminders cover next 30 days (independent of calendar view)
- Past reminders shown for today only
- Each reminder shows: event title, event time, reminder timing, notification type
- Grouped format: one "Edit Event" button per event group
- Auto-refreshes when reminders are created/updated/deleted
- Auto-refreshes when events with reminders are modified
- Shows skeleton loaders (3 items) while loading
- Shows empty state message when no reminders exist
- Shows inline error with Retry button on fetch failure
- Clicking reminder item opens View Event dialog
- Clicking "Edit Event" opens Edit Event dialog with Manage Reminders pre-expanded
- Section collapses when sidebar is in icon mode

**Backend Integration:**
- Reminders included in POST /events payload on create
- Reminders included in PUT /events/<id> payload on update
- Backend receives full reminders array (no frontend diff tracking)
- Partial success handled gracefully (event saved, some reminders failed)
- Error toasts shown for all API failures

---

### **9) Edge Cases & Notes**

**Timezone Handling:**
- Convert local Date to UTC ISO for `reminder_time` (absolute reminders)
- Backend stores reminders in UTC, frontend converts to local for display
- Use `localDateToUtcIso()` from `lib/time.ts` for conversions

**Event Type Toggle:**
- When user toggles `is_all_day` checkbox during edit:
  - Show warning: "Changing event type will convert all reminders to default values"
  - Auto-convert all reminders (timed ↔ all-day)
  - No manual re-entry needed

**Recurring Events:**
- Reminders are per-instance (not series-wide)
- Show notice in dialog: "Reminder applies to this instance only"
- Phase 6 doesn't support series-wide reminders (defer to later phase)

**Pagination:**
- Sidebar reminders limited to next 5 groups
- No pagination UI needed
- If more than 5 events have reminders, show only first 5 (sorted by reminder time)

**Notification Types:**
- Email: Fully supported
- Push: Fully supported
- SMS: Disabled with "Coming Soon" label (gray text, not clickable)
- Backend may still accept SMS type, but frontend blocks selection

**Backend Compatibility:**
- Assumes `PUT /events/<id>` accepts `reminders` array
- If backend doesn't support this, use separate reminder endpoints:
  - `POST /reminders/bulk` for creating multiple
  - `DELETE /reminders/bulk` for deleting multiple
  - `PUT /reminders/<id>` for updating individual

**Accessibility:**
- Ensure dropdowns are keyboard-navigable
- Add aria-labels to Add/Edit/Delete buttons
- Focus management in dialogs (auto-focus first field)

---

### **10) Implementation Steps (Suggested Order)**

**Step 1: Foundation (Utilities & Types)**
1. Create `components/reminders/reminder-utils.ts`
2. Define TypeScript types for reminders
3. Add helper functions (conversion, validation, formatting)

**Step 2: Reminder Form Components**
1. Create `ReminderWhenDropdown.tsx` (context-aware presets)
2. Create `ReminderHowDropdown.tsx` (notification types)
3. Create `CustomReminderDialog.tsx` (timed custom input)
4. Create `CustomAllDayReminderDialog.tsx` (all-day custom input)
5. Create `ReminderForm.tsx` (main form row component)

**Step 3: Integrate into Event Dialogs**
1. Modify `CreateEventDialog.tsx`:
   - Add reminders state to form
   - Add "+ Add Reminder" button
   - Add reminder rows
   - Add validation logic
   - Include reminders in payload
2. Modify `EditEventDialog.tsx`:
   - Show "X reminders set" summary
   - Add "Manage Reminders" expand/collapse
   - Pre-populate existing reminders
   - Handle auto-conversion on is_all_day toggle
   - Include reminders in payload

**Step 4: Sidebar Reminders Section**
1. Create `components/sidebar/sidebar-reminders.tsx`
2. Implement fetch logic (lazy load on expand)
3. Implement grouping and sorting
4. Add skeleton loaders, empty state, error state
5. Add click handlers (open View/Edit dialog)
6. Add auto-refresh triggers
7. Add to `app-sidebar.tsx`

**Step 5: Testing & Edge Cases**
1. Test all reminder presets (timed + all-day)
2. Test custom reminder inputs
3. Test duplicate validation
4. Test event type toggle conversion
5. Test max 3 reminders limit
6. Test sidebar loading/error/empty states
7. Test auto-refresh on CRUD operations
8. Test notification type dropdown (SMS disabled)

**Step 6: Polish & UX**
1. Add tooltips to disabled buttons
2. Add confirmation dialogs for delete actions
3. Add animations for expand/collapse
4. Test keyboard navigation
5. Test mobile responsiveness
6. Add loading spinners where needed

---