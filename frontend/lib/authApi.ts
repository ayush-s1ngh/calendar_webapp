/**
 * Authentication API helpers.
 * - Centralizes auth endpoints and tolerant response unwrapping
 * - Avoids explicit any; relies on unknown with runtime guards
 */
import api from "@/lib/api"
import { unwrap } from "@/lib/api-unwrap"
import type { User } from "@/store/auth"

type Tokens = { access_token: string; refresh_token?: string }
type LoginResult = { tokens: Tokens; user?: User }

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null
}

function getNestedString(obj: unknown, path: string[]): string | undefined {
  let cur: unknown = obj
  for (const key of path) {
    if (!isRecord(cur) || !(key in cur)) return undefined
    cur = cur[key]
  }
  return typeof cur === "string" ? cur : undefined
}

function extractUser(obj: unknown): User | undefined {
  const candidate =
    (isRecord(obj) && obj.user) ||
    (isRecord(obj) && isRecord(obj.data) && obj.data.user) ||
    obj

  if (!isRecord(candidate)) return undefined

  const id = candidate.id
  const username = candidate.username
  const email = candidate.email
  const email_verified = candidate.email_verified
  const theme_preference = candidate.theme_preference

  if (typeof id === "number" && typeof username === "string" && typeof email === "string") {
    return {
      id,
      username,
      email,
      email_verified: typeof email_verified === "boolean" ? email_verified : undefined,
      theme_preference:
        theme_preference === "light" || theme_preference === "dark" ? theme_preference : undefined,
    }
  }
  return undefined
}

export async function login(username: string, password: string): Promise<LoginResult> {
  const res = await api.post("/auth/login", { username, password })
  const root = unwrap<unknown>(res)

  const access_token =
    getNestedString(root, ["tokens", "access_token"]) ??
    getNestedString(root, ["access_token"]) ??
    getNestedString(root, ["data", "tokens", "access_token"]) ??
    ""

  const refresh_token =
    getNestedString(root, ["tokens", "refresh_token"]) ??
    getNestedString(root, ["refresh_token"]) ??
    getNestedString(root, ["data", "tokens", "refresh_token"]) ??
    undefined

  const tokens: Tokens = { access_token, refresh_token }
  const user = extractUser(root)

  return { tokens, user }
}

export async function startGoogleOAuth(): Promise<string | null> {
  const res = await api.get("/auth/google/login")
  const root = unwrap<unknown>(res)
  const url =
    getNestedString(root, ["authorization_url"]) ??
    getNestedString(root, ["data", "authorization_url"]) ??
    null
  return url
}

export async function register(payload: {
  email: string
  username: string
  password: string
}): Promise<void> {
  await api.post("/auth/register", payload)
}

export async function requestPasswordReset(email: string): Promise<void> {
  await api.post("/auth/request-password-reset", { email })
}

export async function resetPassword(token: string, password: string): Promise<void> {
  await api.post(`/auth/reset-password/${encodeURIComponent(token)}`, { password })
}

export async function resendVerification(): Promise<void> {
  await api.post("/auth/resend-verification")
}