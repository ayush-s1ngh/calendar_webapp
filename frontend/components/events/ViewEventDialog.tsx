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
import {
  Calendar as CalendarIcon,
  Clock,
  Pencil,
  Trash2,
  Tag,
  Mail,
  Smartphone,
  MessageCircle,
} from "lucide-react"
import api from "@/lib/api"
import { format, isSameDay } from "date-fns"
import { utcIsoToLocalDate } from "@/lib/time"
import { EventData, getErrorMessage } from "./event-utils"
import { ApiReminder, getReminderLocalTriggerDate } from "@/components/reminders"

function TypeIcon({ type, className }: { type: "email" | "push" | "sms"; className?: string }) {
  if (type === "email") return <Mail className={className ?? "size-4"} />
  if (type === "push") return <Smartphone className={className ?? "size-4"} />
  return <MessageCircle className={className ?? "size-4"} />
}

export function ViewEventDialog({
  open,
  onOpenChangeAction,
  event,
  onEditClickAction,
  onDeletedAction,
}: {
  open: boolean
  onOpenChangeAction: (v: boolean) => void
  event: EventData | null
  onEditClickAction?: () => void
  onDeletedAction?: () => void
}) {
  // Keep hooks in a stable order across renders
  const [deleteOpen, setDeleteOpen] = React.useState(false)
  const [deleting, setDeleting] = React.useState(false)

  // Reminders state
  const [reminders, setReminders] = React.useState<ApiReminder[] | null>(null)
  const [remindersError, setRemindersError] = React.useState<string | null>(null)
  const [remindersLoading, setRemindersLoading] = React.useState(false)

  // Load reminders when dialog opens (guard logic inside; hook always runs)
  React.useEffect(() => {
    let cancelled = false
    async function loadReminders(eventId: string | number) {
      setRemindersLoading(true)
      setRemindersError(null)
      try {
        const res = await api.get(`/reminders/event/${encodeURIComponent(String(eventId))}/reminders`)
        const extract = (root: unknown): ApiReminder[] => {
          const r = root as Record<string, unknown> | unknown[]
          if (Array.isArray(r)) return r as ApiReminder[]
          if (r && typeof r === "object") {
            const obj = r as Record<string, unknown>
            if (Array.isArray((obj as { reminders?: unknown }).reminders)) {
              return (obj as { reminders: ApiReminder[] }).reminders
            }
            if (Array.isArray((obj as { data?: unknown }).data)) {
              return (obj as { data: ApiReminder[] }).data
            }
            if (obj.data && typeof obj.data === "object") {
              const d = obj.data as Record<string, unknown>
              const maybeRems = (d as { reminders?: unknown }).reminders
              if (Array.isArray(maybeRems)) return maybeRems as ApiReminder[]
            }
          }
          return []
        }
        const list = extract(res?.data) ?? []
        if (!cancelled) setReminders(list)
      } catch (err: unknown) {
        if (!cancelled) {
          setRemindersError(getErrorMessage(err, "Failed to load reminders"))
          setReminders([])
        }
      } finally {
        if (!cancelled) setRemindersLoading(false)
      }
    }

    if (open && event?.id != null) {
      void loadReminders(event.id)
    } else if (!open) {
      // reset state when closing
      setReminders(null)
      setRemindersError(null)
      setRemindersLoading(false)
    }
    return () => {
      cancelled = true
    }
  }, [open, event?.id])

  // Derived values as hooks (safe when event is null)
  const startDate = React.useMemo(
    () => (event ? utcIsoToLocalDate(event.start_datetime) : null),
    [event]
  )
  const endDate = React.useMemo(
    () => (event?.end_datetime ? utcIsoToLocalDate(event.end_datetime) : null),
    [event]
  )
  const isAllDay = event?.is_all_day ?? false

  const isSameDayEvent = React.useMemo(() => {
    if (!startDate) return true
    if (!endDate) return true
    return isSameDay(startDate, endDate)
  }, [startDate, endDate])

  const formattedReminders = React.useMemo(() => {
    if (!event || !reminders) return []
    const withTrigger = reminders.map((r) => ({
      r,
      trigger: getReminderLocalTriggerDate(r, event.start_datetime),
    }))
    withTrigger.sort((a, b) => a.trigger.getTime() - b.trigger.getTime())
    return withTrigger
  }, [reminders, event])

  const fmtExact = (d: Date) => format(d, "EEE, MMM d, h:mm a")

  const handleDelete = async () => {
    if (!event) return
    setDeleting(true)
    try {
      await api.delete(`/events/${encodeURIComponent(String(event.id))}`)
      toast.success("Event deleted")
      try {
        window.dispatchEvent(new CustomEvent("reminders:refresh"))
      } catch {}
      onOpenChangeAction(false)
      setDeleteOpen(false)
      onDeletedAction?.()
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Failed to delete event"))
    } finally {
      setDeleting(false)
    }
  }

  // After hooks, it is safe to early return
  if (!event) return null

  const primaryCategory = event.categories?.[0]

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChangeAction}>
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
                        startDate ? format(startDate, "EEEE, MMMM d, yyyy") : ""
                      ) : (
                        <>
                          {startDate ? format(startDate, "EEEE, MMMM d, yyyy") : ""} –{" "}
                          {endDate ? format(endDate, "EEEE, MMMM d, yyyy") : ""}
                        </>
                      )}
                    </div>
                  </div>
                ) : (
                  <div>
                    {isSameDayEvent ? (
                      <>
                        <div className="font-medium">
                          {startDate ? format(startDate, "EEEE, MMMM d, yyyy") : ""}
                        </div>
                        <div className="text-muted-foreground flex items-center gap-1">
                          <Clock className="size-3" />
                          {startDate ? format(startDate, "h:mm a") : ""} –{" "}
                          {endDate ? format(endDate, "h:mm a") : ""}
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="font-medium">
                          {startDate ? format(startDate, "EEEE, MMMM d, yyyy") : ""} –{" "}
                          {endDate ? format(endDate, "EEEE, MMMM d, yyyy") : ""}
                        </div>
                        <div className="text-muted-foreground flex items-center gap-1">
                          <Clock className="size-3" />
                          {startDate ? format(startDate, "h:mm a") : ""} –{" "}
                          {endDate ? format(endDate, "h:mm a") : ""}
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

            {/* Reminders section */}
            <div className="space-y-2">
              <div className="text-sm font-medium">
                Reminders
                {remindersLoading ? " (loading...)" : reminders && reminders.length ? ` (${reminders.length})` : ""}
              </div>

              {remindersError && (
                <div className="text-xs text-destructive">{remindersError}</div>
              )}

              {!remindersLoading && reminders && reminders.length === 0 && !remindersError && (
                <div className="text-xs text-muted-foreground">No reminders set.</div>
              )}

              {remindersLoading && (
                <div className="space-y-1">
                  <div className="h-3 w-2/3 bg-accent animate-pulse rounded" />
                  <div className="h-3 w-1/2 bg-accent animate-pulse rounded" />
                </div>
              )}

              {!remindersLoading && formattedReminders.length > 0 && (
                <div className="space-y-1">
                  {formattedReminders.map(({ r, trigger }) => (
                    <div key={r.id} className="text-xs flex items-center justify-between gap-2">
                      <span className="text-muted-foreground">• {fmtExact(trigger)}</span>
                      <TypeIcon type={r.notification_type} className="size-4 text-muted-foreground" />
                    </div>
                  ))}
                </div>
              )}
            </div>

            {event.is_recurring && (
              <div className="rounded-md border bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
                This is part of a recurring series.
              </div>
            )}
          </div>
          <DialogFooter className="justify-between">
            <Button variant="outline" onClick={() => onOpenChangeAction(false)}>
              Close
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={onEditClickAction}>
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