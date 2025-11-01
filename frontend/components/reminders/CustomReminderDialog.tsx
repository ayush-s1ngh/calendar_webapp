"use client"

/**
 * Dialog for entering custom minutes-before for timed events.
 * - Clamps to non-negative, integer minutes (step 5)
 */
import * as React from "react"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

export function CustomReminderDialog({
  open,
  onOpenChange,
  initialMinutes = 15,
  onSave,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  initialMinutes?: number
  onSave: (minutes: number) => void
}) {
  const [minutes, setMinutes] = React.useState<number>(Math.max(0, Math.floor(initialMinutes)))

  React.useEffect(() => {
    if (open) {
      setMinutes(Math.max(0, Math.floor(initialMinutes)))
    }
  }, [open, initialMinutes])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Custom reminder</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          <label className="text-sm font-medium">Remind me</label>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              min={0}
              step={5}
              value={Number.isFinite(minutes) ? minutes : 0}
              onChange={(e) => setMinutes(Math.max(0, Math.floor(Number(e.target.value || 0))))}
              className="w-24"
              aria-label="Minutes before"
            />
            <span className="text-sm">minutes before</span>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            onClick={() => {
              onSave(Math.max(0, Math.floor(minutes)))
              onOpenChange(false)
            }}
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}