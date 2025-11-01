"use client"

import * as React from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { ColorPicker } from "./ColorPicker"
import { categorySchema, type CategoryFormValues, COLOR_OPTIONS } from "./category-utils"
import {JSX} from "react";

/**
 * Reusable category form used by Create and Edit dialogs.
 * - Manages its own RHF instance with zod validation
 * - Calls onSubmit with validated values
 * - Resets to incoming initialValues whenever they change
 */
export function CategoryForm({
  initialValues,
  onSubmit,
  submitting = false,
  submitLabel,
  onCancel,
  autoFocusName = false,
}: {
  initialValues?: Partial<CategoryFormValues>
  onSubmit: (values: CategoryFormValues) => Promise<void> | void
  submitting?: boolean
  submitLabel: string
  onCancel?: () => void
  autoFocusName?: boolean
}): JSX.Element {
  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
    reset,
  } = useForm<CategoryFormValues>({
    resolver: zodResolver(categorySchema),
    defaultValues: {
      name: initialValues?.name ?? "",
      color: initialValues?.color ?? COLOR_OPTIONS[0].value,
      description: initialValues?.description ?? "",
    },
  })

  // Reset when initial values change (e.g., editing a different category)
  React.useEffect(() => {
    reset({
      name: initialValues?.name ?? "",
      color: initialValues?.color ?? COLOR_OPTIONS[0].value,
      description: initialValues?.description ?? "",
    })
  }, [initialValues?.name, initialValues?.color, initialValues?.description, reset])

  const color = watch("color")

  return (
    <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
      <div className="space-y-2">
        <label htmlFor="category-name" className="text-sm font-medium">Name</label>
        <Input
          id="category-name"
          autoFocus={autoFocusName}
          {...register("name")}
          aria-invalid={!!errors.name}
          data-testid="category-name"
          placeholder="e.g. Work"
        />
        {errors.name && <p className="text-destructive text-xs">{errors.name.message}</p>}
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">Color</label>
        <ColorPicker
          value={color}
          onChange={(v) => setValue("color", v, { shouldValidate: true })}
          disabled={submitting}
        />
        {errors.color && <p className="text-destructive text-xs">{errors.color.message}</p>}
      </div>

      <div className="space-y-2">
        <label htmlFor="category-description" className="text-sm font-medium">
          Description (optional)
        </label>
        <Textarea
          id="category-description"
          rows={3}
          placeholder="Describe this category"
          {...register("description")}
          data-testid="category-description"
        />
      </div>

      <div className="flex items-center justify-end gap-2">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel} data-testid="category-cancel">
            Cancel
          </Button>
        )}
        <Button type="submit" disabled={submitting} data-testid="category-submit">
          {submitting ? "Saving..." : submitLabel}
        </Button>
      </div>
    </form>
  )
}