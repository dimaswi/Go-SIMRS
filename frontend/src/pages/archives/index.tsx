import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { archivesApi } from "@/lib/api/archives";
import type { MedicalRecordArchive, ArchiveStatus, ArchiveLocation, ArchiveMovement } from "@/lib/api/archives";
import {
  Search,
  Archive as ArchiveIcon,
  MapPin,
  ArrowUpFromLine,
  ArrowDownToLine,
  RefreshCw,
  FileText,
  Loader2,
  Eye,
} from "lucide-react";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";

export default function ArchivesPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [archives, setArchives] = useState<MedicalRecordArchive[]>([]);
  const [borrowedMovements, setBorrowedMovements] = useState<ArchiveMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [activeTab, setActiveTab] = useState<"all" | "borrowed">("all");

  // Dialog states
  const [borrowDialogOpen, setBorrowDialogOpen] = useState(false);
  const [returnDialogOpen, setReturnDialogOpen] = useState(false);
  const [locationDialogOpen, setLocationDialogOpen] = useState(false);
  const [selectedArchive, setSelectedArchive] = useState<MedicalRecordArchive | null>(null);
  const [selectedMovement, setSelectedMovement] = useState<ArchiveMovement | null>(null);
  const [processing, setProcessing] = useState(false);

  // Form states
  const [borrowForm, setBorrowForm] = useState({
    borrowed_by_name: "",
    borrow_reason: "",
    due_days: 7,
    notes: "",
  });
  const [returnNotes, setReturnNotes] = useState("");
  const [locationForm, setLocationForm] = useState<{
    location: ArchiveLocation;
    location_code: string;
    shelf_number: string;
    box_number: string;
    notes: string;
  }>({
    location: "active_storage",
    location_code: "",
    shelf_number: "",
    box_number: "",
    notes: "",
  });

  const loadArchives = useCallback(async () => {
    try {
      setLoading(true);
      if (activeTab === "borrowed") {
        const response = await archivesApi.getBorrowed();
        setBorrowedMovements(response.data || []);
      } else {
        const response = await archivesApi.getAll({
          search: searchQuery || undefined,
          status: statusFilter !== "all" ? (statusFilter as ArchiveStatus) : undefined,
        });
        setArchives(response.data?.data || []);
      }
    } catch (error) {
      console.error("Failed to load archives:", error);
      toast({
        title: "Error",
        description: "Gagal memuat data arsip",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [activeTab, searchQuery, statusFilter, toast]);

  useEffect(() => {
    loadArchives();
  }, [loadArchives]);

  const handleSync = async () => {
    try {
      setProcessing(true);
      await archivesApi.sync();
      toast({
        title: "Berhasil",
        description: "Data arsip berhasil disinkronkan dari data pasien",
      });
      loadArchives();
    } catch (error) {
      console.error("Failed to sync archives:", error);
      toast({
        title: "Error",
        description: "Gagal mensinkronkan data arsip",
        variant: "destructive",
      });
    } finally {
      setProcessing(false);
    }
  };

  const handleBorrow = async () => {
    if (!selectedArchive) return;
    try {
      setProcessing(true);
      await archivesApi.borrow(selectedArchive.id, borrowForm);
      toast({
        title: "Berhasil",
        description: "Arsip berhasil dipinjam",
      });
      setBorrowDialogOpen(false);
      setBorrowForm({
        borrowed_by_name: "",
        borrow_reason: "",
        due_days: 7,
        notes: "",
      });
      loadArchives();
    } catch (error) {
      console.error("Failed to borrow archive:", error);
      toast({
        title: "Error",
        description: "Gagal meminjam arsip",
        variant: "destructive",
      });
    } finally {
      setProcessing(false);
    }
  };

  const handleReturn = async () => {
    if (!selectedArchive || !selectedMovement) return;
    try {
      setProcessing(true);
      await archivesApi.return(selectedArchive.id, {
        movement_id: selectedMovement.id,
        notes: returnNotes,
      });
      toast({
        title: "Berhasil",
        description: "Arsip berhasil dikembalikan",
      });
      setReturnDialogOpen(false);
      setReturnNotes("");
      loadArchives();
    } catch (error) {
      console.error("Failed to return archive:", error);
      toast({
        title: "Error",
        description: "Gagal mengembalikan arsip",
        variant: "destructive",
      });
    } finally {
      setProcessing(false);
    }
  };

  const handleUpdateLocation = async () => {
    if (!selectedArchive) return;
    try {
      setProcessing(true);
      await archivesApi.updateLocation(selectedArchive.id, locationForm);
      toast({
        title: "Berhasil",
        description: "Lokasi arsip berhasil diperbarui",
      });
      setLocationDialogOpen(false);
      setLocationForm({
        location: "active_storage",
        location_code: "",
        shelf_number: "",
        box_number: "",
        notes: "",
      });
      loadArchives();
    } catch (error) {
      console.error("Failed to update location:", error);
      toast({
        title: "Error",
        description: "Gagal memperbarui lokasi arsip",
        variant: "destructive",
      });
    } finally {
      setProcessing(false);
    }
  };

  const openBorrowDialog = (archive: MedicalRecordArchive) => {
    setSelectedArchive(archive);
    setBorrowDialogOpen(true);
  };

  const openReturnDialog = (archive: MedicalRecordArchive, movement: ArchiveMovement) => {
    setSelectedArchive(archive);
    setSelectedMovement(movement);
    setReturnDialogOpen(true);
  };

  const openLocationDialog = (archive: MedicalRecordArchive) => {
    setSelectedArchive(archive);
    setLocationForm({
      location: archive.location || "active_storage",
      location_code: archive.location_code || "",
      shelf_number: archive.shelf_number || "",
      box_number: archive.box_number || "",
      notes: "",
    });
    setLocationDialogOpen(true);
  };

  const getStatusBadge = (status: ArchiveStatus) => {
    switch (status) {
      case "active":
        return <Badge variant="default" className="bg-green-500">Aktif</Badge>;
      case "inactive":
        return <Badge variant="secondary">Inaktif</Badge>;
      case "archived":
        return <Badge variant="outline">Diarsipkan</Badge>;
      case "destroyed":
        return <Badge variant="destructive">Dimusnahkan</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getLocationLabel = (location?: ArchiveLocation) => {
    if (!location) return "-";
    const labels: Record<ArchiveLocation, string> = {
      active_storage: "Penyimpanan Aktif",
      inactive_storage: "Penyimpanan Inaktif",
      digital: "Digital",
      offsite: "Off-site",
    };
    return labels[location] || location;
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return "-";
    try {
      return format(new Date(dateStr), "dd MMM yyyy", { locale: idLocale });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="flex flex-1 flex-col gap-4 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold flex items-center gap-2">
            <ArchiveIcon className="h-5 w-5" />
            Manajemen Arsip Rekam Medis
          </h1>
          <p className="text-sm text-muted-foreground">
            Kelola arsip fisik rekam medis pasien, peminjaman, dan lokasi penyimpanan
          </p>
        </div>
        <Button onClick={handleSync} disabled={processing}>
          {processing ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="mr-2 h-4 w-4" />
          )}
          Sinkronisasi Data
        </Button>
      </div>
      <div className="rounded-lg border p-6">
          {/* Tabs */}
          <div className="flex gap-2 mb-4">
            <Button
              variant={activeTab === "all" ? "default" : "outline"}
              size="sm"
              onClick={() => setActiveTab("all")}
            >
              <FileText className="mr-2 h-4 w-4" />
              Semua Arsip
            </Button>
            <Button
              variant={activeTab === "borrowed" ? "default" : "outline"}
              size="sm"
              onClick={() => setActiveTab("borrowed")}
            >
              <ArrowUpFromLine className="mr-2 h-4 w-4" />
              Sedang Dipinjam
            </Button>
          </div>

          {/* Filters */}
          <div className="flex gap-4 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Cari berdasarkan No. RM, nama pasien..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            {activeTab === "all" && (
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Filter Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Status</SelectItem>
                  <SelectItem value="active">Aktif</SelectItem>
                  <SelectItem value="inactive">Inaktif</SelectItem>
                  <SelectItem value="archived">Diarsipkan</SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Table */}
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : activeTab === "all" && archives.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <ArchiveIcon className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Tidak ada data arsip</p>
              <p className="text-sm mt-2">
                Klik tombol "Sinkronisasi Data" untuk mengimpor dari data pasien
              </p>
            </div>
          ) : activeTab === "borrowed" && borrowedMovements.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <ArrowUpFromLine className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Tidak ada arsip yang sedang dipinjam</p>
            </div>
          ) : activeTab === "all" ? (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>No. RM</TableHead>
                    <TableHead>Nama Pasien</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Lokasi</TableHead>
                    <TableHead>Dokumen</TableHead>
                    <TableHead>Kunjungan Terakhir</TableHead>
                    <TableHead className="text-right">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {archives.map((archive) => (
                    <TableRow key={archive.id}>
                      <TableCell className="font-medium font-mono">
                        {archive.no_rm}
                      </TableCell>
                      <TableCell>{archive.patient?.nama_lengkap || "-"}</TableCell>
                      <TableCell>{getStatusBadge(archive.status)}</TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <p>{getLocationLabel(archive.location)}</p>
                          {archive.location_code && (
                            <p className="text-xs text-muted-foreground">
                              {archive.location_code}
                              {archive.shelf_number && ` / Rak ${archive.shelf_number}`}
                              {archive.box_number && ` / Box ${archive.box_number}`}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">
                          {archive.total_documents} dok / {archive.total_pages} hal
                        </span>
                      </TableCell>
                      <TableCell>{formatDate(archive.last_visit_date)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => navigate(`/archives/viewer/${archive.patient_id}`)}
                            title="Lihat Rekam Medis"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openLocationDialog(archive)}
                            title="Atur Lokasi"
                          >
                            <MapPin className="h-4 w-4" />
                          </Button>
                          {archive.status === "active" && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openBorrowDialog(archive)}
                              title="Pinjam"
                            >
                              <ArrowUpFromLine className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>No. RM</TableHead>
                    <TableHead>Nama Pasien</TableHead>
                    <TableHead>Peminjam</TableHead>
                    <TableHead>Alasan</TableHead>
                    <TableHead>Tgl. Pinjam</TableHead>
                    <TableHead>Jatuh Tempo</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {borrowedMovements.map((movement) => (
                    <TableRow key={movement.id}>
                      <TableCell className="font-medium font-mono">
                        {movement.no_rm}
                      </TableCell>
                      <TableCell>{movement.archive?.patient?.nama_lengkap || "-"}</TableCell>
                      <TableCell>
                        {movement.borrowed_by?.name || movement.borrowed_by_name || "-"}
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">{movement.borrow_reason || "-"}</span>
                      </TableCell>
                      <TableCell>{formatDate(movement.borrowed_at)}</TableCell>
                      <TableCell>
                        <span className={movement.status === "overdue" ? "text-red-500 font-medium" : ""}>
                          {formatDate(movement.due_date)}
                        </span>
                      </TableCell>
                      <TableCell>
                        {movement.status === "overdue" ? (
                          <Badge variant="destructive">Terlambat</Badge>
                        ) : (
                          <Badge variant="default">Dipinjam</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {movement.archive && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openReturnDialog(movement.archive!, movement)}
                            title="Kembalikan"
                          >
                            <ArrowDownToLine className="h-4 w-4" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
      </div>

      {/* Borrow Dialog */}
      <Dialog open={borrowDialogOpen} onOpenChange={setBorrowDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Pinjam Arsip</DialogTitle>
            <DialogDescription>
              Arsip: {selectedArchive?.no_rm} - {selectedArchive?.patient?.nama_lengkap}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="borrowed_by_name">Nama Peminjam</Label>
              <Input
                id="borrowed_by_name"
                value={borrowForm.borrowed_by_name}
                onChange={(e) =>
                  setBorrowForm({ ...borrowForm, borrowed_by_name: e.target.value })
                }
                placeholder="Masukkan nama peminjam"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="borrow_reason">Alasan Peminjaman</Label>
              <Textarea
                id="borrow_reason"
                value={borrowForm.borrow_reason}
                onChange={(e) =>
                  setBorrowForm({ ...borrowForm, borrow_reason: e.target.value })
                }
                placeholder="Masukkan alasan peminjaman"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="due_days">Lama Pinjam (hari)</Label>
              <Input
                id="due_days"
                type="number"
                value={borrowForm.due_days}
                onChange={(e) =>
                  setBorrowForm({ ...borrowForm, due_days: parseInt(e.target.value) || 7 })
                }
                min={1}
                max={30}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="borrow_notes">Catatan (Opsional)</Label>
              <Textarea
                id="borrow_notes"
                value={borrowForm.notes}
                onChange={(e) =>
                  setBorrowForm({ ...borrowForm, notes: e.target.value })
                }
                placeholder="Catatan tambahan"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBorrowDialogOpen(false)}>
              Batal
            </Button>
            <Button onClick={handleBorrow} disabled={processing}>
              {processing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Pinjam
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Return Dialog */}
      <Dialog open={returnDialogOpen} onOpenChange={setReturnDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Kembalikan Arsip</DialogTitle>
            <DialogDescription>
              Arsip: {selectedArchive?.no_rm} - {selectedArchive?.patient?.nama_lengkap}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="return_notes">Catatan Pengembalian (Opsional)</Label>
              <Textarea
                id="return_notes"
                value={returnNotes}
                onChange={(e) => setReturnNotes(e.target.value)}
                placeholder="Masukkan catatan pengembalian"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReturnDialogOpen(false)}>
              Batal
            </Button>
            <Button onClick={handleReturn} disabled={processing}>
              {processing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Kembalikan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Location Dialog */}
      <Dialog open={locationDialogOpen} onOpenChange={setLocationDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Atur Lokasi Arsip</DialogTitle>
            <DialogDescription>
              Arsip: {selectedArchive?.no_rm} - {selectedArchive?.patient?.nama_lengkap}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="location">Lokasi Penyimpanan</Label>
              <Select
                value={locationForm.location}
                onValueChange={(value) =>
                  setLocationForm({ ...locationForm, location: value as ArchiveLocation })
                }
              >
                <SelectTrigger id="location">
                  <SelectValue placeholder="Pilih lokasi" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active_storage">Penyimpanan Aktif</SelectItem>
                  <SelectItem value="inactive_storage">Penyimpanan Inaktif</SelectItem>
                  <SelectItem value="digital">Digital</SelectItem>
                  <SelectItem value="offsite">Off-site</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="location_code">Kode Lokasi</Label>
              <Input
                id="location_code"
                value={locationForm.location_code}
                onChange={(e) =>
                  setLocationForm({ ...locationForm, location_code: e.target.value })
                }
                placeholder="Contoh: A-01"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="shelf_number">Nomor Rak</Label>
              <Input
                id="shelf_number"
                value={locationForm.shelf_number}
                onChange={(e) =>
                  setLocationForm({ ...locationForm, shelf_number: e.target.value })
                }
                placeholder="Contoh: 3"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="box_number">Nomor Box</Label>
              <Input
                id="box_number"
                value={locationForm.box_number}
                onChange={(e) =>
                  setLocationForm({ ...locationForm, box_number: e.target.value })
                }
                placeholder="Contoh: 12"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLocationDialogOpen(false)}>
              Batal
            </Button>
            <Button onClick={handleUpdateLocation} disabled={processing}>
              {processing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
