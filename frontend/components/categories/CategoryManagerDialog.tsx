"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { categoryStore } from "@/store/category"
import { toast } from "sonner"
import { Pencil, Trash2, Plus } from "lucide-react"
import { CreateCategoryDialog } from "./CreateCategoryDialog"
import { ViewCategoryDialog } from "./ViewCategoryDialog"
import { EditCategoryDialog } from "./EditCategoryDialog"
import { getErrorMessage } from "@/lib/errors"
import {JSX} from "react";

/**
 * Manage Categories modal: lists, creates, edits, deletes categories.
 */
export function CategoryManagerDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
}): JSX.Element {
  const categories = categoryStore((s) => s.categories)
  const loadCategories = categoryStore((s) => s.loadCategories)
  const getCategoryById = categoryStore((s) => s.getCategoryById)
  const deleteCategory = categoryStore((s) => s.deleteCategory)
  const canDeleteCategory = categoryStore((s) => s.canDeleteCategory)
  const [createOpen, setCreateOpen] = React.useState(false)
  const [viewOpen, setViewOpen] = React.useState(false)
  const [editOpen, setEditOpen] = React.useState(false)
  const [activeId, setActiveId] = React.useState<number | null>(null)

  const active = activeId != null ? getCategoryById(activeId) ?? null : null

  React.useEffect(() => {
    if (open) void loadCategories()
  }, [open, loadCategories])

  const handleDelete = async (id: number) => {
    try {
      await deleteCategory(id)
      toast.success("Category deleted")
      if (activeId === id) setActiveId(null)
      await loadCategories()
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to delete category"))
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Manage Categories</DialogTitle>
          </DialogHeader>
          <div className="flex justify-end">
            <Button size="sm" onClick={() => setCreateOpen(true)} data-testid="category-new">
              <Plus className="size-4" />
              New Category
            </Button>
          </div>
          <div className="mt-2 space-y-2 max-h-[60vh] overflow-y-auto pr-1">
            {categories.length === 0 && (
              <div className="text-sm text-muted-foreground">No categories found.</div>
            )}
            {categories.map((cat) => {
              const canDelete = canDeleteCategory(cat.id)
              return (
                <div
                  key={cat.id}
                  className="flex items-center gap-3 rounded-md border bg-card/60 px-3 py-2"
                >
                  <span
                    className="inline-block size-3 rounded-full border"
                    style={{ background: cat.color || "var(--sidebar-ring)" }}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setActiveId(cat.id)
                      setViewOpen(true)
                    }}
                    className="min-w-0 flex-1 text-left"
                    title="View details"
                    aria-label={`View ${cat.name}`}
                  >
                    <div className="truncate text-sm font-medium hover:underline">{cat.name}</div>
                    {cat.description && (
                      <div className="truncate text-xs text-muted-foreground">{cat.description}</div>
                    )}
                  </button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setActiveId(cat.id)
                      setEditOpen(true)
                    }}
                    aria-label={`Edit ${cat.name}`}
                    title="Edit"
                  >
                    <Pencil className="size-4" />
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="destructive"
                        size="sm"
                        aria-label={`Delete ${cat.name}`}
                        title="Delete"
                        disabled={!canDelete}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete category?</AlertDialogTitle>
                        <AlertDialogDescription>
                          {canDelete
                            ? "This action cannot be undone. If this category is assigned to events, the server will block deletion."
                            : "Cannot delete the last remaining category. At least one category must exist to create events."
                          }
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => handleDelete(cat.id)} disabled={!canDelete}>
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              )
            })}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <CreateCategoryDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={async () => {
          await loadCategories()
        }}
      />

      <ViewCategoryDialog
        open={viewOpen}
        onOpenChange={setViewOpen}
        category={active}
        onEditClick={() => {
          setViewOpen(false)
          setEditOpen(true)
        }}
        onDeleted={() => {
          setActiveId(null)
          void loadCategories()
        }}
      />

      <EditCategoryDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        category={active}
      />
    </>
  )
}