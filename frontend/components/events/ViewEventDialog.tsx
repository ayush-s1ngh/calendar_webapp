"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { toast } from "sonner"
import { Calendar as CalendarIcon, Clock, Pencil, Trash2, Tag } from "lucide-react"
import api from "@/lib/api"
import { format, isSameDay } from "date-fns"
import { utcIsoToLocalDate } from "@/lib/time"
import { EventData, getErrorMessage } from "./event-utils"

export function ViewEventDialog({
  open,
  onOpenChange,
  event,
  onEditClick,
  onDeleted,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  event: EventData | null
  onEditClick?: () => void
  onDeleted?: () => void
}) {
  const [deleteOpen, setDeleteOpen] = React.useState(false)
  const [deleting, setDeleting] = React.useState(false)

  const handleDelete = async () => {
    if (!event) return
    setDeleting(true)
    try {
      await api.delete(`/events/${encodeURIComponent(String(event.id))}`)
      toast.success("Event deleted")
      // Notify sidebar to refresh (reminders removed)
      try {
        window.dispatchEvent(new CustomEvent("reminders:refresh"))
      } catch {}
      onOpenChange(false)
      setDeleteOpen(false)
      onDeleted?.()
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Failed to delete event"))
    } finally {
      setDeleting(false)
    }
  }

  if (!event) return null

  const startDate = utcIsoToLocalDate(event.start_datetime)
  const endDate = event.end_datetime ? utcIsoToLocalDate(event.end_datetime) : null
  const isAllDay = Boolean(event.is_all_day)
  const primaryCategory = event.categories?.[0]

  // Check if start and end are on the same day
  const isSameDayEvent = endDate ? isSameDay(startDate, endDate) : true

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-xl">{event.title}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {primaryCategory && (
              <div className="flex items-center gap-2">
                <Tag className="size-4 text-muted-foreground" />
                <div className="flex items-center gap-2">
                  <span
                    className="inline-block size-3 rounded-full border"
                    style={{ background: primaryCategory.color || "var(--sidebar-ring)" }}
                  />
                  <span className="text-sm font-medium">{primaryCategory.name}</span>
                </div>
              </div>
            )}

            <div className="flex items-start gap-2">
              <CalendarIcon className="size-4 text-muted-foreground mt-0.5" />
              <div className="text-sm">
                {isAllDay ? (
                  <div>
                    <div className="font-medium">All day</div>
                    <div className="text-muted-foreground">
                      {isSameDayEvent ? (
                        // Single day all-day event
                        format(startDate, "EEEE, MMMM d, yyyy")
                      ) : (
                        // Multi-day all-day event
                        <>
                          {format(startDate, "EEEE, MMMM d, yyyy")} – {format(endDate!, "EEEE, MMMM d, yyyy")}
                        </>
                      )}
                    </div>
                  </div>
                ) : (
                  <div>
                    {isSameDayEvent ? (
                      // Single-day timed event (Oct 22 9am - 5pm)
                      <>
                        <div className="font-medium">{format(startDate, "EEEE, MMMM d, yyyy")}</div>
                        <div className="text-muted-foreground flex items-center gap-1">
                          <Clock className="size-3" />
                          {format(startDate, "h:mm a")} – {endDate ? format(endDate, "h:mm a") : ""}
                        </div>
                      </>
                    ) : (
                      // Multi-day timed event (Oct 22 9am - Oct 23 5pm)
                      <>
                        <div className="font-medium">
                          {format(startDate, "EEEE, MMMM d, yyyy")} – {format(endDate!, "EEEE, MMMM d, yyyy")}
                        </div>
                        <div className="text-muted-foreground flex items-center gap-1">
                          <Clock className="size-3" />
                          {format(startDate, "h:mm a")} – {endDate ? format(endDate, "h:mm a") : ""}
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>

            {event.description && (
              <div className="space-y-1">
                <div className="text-sm font-medium">Description</div>
                <div className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {event.description}
                </div>
              </div>
            )}

            {event.is_recurring && (
              <div className="rounded-md border bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
                This is part of a recurring series.
              </div>
            )}
          </div>
          <DialogFooter className="justify-between">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={onEditClick}>
                <Pencil className="size-4" />
                Edit
              </Button>
              <Button variant="destructive" onClick={() => setDeleteOpen(true)}>
                <Trash2 className="size-4" />
                Delete
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete event?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the event.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleting}>
              {deleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}