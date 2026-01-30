import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { useToast } from "@/hooks/use-toast";
import { Loader2, UserCheck, UserX } from "lucide-react";
import { roomsApi, employeesApi, type Employee, type RoomStaff, type MasterData } from "@/lib/api";
import { createStaffColumns } from "./columns";
import { createAvailableStaffColumns } from "./available-columns";

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

  const assignedColumns = createStaffColumns({
    onRemove: handleRemove,
    hasPermission,
    masterData,
  });

  const availableColumns = createAvailableStaffColumns({
    onAdd: handleAdd,
    hasPermission,
    addingId,
    masterData,
    roleSelections,
    onRoleChange: handleRoleChange,
    assignedEmployeeIds,
  });

  if (loadingEmployees) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Two Column Layout */}
      <div className="grid grid-cols-2 gap-4">
        {/* Available Column */}
        <Card className="shadow-md">
          <CardHeader className="py-3 border-b bg-muted/50">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                <UserX className="h-4 w-4 text-primary" />
              </div>
              <div>
                <CardTitle className="text-sm font-semibold">
                  Tersedia ({availableEmployees.length})
                </CardTitle>
                <CardDescription className="text-xs">
                  Semua pegawai
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-4">
            <DataTable
              columns={availableColumns}
              data={availableEmployees}

            />
          </CardContent>
        </Card>

        {/* Assigned Column */}
        <Card className="shadow-md">
          <CardHeader className="py-3 border-b bg-muted/50">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                <UserCheck className="h-4 w-4 text-primary" />
              </div>
              <div>
                <CardTitle className="text-sm font-semibold">
                  Ditugaskan ({staff.length})
                </CardTitle>
                <CardDescription className="text-xs">
                  Staff di ruangan ini
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-4">
            <DataTable
              columns={assignedColumns}
              data={staff}

            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
