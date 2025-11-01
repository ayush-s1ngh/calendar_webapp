"use client"

import { JSX } from "react"
import { Controller, type Control, type FieldErrors, type UseFormRegister } from "react-hook-form"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar as CalendarIcon } from "lucide-react"
import { format } from "date-fns"
import { cn } from "@/lib/utils"
import { SimpleTimePicker } from "@/components/ui/time-picker"
import type { EventFormValues } from "./event-utils"
import type { Category } from "@/store/category"

/**
 * Shared basic fields for Create/Edit Event dialogs:
 * - Title, Description
 * - Category single-select
 * - All-day toggle
 * - Date/Time pickers (timed vs all-day)
 */
export function EventBasicsFields({
  control,
  register,
  errors,
  categories,
  isAllDay,
  disabled = false,
}: {
  control: Control<EventFormValues>
  register: UseFormRegister<EventFormValues>
  errors: FieldErrors<EventFormValues>
  categories: Category[]
  isAllDay: boolean
  disabled?: boolean
}): JSX.Element {
  return (
    <>
      <div className="space-y-2">
        <Label htmlFor="title">Title *</Label>
        <Input
          id="title"
          placeholder="Event title"
          aria-invalid={!!errors.title}
          disabled={disabled}
          {...register("title")}
        />
        {errors.title && <p className="text-destructive text-xs">{errors.title.message}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          rows={3}
          placeholder="Add details about your event"
          disabled={disabled}
          {...register("description")}
        />
      </div>

      <div className="space-y-2">
        <Label>Category *</Label>
        <Controller
          name="category_ids"
          control={control}
          render={({ field }) => (
            <Select
              value={field.value[0]?.toString() || ""}
              onValueChange={(val) => field.onChange([parseInt(val, 10)])}
              disabled={disabled}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select a category" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id.toString()}>
                    <div className="flex items-center gap-2">
                      <span
                        className="inline-block size-2.5 rounded-full"
                        style={{ background: cat.color || "var(--sidebar-ring)" }}
                      />
                      {cat.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
        {errors.category_ids && (
          <p className="text-destructive text-xs">{errors.category_ids.message}</p>
        )}
      </div>

      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="is_all_day"
          className="size-4 rounded border-input"
          disabled={disabled}
          {...register("is_all_day")}
        />
        <Label htmlFor="is_all_day" className="cursor-pointer">
          All day
        </Label>
      </div>

      {!isAllDay && (
        <>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Start Date *</Label>
              <Controller
                name="start_date"
                control={control}
                render={({ field }) => (
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        disabled={disabled}
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !field.value && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 size-4" />
                        {field.value ? format(field.value, "PPP") : "Pick a date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={field.value}
                        onSelect={(date) => date && field.onChange(date)}
                        autoFocus={true}
                      />
                    </PopoverContent>
                  </Popover>
                )}
              />
            </div>
            <div className="space-y-2">
              <Label>Start Time *</Label>
              <Controller
                name="start_time"
                control={control}
                render={({ field }) => (
                  <SimpleTimePicker
                    value={field.value || new Date()}
                    onChange={field.onChange}
                    use12HourFormat
                    disabled={disabled}
                  />
                )}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>End Date *</Label>
              <Controller
                name="end_date"
                control={control}
                render={({ field }) => (
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        disabled={disabled}
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !field.value && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 size-4" />
                        {field.value ? format(field.value, "PPP") : "Pick a date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={field.value}
                        onSelect={(date) => date && field.onChange(date)}
                        autoFocus={true}
                      />
                    </PopoverContent>
                  </Popover>
                )}
              />
            </div>
            <div className="space-y-2">
              <Label>End Time *</Label>
              <Controller
                name="end_time"
                control={control}
                render={({ field }) => (
                  <SimpleTimePicker
                    value={field.value || new Date()}
                    onChange={field.onChange}
                    use12HourFormat
                    disabled={disabled}
                  />
                )}
              />
            </div>
          </div>
        </>
      )}

      {isAllDay && (
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Start Date *</Label>
            <Controller
              name="start_date"
              control={control}
              render={({ field }) => (
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      disabled={disabled}
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !field.value && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 size-4" />
                      {field.value ? format(field.value, "PPP") : "Pick a date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={field.value}
                      onSelect={(date) => date && field.onChange(date)}
                      autoFocus={true}
                    />
                  </PopoverContent>
                </Popover>
              )}
            />
          </div>
          <div className="space-y-2">
            <Label>End Date *</Label>
            <Controller
              name="end_date"
              control={control}
              render={({ field }) => (
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      disabled={disabled}
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !field.value && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 size-4" />
                      {field.value ? format(field.value, "PPP") : "Pick a date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={field.value}
                      onSelect={(date) => date && field.onChange(date)}
                      autoFocus={true}
                    />
                  </PopoverContent>
                </Popover>
              )}
            />
          </div>
        </div>
      )}

      {errors.end_date && <p className="text-destructive text-xs">{errors.end_date.message}</p>}
    </>
  )
}