"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { authStore } from "@/store/auth"
import {SidebarInset, SidebarProvider, SidebarTrigger} from "@/components/ui/sidebar";
import {AppSidebar} from "@/components/sidebar/app-sidebar";
import {Separator} from "@/components/ui/separator";
import {Calendar} from "@/components/calendar";

export default function CalendarPage() {
  const router = useRouter()
  const tokens = authStore((s) => s.tokens)
  const user = authStore((s) => s.user)
  const hydrate = authStore((s) => s.hydrate)
  const hydrated = authStore((s) => s.hydrated)

  React.useEffect(() => {
    hydrate()
  }, [hydrate])

  React.useEffect(() => {
    if (!hydrated) return
    if (!tokens?.access_token) {
      router.replace("/login")
    }
  }, [hydrated, tokens, router])

  if (!tokens?.access_token) {
    return null
  }

  const showVerify = user && user.email_verified === false

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
          <div className="flex items-center gap-2 px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator
              orientation="vertical"
              className="mr-2 data-[orientation=vertical]:h-4"
            />
          </div>
        </header>
        <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
          <Calendar />
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}