"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { useTheme } from "next-themes"
import { toast } from "sonner"

import { authStore } from "@/store/auth"
import api from "@/lib/api"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"

export default function ProfilePage() {
  const router = useRouter()
  const tokens = authStore((s) => s.tokens)
  const user = authStore((s) => s.user)
  const setUser = authStore((s) => s.setUser)
  const hydrate = authStore((s) => s.hydrate)
  const hydrated = authStore((s) => s.hydrated)
  const doLogout = authStore((s) => s.logout)
  const { theme, setTheme } = useTheme()

  const [username, setUsername] = React.useState(user?.username || "")
  const [email, setEmail] = React.useState(user?.email || "")
  const [saving, setSaving] = React.useState(false)

  React.useEffect(() => {
    hydrate()
  }, [hydrate])

  React.useEffect(() => {
    if (!hydrated) return
    if (!tokens?.access_token) router.replace("/login")
  }, [hydrated, tokens, router])

  React.useEffect(() => {
    setUsername(user?.username || "")
    setEmail(user?.email || "")
  }, [user])

  if (!tokens?.access_token) return null

  const dirty = username !== (user?.username || "") || email !== (user?.email || "")

  const onSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!dirty) return
    setSaving(true)
    try {
      const res = await api.put("/users/me", { username, email })
      const updated = res?.data?.data || res?.data
      setUser(updated || { ...(user || {}), username, email })
      toast.success("Profile updated")
    } catch (err: any) {
      const msg = err?.response?.data?.message || "Failed to update profile"
      toast.error(msg)
    } finally {
      setSaving(false)
    }
  }

  const onLogout = () => {
    try {
      doLogout()
    } finally {
      router.replace("/login")
    }
  }

  const ThemeChip = ({
    value,
    label,
  }: {
    value: "light" | "dark" | "system"
    label: string
  }) => {
    const active = theme === value || (!theme && value === "system")
    return (
      <Button
        type="button"
        variant={active ? "default" : "outline"}
        size="sm"
        className={cn("min-w-20", active && "pointer-events-none")}
        onClick={() => setTheme(value)}
        aria-pressed={active}
        aria-label={`Set theme to ${label}`}
      >
        {label}
      </Button>
    )
  }

  return (
    <div className="p-6 max-w-3xl mx-auto w-full">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold">Profile</h1>
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push("/calendar")}
          aria-label="Go back to calendar"
        >
          ← Back to Calendar
        </Button>
      </div>

      <form className="mt-6 rounded-lg border p-4" onSubmit={onSave}>
        <h2 className="text-sm font-medium text-muted-foreground">User Information</h2>
        <Separator className="my-3" />
        <div className="grid gap-4 text-sm sm:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="username">Username</Label>
            <Input
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Your username"
              required
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
            />
          </div>
          <div className="grid gap-2 sm:col-span-2">
            <Label>Status</Label>
            <div className="text-muted-foreground">
              Email Verified: {user?.email_verified ? "Yes" : "No"}
            </div>
          </div>
        </div>
        <div className="mt-4 flex items-center justify-end gap-2">
          <Button type="submit" disabled={!dirty || saving}>
            {saving ? "Saving..." : "Save changes"}
          </Button>
        </div>
      </form>

      <div className="mt-6 rounded-lg border p-4">
        <h2 className="text-sm font-medium text-muted-foreground">Appearance</h2>
        <Separator className="my-3" />
        <div className="flex flex-wrap gap-2">
          <ThemeChip value="light" label="Light" />
          <ThemeChip value="dark" label="Dark" />
          <ThemeChip value="system" label="System" />
        </div>
      </div>

      <div className="mt-6 flex items-center justify-end">
        <Button variant="destructive" onClick={onLogout} aria-label="Log out">
          Log out
        </Button>
      </div>
    </div>
  )
}