import { useEffect, useState } from "react";
import { Check, ChevronsUpDown, Loader2 } from "lucide-react";
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
import { employeesApi, type Employee } from "@/lib/api/employees";

interface EmployeeSelectProps {
  value?: string | number | null;
  onChange: (value: string | number, name?: string) => void;
  disabled?: boolean;
  role?: string;
}

export function EmployeeSelect({
  value,
  onChange,
  disabled = false,
  role,
}: EmployeeSelectProps) {
  const [open, setOpen] = useState(false);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    const fetchEmployees = async () => {
      setLoading(true);
      try {
        const res = await employeesApi.getLookup({ 
          tipe_karyawan: role === "dokter" ? "dokter" : "perawat",
          limit: 1000 
        });
        if (mounted) {
          setEmployees(res.data.data || []);
        }
      } catch (err) {
        console.error("Failed to load employees:", err);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    fetchEmployees();
    return () => { mounted = false; };
  }, [role]);

  const selectedEmployee = employees.find((e) => e.id.toString() === value?.toString());

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
          disabled={disabled || loading}
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground mr-2" />
          ) : selectedEmployee ? (
            selectedEmployee.nama_lengkap
          ) : (
            "Pilih..."
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Cari nama..." />
          <CommandList>
            <CommandEmpty>Karyawan tidak ditemukan.</CommandEmpty>
            <CommandGroup>
              {employees.map((employee) => (
                <CommandItem
                  key={employee.id}
                  value={employee.nama_lengkap}
                  onSelect={() => {
                    onChange(employee.id, employee.nama_lengkap);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value?.toString() === employee.id.toString() ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {employee.nama_lengkap}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
