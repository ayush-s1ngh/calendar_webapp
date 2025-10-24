# Frontend Development Plan for Calendar Web Application

## Phase 1: Project Setup

**Objectives:** Initialize the project foundation, configure shadcn/ui for minimal aesthetic, set up core dependencies, and establish global state/routing.

**Detailed Tasks:**

- **Task 1.1: Initialize Vite Project**
  - Create a new Vite project with React + TypeScript template: `npm create vite@latest frontend`
  - Install core dependencies: `npm install react-router-dom axios zustand react-hook-form fullcalendar date-fns`.

- **Task 1.2: Set Up shadcn/ui for Vite**
  - Follow the 1.shadcn_vite_installation_guide to install shadcn/ui.
  - Use shadcn/ui CLI to add essential blocks: login-02 (`npx shadcn@latest add login-02`), sidebar-08 (`npx shadcn@latest add sidebar-08`).
  - Install shadcn/ui components: Button, Input, Label, Card, Dialog, Toast, DatePicker, etc etc. (`npx shadcn@latest add button input label card dialog toast date-picker..`).

**Deliverables:** Project scaffolded with Vite, React, TypeScript, shadcn/ui blocks/components, and core libraries installed.

## Phase 2: Authentication

**Objectives:** Implement secure auth flows using shadcn/ui blocks and components for a minimal, user-friendly experience.

**Detailed Tasks:**

- **Task 2.1: Global State, API Client, and Utils**
  - Implement Zustand store for auth (token, user, theme) and app state (e.g., events cache).
  - Create Axios instance with baseURL from env, Authorization interceptor (Bearer token from localStorage), and 401 handler (clear storage, redirect to login).
  - Add timezone utils with date-fns: Functions to convert UTC ISO to local browser timezone and vice versa.
  - Set up toast notifications using shadcn/ui's Toast component with Sonner.

- **Task 2.2: Routing Setup**
  - Configure React Router with routes: /login, /register, /verify-email/:token, /forgot-password, /reset-password/:token, /calendar (protected), /profile (protected), /oauth-success.
  - Create a ProtectedRoute component: Check localStorage token; redirect to /login if invalid/missing.

- **Task 2.3: Build Login and Register Pages**
  - Use components/login-form for full-page login.
  - Build Register page similarly: Form for email/password/username; POST /auth/register, show success toast, redirect to /login.

- **Task 2.4: Handle OAuth and Verification Flows**
  - For /oauth-success: Extract token from URL query, store in localStorage, toast success, redirect to /calendar (or /verify-email if unverified).
  - Build Verify-Email page: Auto-POST /auth/verify-email/:token, toast result, redirect to /login.
  - Handle unverified users post-login: GET /users/me, check email_verified, redirect if false.

- **Task 2.5: Forgot/Reset Password Pages**
  - Use shadcn/ui forms: Forgot page submits email to POST /auth/request-password-reset.
  - Reset page extracts token, submits new password to POST /auth/reset-password/:token, redirects to /login with toast.

- **Task 2.6: Error Handling and Validation**
  - Add client-side validation with React Hook Form (e.g., email format, password strength).
  - Handle API errors with toasts (e.g., invalid credentials).

**Deliverables:** Fully functional auth demo (login/register/Google OAuth/verification/reset) with shadcn/ui styling.

## Phase 3: Calendar Page Setup with Sidebar

**Objectives:** Create the main calendar layout, integrate sidebar using shadcn/ui block, and set up basic views.

**Detailed Tasks:**

- **Task 3.1: Calendar Page Layout**
  - Integrate FullCalendar with monthly default view; Add shadcn/ui buttons for day/week/month switches.
  - Style FullCalendar to match shadcn/ui: Borderless, neutral colors, sans-serif typography; Use API category colors for events.

- **Task 3.2: Sidebar Implementation**
  - Integrate shadcn/ui sidebar-01 block on the left: Include mini calendar (shadcn/ui DatePicker), search input (shadcn/ui Input), buttons for "Create Event" and "Manage Categories" (open modals).
  - Add upcoming reminders section: List with dismiss buttons, fetched via API (convert to local timezone).
  - Place profile link at bottom (shadcn/ui Button linking to /profile).
  - Ensure mobile responsiveness: Convert to drawer on small screens using shadcn/ui Drawer.

- **Task 3.3: Initial API Integration**
  - On calendar view change, fetch events: GET /api/events?startdate=<UTC>&enddate=<UTC>, convert/display in local timezone.

**Deliverables:** Static calendar page with sidebar, basic views, and placeholder data.

## Phase 4: Calendar Page Functionality

**Objectives:** Add interactive features like event CRUD, modals, and integrations using shadcn/ui components.

**Detailed Tasks:**

- **Task 4.1: Event and Category Modals**
  - Build EventModal with shadcn/ui Dialog: Fields (title, description, start/end via DatePicker, isAllDay checkbox, color picker, category select, recurrence inputs, reminders).
  - Integrate CRUD: POST/PUT/DELETE /api/events/{id}; Support bulk endpoints.
  - Build CategoryModal similarly: CRUD via /categories (name, color, description).
  - Use React Hook Form for validation and timezone conversions.

- **Task 4.2: Interactions and Reminders**
  - Enable FullCalendar click/drag: Open modal for create/edit; Update via API on drag.
  - Fetch/display reminders: GET /reminders/event/{id}, show in sidebar with dismiss (POST delete).

- **Task 4.3: Profile Page**
  - Display user data from GET /users/me using shadcn/ui Card.
  - Forms for update (username/email via PUT /users/me); Theme toggle (localStorage + PUT /users/me/theme); Logout (POST /auth/logout, clear storage).

**Deliverables:** Interactive calendar with modals, API CRUD, and profile management.

## Phase 5: Polishing the UI and UX

**Objectives:** Refine aesthetics, ensure responsiveness, add accessibility, and optimize.

**Detailed Tasks:**

- **Task 5.1: Theme and Typography Polish**
  - Implement dark mode toggle matching shadcn/ui (use ThemeProvider, auto-detect system preference).
  - Ensure all typography matches shadcn/ui: Sans-serif, consistent sizes/spacing, neutral colors.

- **Task 5.2: Responsiveness and Accessibility**
  - Test mobile-first: Sidebar as drawer, modals full-screen on small devices, FullCalendar adaptive views.
  - Add ARIA labels, keyboard navigation (e.g., focusable modals/buttons).
  - Optimize performance: Memoize components, lazy-load events.

- **Task 5.3: Error Handling and Validation**
  - Global toasts for all API interactions; Handle edge cases (rate limits, invalid data).

**Deliverables:** Polished, responsive app with enhanced UX.

## Phase 6: Testing and Deployment (Final Wrap-Up)

**Objectives:** Validate, fix, deploy, and document.

**Detailed Tasks:**

- **Task 6.1: Manual Testing**
  - E2E tests: All auth flows, event/reminder CRUD, theme toggle, timezone handling, edge cases (invalid tokens, large fetches).
- **Task 6.2: Bug Fixes and Optimizations**
  - Address issues; Optimize for <50 events (e.g., caching with Zustand).
- **Task 6.3: Deployment**
  - Set up on Vercel/Render: Configure env vars (VITE_API_URL, FRONTEND_URL); Deploy and test production build.
- **Task 6.4: Documentation**
  - Update README: Setup instructions, env vars, architecture, shadcn/ui customization notes.

**Deliverables:** Deployed MVP, test report, handover docs.

This revamped plan is detailed yet actionable, leveraging shadcn/ui for a modern minimal look. If you need code snippets or adjustments, let me know!
