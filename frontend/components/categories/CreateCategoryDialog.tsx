"use client"

import * as React from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { categoryStore, type Category } from "@/store/category"
import { toast } from "sonner"
import { ColorPicker } from "./ColorPicker"
import {
  categorySchema,
  CategoryFormValues,
  COLOR_OPTIONS,
  getErrorMessage,
} from "./category-utils"

export function CreateCategoryDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  onCreated?: (cat: Category) => void
}) {
  const createCategory = categoryStore((s) => s.createCategory)
  const { register, handleSubmit, formState: { errors, isSubmitting }, setValue, watch, reset } =
    useForm<CategoryFormValues>({
      resolver: zodResolver(categorySchema),
      defaultValues: {
        name: "",
        color: COLOR_OPTIONS[0].value,
        description: "",
      },
    })

  const color = watch("color")

  const onSubmit = async (values: CategoryFormValues) => {
    try {
      const cat = await createCategory(values)
      toast.success("Category created")
      onCreated?.(cat)
      onOpenChange(false)
      reset()
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Failed to create category"))
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!isSubmitting) onOpenChange(v) }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Category</DialogTitle>
        </DialogHeader>
        <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
          <div className="space-y-2">
            <label className="text-sm font-medium">Name</label>
            <Input {...register("name")} aria-invalid={!!errors.name} placeholder="e.g. Work" />
            {errors.name && <p className="text-destructive text-xs">{errors.name.message}</p>}
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Color</label>
            <ColorPicker value={color} onChange={(v) => setValue("color", v, { shouldValidate: true })} />
            {errors.color && <p className="text-destructive text-xs">{errors.color.message}</p>}
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Description (optional)</label>
            <Textarea rows={3} placeholder="Describe this category" {...register("description")} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={isSubmitting}>{isSubmitting ? "Creating..." : "Create"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}