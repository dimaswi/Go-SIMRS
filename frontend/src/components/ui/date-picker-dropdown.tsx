import * as React from "react";
import { cn } from "@/lib/utils";
import { CalendarIcon } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface DatePickerDropdownProps {
  value?: string; // format: "yyyy-MM-dd"
  onChange: (value: string | undefined) => void;
  className?: string;
  minYear?: number;
  maxYear?: number;
  disabled?: boolean;
  disableFuture?: boolean;
  tabIndex?: number;
}

const months = [
  { value: "01", label: "Januari" },
  { value: "02", label: "Februari" },
  { value: "03", label: "Maret" },
  { value: "04", label: "April" },
  { value: "05", label: "Mei" },
  { value: "06", label: "Juni" },
  { value: "07", label: "Juli" },
  { value: "08", label: "Agustus" },
  { value: "09", label: "September" },
  { value: "10", label: "Oktober" },
  { value: "11", label: "November" },
  { value: "12", label: "Desember" },
];

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

export function DatePickerDropdown({
  value,
  onChange,
  className,
  minYear = 1900,
  maxYear,
  disabled = false,
  disableFuture = false,
  tabIndex,
}: DatePickerDropdownProps) {
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;
  const currentDay = new Date().getDate();
  const effectiveMaxYear = maxYear || currentYear;

  // Parse value
  const [selectedYear, setSelectedYear] = React.useState<string>("");
  const [selectedMonth, setSelectedMonth] = React.useState<string>("");
  const [selectedDay, setSelectedDay] = React.useState<string>("");

  React.useEffect(() => {
    if (value) {
      const [year, month, day] = value.split("-");
      setSelectedYear(year || "");
      setSelectedMonth(month || "");
      setSelectedDay(day || "");
    } else {
      setSelectedYear("");
      setSelectedMonth("");
      setSelectedDay("");
    }
  }, [value]);

  // Generate years (descending order for easier selection of old years)
  const years = React.useMemo(() => {
    const yearsArray: string[] = [];
    for (let y = effectiveMaxYear; y >= minYear; y--) {
      yearsArray.push(y.toString());
    }
    return yearsArray;
  }, [minYear, effectiveMaxYear]);

  // Generate days based on selected year and month
  const days = React.useMemo(() => {
    const daysArray: string[] = [];
    if (selectedYear && selectedMonth) {
      const daysInMonth = getDaysInMonth(parseInt(selectedYear), parseInt(selectedMonth));
      for (let d = 1; d <= daysInMonth; d++) {
        daysArray.push(d.toString().padStart(2, "0"));
      }
    } else {
      // Default to 31 days if no year/month selected
      for (let d = 1; d <= 31; d++) {
        daysArray.push(d.toString().padStart(2, "0"));
      }
    }
    return daysArray;
  }, [selectedYear, selectedMonth]);

  // Get available months based on year (for disableFuture)
  const availableMonths = React.useMemo(() => {
    if (disableFuture && selectedYear === currentYear.toString()) {
      return months.filter((m) => parseInt(m.value) <= currentMonth);
    }
    return months;
  }, [selectedYear, disableFuture, currentMonth, currentYear]);

  // Get available days (for disableFuture)
  const availableDays = React.useMemo(() => {
    if (
      disableFuture &&
      selectedYear === currentYear.toString() &&
      selectedMonth === currentMonth.toString().padStart(2, "0")
    ) {
      return days.filter((d) => parseInt(d) <= currentDay);
    }
    return days;
  }, [selectedYear, selectedMonth, days, disableFuture, currentYear, currentMonth, currentDay]);

  const handleYearChange = (year: string) => {
    setSelectedYear(year);
    // Reset month and day if they become invalid
    if (disableFuture && year === currentYear.toString()) {
      if (parseInt(selectedMonth) > currentMonth) {
        setSelectedMonth("");
        setSelectedDay("");
        onChange(undefined);
        return;
      }
    }
    if (selectedMonth && selectedDay) {
      // Validate day for the new year/month combination
      const daysInMonth = getDaysInMonth(parseInt(year), parseInt(selectedMonth));
      const validDay = parseInt(selectedDay) <= daysInMonth ? selectedDay : "";
      if (validDay) {
        onChange(`${year}-${selectedMonth}-${validDay}`);
      } else {
        setSelectedDay("");
        onChange(undefined);
      }
    }
  };

  const handleMonthChange = (month: string) => {
    setSelectedMonth(month);
    // Reset day if it becomes invalid
    if (disableFuture && selectedYear === currentYear.toString() && month === currentMonth.toString().padStart(2, "0")) {
      if (parseInt(selectedDay) > currentDay) {
        setSelectedDay("");
        onChange(undefined);
        return;
      }
    }
    if (selectedYear && selectedDay) {
      const daysInMonth = getDaysInMonth(parseInt(selectedYear), parseInt(month));
      const validDay = parseInt(selectedDay) <= daysInMonth ? selectedDay : "";
      if (validDay) {
        onChange(`${selectedYear}-${month}-${validDay}`);
      } else {
        setSelectedDay("");
        onChange(undefined);
      }
    }
  };

  const handleDayChange = (day: string) => {
    setSelectedDay(day);
    if (selectedYear && selectedMonth) {
      onChange(`${selectedYear}-${selectedMonth}-${day}`);
    }
  };

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <CalendarIcon className="h-4 w-4 text-muted-foreground shrink-0" />
      <div className="flex items-center gap-1 flex-1">
        <Select value={selectedDay} onValueChange={handleDayChange} disabled={disabled}>
          <SelectTrigger tabIndex={tabIndex} className="h-9 w-[70px] text-sm">
            <SelectValue placeholder="Tgl" />
          </SelectTrigger>
          <SelectContent>
            {availableDays.map((day) => (
              <SelectItem key={day} value={day}>
                {parseInt(day)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={selectedMonth} onValueChange={handleMonthChange} disabled={disabled}>
          <SelectTrigger tabIndex={tabIndex ? tabIndex + 1 : undefined} className="h-9 flex-1 min-w-[100px] text-sm">
            <SelectValue placeholder="Bulan" />
          </SelectTrigger>
          <SelectContent>
            {availableMonths.map((month) => (
              <SelectItem key={month.value} value={month.value}>
                {month.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={selectedYear} onValueChange={handleYearChange} disabled={disabled}>
          <SelectTrigger tabIndex={tabIndex ? tabIndex + 2 : undefined} className="h-9 w-[85px] text-sm">
            <SelectValue placeholder="Tahun" />
          </SelectTrigger>
          <SelectContent className="max-h-[300px]">
            {years.map((year) => (
              <SelectItem key={year} value={year}>
                {year}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
