# Calendar App API Documentation

This document provides a comprehensive guide to the backend API for the Personal Calendar App. It is intended for frontend developers who will be building the user interface.

## 1. Overview

The backend is a RESTful API that provides functionalities for user authentication, managing events, categories, and reminders. All API endpoints are prefixed with `/api`.

### 1.1. Base URL

The API is hosted at `http://localhost:5000` for development. The base URL for all endpoints is `http://localhost:5000/api`.

### 1.2. Authentication

Most endpoints require authentication. The API uses JSON Web Tokens (JWT) for this purpose.

1.  After a successful login or registration, the API returns an `access_token` and a `refresh_token`.
2.  For all subsequent requests to protected endpoints, you must include the `access_token` in the `Authorization` header.

**Example:** `Authorization: Bearer <your_access_token>`

### 1.3. Response Format

All API responses follow a standardized JSON format.

**Success Response:**
```json
{
  "success": true,
  "message": "Descriptive success message",
  "data": { ... } // The requested data
}
```

**Error Response:**
```json
{
  "success": false,
  "message": "Descriptive error message",
  "errors": { ... } // Optional: Detailed validation errors
}
```

### 1.4. Rate Limiting

To ensure stability, certain endpoints have rate limits. If the limit is exceeded, the API will respond with a `429 Too Many Requests` error.

-   **Registration:** 5 requests per 5 minutes
-   **Login:** 10 requests per 5 minutes
-   **Event Creation:** 30 requests per 5 minutes
-   **Reminder Creation:** 50 requests per 5 minutes
-   **Bulk Operations:** 10 requests per 5 minutes
-   **Password Reset:** 3 requests per 5 minutes

---

## 2. Authentication Endpoints

These endpoints handle user registration, login, and account management.

### 2.1. `POST /auth/register`

Registers a new user and sends a verification email.

-   **Request Body:**
    ```json
    {
      "username": "testuser",
      "email": "test@example.com",
      "password": "StrongPassword123"
    }
    ```
-   **Response (Success):**
    ```json
    {
      "success": true,
      "message": "User registered successfully. Please check your email to verify your account.",
      "data": {
        "user": {
          "id": 1,
          "username": "testuser",
          "email": "test@example.com",
          "email_verified": false
        },
        "tokens": {
          "access_token": "...",
          "refresh_token": "..."
        },
        "email_verification_sent": true
      }
    }
    ```

### 2.2. `POST /auth/login`

Logs in an existing user.

-   **Request Body:**
    ```json
    {
      "username": "testuser", // Can be username or email
      "password": "StrongPassword123"
    }
    ```
-   **Response (Success):**
    ```json
    {
      "success": true,
      "message": "Login successful",
      "data": {
        "user": {
          "id": 1,
          "username": "testuser",
          "email": "test@example.com",
          "email_verified": true
        },
        "tokens": {
          "access_token": "...",
          "refresh_token": "..."
        }
      }
    }
    ```

### 2.3. `POST /auth/logout`

Logs out the current user by invalidating their JWT.
-   **Authentication:** Required.
-   **Response (Success):**
    ```json
    {
      "success": true,
      "message": "Logout successful"
    }
    ```

### 2.4. `POST /auth/verify-email/<token>`

Verifies a user's email address using the token sent to them.

-   **URL Parameter:**
    -   `token`: The verification token from the email link.
-   **Response (Success):**
    ```json
    {
      "success": true,
      "message": "Email successfully verified",
      "data": {
        "email_verified": true
      }
    }
    ```

### 2.5. `POST /auth/resend-verification`

Resends the email verification link.
-   **Authentication:** Required.
-   **Response (Success):**
    ```json
    {
        "success": true,
        "message": "Verification email sent successfully"
    }
    ```

### 2.6. `POST /auth/request-password-reset`

Sends a password reset link to the user's email.

-   **Request Body:**
    ```json
    {
      "email": "user@example.com"
    }
    ```
-   **Response (Success):** (Always returns success to prevent email enumeration)
    ```json
    {
      "success": true,
      "message": "If an account with this email exists, a password reset link has been sent."
    }
    ```

### 2.7. `POST /auth/reset-password/<token>`

Resets the user's password using the token from the reset email.

-   **URL Parameter:**
    -   `token`: The password reset token.
-   **Request Body:**
    ```json
    {
      "password": "NewStrongPassword123"
    }
    ```
-   **Response (Success):**
    ```json
    {
        "success": true,
        "message": "Password reset successfully"
    }
    ```

### 2.8. Google OAuth

-   `GET /auth/google/login`: Initiates the Google OAuth2 flow. This will return an `authorization_url` that the user should be redirected to.
-   `GET /auth/google/callback`: The redirect URI that Google calls after the user grants permission. The backend handles this, and on success, will redirect the user to the frontend with the access token (e.g., `http://localhost:3000/oauth-success?token=...`).

---

## 3. User Endpoints

Manage user-specific data. All endpoints require authentication.

### 3.1. `GET /users/me`

Retrieves the details of the currently logged-in user.

-   **Response (Success):**
    ```json
    {
      "success": true,
      "message": "Success",
      "data": {
        "id": 1,
        "username": "testuser",
        "email": "test@example.com",
        "theme_preference": "light",
        "created_at": "2025-07-01T10:00:00Z",
        "updated_at": "2025-07-01T10:00:00Z"
      }
    }
    ```

### 3.2. `PUT /users/me`

Updates the current user's details.

-   **Request Body:** (Include only fields to be updated)
    ```json
    {
      "username": "new_username",
      "email": "new_email@example.com"
    }
    ```
-   **Response (Success):** Returns the updated user object.

### 3.3. `PUT /users/me/theme`

Updates the user's theme preference.

-   **Request Body:**
    ```json
    {
      "theme": "dark" // or "light"
    }
    ```
-   **Response (Success):**
    ```json
    {
        "success": true,
        "message": "Theme preference updated successfully",
        "data": {
            "theme_preference": "dark"
        }
    }
    ```

---

## 4. Category Endpoints

Manage event categories. All endpoints require authentication.

### 4.1. `GET /categories`

Get a list of all categories for the user. Supports pagination.

-   **Query Parameters:**
    -   `page` (optional): Page number (default: 1).
    -   `per_page` (optional): Items per page (default: 50).
-   **Response (Success):**
    ```json
    {
      "success": true,
      "message": "Success",
      "data": {
        "categories": [
          { "id": 1, "name": "Work", "color": "blue", ... },
          { "id": 2, "name": "Personal", "color": "green", ... }
        ],
        "pagination": {
          "page": 1,
          "per_page": 50,
          "total": 2,
          "total_pages": 1,
          ...
        }
      }
    }
    ```

### 4.2. `POST /categories`

Create a new category.

-   **Request Body:**
    ```json
    {
      "name": "Health",
      "color": "red",
      "description": "Health and fitness related events"
    }
    ```
-   **Response (Success):** Returns the newly created category object.

### 4.3. `GET /categories/<id>`

Get details of a specific category.

### 4.4. `PUT /categories/<id>`

Update a category.

-   **Request Body:** (Include only fields to be updated)
    ```json
    {
      "name": "Fitness",
      "color": "orange"
    }
    ```
-   **Response (Success):** Returns the updated category object.

### 4.5. `DELETE /categories/<id>`

Delete a category. Note: A category cannot be deleted if it is assigned to any events.

### 4.6. `GET /categories/<id>/events`

Get all events assigned to a specific category. Supports pagination.

---

## 5. Event Endpoints

Manage events. All endpoints require authentication.

### 5.1. `GET /api/events`

Get a list of events.

-   **Query Parameters:**
    -   `page`: Page number (default: 1).
    -   `per_page`: Items per page (default: 50, max: 100).
    -   `category_id`: Filter by a specific category ID.
    -   `start_date`: Filter events starting on or after this date (ISO 8601 format: `YYYY-MM-DDTHH:MM:SSZ`).
    -   `end_date`: Filter events starting on or before this date.
    -   `include_recurring`: `true` (default) to expand recurring events into individual instances, `false` to return only the master recurring events.
    -   `search`: Search term to filter events by title and description.

### 5.2. `POST /api/events`

Create a new event. This is a powerful endpoint that can also create associated reminders and recurrence rules.

-   **Request Body:**
    ```json
    {
      "title": "Weekly Design Sync",
      "description": "Sync up on design tasks for the week.",
      "start_datetime": "2025-07-07T14:00:00Z",
      "end_datetime": "2025-07-07T15:00:00Z",
      "is_all_day": false,
      "color": "#3f51b5",
      "category_ids": [1],
      "reminders": [
        { "minutes_before": 30, "notification_type": "email" },
        { "reminder_time": "2025-07-07T13:45:00Z", "notification_type": "push" }
      ],
      "recurrence_rule": {
        "frequency": "WEEKLY",
        "interval": 1,
        "days_of_week": ["MON"],
        "occurrence_count": 10
      }
    }
    ```
-   **Response (Success):** Returns the newly created event object, including details of created reminders and the recurrence rule.

### 5.3. `GET /api/events/<id>`

Get details for a specific event.

### 5.4. `PUT /api/events/<id>`

Update an event. The request body is similar to the create endpoint. Include only the fields you want to change.

### 5.5. `DELETE /api/events/<id>`

Delete an event.

### 5.6. Bulk Operations

-   **`DELETE /api/events/bulk-delete`**
    -   **Request Body:** `{"event_ids": [1, 2, 3]}`
    -   Deletes multiple events at once.

-   **`PUT /api/events/bulk/move`**
    -   **Request Body:** `{"event_ids": [1, 2, 3], "time_offset_minutes": 60}`
    -   Moves multiple events forward or backward in time. `time_offset_minutes` can be negative.

-   **`POST /api/events/bulk/copy`**
    -   **Request Body:** `{"event_ids": [1, 2], "time_offset_minutes": 1440, "copy_reminders": true}`
    -   Copies multiple events. `time_offset_minutes` shifts the copied events' start/end times.

---

## 6. Reminder Endpoints

Manage reminders for events. All endpoints require authentication.

### 6.1. `POST /reminders/event/<event_id>/reminders`

Create a new reminder for an event.

-   **Important:** You can create reminders in two ways:
    1.  **Relative:** `minutes_before` - an integer for how many minutes before the event start time.
    2.  **Absolute:** `reminder_time` - a specific ISO 8601 timestamp.
    You must provide one, but not both. Reminders cannot be set for a time in the past.

-   **Request Body:**
    ```json
    {
      "minutes_before": 15,
      "notification_type": "email" // 'email', 'push', or 'sms'
    }
    ```
    OR
    ```json
    {
      "reminder_time": "2025-07-07T13:45:00Z",
      "notification_type": "push"
    }
    ```

### 6.2. `GET /reminders/event/<event_id>/reminders`

Get all reminders for a specific event.

### 6.3. `PUT /reminders/<reminder_id>`

Update a reminder.

### 6.4. `DELETE /reminders/<reminder_id>`

Delete a reminder.

### 6.5. Bulk Operations

-   **`POST /reminders/bulk`**: Create multiple reminders at once.
    -   **Request Body:** `{"reminders": [{"event_id": 1, "minutes_before": 10}, ...]}`
-   **`DELETE /reminders/bulk`**: Delete multiple reminders at once.
    -   **Request Body:** `{"reminder_ids": [1, 2, 3]}`

---

## 7. Data Objects

### 7.1. Event Object
```json
{
  "id": 1,
  "title": "Team Meeting",
  "description": "Weekly team sync",
  "start_datetime": "2025-06-30T10:00:00Z",
  "end_datetime": "2025-06-30T11:00:00Z",
  "is_all_day": false,
  "color": "blue",
  "is_recurring": true,
  "recurrence_id": "uuid-for-recurring-series",
  "created_at": "...",
  "updated_at": "...",
  "categories": [
    { "id": 1, "name": "Work", "color": "blue", ... }
  ],
  "recurrence_rule": {
    "frequency": "WEEKLY", // DAILY, WEEKLY, MONTHLY, YEARLY
    "interval": 1,
    "days_of_week": ["MON"], // For WEEKLY
    "day_of_month": null,    // For MONTHLY
    "end_date": null,
    "occurrence_count": 10
  }
}
```

### 7.2. Recurrence Rule
-   `frequency`: (Required) `DAILY`, `WEEKLY`, `MONTHLY`, `YEARLY`.
-   `interval`: (Optional, default 1) e.g., an interval of 2 with a weekly frequency means every 2 weeks.
-   `days_of_week`: (For `WEEKLY`) An array of strings: `MON`, `TUE`, `WED`, `THU`, `FRI`, `SAT`, `SUN`.
-   `day_of_month`: (For `MONTHLY`) A number from 1 to 31.
-   You can specify an end condition with either `end_date` (ISO 8601 string) or `occurrence_count` (integer), but not both.

### 7.3. Reminder Object
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