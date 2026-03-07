import { useState, useEffect, useCallback, useRef } from "react";
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
import { Combobox } from "@/components/ui/combobox";
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
} from "lucide-react";
import { vclaimApi, type SuratKontrolLocal, type VClaimRefPoli, type VClaimRefDokter } from "@/lib/api/vclaim";
import { printApi } from "@/lib/api/print";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { cn } from "@/lib/utils";

const statusConfig: Record<string, { label: string; className: string }> = {
  active: { label: "Aktif", className: "bg-green-50 text-green-700 border-green-200" },
  used: { label: "Digunakan", className: "bg-blue-50 text-blue-700 border-blue-200" },
  cancelled: { label: "Dibatalkan", className: "bg-red-50 text-red-700 border-red-200" },
};

export default function SuratKontrolMonitoringPage() {
  const { toast } = useToast();

  const [loading, setLoading] = useState(false);
  const [list, setList] = useState<SuratKontrolLocal[]>([]);
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
  const [selected, setSelected] = useState<SuratKontrolLocal | null>(null);

  // Delete confirm
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletingItem, setDeletingItem] = useState<SuratKontrolLocal | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Edit sheet
  const [editOpen, setEditOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<SuratKontrolLocal | null>(null);
  const [editForm, setEditForm] = useState({ tgl_rencana_kontrol: "", kode_poli: "", nama_poli: "", kode_dokter: "", nama_dokter: "" });
  const [saving, setSaving] = useState(false);
  const [poliOptions, setPoliOptions] = useState<VClaimRefPoli[]>([]);
  const [dokterOptions, setDokterOptions] = useState<VClaimRefDokter[]>([]);
  const [_poliSearch, setPoliSearch] = useState("");
  const [loadingPoli, setLoadingPoli] = useState(false);
  const [loadingDokter, setLoadingDokter] = useState(false);
  const poliTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    setPageTitle("Monitoring Surat Kontrol");
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

      const resp = await vclaimApi.getSuratKontrolList(params as any);
      setList(resp.data.data || []);
    } catch {
      toast({ variant: "destructive", title: "Error", description: "Gagal memuat data Surat Kontrol" });
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

  const handleOpenDetail = (item: SuratKontrolLocal) => {
    setSelected(item);
    setDetailOpen(true);
  };

  const handlePrint = (item: SuratKontrolLocal) => {
    printApi.suratKontrol(item.id);
  };

  const handleConfirmDelete = (item: SuratKontrolLocal) => {
    setDeletingItem(item);
    setDeleteOpen(true);
  };

  // === Edit Sheet handlers ===
  const handleOpenEdit = (item: SuratKontrolLocal) => {
    setEditingItem(item);
    setEditForm({
      tgl_rencana_kontrol: item.tgl_rencana_kontrol || "",
      kode_poli: item.kode_poli || "",
      nama_poli: item.nama_poli || "",
      kode_dokter: item.kode_dokter || "",
      nama_dokter: item.nama_dokter || "",
    });
    if (item.nama_poli) {
      searchPoli(item.nama_poli.substring(0, 3));
    }
    if (item.kode_poli) {
      searchDokter(item.kode_poli, item.tgl_rencana_kontrol);
    }
    setEditOpen(true);
  };

  const searchPoli = async (nama: string) => {
    if (nama.length < 2) return;
    setLoadingPoli(true);
    try {
      const res = await vclaimApi.searchPoliSuratKontrol(nama);
      setPoliOptions(res.data.data || []);
    } catch {
      setPoliOptions([]);
    } finally {
      setLoadingPoli(false);
    }
  };

  const handlePoliSearchChange = (val: string) => {
    setPoliSearch(val);
    clearTimeout(poliTimer.current);
    poliTimer.current = setTimeout(() => searchPoli(val), 400);
  };

  const searchDokter = async (kodePoli: string, tgl?: string) => {
    if (!kodePoli) return;
    setLoadingDokter(true);
    try {
      const res = await vclaimApi.searchDokterSuratKontrol(kodePoli, tgl || editForm.tgl_rencana_kontrol || undefined);
      setDokterOptions(res.data.data || []);
    } catch {
      setDokterOptions([]);
    } finally {
      setLoadingDokter(false);
    }
  };

  const handlePoliChange = (value: string) => {
    const poli = poliOptions.find(p => p.kode === value);
    setEditForm(prev => ({
      ...prev,
      kode_poli: value,
      nama_poli: poli?.nama || value,
      kode_dokter: "",
      nama_dokter: "",
    }));
    setDokterOptions([]);
    searchDokter(value);
  };

  const handleDokterChange = (value: string) => {
    const dokter = dokterOptions.find(d => d.kode === value);
    setEditForm(prev => ({
      ...prev,
      kode_dokter: value,
      nama_dokter: dokter?.nama || value,
    }));
  };

  const handleSaveEdit = async () => {
    if (!editingItem) return;
    if (!editForm.tgl_rencana_kontrol || !editForm.kode_poli || !editForm.kode_dokter) {
      toast({ variant: "destructive", title: "Error", description: "Tanggal, Poli, dan Dokter wajib diisi" });
      return;
    }
    setSaving(true);
    try {
      await vclaimApi.updateSuratKontrol(editingItem.no_surat_kontrol, {
        kode_dokter: editForm.kode_dokter,
        nama_dokter: editForm.nama_dokter,
        poli_kontrol: editForm.kode_poli,
        nama_poli: editForm.nama_poli,
        tgl_rencana_kontrol: editForm.tgl_rencana_kontrol,
      });
      toast({ title: "Berhasil", description: "Surat Kontrol berhasil diupdate" });
      setEditOpen(false);
      setEditingItem(null);
      loadData();
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error", description: error.response?.data?.error || "Gagal mengupdate Surat Kontrol" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingItem) return;
    setDeleting(true);
    try {
      await vclaimApi.deleteSuratKontrol(deletingItem.no_surat_kontrol);
      toast({ title: "Berhasil", description: "Surat Kontrol berhasil dihapus" });
      setDeleteOpen(false);
      setDeletingItem(null);
      loadData();
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error", description: error.response?.data?.error || "Gagal menghapus Surat Kontrol" });
    } finally {
      setDeleting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const cfg = statusConfig[status] || { label: status, className: "bg-gray-50 text-gray-600 border-gray-200" };
    return <Badge variant="outline" className={cn("text-[10px]", cfg.className)}>{cfg.label}</Badge>;
  };

  return (
    <div className="flex flex-1 flex-col p-4 gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Monitoring Surat Kontrol</h1>
          <p className="text-sm text-muted-foreground">Pantau Surat Kontrol / SKDP rawat jalan berdasarkan tanggal</p>
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
              <Label className="text-xs">Tanggal Kontrol (Dari)</Label>
              <Input type="date" value={tglKontrolFrom} onChange={e => setTglKontrolFrom(e.target.value)} className="h-9" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Tanggal Kontrol (Sampai)</Label>
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
          {loading ? "Memuat..." : `${list.length} Surat Kontrol ditemukan`}
        </p>
      </div>

      {/* Table */}
      <div className="rounded-lg border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="w-12 text-center">#</TableHead>
              <TableHead>No. Surat Kontrol</TableHead>
              <TableHead>Nama / No. Kartu</TableHead>
              <TableHead>No. SEP</TableHead>
              <TableHead>Tgl Terbit</TableHead>
              <TableHead>Tgl Rencana Kontrol</TableHead>
              <TableHead>Poli</TableHead>
              <TableHead>Dokter DPJP</TableHead>
              <TableHead className="text-center">PRB</TableHead>
              <TableHead className="text-center">Status</TableHead>
              <TableHead className="text-center">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={11} className="text-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                  <p className="text-sm text-muted-foreground mt-2">Memuat data...</p>
                </TableCell>
              </TableRow>
            ) : list.length === 0 ? (
              <TableRow>
                <TableCell colSpan={11} className="text-center py-12">
                  <FileText className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
                  <p className="text-sm text-muted-foreground">Tidak ada data Surat Kontrol</p>
                  <p className="text-xs text-muted-foreground">Coba ubah filter pencarian</p>
                </TableCell>
              </TableRow>
            ) : (
              list.map((item, idx) => (
                <TableRow key={item.id} className="hover:bg-muted/30">
                  <TableCell className="text-center text-muted-foreground text-sm">{idx + 1}</TableCell>
                  <TableCell className="font-mono text-sm font-semibold text-purple-700">{item.no_surat_kontrol}</TableCell>
                  <TableCell>
                    <p className="font-medium text-sm">{item.nama || "-"}</p>
                    <p className="text-xs text-muted-foreground font-mono">{item.no_kartu}</p>
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">{item.no_sep}</TableCell>
                  <TableCell className="text-sm">
                    {item.created_at
                      ? format(new Date(item.created_at), "dd/MM/yyyy", { locale: idLocale })
                      : "-"}
                  </TableCell>
                  <TableCell className="text-sm font-medium">
                    {item.tgl_rencana_kontrol
                      ? format(new Date(item.tgl_rencana_kontrol), "dd/MM/yyyy", { locale: idLocale })
                      : "-"}
                  </TableCell>
                  <TableCell className="text-sm max-w-[120px]">
                    <p className="truncate">{item.nama_poli || item.kode_poli || "-"}</p>
                  </TableCell>
                  <TableCell className="text-sm max-w-[120px]">
                    <p className="truncate">{item.nama_dokter || item.kode_dokter || "-"}</p>
                  </TableCell>
                  <TableCell className="text-center">
                    {item.is_prb ? (
                      <Badge variant="outline" className="text-[10px] bg-blue-50 text-blue-700 border-blue-200">
                        {item.nama_status_prb || item.kd_status_prb || "PRB"}
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-center">{getStatusBadge(item.status)}</TableCell>
                  <TableCell>
                    <div className="flex items-center justify-center gap-1">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleOpenDetail(item)}>
                              <Eye className="h-3.5 w-3.5" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Detail Surat Kontrol</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                      {item.status === "active" && (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-amber-600 hover:text-amber-700 hover:bg-amber-50" onClick={() => handleOpenEdit(item)}>
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Edit Surat Kontrol</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-blue-600 hover:text-blue-700 hover:bg-blue-50" onClick={() => handlePrint(item)}>
                              <Printer className="h-3.5 w-3.5" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Cetak Surat Kontrol</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                      {item.status === "active" && (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive hover:bg-red-50" onClick={() => handleConfirmDelete(item)}>
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Hapus Surat Kontrol</TooltipContent>
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
              <FileText className="h-5 w-5 text-purple-600" />
              Detail Surat Kontrol
            </DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="font-mono font-bold text-purple-700 text-base">{selected.no_surat_kontrol}</span>
                <div className="flex items-center gap-2">
                  {selected.is_prb && (
                    <Badge variant="outline" className="text-[10px] bg-blue-50 text-blue-700 border-blue-200">PRB</Badge>
                  )}
                  {getStatusBadge(selected.status)}
                </div>
              </div>

              <div className="rounded-lg border p-3 space-y-2 bg-muted/20">
                <p className="text-xs font-medium text-muted-foreground uppercase">Data Peserta</p>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                  <div><span className="text-muted-foreground text-xs">Nama</span><p className="font-medium">{selected.nama || "-"}</p></div>
                  <div><span className="text-muted-foreground text-xs">No. Kartu</span><p className="font-mono">{selected.no_kartu}</p></div>
                  <div><span className="text-muted-foreground text-xs">Kelamin</span><p>{selected.kelamin === "L" || selected.kelamin === "1" ? "Laki-laki" : "Perempuan"}</p></div>
                  <div><span className="text-muted-foreground text-xs">Tgl Lahir</span><p>{selected.tgl_lahir || "-"}</p></div>
                  <div className="col-span-2"><span className="text-muted-foreground text-xs">No. SEP</span><p className="font-mono">{selected.no_sep}</p></div>
                </div>
              </div>

              <div className="rounded-lg border p-3 space-y-2 bg-muted/20">
                <p className="text-xs font-medium text-muted-foreground uppercase">Rencana Kontrol</p>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                  <div><span className="text-muted-foreground text-xs">Tgl Terbit</span><p>{format(new Date(selected.created_at), "dd/MM/yyyy", { locale: idLocale })}</p></div>
                  <div><span className="text-muted-foreground text-xs">Tgl Rencana Kontrol</span><p className="font-medium">{selected.tgl_rencana_kontrol ? format(new Date(selected.tgl_rencana_kontrol), "dd/MM/yyyy", { locale: idLocale }) : "-"}</p></div>
                  <div><span className="text-muted-foreground text-xs">Poli</span><p>{selected.nama_poli || selected.kode_poli || "-"}</p></div>
                  <div><span className="text-muted-foreground text-xs">Dokter DPJP</span><p>{selected.nama_dokter || selected.kode_dokter || "-"}</p></div>
                  <div className="col-span-2"><span className="text-muted-foreground text-xs">Diagnosa</span><p>{selected.nama_diagnosa || "-"}</p></div>
                  {selected.is_prb && (
                    <div className="col-span-2"><span className="text-muted-foreground text-xs">Program PRB</span><p className="font-medium text-blue-700">{selected.nama_status_prb || selected.kd_status_prb || "-"}</p></div>
                  )}
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <Button className="flex-1" variant="outline" onClick={() => { handlePrint(selected); setDetailOpen(false); }}>
                  <Printer className="mr-2 h-4 w-4" />
                  Cetak Surat Kontrol
                </Button>
                {selected.status === "active" && (
                  <Button variant="destructive" onClick={() => { setDetailOpen(false); handleConfirmDelete(selected); }}>
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
              Hapus Surat Kontrol dari BPJS?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Surat Kontrol <strong className="font-mono">{deletingItem?.no_surat_kontrol}</strong> akan dihapus dari sistem BPJS VClaim.
              <br /><br />
              <span className="text-destructive font-medium">⚠️ Tindakan ini tidak dapat dibatalkan.</span>
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
              Hapus dari BPJS
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit Sheet */}
      <Sheet open={editOpen} onOpenChange={setEditOpen}>
        <SheetContent className="sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Pencil className="h-5 w-5 text-purple-600" />
              Edit Surat Kontrol
            </SheetTitle>
          </SheetHeader>

          {editingItem && (
            <div className="space-y-6 py-4">
              {/* Info peserta (read-only) */}
              <div className="rounded-lg border p-3 space-y-2 bg-muted/20">
                <p className="text-xs font-medium text-muted-foreground uppercase">Data Peserta</p>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                  <div>
                    <span className="text-muted-foreground text-xs">No. Surat Kontrol</span>
                    <p className="font-mono font-semibold text-purple-700">{editingItem.no_surat_kontrol}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-xs">Nama</span>
                    <p className="font-medium">{editingItem.nama || "-"}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-xs">No. Kartu</span>
                    <p className="font-mono text-xs">{editingItem.no_kartu}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-xs">No. SEP</span>
                    <p className="font-mono text-xs">{editingItem.no_sep}</p>
                  </div>
                  <div className="col-span-2">
                    <span className="text-muted-foreground text-xs">Diagnosa</span>
                    <p className="text-xs">{editingItem.nama_diagnosa || "-"}</p>
                  </div>
                  {editingItem.is_prb && (
                    <div className="col-span-2">
                      <span className="text-muted-foreground text-xs">Program PRB</span>
                      <p className="text-xs font-medium text-blue-700">{editingItem.nama_status_prb || editingItem.kd_status_prb || "-"}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Editable fields */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-xs font-medium">Tanggal Rencana Kontrol *</Label>
                  <Input
                    type="date"
                    value={editForm.tgl_rencana_kontrol}
                    onChange={(e) => {
                      setEditForm(prev => ({ ...prev, tgl_rencana_kontrol: e.target.value }));
                      if (editForm.kode_poli) searchDokter(editForm.kode_poli, e.target.value);
                    }}
                    className="h-9"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-medium">Poli Tujuan *</Label>
                  <Combobox
                    options={poliOptions.map(p => ({ value: p.kode, label: `${p.kode} - ${p.nama}` }))}
                    value={editForm.kode_poli}
                    onValueChange={handlePoliChange}
                    onSearchChange={handlePoliSearchChange}
                    placeholder={loadingPoli ? "Mencari poli..." : "Ketik nama poli untuk mencari..."}
                    className="h-9"
                    searchable
                  />
                  {editForm.nama_poli && (
                    <p className="text-xs text-muted-foreground">Terpilih: {editForm.nama_poli}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-medium">Dokter DPJP *</Label>
                  <Combobox
                    options={dokterOptions.map(d => ({ value: d.kode, label: `${d.kode} - ${d.nama}` }))}
                    value={editForm.kode_dokter}
                    onValueChange={handleDokterChange}
                    placeholder={loadingDokter ? "Memuat dokter..." : editForm.kode_poli ? "Pilih dokter..." : "Pilih poli terlebih dahulu"}
                    className="h-9"
                    searchable
                  />
                  {editForm.nama_dokter && (
                    <p className="text-xs text-muted-foreground">Terpilih: {editForm.nama_dokter}</p>
                  )}
                </div>
              </div>
            </div>
          )}

          <SheetFooter className="pt-4 flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setEditOpen(false)} disabled={saving}>
              Batal
            </Button>
            <Button className="flex-1" onClick={handleSaveEdit} disabled={saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Simpan ke BPJS
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}
