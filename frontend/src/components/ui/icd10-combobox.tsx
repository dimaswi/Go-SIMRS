import * as React from "react";
import { Check, ChevronsUpDown, Loader2, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { icd10Api, type ICD10 } from "@/lib/api/icd";
import { Badge } from "@/components/ui/badge";

// Inline useDebounce hook
function useDebounce<T>(value: T, delay: number = 300): T {
  const [debouncedValue, setDebouncedValue] = React.useState<T>(value);
  React.useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debouncedValue;
}

interface ICD10ComboboxProps {
  value?: string;
  onChange: (code: string, display: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export function ICD10Combobox({
  value,
  onChange,
  placeholder = "Cari kode ICD-10...",
  disabled = false,
  className,
}: ICD10ComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const [results, setResults] = React.useState<ICD10[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [selectedDisplay, setSelectedDisplay] = React.useState<string>("");

  const debouncedSearch = useDebounce(search, 300);

  // Fetch initial display if value is provided
  React.useEffect(() => {
    if (value && !selectedDisplay) {
      icd10Api.getByCode(value).then((icd) => {
        setSelectedDisplay(icd.display);
      }).catch(() => {
        // Code not found, just show the code
        setSelectedDisplay("");
      });
    }
  }, [value, selectedDisplay]);

  // Search when debounced search changes
  React.useEffect(() => {
    if (debouncedSearch.length >= 2) {
      setLoading(true);
      icd10Api
        .search({ search: debouncedSearch, limit: 30, valid_only: true })
        .then((data) => {
          setResults(data);
        })
        .catch((error) => {
          console.error("Failed to search ICD-10:", error);
          setResults([]);
        })
        .finally(() => {
          setLoading(false);
        });
    } else {
      setResults([]);
    }
  }, [debouncedSearch]);

  const handleSelect = (icd: ICD10) => {
    onChange(icd.code, icd.display);
    setSelectedDisplay(icd.display);
    setOpen(false);
    setSearch("");
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            "w-full justify-between font-normal",
            !value && "text-muted-foreground",
            className
          )}
        >
          {value ? (
            <span className="flex items-center gap-2 truncate">
              <Badge variant="secondary" className="font-mono text-xs shrink-0">
                {value}
              </Badge>
              <span className="truncate text-sm">{selectedDisplay}</span>
            </span>
          ) : (
            <span className="flex items-center gap-2">
              <Search className="h-4 w-4" />
              {placeholder}
            </span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[500px] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Ketik kode atau nama diagnosis..."
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            {loading && (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                <span className="text-sm text-muted-foreground">Mencari...</span>
              </div>
            )}
            {!loading && search.length < 2 && (
              <div className="py-6 text-center text-sm text-muted-foreground">
                Ketik minimal 2 karakter untuk mencari
              </div>
            )}
            {!loading && search.length >= 2 && results.length === 0 && (
              <CommandEmpty>Tidak ditemukan kode ICD-10</CommandEmpty>
            )}
            {!loading && results.length > 0 && (
              <CommandGroup heading={`${results.length} hasil ditemukan`}>
                {results.map((icd) => (
                  <CommandItem
                    key={icd.id}
                    value={icd.code}
                    onSelect={() => handleSelect(icd)}
                    className="flex items-start gap-2 py-2"
                  >
                    <Check
                      className={cn(
                        "h-4 w-4 mt-0.5 shrink-0",
                        value === icd.code ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <div className="flex flex-col gap-0.5 min-w-0">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="font-mono text-xs shrink-0">
                          {icd.code}
                        </Badge>
                        {icd.asterisk && (
                          <Badge variant="secondary" className="text-xs">*</Badge>
                        )}
                      </div>
                      <span className="text-sm text-muted-foreground truncate">
                        {icd.display}
                      </span>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
