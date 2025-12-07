import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import { roomsApi, employeesApi, type MasterData, type Employee } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

interface StaffFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  roomId: number;
  masterData: Record<string, MasterData[]>;
  onSuccess: () => void;
}

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
  const [formData, setFormData] = useState({
    employee_id: 0,
    role_type: "",
    is_primary: false,
    notes: "",
  });

  useEffect(() => {
    if (open) {
      loadEmployees();
      setFormData({
        employee_id: 0,
        role_type: "",
        is_primary: false,
        notes: "",
      });
    }
  }, [open]);

  const loadEmployees = async () => {
    setLoadingEmployees(true);
    try {
      // Get employees that have user accounts
      const response = await employeesApi.getAll();
      // Filter only employees with user (has user_id)
      const employeesWithUser = (response.data.data || []).filter((emp: Employee) => emp.user);
      setEmployees(employeesWithUser);
    } catch (error) {
      console.error("Failed to load employees:", error);
    } finally {
      setLoadingEmployees(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.employee_id || !formData.role_type) {
      toast({
        variant: "destructive",
        title: "Error!",
        description: "Silakan pilih pegawai dan peran.",
      });
      return;
    }

    setLoading(true);

    try {
      await roomsApi.assignStaff(roomId, {
        employee_id: formData.employee_id,
        role_type: formData.role_type,
        is_primary: formData.is_primary,
        notes: formData.notes,
      });
      
      toast({
        variant: "success",
        title: "Berhasil!",
        description: "Staff berhasil ditambahkan ke ruangan.",
      });
      onOpenChange(false);
      onSuccess();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error!",
        description: error.response?.data?.error || "Gagal menambahkan staff.",
      });
    } finally {
      setLoading(false);
    }
  };

  const employeeOptions: ComboboxOption[] = employees.map(emp => ({
    value: emp.id.toString(),
    label: `${emp.nama_lengkap} (${emp.nip || 'No NIP'})`,
  }));

  const roleTypeOptions: ComboboxOption[] = (masterData.room_staff_role || []).map(item => ({
    value: item.code,
    label: item.name,
  }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Tambah Staff ke Ruangan</DialogTitle>
          <DialogDescription>
            Pilih pegawai yang akan ditugaskan ke ruangan ini. Hanya pegawai yang memiliki akun pengguna yang dapat ditambahkan.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>Pegawai *</Label>
              {loadingEmployees ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Memuat data pegawai...
                </div>
              ) : (
                <Combobox
                  options={employeeOptions}
                  value={formData.employee_id ? formData.employee_id.toString() : ""}
                  onValueChange={(value) => setFormData({ ...formData, employee_id: parseInt(value) || 0 })}
                  placeholder="Pilih pegawai"
                  searchPlaceholder="Cari pegawai..."
                />
              )}
            </div>
            <div className="space-y-2">
              <Label>Peran di Ruangan *</Label>
              <Combobox
                options={roleTypeOptions}
                value={formData.role_type}
                onValueChange={(value) => setFormData({ ...formData, role_type: value })}
                placeholder="Pilih peran"
                searchPlaceholder="Cari peran..."
              />
            </div>
            <div className="flex items-center gap-3">
              <Switch
                id="is_primary"
                checked={formData.is_primary}
                onCheckedChange={(checked) => setFormData({ ...formData, is_primary: checked })}
              />
              <Label htmlFor="is_primary">Staff Utama</Label>
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">Catatan</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Catatan tambahan..."
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Batal
            </Button>
            <Button type="submit" disabled={loading || loadingEmployees}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Tambah
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
