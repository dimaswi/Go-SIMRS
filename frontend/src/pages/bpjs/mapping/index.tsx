import { useState, useEffect, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
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
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { usePermission } from "@/hooks/usePermission";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { setPageTitle } from "@/lib/page-title";
import {
  bpjsApi,
  type BPJSPoliMapping,
  type BPJSDoctorMapping,
  type BPJSReferensiPoli,
  type BPJSReferensiDokter,
  type BPJSJadwalDokter,
} from "@/lib/api/bpjs";
import { roomsApi, type Room } from "@/lib/api/rooms";
import { employeesApi, type Employee } from "@/lib/api/employees";
import {
  Loader2,
  Plus,
  Building2,
  Edit,
  Trash2,
  Download,
  Search,
  AlertCircle,
  Clock,
  Users,
  RefreshCw,
  Check,
  ChevronsUpDown,
} from "lucide-react";

export default function BPJSMappingPage() {
  const { toast } = useToast();
  const { hasPermission } = usePermission();
  const canManage = hasPermission("integrations.manage");

  // Loading states
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadingPolis, setLoadingPolis] = useState(false);
  const [loadingDokters, setLoadingDokters] = useState(false);
  const [loadingJadwal, setLoadingJadwal] = useState(false);

  // Data states
  const [poliMappings, setPoliMappings] = useState<BPJSPoliMapping[]>([]);
  const [doctorMappings, setDoctorMappings] = useState<BPJSDoctorMapping[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [bpjsPolis, setBpjsPolis] = useState<BPJSReferensiPoli[]>([]);
  const [bpjsDokters, setBpjsDokters] = useState<BPJSReferensiDokter[]>([]);
  const [jadwalDokters, setJadwalDokters] = useState<BPJSJadwalDokter[]>([]);

  // UI states
  const [selectedPoliMapping] = useState<BPJSPoliMapping | null>(null);
  const [searchPoli, setSearchPoli] = useState("");
  const [bpjsPoliOpen, setBpjsPoliOpen] = useState(false); // Combobox popover state
  const [bpjsDokterOpen, setBpjsDokterOpen] = useState(false); // Combobox popover state

  // Dialog states - Poli
  const [poliDialogOpen, setPoliDialogOpen] = useState(false);
  const [editingPoli, setEditingPoli] = useState<BPJSPoliMapping | null>(null);
  const [deletePoliDialogOpen, setDeletePoliDialogOpen] = useState(false);
  const [poliToDelete, setPoliToDelete] = useState<BPJSPoliMapping | null>(null);

  // Dialog states - Dokter
  const [dokterDialogOpen, setDokterDialogOpen] = useState(false);
  const [editingDokter, setEditingDokter] = useState<BPJSDoctorMapping | null>(null);
  const [deleteDokterDialogOpen, setDeleteDokterDialogOpen] = useState(false);
  const [dokterToDelete, setDokterToDelete] = useState<BPJSDoctorMapping | null>(null);

  // Form states
  const [poliForm, setPoliForm] = useState({
    room_id: "",
    kode_poli_bpjs: "",
    nama_poli_bpjs: "",
    is_active: true,
  });

  const [dokterForm, setDokterForm] = useState({
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

  // Load initial data
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [poliRes, dokterRes, roomsRes, employeesRes] = await Promise.all([
        bpjsApi.getPoliMappings(),
        bpjsApi.getDoctorMappings(),
        roomsApi.getAll({ limit: 200 }),
        employeesApi.getAll({ tipe_karyawan: "dokter", limit: 200 }),
      ]);
      
      setPoliMappings(poliRes.data.data || []);
      setDoctorMappings(dokterRes.data.data || []);
      
      // Filter rooms yang punya jadwal (poliklinik)
      const poliRooms = (roomsRes.data.data || []).filter(
        (r: Room) => r.has_schedule && r.service_type === "rawat_jalan"
      );
      setRooms(poliRooms);
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
  }, [toast]);

  // Load referensi poli dari BPJS
  const loadBPJSPolis = async () => {
    try {
      setLoadingPolis(true);
      const response = await bpjsApi.getReferensiPoli();
      setBpjsPolis(response.data.data || []);
      toast({
        variant: "success",
        title: "Berhasil!",
        description: `${response.data.count || (response.data.data?.length || 0)} poli berhasil diambil dari BPJS.`,
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

  // Load referensi dokter dari BPJS
  const loadBPJSDokters = async () => {
    try {
      setLoadingDokters(true);
      const response = await bpjsApi.getReferensiDokter();
      setBpjsDokters(response.data.data || []);
      toast({
        variant: "success",
        title: "Berhasil!",
        description: `${response.data.count || (response.data.data?.length || 0)} dokter berhasil diambil dari BPJS.`,
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

  // Load jadwal dokter berdasarkan poli
  const loadJadwalDokter = async (kodePoli: string) => {
    if (!kodePoli) return;
    try {
      setLoadingJadwal(true);
      const today = new Date().toISOString().split("T")[0];
      const response = await bpjsApi.getJadwalDokter(kodePoli, today);
      setJadwalDokters(response.data.data || []);
    } catch (error: any) {
      console.error("Failed to load jadwal dokter:", error);
      setJadwalDokters([]);
    } finally {
      setLoadingJadwal(false);
    }
  };

  useEffect(() => {
    setPageTitle("Mapping BPJS");
    loadData();
  }, [loadData]);

  // Load jadwal when poli selected in dokter form
  useEffect(() => {
    if (dokterForm.poli_mapping_id) {
      const poliMapping = poliMappings.find(
        (p) => p.id === parseInt(dokterForm.poli_mapping_id)
      );
      if (poliMapping) {
        loadJadwalDokter(poliMapping.kode_poli_bpjs);
      }
    }
  }, [dokterForm.poli_mapping_id, poliMappings]);

  // ========== POLI HANDLERS ==========
  const resetPoliForm = () => {
    setPoliForm({
      room_id: "",
      kode_poli_bpjs: "",
      nama_poli_bpjs: "",
      is_active: true,
    });
    setEditingPoli(null);
  };

  const handleOpenPoliDialog = (mapping?: BPJSPoliMapping) => {
    if (mapping) {
      setEditingPoli(mapping);
      setPoliForm({
        room_id: String(mapping.room_id),
        kode_poli_bpjs: mapping.kode_poli_bpjs,
        nama_poli_bpjs: mapping.nama_poli_bpjs,
        is_active: mapping.is_active,
      });
    } else {
      resetPoliForm();
    }
    setPoliDialogOpen(true);
  };

  const handleSelectBPJSPoli = (kodePoli: string) => {
    const poli = bpjsPolis.find((p) => p.kdpoli === kodePoli);
    if (poli) {
      setPoliForm({
        ...poliForm,
        kode_poli_bpjs: poli.kdpoli,
        nama_poli_bpjs: poli.nmpoli,
      });
    }
  };

  const handleSubmitPoli = async () => {
    if (!poliForm.room_id || !poliForm.kode_poli_bpjs) {
      toast({
        variant: "destructive",
        title: "Validasi Error",
        description: "Ruangan dan Kode Poli BPJS wajib diisi.",
      });
      return;
    }

    try {
      setSaving(true);
      if (editingPoli) {
        await bpjsApi.updatePoliMapping(editingPoli.id, {
          kode_poli_bpjs: poliForm.kode_poli_bpjs,
          nama_poli_bpjs: poliForm.nama_poli_bpjs,
          is_active: poliForm.is_active,
        });
        toast({ variant: "success", title: "Berhasil!", description: "Mapping poli berhasil diupdate." });
      } else {
        await bpjsApi.createPoliMapping({
          room_id: parseInt(poliForm.room_id),
          kode_poli_bpjs: poliForm.kode_poli_bpjs,
          nama_poli_bpjs: poliForm.nama_poli_bpjs,
        });
        toast({ variant: "success", title: "Berhasil!", description: "Mapping poli berhasil dibuat." });
      }
      setPoliDialogOpen(false);
      resetPoliForm();
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

  const handleDeletePoli = async () => {
    if (!poliToDelete) return;
    try {
      await bpjsApi.deletePoliMapping(poliToDelete.id);
      toast({ variant: "success", title: "Berhasil!", description: "Mapping poli berhasil dihapus." });
      loadData();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error!",
        description: error.response?.data?.error || "Gagal menghapus mapping.",
      });
    } finally {
      setDeletePoliDialogOpen(false);
      setPoliToDelete(null);
    }
  };

  // ========== DOKTER HANDLERS ==========
  const resetDokterForm = () => {
    setDokterForm({
      poli_mapping_id: selectedPoliMapping ? String(selectedPoliMapping.id) : "",
      employee_id: "",
      kode_dokter_bpjs: "",
      nama_dokter_bpjs: "",
      jadwal_hari: "",
      jam_praktek: "",
      kuota_jkn: 0,
      kuota_non_jkn: 0,
      is_active: true,
    });
    setEditingDokter(null);
    setJadwalDokters([]);
  };

  const handleOpenDokterDialog = (mapping?: BPJSDoctorMapping, poliMapping?: BPJSPoliMapping) => {
    if (mapping) {
      setEditingDokter(mapping);
      setDokterForm({
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
      setDokterForm({
        poli_mapping_id: poliMapping ? String(poliMapping.id) : "",
        employee_id: "",
        kode_dokter_bpjs: "",
        nama_dokter_bpjs: "",
        jadwal_hari: "",
        jam_praktek: "",
        kuota_jkn: 0,
        kuota_non_jkn: 0,
        is_active: true,
      });
      setEditingDokter(null);
    }
    setDokterDialogOpen(true);
  };

  const handleSelectBPJSDokter = (kodeDokter: string) => {
    // Try from jadwal first
    const jadwal = jadwalDokters.find((d) => String(d.kodedokter) === kodeDokter);
    if (jadwal) {
      setDokterForm({
        ...dokterForm,
        kode_dokter_bpjs: String(jadwal.kodedokter),
        nama_dokter_bpjs: jadwal.namadokter,
        jadwal_hari: jadwal.namahari,
        jam_praktek: jadwal.jadwal,
        kuota_jkn: jadwal.kapasitaspasien,
      });
      return;
    }
    // Fallback to referensi dokter
    const dokter = bpjsDokters.find((d) => String(d.kodedokter) === kodeDokter);
    if (dokter) {
      setDokterForm({
        ...dokterForm,
        kode_dokter_bpjs: String(dokter.kodedokter),
        nama_dokter_bpjs: dokter.namadokter,
      });
    }
  };

  const handleSubmitDokter = async () => {
    if (!dokterForm.poli_mapping_id || !dokterForm.employee_id || !dokterForm.kode_dokter_bpjs) {
      toast({
        variant: "destructive",
        title: "Validasi Error",
        description: "Poli, Dokter SIMRS, dan Kode Dokter BPJS wajib diisi.",
      });
      return;
    }

    try {
      setSaving(true);
      if (editingDokter) {
        await bpjsApi.updateDoctorMapping(editingDokter.id, {
          kode_dokter_bpjs: dokterForm.kode_dokter_bpjs,
          nama_dokter_bpjs: dokterForm.nama_dokter_bpjs,
          jadwal_hari: dokterForm.jadwal_hari,
          jam_praktek: dokterForm.jam_praktek,
          kuota_jkn: dokterForm.kuota_jkn,
          kuota_non_jkn: dokterForm.kuota_non_jkn,
          is_active: dokterForm.is_active,
        });
        toast({ variant: "success", title: "Berhasil!", description: "Mapping dokter berhasil diupdate." });
      } else {
        await bpjsApi.createDoctorMapping({
          poli_mapping_id: parseInt(dokterForm.poli_mapping_id),
          employee_id: parseInt(dokterForm.employee_id),
          kode_dokter_bpjs: dokterForm.kode_dokter_bpjs,
          nama_dokter_bpjs: dokterForm.nama_dokter_bpjs,
          jadwal_hari: dokterForm.jadwal_hari,
          jam_praktek: dokterForm.jam_praktek,
          kuota_jkn: dokterForm.kuota_jkn,
          kuota_non_jkn: dokterForm.kuota_non_jkn,
        });
        toast({ variant: "success", title: "Berhasil!", description: "Mapping dokter berhasil dibuat." });
      }
      setDokterDialogOpen(false);
      resetDokterForm();
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

  const handleDeleteDokter = async () => {
    if (!dokterToDelete) return;
    try {
      await bpjsApi.deleteDoctorMapping(dokterToDelete.id);
      toast({ variant: "success", title: "Berhasil!", description: "Mapping dokter berhasil dihapus." });
      loadData();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error!",
        description: error.response?.data?.error || "Gagal menghapus mapping.",
      });
    } finally {
      setDeleteDokterDialogOpen(false);
      setDokterToDelete(null);
    }
  };

  // Computed values
  const availableRooms = rooms.filter(
    (room) => !poliMappings.some((m) => m.room_id === room.id) || (editingPoli && editingPoli.room_id === room.id)
  );

  // Deduplikasi poli BPJS berdasarkan kode poli (kdpoli)
  const uniqueBpjsPolis = useMemo(() => {
    const seen = new Map<string, BPJSReferensiPoli>();
    for (const poli of bpjsPolis) {
      if (!seen.has(poli.kdpoli)) {
        seen.set(poli.kdpoli, poli);
      }
    }
    return Array.from(seen.values()).sort((a, b) => a.nmpoli.localeCompare(b.nmpoli));
  }, [bpjsPolis]);

  // Deduplikasi dokter BPJS berdasarkan kode dokter
  const uniqueBpjsDokters = useMemo(() => {
    const seen = new Map<string, BPJSReferensiDokter>();
    for (const dok of bpjsDokters) {
      const kode = String(dok.kodedokter);
      if (!seen.has(kode)) {
        seen.set(kode, dok);
      }
    }
    return Array.from(seen.values()).sort((a, b) => a.namadokter.localeCompare(b.namadokter));
  }, [bpjsDokters]);

  // Hitung poli yang sudah dan belum dimapping
  // Filter rooms yang merupakan poliklinik berdasarkan room_type atau service_type
  const poliklinikRooms = rooms.filter(r => 
    r.room_type?.toLowerCase().includes('poliklinik') || 
    r.room_type?.toLowerCase().includes('poli') ||
    r.service_type?.toLowerCase() === 'rawat jalan' ||
    r.service_type?.toLowerCase() === 'outpatient'
  );
  const mappedRoomIds = new Set(poliMappings.map(m => m.room_id));
  const unmappedPolis = poliklinikRooms.filter(r => !mappedRoomIds.has(r.id));

  const filteredPoliMappings = poliMappings.filter(
    (m) =>
      m.room_name.toLowerCase().includes(searchPoli.toLowerCase()) ||
      m.kode_poli_bpjs.toLowerCase().includes(searchPoli.toLowerCase()) ||
      m.nama_poli_bpjs.toLowerCase().includes(searchPoli.toLowerCase())
  );

  const getDoctorsForPoli = (poliMappingId: number) => {
    return doctorMappings.filter((d) => d.poli_mapping_id === poliMappingId);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col px-4">
      <div className="flex items-center gap-4">
        <div className="flex-1">
          <h1 className="text-lg font-semibold flex items-center gap-2">
            Mapping Poli & Dokter BPJS
          </h1>
          <p className="text-sm text-muted-foreground">
            Petakan ruangan poliklinik dan dokter SIMRS dengan kode BPJS untuk antrian online
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={loadData} disabled={loading}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={loadBPJSPolis} disabled={loadingPolis}>
            {loadingPolis ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
            Sync Poli
          </Button>
          <Button variant="outline" size="sm" onClick={loadBPJSDokters} disabled={loadingDokters}>
            {loadingDokters ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
            Sync Dokter
          </Button>
        </div>
      </div>
      <div className="rounded-lg border p-4">
          {/* Mapping Summary */}
          <div className="grid grid-cols-4 gap-4 mb-4 p-3 bg-muted/30 rounded-lg border">
            <div className="text-center">
              <p className="text-2xl font-bold text-green-600">{poliMappings.filter(p => p.is_active).length}</p>
              <p className="text-xs text-muted-foreground">Poli Ter-mapping</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-orange-500">{unmappedPolis.length}</p>
              <p className="text-xs text-muted-foreground">Belum Di-mapping</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-blue-600">{doctorMappings.filter(d => d.is_active).length}</p>
              <p className="text-xs text-muted-foreground">Dokter Ter-mapping</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold">{bpjsPolis.length}</p>
              <p className="text-xs text-muted-foreground">Ref. Poli BPJS</p>
            </div>
          </div>

          {/* Unmapped Polis Warning */}
          {unmappedPolis.length > 0 && (
            <div className="mb-4 p-3 bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800 rounded-lg">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-orange-500 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-orange-700 dark:text-orange-400">
                    {unmappedPolis.length} poliklinik belum di-mapping dengan BPJS
                  </p>
                  <p className="text-xs text-orange-600 dark:text-orange-500 mt-1">
                    {unmappedPolis.slice(0, 5).map(r => r.name).join(", ")}
                    {unmappedPolis.length > 5 && `, dan ${unmappedPolis.length - 5} lainnya`}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Search and Add */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Cari poli..."
                  className="pl-8 w-[300px]"
                  value={searchPoli}
                  onChange={(e) => setSearchPoli(e.target.value)}
                />
              </div>
              <span className="text-sm text-muted-foreground">
                {poliMappings.length} poli, {doctorMappings.length} dokter
              </span>
            </div>
            {canManage && (
              <Button size="sm" onClick={() => handleOpenPoliDialog()}>
                <Plus className="mr-2 h-4 w-4" />
                Tambah Poli
              </Button>
            )}
          </div>

          {/* Poli List */}
          <ScrollArea className="h-[calc(100vh-300px)]">
            {filteredPoliMappings.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <Building2 className="h-12 w-12 mb-4 opacity-50" />
                <p className="text-lg font-medium">Belum ada mapping poli</p>
                <p className="text-sm">Klik "Tambah Poli" untuk mulai mapping</p>
              </div>
            ) : (
              <Accordion type="multiple" className="w-full">
                {filteredPoliMappings.map((poli) => {
                  const doctors = getDoctorsForPoli(poli.id);
                  return (
                    <AccordionItem key={poli.id} value={String(poli.id)} className="border rounded-lg mb-2 px-0">
                      <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-muted/50 rounded-t-lg">
                        <div className="flex items-center justify-between w-full pr-4">
                          <div className="flex items-center gap-3">
                            <div className="text-left">
                              <div className="flex items-center gap-2">
                                <span className="font-medium">{poli.room_name}</span>
                                <Badge variant="outline" className="font-mono text-xs">
                                  {poli.kode_poli_bpjs}
                                </Badge>
                                {!poli.is_active && (
                                  <Badge variant="secondary" className="text-xs">Nonaktif</Badge>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground">
                                {poli.nama_poli_bpjs}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <Badge variant={doctors.length > 0 ? "default" : "secondary"} className="text-xs">
                              <Users className="mr-1 h-3 w-3" />
                              {doctors.length} dokter
                            </Badge>
                            {canManage && (
                              <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-7 w-7"
                                        onClick={() => handleOpenPoliDialog(poli)}
                                      >
                                        <Edit className="h-3 w-3" />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>Edit Poli</TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-7 w-7 text-destructive hover:text-destructive"
                                        onClick={() => {
                                          setPoliToDelete(poli);
                                          setDeletePoliDialogOpen(true);
                                        }}
                                      >
                                        <Trash2 className="h-3 w-3" />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>Hapus Poli</TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              </div>
                            )}
                          </div>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="px-4 pb-4">
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <h4 className="text-sm font-medium text-muted-foreground">Daftar Dokter</h4>
                            {canManage && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleOpenDokterDialog(undefined, poli)}
                              >
                                <Plus className="mr-2 h-3 w-3" />
                                Tambah Dokter
                              </Button>
                            )}
                          </div>
                          {doctors.length === 0 ? (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground py-4 px-3 bg-muted/30 rounded-lg">
                              <AlertCircle className="h-4 w-4" />
                              Belum ada dokter yang dimapping untuk poli ini
                            </div>
                          ) : (
                            <div className="rounded-lg border">
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead>Dokter SIMRS</TableHead>
                                    <TableHead>Kode BPJS</TableHead>
                                    <TableHead>Nama BPJS</TableHead>
                                    <TableHead>Jadwal</TableHead>
                                    <TableHead>Kuota</TableHead>
                                    <TableHead>Status</TableHead>
                                    {canManage && <TableHead className="w-[80px]">Aksi</TableHead>}
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {doctors.map((doc) => (
                                    <TableRow key={doc.id}>
                                      <TableCell className="font-medium">{doc.employee_name}</TableCell>
                                      <TableCell>
                                        <Badge variant="outline" className="font-mono text-xs">
                                          {doc.kode_dokter_bpjs}
                                        </Badge>
                                      </TableCell>
                                      <TableCell className="text-sm">{doc.nama_dokter_bpjs}</TableCell>
                                      <TableCell>
                                        {doc.jadwal_hari && doc.jam_praktek ? (
                                          <div className="text-xs">
                                            <div className="flex items-center gap-1">
                                              <Clock className="h-3 w-3" />
                                              {doc.jadwal_hari}
                                            </div>
                                            <span className="text-muted-foreground">{doc.jam_praktek}</span>
                                          </div>
                                        ) : (
                                          <span className="text-muted-foreground text-xs">-</span>
                                        )}
                                      </TableCell>
                                      <TableCell>
                                        <span className="text-xs">{doc.kuota_jkn || 0}</span>
                                      </TableCell>
                                      <TableCell>
                                        {doc.is_active ? (
                                          <Badge variant="default" className="bg-green-500 text-xs">Aktif</Badge>
                                        ) : (
                                          <Badge variant="secondary" className="text-xs">Nonaktif</Badge>
                                        )}
                                      </TableCell>
                                      {canManage && (
                                        <TableCell>
                                          <div className="flex gap-1">
                                            <Button
                                              variant="ghost"
                                              size="icon"
                                              className="h-7 w-7"
                                              onClick={() => handleOpenDokterDialog(doc)}
                                            >
                                              <Edit className="h-3 w-3" />
                                            </Button>
                                            <Button
                                              variant="ghost"
                                              size="icon"
                                              className="h-7 w-7 text-destructive hover:text-destructive"
                                              onClick={() => {
                                                setDokterToDelete(doc);
                                                setDeleteDokterDialogOpen(true);
                                              }}
                                            >
                                              <Trash2 className="h-3 w-3" />
                                            </Button>
                                          </div>
                                        </TableCell>
                                      )}
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </div>
                          )}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  );
                })}
              </Accordion>
            )}
          </ScrollArea>
      </div>

      {/* Poli Dialog */}
      <Dialog open={poliDialogOpen} onOpenChange={setPoliDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{editingPoli ? "Edit Mapping Poli" : "Tambah Mapping Poli"}</DialogTitle>
            <DialogDescription>Petakan ruangan poliklinik dengan kode poli BPJS</DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="room">Ruangan Poliklinik *</Label>
              <Select
                value={poliForm.room_id}
                onValueChange={(value) => setPoliForm({ ...poliForm, room_id: value })}
                disabled={!!editingPoli}
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

            {uniqueBpjsPolis.length > 0 && (
              <div className="space-y-2">
                <Label>Pilih dari Referensi BPJS ({uniqueBpjsPolis.length} poli tersedia)</Label>
                <Popover open={bpjsPoliOpen} onOpenChange={setBpjsPoliOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={bpjsPoliOpen}
                      className="w-full justify-between font-normal"
                    >
                      {poliForm.kode_poli_bpjs
                        ? `${poliForm.kode_poli_bpjs} - ${poliForm.nama_poli_bpjs}`
                        : "Cari poli BPJS..."}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[400px] p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Ketik nama atau kode poli..." />
                      <CommandList>
                        <CommandEmpty>Poli tidak ditemukan.</CommandEmpty>
                        <CommandGroup className="max-h-[300px] overflow-y-auto">
                          {uniqueBpjsPolis.map((poli) => (
                            <CommandItem
                              key={poli.kdpoli}
                              value={`${poli.kdpoli} ${poli.nmpoli}`}
                              onSelect={() => {
                                handleSelectBPJSPoli(poli.kdpoli);
                                setBpjsPoliOpen(false);
                              }}
                            >
                              <Check
                                className={`mr-2 h-4 w-4 ${
                                  poliForm.kode_poli_bpjs === poli.kdpoli ? "opacity-100" : "opacity-0"
                                }`}
                              />
                              <span className="font-mono text-xs mr-2">{poli.kdpoli}</span>
                              <span className="truncate">{poli.nmpoli}</span>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="kode_poli">Kode Poli BPJS *</Label>
                <Input
                  id="kode_poli"
                  value={poliForm.kode_poli_bpjs}
                  onChange={(e) => setPoliForm({ ...poliForm, kode_poli_bpjs: e.target.value.toUpperCase() })}
                  placeholder="Contoh: ANA"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="nama_poli">Nama Poli BPJS</Label>
                <Input
                  id="nama_poli"
                  value={poliForm.nama_poli_bpjs}
                  onChange={(e) => setPoliForm({ ...poliForm, nama_poli_bpjs: e.target.value })}
                  placeholder="Contoh: Poli Anak"
                />
              </div>
            </div>

            {editingPoli && (
              <div className="flex items-center justify-between">
                <Label htmlFor="is_active">Status Aktif</Label>
                <Switch
                  id="is_active"
                  checked={poliForm.is_active}
                  onCheckedChange={(checked) => setPoliForm({ ...poliForm, is_active: checked })}
                />
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setPoliDialogOpen(false); resetPoliForm(); }}>
              Batal
            </Button>
            <Button onClick={handleSubmitPoli} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editingPoli ? "Simpan Perubahan" : "Simpan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dokter Dialog */}
      <Dialog open={dokterDialogOpen} onOpenChange={setDokterDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>{editingDokter ? "Edit Mapping Dokter" : "Tambah Mapping Dokter"}</DialogTitle>
            <DialogDescription>Petakan dokter SIMRS dengan kode dokter BPJS</DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>Poli *</Label>
              <Select
                value={dokterForm.poli_mapping_id}
                onValueChange={(value) => setDokterForm({ ...dokterForm, poli_mapping_id: value })}
                disabled={!!editingDokter}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Pilih poli..." />
                </SelectTrigger>
                <SelectContent>
                  {poliMappings.filter(p => p.is_active).map((poli) => (
                    <SelectItem key={poli.id} value={String(poli.id)}>
                      {poli.room_name} ({poli.kode_poli_bpjs})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Dokter SIMRS *</Label>
              <Select
                value={dokterForm.employee_id}
                onValueChange={(value) => setDokterForm({ ...dokterForm, employee_id: value })}
                disabled={!!editingDokter}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Pilih dokter..." />
                </SelectTrigger>
                <SelectContent>
                  {employees.map((emp) => (
                    <SelectItem key={emp.id} value={String(emp.id)}>
                      {emp.nama_lengkap} {emp.spesialisasi ? `(${emp.spesialisasi})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {(jadwalDokters.length > 0 || uniqueBpjsDokters.length > 0) && (
              <div className="space-y-2">
                <Label>
                  Pilih dari {jadwalDokters.length > 0 ? "Jadwal BPJS" : "Referensi BPJS"} 
                  ({jadwalDokters.length > 0 ? jadwalDokters.length : uniqueBpjsDokters.length} tersedia)
                  {loadingJadwal && <Loader2 className="ml-2 h-3 w-3 inline animate-spin" />}
                </Label>
                <Popover open={bpjsDokterOpen} onOpenChange={setBpjsDokterOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={bpjsDokterOpen}
                      className="w-full justify-between font-normal"
                    >
                      {dokterForm.kode_dokter_bpjs
                        ? `${dokterForm.kode_dokter_bpjs} - ${dokterForm.nama_dokter_bpjs}`
                        : "Cari dokter BPJS..."}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[450px] p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Ketik nama atau kode dokter..." />
                      <CommandList>
                        <CommandEmpty>Dokter tidak ditemukan.</CommandEmpty>
                        <CommandGroup className="max-h-[300px] overflow-y-auto">
                          {jadwalDokters.length > 0
                            ? jadwalDokters.map((dok) => (
                                <CommandItem
                                  key={dok.kodedokter}
                                  value={`${dok.kodedokter} ${dok.namadokter}`}
                                  onSelect={() => {
                                    handleSelectBPJSDokter(String(dok.kodedokter));
                                    setBpjsDokterOpen(false);
                                  }}
                                >
                                  <Check
                                    className={`mr-2 h-4 w-4 ${
                                      dokterForm.kode_dokter_bpjs === String(dok.kodedokter) ? "opacity-100" : "opacity-0"
                                    }`}
                                  />
                                  <span className="font-mono text-xs mr-2">{dok.kodedokter}</span>
                                  <span className="truncate">{dok.namadokter} ({dok.namahari}, {dok.jadwal})</span>
                                </CommandItem>
                              ))
                            : uniqueBpjsDokters.map((dok) => (
                                <CommandItem
                                  key={dok.kodedokter}
                                  value={`${dok.kodedokter} ${dok.namadokter}`}
                                  onSelect={() => {
                                    handleSelectBPJSDokter(String(dok.kodedokter));
                                    setBpjsDokterOpen(false);
                                  }}
                                >
                                  <Check
                                    className={`mr-2 h-4 w-4 ${
                                      dokterForm.kode_dokter_bpjs === String(dok.kodedokter) ? "opacity-100" : "opacity-0"
                                    }`}
                                  />
                                  <span className="font-mono text-xs mr-2">{dok.kodedokter}</span>
                                  <span className="truncate">{dok.namadokter}</span>
                                </CommandItem>
                              ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Kode Dokter BPJS *</Label>
                <Input
                  value={dokterForm.kode_dokter_bpjs}
                  onChange={(e) => setDokterForm({ ...dokterForm, kode_dokter_bpjs: e.target.value })}
                  placeholder="Contoh: 12345"
                />
              </div>
              <div className="space-y-2">
                <Label>Nama Dokter BPJS</Label>
                <Input
                  value={dokterForm.nama_dokter_bpjs}
                  onChange={(e) => setDokterForm({ ...dokterForm, nama_dokter_bpjs: e.target.value })}
                  placeholder="Nama di BPJS"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Hari Praktek</Label>
                <Input
                  value={dokterForm.jadwal_hari}
                  onChange={(e) => setDokterForm({ ...dokterForm, jadwal_hari: e.target.value })}
                  placeholder="Contoh: SENIN, RABU"
                />
              </div>
              <div className="space-y-2">
                <Label>Jam Praktek</Label>
                <Input
                  value={dokterForm.jam_praktek}
                  onChange={(e) => setDokterForm({ ...dokterForm, jam_praktek: e.target.value })}
                  placeholder="Contoh: 08:00-12:00"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Kuota JKN</Label>
                <Input
                  type="number"
                  value={dokterForm.kuota_jkn}
                  onChange={(e) => setDokterForm({ ...dokterForm, kuota_jkn: parseInt(e.target.value) || 0 })}
                  placeholder="0"
                />
              </div>
              <div className="space-y-2">
                <Label>Kuota Non-JKN</Label>
                <Input
                  type="number"
                  value={dokterForm.kuota_non_jkn}
                  onChange={(e) => setDokterForm({ ...dokterForm, kuota_non_jkn: parseInt(e.target.value) || 0 })}
                  placeholder="0"
                />
              </div>
            </div>

            {editingDokter && (
              <div className="flex items-center justify-between">
                <Label>Status Aktif</Label>
                <Switch
                  checked={dokterForm.is_active}
                  onCheckedChange={(checked) => setDokterForm({ ...dokterForm, is_active: checked })}
                />
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setDokterDialogOpen(false); resetDokterForm(); }}>
              Batal
            </Button>
            <Button onClick={handleSubmitDokter} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editingDokter ? "Simpan Perubahan" : "Simpan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Poli Confirm */}
      <ConfirmDialog
        open={deletePoliDialogOpen}
        onOpenChange={setDeletePoliDialogOpen}
        onConfirm={handleDeletePoli}
        title="Hapus Mapping Poli"
        description={`Apakah Anda yakin ingin menghapus mapping untuk "${poliToDelete?.room_name}"? Semua mapping dokter di poli ini juga akan terhapus.`}
        confirmText="Hapus"
        cancelText="Batal"
        variant="destructive"
      />

      {/* Delete Dokter Confirm */}
      <ConfirmDialog
        open={deleteDokterDialogOpen}
        onOpenChange={setDeleteDokterDialogOpen}
        onConfirm={handleDeleteDokter}
        title="Hapus Mapping Dokter"
        description={`Apakah Anda yakin ingin menghapus mapping untuk "${dokterToDelete?.employee_name}"?`}
        confirmText="Hapus"
        cancelText="Batal"
        variant="destructive"
      />
    </div>
  );
}
