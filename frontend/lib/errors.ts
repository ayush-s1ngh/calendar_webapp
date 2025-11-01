export type ApiError = {
  response?: { data?: { message?: string } }
  message?: string
}

/**
 * Safely extract a human-readable error message from unknown error values
 * coming from Axios or thrown errors. Falls back to the provided message.
 */
export function getErrorMessage(err: unknown, fallback: string): string {
  if (typeof err === "object" && err !== null) {
    const e = err as ApiError
    return e.response?.data?.message ?? e.message ?? fallback
  }
  return fallback
}