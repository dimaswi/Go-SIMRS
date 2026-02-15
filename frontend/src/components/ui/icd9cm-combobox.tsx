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
import { icd9cmApi, type ICD9CM } from "@/lib/api/icd";
import { Badge } from "@/components/ui/badge";

function useDebounce<T>(value: T, delay: number = 300): T {
  const [debouncedValue, setDebouncedValue] = React.useState<T>(value);
  React.useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debouncedValue;
}

interface ICD9CMComboboxProps {
  value?: string;
  onChange: (code: string, display: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export function ICD9CMCombobox({
  value,
  onChange,
  placeholder = "Cari kode ICD-9-CM...",
  disabled = false,
  className,
}: ICD9CMComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const [results, setResults] = React.useState<ICD9CM[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [selectedDisplay, setSelectedDisplay] = React.useState<string>("");

  const debouncedSearch = useDebounce(search, 300);

  React.useEffect(() => {
    if (value && !selectedDisplay) {
      icd9cmApi
        .getByCode(value)
        .then((icd) => {
          setSelectedDisplay(icd.display);
        })
        .catch(() => {
          setSelectedDisplay("");
        });
    }
  }, [value, selectedDisplay]);

  React.useEffect(() => {
    if (debouncedSearch.length >= 2) {
      setLoading(true);
      icd9cmApi
        .search({ search: debouncedSearch, limit: 30, valid_only: true })
        .then((data) => {
          setResults(data);
        })
        .catch(() => {
          setResults([]);
        })
        .finally(() => {
          setLoading(false);
        });
    } else {
      setResults([]);
    }
  }, [debouncedSearch]);

  const handleSelect = (icd: ICD9CM) => {
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
            className,
          )}
        >
          {value ? (
            <span className="flex items-center gap-2 truncate">
              <Badge
                variant="secondary"
                className="font-mono text-xs shrink-0"
              >
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
            placeholder="Ketik kode atau nama prosedur..."
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            {loading && (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                <span className="text-sm text-muted-foreground">
                  Mencari...
                </span>
              </div>
            )}
            {!loading && search.length < 2 && (
              <div className="py-6 text-center text-sm text-muted-foreground">
                Ketik minimal 2 karakter untuk mencari
              </div>
            )}
            {!loading && search.length >= 2 && results.length === 0 && (
              <CommandEmpty>Tidak ditemukan kode ICD-9-CM</CommandEmpty>
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
                        value === icd.code ? "opacity-100" : "opacity-0",
                      )}
                    />
                    <div className="flex flex-col gap-0.5 min-w-0">
                      <Badge
                        variant="outline"
                        className="font-mono text-xs shrink-0 w-fit"
                      >
                        {icd.code}
                      </Badge>
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
