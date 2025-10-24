"use client"

import * as React from "react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { Bell, ChevronDown, Mail, Smartphone, MessageCircle } from "lucide-react"
import { NotificationType, formatNotificationTypeLabel } from "@/components/reminders"

function TypeIcon({ type }: { type: NotificationType }) {
  if (type === "email") return <Mail className="size-4" />
  if (type === "push") return <Smartphone className="size-4" />
  return <MessageCircle className="size-4" />
}

export function ReminderHowDropdown({
  value,
  onChange,
  disabled,
}: {
  value: NotificationType
  onChange: (v: NotificationType) => void
  disabled?: boolean
}) {
  const [open, setOpen] = React.useState(false)

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
            <TypeIcon type={value} />
            <ChevronDown className="size-4 opacity-70 absolute right-2 top-1/2 -translate-y-1/2" />
          </Button>
        </DropdownMenuTrigger>
      <DropdownMenuContent className="w-24">
        <DropdownMenuItem onSelect={(e) => { e.preventDefault(); onChange("email") }}>
          <Mail className="size-4" />
          Email
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={(e) => { e.preventDefault(); onChange("push") }}>
          <Smartphone className="size-4" />
          Push
        </DropdownMenuItem>
        <DropdownMenuItem disabled className="opacity-60">
          <MessageCircle className="size-4" />
          SMS
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}