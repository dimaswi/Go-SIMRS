import { useState, useEffect, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
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
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/ui/data-table";
import { useToast } from "@/hooks/use-toast";
import { usePermission } from "@/hooks/usePermission";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { setPageTitle } from "@/lib/page-title";
import {
  bpjsApi,
  type BPJSDoctorMapping,
  type BPJSPoliMapping,
  type BPJSReferensiDokter,
  type BPJSJadwalDokter,
} from "@/lib/api/bpjs";
import { employeesApi, type Employee } from "@/lib/api/employees";
import { createDoctorMappingColumns } from "./dokter-columns";
import {
  Loader2,
  Plus,
  RefreshCw,
  UserRound,
  ArrowLeft,
} from "lucide-react";

export default function BPJSDoctorMappingPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const poliMappingIdParam = searchParams.get("poli_mapping_id");

  const { toast } = useToast();
  const { hasPermission } = usePermission();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [mappings, setMappings] = useState<BPJSDoctorMapping[]>([]);
  const [poliMappings, setPoliMappings] = useState<BPJSPoliMapping[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [bpjsDokters, setBpjsDokters] = useState<BPJSReferensiDokter[]>([]);
  const [jadwalDokters, setJadwalDokters] = useState<BPJSJadwalDokter[]>([]);
  const [loadingDokters, setLoadingDokters] = useState(false);
  const [loadingJadwal, setLoadingJadwal] = useState(false);

  // Filter
  const [selectedPoliMapping, setSelectedPoliMapping] = useState<string>(
    poliMappingIdParam || ""
  );

  // Dialog states
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingMapping, setEditingMapping] = useState<BPJSDoctorMapping | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [mappingToDelete, setMappingToDelete] = useState<BPJSDoctorMapping | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    poli_mapping_id: "",
    employee_id: "",
    kode_dokter_bpjs: "",
    nama_dokter_bpjs: "",
    jadwal_hari: "",
    jam_praktek: "",
    kuota_jkn: 0,
    kuota_non_jkn: 0,
    is_active: true,
  });

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [mappingsRes, poliMappingsRes, employeesRes] = await Promise.all([
        bpjsApi.getDoctorMappings(
          selectedPoliMapping
            ? { poli_mapping_id: parseInt(selectedPoliMapping) }
            : undefined
        ),
        bpjsApi.getPoliMappings({ is_active: true }),
        employeesApi.getAll({ tipe_karyawan: "dokter", limit: 200 }),
      ]);
      setMappings(mappingsRes.data.data || []);
      setPoliMappings(poliMappingsRes.data.data || []);
      setEmployees(employeesRes.data.data || []);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error!",
        description: "Gagal memuat data mapping.",
      });
    } finally {
      setLoading(false);
    }
  }, [toast, selectedPoliMapping]);

  const loadBPJSDokters = async () => {
    try {
      setLoadingDokters(true);
      const response = await bpjsApi.getReferensiDokter();
      setBpjsDokters(response.data.data || []);
      toast({
        variant: "success",
        title: "Berhasil!",
        description: `${response.data.count || 0} dokter berhasil diambil dari BPJS.`,
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Gagal mengambil data dokter BPJS",
        description: error.response?.data?.error || error.message,
      });
    } finally {
      setLoadingDokters(false);
    }
  };

  const loadJadwalDokter = async (kodePoli: string) => {
    if (!kodePoli) return;
    try {
      setLoadingJadwal(true);
      const today = new Date().toISOString().split("T")[0];
      const response = await bpjsApi.getJadwalDokter(kodePoli, today);
      setJadwalDokters(response.data.data || []);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Gagal mengambil jadwal dokter",
        description: error.response?.data?.error || error.message,
      });
    } finally {
      setLoadingJadwal(false);
    }
  };

  useEffect(() => {
    setPageTitle("Mapping Dokter BPJS");
    loadData();
  }, [loadData]);

  useEffect(() => {
    // Load jadwal when poli mapping is selected in form
    if (formData.poli_mapping_id) {
      const poliMapping = poliMappings.find(
        (p) => p.id === parseInt(formData.poli_mapping_id)
      );
      if (poliMapping) {
        loadJadwalDokter(poliMapping.kode_poli_bpjs);
      }
    }
  }, [formData.poli_mapping_id, poliMappings]);

  const resetForm = () => {
    setFormData({
      poli_mapping_id: selectedPoliMapping || "",
      employee_id: "",
      kode_dokter_bpjs: "",
      nama_dokter_bpjs: "",
      jadwal_hari: "",
      jam_praktek: "",
      kuota_jkn: 0,
      kuota_non_jkn: 0,
      is_active: true,
    });
    setEditingMapping(null);
    setJadwalDokters([]);
  };

  const handleOpenDialog = (mapping?: BPJSDoctorMapping) => {
    if (mapping) {
      setEditingMapping(mapping);
      setFormData({
        poli_mapping_id: String(mapping.poli_mapping_id),
        employee_id: String(mapping.employee_id),
        kode_dokter_bpjs: mapping.kode_dokter_bpjs,
        nama_dokter_bpjs: mapping.nama_dokter_bpjs,
        jadwal_hari: mapping.jadwal_hari || "",
        jam_praktek: mapping.jam_praktek || "",
        kuota_jkn: mapping.kuota_jkn || 0,
        kuota_non_jkn: mapping.kuota_non_jkn || 0,
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
    if (
      !formData.poli_mapping_id ||
      !formData.employee_id ||
      !formData.kode_dokter_bpjs
    ) {
      toast({
        variant: "destructive",
        title: "Validasi Error",
        description: "Poli, Dokter, dan Kode Dokter BPJS wajib diisi.",
      });
      return;
    }

    try {
      setSaving(true);
      if (editingMapping) {
        await bpjsApi.updateDoctorMapping(editingMapping.id, {
          kode_dokter_bpjs: formData.kode_dokter_bpjs,
          nama_dokter_bpjs: formData.nama_dokter_bpjs,
          jadwal_hari: formData.jadwal_hari,
          jam_praktek: formData.jam_praktek,
          kuota_jkn: formData.kuota_jkn,
          kuota_non_jkn: formData.kuota_non_jkn,
          is_active: formData.is_active,
        });
        toast({
          variant: "success",
          title: "Berhasil!",
          description: "Mapping dokter berhasil diupdate.",
        });
      } else {
        await bpjsApi.createDoctorMapping({
          poli_mapping_id: parseInt(formData.poli_mapping_id),
          employee_id: parseInt(formData.employee_id),
          kode_dokter_bpjs: formData.kode_dokter_bpjs,
          nama_dokter_bpjs: formData.nama_dokter_bpjs,
          jadwal_hari: formData.jadwal_hari,
          jam_praktek: formData.jam_praktek,
          kuota_jkn: formData.kuota_jkn,
          kuota_non_jkn: formData.kuota_non_jkn,
        });
        toast({
          variant: "success",
          title: "Berhasil!",
          description: "Mapping dokter berhasil dibuat.",
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
      await bpjsApi.deleteDoctorMapping(mappingToDelete.id);
      toast({
        variant: "success",
        title: "Berhasil!",
        description: "Mapping dokter berhasil dihapus.",
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

  const handleSelectBPJSDokter = (kodeDokter: string) => {
    const dokter = bpjsDokters.find((d) => String(d.kodedokter) === kodeDokter);
    if (dokter) {
      setFormData({
        ...formData,
        kode_dokter_bpjs: String(dokter.kodedokter),
        nama_dokter_bpjs: dokter.namadokter,
      });
    }
  };

  const handleSelectJadwalDokter = (kodeDokter: string) => {
    const jadwal = jadwalDokters.find((j) => String(j.kodedokter) === kodeDokter);
    if (jadwal) {
      setFormData({
        ...formData,
        kode_dokter_bpjs: String(jadwal.kodedokter),
        nama_dokter_bpjs: jadwal.namadokter,
        jadwal_hari: jadwal.namahari,
        jam_praktek: jadwal.jadwal,
        kuota_jkn: jadwal.kapasitaspasien,
      });
    }
  };

  // Get current poli info
  const currentPoliMapping = poliMappings.find(
    (p) => p.id === parseInt(selectedPoliMapping)
  );

  const columns = createDoctorMappingColumns({
    onEdit: (mapping) => handleOpenDialog(mapping),
    onDelete: (mapping) => {
      setMappingToDelete(mapping);
      setDeleteDialogOpen(true);
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
                  onClick={() => navigate("/bpjs/mapping/poli")}
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <UserRound className="h-5 w-5 text-primary" />
                </div>
                <div className="space-y-1">
                  <CardTitle className="text-base font-semibold">
                    Mapping Dokter BPJS
                  </CardTitle>
                  <CardDescription>
                    Petakan dokter SIMRS dengan kode dokter BPJS untuk antrian online
                    {currentPoliMapping && (
                      <Badge variant="secondary" className="ml-2">
                        {currentPoliMapping.nama_poli_bpjs}
                      </Badge>
                    )}
                  </CardDescription>
                </div>
              </div>
              <div className="flex gap-2">
                <Select
                  value={selectedPoliMapping}
                  onValueChange={(value) => {
                    setSelectedPoliMapping(value);
                    navigate(
                      value
                        ? `/bpjs/mapping/dokter?poli_mapping_id=${value}`
                        : "/bpjs/mapping/dokter"
                    );
                  }}
                >
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="Filter Poli..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Semua Poli</SelectItem>
                    {poliMappings.map((poli) => (
                      <SelectItem key={poli.id} value={String(poli.id)}>
                        {poli.nama_poli_bpjs}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={loadBPJSDokters}
                  disabled={loadingDokters}
                >
                  {loadingDokters ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="mr-2 h-4 w-4" />
                  )}
                  Ambil Dokter BPJS
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
              searchPlaceholder="Cari berdasarkan nama dokter..."
              pageSize={10}
              tableId="bpjs-dokter-mapping"
            />
          </CardContent>
        </Card>
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[550px]">
          <DialogHeader>
            <DialogTitle>
              {editingMapping ? "Edit Mapping Dokter" : "Tambah Mapping Dokter"}
            </DialogTitle>
            <DialogDescription>
              Petakan dokter SIMRS dengan kode dokter BPJS
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto">
            <div className="space-y-2">
              <Label htmlFor="poli">Poli *</Label>
              <Select
                value={formData.poli_mapping_id}
                onValueChange={(value) =>
                  setFormData({ ...formData, poli_mapping_id: value })
                }
                disabled={!!editingMapping}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Pilih poli..." />
                </SelectTrigger>
                <SelectContent>
                  {poliMappings.map((poli) => (
                    <SelectItem key={poli.id} value={String(poli.id)}>
                      {poli.nama_poli_bpjs} ({poli.kode_poli_bpjs})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="employee">Dokter (SIMRS) *</Label>
              <Select
                value={formData.employee_id}
                onValueChange={(value) =>
                  setFormData({ ...formData, employee_id: value })
                }
                disabled={!!editingMapping}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Pilih dokter..." />
                </SelectTrigger>
                <SelectContent>
                  {employees.map((emp) => (
                    <SelectItem key={emp.id} value={String(emp.id)}>
                      {emp.nama_lengkap}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* From BPJS Referensi */}
            {bpjsDokters.length > 0 && (
              <div className="space-y-2">
                <Label>Pilih dari Referensi Dokter BPJS</Label>
                <Select onValueChange={handleSelectBPJSDokter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih dokter dari BPJS..." />
                  </SelectTrigger>
                  <SelectContent>
                    {bpjsDokters.map((dokter) => (
                      <SelectItem
                        key={dokter.kodedokter}
                        value={String(dokter.kodedokter)}
                      >
                        {dokter.kodedokter} - {dokter.namadokter}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* From Jadwal Dokter */}
            {jadwalDokters.length > 0 && (
              <div className="space-y-2">
                <Label>Pilih dari Jadwal Dokter BPJS</Label>
                <Select onValueChange={handleSelectJadwalDokter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih jadwal dokter..." />
                  </SelectTrigger>
                  <SelectContent>
                    {jadwalDokters.map((jadwal, idx) => (
                      <SelectItem
                        key={`${jadwal.kodedokter}-${idx}`}
                        value={String(jadwal.kodedokter)}
                      >
                        {jadwal.namadokter} - {jadwal.namahari} ({jadwal.jadwal})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {loadingJadwal && (
                  <p className="text-xs text-muted-foreground">
                    <Loader2 className="inline h-3 w-3 animate-spin mr-1" />
                    Memuat jadwal...
                  </p>
                )}
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="kode_dokter">Kode Dokter BPJS *</Label>
                <Input
                  id="kode_dokter"
                  value={formData.kode_dokter_bpjs}
                  onChange={(e) =>
                    setFormData({ ...formData, kode_dokter_bpjs: e.target.value })
                  }
                  placeholder="Kode dari BPJS"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="nama_dokter">Nama Dokter BPJS</Label>
                <Input
                  id="nama_dokter"
                  value={formData.nama_dokter_bpjs}
                  onChange={(e) =>
                    setFormData({ ...formData, nama_dokter_bpjs: e.target.value })
                  }
                  placeholder="Nama di BPJS"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="jadwal_hari">Jadwal Hari</Label>
                <Input
                  id="jadwal_hari"
                  value={formData.jadwal_hari}
                  onChange={(e) =>
                    setFormData({ ...formData, jadwal_hari: e.target.value })
                  }
                  placeholder="Senin, Rabu, Jumat"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="jam_praktek">Jam Praktek</Label>
                <Input
                  id="jam_praktek"
                  value={formData.jam_praktek}
                  onChange={(e) =>
                    setFormData({ ...formData, jam_praktek: e.target.value })
                  }
                  placeholder="08:00-12:00"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="kuota_jkn">Kuota JKN</Label>
                <Input
                  id="kuota_jkn"
                  type="number"
                  value={formData.kuota_jkn}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      kuota_jkn: parseInt(e.target.value) || 0,
                    })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="kuota_non_jkn">Kuota Non-JKN</Label>
                <Input
                  id="kuota_non_jkn"
                  type="number"
                  value={formData.kuota_non_jkn}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      kuota_non_jkn: parseInt(e.target.value) || 0,
                    })
                  }
                />
              </div>
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
        title="Hapus Mapping Dokter"
        description={`Apakah Anda yakin ingin menghapus mapping untuk "${mappingToDelete?.employee_name}"?`}
        confirmText="Hapus"
        cancelText="Batal"
        variant="destructive"
      />
    </div>
  );
}
