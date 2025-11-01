"use client"

/**
 * Application sidebar layout.
 * Composes filters, reminders, and user actions. Uses the "icon" collapsible variant.
 */
import * as React from "react"
import { JSX } from "react"

import { SidebarUser } from "@/components/sidebar/sidebar-user"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from "@/components/ui/sidebar"
import { SidebarFilters } from "@/components/sidebar/sidebar-filters"
import { SidebarReminders } from "@/components/sidebar/sidebar-reminders"
import { authStore } from "@/store/auth"

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>): JSX.Element {
  const user = authStore((s) => s.user)

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader />
      <SidebarContent>
        <SidebarFilters />
        <SidebarReminders />
      </SidebarContent>
      <SidebarFooter>
        <SidebarUser
          user={{
            name: user?.username || "User",
            email: user?.email || "",
            avatar: "",
          }}
        />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}