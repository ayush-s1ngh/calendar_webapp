"use client"

import * as React from "react"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Calendar as CalendarIcon } from "lucide-react"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { SimpleTimePicker } from "@/components/ui/time-picker"
import { format } from "date-fns"
import { cn } from "@/lib/utils"

export function CustomAllDayReminderDialog({
  open,
  onOpenChange,
  initialDateTime,
  onSave,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  initialDateTime?: Date
  onSave: (dt: Date) => void
}) {
  const base = initialDateTime ?? new Date()
  const [date, setDate] = React.useState<Date>(base)
  const [time, setTime] = React.useState<Date>(base)

  React.useEffect(() => {
    if (open) {
      const d = initialDateTime ?? new Date()
      setDate(d)
      setTime(d)
    }
  }, [open, initialDateTime])

  const merged = React.useMemo(() => {
    const out = new Date(date)
    out.setHours(time.getHours(), time.getMinutes(), 0, 0)
    return out
  }, [date, time])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Custom reminder</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Date</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-full justify-start")}>
                  <CalendarIcon className="mr-2 size-4" />
                  {format(date, "PPP")}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={(d) => d && setDate(d)}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Time</label>
            <SimpleTimePicker
              value={time}
              onChange={setTime}
              use12HourFormat
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            onClick={() => {
              onSave(merged)
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