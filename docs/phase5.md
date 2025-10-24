## Phase 5 Goals
- Replace dummy events with real API data.
- Introduce three event dialogs: Create Event, Edit Event, View Event.
- Introduce category management: Manage Categories dropdown in the sidebar with:
  - Category list with color chips
  - Multi-select filters to filter events in the calendar
  - Add Category entry point at the end
  - Dialogs for Create Category, View Category, Edit Category
- Add search in the sidebar to filter events by title/description.
- Keep styling and components consistent with shadcn/ui and the current calendar theme.

## Backend endpoints to use (from api_documentation):
- Events:
  - GET /api/events?start_date&end_date&category_id&search&include_recurring&page&per_page
  - POST /api/events
  - GET /api/events/<id>
  - PUT /api/events/<id>
  - DELETE /api/events/<id>
  - Bulk: DELETE /api/events/bulk-delete, PUT /api/events/bulk/move, POST /api/events/bulk/copy (optional later)
- Categories:
  - GET /categories?page&per_page
  - POST /categories
  - GET /categories/<id>
  - PUT /categories/<id>
  - DELETE /categories/<id> (blocked if used by events)
  - GET /categories/<id>/events (not needed initially)

## Implementation Plan

### 1) Event Data Integration
1.1. Event mapping and timezones
- API fields to FullCalendar:
  - id -> id
  - title -> title
  - start_datetime (UTC) -> start (as Date using utcIsoToLocalDate)
  - end_datetime (UTC) -> end (as Date)
  - is_all_day -> allDay
  - color (optional) -> prefer event color if present, else category color
  - categories[] -> take the first category as “primary” for color chip, and include an array of category IDs in extendedProps
  - is_recurring/recurrence_id -> extendedProps to decide certain UX (e.g., editing series later)
- Use lib/time.ts helpers to convert/format time consistently.

1.2. Replace dummy fetch with API fetch
- Hook FullCalendar datesSet to load range:
  - Compute range from arg.start to arg.end
  - Call GET /api/events with:
    - start_date: ISO string in UTC (arg.start)
    - end_date: ISO string in UTC (arg.end)
    - include_recurring: true
    - category_id: optional, repeat param for multiple categories (or comma-separated by backend convention; if the API only supports a single ID, do multiple calls client-side and merge, but prefer backend multi-param if supported)
    - search: current sidebar search term (debounced)
    - per_page: 100 (to avoid pagination pain in a single view)
- Map and set events state; preserve your StyledFullCalendar eventContent.

1.3. Drag, drop, and resize
- onEventDrop/onEventResize:
  - PUT /api/events/<id> with new start_datetime/end_datetime (convert to UTC ISO before sending).
  - On success: toast success and update event in local state.
  - On failure: revert change (FullCalendar gives revert function) and toast error.
- Edge cases:
  - All-day → timed transitions: set is_all_day accordingly.
  - Timed → all-day transitions: set to all_day and strip time.

### 2) Filters and Search in Sidebar
2.1. Sidebar changes
- Replace “Add Category” with “Manage Categories” dropdown:
  - Click opens a dropdown with:
    - Search input for categories (optional)
    - A list of categories with:
      - Colored dot (category.color or a mapped CSS var) and name
      - Checkbox/toggle to filter events by selected categories (multi-select)
    - Divider
    - “Add Category” action at the end (opens Create Category dialog)
- Add “Search Events” input in the sidebar (above menu or in Tools group):
  - Debounce 300–500ms.
  - When typing, trigger events reload with search param.
  - Clear button to reset search and reload.

2.2. Category fetching and state
- On app load (or when calendar page mounts), fetch categories via GET /categories and cache in state (Zustand store).
- Store:
  - categories: list
  - selectedCategoryIds: Set<number>
  - searchTerm: string
  - actions: loadCategories, toggleCategory, clearFilters, setSearchTerm

2.3. Filter behavior
- When a category is toggled:
  - Update selectedCategoryIds in store
  - Re-fetch events for current visible range with category filters applied.
- When searchTerm changes (debounced):
  - Re-fetch events for current visible range with search param.

### 3) Manage Categories UX (Dialogs)
3.1. Create Category dialog
- Fields: name (required), color (required), description (optional).
- Use shadcn/ui Select or a small color palette with CSS tokens or hex input.
- Validation: name non-empty; color valid (if palette pick, skip validation).
- Submit: POST /categories
- On success: toast, close dialog, reload categories, optionally re-fetch events if a new filter is auto-selected.

3.2. View Category dialog
- Read-only details (name, color, description, counts optional if exposed).
- Actions:
  - Edit (opens Edit dialog)
  - Delete (if allowed):
    - Try DELETE /categories/<id>; show alert-dialog on delete with message about block if assigned to events.
    - On 400/409 that indicates it’s assigned to events, show error toast, keep dialog open.

3.3. Edit Category dialog
- Same fields as create, prefilled.
- Submit: PUT /categories/<id>
- On success: toast, close dialog, reload categories and re-fetch events (if category visuals changed).

Note: The dropdown can have a small “...” action per category (View/Edit/Delete) or you can add a “Manage all” entry that opens a Category Manager dialog with a list and per-item actions.

### 4) Event Dialogs (shadcn/ui)
4.1. View Event dialog
- Trigger: FullCalendar eventClick opens this dialog.
- Fields to show:
  - Title (large), category name and color chip
  - Date/time (format in local timezone), all-day badge if applicable
  - Description
  - Recurrence tag if is_recurring (read-only)
- Actions:
  - Edit (opens Edit dialog)
  - Delete:
    - If non-recurring: DELETE /api/events/<id>
    - If recurring: initially, surface a notice “This is part of a recurring series.” For Phase 5, keep it simple and delete this one; series-level actions can be deferred or shown as “coming soon.”
  - On success: toast, close dialog, reload events.
  - Cancel/Close button.

4.2. Create Event dialog
- Entry points:
  - Toolbar “Add Event” (prefill dates if user is on day/week and a slot is selected; if month view, default to today all-day)
  - Day click in FullCalendar (prefill date/time)
- Fields:
  - Title (required)
  - Description (optional)
  - Date/time:
    - is_all_day toggle
    - If is_all_day: single day or start/end date pickers
    - If timed: start_datetime and end_datetime (time pickers)
  - Categories: single-select dropdown (from fetched categories), compulsory to select one
  - Recurrence: For Phase 5, keep minimal:
    - Toggle recurrence off by default
    - If on: frequency (WEEKLY), interval, days_of_week, occurrence_count (limit)
    - Keep other complex rules out, to avoid Phase 6 overlap
  - Reminders: For Phase 5, do NOT include advanced reminder UI. Show a small note “Reminders are available in Phase 6” or allow adding a single relative reminder if you want to test the API path.
- Submit:
  - POST /api/events
  - On success: toast, close, reload events for current range, highlight created event.

4.3. Edit Event dialog
- Entry: From View Event dialog or event double-click (optional)
- Same fields as Create, prefilled with existing data.
- If recurring:
  - For Phase 5: show a non-blocking note “Editing instances in a recurring series is limited.” Keep scope to updating the event itself (or the master if backend returns is_recurring/recurrence_id metadata).
- Submit:
  - PUT /api/events/<id>
  - On success: toast, close, reload events.

4.4. Form validation
- Use zod for title (required), date/time (end after start), category IDs (required), recurrence (if enabled, validate days_of_week for WEEKLY).
- Use your existing form patterns (react-hook-form + zodResolver).

### 5) Calendar Interactions and UX Details
- Event click → View Event dialog.
- Date click (month) → open Create Event dialog prefilled with all-day for that date.
- Slot selection (day/week) → open Create Event dialog prefilled with start/end selection.
- Drag-and-drop / resize → PUT update. Use revert on failure.
- Popover “+n more”: keep your current popover style; clicking an event in popover opens the View dialog.

### 6) State Management (Zustand)
Create two light stores to keep components decoupled from API details.

6.1. Category store
- categories: []
- selectedCategoryIds: Set<number>
- isLoading: boolean
- actions:
  - loadCategories(): GET /categories
  - toggleCategory(id): add/remove
  - selectAll / clearSelection
  - createCategory(payload)
  - updateCategory(id, payload)
  - deleteCategory(id)

6.2. Event store
- eventsByRangeKey: Map<string, EventInput[]> or a simple events[] with lastRange
- isLoading: boolean
- lastQuery: { start, end, search, categories }
- actions:
  - loadEvents(range, filters) → GET /api/events
  - createEvent(payload) → POST, then reload
  - updateEvent(id, payload) → PUT, then reload or merge update
  - deleteEvent(id) → DELETE, then reload

Note: Because FullCalendar hands you a visible range, use a simple key like `${startISO}_${endISO}_${search}_${categoryIds.sort().join(',')}` to avoid stale caching. You can keep it simple and just reload for the current range.

### 7) Error, Loading, Empty States
- Loading:
  - Keep your initial overlay skeleton on calendar load.
  - While filters/search changes, show a subtle spinner in the toolbar or muted overlay in the grid.
- Errors:
  - Use sonner toasts for API failures (consistent with auth flows).
  - For dialogs, surface field errors inline from backend validation if provided.
- Empty state:
  - Show “No events for this range” ghost state in list view and keep the grid clean in month view. In the toolbar, you can show a subtle hint “Try clearing filters.”

### 8) Acceptance Criteria
- Calendar loads events from backend for the visible range with include_recurring=true by default.
- Changing month/week/day triggers re-fetch with correct start_date/end_date.
- Toggling category filters re-fetches and updates the view.
- Typing in “Search Events” filters via backend search param (debounced).
- Clicking an event opens View Event dialog with accurate details.
- Creating an event from toolbar/day click/slot selection works and appears immediately.
- Editing an event updates its details and the calendar view.
- Deleting an event removes it and shows a success toast.
- Managing categories:
  - Dropdown lists categories with color chips and toggles
  - You can add a category from the dropdown, see it appear, and use it as a filter
  - View and Edit category via dialog
  - Attempting to delete a category used by events shows a friendly error

### 09) Edge Cases and Notes
- Timezones: Convert server UTC timestamps to local Date for display; send UTC ISO back on create/update.
- All-day crossing: If all-day spans multiple days, ensure end is inclusive per FullCalendar (usually end should be end-of-day next day; test with backend).
- Recurring series edits: Keep scope minimal in Phase 5; don’t implement “this instance vs series” logic unless backend supports it explicitly.
- Pagination: For calendar views, set per_page=100. If you hit limits, handle multiple pages or bump server default later.
- Category color mapping:
  - Backend category color may be a name (blue/green) or hex; map to your CSS variables or store the raw color to use for bullets/borders.
- Accessibility: Ensure Dialog focus trap, keyboard navigation, aria labels for buttons.
