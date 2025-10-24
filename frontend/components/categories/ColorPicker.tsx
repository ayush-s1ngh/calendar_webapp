"use client"

import { cn } from "@/lib/utils"
import { COLOR_OPTIONS } from "./category-utils"

export function ColorPicker({
  value,
  onChange,
}: {
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div className="grid grid-cols-5 gap-2">
      {COLOR_OPTIONS.map((opt) => {
        const selected = value === opt.value
        return (
          <button
            type="button"
            key={opt.key}
            className={cn(
              "h-8 rounded-md border relative outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              selected ? "ring-2 ring-ring ring-offset-2" : ""
            )}
            onClick={() => onChange(opt.value)}
            aria-label={opt.label}
            title={`${opt.label} (${opt.value})`}
            style={{ background: opt.value }}
          >
            {selected && (
              <span className="absolute inset-0 rounded-md border-2 border-white/70 mix-blend-overlay pointer-events-none" />
            )}
          </button>
        )
      })}
    </div>
  )
}