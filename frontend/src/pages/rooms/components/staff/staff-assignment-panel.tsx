import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, Minus, Search, User, UserCheck, UserX } from "lucide-react";
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
  const [searchTerm, setSearchTerm] = useState("");
  const [addingId, setAddingId] = useState<number | null>(null);
  const [removingId, setRemovingId] = useState<number | null>(null);
  const [selectedRoleType, setSelectedRoleType] = useState<string>("");

  // Set default role type when master data is available
  useEffect(() => {
    if (!selectedRoleType && masterData.room_staff_role?.length > 0) {
      setSelectedRoleType(masterData.room_staff_role[0].code);
    }
  }, [masterData.room_staff_role, selectedRoleType]);

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

  const assignedEmployeeIds = staff.map((s) => s.employee_id);

  const availableEmployees = employees.filter(
    (emp) =>
      !assignedEmployeeIds.includes(emp.id) &&
      (searchTerm === "" ||
        emp.nama_lengkap.toLowerCase().includes(searchTerm.toLowerCase()) ||
        emp.nip?.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const filteredStaff = staff.filter(
    (s) =>
      searchTerm === "" ||
      s.employee?.nama_lengkap?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.employee?.nip?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleAdd = async (employeeId: number) => {
    if (!selectedRoleType) {
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
        role_type: selectedRoleType,
        is_primary: false,
        notes: "",
      });
      toast({
        variant: "success",
        title: "Berhasil!",
        description: "Staff berhasil ditambahkan ke ruangan.",
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
    setRemovingId(staffId);
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
    } finally {
      setRemovingId(null);
    }
  };

  const roleTypeOptions: ComboboxOption[] = (masterData.room_staff_role || []).map(
    (item) => ({
      value: item.code,
      label: item.name,
    })
  );

  const getRoleTypeName = (code: string) => {
    const role = masterData.room_staff_role?.find((r) => r.code === code);
    return role?.name || code;
  };

  if (loadingEmployees) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search and Role Filter */}
      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Cari nama atau NIP..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        {hasPermission && (
          <div className="w-48">
            <Combobox
              options={roleTypeOptions}
              value={selectedRoleType}
              onValueChange={setSelectedRoleType}
              placeholder="Pilih peran..."
              searchPlaceholder="Cari peran..."
            />
          </div>
        )}
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-2 gap-4">
        {/* Available Column */}
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <UserX className="h-4 w-4" />
              Tersedia ({availableEmployees.length})
            </CardTitle>
            <CardDescription className="text-xs">
              Klik + untuk menambahkan
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[350px]">
              {availableEmployees.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                  <User className="h-8 w-8 mb-2" />
                  <p className="text-sm">Tidak ada pegawai tersedia</p>
                </div>
              ) : (
                <div className="divide-y">
                  {availableEmployees.map((employee) => (
                    <div
                      key={employee.id}
                      className="flex items-center justify-between px-3 py-2 hover:bg-muted/50"
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 shrink-0">
                          <User className="h-4 w-4 text-primary" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-sm truncate">{employee.nama_lengkap}</p>
                          <p className="text-xs text-muted-foreground truncate">
                            {employee.nip || "Tanpa NIP"} • {employee.tipe_karyawan || "-"}
                          </p>
                        </div>
                      </div>
                      {hasPermission && (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 shrink-0"
                          onClick={() => handleAdd(employee.id)}
                          disabled={addingId === employee.id || !selectedRoleType}
                        >
                          {addingId === employee.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Plus className="h-4 w-4" />
                          )}
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Assigned Column */}
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <UserCheck className="h-4 w-4" />
              Ditugaskan ({staff.length})
            </CardTitle>
            <CardDescription className="text-xs">
              Staff di ruangan ini
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[350px]">
              {filteredStaff.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                  <UserCheck className="h-8 w-8 mb-2" />
                  <p className="text-sm">Belum ada staff ditugaskan</p>
                </div>
              ) : (
                <div className="divide-y">
                  {filteredStaff.map((s) => (
                    <div
                      key={s.id}
                      className="flex items-center justify-between px-3 py-2 hover:bg-muted/50"
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-100 shrink-0">
                          <UserCheck className="h-4 w-4 text-green-600" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1">
                            <p className="font-medium text-sm truncate">
                              {s.employee?.nama_lengkap || "Unknown"}
                            </p>
                            {s.is_primary && (
                              <Badge variant="secondary" className="text-[10px] px-1">
                                Utama
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <span className="truncate">{s.employee?.nip || "Tanpa NIP"}</span>
                            <span>•</span>
                            <Badge variant="outline" className="text-[10px] px-1">
                              {getRoleTypeName(s.role_type)}
                            </Badge>
                          </div>
                        </div>
                      </div>
                      {hasPermission && (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 shrink-0 text-destructive hover:text-destructive"
                          onClick={() => handleRemove(s.id)}
                          disabled={removingId === s.id}
                        >
                          {removingId === s.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Minus className="h-4 w-4" />
                          )}
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
