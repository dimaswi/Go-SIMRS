import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { useToast } from "@/hooks/use-toast";
import { setPageTitle } from "@/lib/page-title";
import {
  Loader2,
  RefreshCw,
  Plus,
  Trash2,
  BedDouble,
} from "lucide-react";
import { bpjsApi, type AplicareBedItem, type AplicareRoom } from "@/lib/api/bpjs";
import { BPJSMetricCue, BPJSPageFrame, BPJSSectionPanel } from "./shared-page-chrome";

export default function AplicarePage() {
  const { toast } = useToast();

  // State: BPJS bed data
  const [bedData, setBedData] = useState<AplicareBedItem[]>([]);
  const [bedLoading, setBedLoading] = useState(false);

  // State: SIMRS rooms (for assign dialog)
  const [rooms, setRooms] = useState<AplicareRoom[]>([]);
  const [roomsLoading, setRoomsLoading] = useState(false);

  // State: Assign room dialog
  const [showAssign, setShowAssign] = useState(false);
  const [assignRoomId, setAssignRoomId] = useState("");
  const [assignSubmitting, setAssignSubmitting] = useState(false);

  // State: Delete confirm
  const [deleteItem, setDeleteItem] = useState<AplicareBedItem | null>(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);

  // State: Update loading per item
  const [updatingRoom, setUpdatingRoom] = useState<string | null>(null);

  useEffect(() => {
    setPageTitle("BPJS Aplicare");
  }, []);

  // Load bed data from BPJS
  const loadBedData = useCallback(async () => {
    setBedLoading(true);
    try {
      const res = await bpjsApi.aplicareReadBed(1, 200);
      setBedData(res.data.data || []);
    } catch (error: any) {
      toast({ variant: "destructive", title: "Gagal", description: error.response?.data?.error || "Gagal memuat data tempat tidur dari BPJS" });
    } finally {
      setBedLoading(false);
    }
  }, [toast]);

  // Load SIMRS rooms
  const loadRooms = useCallback(async () => {
    setRoomsLoading(true);
    try {
      const res = await bpjsApi.aplicareGetRooms();
      setRooms(res.data.data || []);
    } catch (error: any) {
      toast({ variant: "destructive", title: "Gagal", description: error.response?.data?.error || "Gagal memuat data ruangan" });
    } finally {
      setRoomsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadBedData();
    loadRooms();
  }, [loadBedData, loadRooms]);

  // Assign room to Aplicare
  const handleAssignRoom = async () => {
    if (!assignRoomId) {
      toast({ variant: "destructive", title: "Gagal", description: "Pilih ruangan terlebih dahulu" });
      return;
    }
    setAssignSubmitting(true);
    try {
      const res = await bpjsApi.aplicareCreateRoom(parseInt(assignRoomId, 10));
      toast({ title: "Berhasil", description: res.data.message });
      setShowAssign(false);
      setAssignRoomId("");
      loadBedData();
    } catch (error: any) {
      toast({ variant: "destructive", title: "Gagal", description: error.response?.data?.error || "Gagal mendaftarkan ruangan" });
    } finally {
      setAssignSubmitting(false);
    }
  };

  // Delete room from Aplicare
  const handleDeleteRoom = async () => {
    if (!deleteItem) return;
    setDeleteSubmitting(true);
    try {
      const res = await bpjsApi.aplicareDeleteRoom(deleteItem.kodekelas, deleteItem.koderuang);
      toast({ title: "Berhasil", description: res.data.message });
      setDeleteItem(null);
      loadBedData();
    } catch (error: any) {
      toast({ variant: "destructive", title: "Gagal", description: error.response?.data?.error || "Gagal menghapus ruangan" });
    } finally {
      setDeleteSubmitting(false);
    }
  };

  // Manual update room availability
  const handleUpdateRoom = async (kodeRuang: string) => {
    // Find matching SIMRS room by code
    const simrsRoom = rooms.find(r => r.code === kodeRuang);
    if (!simrsRoom) {
      toast({ variant: "destructive", title: "Gagal", description: `Ruangan ${kodeRuang} tidak ditemukan di SIMRS` });
      return;
    }
    setUpdatingRoom(kodeRuang);
    try {
      const res = await bpjsApi.aplicareUpdateRoom(simrsRoom.id);
      toast({ title: "Berhasil", description: res.data.message });
      loadBedData();
    } catch (error: any) {
      toast({ variant: "destructive", title: "Gagal", description: error.response?.data?.error || "Gagal mengupdate ketersediaan" });
    } finally {
      setUpdatingRoom(null);
    }
  };

  // Open assign dialog (loads rooms)
  const openAssignDialog = () => {
    setShowAssign(true);
    if (rooms.length === 0) {
      loadRooms();
    }
  };

  // Map kode kelas to badge color
  const getKelasBadge = (kodeKelas: string) => {
    switch (kodeKelas) {
      case "VVP": return <Badge className="bg-purple-100 text-purple-700 border-purple-300 dark:bg-purple-950/30 dark:text-purple-400">VVIP</Badge>;
      case "VIP": return <Badge className="bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-950/30 dark:text-blue-400">VIP</Badge>;
      case "KLS1": return <Badge className="bg-green-100 text-green-700 border-green-300 dark:bg-green-950/30 dark:text-green-400">Kelas 1</Badge>;
      case "KLS2": return <Badge className="bg-yellow-100 text-yellow-700 border-yellow-300 dark:bg-yellow-950/30 dark:text-yellow-400">Kelas 2</Badge>;
      case "KLS3": return <Badge className="bg-orange-100 text-orange-700 border-orange-300 dark:bg-orange-950/30 dark:text-orange-400">Kelas 3</Badge>;
      case "ICU": return <Badge className="bg-red-100 text-red-700 border-red-300 dark:bg-red-950/30 dark:text-red-400">ICU</Badge>;
      case "ICCU": return <Badge className="bg-red-200 text-red-800 border-red-400 dark:bg-red-900/40 dark:text-red-300">ICCU</Badge>;
      case "ISO": return <Badge className="bg-gray-100 text-gray-700 border-gray-300 dark:bg-gray-900/30 dark:text-gray-400">Isolasi</Badge>;
      default: return <Badge variant="secondary">{kodeKelas}</Badge>;
    }
  };

  // Calculate statistics
  const stats = {
    totalRooms: bedData.length,
    totalCapacity: bedData.reduce((sum, item) => sum + item.kapasitas, 0),
    totalAvailable: bedData.reduce((sum, item) => sum + item.tersedia, 0),
    totalOccupied: bedData.reduce((sum, item) => sum + (item.kapasitas - item.tersedia), 0),
  };
  const occupancyRate = stats.totalCapacity > 0 
    ? Math.round((stats.totalOccupied / stats.totalCapacity) * 100) 
    : 0;

  // Tab state for filtering by kelas
  const [activeKelas, setActiveKelas] = useState<string>("all");
  
  // Filter bed data by kelas
  const filteredBedData = activeKelas === "all" 
    ? bedData 
    : bedData.filter(item => item.kodekelas === activeKelas);
  
  // Get unique kelas for tabs
  const uniqueKelas = Array.from(new Set(bedData.map(item => item.kodekelas)));

  return (
    <BPJSPageFrame
      title="Aplicare"
      description="Kelola ketersediaan tempat tidur BPJS dengan ringkasan yang padat dan area data yang tetap lega."
      actions={
        <>
          <Button variant="outline" size="sm" onClick={loadBedData} disabled={bedLoading}>
            {bedLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
            Refresh
          </Button>
          <Button size="sm" onClick={openAssignDialog}>
            <Plus className="h-4 w-4 mr-2" />
            Daftarkan Ruangan
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <BPJSMetricCue label="Total Ruangan" value={stats.totalRooms} hint="Ruangan terdaftar di Aplicare" />
          <BPJSMetricCue label="Kapasitas Total" value={stats.totalCapacity} hint="Total tempat tidur" />
          <BPJSMetricCue label="Tersedia" value={<span className="text-green-600 dark:text-green-400">{stats.totalAvailable}</span>} hint="Tempat tidur kosong" />
          <BPJSMetricCue label="Okupansi" value={`${occupancyRate}%`} hint={`${stats.totalOccupied} dari ${stats.totalCapacity} terisi`} />
        </div>


      {/* Bed Data with Tabs Filter */}
      <BPJSSectionPanel title="Data Ketersediaan Tempat Tidur">
          {bedLoading && bedData.length === 0 ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : bedData.length === 0 ? (
            <div className="text-center py-16">
              <BedDouble className="h-12 w-12 mx-auto mb-3 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">Belum ada ruangan yang terdaftar di Aplicare</p>
              <p className="text-xs text-muted-foreground mt-1">Klik "Daftarkan Ruangan" untuk mendaftarkan ruangan rawat inap</p>
            </div>
          ) : (
            <>
              {/* Tabs for filtering by kelas */}
              <Tabs value={activeKelas} onValueChange={setActiveKelas} variant="inline" className="mb-6">
                <TabsList>
                  <TabsTrigger value="all">Semua ({bedData.length})</TabsTrigger>
                  {uniqueKelas.map(kelas => {
                    const count = bedData.filter(item => item.kodekelas === kelas).length;
                    return (
                      <TabsTrigger key={kelas} value={kelas}>
                        {kelas} ({count})
                      </TabsTrigger>
                    );
                  })}
                </TabsList>
              </Tabs>

              <div className="overflow-auto border-y border-border/70 bg-background">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30">
                      <TableHead>Ruangan</TableHead>
                      <TableHead>Kelas</TableHead>
                      <TableHead className="text-center">Kapasitas</TableHead>
                      <TableHead className="text-center">Tersedia</TableHead>
                      <TableHead className="text-center">Terisi</TableHead>
                      <TableHead className="text-center">Okupansi</TableHead>
                      <TableHead>Distribusi Bed</TableHead>
                      <TableHead className="w-[96px] text-right">Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredBedData.map((item) => {
                      const occupiedBeds = item.kapasitas - item.tersedia;
                      const occupancy = item.kapasitas > 0 ? Math.round((occupiedBeds / item.kapasitas) * 100) : 0;

                      return (
                        <TableRow key={`${item.koderuang}-${item.kodekelas}`} className="align-top hover:bg-muted/20">
                          <TableCell>
                            <div className="space-y-1">
                              <div className="font-medium text-foreground">{item.namaruang}</div>
                              <div className="text-xs text-muted-foreground">
                                Kode: <span className="font-mono">{item.koderuang}</span>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="space-y-1">
                              {getKelasBadge(item.kodekelas)}
                              <div className="text-xs text-muted-foreground">{item.namakelas || item.kodekelas}</div>
                            </div>
                          </TableCell>
                          <TableCell className="text-center font-semibold">{item.kapasitas}</TableCell>
                          <TableCell className="text-center">
                            <span className="inline-flex min-w-12 justify-center rounded-full bg-green-50 px-2.5 py-1 text-sm font-semibold text-green-700">
                              {item.tersedia}
                            </span>
                          </TableCell>
                          <TableCell className="text-center">
                            <span className="inline-flex min-w-12 justify-center rounded-full bg-blue-50 px-2.5 py-1 text-sm font-semibold text-blue-700">
                              {occupiedBeds}
                            </span>
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="space-y-1">
                              <div className="font-semibold text-foreground">{occupancy}%</div>
                              <div className="h-2 overflow-hidden rounded-full bg-muted">
                                <div className="h-full bg-primary" style={{ width: `${Math.min(occupancy, 100)}%` }} />
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="space-y-1 text-xs text-muted-foreground">
                              <div>Pria: <span className="font-medium text-foreground">{item.tersediapria || 0}</span></div>
                              <div>Wanita: <span className="font-medium text-foreground">{item.tersediawanita || 0}</span></div>
                              <div>Campur: <span className="font-medium text-foreground">{item.tersediapriawanita || 0}</span></div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex justify-end gap-1.5">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                disabled={updatingRoom === item.koderuang}
                                onClick={() => handleUpdateRoom(item.koderuang)}
                                title="Sinkronkan ketersediaan"
                              >
                                {updatingRoom === item.koderuang ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <RefreshCw className="h-3.5 w-3.5" />
                                )}
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive hover:bg-destructive/10"
                                onClick={() => setDeleteItem(item)}
                                title="Hapus dari Aplicare"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
      </BPJSSectionPanel>
      </div>

      {/* Assign Room Dialog */}
      <AlertDialog open={showAssign} onOpenChange={setShowAssign}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Daftarkan Ruangan ke Aplicare</AlertDialogTitle>
            <AlertDialogDescription>
              Pilih ruangan rawat inap SIMRS yang ingin didaftarkan ke BPJS Aplicare. Data kapasitas dan ketersediaan tempat tidur akan otomatis diambil dari SIMRS.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            {roomsLoading ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
            ) : (
              <Select value={assignRoomId} onValueChange={setAssignRoomId}>
                <SelectTrigger>
                  <SelectValue placeholder="Pilih ruangan..." />
                </SelectTrigger>
                <SelectContent>
                  {rooms.map(r => (
                    <SelectItem key={r.id} value={String(r.id)}>
                      {r.name} ({r.code}) — {r.room_class || '-'} · {r.total_beds} bed, {r.available_beds} tersedia
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={handleAssignRoom} disabled={assignSubmitting || !assignRoomId}>
              {assignSubmitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Daftarkan
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Confirm Dialog */}
      <AlertDialog open={!!deleteItem} onOpenChange={(open) => !open && setDeleteItem(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Ruangan dari Aplicare?</AlertDialogTitle>
            <AlertDialogDescription>
              Ruangan <strong>{deleteItem?.namaruang}</strong> ({deleteItem?.koderuang}) kelas {deleteItem?.namakelas || deleteItem?.kodekelas} akan dihapus dari BPJS Aplicare. Tindakan ini tidak dapat dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteRoom}
              disabled={deleteSubmitting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteSubmitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </BPJSPageFrame>
  );
}
