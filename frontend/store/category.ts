"use client"

/**
 * Category store.
 * - Manages category list, selection filters, and CRUD operations
 * - Persists nothing by default; relies on API for source of truth
 * - Prevents deletion of the last remaining category (client-side safeguard)
 *
 * Actions:
 *  - loadCategories(): fetches categories (envelope-tolerant)
 *  - toggleCategory(id): toggles id in the selectedCategoryIds Set
 *  - clearFilters(): clears category filters
 *  - setSearchTerm(term): updates search term used by calendar filtering
 *  - createCategory(payload), updateCategory(id, payload), deleteCategory(id): CRUD
 * Helpers:
 *  - getCategoryById(id)
 *  - canDeleteCategory(id): returns false if deleting would leave zero categories
 */
import { create } from "zustand"
import api from "@/lib/api"
import { DEFAULT_PER_PAGE } from "@/lib/constants"

export interface Category {
  id: number
  name: string
  color?: string
  description?: string
}

type CreateCategoryPayload = {
  name: string
  color: string
  description?: string
}
type UpdateCategoryPayload = Partial<CreateCategoryPayload>

type CategoryState = {
  categories: Category[]
  selectedCategoryIds: Set<number>
  isLoading: boolean
  searchTerm: string
  // actions
  loadCategories: () => Promise<void>
  toggleCategory: (id: number) => void
  clearFilters: () => void
  setSearchTerm: (term: string) => void
  // CRUD
  createCategory: (payload: CreateCategoryPayload) => Promise<Category>
  updateCategory: (id: number, payload: UpdateCategoryPayload) => Promise<Category>
  deleteCategory: (id: number) => Promise<void>
  // helpers
  getCategoryById: (id: number) => Category | undefined
  canDeleteCategory: (id: number) => boolean
}

type Root = { data?: unknown }
type CategoriesEnvelope = { categories?: Category[] }

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null
}

function extractCategoryFromUnknown(root: unknown): Category | null {
  const pick = (obj: unknown): Category | null => {
    if (!isRecord(obj)) return null
    // Direct category
    if ("id" in obj && "name" in obj) {
      const idVal = obj.id
      const nameVal = obj.name
      if ((typeof idVal === "number" || typeof idVal === "string") && typeof nameVal === "string") {
        return {
          id: Number(idVal),
          name: nameVal,
          color: typeof obj.color === "string" ? obj.color : undefined,
          description: typeof obj.description === "string" ? obj.description : undefined,
        }
      }
    }
    // Nested category key
    if ("category" in obj) return pick(obj.category)
    // Nested data key
    if ("data" in obj) return pick(obj.data)
    return null
  }
  return pick(root)
}

export const categoryStore = create<CategoryState>((set, get) => ({
  categories: [],
  selectedCategoryIds: new Set<number>(),
  isLoading: false,
  searchTerm: "",

  loadCategories: async () => {
    set({ isLoading: true })
    try {
      const res = await api.get("/categories", { params: { per_page: DEFAULT_PER_PAGE } })
      const root = (res?.data ?? {}) as Root
      const data = (root.data ?? root) as unknown

      const categories =
        (isRecord(data) && "categories" in data
          ? ((data as CategoriesEnvelope).categories ?? [])
          : Array.isArray(data)
          ? (data as Category[])
          : []) ?? []

      const list = Array.isArray(categories) ? categories : []
      set({ categories: list, isLoading: false })

      // Only create default category if NO categories exist at all
      if (list.length === 0) {
        try {
          const created = await get().createCategory({
            name: "Default",
            color: "#ffffff",
            description: "Default category",
          })
          set({ categories: [created] })
        } catch {
          // ignore auto-create failure
        }
      }
    } catch {
      set({ isLoading: false })
    }
  },

  toggleCategory: (id: number) => {
    const current = get().selectedCategoryIds
    const next = new Set(current)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    set({ selectedCategoryIds: next })
  },

  clearFilters: () => set({ selectedCategoryIds: new Set<number>() }),

  setSearchTerm: (term: string) => set({ searchTerm: term }),

  // CRUD
  createCategory: async (payload) => {
    const res = await api.post("/categories", payload)
    const cat = extractCategoryFromUnknown(res?.data)
    if (!cat) {
      throw new Error("Unexpected response while creating category")
    }
    set((state) => ({ categories: [cat, ...state.categories] }))
    return cat
  },

  updateCategory: async (id, payload) => {
    const res = await api.put(`/categories/${encodeURIComponent(String(id))}`, payload)
    const cat = extractCategoryFromUnknown(res?.data)
    if (!cat) {
      throw new Error("Unexpected response while updating category")
    }
    set((state) => ({
      categories: state.categories.map((c) => (c.id === id ? { ...c, ...cat } : c)),
    }))
    return cat
  },

  deleteCategory: async (id) => {
    const state = get()

    // SAFEGUARD: Prevent deletion if it would leave zero categories
    if (!state.canDeleteCategory(id)) {
      throw new Error("Cannot delete the last remaining category. At least one category must exist.")
    }

    await api.delete(`/categories/${encodeURIComponent(String(id))}`)
    set((state) => ({
      categories: state.categories.filter((c) => c.id !== id),
      selectedCategoryIds: new Set(Array.from(state.selectedCategoryIds).filter((x) => x !== id)),
    }))
  },

  getCategoryById: (id: number) => {
    return get().categories.find((c) => c.id === id)
  },

  canDeleteCategory: (id: number) => {
    const remaining = get().categories.filter((c) => c.id !== id).length
    return remaining >= 1
  },
}))