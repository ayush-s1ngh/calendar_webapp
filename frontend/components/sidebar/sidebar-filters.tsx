"use client"

import { useEffect, useMemo, useState } from "react"
import { Tags, Plus, Loader2, XCircle, Settings2 } from "lucide-react"
import { categoryStore } from "@/store/category"
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarInput,
} from "@/components/ui/sidebar"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { CategoryManagerDialog, CreateCategoryDialog } from "@/components/categories"

export function SidebarFilters() {
  const {
    categories,
    selectedCategoryIds,
    isLoading,
    searchTerm,
    loadCategories,
    toggleCategory,
    setSearchTerm,
    clearFilters,
  } = categoryStore()

  useEffect(() => {
    if (!categories.length) {
      void loadCategories()
    }
  }, [categories.length, loadCategories])

  const selectedCount = useMemo(() => selectedCategoryIds.size, [selectedCategoryIds])
  const hasSelection = selectedCount > 0

  // Dialog states
  const [createOpen, setCreateOpen] = useState(false)
  const [managerOpen, setManagerOpen] = useState(false)

  return (
    <>
      {/* Search Events */}
      <SidebarGroup className="group-data-[collapsible=icon]:hidden">
        <SidebarGroupLabel>Search</SidebarGroupLabel>
        <SidebarGroupContent>
          <div className="flex items-center gap-2">
            <SidebarInput
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search events"
            />
            {searchTerm && (
              <Button
                variant="outline"
                size="icon-sm"
                onClick={() => setSearchTerm("")}
                aria-label="Clear search"
                title="Clear"
              >
                ×
              </Button>
            )}
          </div>
        </SidebarGroupContent>
      </SidebarGroup>

      {/* Manage Categories dropdown with multi-select and Clear all */}
      <SidebarGroup className="group-data-[collapsible=icon]:hidden">
        <SidebarGroupLabel>Filters</SidebarGroupLabel>
        <SidebarGroupContent>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="w-full justify-between">
                <span className="flex items-center gap-2">
                  <Tags className="size-4" />
                  Manage Categories
                </span>
                <span className="text-xs text-muted-foreground">
                  {isLoading ? "Loading..." : hasSelection ? `${selectedCount} selected` : "All"}
                </span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-64">
              {/* Clear all filters action */}
              <DropdownMenuItem
                onSelect={(e) => {
                  e.preventDefault()
                  if (hasSelection) clearFilters()
                }}
                disabled={!hasSelection}
              >
                <XCircle className="size-4" />
                Clear all filters
              </DropdownMenuItem>

              <DropdownMenuSeparator />

              {isLoading && (
                <DropdownMenuItem disabled>
                  <Loader2 className="size-4 animate-spin" />
                  Loading categories...
                </DropdownMenuItem>
              )}

              {!isLoading && categories.length === 0 && (
                <DropdownMenuItem disabled>No categories</DropdownMenuItem>
              )}

              {!isLoading &&
                categories.map((cat) => (
                  <DropdownMenuCheckboxItem
                    key={cat.id}
                    checked={selectedCategoryIds.has(cat.id)}
                    onCheckedChange={() => toggleCategory(cat.id)}
                  >
                    <span
                      className="inline-block size-2.5 rounded-full mr-2"
                      style={{ background: cat.color || "var(--sidebar-ring)" }}
                    />
                    {cat.name}
                  </DropdownMenuCheckboxItem>
                ))}

              <DropdownMenuSeparator />
              <DropdownMenuItem
                onSelect={(e) => {
                  e.preventDefault()
                  setCreateOpen(true)
                }}
              >
                <Plus className="size-4" />
                Add Category
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={(e) => {
                  e.preventDefault()
                  setManagerOpen(true)
                }}
              >
                <Settings2 className="size-4" />
                Manage all categories
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </SidebarGroupContent>
      </SidebarGroup>

      {/* Dialog mounts */}
      <CreateCategoryDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={async () => {
          // Do NOT auto-select the new category
          // Refresh list to ensure dropdown shows normalized data
          await loadCategories()
        }}
      />

      <CategoryManagerDialog
        open={managerOpen}
        onOpenChange={setManagerOpen}
      />
    </>
  )
}