import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { usePermission } from "@/hooks/usePermission";
import { useToast } from "@/hooks/use-toast";
import { setPageTitle } from "@/lib/page-title";
import { buildingsApi, type Building } from "@/lib/api";
import {
  Loader2,
  Plus,
  Pencil,
  Trash2,
  Building2,
  MapPin,
  LayoutGrid,
} from "lucide-react";

const DEFAULT_COLORS = [
  "#e3f2fd", "#e8f5e9", "#fff3e0", "#fce4ec", "#f3e5f5",
  "#e0f7fa", "#f1f8e9", "#fffde7", "#efebe9", "#eceff1",
];

interface BuildingFormData {
  code: string;
  name: string;
  total_floors: number;
  description: string;
  color: string;
  is_active: boolean;
}

const emptyForm: BuildingFormData = {
  code: "",
  name: "",
  total_floors: 1,
  description: "",
  color: "#e3f2fd",
  is_active: true,
};

export default function BuildingsPage() {
  const navigate = useNavigate();
  const { hasPermission } = usePermission();
  const { toast } = useToast();

  const [buildings, setBuildings] = useState<Building[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<BuildingFormData>(emptyForm);

  // Delete state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [buildingToDelete, setBuildingToDelete] = useState<number | null>(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await buildingsApi.getAll();
      setBuildings(res.data.data || []);
    } catch {
      toast({ variant: "destructive", title: "Error", description: "Gagal memuat data gedung" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    setPageTitle("Gedung");
    loadData();
  }, [loadData]);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (b: Building) => {
    setEditingId(b.id);
    setForm({
      code: b.code,
      name: b.name,
      total_floors: b.total_floors,
      description: b.description || "",
      color: b.color || "#e3f2fd",
      is_active: b.is_active,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.code.trim() || !form.name.trim()) {
      toast({ variant: "destructive", title: "Validasi", description: "Kode dan nama gedung wajib diisi" });
      return;
    }

    try {
      setSaving(true);
      if (editingId) {
        await buildingsApi.update(editingId, form);
        toast({ title: "Berhasil", description: "Gedung berhasil diperbarui" });
      } else {
        await buildingsApi.create(form);
        toast({ title: "Berhasil", description: "Gedung berhasil ditambahkan" });
      }
      setDialogOpen(false);
      loadData();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.response?.data?.error || "Gagal menyimpan gedung",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (id: number) => {
    setBuildingToDelete(id);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!buildingToDelete) return;
    try {
      await buildingsApi.delete(buildingToDelete);
      toast({ title: "Berhasil", description: "Gedung berhasil dihapus" });
      loadData();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.response?.data?.error || "Gagal menghapus gedung",
      });
    } finally {
      setDeleteDialogOpen(false);
      setBuildingToDelete(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-4 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Gedung</h1>
          <p className="text-sm text-muted-foreground">
            Kelola data gedung rumah sakit untuk Floor Plan
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => navigate("/floor-plan")}>
            <LayoutGrid className="mr-2 h-4 w-4" />
            Lihat Floor Plan
          </Button>
          {hasPermission("rooms.create") && (
            <Button size="sm" onClick={openCreate}>
              <Plus className="mr-2 h-4 w-4" />
              Tambah Gedung
            </Button>
          )}
        </div>
      </div>

      {/* Building cards */}
      {buildings.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <Building2 className="h-16 w-16 mb-4" />
          <p className="text-lg font-medium mb-1">Belum ada gedung</p>
          <p className="text-sm mb-4">Tambahkan gedung pertama untuk mulai mengatur floor plan</p>
          {hasPermission("rooms.create") && (
            <Button onClick={openCreate}>
              <Plus className="mr-2 h-4 w-4" />
              Tambah Gedung
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {buildings.map((b) => (
            <Card
              key={b.id}
              className="overflow-hidden hover:shadow-md transition-shadow"
            >
              {/* Color banner */}
              <div
                className="h-3"
                style={{ backgroundColor: b.color || "#e3f2fd" }}
              />
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                      <h3 className="font-semibold text-sm truncate">{b.name}</h3>
                    </div>
                    <p className="text-xs text-muted-foreground font-mono mt-0.5">{b.code}</p>
                  </div>
                  <Badge variant={b.is_active ? "default" : "secondary"} className="text-[10px] shrink-0">
                    {b.is_active ? "Aktif" : "Nonaktif"}
                  </Badge>
                </div>

                {b.description && (
                  <p className="text-xs text-muted-foreground mb-3 line-clamp-2">{b.description}</p>
                )}

                {/* Stats */}
                <div className="grid grid-cols-3 gap-2 mb-3">
                  <div className="text-center bg-muted/50 rounded p-1.5">
                    <p className="text-lg font-bold">{b.total_floors}</p>
                    <p className="text-[10px] text-muted-foreground">Lantai</p>
                  </div>
                  <div className="text-center bg-muted/50 rounded p-1.5">
                    <p className="text-lg font-bold">{b.total_rooms || 0}</p>
                    <p className="text-[10px] text-muted-foreground">Ruangan</p>
                  </div>
                  <div className="text-center bg-muted/50 rounded p-1.5">
                    <p className="text-lg font-bold">
                      <span className="text-green-600">{b.available_beds || 0}</span>
                      <span className="text-muted-foreground text-xs">/{b.total_beds || 0}</span>
                    </p>
                    <p className="text-[10px] text-muted-foreground">Bed Kosong</p>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-1.5">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 h-7 text-xs"
                    onClick={() => navigate(`/floor-plan?building=${b.id}`)}
                  >
                    <MapPin className="h-3 w-3 mr-1" />
                    Floor Plan
                  </Button>
                  {hasPermission("rooms.update") && (
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => openEdit(b)}
                    >
                      <Pencil className="h-3 w-3" />
                    </Button>
                  )}
                  {hasPermission("rooms.delete") && (
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-7 w-7 text-destructive hover:text-destructive"
                      onClick={() => handleDelete(b.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Gedung" : "Tambah Gedung"}</DialogTitle>
            <DialogDescription>
              {editingId
                ? "Perbarui informasi gedung"
                : "Tambahkan gedung baru ke rumah sakit"}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="code">Kode Gedung *</Label>
                <Input
                  id="code"
                  placeholder="GD-01"
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="total_floors">Jumlah Lantai</Label>
                <Input
                  id="total_floors"
                  type="number"
                  min={1}
                  value={form.total_floors}
                  onChange={(e) => setForm({ ...form, total_floors: Number(e.target.value) || 1 })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">Nama Gedung *</Label>
              <Input
                id="name"
                placeholder="Gedung Utama"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Deskripsi</Label>
              <Textarea
                id="description"
                placeholder="Deskripsi gedung (opsional)"
                value={form.description}
                rows={2}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label>Warna Gedung</Label>
              <div className="flex gap-2 flex-wrap">
                {DEFAULT_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    className="w-8 h-8 rounded-md border-2 transition-all"
                    style={{
                      backgroundColor: c,
                      borderColor: form.color === c ? "#2563eb" : "transparent",
                      transform: form.color === c ? "scale(1.15)" : "scale(1)",
                    }}
                    onClick={() => setForm({ ...form, color: c })}
                  />
                ))}
                <Input
                  type="color"
                  className="w-8 h-8 p-0 border-0 cursor-pointer rounded-md"
                  value={form.color}
                  onChange={(e) => setForm({ ...form, color: e.target.value })}
                />
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="is_active"
                checked={form.is_active}
                onCheckedChange={(checked) => setForm({ ...form, is_active: checked })}
              />
              <Label htmlFor="is_active">Aktif</Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Batal
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingId ? "Simpan" : "Tambah"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={confirmDelete}
        title="Hapus Gedung"
        description="Apakah Anda yakin ingin menghapus gedung ini? Semua ruangan yang terkait akan di-unassign."
        confirmText="Hapus"
        cancelText="Batal"
        variant="destructive"
      />
    </div>
  );
}
