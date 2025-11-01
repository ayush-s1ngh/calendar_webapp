"use client"

import * as React from "react"
import {JSX} from "react";
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { categoryStore, type Category } from "@/store/category"
import { toast } from "sonner"
import { Pencil, Trash2, CalendarDays } from "lucide-react"
import { format } from "date-fns"
import { fetchEvents } from "@/components/calendar/useCalendarEvents"
import { getErrorMessage } from "@/lib/errors"
import type { UpcomingEvent } from "./category-utils"

/**
 * View Category dialog with lightweight “upcoming events” preview.
 * - Reuses fetchEvents (calendar) for consistent mapping
 */
export function ViewCategoryDialog({
  open,
  onOpenChange,
  category,
  onEditClick,
  onDeleted,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  category: Category | null
  onEditClick?: () => void
  onDeleted?: () => void
}): JSX.Element {
  const deleteCategory = categoryStore((s) => s.deleteCategory)
  const canDeleteCategory = categoryStore((s) => s.canDeleteCategory)
  const [loading, setLoading] = React.useState(false)
  const [events, setEvents] = React.useState<UpcomingEvent[]>([])

  React.useEffect(() => {
    let cancelled = false
    async function loadUpcoming(catId: number) {
      setLoading(true)
      try {
        const now = new Date()
        const future = new Date(now.getTime() + 1000 * 60 * 60 * 24 * 365) // +1 year
        const fcEvents = await fetchEvents(
          { start: now, end: future },
          { includeRecurring: true, categoryIds: [catId] }
        )
        const mapped: UpcomingEvent[] = fcEvents.map((e) => ({
          id: String(e.id),
          title: e.title || "",
          start: e.start as Date,
          end: (e.end as Date) || undefined,
          allDay: Boolean(e.allDay),
        }))
        mapped.sort((a, b) => a.start.getTime() - b.start.getTime())
        if (!cancelled) setEvents(mapped.slice(0, 3))
      } catch (err) {
        if (!cancelled) setEvents([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    if (open && category?.id != null) {
      void loadUpcoming(category.id)
    } else {
      setEvents([])
    }
    return () => {
      cancelled = true
    }
  }, [open, category?.id])

  const handleDelete = async () => {
    if (!category) return
    try {
      await deleteCategory(category.id)
      toast.success("Category deleted")
      onOpenChange(false)
      onDeleted?.()
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to delete category"))
    }
  }

  const canDelete = category ? canDeleteCategory(category.id) : false

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Category Details</DialogTitle>
        </DialogHeader>
        {category && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <span
                className="inline-block size-4 rounded-full border"
                style={{ background: category.color || "var(--sidebar-ring)" }}
              />
              <div className="text-base font-semibold">{category.name}</div>
            </div>
            {category.description && (
              <div className="text-sm text-muted-foreground whitespace-pre-wrap">{category.description}</div>
            )}

            <div className="mt-2 space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium">
                <CalendarDays className="size-4" />
                Upcoming events
              </div>
              {loading && <div className="text-xs text-muted-foreground">Loading...</div>}
              {!loading && events.length === 0 && (
                <div className="text-xs text-muted-foreground">No upcoming events.</div>
              )}
              <div className="space-y-2">
                {events.map((ev) => (
                  <div key={ev.id} className="rounded-md border bg-card/60 px-3 py-2 text-xs">
                    <div className="font-medium truncate">{ev.title}</div>
                    <div className="text-muted-foreground">
                      {ev.allDay
                        ? format(ev.start, "EEE, MMM d")
                        : `${format(ev.start, "EEE, MMM d, HH:mm")} – ${format(
                            ev.end ?? ev.start,
                            "HH:mm"
                          )}`}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
        <DialogFooter className="justify-between">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onEditClick} aria-label="Edit category">
              <Pencil className="size-4" />
              Edit
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" disabled={!canDelete} aria-label="Delete category">
                  <Trash2 className="size-4" />
                  Delete
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete category?</AlertDialogTitle>
                  <AlertDialogDescription>
                    {canDelete
                      ? "This action cannot be undone. If this category is assigned to events, the server will block deletion."
                      : "Cannot delete the last remaining category. At least one category must exist to create events."
                    }
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDelete} disabled={!canDelete}>
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}