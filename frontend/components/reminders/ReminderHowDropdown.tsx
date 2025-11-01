"use client"

/**
 * Dropdown for choosing notification channel (Email/Push/SMS).
 * - Closes on selection
 * - Uses shared ReminderTypeIcon and type label formatter
 */
import { JSX } from "react"
import * as React from "react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { ChevronDown } from "lucide-react"
import { NotificationType, formatNotificationTypeLabel } from "@/components/reminders"
import { ReminderTypeIcon } from "./ReminderTypeIcon"

export function ReminderHowDropdown({
  value,
  onChange,
  disabled,
}: {
  value: NotificationType
  onChange: (v: NotificationType) => void
  disabled?: boolean
}): JSX.Element {
  const [open, setOpen] = React.useState(false)

  const select = (v: NotificationType) => {
    onChange(v)
    setOpen(false)
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="relative justify-center w-full md:w-[90px] md:shrink-0 px-2 gap-2"
          disabled={disabled}
          aria-label={`Notification type: ${formatNotificationTypeLabel(value)}`}
          title={formatNotificationTypeLabel(value)}
        >
          <ReminderTypeIcon type={value} />
          <ChevronDown className="size-4 opacity-70 absolute right-2 top-1/2 -translate-y-1/2" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-28">
        <DropdownMenuItem
          onSelect={(e) => {
            e.preventDefault()
            select("email")
          }}
          aria-label="Email"
        >
          <ReminderTypeIcon type="email" />
          Email
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={(e) => {
            e.preventDefault()
            select("push")
          }}
          aria-label="Push"
        >
          <ReminderTypeIcon type="push" />
          Push
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled
          className="opacity-60"
          title="SMS coming soon"
          aria-disabled
        >
          <ReminderTypeIcon type="sms" />
          SMS
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}