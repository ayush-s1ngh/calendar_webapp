"use client"

import * as React from "react"

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

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
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
            avatar: "", // backend doesn't provide avatar yet
          }}
        />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}