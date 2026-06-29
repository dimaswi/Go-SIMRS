import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { type Room, type Bed, type RoomUnit, roomsApi } from "@/lib/api/rooms";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BedIcon, Info, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface BedSelectionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (bed: Bed) => void;
}

export function BedSelectionModal({ open, onOpenChange, onSelect }: BedSelectionModalProps) {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [selectedRoomId, setSelectedRoomId] = useState<string>("");
  const [beds, setBeds] = useState<Bed[]>([]);
  const [loadingRooms, setLoadingRooms] = useState(false);
  const [loadingBeds, setLoadingBeds] = useState(false);
  const [bedsError, setBedsError] = useState<string>("");

  useEffect(() => {
    if (open) {
      fetchRooms();
    }
  }, [open]);

  useEffect(() => {
    if (selectedRoomId) {
      fetchBeds(parseInt(selectedRoomId));
    } else {
      setBeds([]);
    }
  }, [selectedRoomId]);

  const fetchRooms = async () => {
    setLoadingRooms(true);
    try {
      const response = await roomsApi.getAll({ room_type: "rawat_inap", is_active: "true" });
      const fetchedRooms = response.data?.data || [];
      setRooms(fetchedRooms);

      // Auto-select first room to show beds immediately
      if (fetchedRooms.length > 0 && !selectedRoomId) {
        setSelectedRoomId(fetchedRooms[0].id.toString());
      }
    } catch (error) {
      console.error("Failed to fetch inpatient rooms:", error);
    } finally {
      setLoadingRooms(false);
    }
  };

  const fetchBeds = async (roomId: number) => {
    setLoadingBeds(true);
    setBedsError("");
    try {
      const response = await roomsApi.getAllBeds(roomId);
      setBeds(response.data?.data || []);
    } catch (error: any) {
      console.error("Failed to fetch beds:", error);
      setBedsError(error?.response?.data?.error || error.message || "Gagal mengambil data tempat tidur");
    } finally {
      setLoadingBeds(false);
    }
  };

  // Group beds by room unit
  const groupedBeds = beds.reduce((acc, bed) => {
    const unitId = bed.room_unit_id;
    if (!acc[unitId]) {
      acc[unitId] = {
        unit: bed.room_unit!,
        beds: [],
      };
    }
    acc[unitId].beds.push(bed);
    return acc;
  }, {} as Record<number, { unit: RoomUnit; beds: Bed[] }>);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="!max-w-[95vw] !w-[95vw] sm:!max-w-[90vw] sm:!w-[90vw] !max-h-[90vh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle>Pilih Saran Tempat Tidur</DialogTitle>
          <DialogDescription>
            Pilih ruangan dan tempat tidur yang disarankan untuk pasien. Status riil tempat tidur dapat berubah sewaktu-waktu.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            {loadingRooms ? (
              <div className="h-10 w-full animate-pulse" />
            ) : rooms.length > 0 ? (
              <div className="w-full overflow-x-auto pb-2 no-scrollbar">
                <Tabs value={selectedRoomId} onValueChange={setSelectedRoomId} className="min-w-full w-max">
                  <TabsList className="flex h-auto w-full justify-start p-1 bg-white">
                    {rooms.map((room) => (
                      <TabsTrigger
                        key={room.id}
                        value={room.id.toString()}
                        className="px-4 py-2 min-w-[120px] whitespace-nowrap data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm"
                      >
                        {room.name}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                </Tabs>
              </div>
            ) : (
              <div className="text-sm text-muted-foreground border rounded-md p-3">
                Tidak ada data ruangan.
              </div>
            )}
          </div>

          {loadingBeds ? (
            <div className="flex justify-center items-center h-40 text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : bedsError ? (
            <div className="text-center py-8 text-red-500 border-2 border-red-100 bg-red-50 rounded-lg">
              <p className="font-semibold">Terjadi Kesalahan</p>
              <p className="text-sm mt-1">{bedsError}</p>
            </div>
          ) : (
            selectedRoomId && beds.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-lg">
                Tidak ada data tempat tidur di ruangan ini.
              </div>
            ) : selectedRoomId && (
              <div className="space-y-4">
                <div className="flex gap-4 items-center justify-center text-xs border-b pb-2">
                  <div className="flex items-center gap-2"><div className="w-4 h-4 bg-green-100 border-2 border-green-500 rounded-sm"></div> Tersedia</div>
                  <div className="flex items-center gap-2"><div className="w-4 h-4 bg-red-100 border-2 border-red-500 rounded-sm"></div> Terisi</div>
                  <div className="flex items-center gap-2"><div className="w-4 h-4 bg-gray-100 border-2 border-gray-400 rounded-sm"></div> Rusak/Kotor</div>
                </div>

                <div className="flex flex-row gap-4 overflow-x-auto pb-4 no-scrollbar items-start">
                  {Object.values(groupedBeds).map(({ unit, beds }) => (
                    <div key={unit.id} className="border rounded-lg overflow-hidden shadow-sm min-w-[300px] flex-shrink-0">
                      <div className="bg-muted px-3 py-2 border-b font-medium flex justify-between items-center text-sm">
                        <div>
                          {unit.name} <span className="text-muted-foreground text-sm font-normal ml-2">Lantai {unit.floor}</span>
                        </div>
                        <div className="text-sm font-normal bg-background px-2 py-1 rounded-md border shadow-sm">
                          Kapasitas: {unit.capacity}
                        </div>
                      </div>

                      <div className="p-3 bg-slate-50/50">
                        {/* Cinema seat style layout - horizontal */}
                        <div className="flex flex-row gap-2 overflow-x-auto no-scrollbar pb-2">
                          {beds.map((bed) => {
                            const isAvailable = bed.status === "available";
                            const isOccupied = bed.status === "occupied";

                            return (
                              <button
                                key={bed.id}
                                disabled={!isAvailable}
                                onClick={() => {
                                  onSelect(bed);
                                  onOpenChange(false);
                                }}
                                className={cn(
                                  "flex flex-col items-center justify-center p-2 rounded-lg border-2 transition-all group relative flex-shrink-0 min-w-[70px]",
                                  isAvailable
                                    ? "bg-green-50 border-green-200 hover:border-green-500 hover:bg-green-100 hover:shadow-sm cursor-pointer"
                                    : isOccupied
                                      ? "bg-red-50 border-red-200 opacity-80 cursor-not-allowed"
                                      : "bg-gray-50 border-gray-200 opacity-60 cursor-not-allowed"
                                )}
                              >
                                <BedIcon className={cn(
                                  "h-5 w-5 mb-1",
                                  isAvailable ? "text-green-600" : isOccupied ? "text-red-500" : "text-gray-400"
                                )} />
                                <span className="font-semibold text-xs">Bed {bed.bed_number}</span>
                                <span className="text-[10px] text-muted-foreground mt-0.5 text-center leading-tight">
                                  {isAvailable ? "Kosong" : isOccupied ? "Terisi" : bed.status}
                                </span>

                                {isOccupied && bed.current_patient && (
                                  <div className="absolute top-1 right-1 text-red-400">
                                    <Info className="w-3 h-3" />
                                  </div>
                                )}
                              </button>
                            );
                          })}
                        </div>

                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
