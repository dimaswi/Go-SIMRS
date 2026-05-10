import * as React from "react";
import { format, isValid, parseISO } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { CalendarIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface DatePickerDropdownProps {
  value?: string;
  onChange: (value: string | undefined) => void;
  className?: string;
  minYear?: number;
  maxYear?: number;
  disabled?: boolean;
  disableFuture?: boolean;
  tabIndex?: number;
  size?: "default" | "sm";
}

export function DatePickerDropdown({
  value,
  onChange,
  className,
  size = "default",
  minYear = 1900,
  maxYear,
  disabled = false,
  disableFuture = false,
  tabIndex,
}: DatePickerDropdownProps) {
  const [open, setOpen] = React.useState(false);
  const currentYear = new Date().getFullYear();
  const effectiveMaxYear = maxYear || currentYear;
  const today = React.useMemo(() => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    return date;
  }, []);
  const todayValue = format(today, "yyyy-MM-dd");
  const selectedDate = React.useMemo(() => {
    if (!value) return undefined;
    const parsed = parseISO(value);
    return isValid(parsed) ? parsed : undefined;
  }, [value]);
  const minDate = React.useMemo(() => new Date(minYear, 0, 1), [minYear]);
  const maxDate = React.useMemo(() => {
    const configuredMax = new Date(effectiveMaxYear, 11, 31);
    configuredMax.setHours(0, 0, 0, 0);
    if (!disableFuture) return configuredMax;
    return configuredMax.getTime() < today.getTime() ? configuredMax : today;
  }, [disableFuture, effectiveMaxYear, today]);
  const isCompact = size === "sm";
  const canSelectToday = !disabled && today.getTime() >= minDate.getTime() && today.getTime() <= maxDate.getTime();
  const triggerLabel = selectedDate
    ? format(selectedDate, isCompact ? "dd MMM yyyy" : "dd MMMM yyyy", { locale: localeId })
    : "Pilih tanggal";

  const handleSelectDate = (date?: Date) => {
    if (!date) {
      onChange(undefined);
      return;
    }

    const normalized = new Date(date);
    normalized.setHours(0, 0, 0, 0);
    onChange(format(normalized, "yyyy-MM-dd"));
    setOpen(false);
  };

  return (
    <div className={cn("flex items-center", isCompact ? "gap-1.5" : "gap-2", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            disabled={disabled}
            tabIndex={tabIndex}
            className={cn(
              "justify-start rounded-none border-border/70 bg-background font-normal shadow-none",
              isCompact ? "h-8 min-w-[170px] px-2 text-xs" : "h-9 min-w-[220px] px-3 text-sm"
            )}
          >
            <CalendarIcon className={cn("mr-2 shrink-0 text-muted-foreground", isCompact ? "h-3.5 w-3.5" : "h-4 w-4")} />
            <span className={cn("truncate", !selectedDate && "text-muted-foreground")}>{triggerLabel}</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-auto rounded-none border-border/70 p-0">
          <div className="border-b border-border/70 bg-muted/20 px-3 py-2">
            <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Pilih Tanggal</div>
            <div className="mt-1 text-sm font-medium text-foreground">{selectedDate ? format(selectedDate, "dd MMMM yyyy", { locale: localeId }) : "Belum ada tanggal dipilih"}</div>
          </div>
          <Calendar
            mode="single"
            selected={selectedDate}
            month={selectedDate}
            onSelect={handleSelectDate}
            captionLayout="dropdown"
            startMonth={minDate}
            endMonth={maxDate}
            disabled={{ before: minDate, after: maxDate }}
            className="rounded-none"
          />
          <div className="flex items-center justify-between border-t border-border/70 bg-background px-3 py-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 rounded-none px-3 text-xs"
              onClick={() => {
                onChange(undefined);
                setOpen(false);
              }}
            >
              Reset
            </Button>
            {canSelectToday && (
              <Button
                type="button"
                variant={value === todayValue ? "default" : "outline"}
                size="sm"
                className="h-8 rounded-none px-3 text-xs"
                onClick={() => handleSelectDate(today)}
              >
                Hari ini
              </Button>
            )}
          </div>
        </PopoverContent>
      </Popover>
      {value && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={disabled}
          className={cn("rounded-none px-2", isCompact ? "h-8 text-xs" : "h-9 text-sm")}
          onClick={() => onChange(undefined)}
        >
          Reset
        </Button>
      )}
    </div>
  );
}
