import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  Building2,
  ArrowLeft,
  BarChart3,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { bpjsApi, type AplicareBedItem, type AplicareRefKelasItem, type AplicareRoom } from "@/lib/api/bpjs";

export default function AplicarePage() {
  const { toast } = useToast();
  const navigate = useNavigate();

  // State: BPJS bed data
  const [bedData, setBedData] = useState<AplicareBedItem[]>([]);
  const [bedLoading, setBedLoading] = useState(false);

  // State: SIMRS rooms (for assign dialog)
  const [rooms, setRooms] = useState<AplicareRoom[]>([]);
  const [roomsLoading, setRoomsLoading] = useState(false);

  // State: Ref kelas
  const [refKelas, setRefKelas] = useState<AplicareRefKelasItem[]>([]);

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

  // Load ref kelas
  const loadRefKelas = useCallback(async () => {
    try {
      const res = await bpjsApi.aplicareGetRefKelas();
      setRefKelas(res.data.data || []);
    } catch {
      // silent - ref kelas is optional
    }
  }, []);

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
    loadRefKelas();
    loadRooms();
  }, [loadBedData, loadRefKelas, loadRooms]);

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
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">BPJS Aplicare</h1>
            <p className="text-sm text-muted-foreground">Kelola ketersediaan tempat tidur rumah sakit di BPJS</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={loadBedData} disabled={bedLoading}>
            {bedLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
            Refresh
          </Button>
          <Button size="sm" onClick={openAssignDialog}>
            <Plus className="h-4 w-4 mr-2" />
            Daftarkan Ruangan
          </Button>
        </div>
      </div>

      {/* Statistics */}
      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-lg border p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-muted-foreground">Total Ruangan</span>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="text-2xl font-bold">{stats.totalRooms}</div>
          <p className="text-xs text-muted-foreground mt-1">Ruangan terdaftar</p>
        </div>
        
        <div className="rounded-lg border p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-muted-foreground">Kapasitas Total</span>
            <BedDouble className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="text-2xl font-bold">{stats.totalCapacity}</div>
          <p className="text-xs text-muted-foreground mt-1">Tempat tidur</p>
        </div>
        
        <div className="rounded-lg border p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-muted-foreground">Tersedia</span>
            <div className="h-4 w-4 rounded-full bg-green-500" />
          </div>
          <div className="text-2xl font-bold text-green-600 dark:text-green-400">{stats.totalAvailable}</div>
          <p className="text-xs text-muted-foreground mt-1">Tempat tidur kosong</p>
        </div>
        
        <div className="rounded-lg border p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-muted-foreground">Okupansi</span>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="text-2xl font-bold">{occupancyRate}%</div>
          <p className="text-xs text-muted-foreground mt-1">{stats.totalOccupied} dari {stats.totalCapacity} terisi</p>
        </div>
      </div>

      {/* Ref Kelas info */}
      {refKelas.length > 0 && (
        <div className="rounded-lg border p-4">
          <h3 className="text-sm font-semibold mb-3">Referensi Kelas BPJS</h3>
          <div className="flex flex-wrap gap-2">
            {refKelas.map(k => (
              <Badge key={k.kodekelas} variant="outline" className="text-xs">
                {k.kodekelas} — {k.namakelas}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Bed Data with Tabs Filter */}
      <div className="rounded-lg border p-6">
        <div className="mb-6">
          <h2 className="text-lg font-semibold mb-1">Data Ketersediaan Tempat Tidur</h2>
          <p className="text-sm text-muted-foreground">Informasi real-time ketersediaan tempat tidur per ruangan</p>
        </div>
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

              {/* Bed items */}
              <div className="space-y-4">
                {filteredBedData.map((item) => (
                  <div key={`${item.koderuang}-${item.kodekelas}`} className="relative rounded-lg border p-6 hover:bg-muted/50 transition-colors">
                      {/* Action buttons - top right */}
                      <div className="absolute top-4 right-4 flex items-center gap-2">
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

                      {/* Room info */}
                      <div className="flex items-start gap-4">
                        <div className="flex-shrink-0 mt-1">
                          <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                            <Building2 className="h-6 w-6 text-primary" />
                          </div>
                        </div>
                        <div className="flex-1 min-w-0 pr-20">
                          <div className="flex items-center gap-2 mb-1.5">
                            <span className="font-semibold text-base">{item.namaruang}</span>
                            {getKelasBadge(item.kodekelas)}
                          </div>
                          <div className="text-sm text-muted-foreground mb-4">
                            Kode: <span className="font-mono">{item.koderuang}</span> · Kelas: {item.namakelas || item.kodekelas}
                          </div>

                          {/* Bed availability stats */}
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            <div className="bg-muted rounded-lg px-4 py-3">
                              <div className="text-xs text-muted-foreground mb-1">Kapasitas</div>
                              <div className="text-2xl font-bold">{item.kapasitas}</div>
                            </div>
                            <div className="bg-green-50 dark:bg-green-950/20 rounded-lg px-4 py-3 border border-green-200 dark:border-green-900/30">
                              <div className="text-xs text-green-700 dark:text-green-400 mb-1">Tersedia</div>
                              <div className="text-2xl font-bold text-green-700 dark:text-green-400">{item.tersedia}</div>
                            </div>
                            <div className="bg-blue-50 dark:bg-blue-950/20 rounded-lg px-4 py-3 border border-blue-200 dark:border-blue-900/30">
                              <div className="text-xs text-blue-700 dark:text-blue-400 mb-1">Terisi</div>
                              <div className="text-2xl font-bold text-blue-700 dark:text-blue-400">{item.kapasitas - item.tersedia}</div>
                            </div>
                            <div className="bg-muted rounded-lg px-4 py-3">
                              <div className="text-xs text-muted-foreground mb-1">Okupansi</div>
                              <div className="text-2xl font-bold">
                                {item.kapasitas > 0 ? Math.round(((item.kapasitas - item.tersedia) / item.kapasitas) * 100) : 0}%
                              </div>
                            </div>
                          </div>

                          {/* Gender breakdown (if available) */}
                          {(item.tersediapria > 0 || item.tersediawanita > 0 || item.tersediapriawanita > 0) && (
                            <div className="flex gap-6 mt-3 pt-3 border-t text-sm">
                              {item.tersediapria > 0 && (
                                <div>
                                  <span className="text-muted-foreground">Pria:</span>
                                  <span className="ml-2 font-medium">{item.tersediapria}</span>
                                </div>
                              )}
                              {item.tersediawanita > 0 && (
                                <div>
                                  <span className="text-muted-foreground">Wanita:</span>
                                  <span className="ml-2 font-medium">{item.tersediawanita}</span>
                                </div>
                              )}
                              {item.tersediapriawanita > 0 && (
                                <div>
                                  <span className="text-muted-foreground">Pria/Wanita:</span>
                                  <span className="ml-2 font-medium">{item.tersediapriawanita}</span>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                ))}
              </div>
            </>
          )}
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
    </div>
  );
}
