import { useState, useEffect, useCallback } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DataTable } from "@/components/ui/data-table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import {
  roomsApi,
  masterDataApi,
  type RoomTariff,
  type RoomTariffRequest,
  type MasterData,
} from "@/lib/api";
import { Loader2, Plus, Save, X, DollarSign } from "lucide-react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { createRoomTariffColumns } from "./columns";

const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(value);
};

interface RoomTariffPanelProps {
  roomId: number;
  hasPermission: (permission: string) => boolean;
}

export function RoomTariffPanel({
  roomId,
  hasPermission,
}: RoomTariffPanelProps) {
  const { toast } = useToast();
  const [tariffs, setTariffs] = useState<RoomTariff[]>([]);
  const [patientClasses, setPatientClasses] = useState<MasterData[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form state
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState<RoomTariffRequest>({
    patient_class: "",
    akomodasi: 0,
    makan: 0,
    perawatan: 0,
    administrasi: 0,
    lainnya: 0,
    is_active: true,
  });

  // Delete dialog
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [tariffToDelete, setTariffToDelete] = useState<number | null>(null);

  const loadData = useCallback(async () => {
    try {
      const [tariffRes, masterDataRes] = await Promise.all([
        roomsApi.getTariffs(roomId),
        masterDataApi.getByCategory("patient_class"),
      ]);
      setTariffs(tariffRes.data.data || []);
      setPatientClasses(masterDataRes.data.data || []);
    } catch {
      toast({
        variant: "destructive",
        title: "Error!",
        description: "Gagal memuat data tarif.",
      });
    } finally {
      setLoading(false);
    }
  }, [roomId, toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const resetForm = () => {
    setFormData({
      patient_class: "",
      akomodasi: 0,
      makan: 0,
      perawatan: 0,
      administrasi: 0,
      lainnya: 0,
      is_active: true,
    });
    setIsAdding(false);
    setEditingId(null);
  };

  const handleEdit = (tariff: RoomTariff) => {
    setFormData({
      patient_class: tariff.patient_class,
      akomodasi: tariff.akomodasi,
      makan: tariff.makan,
      perawatan: tariff.perawatan,
      administrasi: tariff.administrasi,
      lainnya: tariff.lainnya,
      is_active: tariff.is_active,
    });
    setEditingId(tariff.id);
    setIsAdding(false);
  };

  const handleSave = async () => {
    if (!formData.patient_class) {
      toast({
        variant: "destructive",
        title: "Error!",
        description: "Pilih kelas pasien terlebih dahulu.",
      });
      return;
    }

    setSaving(true);
    try {
      if (editingId) {
        await roomsApi.updateTariff(roomId, editingId, formData);
        toast({
          title: "Berhasil!",
          description: "Tarif berhasil diperbarui.",
        });
      } else {
        await roomsApi.createTariff(roomId, formData);
        toast({
          title: "Berhasil!",
          description: "Tarif berhasil ditambahkan.",
        });
      }
      resetForm();
      loadData();
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string } } };
      toast({
        variant: "destructive",
        title: "Error!",
        description: err.response?.data?.error || "Gagal menyimpan tarif.",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!tariffToDelete) return;

    try {
      await roomsApi.deleteTariff(roomId, tariffToDelete);
      toast({
        title: "Berhasil!",
        description: "Tarif berhasil dihapus.",
      });
      loadData();
    } catch {
      toast({
        variant: "destructive",
        title: "Error!",
        description: "Gagal menghapus tarif.",
      });
    } finally {
      setDeleteDialogOpen(false);
      setTariffToDelete(null);
    }
  };

  const handleDeleteClick = (id: number) => {
    setTariffToDelete(id);
    setDeleteDialogOpen(true);
  };

  const calculateTotal = (t: RoomTariffRequest | RoomTariff): number => {
    return t.akomodasi + t.makan + t.perawatan + t.administrasi + t.lainnya;
  };

  // Get available patient classes (not yet used)
  const usedClasses = tariffs.map((t) => t.patient_class);
  const availableClasses = patientClasses.filter(
    (c) =>
      c.is_active &&
      (!usedClasses.includes(c.code) ||
        (editingId &&
          tariffs.find((t) => t.id === editingId)?.patient_class === c.code))
  );

  const columns = createRoomTariffColumns({
    onEdit: handleEdit,
    onDelete: handleDeleteClick,
    hasEditPermission: hasPermission("rooms.update"),
    patientClasses,
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Form for Add/Edit */}
      {(isAdding || editingId) && (
        <Card className="border-primary/50 bg-primary/5">
          <CardHeader className="py-3 px-4">
            <CardTitle className="text-sm font-medium">
              {editingId ? "Edit Tarif" : "Tambah Tarif Baru"}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-4">
            {/* Patient Class Selector */}
            <div className="space-y-2">
              <Label>
                Kelas Pasien <span className="text-destructive">*</span>
              </Label>
              <Select
                value={formData.patient_class}
                onValueChange={(value) =>
                  setFormData({ ...formData, patient_class: value })
                }
                disabled={!!editingId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Pilih kelas pasien..." />
                </SelectTrigger>
                <SelectContent>
                  {availableClasses.map((c) => (
                    <SelectItem key={c.id} value={c.code}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Tariff Components Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Akomodasi</Label>
                <Input
                  type="number"
                  value={formData.akomodasi || ""}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      akomodasi: parseFloat(e.target.value) || 0,
                    })
                  }
                  placeholder="0"
                  className="h-9"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Makan</Label>
                <Input
                  type="number"
                  value={formData.makan || ""}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      makan: parseFloat(e.target.value) || 0,
                    })
                  }
                  placeholder="0"
                  className="h-9"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Perawatan</Label>
                <Input
                  type="number"
                  value={formData.perawatan || ""}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      perawatan: parseFloat(e.target.value) || 0,
                    })
                  }
                  placeholder="0"
                  className="h-9"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Administrasi</Label>
                <Input
                  type="number"
                  value={formData.administrasi || ""}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      administrasi: parseFloat(e.target.value) || 0,
                    })
                  }
                  placeholder="0"
                  className="h-9"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Lainnya</Label>
                <Input
                  type="number"
                  value={formData.lainnya || ""}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      lainnya: parseFloat(e.target.value) || 0,
                    })
                  }
                  placeholder="0"
                  className="h-9"
                />
              </div>
            </div>

            {/* Footer with Active Switch and Total */}
            <div className="flex flex-wrap items-center justify-between gap-4 pt-3 border-t">
              <div className="flex items-center space-x-2">
                <Switch
                  id="is_active"
                  checked={formData.is_active}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, is_active: checked })
                  }
                />
                <Label htmlFor="is_active" className="text-sm cursor-pointer">
                  Aktif
                </Label>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-sm">
                  <span className="text-muted-foreground">Total/hari: </span>
                  <span className="font-bold text-primary">
                    {formatCurrency(calculateTotal(formData))}
                  </span>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={resetForm}
                    disabled={saving}
                  >
                    <X className="h-4 w-4 mr-1" />
                    Batal
                  </Button>
                  <Button size="sm" onClick={handleSave} disabled={saving}>
                    {saving ? (
                      <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4 mr-1" />
                    )}
                    Simpan
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tariff Table */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <DollarSign className="h-5 w-5 text-primary" />
            </div>
            <div className="space-y-1">
              <h2 className="text-base font-semibold">
                Tarif Ruangan
              </h2>
              <p className="text-xs text-muted-foreground">
                Tarif per kelas pasien untuk ruangan ini
              </p>
            </div>
          </div>
          {hasPermission("rooms.update") && !isAdding && !editingId && (
            <Button onClick={() => setIsAdding(true)} size="sm">
              <Plus className="h-4 w-4 mr-1" />
              Tambah Tarif
            </Button>
          )}
        </div>
        <div className="rounded-lg border p-6">
          <DataTable
            columns={columns}
            data={tariffs}
            searchPlaceholder="Cari berdasarkan kelas pasien..."
            pageSize={10}
            tableId={`room_tariff_${roomId}`}
          />
        </div>
      </div>

      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Hapus Tarif"
        description="Apakah Anda yakin ingin menghapus tarif ini? Tindakan ini tidak dapat dibatalkan."
        onConfirm={handleDelete}
      />
    </div>
  );
}
