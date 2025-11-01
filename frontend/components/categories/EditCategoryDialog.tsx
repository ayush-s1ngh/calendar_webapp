"use client"

import * as React from "react"
import { toast } from "sonner"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { categoryStore, type Category } from "@/store/category"
import { CategoryForm } from "./CategoryForm"
import { getErrorMessage } from "@/lib/errors"
import {JSX} from "react";

/**
 * Edit Category dialog.
 * - Reuses CategoryForm with initialValues
 */
export function EditCategoryDialog({
  open,
  onOpenChange,
  category,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  category: Category | null
}): JSX.Element {
  const updateCategory = categoryStore((s) => s.updateCategory)
  const [submitting, setSubmitting] = React.useState(false)

  const initialValues = React.useMemo(
    () =>
      category
        ? { name: category.name, color: category.color ?? "", description: category.description ?? "" }
        : { name: "", color: "", description: "" },
    [category]
  )

  const submit = async (values: { name: string; color: string; description?: string }) => {
    if (!category) return
    setSubmitting(true)
    try {
      await updateCategory(category.id, values)
      toast.success("Category updated")
      onOpenChange(false)
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to update category"))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !submitting && onOpenChange(v)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Category</DialogTitle>
        </DialogHeader>
        <CategoryForm
          initialValues={initialValues}
          onSubmit={submit}
          submitting={submitting}
          submitLabel="Save changes"
          onCancel={() => onOpenChange(false)}
          autoFocusName
        />
      </DialogContent>
    </Dialog>
  )
}