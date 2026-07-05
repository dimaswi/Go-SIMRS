import * as React from "react";
import { cn } from "@/lib/utils";

export interface CurrencyInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange"> {
  value?: number | "";
  onChange?: (value: number | "") => void;
  currencySymbol?: string;
}

export const CurrencyInput = React.forwardRef<HTMLInputElement, CurrencyInputProps>(
  ({ className, value, onChange, currencySymbol = "Rp", ...props }, ref) => {
    // Keep local string state to allow user to type commas/decimals naturally
    const [localValue, setLocalValue] = React.useState<string>(
      value !== undefined && value !== "" ? value.toString() : ""
    );

    // Sync local state when external value changes
    React.useEffect(() => {
      // Don't override if user is actively typing a decimal separator like "123,"
      if (
        value !== undefined &&
        value !== "" &&
        parseFloat(localValue.replace(",", ".")) !== value
      ) {
        setLocalValue(value.toString().replace(".", ","));
      } else if (value === "" || value === 0) {
        // If parent passes 0 and we haven't typed anything yet, or if they clear it
        if (localValue !== "0" && localValue !== "") {
           setLocalValue(value.toString());
        }
      }
    }, [value]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      let inputValue = e.target.value;

      // Allow only numbers and comma/dot
      inputValue = inputValue.replace(/[^0-9.,]/g, "");

      // Replace dot with comma for Indonesian standard (or vice versa, but let's stick to comma for display)
      inputValue = inputValue.replace(/\./g, ",");

      // Prevent multiple commas
      const commaCount = (inputValue.match(/,/g) || []).length;
      if (commaCount > 1) {
        return;
      }

      setLocalValue(inputValue);

      if (onChange) {
        if (inputValue === "") {
          onChange("");
          return;
        }

        const numericValue = parseFloat(inputValue.replace(",", "."));
        if (!isNaN(numericValue)) {
          onChange(numericValue);
        }
      }
    };

    const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
      // Auto-select "0" so user can just start typing to override
      if (localValue === "0") {
        e.target.select();
      }
      props.onFocus?.(e);
    };

    const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
      // Formatting on blur: clean up dangling commas or empty inputs
      if (localValue === "," || localValue === "") {
        setLocalValue("0");
        onChange?.(0);
      } else if (localValue.endsWith(",")) {
        const cleaned = localValue.slice(0, -1);
        setLocalValue(cleaned);
        onChange?.(parseFloat(cleaned));
      }
      props.onBlur?.(e);
    };

    return (
      <div className="relative flex items-center">
        <span className="absolute left-3 text-sm text-muted-foreground pointer-events-none select-none">
          {currencySymbol}
        </span>
        <input
          {...props}
          ref={ref}
          type="text"
          inputMode="decimal"
          value={localValue}
          onChange={handleChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          className={cn(
            "flex h-9 w-full rounded-md border border-input bg-transparent py-1 pl-9 pr-3 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
            className
          )}
        />
      </div>
    );
  }
);

CurrencyInput.displayName = "CurrencyInput";
