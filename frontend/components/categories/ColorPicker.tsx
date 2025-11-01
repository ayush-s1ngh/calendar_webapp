"use client"

import { cn } from "@/lib/utils"
import { COLOR_OPTIONS } from "./category-utils"

/**
 * Accessible color picker rendered as a radiogroup of color swatches.
 */
export function ColorPicker({
  value,
  onChange,
  name = "category-color",
  disabled = false,
}: {
  value: string
  onChange: (v: string) => void
  name?: string
  disabled?: boolean
}) {
  return (
    <div
      role="radiogroup"
      aria-label="Select category color"
      className="grid grid-cols-5 gap-2"
      data-testid="color-picker"
    >
      {COLOR_OPTIONS.map((opt) => {
        const selected = value === opt.value
        return (
          <button
            type="button"
            key={opt.key}
            role="radio"
            aria-checked={selected}
            aria-label={`${opt.label} (${opt.value})`}
            name={name}
            disabled={disabled}
            className={cn(
              "h-8 rounded-md border relative outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              selected ? "ring-2 ring-ring ring-offset-2" : "",
              disabled && "opacity-50 cursor-not-allowed"
            )}
            onClick={() => !disabled && onChange(opt.value)}
            title={`${opt.label} (${opt.value})`}
            style={{ background: opt.value }}
            data-testid={`color-${opt.key}`}
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