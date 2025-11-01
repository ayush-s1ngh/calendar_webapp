"use client"

/**
 * Quick links/tools section.
 * Renders navigational links with icons.
 */
import { JSX } from "react"
import Link from "next/link"
import type { LucideIcon } from "lucide-react"

import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

export function SidebarTools({
  tools,
}: {
  tools: {
    name: string
    url: string
    icon: LucideIcon
  }[]
}): JSX.Element {
  return (
    <SidebarGroup className="group-data-[collapsible=icon]:hidden">
      <SidebarGroupLabel>Tools</SidebarGroupLabel>
      <SidebarMenu>
        {tools.map((item) => (
          <SidebarMenuItem key={`${item.name}-${item.url}`}>
            <SidebarMenuButton asChild>
              <Link href={item.url}>
                <item.icon />
                <span>{item.name}</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        ))}
      </SidebarMenu>
    </SidebarGroup>
  )
}