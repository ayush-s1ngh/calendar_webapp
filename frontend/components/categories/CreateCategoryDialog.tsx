"use client"

import * as React from "react"
import { JSX } from "react"
import { toast } from "sonner"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { categoryStore, type Category } from "@/store/category"
import { CategoryForm } from "./CategoryForm"
import { getErrorMessage } from "@/lib/errors"

/**
 * Create Category dialog.
 * - Uses reusable CategoryForm
 * - Emits onCreated on success
 */
export function CreateCategoryDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  onCreated?: (cat: Category) => void
}): JSX.Element {
  const createCategory = categoryStore((s) => s.createCategory)
  const [submitting, setSubmitting] = React.useState(false)

  const submit = async (values: Parameters<typeof createCategory>[0]) => {
    setSubmitting(true)
    try {
      const cat = await createCategory(values)
      toast.success("Category created")
      onCreated?.(cat)
      onOpenChange(false)
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to create category"))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !submitting && onOpenChange(v)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Category</DialogTitle>
        </DialogHeader>
        <CategoryForm
          onSubmit={submit}
          submitting={submitting}
          submitLabel="Create"
          onCancel={() => onOpenChange(false)}
          autoFocusName
        />
      </DialogContent>
    </Dialog>
  )
}