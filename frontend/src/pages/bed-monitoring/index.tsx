import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { roomsApi, masterDataApi, type Room, type MasterData } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { setPageTitle } from "@/lib/page-title";
import {
  BedDouble,
  Building2,
  Search,
  Loader2,
  Monitor,
  ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";

export default function BedMonitoringIndex() {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [rooms, setRooms] = useState<Room[]>([]);
  const [masterData, setMasterData] = useState<Record<string, MasterData[]>>({});
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  const loadData = useCallback(async () => {
    try {
      const [roomsRes, masterDataRes] = await Promise.all([
        roomsApi.getAll({ limit: 100 }),
        masterDataApi.getMultiple(["service_type", "room_type", "room_class"]),
      ]);

      // Filter only rooms with beds
      const roomsWithBeds = (roomsRes.data.data || []).filter(
        (room: Room) => room.has_bed && room.is_active
      );
      setRooms(roomsWithBeds);
      setMasterData(masterDataRes.data.data || {});
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error!",
        description: "Gagal memuat data ruangan.",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    setPageTitle("Monitoring Bed");
    loadData();
  }, [loadData]);

  // Helper to get master data name
  const getMasterDataName = (category: string, code: string): string => {
    const items = masterData[category] || [];
    const item = items.find((i) => i.code === code);
    return item?.name || code;
  };

  // Filter rooms based on search
  const filteredRooms = rooms.filter((room) => {
    const query = searchQuery.toLowerCase();
    return (
      room.name.toLowerCase().includes(query) ||
      room.code.toLowerCase().includes(query)
    );
  });

  // Get occupancy percentage
  const getOccupancy = (room: Room) => {
    const total = room.total_beds || 0;
    const available = room.available_beds || 0;
    const occupied = total - available;
    return total > 0 ? Math.round((occupied / total) * 100) : 0;
  };

  // Get occupancy color
  const getOccupancyColor = (percentage: number) => {
    if (percentage >= 90) return "text-red-500";
    if (percentage >= 70) return "text-amber-500";
    return "text-emerald-500";
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] p-4 md:p-6 overflow-hidden">
      <div className="flex items-center gap-4 shrink-0 mb-4">
        <div>
          <h1 className="text-lg font-semibold flex items-center gap-2">
            <BedDouble className="h-5 w-5" />
            Monitoring Bed
          </h1>
          <p className="text-sm text-muted-foreground">
            Pilih ruangan untuk melihat status bed secara real-time
          </p>
        </div>
      </div>
      <div className="rounded-lg border flex-1 flex flex-col min-h-0 overflow-hidden p-4">
            {/* Search */}
            <div className="mb-4 shrink-0">
              <div className="relative max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Cari ruangan..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 h-9"
                />
              </div>
            </div>

            {/* Room Grid */}
            {filteredRooms.length === 0 ? (
              <div className="text-center py-8 flex-1 flex flex-col items-center justify-center">
                <BedDouble className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                <p className="text-muted-foreground text-sm">
                  {searchQuery
                    ? "Tidak ada ruangan yang sesuai dengan pencarian"
                    : "Tidak ada ruangan dengan bed yang tersedia"}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 overflow-y-auto flex-1 pr-1">
                {filteredRooms.map((room) => {
                  const occupancy = getOccupancy(room);
                  const totalBeds = room.total_beds || 0;
                  const availableBeds = room.available_beds || 0;
                  const occupiedBeds = totalBeds - availableBeds;

                  return (
                    <Card
                      key={room.id}
                      className="group transition-all cursor-pointer border-2 hover:border-primary/50"
                      onClick={() => navigate(`/bed-monitoring/${room.id}`)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <div className="bg-primary/10 p-2 rounded-lg">
                              <Building2 className="h-5 w-5 text-primary" />
                            </div>
                            <div>
                              <h3 className="font-semibold text-sm line-clamp-1">
                                {room.name}
                              </h3>
                              <p className="text-xs text-muted-foreground">
                                {room.code}
                              </p>
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={(e) => {
                              e.stopPropagation();
                              window.open(`/display/bed-monitoring/${room.id}`, "_blank");
                            }}
                            title="Buka tampilan publik"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                        </div>

                        {/* Room Info */}
                        <div className="space-y-2 mb-3">
                          <div className="flex items-center gap-2 text-xs">
                            <Badge variant="secondary" className="text-xs">
                              {getMasterDataName("room_type", room.room_type)}
                            </Badge>
                            {room.room_class && (
                              <Badge variant="outline" className="text-xs">
                                {getMasterDataName("room_class", room.room_class)}
                              </Badge>
                            )}
                          </div>
                        </div>

                        {/* Bed Stats */}
                        <div className="bg-muted/50 rounded-lg p-2">
                          <div className="flex items-center justify-between mb-1.5">
                            <div className="flex items-center gap-1 text-xs md:text-sm">
                              <BedDouble className="h-3 w-3 md:h-4 md:w-4 text-muted-foreground" />
                              <span className="font-medium">{totalBeds} Bed</span>
                            </div>
                            <span
                              className={cn(
                                "text-xs md:text-sm font-bold",
                                getOccupancyColor(occupancy)
                              )}
                            >
                              {occupancy}%
                            </span>
                          </div>

                          {/* Progress Bar */}
                          <div className="w-full bg-gray-200 rounded-full h-1.5 mb-1.5">
                            <div
                              className={cn(
                                "h-1.5 rounded-full transition-all",
                                occupancy >= 90
                                  ? "bg-red-500"
                                  : occupancy >= 70
                                  ? "bg-amber-500"
                                  : "bg-emerald-500"
                              )}
                              style={{ width: `${occupancy}%` }}
                            />
                          </div>

                          <div className="flex items-center justify-between text-[10px] md:text-xs text-muted-foreground">
                            <div className="flex items-center gap-1">
                              <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                              <span>Terisi: {occupiedBeds}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                              <span>Tersedia: {availableBeds}</span>
                            </div>
                          </div>
                        </div>

                        {/* Action hint */}
                        <div className="mt-2 flex items-center justify-center gap-1.5 text-[10px] md:text-xs text-muted-foreground group-hover:text-primary transition-colors">
                          <Monitor className="h-2.5 w-2.5 md:h-3 md:w-3" />
                          <span>Klik untuk monitoring</span>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
      </div>
    </div>
  );
}
