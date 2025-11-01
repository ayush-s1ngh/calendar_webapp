import api from "@/lib/api"

type Tokens = { access_token: string; refresh_token?: string }
type LoginResult = { tokens: Tokens; user?: unknown }

function unwrap<T = any>(res: any): T {
  // Accepts axios response in varied shapes:
  // - { data: { data: {...} } }
  // - { data: {...} }
  // - {...}
  const lvl1 = res?.data ?? res
  return (lvl1?.data ?? lvl1) as T
}

export async function login(username: string, password: string): Promise<LoginResult> {
  const res = await api.post("/auth/login", { username, password })
  const root = unwrap<any>(res)
  const tokens: Tokens = {
    access_token:
      root?.tokens?.access_token ??
      root?.access_token ??
      root?.data?.tokens?.access_token ??
      "",
    refresh_token:
      root?.tokens?.refresh_token ??
      root?.refresh_token ??
      root?.data?.tokens?.refresh_token ??
      undefined,
  }
  const user = root?.user ?? root?.data?.user ?? undefined
  return { tokens, user }
}

export async function startGoogleOAuth(): Promise<string | null> {
  const res = await api.get("/auth/google/login")
  const root = unwrap<any>(res)
  const url: string | undefined =
    root?.authorization_url ?? root?.data?.authorization_url
  return url ?? null
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