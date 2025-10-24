"use client"

import * as React from "react"
import {
  BellIcon,
  Command,
  Settings2,
} from "lucide-react"

import { SidebarMain } from "@/components/sidebar/sidebar-main"
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
  sidebarMain: [
    {
      title: "Reminders",
      url: "",
      icon: BellIcon,
      isActive: true,
    },
    {
      title: "Tasks",
      url: "",
      icon: Command,
    },
    {
      title: "Settings",
      url: "",
      icon: Settings2,
    },
  ],
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader />
      <SidebarContent>
        <SidebarFilters />
        <SidebarReminders /> {/* NEW */}
        <SidebarMain items={data.sidebarMain} />
      </SidebarContent>
      <SidebarFooter>
        <SidebarUser user={data.user} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}