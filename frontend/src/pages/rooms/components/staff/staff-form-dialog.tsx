import { useState, useEffect, useMemo, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { roomsApi, employeesApi, type MasterData, type Employee } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Search } from "lucide-react";

interface StaffFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  roomId: number;
  masterData: Record<string, MasterData[]>;
  onSuccess: () => void;
}

type SelectedStaff = {
  role_type: string;
  is_primary: boolean;
};

export function StaffFormDialog({
  open,
  onOpenChange,
  roomId,
  masterData,
  onSuccess,
}: StaffFormDialogProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [loadingEmployees, setLoadingEmployees] = useState(false);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [search, setSearch] = useState("");
  const [selectedStaff, setSelectedStaff] = useState<Record<number, SelectedStaff>>({});

  const hasInitialized = useRef(false);

  useEffect(() => {
    if (open) {
      if (!hasInitialized.current) {
        loadEmployees();
        setSelectedStaff({});
        setSearch("");
        hasInitialized.current = true;
      }
    } else {
      hasInitialized.current = false;
    }
  }, [open]);

  const loadEmployees = async () => {
    setLoadingEmployees(true);
    try {
      const [empResponse, staffResponse] = await Promise.all([
        employeesApi.getAll(),
        roomsApi.getStaff(roomId)
      ]);
      const existingStaffIds = new Set((staffResponse.data.data || []).map(s => s.employee_id));
      const employeesWithUser = (empResponse.data.data || []).filter(
        (emp: Employee) => emp.user && !existingStaffIds.has(emp.id)
      );
      setEmployees(employeesWithUser);
    } catch (error) {
      console.error("Failed to load employees:", error);
    } finally {
      setLoadingEmployees(false);
    }
  };

  const filteredEmployees = useMemo(() => {
    if (!search) return employees;
    const lowerSearch = search.toLowerCase();
    return employees.filter(
      emp =>
        emp.nama_lengkap.toLowerCase().includes(lowerSearch) ||
        (emp.nip && emp.nip.toLowerCase().includes(lowerSearch))
    );
  }, [employees, search]);

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const next: Record<number, SelectedStaff> = {};
      filteredEmployees.forEach(emp => {
        next[emp.id] = selectedStaff[emp.id] || { role_type: "", is_primary: false };
      });
      setSelectedStaff(next);
    } else {
      setSelectedStaff({});
    }
  };

  const handleSelectOne = (id: number, checked: boolean) => {
    setSelectedStaff(prev => {
      const next = { ...prev };
      if (checked) {
        next[id] = { role_type: "", is_primary: false };
      } else {
        delete next[id];
      }
      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const selectedIds = Object.keys(selectedStaff).map(Number);

    if (selectedIds.length === 0) {
      toast({
        variant: "destructive",
        title: "Error!",
        description: "Silakan pilih minimal satu pegawai.",
      });
      return;
    }

    const missingRoles = selectedIds.some(id => !selectedStaff[id].role_type);
    if (missingRoles) {
      toast({
        variant: "destructive",
        title: "Error!",
        description: "Silakan pilih peran untuk semua pegawai yang dicentang.",
      });
      return;
    }

    setLoading(true);

    try {
      const promises = selectedIds.map(empId =>
        roomsApi.assignStaff(roomId, {
          employee_id: empId,
          role_type: selectedStaff[empId].role_type,
          is_primary: selectedStaff[empId].is_primary,
          notes: "",
        })
      );

      await Promise.all(promises);

      toast({
        variant: "success",
        title: "Berhasil!",
        description: `${selectedIds.length} staff berhasil ditambahkan ke ruangan.`,
      });
      onOpenChange(false);
      onSuccess();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error!",
        description: error.response?.data?.error || "Gagal menambahkan beberapa staff.",
      });
    } finally {
      setLoading(false);
    }
  };

  const roleTypeOptions = (masterData.room_staff_role || []).map(item => ({
    value: item.code,
    label: item.name,
  }));

  const selectedCount = Object.keys(selectedStaff).length;
  const isAllSelected = filteredEmployees.length > 0 && selectedCount === filteredEmployees.length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl w-[90vw] h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Tambah Staff ke Ruangan</DialogTitle>
          <DialogDescription>
            Pilih pegawai yang akan ditugaskan ke ruangan ini dan tentukan perannya masing-masing.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0 mt-2">
          <div className="flex flex-col border rounded-md flex-1 min-h-0 overflow-hidden">
            <div className="p-3 border-b flex items-center gap-2 bg-muted/30">
              <Search className="w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Cari nama atau NIP pegawai..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-8 border-0 shadow-none focus-visible:ring-0 bg-transparent px-0"
              />
            </div>
            <div className="flex-1 overflow-auto">
              <Table containerClassName="border-0 rounded-none">
                <TableHeader className="sticky top-0 bg-background z-10 shadow-sm">
                  <TableRow>
                    <TableHead className="w-[50px] text-center">
                      <Checkbox
                        checked={isAllSelected}
                        onCheckedChange={handleSelectAll}
                      />
                    </TableHead>
                    <TableHead className="w-[150px]">NIP</TableHead>
                    <TableHead>Nama Pegawai</TableHead>
                    <TableHead className="w-[250px]">Peran</TableHead>
                    <TableHead className="w-[100px] text-center">Utama</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loadingEmployees ? (
                    <TableRow>
                      <TableCell colSpan={5} className="h-24 text-center">
                        <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                      </TableCell>
                    </TableRow>
                  ) : filteredEmployees.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                        Tidak ada pegawai ditemukan.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredEmployees.map((emp) => {
                      const isSelected = !!selectedStaff[emp.id];
                      return (
                        <TableRow
                          key={emp.id}
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => handleSelectOne(emp.id, !isSelected)}
                        >
                          <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={(c) => handleSelectOne(emp.id, !!c)}
                            />
                          </TableCell>
                          <TableCell className="font-medium">{emp.nip || '-'}</TableCell>
                          <TableCell>{emp.nama_lengkap}</TableCell>
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            {isSelected ? (
                              <Select
                                value={selectedStaff[emp.id].role_type}
                                onValueChange={(val) =>
                                  setSelectedStaff(prev => ({
                                    ...prev,
                                    [emp.id]: { ...prev[emp.id], role_type: val }
                                  }))
                                }
                              >
                                <SelectTrigger className="h-8 text-xs w-full">
                                  <SelectValue placeholder="Pilih peran..." />
                                </SelectTrigger>
                                <SelectContent>
                                  {roleTypeOptions.map(opt => (
                                    <SelectItem key={opt.value} value={opt.value} className="text-xs">
                                      {opt.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            ) : (
                              <span className="text-xs text-muted-foreground italic">Pilih pegawai dulu</span>
                            )}
                          </TableCell>
                          <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                            {isSelected && (
                              <Checkbox
                                checked={selectedStaff[emp.id].is_primary}
                                onCheckedChange={(c) =>
                                  setSelectedStaff(prev => ({
                                    ...prev,
                                    [emp.id]: { ...prev[emp.id], is_primary: !!c }
                                  }))
                                }
                              />
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
            <div className="p-2 border-t text-xs text-muted-foreground flex justify-between bg-muted/30">
              <span>Total: {filteredEmployees.length} pegawai</span>
              <span>Terpilih: {selectedCount}</span>
            </div>
          </div>

          <DialogFooter className="mt-4 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Batal
            </Button>
            <Button type="submit" disabled={loading || loadingEmployees || selectedCount === 0}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Simpan ({selectedCount}) Staff
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
