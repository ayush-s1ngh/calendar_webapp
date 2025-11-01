"use client"

/**
 * Shared icon for reminder notification types.
 * Keeps visuals and semantics consistent across UI surfaces.
 */
import { JSX } from "react"
import { Mail, Smartphone, MessageCircle } from "lucide-react"
import type { NotificationType } from "./reminder-time"

export function ReminderTypeIcon({ type, className }: { type: NotificationType; className?: string }): JSX.Element {
  if (type === "email") return <Mail className={className ?? "size-4"} />
  if (type === "push") return <Smartphone className={className ?? "size-4"} />
  return <MessageCircle className={className ?? "size-4"} />
}