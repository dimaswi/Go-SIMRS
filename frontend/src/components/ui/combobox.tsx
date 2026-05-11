"use client"

import * as React from "react"
import { Check, ChevronsUpDown, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

export interface ComboboxOption {
  value: string
  label: string
}

interface ComboboxProps {
  options: ComboboxOption[]
  value?: string
  onValueChange?: (value: string) => void
  onSearchChange?: (search: string) => void
  placeholder?: string
  searchPlaceholder?: string
  emptyText?: string
  disabled?: boolean
  loading?: boolean
  className?: string
  tabIndex?: number
  allowCustomValue?: boolean
  customValueLabel?: (value: string) => string
  //searchable?: boolean
}

export function Combobox({
  options,
  value,
  onValueChange,
  onSearchChange,
  placeholder = "Pilih...",
  searchPlaceholder = "Cari...",
  emptyText = "Tidak ditemukan.",
  disabled = false,
  loading = false,
  className,
  tabIndex,
  allowCustomValue = false,
  customValueLabel,
  //searchable = false,
}: ComboboxProps) {
  const [open, setOpen] = React.useState(false)
  const [search, setSearch] = React.useState("")

  const selectedOption = options.find((option) => option.value === value)
  const trimmedSearch = search.trim()
  const canUseCustomValue =
    allowCustomValue &&
    trimmedSearch.length > 0 &&
    !options.some(
      (option) =>
        option.value.toLowerCase() === trimmedSearch.toLowerCase() ||
        option.label.toLowerCase() === trimmedSearch.toLowerCase()
    )

  React.useEffect(() => {
    if (!open) {
      setSearch("")
    }
  }, [open])

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled || loading}
          tabIndex={tabIndex}
          className={cn(
            "w-full justify-between font-normal h-9 text-sm overflow-hidden",
            !value && "text-muted-foreground",
            className
          )}
        >
          {loading ? (
            <span className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading...
            </span>
          ) : selectedOption ? (
            <span className="truncate">{selectedOption.label}</span>
          ) : value ? (
            <span className="truncate">{value}</span>
          ) : (
            placeholder
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
        <Command shouldFilter={!onSearchChange}>
          <CommandInput
            placeholder={searchPlaceholder}
            className="h-9"
            value={search}
            onValueChange={(nextValue) => {
              setSearch(nextValue)
              onSearchChange?.(nextValue)
            }}
          />
          <CommandList>
            <CommandEmpty>{emptyText}</CommandEmpty>
            <CommandGroup>
              {options.map((option) => (
                <CommandItem
                  key={option.value}
                  value={option.label}
                  onSelect={() => {
                    onValueChange?.(option.value === value ? "" : option.value)
                    setSearch("")
                    setOpen(false)
                  }}
                >
                  {option.label}
                  <Check
                    className={cn(
                      "ml-auto h-4 w-4",
                      value === option.value ? "opacity-100" : "opacity-0"
                    )}
                  />
                </CommandItem>
              ))}
              {canUseCustomValue && (
                <CommandItem
                  value={trimmedSearch}
                  onSelect={() => {
                    onValueChange?.(trimmedSearch)
                    setSearch("")
                    setOpen(false)
                  }}
                >
                  {customValueLabel ? customValueLabel(trimmedSearch) : `Gunakan "${trimmedSearch}"`}
                </CommandItem>
              )}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
