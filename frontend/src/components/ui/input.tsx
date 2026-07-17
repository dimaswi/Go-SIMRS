import * as React from "react"

import { cn } from "@/lib/utils"

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, value, onChange, onFocus, onBlur, ...props }, ref) => {
    const isNumberInput = type === "number"
    const isControlled = value !== undefined
    const [draftValue, setDraftValue] = React.useState<string | null>(null)

    // Format number to Indonesian style: dots for thousands, comma for decimals
    // NOTE: In JS logic, we receive dot '.' as decimal from parent states when float is used.
    // However, when typing we want to allow comma ',' as decimal.
    const formatNumber = (val: string | number | readonly string[] | undefined | null) => {
      if (val === null || val === undefined || val === "") return "";
      const str = String(val);
      
      const isNegative = str.startsWith("-");
      // Keep only digits, dots, and commas
      let clean = str.replace(/[^\d.,]/g, "");
      if (clean === "") return isNegative ? "-" : "";

      // Standardize decimal separator to dot for processing
      let hasComma = clean.includes(',');
      if (hasComma) {
        clean = clean.replace(/\./g, ""); // Remove dots if comma is used
        clean = clean.replace(/,/g, "."); // Convert comma to dot for parsing
      }

      const parts = clean.split(".");
      // Only keep the first decimal point
      if (parts.length > 2) {
        clean = parts[0] + "." + parts.slice(1).join("");
      }

      const finalParts = clean.split(".");
      // Add dots for thousands separator
      finalParts[0] = finalParts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ".");
      
      // Use comma for decimal separator display
      let res = finalParts.length > 1 ? finalParts[0] + "," + finalParts[1] : finalParts[0];
      return isNegative ? "-" + res : res;
    };

    const displayValue = isNumberInput 
      ? formatNumber(isControlled && draftValue !== null ? draftValue : value)
      : (isControlled && draftValue !== null ? draftValue : value)

    const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
      if (isNumberInput) {
        let raw = event.target.value;
        const isNegative = raw.startsWith("-");
        
        // Remove dots (thousands separators), replace comma with dot (decimal)
        raw = raw.replace(/\./g, "").replace(/,/g, ".");
        
        // Remove invalid characters
        raw = raw.replace(/[^\d.]/g, "");
        if (isNegative) raw = "-" + raw;
        
        // Ensure only one dot
        const parts = raw.split(".");
        if (parts.length > 2) {
          raw = parts[0] + "." + parts.slice(1).join("");
        }

        if (isControlled) {
          setDraftValue(raw);
        }
        
        // Clone event with raw value so parent receives the unformatted numeric string
        const newEvent = Object.create(event);
        newEvent.target = { ...event.target, value: raw } as HTMLInputElement;
        newEvent.currentTarget = { ...event.currentTarget, value: raw } as HTMLInputElement;
        
        onChange?.(newEvent);
      } else {
        onChange?.(event)
      }
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

    const inputType = isNumberInput ? "text" : type;
    const inputMode = isNumberInput ? "decimal" : props.inputMode;

    return (
      <input
        type={inputType}
        inputMode={inputMode}
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
