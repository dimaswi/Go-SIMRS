import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
import { Loader2, Plus, Save, X, DollarSign, Pencil, Trash2, Search } from "lucide-react";
import { ConfirmDialog } from "@/components/confirm-dialog";

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
  const [search, setSearch] = useState("");

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

  const getPatientClassName = (code: string): string => {
    const found = patientClasses.find((item) => item.code === code);
    return found?.name || code;
  };

  const filteredTariffs = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return tariffs;

    return tariffs.filter((tariff) =>
      getPatientClassName(tariff.patient_class).toLowerCase().includes(query)
    );
  }, [search, tariffs, patientClasses]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-w-0 space-y-4 overflow-x-hidden">
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
        <div className="min-w-0 overflow-hidden rounded-lg border">
          {tariffs.length > 0 ? (
            <>
              <div className="border-b border-border/70 px-3 py-3">
                <div className="relative max-w-sm">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Cari kelas pasien..." className="pl-9" />
                </div>
              </div>
            <div className="max-h-[26rem] overflow-y-auto pb-3">
              <table className="w-full table-fixed text-sm">
                <thead className="sticky top-0 z-10 border-b border-border/70 bg-muted/95 text-left text-[11px] uppercase tracking-[0.18em] text-muted-foreground backdrop-blur">
                  <tr>
                    <th className="w-[18%] px-3 py-2.5 font-medium">Kelas</th>
                    <th className="w-[11%] px-3 py-2.5 font-medium">Akomodasi</th>
                    <th className="w-[10%] px-3 py-2.5 font-medium">Makan</th>
                    <th className="w-[11%] px-3 py-2.5 font-medium">Perawatan</th>
                    <th className="w-[11%] px-3 py-2.5 font-medium">Admin</th>
                    <th className="w-[10%] px-3 py-2.5 font-medium">Lainnya</th>
                    <th className="w-[12%] px-3 py-2.5 font-medium">Total</th>
                    <th className="w-[9%] px-3 py-2.5 font-medium">Status</th>
                    <th className="w-[8%] px-3 py-2.5 text-right font-medium">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60 bg-background">
                  {filteredTariffs.map((tariff) => (
                    <tr key={tariff.id} className="align-top">
                      <td className="px-3 py-3 font-medium break-words">{getPatientClassName(tariff.patient_class)}</td>
                      <td className="px-3 py-3 text-muted-foreground break-words">{formatCurrency(tariff.akomodasi)}</td>
                      <td className="px-3 py-3 text-muted-foreground break-words">{formatCurrency(tariff.makan)}</td>
                      <td className="px-3 py-3 text-muted-foreground break-words">{formatCurrency(tariff.perawatan)}</td>
                      <td className="px-3 py-3 text-muted-foreground break-words">{formatCurrency(tariff.administrasi)}</td>
                      <td className="px-3 py-3 text-muted-foreground break-words">{formatCurrency(tariff.lainnya)}</td>
                      <td className="px-3 py-3 font-semibold text-primary break-words">{formatCurrency(calculateTotal(tariff))}</td>
                      <td className="px-3 py-3"><Badge variant={tariff.is_active ? 'default' : 'secondary'} className="text-[10px]">{tariff.is_active ? 'Aktif' : 'Nonaktif'}</Badge></td>
                      <td className="px-3 py-3 text-right">
                        {hasPermission("rooms.update") ? (
                          <div className="flex items-center justify-end gap-1">
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(tariff)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => handleDeleteClick(tariff.id)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            </>
          ) : (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              Belum ada tarif ruangan yang ditetapkan.
            </div>
          )}
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
