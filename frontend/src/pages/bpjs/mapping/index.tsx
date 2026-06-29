import { Fragment, useState, useEffect, useCallback, useMemo } from "react";
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
import { useToast } from "@/hooks/use-toast";
import { usePermission } from "@/hooks/usePermission";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { setPageTitle } from "@/lib/page-title";
import { cn } from "@/lib/utils";
import {
  bpjsApi,
  type BPJSPoliMapping,
  type BPJSDoctorMapping,
  type BPJSReferensiPoli,
  type BPJSReferensiDokter,
  type BPJSJadwalDokter,
} from "@/lib/api/bpjs";
import { vclaimApi } from "@/lib/api/vclaim";
import { roomsApi, type Room } from "@/lib/api/rooms";
import { employeesApi, type Employee } from "@/lib/api/employees";
import {
  Loader2,
  Plus,
  Building2,
  Edit,
  Trash2,
  Search,
  Users,
  RefreshCw,
  Check,
  ChevronsUpDown,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { BPJSMetricCue, BPJSPageFrame, BPJSSectionPanel } from "../shared-page-chrome";
export default function BPJSMappingPage() {
  const { toast } = useToast();
  const { hasPermission } = usePermission();
  const canManage = hasPermission("integrations.manage");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadingPolis, setLoadingPolis] = useState(false);
  const [loadingDokters, setLoadingDokters] = useState(false);
  const [loadingJadwal, setLoadingJadwal] = useState(false);

  const [poliMappings, setPoliMappings] = useState<BPJSPoliMapping[]>([]);
  const [doctorMappings, setDoctorMappings] = useState<BPJSDoctorMapping[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [bpjsPolis, setBpjsPolis] = useState<BPJSReferensiPoli[]>([]);
  const [bpjsDokters, setBpjsDokters] = useState<BPJSReferensiDokter[]>([]);
  const [jadwalDokters, setJadwalDokters] = useState<BPJSJadwalDokter[]>([]);

  const [selectedPoliMapping] = useState<BPJSPoliMapping | null>(null);
  const [searchPoli, setSearchPoli] = useState("");
  const [expandedPoliIds, setExpandedPoliIds] = useState<number[]>([]);
  const [bpjsPoliOpen, setBpjsPoliOpen] = useState(false);
  const [bpjsPoliQuery, setBpjsPoliQuery] = useState("");
  const [bpjsDokterQuery, setBpjsDokterQuery] = useState("");
  const [doctorSearchDate, setDoctorSearchDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [selectedBPJSDokterKey, setSelectedBPJSDokterKey] = useState("");

  const [poliDialogOpen, setPoliDialogOpen] = useState(false);
  const [editingPoli, setEditingPoli] = useState<BPJSPoliMapping | null>(null);
  const [deletePoliDialogOpen, setDeletePoliDialogOpen] = useState(false);
  const [poliToDelete, setPoliToDelete] = useState<BPJSPoliMapping | null>(null);

  const [dokterDialogOpen, setDokterDialogOpen] = useState(false);
  const [editingDokter, setEditingDokter] = useState<BPJSDoctorMapping | null>(null);
  const [deleteDokterDialogOpen, setDeleteDokterDialogOpen] = useState(false);
  const [dokterToDelete, setDokterToDelete] = useState<BPJSDoctorMapping | null>(null);

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

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [poliRes, dokterRes, roomsRes, employeesRes] = await Promise.all([
        bpjsApi.getPoliMappings(),
        bpjsApi.getDoctorMappings(),
        roomsApi.getAll({ limit: 200 }),
        employeesApi.getAll({ tipe_karyawan: "Dokter", limit: 200 }),
      ]);

      setPoliMappings(poliRes.data.data || []);
      setDoctorMappings(dokterRes.data.data || []);

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

  const loadBPJSPolis = async (query: string) => {
    const normalizedQuery = query.trim();
    if (normalizedQuery.length < 2) {
      setBpjsPolis([]);
      return;
    }

    try {
      setLoadingPolis(true);
      const response = await vclaimApi.searchPoli(normalizedQuery);
      const normalizedPolis: BPJSReferensiPoli[] = (response.data.data || []).map((item) => ({
        kdpoli: item.kode,
        nmpoli: item.nama,
      }));
      setBpjsPolis(normalizedPolis);
    } catch (error: any) {
      setBpjsPolis([]);
      toast({
        variant: "destructive",
        title: "Gagal mengambil data poli BPJS",
        description: error.response?.data?.error || error.message,
      });
    } finally {
      setLoadingPolis(false);
    }
  };

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

  const loadJadwalDokter = async (kodePoli: string, tanggal?: string) => {
    if (!kodePoli) return;
    try {
      setLoadingJadwal(true);
      const response = await bpjsApi.getJadwalDokter(kodePoli, tanggal || doctorSearchDate);
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

  useEffect(() => {
    if (!poliDialogOpen || !bpjsPoliOpen) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      loadBPJSPolis(bpjsPoliQuery);
    }, 300);

    return () => window.clearTimeout(timeoutId);
  }, [bpjsPoliOpen, bpjsPoliQuery, poliDialogOpen]);

  useEffect(() => {
    if (dokterForm.poli_mapping_id) {
      const poliMapping = poliMappings.find(
        (p) => p.id === parseInt(dokterForm.poli_mapping_id)
      );
      if (poliMapping) {
        loadJadwalDokter(poliMapping.kode_poli_bpjs, doctorSearchDate);
      }
    }
  }, [dokterForm.poli_mapping_id, poliMappings, doctorSearchDate]);

  useEffect(() => {
    if (!dokterDialogOpen || bpjsDokters.length > 0) {
      return;
    }

    loadBPJSDokters();
  }, [bpjsDokters.length, dokterDialogOpen]);

  // ========== POLI HANDLERS ==========
  const resetPoliForm = () => {
    setPoliForm({
      room_id: "",
      kode_poli_bpjs: "",
      nama_poli_bpjs: "",
      is_active: true,
    });
    setBpjsPoliQuery("");
    setBpjsPolis([]);
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
    setBpjsDokterQuery("");
    setSelectedBPJSDokterKey("");
    setDoctorSearchDate(new Date().toISOString().split("T")[0]);
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
    setBpjsDokterQuery("");
    setSelectedBPJSDokterKey(
      mapping
        ? `${mapping.kode_dokter_bpjs}::${mapping.jadwal_hari || ""}::${mapping.jam_praktek || ""}`
        : ""
    );
    setDoctorSearchDate(new Date().toISOString().split("T")[0]);
    setDokterDialogOpen(true);
  };

  const handleSelectBPJSDokter = (kodeDokter: string, jadwal?: BPJSJadwalDokter) => {
    if (jadwal) {
      setDokterForm({
        ...dokterForm,
        kode_dokter_bpjs: String(jadwal.kodedokter),
        nama_dokter_bpjs: jadwal.namadokter,
        jadwal_hari: jadwal.namahari,
        jam_praktek: jadwal.jadwal,
        kuota_jkn: jadwal.kapasitaspasien,
      });
      setSelectedBPJSDokterKey(`${jadwal.kodedokter}::${jadwal.namahari}::${jadwal.jadwal}`);
      return;
    }
    const dokter = bpjsDokters.find((d) => String(d.kodedokter) === kodeDokter);
    if (dokter) {
      setDokterForm({
        ...dokterForm,
        kode_dokter_bpjs: String(dokter.kodedokter),
        nama_dokter_bpjs: dokter.namadokter,
      });
      setSelectedBPJSDokterKey(`${dokter.kodedokter}`);
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

  const filteredBpjsDoctorRows = useMemo(() => {
    const query = bpjsDokterQuery.trim().toLowerCase();
    const rows =
      jadwalDokters.length > 0
        ? jadwalDokters.map((dok) => ({
          key: `${dok.kodedokter}::${dok.namahari}::${dok.jadwal}`,
          kode_dokter_bpjs: String(dok.kodedokter),
          nama_dokter_bpjs: dok.namadokter,
          jadwal_hari: dok.namahari,
          jam_praktek: dok.jadwal,
          kuota_jkn: dok.kapasitaspasien,
          kuota_non_jkn: 0,
          sumber: "jadwal" as const,
          raw: dok,
        }))
        : uniqueBpjsDokters.map((dok) => ({
          key: `${dok.kodedokter}`,
          kode_dokter_bpjs: String(dok.kodedokter),
          nama_dokter_bpjs: dok.namadokter,
          jadwal_hari: "",
          jam_praktek: "",
          kuota_jkn: 0,
          kuota_non_jkn: 0,
          sumber: "referensi" as const,
          raw: dok,
        }));

    if (!query) {
      return rows;
    }

    return rows.filter((row) =>
      [
        row.kode_dokter_bpjs,
        row.nama_dokter_bpjs,
        row.jadwal_hari,
        row.jam_praktek,
      ]
        .join(" ")
        .toLowerCase()
        .includes(query)
    );
  }, [bpjsDokterQuery, jadwalDokters, uniqueBpjsDokters]);

  const practiceDayOptions = useMemo(() => {
    if (jadwalDokters.length === 0) {
      const defaultDays = ["SENIN", "SELASA", "RABU", "KAMIS", "JUMAT", "SABTU", "MINGGU"];
      if (dokterForm.jadwal_hari && !defaultDays.includes(dokterForm.jadwal_hari.toUpperCase())) {
        return [dokterForm.jadwal_hari, ...defaultDays];
      }
      return defaultDays;
    }

    const selectedCode = dokterForm.kode_dokter_bpjs;
    const days = Array.from(
      new Set(
        jadwalDokters
          .filter((row) => String(row.kodedokter) === selectedCode)
          .map((row) => row.namahari)
          .filter(Boolean)
      )
    );

    if (dokterForm.jadwal_hari && !days.includes(dokterForm.jadwal_hari)) {
      return [dokterForm.jadwal_hari, ...days];
    }

    return days;
  }, [jadwalDokters, dokterForm.kode_dokter_bpjs, dokterForm.jadwal_hari]);

  const practiceTimeOptions = useMemo(() => {
    if (jadwalDokters.length === 0) {
      return dokterForm.jam_praktek ? [dokterForm.jam_praktek] : [];
    }

    const selectedCode = dokterForm.kode_dokter_bpjs;
    const times = Array.from(
      new Set(
        jadwalDokters
          .filter(
            (row) =>
              String(row.kodedokter) === selectedCode &&
              (!dokterForm.jadwal_hari || row.namahari === dokterForm.jadwal_hari)
          )
          .map((row) => row.jadwal)
          .filter(Boolean)
      )
    );

    if (dokterForm.jam_praktek && !times.includes(dokterForm.jam_praktek)) {
      return [dokterForm.jam_praktek, ...times];
    }

    return times;
  }, [jadwalDokters, dokterForm.kode_dokter_bpjs, dokterForm.jadwal_hari, dokterForm.jam_praktek]);

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

  const togglePoliExpanded = (poliId: number, open: boolean) => {
    setExpandedPoliIds((current) => {
      if (open) {
        return current.includes(poliId) ? current : [...current, poliId];
      }

      return current.filter((id) => id !== poliId);
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <BPJSPageFrame
      title="Mapping Poli & Dokter"
      description="Petakan poli dan dokter SIMRS ke kode BPJS dalam tata letak yang lebih ringkas agar area daftar mapping tetap luas."
      actions={
        <>
          <Button variant="outline" size="sm" onClick={loadData} disabled={loading}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <BPJSMetricCue label="Poli Ter-mapping" value={<span className="text-green-600">{poliMappings.filter(p => p.is_active).length}</span>} hint="Poli aktif yang siap bridging" />
          <BPJSMetricCue label="Belum Di-mapping" value={<span className="text-orange-500">{unmappedPolis.length}</span>} hint="Poli SIMRS yang belum dipasangkan" />
          <BPJSMetricCue label="Dokter Ter-mapping" value={<span className="text-blue-600">{doctorMappings.filter(d => d.is_active).length}</span>} hint="Dokter aktif yang tersambung" />
          <BPJSMetricCue label="Referensi Poli" value="VClaim" hint="Poli dipilih lewat pencarian langsung ke referensi VClaim" />
        </div>

        <BPJSSectionPanel title="Daftar Mapping">
          {/* Search and Add */}
          <div className="mb-4 flex items-center justify-between gap-3">
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

          <div className="-mx-4 max-h-[calc(100vh-18rem)] min-h-[22rem] overflow-auto bg-background sm:-mx-5">
            {filteredPoliMappings.length === 0 ? (
              <div className="flex flex-col items-center justify-center px-4 py-12 text-muted-foreground sm:px-5">
                <Building2 className="mb-4 h-12 w-12 opacity-50" />
                <p className="text-lg font-medium">Belum ada mapping poli</p>
                <p className="text-sm">Klik "Tambah Poli" untuk mulai mapping</p>
              </div>
            ) : (
              <div className="px-4 py-3 sm:px-5">
                <Table containerClassName="rounded-none border border-border/70">
                  <TableHeader>
                    <TableRow className="bg-muted/30">
                      <TableHead>Poliklinik SIMRS</TableHead>
                      <TableHead>Mapping BPJS</TableHead>
                      <TableHead>Ringkasan</TableHead>
                      <TableHead className="text-center">Status</TableHead>
                      {canManage && <TableHead className="w-[180px] text-right">Aksi</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredPoliMappings.map((poli) => {
                      const doctors = getDoctorsForPoli(poli.id);
                      const activeDoctors = doctors.filter((doc) => doc.is_active);
                      const totalKuotaJkn = doctors.reduce((sum, doc) => sum + (doc.kuota_jkn || 0), 0);
                      const totalKuotaNonJkn = doctors.reduce((sum, doc) => sum + (doc.kuota_non_jkn || 0), 0);
                      const isExpanded = expandedPoliIds.includes(poli.id);

                      return (
                        <Fragment key={poli.id}>
                          <TableRow className="align-top hover:bg-muted/20">
                            <TableCell>
                              <button
                                type="button"
                                className="flex w-full items-start gap-2 text-left"
                                onClick={() => togglePoliExpanded(poli.id, !isExpanded)}
                              >
                                {isExpanded ? (
                                  <ChevronDown className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                                ) : (
                                  <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                                )}
                                <div className="space-y-1">
                                  <div className="font-medium text-foreground">{poli.room_name}</div>
                                  <div className="text-xs text-muted-foreground">Room ID: {poli.room_id}</div>
                                </div>
                              </button>
                            </TableCell>
                            <TableCell>
                              <div className="space-y-1.5">
                                <Badge variant="outline" className="font-mono text-xs">
                                  {poli.kode_poli_bpjs}
                                </Badge>
                                <div className="text-sm text-foreground">{poli.nama_poli_bpjs}</div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="space-y-2 text-xs">
                                <div className="flex flex-wrap items-center gap-2">
                                  <Badge variant={activeDoctors.length > 0 ? "default" : "secondary"} className="text-xs">
                                    <Users className="mr-1 h-3 w-3" />
                                    {doctors.length} dokter
                                  </Badge>
                                  <span className="text-muted-foreground">{activeDoctors.length} aktif</span>
                                </div>
                                <div className="text-muted-foreground">
                                  Kuota JKN {totalKuotaJkn} · Non-JKN {totalKuotaNonJkn}
                                </div>
                                <div className="text-muted-foreground">
                                  {isExpanded ? "Klik untuk sembunyikan detail mapping dokter" : "Klik untuk lihat detail mapping dokter"}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="text-center">
                              <Badge
                                variant={poli.is_active ? "default" : "secondary"}
                                className={cn("text-xs", poli.is_active && "bg-green-600 hover:bg-green-600")}
                              >
                                {poli.is_active ? "Aktif" : "Nonaktif"}
                              </Badge>
                            </TableCell>
                            {canManage && (
                              <TableCell>
                                <div className="flex justify-end gap-1.5">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleOpenDokterDialog(undefined, poli)}
                                  >
                                    <Plus className="mr-1.5 h-3.5 w-3.5" />
                                    Dokter
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={() => handleOpenPoliDialog(poli)}
                                  >
                                    <Edit className="h-3.5 w-3.5" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-destructive hover:text-destructive"
                                    onClick={() => {
                                      setPoliToDelete(poli);
                                      setDeletePoliDialogOpen(true);
                                    }}
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                              </TableCell>
                            )}
                          </TableRow>

                          {isExpanded && (
                            <TableRow className="bg-muted/10 hover:bg-muted/10">
                              <TableCell colSpan={canManage ? 5 : 4} className="p-0">
                                <div className="space-y-4 px-4 py-4">
                                  {doctors.length === 0 ? (
                                    <div className="rounded-lg border border-dashed border-border/70 bg-background px-4 py-6 text-center">
                                      <p className="text-sm font-medium text-foreground">Belum ada dokter yang dimapping</p>
                                      <p className="mt-1 text-xs text-muted-foreground">
                                        Tambahkan dokter untuk menghubungkan jadwal dan kuota BPJS pada poli ini.
                                      </p>
                                    </div>
                                  ) : (
                                    <div className="grid gap-3 xl:grid-cols-2">
                                      {doctors.map((doc) => (
                                        <div key={doc.id} className="rounded-lg border border-border/70 bg-background p-4 shadow-sm">
                                          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                            <div className="space-y-1">
                                              <div className="text-sm font-semibold text-foreground">{doc.employee_name}</div>
                                              <div className="text-xs text-muted-foreground">
                                                Dokter BPJS: {doc.nama_dokter_bpjs || "Belum diisi"}
                                              </div>
                                              <div className="text-xs text-muted-foreground">Kode BPJS: {doc.kode_dokter_bpjs}</div>
                                            </div>
                                            <div className="flex flex-wrap items-center gap-2">
                                              <Badge variant={doc.is_active ? "default" : "secondary"} className={cn("text-xs", doc.is_active && "bg-blue-600 hover:bg-blue-600")}>
                                                {doc.is_active ? "Aktif" : "Nonaktif"}
                                              </Badge>
                                              {canManage && (
                                                <>
                                                  <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8"
                                                    onClick={() => handleOpenDokterDialog(doc)}
                                                  >
                                                    <Edit className="h-3.5 w-3.5" />
                                                  </Button>
                                                  <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 text-destructive hover:text-destructive"
                                                    onClick={() => {
                                                      setDokterToDelete(doc);
                                                      setDeleteDokterDialogOpen(true);
                                                    }}
                                                  >
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                  </Button>
                                                </>
                                              )}
                                            </div>
                                          </div>

                                          <div className="mt-4 grid gap-3 md:grid-cols-3">
                                            <div className="rounded-md bg-muted/30 px-3 py-2">
                                              <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Hari Praktik</div>
                                              <div className="mt-1 text-sm font-medium text-foreground">
                                                {doc.jadwal_hari || "Belum diatur"}
                                              </div>
                                            </div>
                                            <div className="rounded-md bg-muted/30 px-3 py-2">
                                              <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Jam Praktik</div>
                                              <div className="mt-1 text-sm font-medium text-foreground">
                                                {doc.jam_praktek || "Belum diatur"}
                                              </div>
                                            </div>
                                            <div className="rounded-md bg-muted/30 px-3 py-2">
                                              <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Kuota</div>
                                              <div className="mt-1 text-sm font-medium text-foreground">
                                                JKN {doc.kuota_jkn || 0} · Non-JKN {doc.kuota_non_jkn || 0}
                                              </div>
                                            </div>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          )}
                        </Fragment>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </BPJSSectionPanel>
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

            <div className="space-y-2">
              <Label>Pilih dari Referensi Poli VClaim</Label>
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
                    <CommandInput
                      placeholder="Ketik minimal 2 huruf nama atau kode poli..."
                      value={bpjsPoliQuery}
                      onValueChange={setBpjsPoliQuery}
                    />
                    <CommandList>
                      <CommandEmpty>
                        {loadingPolis
                          ? "Mencari poli VClaim..."
                          : bpjsPoliQuery.trim().length < 2
                            ? "Ketik minimal 2 huruf untuk mencari poli."
                            : "Poli tidak ditemukan."}
                      </CommandEmpty>
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
                              className={`mr-2 h-4 w-4 ${poliForm.kode_poli_bpjs === poli.kdpoli ? "opacity-100" : "opacity-0"
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
              <p className="text-xs text-muted-foreground">
                Data kode dan nama poli diambil dari endpoint VClaim referensi/poli/[parameter].
              </p>
            </div>

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
        <DialogContent className="max-w-[95vw] h-[95vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>{editingDokter ? "Edit Mapping Dokter" : "Tambah Mapping Dokter"}</DialogTitle>
            <DialogDescription>Petakan dokter SIMRS dengan kode dokter BPJS</DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 lg:grid-cols-[1.3fr_1fr] gap-6 py-4 flex-1 overflow-hidden px-1">
            {/* Kiri: Pilih Dokter SIMRS & Cari Referensi BPJS */}
            <div className="flex flex-col gap-4 overflow-hidden pr-2">
              <div className="grid grid-cols-2 gap-4 flex-none">
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
              </div>

              <div className="space-y-3 rounded-md border p-4 flex-1 flex flex-col min-h-0 bg-muted/5">
                <div className="flex flex-col gap-3 md:flex-row md:items-end flex-none">
                  <div className="space-y-2 md:w-[150px]">
                    <Label>Tanggal Jadwal</Label>
                    <Input
                      type="date"
                      value={doctorSearchDate}
                      onChange={(e) => setDoctorSearchDate(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2 flex-1">
                    <Label>Cari Dokter BPJS</Label>
                    <div className="relative">
                      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        value={bpjsDokterQuery}
                        onChange={(e) => setBpjsDokterQuery(e.target.value)}
                        placeholder="Cari kode, nama..."
                        className="pl-9"
                      />
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      const poliMapping = poliMappings.find(
                        (p) => p.id === parseInt(dokterForm.poli_mapping_id)
                      );
                      if (poliMapping) {
                        loadJadwalDokter(poliMapping.kode_poli_bpjs, doctorSearchDate);
                      }
                    }}
                    disabled={!dokterForm.poli_mapping_id || loadingJadwal}
                  >
                    {loadingJadwal && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Refresh
                  </Button>
                </div>

                <div className="flex items-center justify-between text-sm flex-none">
                  <div className="font-medium">
                    Referensi: {jadwalDokters.length > 0 ? "Jadwal" : "Fallback"}
                  </div>
                  <div className="text-muted-foreground">
                    {filteredBpjsDoctorRows.length} baris
                    {(loadingJadwal || loadingDokters) && <Loader2 className="ml-2 inline h-3.5 w-3.5 animate-spin" />}
                  </div>
                </div>

                <div className="flex-1 overflow-auto rounded-md border bg-background">
                  <Table containerClassName="border-0 rounded-none">
                    <TableHeader className="sticky top-0 bg-background z-10 shadow-sm border-b">
                      <TableRow className="hover:bg-transparent border-b-0">
                        <TableHead className="w-[48px]">Pilih</TableHead>
                        <TableHead>Kode</TableHead>
                        <TableHead>Nama Dokter</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredBpjsDoctorRows.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
                            {loadingJadwal || loadingDokters
                              ? "Memuat dokter BPJS..."
                              : "Tidak ada dokter BPJS."}
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredBpjsDoctorRows.map((row) => {
                          const active = selectedBPJSDokterKey === row.key;
                          return (
                            <TableRow
                              key={row.key}
                              className={cn("cursor-pointer border-b last:border-0", active && "bg-muted/60")}
                              onClick={() =>
                                handleSelectBPJSDokter(
                                  row.kode_dokter_bpjs,
                                  row.sumber === "jadwal" ? (row.raw as BPJSJadwalDokter) : undefined
                                )
                              }
                            >
                              <TableCell>
                                <div className={cn("h-4 w-4 rounded-full border", active && "border-primary bg-primary")} />
                              </TableCell>
                              <TableCell className="font-mono text-xs">{row.kode_dokter_bpjs}</TableCell>
                              <TableCell>{row.nama_dokter_bpjs}</TableCell>
                            </TableRow>
                          );
                        })
                      )}
                    </TableBody>
                  </Table>
                </div>
                {jadwalDokters.length === 0 ? (
                  <p className="text-xs text-muted-foreground mt-1 flex-none">
                    Sistem memakai referensi fallback dokter BPJS.
                  </p>
                ) : null}
              </div>
            </div>

            {/* Kanan: Form Detail Mapping */}
            <div className="flex flex-col gap-4 overflow-y-auto pr-2">
              <div className="space-y-4 rounded-md border p-4 bg-muted/5">
                <h3 className="font-semibold text-sm border-b pb-2">Data BPJS Terpilih</h3>

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

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Hari Praktek</Label>
                    <Select
                      value={dokterForm.jadwal_hari}
                      onValueChange={(value) => {
                        const nextTimeOptions = Array.from(
                          new Set(
                            jadwalDokters
                              .filter(
                                (row) =>
                                  String(row.kodedokter) === dokterForm.kode_dokter_bpjs &&
                                  row.namahari === value
                              )
                              .map((row) => row.jadwal)
                              .filter(Boolean)
                          )
                        );
                        setDokterForm({
                          ...dokterForm,
                          jadwal_hari: value,
                          jam_praktek: nextTimeOptions.includes(dokterForm.jam_praktek)
                            ? dokterForm.jam_praktek
                            : nextTimeOptions[0] || "",
                        });
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Pilih hari..." />
                      </SelectTrigger>
                      <SelectContent>
                        {practiceDayOptions.map((day) => (
                          <SelectItem key={day} value={day}>
                            {day}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Jam Praktek</Label>
                    <Select
                      value={dokterForm.jam_praktek}
                      onValueChange={(value) => setDokterForm({ ...dokterForm, jam_praktek: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Pilih jam..." />
                      </SelectTrigger>
                      <SelectContent>
                        {practiceTimeOptions.length > 0 ? (
                          practiceTimeOptions.map((time) => (
                            <SelectItem key={time} value={time}>
                              {time}
                            </SelectItem>
                          ))
                        ) : (
                          <SelectItem value="-" disabled>
                            Belum ada jam
                          </SelectItem>
                        )}
                      </SelectContent>
                    </Select>
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
                  <div className="flex items-center justify-between pt-2">
                    <Label>Status Aktif</Label>
                    <Switch
                      checked={dokterForm.is_active}
                      onCheckedChange={(checked) => setDokterForm({ ...dokterForm, is_active: checked })}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>

          <DialogFooter className="flex-none pt-2">
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

    </BPJSPageFrame>
  );
}
