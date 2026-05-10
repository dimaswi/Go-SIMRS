import { useState, useEffect, useCallback, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2, UserCheck, UserX, Check, PlusCircle, Trash2, Search } from "lucide-react";
import { roomsApi, employeesApi, type Employee, type RoomStaff, type MasterData } from "@/lib/api";

interface StaffAssignmentPanelProps {
  roomId: number;
  masterData: Record<string, MasterData[]>;
  staff: RoomStaff[];
  onRefresh: () => void;
  hasPermission: boolean;
}

export function StaffAssignmentPanel({
  roomId,
  masterData,
  staff,
  onRefresh,
  hasPermission,
}: StaffAssignmentPanelProps) {
  const { toast } = useToast();
  const [loadingEmployees, setLoadingEmployees] = useState(false);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [addingId, setAddingId] = useState<number | null>(null);
  const [roleSelections, setRoleSelections] = useState<Record<number, string>>({});
  const [availableSearch, setAvailableSearch] = useState("");
  const [assignedSearch, setAssignedSearch] = useState("");

  const handleRoleChange = (employeeId: number, roleType: string) => {
    setRoleSelections(prev => ({
      ...prev,
      [employeeId]: roleType,
    }));
  };

  const loadEmployees = useCallback(async () => {
    setLoadingEmployees(true);
    try {
      const response = await employeesApi.getAll({ limit: 200 });
      const employeesWithUser = (response.data.data || []).filter(
        (emp: Employee) => emp.user
      );
      setEmployees(employeesWithUser);
    } catch (error) {
      console.error("Failed to load employees:", error);
    } finally {
      setLoadingEmployees(false);
    }
  }, []);

  useEffect(() => {
    loadEmployees();
  }, [loadEmployees]);

  // Show all employees, not just unassigned ones
  const assignedEmployeeIds = staff.map((s) => s.employee_id);
  const availableEmployees = employees; // Changed: show all employees

  const getRoleTypeName = (code: string) => {
    const role = masterData.room_staff_role?.find((item) => item.code === code);
    return role?.name || code;
  };

  const filteredAvailableEmployees = useMemo(() => {
    const query = availableSearch.trim().toLowerCase();
    if (!query) return availableEmployees;

    return availableEmployees.filter((employee) =>
      [employee.nama_lengkap, employee.nip, employee.tipe_karyawan]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(query)
    );
  }, [availableEmployees, availableSearch]);

  const filteredAssignedStaff = useMemo(() => {
    const query = assignedSearch.trim().toLowerCase();
    if (!query) return staff;

    return staff.filter((item) =>
      [
        item.employee?.nama_lengkap,
        item.employee?.nip,
        item.employee?.tipe_karyawan,
        getRoleTypeName(item.role_type),
        item.notes,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(query)
    );
  }, [assignedSearch, staff, masterData]);

  const handleAdd = async (employeeId: number, roleType: string) => {
    // Check if already assigned
    if (assignedEmployeeIds.includes(employeeId)) {
      toast({
        variant: "destructive",
        title: "Sudah ditugaskan",
        description: "Pegawai ini sudah ditugaskan di ruangan ini",
      });
      return;
    }

    if (!roleType) {
      toast({
        variant: "destructive",
        title: "Pilih peran",
        description: "Pilih peran staff terlebih dahulu",
      });
      return;
    }

    setAddingId(employeeId);
    try {
      await roomsApi.assignStaff(roomId, {
        employee_id: employeeId,
        role_type: roleType,
        is_primary: false,
        notes: "",
      });
      toast({
        variant: "success",
        title: "Berhasil!",
        description: "Staff berhasil ditambahkan ke ruangan.",
      });
      // Clear role selection after successful add
      setRoleSelections(prev => {
        const newSelections = { ...prev };
        delete newSelections[employeeId];
        return newSelections;
      });
      onRefresh();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error!",
        description: error.response?.data?.error || "Gagal menambahkan staff.",
      });
    } finally {
      setAddingId(null);
    }
  };

  const handleRemove = async (staffId: number) => {
    try {
      await roomsApi.removeStaff(roomId, staffId);
      toast({
        variant: "success",
        title: "Berhasil!",
        description: "Staff berhasil dihapus dari ruangan.",
      });
      onRefresh();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error!",
        description: error.response?.data?.error || "Gagal menghapus staff.",
      });
    }
  };

  if (loadingEmployees) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-w-0 space-y-4 overflow-x-hidden">
      {/* Two Column Layout */}
      <div className="grid min-w-0 grid-cols-1 gap-4 xl:grid-cols-2">
        {/* Available Column */}
        <div className="min-w-0 space-y-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
              <UserX className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h2 className="text-sm font-semibold">
                Tersedia ({availableEmployees.length})
              </h2>
              <p className="text-xs text-muted-foreground">
                Semua pegawai
              </p>
            </div>
          </div>
          <div className="min-w-0 overflow-hidden rounded-lg border">
            <div className="border-b border-border/70 px-3 py-3">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input value={availableSearch} onChange={(event) => setAvailableSearch(event.target.value)} placeholder="Cari pegawai tersedia..." className="pl-9" />
              </div>
            </div>
            <div className="max-h-[26rem] overflow-y-auto pb-3">
              <table className="w-full table-fixed text-sm">
                <thead className="sticky top-0 z-10 border-b border-border/70 bg-muted/95 text-left text-[11px] uppercase tracking-[0.18em] text-muted-foreground backdrop-blur">
                  <tr>
                    <th className="w-[32%] px-3 py-2.5 font-medium">Pegawai</th>
                    <th className="w-[16%] px-3 py-2.5 font-medium">NIP</th>
                    <th className="w-[16%] px-3 py-2.5 font-medium">Tipe</th>
                    <th className="w-[24%] px-3 py-2.5 font-medium">Peran</th>
                    <th className="w-[12%] px-3 py-2.5 text-right font-medium">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60 bg-background">
                  {filteredAvailableEmployees.map((employee) => {
                    const isAssigned = assignedEmployeeIds.includes(employee.id);
                    const selectedRole = roleSelections[employee.id] || "";

                    return (
                      <tr key={employee.id} className="align-top">
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-2">
                            <span className="font-medium break-words">{employee.nama_lengkap}</span>
                            {isAssigned ? (
                              <Badge variant="secondary" className="text-xs">
                                <Check className="mr-1 h-3 w-3" />
                                Ditugaskan
                              </Badge>
                            ) : null}
                          </div>
                        </td>
                        <td className="px-3 py-3 text-muted-foreground">{employee.nip || '-'}</td>
                        <td className="px-3 py-3 text-muted-foreground">{employee.tipe_karyawan || '-'}</td>
                        <td className="px-3 py-3">
                          {hasPermission ? (
                            <Select value={selectedRole} onValueChange={(value) => handleRoleChange(employee.id, value)}>
                              <SelectTrigger className="h-8 w-full">
                                <SelectValue placeholder="Pilih peran..." />
                              </SelectTrigger>
                              <SelectContent>
                                {(masterData.room_staff_role || []).map((role) => (
                                  <SelectItem key={role.code} value={role.code}>
                                    {role.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </td>
                        <td className="px-3 py-3 text-right">
                          {hasPermission ? (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleAdd(employee.id, selectedRole)}
                              disabled={addingId === employee.id || !selectedRole || isAssigned}
                              className="h-8"
                              title={isAssigned ? "Pegawai sudah ditugaskan" : ""}
                            >
                              {addingId === employee.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlusCircle className="h-4 w-4 text-green-500" />}
                            </Button>
                          ) : null}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Assigned Column */}
        <div className="min-w-0 space-y-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
              <UserCheck className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h2 className="text-sm font-semibold">
                Ditugaskan ({staff.length})
              </h2>
              <p className="text-xs text-muted-foreground">
                Staff di ruangan ini
              </p>
            </div>
          </div>
          <div className="min-w-0 overflow-hidden rounded-lg border">
            <div className="border-b border-border/70 px-3 py-3">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input value={assignedSearch} onChange={(event) => setAssignedSearch(event.target.value)} placeholder="Cari staff ditugaskan..." className="pl-9" />
              </div>
            </div>
            <div className="max-h-[26rem] overflow-y-auto pb-3">
              <table className="w-full table-fixed text-sm">
                <thead className="sticky top-0 z-10 border-b border-border/70 bg-muted/95 text-left text-[11px] uppercase tracking-[0.18em] text-muted-foreground backdrop-blur">
                  <tr>
                    <th className="w-[28%] px-3 py-2.5 font-medium">Pegawai</th>
                    <th className="w-[14%] px-3 py-2.5 font-medium">NIP</th>
                    <th className="w-[14%] px-3 py-2.5 font-medium">Tipe</th>
                    <th className="w-[18%] px-3 py-2.5 font-medium">Peran</th>
                    <th className="w-[16%] px-3 py-2.5 font-medium">Catatan</th>
                    <th className="w-[10%] px-3 py-2.5 text-right font-medium">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60 bg-background">
                  {filteredAssignedStaff.map((item) => (
                    <tr key={item.id} className="align-top">
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-2">
                          <span className="font-medium break-words">{item.employee?.nama_lengkap || 'Unknown'}</span>
                          {item.is_primary ? <Badge variant="secondary" className="text-[10px] px-1.5">Utama</Badge> : null}
                        </div>
                      </td>
                      <td className="px-3 py-3 font-mono text-muted-foreground">{item.employee?.nip || '-'}</td>
                      <td className="px-3 py-3 text-muted-foreground">{item.employee?.tipe_karyawan || '-'}</td>
                      <td className="px-3 py-3"><Badge variant="outline" className="text-xs">{getRoleTypeName(item.role_type)}</Badge></td>
                      <td className="px-3 py-3 text-muted-foreground break-words">{item.notes || '-'}</td>
                      <td className="px-3 py-3 text-right">
                        {hasPermission ? (
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => handleRemove(item.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
