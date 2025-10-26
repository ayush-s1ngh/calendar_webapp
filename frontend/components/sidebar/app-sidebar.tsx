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
import { SidebarReminders } from "@/components/sidebar/sidebar-reminders" // NEW

// This is sample data.
const data = {
  // user data should be fetched from auth store
  user: {
    name: "Test Name",
    email: "Test Email",
    avatar: "",
  },
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader />
      <SidebarContent>
        <SidebarFilters />
        <SidebarReminders /> {/* NEW */}
      </SidebarContent>
      <SidebarFooter>
        <SidebarUser user={data.user} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}