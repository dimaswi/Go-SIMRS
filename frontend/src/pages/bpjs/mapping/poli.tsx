import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { DataTable } from "@/components/ui/data-table";
import { useToast } from "@/hooks/use-toast";
import { usePermission } from "@/hooks/usePermission";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { setPageTitle } from "@/lib/page-title";
import {
  bpjsApi,
  type BPJSPoliMapping,
  type BPJSReferensiPoli,
} from "@/lib/api/bpjs";
import { roomsApi, type Room } from "@/lib/api/rooms";
import { createPoliMappingColumns } from "./poli-columns";
import {
  Loader2,
  Plus,
  RefreshCw,
  Building2,
  ArrowLeft,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function BPJSPoliMappingPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { hasPermission } = usePermission();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [mappings, setMappings] = useState<BPJSPoliMapping[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [bpjsPolis, setBpjsPolis] = useState<BPJSReferensiPoli[]>([]);
  const [loadingPolis, setLoadingPolis] = useState(false);

  // Dialog states
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingMapping, setEditingMapping] = useState<BPJSPoliMapping | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [mappingToDelete, setMappingToDelete] = useState<BPJSPoliMapping | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    room_id: "",
    kode_poli_bpjs: "",
    nama_poli_bpjs: "",
    is_active: true,
  });

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [mappingsRes, roomsRes] = await Promise.all([
        bpjsApi.getPoliMappings(),
        roomsApi.getAll({ limit: 200 }),
      ]);
      setMappings(mappingsRes.data.data || []);
      // Filter rooms yang punya jadwal (poliklinik)
      const poliRooms = (roomsRes.data.data || []).filter(
        (r: Room) => r.has_schedule && r.service_type === "rawat_jalan"
      );
      setRooms(poliRooms);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error!",
        description: "Gagal memuat data mapping.",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const loadBPJSPolis = async () => {
    try {
      setLoadingPolis(true);
      const response = await bpjsApi.getReferensiPoli();
      setBpjsPolis(response.data.data || []);
      toast({
        variant: "success",
        title: "Berhasil!",
        description: `${response.data.count || 0} poli berhasil diambil dari BPJS.`,
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Gagal mengambil data poli BPJS",
        description: error.response?.data?.error || error.message,
      });
    } finally {
      setLoadingPolis(false);
    }
  };

  useEffect(() => {
    setPageTitle("Mapping Poli BPJS");
    loadData();
  }, [loadData]);

  const resetForm = () => {
    setFormData({
      room_id: "",
      kode_poli_bpjs: "",
      nama_poli_bpjs: "",
      is_active: true,
    });
    setEditingMapping(null);
  };

  const handleOpenDialog = (mapping?: BPJSPoliMapping) => {
    if (mapping) {
      setEditingMapping(mapping);
      setFormData({
        room_id: String(mapping.room_id),
        kode_poli_bpjs: mapping.kode_poli_bpjs,
        nama_poli_bpjs: mapping.nama_poli_bpjs,
        is_active: mapping.is_active,
      });
    } else {
      resetForm();
    }
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    resetForm();
  };

  const handleSubmit = async () => {
    if (!formData.room_id || !formData.kode_poli_bpjs) {
      toast({
        variant: "destructive",
        title: "Validasi Error",
        description: "Ruangan dan Kode Poli BPJS wajib diisi.",
      });
      return;
    }

    try {
      setSaving(true);
      if (editingMapping) {
        await bpjsApi.updatePoliMapping(editingMapping.id, {
          kode_poli_bpjs: formData.kode_poli_bpjs,
          nama_poli_bpjs: formData.nama_poli_bpjs,
          is_active: formData.is_active,
        });
        toast({
          variant: "success",
          title: "Berhasil!",
          description: "Mapping poli berhasil diupdate.",
        });
      } else {
        await bpjsApi.createPoliMapping({
          room_id: parseInt(formData.room_id),
          kode_poli_bpjs: formData.kode_poli_bpjs,
          nama_poli_bpjs: formData.nama_poli_bpjs,
        });
        toast({
          variant: "success",
          title: "Berhasil!",
          description: "Mapping poli berhasil dibuat.",
        });
      }
      handleCloseDialog();
      loadData();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error!",
        description: error.response?.data?.error || "Gagal menyimpan mapping.",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!mappingToDelete) return;

    try {
      await bpjsApi.deletePoliMapping(mappingToDelete.id);
      toast({
        variant: "success",
        title: "Berhasil!",
        description: "Mapping poli berhasil dihapus.",
      });
      loadData();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error!",
        description: error.response?.data?.error || "Gagal menghapus mapping.",
      });
    } finally {
      setDeleteDialogOpen(false);
      setMappingToDelete(null);
    }
  };

  const handleSelectBPJSPoli = (kodePoli: string) => {
    const poli = bpjsPolis.find((p) => p.kdpoli === kodePoli);
    if (poli) {
      setFormData({
        ...formData,
        kode_poli_bpjs: poli.kdpoli,
        nama_poli_bpjs: poli.nmpoli,
      });
    }
  };

  // Get rooms that are not yet mapped
  const availableRooms = rooms.filter(
    (room) => !mappings.some((m) => m.room_id === room.id) || (editingMapping && editingMapping.room_id === room.id)
  );

  const columns = createPoliMappingColumns({
    onEdit: (mapping) => handleOpenDialog(mapping),
    onDelete: (mapping) => {
      setMappingToDelete(mapping);
      setDeleteDialogOpen(true);
    },
    onManageDoctors: (mapping) => {
      navigate(`/bpjs/mapping/dokter?poli_mapping_id=${mapping.id}`);
    },
    hasEditPermission: hasPermission("integrations.manage"),
    hasDeletePermission: hasPermission("integrations.manage"),
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-4 p-6">
      <div className="grid gap-4">
        <Card className="shadow-md">
          <CardHeader className="border-b bg-muted/50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => navigate("/integrations/config")}
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <Building2 className="h-5 w-5 text-primary" />
                </div>
                <div className="space-y-1">
                  <CardTitle className="text-base font-semibold">
                    Mapping Poli BPJS
                  </CardTitle>
                  <CardDescription>
                    Petakan ruangan poliklinik dengan kode poli BPJS untuk antrian online
                  </CardDescription>
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={loadBPJSPolis}
                  disabled={loadingPolis}
                >
                  {loadingPolis ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="mr-2 h-4 w-4" />
                  )}
                  Ambil Poli BPJS
                </Button>
                {hasPermission("integrations.manage") && (
                  <Button size="sm" onClick={() => handleOpenDialog()}>
                    <Plus className="mr-2 h-4 w-4" />
                    Tambah Mapping
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <DataTable
              columns={columns}
              data={mappings}
              searchPlaceholder="Cari berdasarkan nama ruangan atau kode poli..."
              pageSize={10}
              tableId="bpjs-poli-mapping"
            />
          </CardContent>
        </Card>
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>
              {editingMapping ? "Edit Mapping Poli" : "Tambah Mapping Poli"}
            </DialogTitle>
            <DialogDescription>
              Petakan ruangan poliklinik dengan kode poli BPJS
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="room">Ruangan Poliklinik *</Label>
              <Select
                value={formData.room_id}
                onValueChange={(value) =>
                  setFormData({ ...formData, room_id: value })
                }
                disabled={!!editingMapping}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Pilih ruangan..." />
                </SelectTrigger>
                <SelectContent>
                  {availableRooms.map((room) => (
                    <SelectItem key={room.id} value={String(room.id)}>
                      {room.code} - {room.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {bpjsPolis.length > 0 && (
              <div className="space-y-2">
                <Label>Pilih dari Referensi BPJS</Label>
                <Select onValueChange={handleSelectBPJSPoli}>
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih poli dari BPJS..." />
                  </SelectTrigger>
                  <SelectContent>
                    {bpjsPolis.map((poli) => (
                      <SelectItem key={poli.kdpoli} value={poli.kdpoli}>
                        {poli.kdpoli} - {poli.nmpoli}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="kode_poli">Kode Poli BPJS *</Label>
              <Input
                id="kode_poli"
                value={formData.kode_poli_bpjs}
                onChange={(e) =>
                  setFormData({ ...formData, kode_poli_bpjs: e.target.value })
                }
                placeholder="Contoh: ANA, INT, BED"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="nama_poli">Nama Poli BPJS</Label>
              <Input
                id="nama_poli"
                value={formData.nama_poli_bpjs}
                onChange={(e) =>
                  setFormData({ ...formData, nama_poli_bpjs: e.target.value })
                }
                placeholder="Contoh: Poli Anak, Poli Penyakit Dalam"
              />
            </div>

            {editingMapping && (
              <div className="flex items-center justify-between">
                <Label htmlFor="is_active">Status Aktif</Label>
                <Switch
                  id="is_active"
                  checked={formData.is_active}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, is_active: checked })
                  }
                />
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleCloseDialog}>
              Batal
            </Button>
            <Button onClick={handleSubmit} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editingMapping ? "Simpan Perubahan" : "Simpan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm Dialog */}
      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={handleDelete}
        title="Hapus Mapping Poli"
        description={`Apakah Anda yakin ingin menghapus mapping untuk "${mappingToDelete?.room_name}"? Mapping dokter terkait juga akan terhapus.`}
        confirmText="Hapus"
        cancelText="Batal"
        variant="destructive"
      />
    </div>
  );
}
