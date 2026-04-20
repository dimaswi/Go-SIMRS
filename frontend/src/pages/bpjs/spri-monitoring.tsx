import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Collapsible,
  CollapsibleContent,
} from "@/components/ui/collapsible";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet";
import { useToast } from "@/hooks/use-toast";
import { setPageTitle } from "@/lib/page-title";
import {
  Loader2,
  RefreshCw,
  Search,
  Printer,
  Pencil,
  Trash2,
  FileText,
  SlidersHorizontal,
  X,
  Eye,
  Save,
  Send,
  CloudOff,
  UserCheck,
  ShieldCheck,
} from "lucide-react";
import { vclaimApi, type SPRILocal } from "@/lib/api/vclaim";
import { printApi } from "@/lib/api/print";
import { PoliDokterSelector } from "@/components/sep/poli-dokter-selector";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { cn } from "@/lib/utils";

const statusConfig: Record<string, { label: string; variant: string; className: string }> = {
  active: { label: "Aktif", variant: "outline", className: "bg-green-50 text-green-700 border-green-200" },
  draft: { label: "Draft Lokal", variant: "outline", className: "bg-amber-50 text-amber-700 border-amber-200" },
  terdaftar: { label: "Terdaftar", variant: "outline", className: "bg-purple-50 text-purple-700 border-purple-200" },
  sep_created: { label: "SEP Dibuat", variant: "outline", className: "bg-indigo-50 text-indigo-700 border-indigo-200" },
  used: { label: "Digunakan", variant: "outline", className: "bg-blue-50 text-blue-700 border-blue-200" },
  cancelled: { label: "Dibatalkan", variant: "outline", className: "bg-red-50 text-red-700 border-red-200" },
};

export default function SPRIMonitoringPage() {
  const { toast } = useToast();

  const [loading, setLoading] = useState(false);
  const [spriList, setSpriList] = useState<SPRILocal[]>([]);
  const [filterOpen, setFilterOpen] = useState(false);

  // Filters
  const today = format(new Date(), "yyyy-MM-dd");
  const [tglTerbitFrom, setTglTerbitFrom] = useState(today);
  const [tglTerbitTo, setTglTerbitTo] = useState(today);
  const [tglKontrolFrom, setTglKontrolFrom] = useState("");
  const [tglKontrolTo, setTglKontrolTo] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");

  // Detail dialog
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedSPRI, setSelectedSPRI] = useState<SPRILocal | null>(null);

  // Delete confirm
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletingSPRI, setDeletingSPRI] = useState<SPRILocal | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Edit sheet
  const [editOpen, setEditOpen] = useState(false);
  const [editingSPRI, setEditingSPRI] = useState<SPRILocal | null>(null);
  const [editForm, setEditForm] = useState({ tgl_rencana_kontrol: "", kode_poli: "", nama_poli: "", kode_dokter: "", nama_dokter: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setPageTitle("Monitoring SPRI");
    loadData();
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = {};
      if (tglTerbitFrom) params.tgl_terbit_from = tglTerbitFrom;
      if (tglTerbitTo) params.tgl_terbit_to = tglTerbitTo;
      if (tglKontrolFrom) params.tgl_kontrol_from = tglKontrolFrom;
      if (tglKontrolTo) params.tgl_kontrol_to = tglKontrolTo;
      if (statusFilter !== "all") params.status = statusFilter;
      if (search.trim()) params.search = search.trim();
      params.limit = 500;

      const resp = await vclaimApi.getSPRIList(params as any);
      setSpriList(resp.data.data || []);
    } catch {
      toast({ variant: "destructive", title: "Error", description: "Gagal memuat data SPRI" });
    } finally {
      setLoading(false);
    }
  }, [tglTerbitFrom, tglTerbitTo, tglKontrolFrom, tglKontrolTo, statusFilter, search, toast]);

  const handleSearch = () => loadData();
  const handleReset = () => {
    setTglTerbitFrom(today);
    setTglTerbitTo(today);
    setTglKontrolFrom("");
    setTglKontrolTo("");
    setStatusFilter("all");
    setSearch("");
  };

  const handleOpenDetail = (spri: SPRILocal) => {
    setSelectedSPRI(spri);
    setDetailOpen(true);
  };

  const handlePrint = (spri: SPRILocal) => {
    printApi.spri(spri.id);
  };

  const handleConfirmDelete = (spri: SPRILocal) => {
    setDeletingSPRI(spri);
    setDeleteOpen(true);
  };

  // === Edit Sheet handlers ===
  const handleOpenEdit = (spri: SPRILocal) => {
    setEditingSPRI(spri);
    setEditForm({
      tgl_rencana_kontrol: spri.tgl_rencana_kontrol || "",
      kode_poli: spri.kode_poli || "",
      nama_poli: spri.nama_poli || "",
      kode_dokter: spri.kode_dokter || "",
      nama_dokter: spri.nama_dokter || "",
    });
    setEditOpen(true);
  };

  // BPJS API search handlers for PoliDokterSelector
  const handleSearchPoliBPJS = async (keyword: string) => {
    try {
      const res = await vclaimApi.searchPoliSPRI(keyword);
      return res.data.data || [];
    } catch {
      return [];
    }
  };

  const handleSearchDokterBPJS = async (_keyword: string) => {
    if (!editForm.kode_poli || !editForm.tgl_rencana_kontrol) {
      toast({ variant: "destructive", title: "Error", description: "Pilih poli dan tanggal terlebih dahulu" });
      return [];
    }
    try {
      const res = await vclaimApi.searchDokterSPRI(editForm.kode_poli, editForm.tgl_rencana_kontrol);
      const doctors = res.data.data || [];
      if (_keyword) {
        return doctors.filter((d) => d.nama.toLowerCase().includes(_keyword.toLowerCase()));
      }
      return doctors;
    } catch {
      return [];
    }
  };

  const handleSaveEdit = async () => {
    if (!editingSPRI) return;
    if (!editForm.tgl_rencana_kontrol || !editForm.kode_poli || !editForm.kode_dokter) {
      toast({ variant: "destructive", title: "Error", description: "Tanggal, Poli, dan Dokter wajib diisi" });
      return;
    }
    setSaving(true);
    try {
      await vclaimApi.updateSPRI(editingSPRI.no_spri, {
        kode_dokter: editForm.kode_dokter,
        nama_dokter: editForm.nama_dokter,
        poli_kontrol: editForm.kode_poli,
        nama_poli: editForm.nama_poli,
        tgl_rencana_kontrol: editForm.tgl_rencana_kontrol,
      });
      toast({ title: "Berhasil", description: "SPRI berhasil diupdate" });
      setEditOpen(false);
      setEditingSPRI(null);
      loadData();
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error", description: error.response?.data?.error || "Gagal mengupdate SPRI" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingSPRI) return;
    setDeleting(true);
    try {
      await vclaimApi.deleteSPRI(deletingSPRI.no_spri);
      toast({ title: "Berhasil", description: "SPRI berhasil dihapus dari BPJS dan database lokal" });
      setDeleteOpen(false);
      setDeletingSPRI(null);
      loadData();
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error", description: error.response?.data?.error || "Gagal menghapus SPRI" });
    } finally {
      setDeleting(false);
    }
  };

  const getStatusBadge = (spri: SPRILocal) => {
    // SPRI lokal yang masih aktif ditampilkan sebagai "Draft Lokal"
    const baseKey = (spri.status === "active" && spri.is_bpjs === false) ? "draft" : spri.status;

    // Tentukan status efektif berdasarkan enrichment data rawat inap
    let effectiveKey = baseKey;
    if (baseKey === "active" && spri.inpatient_sep_id) {
      effectiveKey = "sep_created";
    } else if (baseKey === "active" && spri.inpatient_registration_id) {
      effectiveKey = "terdaftar";
    }

    const cfg = statusConfig[effectiveKey] || { label: spri.status, className: "bg-gray-50 text-gray-600 border-gray-200" };
    return (
      <div className="flex flex-col items-center gap-0.5">
        <Badge variant="outline" className={cn("text-[10px]", cfg.className)}>{cfg.label}</Badge>
        {/* Sub-badges: tampilkan info detail pendaftaran dan SEP */}
        {spri.inpatient_registration_id && !spri.inpatient_sep_id && effectiveKey !== "terdaftar" && (
          <Badge variant="outline" className="text-[9px] bg-purple-50 text-purple-600 border-purple-200">
            <UserCheck className="h-2.5 w-2.5 mr-0.5" />Terdaftar
          </Badge>
        )}
        {spri.inpatient_sep_id && effectiveKey !== "sep_created" && (
          <Badge variant="outline" className="text-[9px] bg-indigo-50 text-indigo-600 border-indigo-200">
            <ShieldCheck className="h-2.5 w-2.5 mr-0.5" />SEP
          </Badge>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-1 flex-col px-4 gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Monitoring SPRI</h1>
          <p className="text-sm text-muted-foreground">Pantau Surat Perintah Rawat Inap berdasarkan tanggal</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={loadData} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            <span className="ml-2">Refresh</span>
          </Button>
          <Button variant="outline" size="sm" className="h-9" onClick={() => setFilterOpen(!filterOpen)}>
            <SlidersHorizontal className="h-4 w-4 mr-2" />
            Filter
          </Button>
        </div>
      </div>

      {/* Filter Panel */}
      <Collapsible open={filterOpen} onOpenChange={setFilterOpen}>
        <CollapsibleContent>
          <div className="p-4 border rounded-lg mt-2 flex flex-wrap items-end gap-4">
            <div className="space-y-1">
              <Label className="text-xs">Tanggal Terbit (Dari)</Label>
              <Input type="date" value={tglTerbitFrom} onChange={e => setTglTerbitFrom(e.target.value)} className="h-9" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Tanggal Terbit (Sampai)</Label>
              <Input type="date" value={tglTerbitTo} onChange={e => setTglTerbitTo(e.target.value)} className="h-9" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Tanggal SPRI/Masuk (Dari)</Label>
              <Input type="date" value={tglKontrolFrom} onChange={e => setTglKontrolFrom(e.target.value)} className="h-9" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Tanggal SPRI/Masuk (Sampai)</Label>
              <Input type="date" value={tglKontrolTo} onChange={e => setTglKontrolTo(e.target.value)} className="h-9" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Status</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[140px] h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Status</SelectItem>
                  <SelectItem value="active">Aktif</SelectItem>
                  <SelectItem value="draft">Draft Lokal</SelectItem>
                  <SelectItem value="terdaftar">Terdaftar</SelectItem>
                  <SelectItem value="sep_created">SEP Dibuat</SelectItem>
                  <SelectItem value="used">Digunakan</SelectItem>
                  <SelectItem value="cancelled">Dibatalkan</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Cari (No. Kartu / Nama)</Label>
              <Input
                placeholder="Cari..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleSearch()}
                className="h-9 w-48"
              />
            </div>
            <Button onClick={handleSearch} disabled={loading} size="sm" className="h-9">
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
              Cari
            </Button>
            <Button variant="outline" size="sm" className="h-9" onClick={handleReset}>
              <X className="mr-2 h-4 w-4" />
              Reset
            </Button>
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Result Summary */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {loading ? "Memuat..." : `${spriList.length} SPRI ditemukan`}
        </p>
      </div>

      {/* Table */}
      <div className="rounded-lg border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="w-12 text-center">#</TableHead>
              <TableHead>No. SPRI</TableHead>
              <TableHead>Nama / No. Kartu</TableHead>
              <TableHead>Tgl Terbit</TableHead>
              <TableHead>Tgl Rencana Masuk</TableHead>
              <TableHead>Poli</TableHead>
              <TableHead>Dokter DPJP</TableHead>
              <TableHead>Diagnosa</TableHead>
              <TableHead className="text-center">Status</TableHead>
              <TableHead className="text-center">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={10} className="text-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                  <p className="text-sm text-muted-foreground mt-2">Memuat data...</p>
                </TableCell>
              </TableRow>
            ) : spriList.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="text-center py-12">
                  <FileText className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
                  <p className="text-sm text-muted-foreground">Tidak ada data SPRI</p>
                  <p className="text-xs text-muted-foreground">Coba ubah filter pencarian</p>
                </TableCell>
              </TableRow>
            ) : (
              spriList.map((spri, idx) => (
                <TableRow key={spri.id} className="hover:bg-muted/30">
                  <TableCell className="text-center text-muted-foreground text-sm">{idx + 1}</TableCell>
                  <TableCell>
                    {spri.is_bpjs ? (
                      <span className="font-mono text-sm font-semibold text-green-700">{spri.no_spri}</span>
                    ) : (
                      <div className="flex items-center gap-1">
                        <CloudOff className="h-3.5 w-3.5 text-amber-500" />
                        <span className="text-sm font-medium text-amber-600 italic">Draft Lokal</span>
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <p className="font-medium text-sm">{spri.nama || "-"}</p>
                    <p className="text-xs text-muted-foreground font-mono">{spri.no_kartu}</p>
                  </TableCell>
                  <TableCell className="text-sm">
                    {spri.created_at
                      ? format(new Date(spri.created_at), "dd/MM/yyyy", { locale: idLocale })
                      : "-"}
                  </TableCell>
                  <TableCell className="text-sm font-medium">
                    {spri.tgl_rencana_kontrol
                      ? format(new Date(spri.tgl_rencana_kontrol), "dd/MM/yyyy", { locale: idLocale })
                      : "-"}
                  </TableCell>
                  <TableCell className="text-sm max-w-[120px]">
                    <p className="truncate">{spri.nama_poli || spri.kode_poli || "-"}</p>
                  </TableCell>
                  <TableCell className="text-sm max-w-[120px]">
                    <p className="truncate">{spri.nama_dokter || spri.kode_dokter || "-"}</p>
                  </TableCell>
                  <TableCell className="text-sm max-w-[140px]">
                    <p className="truncate text-xs text-muted-foreground">{spri.nama_diagnosa || "-"}</p>
                  </TableCell>
                  <TableCell className="text-center">{getStatusBadge(spri)}</TableCell>
                  <TableCell>
                    <div className="flex items-center justify-center gap-1">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleOpenDetail(spri)}>
                              <Eye className="h-3.5 w-3.5" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Detail SPRI</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                      {spri.status === "active" && (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button variant="ghost" size="icon" className={cn("h-7 w-7", spri.is_bpjs ? "text-amber-600 hover:text-amber-700 hover:bg-amber-50" : "text-orange-600 hover:text-orange-700 hover:bg-orange-50")} onClick={() => handleOpenEdit(spri)}>
                                {spri.is_bpjs ? <Pencil className="h-3.5 w-3.5" /> : <Send className="h-3.5 w-3.5" />}
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>{spri.is_bpjs ? "Edit SPRI" : "Edit & Kirim ke BPJS"}</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-blue-600 hover:text-blue-700 hover:bg-blue-50" onClick={() => handlePrint(spri)}>
                              <Printer className="h-3.5 w-3.5" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Cetak SPRI</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                      {spri.status === "active" && (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive hover:bg-red-50" onClick={() => handleConfirmDelete(spri)}>
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>{spri.is_bpjs ? "Hapus SPRI dari BPJS" : "Hapus SPRI Lokal"}</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Detail Dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-green-600" />
              Detail SPRI
            </DialogTitle>
          </DialogHeader>
          {selectedSPRI && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="font-mono font-bold text-green-700 text-lg">{selectedSPRI.is_bpjs ? selectedSPRI.no_spri : "Draft Lokal"}</span>
                {getStatusBadge(selectedSPRI)}
              </div>

              <div className="rounded-lg border p-3 space-y-2 bg-muted/20">
                <p className="text-xs font-medium text-muted-foreground uppercase">Data Peserta</p>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                  <div><span className="text-muted-foreground text-xs">Nama</span><p className="font-medium">{selectedSPRI.nama || "-"}</p></div>
                  <div><span className="text-muted-foreground text-xs">No. Kartu</span><p className="font-mono">{selectedSPRI.no_kartu}</p></div>
                  <div><span className="text-muted-foreground text-xs">Kelamin</span><p>{selectedSPRI.kelamin === "L" || selectedSPRI.kelamin === "1" ? "Laki-laki" : "Perempuan"}</p></div>
                  <div><span className="text-muted-foreground text-xs">Tgl Lahir</span><p>{selectedSPRI.tgl_lahir || "-"}</p></div>
                </div>
              </div>

              <div className="rounded-lg border p-3 space-y-2 bg-muted/20">
                <p className="text-xs font-medium text-muted-foreground uppercase">Rencana Rawat Inap</p>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                  <div><span className="text-muted-foreground text-xs">Tgl Terbit</span><p>{format(new Date(selectedSPRI.created_at), "dd/MM/yyyy", { locale: idLocale })}</p></div>
                  <div><span className="text-muted-foreground text-xs">Tgl Rencana Masuk</span><p className="font-medium">{selectedSPRI.tgl_rencana_kontrol ? format(new Date(selectedSPRI.tgl_rencana_kontrol), "dd/MM/yyyy", { locale: idLocale }) : "-"}</p></div>
                  <div><span className="text-muted-foreground text-xs">Poli</span><p>{selectedSPRI.nama_poli || selectedSPRI.kode_poli || "-"}</p></div>
                  <div><span className="text-muted-foreground text-xs">Dokter DPJP</span><p>{selectedSPRI.nama_dokter || selectedSPRI.kode_dokter || "-"}</p></div>
                  <div className="col-span-2"><span className="text-muted-foreground text-xs">Diagnosa</span><p>{selectedSPRI.nama_diagnosa || "-"}</p></div>
                </div>
              </div>

              {/* Info Pendaftaran Rawat Inap & SEP */}
              {(selectedSPRI.inpatient_registration_id || selectedSPRI.inpatient_sep_id) && (
                <div className="rounded-lg border p-3 space-y-2 bg-purple-50/50 border-purple-200">
                  <p className="text-xs font-medium text-purple-700 uppercase flex items-center gap-1">
                    <UserCheck className="h-3 w-3" />
                    Status Pendaftaran Rawat Inap
                  </p>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                    {selectedSPRI.inpatient_registration_id && (
                      <div>
                        <span className="text-muted-foreground text-xs">No. Pendaftaran</span>
                        <p className="font-mono font-medium text-purple-700">{selectedSPRI.inpatient_registration_number || "-"}</p>
                      </div>
                    )}
                    {selectedSPRI.inpatient_sep_id && (
                      <div>
                        <span className="text-muted-foreground text-xs">No. SEP Rawat Inap</span>
                        <p className="font-mono font-medium text-indigo-700">{selectedSPRI.inpatient_sep_number || "-"}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <Button className="flex-1" variant="outline" onClick={() => { handlePrint(selectedSPRI); setDetailOpen(false); }}>
                  <Printer className="mr-2 h-4 w-4" />
                  Cetak SPRI
                </Button>
                {selectedSPRI.status === "active" && (
                  <Button variant="destructive" onClick={() => { setDetailOpen(false); handleConfirmDelete(selectedSPRI); }}>
                    <Trash2 className="mr-2 h-4 w-4" />
                    Hapus
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="h-5 w-5" />
              {deletingSPRI?.is_bpjs ? "Hapus SPRI dari BPJS?" : "Hapus SPRI Lokal?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deletingSPRI?.is_bpjs ? (
                <>
                  SPRI <strong className="font-mono">{deletingSPRI?.no_spri}</strong> akan dihapus dari sistem BPJS VClaim.
                  <br /><br />
                  <span className="text-destructive font-medium">⚠️ Tindakan ini tidak dapat dibatalkan.</span>
                  <br />
                  <span className="text-muted-foreground text-sm">Jika BPJS mengembalikan kode 200, data lokal akan ikut dihapus sekaligus.</span>
                </>
              ) : (
                <>
                  SPRI Draft Lokal untuk <strong>{deletingSPRI?.nama || deletingSPRI?.no_kartu}</strong> akan dihapus.
                  <br /><br />
                  <span className="text-muted-foreground text-sm">SPRI ini belum dikirim ke BPJS, sehingga hanya data lokal yang dihapus.</span>
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Kembali</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {deletingSPRI?.is_bpjs ? "Hapus dari BPJS" : "Hapus"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit Sheet */}
      <Sheet open={editOpen} onOpenChange={setEditOpen}>
        <SheetContent className="sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              {editingSPRI?.is_bpjs ? (
                <><Pencil className="h-5 w-5 text-green-600" /> Edit SPRI</>
              ) : (
                <><Send className="h-5 w-5 text-orange-600" /> Edit & Kirim SPRI ke BPJS</>
              )}
            </SheetTitle>
          </SheetHeader>

          {editingSPRI && (
            <div className="space-y-6 py-4">
              {/* Info peserta (read-only) */}
              <div className="rounded-lg border p-3 space-y-2 bg-muted/20">
                <p className="text-xs font-medium text-muted-foreground uppercase">Data Peserta</p>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                  <div>
                    <span className="text-muted-foreground text-xs">No. SPRI</span>
                    {editingSPRI.is_bpjs ? (
                      <p className="font-mono font-semibold text-green-700">{editingSPRI.no_spri}</p>
                    ) : (
                      <p className="font-medium text-amber-600 italic">Draft Lokal (belum dikirim ke BPJS)</p>
                    )}
                  </div>
                  <div>
                    <span className="text-muted-foreground text-xs">Nama</span>
                    <p className="font-medium">{editingSPRI.nama || "-"}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-xs">No. Kartu</span>
                    <p className="font-mono text-xs">{editingSPRI.no_kartu}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-xs">Diagnosa</span>
                    <p className="text-xs">{editingSPRI.nama_diagnosa || "-"}</p>
                  </div>
                </div>
              </div>

              {/* Editable fields */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-xs font-medium">Tanggal Rencana Masuk *</Label>
                  <Input
                    type="date"
                    value={editForm.tgl_rencana_kontrol}
                    onChange={(e) => {
                      setEditForm(prev => ({ ...prev, tgl_rencana_kontrol: e.target.value, kode_dokter: "", nama_dokter: "" }));
                    }}
                    className="h-9"
                  />
                </div>

                {/* Poli & Dokter via PoliDokterSelector (BPJS API + Mapping Lokal) */}
                <PoliDokterSelector
                  kodePoli={editForm.kode_poli}
                  namaPoli={editForm.nama_poli}
                  kodeDokter={editForm.kode_dokter}
                  namaDokter={editForm.nama_dokter}
                  tglRencanaKontrol={editForm.tgl_rencana_kontrol}
                  onPoliChange={(kode, nama) => {
                    setEditForm(prev => ({ ...prev, kode_poli: kode, nama_poli: nama, kode_dokter: "", nama_dokter: "" }));
                  }}
                  onDokterChange={(kode, nama) => {
                    setEditForm(prev => ({ ...prev, kode_dokter: kode, nama_dokter: nama }));
                  }}
                  searchPoliBPJS={handleSearchPoliBPJS}
                  searchDokterBPJS={handleSearchDokterBPJS}
                  poliModalTitle="Cari Poli SPRI BPJS"
                  dokterModalTitle="Cari Dokter SPRI BPJS"
                  poliBPJSMinSearch={3}
                  dokterBPJSMinSearch={1}
                  compact
                />
              </div>
            </div>
          )}

          <SheetFooter className="pt-4 flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setEditOpen(false)} disabled={saving}>
              Batal
            </Button>
            <Button className="flex-1" onClick={handleSaveEdit} disabled={saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : editingSPRI?.is_bpjs ? <Save className="mr-2 h-4 w-4" /> : <Send className="mr-2 h-4 w-4" />}
              {editingSPRI?.is_bpjs ? "Simpan ke BPJS" : "Kirim ke BPJS"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>


    </div>
  );
}
