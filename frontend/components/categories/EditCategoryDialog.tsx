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

export function EditCategoryDialog({
  open,
  onOpenChange,
  category,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  category: Category | null
}) {
  const updateCategory = categoryStore((s) => s.updateCategory)
  const { register, handleSubmit, formState: { errors, isSubmitting }, setValue, watch, reset } =
    useForm<CategoryFormValues>({
      resolver: zodResolver(categorySchema),
      values: {
        name: category?.name ?? "",
        color: category?.color ?? COLOR_OPTIONS[0].value,
        description: category?.description ?? "",
      },
    })

  React.useEffect(() => {
    reset({
      name: category?.name ?? "",
      color: category?.color ?? COLOR_OPTIONS[0].value,
      description: category?.description ?? "",
    })
  }, [category, reset])

  const color = watch("color")

  const onSubmit = async (values: CategoryFormValues) => {
    if (!category) return
    try {
      await updateCategory(category.id, values)
      toast.success("Category updated")
      onOpenChange(false)
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Failed to update category"))
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!isSubmitting) onOpenChange(v) }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Category</DialogTitle>
        </DialogHeader>
        <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
          <div className="space-y-2">
            <label className="text-sm font-medium">Name</label>
            <Input {...register("name")} aria-invalid={!!errors.name} />
            {errors.name && <p className="text-destructive text-xs">{errors.name.message}</p>}
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Color</label>
            <ColorPicker value={color} onChange={(v) => setValue("color", v, { shouldValidate: true })} />
            <div className="text-xs text-muted-foreground">
              Hex will be stored in backend (e.g. #7C3AED)
            </div>
            {errors.color && <p className="text-destructive text-xs">{errors.color.message}</p>}
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Description (optional)</label>
            <Textarea rows={3} {...register("description")} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={isSubmitting}>{isSubmitting ? "Saving..." : "Save changes"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}