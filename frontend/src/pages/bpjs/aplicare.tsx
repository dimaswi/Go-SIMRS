import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
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
import { BPJSPageFrame, BPJSSectionPanel } from "./shared-page-chrome";

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
    // Find matching SIMRS room by code or by its Kamar unit code
    // BPJS truncates kodeRuang to 10 characters, so we must substring our local codes to 10 characters for comparison
    const simrsRoom = rooms.find(r => {
      if (r.code.substring(0, 10) === kodeRuang) return true;
      if (r.units && r.units.some(u => {
        const fallbackCode = `${r.code}-${u.id}`;
        return (u.code && u.code.substring(0, 10) === kodeRuang) || (fallbackCode.substring(0, 10) === kodeRuang);
      })) {
        return true;
      }
      return false;
    });
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
      case "KL1": return <Badge className="bg-green-100 text-green-700 border-green-300 dark:bg-green-950/30 dark:text-green-400">Kelas 1</Badge>;
      case "KL2": return <Badge className="bg-yellow-100 text-yellow-700 border-yellow-300 dark:bg-yellow-950/30 dark:text-yellow-400">Kelas 2</Badge>;
      case "KL3": return <Badge className="bg-orange-100 text-orange-700 border-orange-300 dark:bg-orange-950/30 dark:text-orange-400">Kelas 3</Badge>;
      case "ICU": return <Badge className="bg-red-100 text-red-700 border-red-300 dark:bg-red-950/30 dark:text-red-400">ICU</Badge>;
      case "ICCU": return <Badge className="bg-red-200 text-red-800 border-red-400 dark:bg-red-900/40 dark:text-red-300">ICCU</Badge>;
      case "ISO": return <Badge className="bg-gray-100 text-gray-700 border-gray-300 dark:bg-gray-900/30 dark:text-gray-400">Isolasi</Badge>;
      default: return <Badge variant="secondary">{kodeKelas}</Badge>;
    }
  };

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

        {/* Bed Data */}
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
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 py-4">
                {bedData.map((item) => {
                  const occupiedBeds = item.kapasitas - item.tersedia;
                  return (
                    <div
                      key={`${item.koderuang}-${item.kodekelas}`}
                      className="relative flex flex-col rounded-xl border border-border bg-card text-card-foreground shadow-sm overflow-hidden transition-all hover:shadow-md hover:-translate-y-0.5"
                    >
                      {/* Ticket Header */}
                      <div className="flex items-start justify-between p-4 bg-muted/30 border-b border-dashed border-border/70">
                        <div className="space-y-1 min-w-0 pr-2">
                          <h3 className="font-semibold text-lg leading-tight tracking-tight text-foreground truncate" title={item.namaruang}>{item.namaruang}</h3>
                          <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                            Kode: <span className="font-mono bg-background px-1.5 py-0.5 rounded border border-border/50">{item.koderuang}</span>
                          </div>
                        </div>
                        <div className="shrink-0">{getKelasBadge(item.kodekelas)}</div>
                      </div>

                      {/* Ticket Body: Seat Map */}
                      <div className="p-4 flex-1">
                        <div className="flex items-center justify-between mb-4">
                          <div className="font-medium text-sm">Denah Bed</div>
                          <div className="text-xs font-semibold bg-muted px-2 py-1 rounded-full">Kapasitas: {item.kapasitas}</div>
                        </div>

                        <div className="flex flex-wrap gap-1.5 max-h-[140px] overflow-y-auto pr-1 custom-scrollbar">
                          {/* Generate seats: Occupied first, then Available */}
                          {Array.from({ length: item.kapasitas }).map((_, i) => {
                            const isAvailable = i >= occupiedBeds; // First occupiedBeds are occupied
                            return (
                              <div
                                key={i}
                                className={cn(
                                  "h-7 w-7 rounded border flex items-center justify-center transition-all",
                                  isAvailable
                                    ? "bg-green-50 border-green-200 text-green-600 dark:bg-green-950/30 dark:border-green-900/50 dark:text-green-400"
                                    : "bg-blue-50 border-blue-200 text-blue-600 dark:bg-blue-950/30 dark:border-blue-900/50 dark:text-blue-400"
                                )}
                                title={isAvailable ? "Kosong" : "Terisi"}
                              >
                                {isAvailable ? (
                                  <span className="text-xs font-semibold">{i + 1}</span>
                                ) : (
                                  <BedDouble className="h-3.5 w-3.5 opacity-70" />
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Ticket Footer */}
                      <div className="flex items-center justify-between p-3 bg-muted/30 border-t border-border/70">
                        <div className="flex gap-4 text-sm">
                          <div className="flex flex-col">
                            <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Tersedia</span>
                            <span className="font-bold text-green-600 dark:text-green-400">{item.tersedia}</span>
                          </div>
                          <div className="flex flex-col">
                            <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Terisi</span>
                            <span className="font-bold text-blue-600 dark:text-blue-400">{occupiedBeds}</span>
                          </div>
                        </div>

                        <div className="flex justify-end gap-1.5">
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-8 w-8 bg-background shadow-sm hover:bg-muted"
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
                            variant="outline"
                            size="icon"
                            className="h-8 w-8 bg-background shadow-sm text-destructive hover:bg-destructive/10 hover:text-destructive border-destructive/20"
                            onClick={() => setDeleteItem(item)}
                            title="Hapus dari Aplicare"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
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
