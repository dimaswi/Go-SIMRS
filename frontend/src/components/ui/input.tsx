import * as React from "react"

import { cn } from "@/lib/utils"

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, value, onChange, onFocus, onBlur, ...props }, ref) => {
    const isNumberInput = type === "number"
    const isControlled = value !== undefined
    const [draftValue, setDraftValue] = React.useState<string | null>(null)

    const displayValue = isNumberInput && isControlled && draftValue !== null ? draftValue : value

    const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
      if (isNumberInput && isControlled) {
        setDraftValue(event.target.value)
      }
      onChange?.(event)
    }

    const handleFocus = (event: React.FocusEvent<HTMLInputElement>) => {
      if (isNumberInput && isControlled) {
        setDraftValue(value === null || value === undefined ? "" : String(value))
      }
      onFocus?.(event)
    }

    const handleBlur = (event: React.FocusEvent<HTMLInputElement>) => {
      if (isNumberInput && isControlled) {
        setDraftValue(null)
      }
      onBlur?.(event)
    }

    return (
      <input
        type={type}
        className={cn(
          "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:border-primary disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          className
        )}
        ref={ref}
        value={displayValue}
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
