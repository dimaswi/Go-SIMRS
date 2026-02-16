import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useToast } from "@/hooks/use-toast";
import { setPageTitle } from "@/lib/page-title";
import {
  Loader2,
  ChefHat,
  Truck,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Clock,
  CircleDot,
  Search,
  BedDouble,
  Building2,
  User,
  Printer,
  ChevronDown,
} from "lucide-react";
import {
  nutritionOrderApi,
  nutritionMealTimeLabels,
  nutritionDietTypeLabels,
  nutritionCategoryLabels,
  nutritionOrderStatusLabels,
  type NutritionOrder,
} from "@/lib/api/nutrition";
import { printApi } from "@/lib/api/print";
import { cn } from "@/lib/utils";

interface KitchenStats {
  Confirmed: number;
  Preparing: number;
  Delivered: number;
  Total: number;
}

const mealTimeOrder = ["pagi", "snack_pagi", "siang", "snack_sore", "sore", "snack_malam"];

// Short labels for meal times on cards
const mealTimeShortLabels: Record<string, string> = {
  pagi: "Pagi",
  snack_pagi: "Sn. Pagi",
  siang: "Siang",
  snack_sore: "Sn. Sore",
  sore: "Sore",
  snack_malam: "Sn. Malam",
};

interface RoomGroup {
  room_name: string;
  bed_name?: string;
  orders: NutritionOrder[];
  confirmedCount: number;
  preparingCount: number;
  deliveredCount: number;
  totalCount: number;
}

export default function KitchenDashboardPage() {
  const { toast } = useToast();
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [orders, setOrders] = useState<NutritionOrder[]>([]);
  const [stats, setStats] = useState<KitchenStats>({ Confirmed: 0, Preparing: 0, Delivered: 0, Total: 0 });
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRoom, setSelectedRoom] = useState<RoomGroup | null>(null);
  const [expandedPatients, setExpandedPatients] = useState<Set<string>>(new Set());

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await nutritionOrderApi.getKitchenDashboard(date);
      setOrders(res.data.data || []);
      setStats(res.data.stats || { Confirmed: 0, Preparing: 0, Delivered: 0, Total: 0 });
    } catch {
      toast({ variant: "destructive", title: "Error!", description: "Gagal memuat data dapur." });
    } finally {
      setLoading(false);
    }
  }, [date, toast]);

  useEffect(() => {
    setPageTitle("Dapur");
    loadData();
  }, [loadData]);

  useEffect(() => {
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
  }, [loadData]);

  const handleUpdateStatus = async (orderId: number, newStatus: string) => {
    setUpdatingId(orderId);
    try {
      await nutritionOrderApi.updateStatus(orderId, newStatus);
      toast({ title: "Berhasil!", description: `Status diubah ke ${nutritionOrderStatusLabels[newStatus]}.` });
      loadData();
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error!", description: err?.response?.data?.error || "Gagal mengubah status." });
    } finally {
      setUpdatingId(null);
    }
  };

  const printEtiket = async (orderId: number) => {
    try {
      await printApi.nutritionEtiket(orderId);
    } catch {
      toast({ variant: "destructive", title: "Error!", description: "Gagal mencetak etiket." });
    }
  };

  // Filter orders
  const filteredOrders = orders.filter((o) => {
    if (filterStatus !== "all" && o.status !== filterStatus) return false;
    return true;
  });

  // Group orders by room_name
  const roomGroups: RoomGroup[] = (() => {
    const groupMap: Record<string, NutritionOrder[]> = {};
    filteredOrders.forEach((o) => {
      const key = o.room_name || "Lainnya";
      if (!groupMap[key]) groupMap[key] = [];
      groupMap[key].push(o);
    });

    return Object.entries(groupMap)
      .map(([room_name, roomOrders]) => ({
        room_name,
        orders: roomOrders.sort((a, b) => {
          const aIdx = mealTimeOrder.indexOf(a.meal_time);
          const bIdx = mealTimeOrder.indexOf(b.meal_time);
          return aIdx - bIdx;
        }),
        confirmedCount: roomOrders.filter((o) => o.status === "confirmed").length,
        preparingCount: roomOrders.filter((o) => o.status === "preparing").length,
        deliveredCount: roomOrders.filter((o) => o.status === "delivered").length,
        totalCount: roomOrders.length,
      }))
      .sort((a, b) => {
        // Sort rooms with pending orders first
        const aPending = a.confirmedCount + a.preparingCount;
        const bPending = b.confirmedCount + b.preparingCount;
        if (aPending > 0 && bPending === 0) return -1;
        if (aPending === 0 && bPending > 0) return 1;
        return a.room_name.localeCompare(b.room_name);
      });
  })();

  // Filter by search
  const filteredRoomGroups = roomGroups.filter((g) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    // Search by room name or patient name
    return (
      g.room_name.toLowerCase().includes(q) ||
      g.orders.some((o) => (o.patient?.nama_lengkap || o.patient?.name || "").toLowerCase().includes(q) || (o.patient?.no_rm || "").toLowerCase().includes(q))
    );
  });


  // Unique meal times present in a room's orders
  const getRoomMealTimeSummary = (group: RoomGroup) => {
    const mealTimes = new Set(group.orders.map((o) => o.meal_time));
    return mealTimeOrder.filter((mt) => mealTimes.has(mt));
  };

  // Get location label from visit or fallback to denormalized fields
  const getLocationLabel = (order: NutritionOrder) => {
    const v = (order as any).visit;
    const roomName = v?.room?.name || order.room_name || "";
    const unitName = v?.bed?.room_unit?.name || "";
    const bedNumber = v?.bed?.bed_number || "";
    const parts: string[] = [];
    if (roomName) parts.push(roomName);
    if (unitName) parts.push(unitName);
    if (bedNumber) parts.push(bedNumber);
    if (parts.length > 0) return parts.join(" / ");
    if (order.bed_name) return order.bed_name;
    return "";
  };

  // Group orders by patient for a room
  const getPatientGroups = useCallback((roomOrders: NutritionOrder[]) => {
    const map: Record<string, NutritionOrder[]> = {};
    roomOrders.forEach((o) => {
      const key = String(o.patient_id || o.patient?.no_rm || o.id);
      if (!map[key]) map[key] = [];
      map[key].push(o);
    });
    return Object.entries(map).map(([key, orders]) => ({
      key,
      patient: orders[0].patient,
      orders,
      deliveredCount: orders.filter((o) => o.status === "delivered").length,
      totalCount: orders.length,
    }));
  }, []);

  const togglePatient = (key: string) => {
    setExpandedPatients((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // Auto-expand patients with pending orders when dialog opens
  useEffect(() => {
    if (selectedRoom) {
      const groups = getPatientGroups(selectedRoom.orders);
      const pending = new Set(
        groups
          .filter((g) => g.deliveredCount < g.totalCount)
          .map((g) => g.key)
      );
      setExpandedPatients(pending);
    }
  }, [selectedRoom, getPatientGroups]);

  // Refresh selected room data after status update
  useEffect(() => {
    if (selectedRoom) {
      const updated = roomGroups.find((g) => g.room_name === selectedRoom.room_name);
      if (updated) {
        setSelectedRoom(updated);
      } else {
        setSelectedRoom(null);
      }
    }
  }, [orders]); // eslint-disable-line react-hooks/exhaustive-deps

  const pendingCount = stats.Confirmed + stats.Preparing;

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] p-4 md:p-6 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between shrink-0 mb-4">
        <div>
          <h1 className="text-lg font-semibold flex items-center gap-2">
            <ChefHat className="h-5 w-5" />
            Dashboard Dapur
          </h1>
          <p className="text-sm text-muted-foreground">
            Kelola pesanan makanan pasien rawat inap
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-40 h-9" />
          <Button variant="outline" size="icon" className="h-9 w-9" onClick={loadData} disabled={loading}>
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3 shrink-0 mb-4">
        <button
          onClick={() => setFilterStatus("all")}
          className={cn(
            "p-3 rounded-lg border text-left transition-colors",
            filterStatus === "all" ? "border-primary bg-primary/5" : "hover:bg-muted/50"
          )}
        >
          <div className="text-xs text-muted-foreground mb-1">Total Pesanan</div>
          <div className="text-2xl font-bold">{stats.Total}</div>
        </button>
        <button
          onClick={() => setFilterStatus("confirmed")}
          className={cn(
            "p-3 rounded-lg border text-left transition-colors",
            filterStatus === "confirmed" ? "border-blue-500 bg-blue-50 dark:bg-blue-950/30" : "hover:bg-muted/50"
          )}
        >
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
            <CircleDot className="h-3 w-3 text-blue-500" /> Menunggu
          </div>
          <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{stats.Confirmed}</div>
        </button>
        <button
          onClick={() => setFilterStatus("preparing")}
          className={cn(
            "p-3 rounded-lg border text-left transition-colors",
            filterStatus === "preparing" ? "border-amber-500 bg-amber-50 dark:bg-amber-950/30" : "hover:bg-muted/50"
          )}
        >
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
            <ChefHat className="h-3 w-3 text-amber-500" /> Diproses
          </div>
          <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">{stats.Preparing}</div>
        </button>
        <button
          onClick={() => setFilterStatus("delivered")}
          className={cn(
            "p-3 rounded-lg border text-left transition-colors",
            filterStatus === "delivered" ? "border-green-500 bg-green-50 dark:bg-green-950/30" : "hover:bg-muted/50"
          )}
        >
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
            <CheckCircle2 className="h-3 w-3 text-green-500" /> Terkirim
          </div>
          <div className="text-2xl font-bold text-green-600 dark:text-green-400">{stats.Delivered}</div>
        </button>
      </div>

      {/* Main content area */}
      <div className="rounded-lg border flex-1 flex flex-col min-h-0 overflow-hidden p-4">
        {/* Search & filter bar */}
        <div className="flex items-center gap-3 shrink-0 mb-4">
          <div className="relative max-w-md flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Cari ruangan atau pasien..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-9"
            />
          </div>
          {(filterStatus !== "all" || searchQuery) && (
            <Button
              variant="ghost"
              size="sm"
              className="h-9 text-xs"
              onClick={() => { setFilterStatus("all"); setSearchQuery(""); }}
            >
              Reset Filter
            </Button>
          )}
          <div className="ml-auto text-xs text-muted-foreground">
            {filteredRoomGroups.length} ruangan · {filteredOrders.length} pesanan
            {pendingCount > 0 && filterStatus === "all" && (
              <span className="ml-2 text-amber-600 dark:text-amber-400 font-medium">
                · {pendingCount} perlu ditangani
              </span>
            )}
          </div>
        </div>

        {/* Room Cards Grid */}
        {loading ? (
          <div className="flex items-center justify-center flex-1">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : filteredRoomGroups.length === 0 ? (
          <div className="flex flex-col items-center justify-center flex-1 text-muted-foreground">
            <ChefHat className="h-10 w-10 mb-3 opacity-20" />
            <p className="text-sm">
              {orders.length === 0 ? "Tidak ada pesanan untuk tanggal ini" : "Tidak ada pesanan dengan filter ini"}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 overflow-y-auto flex-1 pr-1">
            {filteredRoomGroups.map((group) => {
              const mealTimes = getRoomMealTimeSummary(group);
              const hasAllergy = group.orders.some((o) => o.allergy_notes);
              const uniquePatients = new Set(group.orders.map((o) => o.patient?.name)).size;

              return (
                <Card
                  key={group.room_name}
                  className={cn(
                    "group hover:shadow-lg transition-all cursor-pointer border-2",
                    group.confirmedCount > 0
                      ? "border-blue-200 hover:border-blue-400 dark:border-blue-900 dark:hover:border-blue-600"
                      : group.preparingCount > 0
                      ? "border-amber-200 hover:border-amber-400 dark:border-amber-900 dark:hover:border-amber-600"
                      : "hover:border-primary/50"
                  )}
                  onClick={() => setSelectedRoom(group)}
                >
                  <CardContent className="p-4">
                    {/* Room header */}
                    <div className="flex items-start gap-2 mb-3">
                      <div className={cn(
                        "p-2 rounded-lg",
                        group.confirmedCount > 0
                          ? "bg-blue-100 dark:bg-blue-900/40"
                          : group.preparingCount > 0
                          ? "bg-amber-100 dark:bg-amber-900/40"
                          : "bg-primary/10"
                      )}>
                        <Building2 className={cn(
                          "h-5 w-5",
                          group.confirmedCount > 0
                            ? "text-blue-600 dark:text-blue-400"
                            : group.preparingCount > 0
                            ? "text-amber-600 dark:text-amber-400"
                            : "text-primary"
                        )} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-sm line-clamp-1">{group.room_name}</h3>
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <User className="h-3 w-3" />
                          {uniquePatients} pasien
                        </p>
                      </div>
                      {hasAllergy && (
                        <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
                      )}
                    </div>

                    {/* Meal time badges */}
                    <div className="flex flex-wrap gap-1 mb-3">
                      {mealTimes.map((mt) => {
                        const mtOrders = group.orders.filter((o) => o.meal_time === mt);
                        const allDelivered = mtOrders.every((o) => o.status === "delivered");
                        const anyPreparing = mtOrders.some((o) => o.status === "preparing");
                        return (
                          <Badge
                            key={mt}
                            variant="secondary"
                            className={cn(
                              "text-[10px] font-normal px-1.5 py-0",
                              allDelivered
                                ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300"
                                : anyPreparing
                                ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
                                : "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
                            )}
                          >
                            {mealTimeShortLabels[mt] || mt}
                          </Badge>
                        );
                      })}
                    </div>

                    {/* Per-patient progress */}
                    <div className="bg-muted/50 rounded-lg p-2 space-y-1.5">
                      {getPatientGroups(group.orders).map((pg) => {
                        const pPct = pg.totalCount > 0 ? Math.round((pg.deliveredCount / pg.totalCount) * 100) : 0;
                        return (
                          <div key={pg.key}>
                            <div className="flex items-center justify-between gap-1 mb-0.5">
                              <span className="text-[10px] font-medium truncate max-w-[60%]">
                                {pg.patient?.nama_lengkap || pg.patient?.name || "-"}
                              </span>
                              <span className={cn(
                                "text-[10px] font-bold",
                                pPct === 100
                                  ? "text-emerald-600 dark:text-emerald-400"
                                  : pPct > 0
                                  ? "text-amber-600 dark:text-amber-400"
                                  : "text-blue-600 dark:text-blue-400"
                              )}>
                                {pg.deliveredCount}/{pg.totalCount}
                              </span>
                            </div>
                            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1">
                              <div
                                className={cn(
                                  "h-1 rounded-full transition-all",
                                  pPct === 100
                                    ? "bg-emerald-500"
                                    : pPct > 0
                                    ? "bg-amber-500"
                                    : "bg-blue-500"
                                )}
                                style={{ width: `${pPct}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Action hint */}
                    <div className="mt-2 flex items-center justify-center gap-1.5 text-[10px] text-muted-foreground group-hover:text-primary transition-colors">
                      <ChefHat className="h-3 w-3" />
                      <span>Klik untuk kelola pesanan</span>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Room Detail Dialog */}
      <Dialog open={!!selectedRoom} onOpenChange={(open) => !open && setSelectedRoom(null)}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              {selectedRoom?.room_name}
              <Badge variant="secondary" className="ml-2 text-xs font-normal">
                {selectedRoom?.totalCount} pesanan
              </Badge>
            </DialogTitle>
          </DialogHeader>

          {selectedRoom && (
            <div className="flex-1 overflow-y-auto space-y-4 pr-1">
              {/* Room stats mini */}
              <div className="grid grid-cols-3 gap-2">
                <div className="flex items-center gap-2 rounded-lg border p-2.5">
                  <CircleDot className="h-4 w-4 text-blue-500" />
                  <div>
                    <div className="text-lg font-bold text-blue-600 dark:text-blue-400">{selectedRoom.confirmedCount}</div>
                    <div className="text-[10px] text-muted-foreground">Menunggu</div>
                  </div>
                </div>
                <div className="flex items-center gap-2 rounded-lg border p-2.5">
                  <ChefHat className="h-4 w-4 text-amber-500" />
                  <div>
                    <div className="text-lg font-bold text-amber-600 dark:text-amber-400">{selectedRoom.preparingCount}</div>
                    <div className="text-[10px] text-muted-foreground">Diproses</div>
                  </div>
                </div>
                <div className="flex items-center gap-2 rounded-lg border p-2.5">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  <div>
                    <div className="text-lg font-bold text-green-600 dark:text-green-400">{selectedRoom.deliveredCount}</div>
                    <div className="text-[10px] text-muted-foreground">Terkirim</div>
                  </div>
                </div>
              </div>

              {/* Orders grouped by patient */}
              {(() => {
                const groups = getPatientGroups(selectedRoom.orders);

                return groups.map((pg) => {
                  const firstOrder = pg.orders[0];
                  const patient = pg.patient;
                  const hasAllergy = pg.orders.some((o) => o.allergy_notes);
                  const pPct = pg.totalCount > 0 ? Math.round((pg.deliveredCount / pg.totalCount) * 100) : 0;
                  const isOpen = expandedPatients.has(pg.key);

                  return (
                    <Collapsible
                      key={pg.key}
                      open={isOpen}
                      onOpenChange={() => togglePatient(pg.key)}
                    >
                      <div className="rounded-lg border bg-card">
                        {/* Patient header - acts as trigger */}
                        <CollapsibleTrigger asChild>
                          <button
                            type="button"
                            className="w-full text-left p-4 hover:bg-muted/30 transition-colors rounded-t-lg"
                          >
                            <div className="flex items-center justify-between gap-3">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <User className="h-4 w-4 text-muted-foreground shrink-0" />
                                  <span className="font-semibold text-sm">{patient?.nama_lengkap || patient?.name || "-"}</span>
                                  {(() => {
                                    const loc = getLocationLabel(firstOrder);
                                    return loc ? (
                                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-normal">
                                        <BedDouble className="h-2.5 w-2.5 mr-0.5" />
                                        {loc}
                                      </Badge>
                                    ) : null;
                                  })()}
                                  {hasAllergy && <AlertTriangle className="h-3.5 w-3.5 text-destructive shrink-0" />}
                                </div>
                                <div className="flex items-center gap-3 text-xs text-muted-foreground ml-6">
                                  {patient?.no_rm && <span>No. RM: <span className="font-medium text-foreground">{patient.no_rm}</span></span>}
                                  {patient?.jenis_kelamin && <span>{patient.jenis_kelamin === 'L' ? 'Laki-laki' : 'Perempuan'}</span>}
                                  {patient?.tanggal_lahir && (
                                    <span>
                                      {(() => {
                                        const dob = new Date(patient.tanggal_lahir);
                                        const age = Math.floor((Date.now() - dob.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
                                        return `${age} tahun`;
                                      })()}
                                    </span>
                                  )}
                                  {firstOrder.diet_type && (
                                    <Badge variant="secondary" className="text-[10px] font-normal px-1.5 py-0">
                                      {nutritionDietTypeLabels[firstOrder.diet_type] || firstOrder.diet_type}
                                    </Badge>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <span className={cn(
                                  "text-xs font-bold",
                                  pPct === 100
                                    ? "text-emerald-600 dark:text-emerald-400"
                                    : pPct > 0
                                    ? "text-amber-600 dark:text-amber-400"
                                    : "text-blue-600 dark:text-blue-400"
                                )}>
                                  {pg.deliveredCount}/{pg.totalCount} terkirim
                                </span>
                                <ChevronDown className={cn(
                                  "h-4 w-4 text-muted-foreground transition-transform duration-200",
                                  isOpen && "rotate-180"
                                )} />
                              </div>
                            </div>
                            {/* Mini progress bar in header */}
                            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1 mt-2 ml-6 max-w-[calc(100%-1.5rem)]">
                              <div
                                className={cn(
                                  "h-1 rounded-full transition-all",
                                  pPct === 100 ? "bg-emerald-500" : pPct > 0 ? "bg-amber-500" : "bg-blue-500"
                                )}
                                style={{ width: `${pPct}%` }}
                              />
                            </div>
                          </button>
                        </CollapsibleTrigger>

                        <CollapsibleContent>
                          {/* Allergy warning */}
                          {hasAllergy && (
                            <div className="mx-4 mb-2">
                              {pg.orders
                                .filter((o) => o.allergy_notes)
                                .slice(0, 1)
                                .map((o) => (
                                  <span key={o.id} className="text-xs text-destructive inline-flex items-center gap-1">
                                    <AlertTriangle className="h-3 w-3 shrink-0" />
                                    Alergi: {o.allergy_notes}
                                  </span>
                                ))}
                            </div>
                          )}

                          {/* Meal time sections */}
                          <div className="px-4 pb-3 space-y-2">
                            {mealTimeOrder
                              .filter((mt) => pg.orders.some((o) => o.meal_time === mt))
                              .map((mt) => {
                                const mtOrders = pg.orders.filter((o) => o.meal_time === mt);
                                return mtOrders.map((order) => (
                              <div
                                key={order.id}
                                className={cn(
                                  "rounded-lg border p-3 transition-colors",
                                  order.status === "confirmed" && "bg-blue-50/50 border-blue-200 dark:bg-blue-950/20 dark:border-blue-900",
                                  order.status === "preparing" && "bg-amber-50/50 border-amber-200 dark:bg-amber-950/20 dark:border-amber-900",
                                  order.status === "delivered" && "bg-green-50/30 border-green-200 dark:bg-green-950/10 dark:border-green-900"
                                )}
                              >
                                {/* Meal time + actions row */}
                                <div className="flex items-center justify-between gap-2 mb-2">
                                  <div className="flex items-center gap-2">
                                    <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                                    <span className="text-sm font-medium">{nutritionMealTimeLabels[order.meal_time]}</span>
                                    {order.package && (
                                      <span className="text-xs text-muted-foreground">• Paket: <span className="font-medium">{order.package.name}</span></span>
                                    )}
                                  </div>

                                  <div className="flex items-center gap-2 shrink-0">
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="h-7 text-xs gap-1"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        printEtiket(order.id);
                                      }}
                                    >
                                      <Printer className="h-3 w-3" />
                                      Etiket
                                    </Button>
                                    {order.status === "confirmed" && (
                                      <Button
                                        size="sm"
                                        className="h-7 text-xs gap-1"
                                        disabled={updatingId === order.id}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleUpdateStatus(order.id, "preparing");
                                        }}
                                      >
                                        {updatingId === order.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <ChefHat className="h-3 w-3" />}
                                        Proses
                                      </Button>
                                    )}
                                    {order.status === "preparing" && (
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        className="h-7 text-xs gap-1"
                                        disabled={updatingId === order.id}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleUpdateStatus(order.id, "delivered");
                                        }}
                                      >
                                        {updatingId === order.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Truck className="h-3 w-3" />}
                                        Kirim
                                      </Button>
                                    )}
                                    {order.status === "delivered" && (
                                      <span className="text-[11px] text-muted-foreground inline-flex items-center gap-1">
                                        <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                                        {order.delivered_at
                                          ? new Date(order.delivered_at).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })
                                          : "Terkirim"}
                                      </span>
                                    )}
                                  </div>
                                </div>

                                {/* Menu Detail Table */}
                                {(() => {
                                  const menuItems = order.items && order.items.length > 0
                                    ? order.items
                                    : order.package?.items || [];
                                  if (menuItems.length === 0) return null;
                                  return (
                                    <div className="rounded border overflow-hidden">
                                      <table className="w-full text-xs">
                                        <thead>
                                          <tr className="bg-muted/50 text-muted-foreground">
                                            <th className="text-left px-3 py-1.5 font-medium">Menu</th>
                                            <th className="text-left px-3 py-1.5 font-medium w-24">Kategori</th>
                                            <th className="text-center px-3 py-1.5 font-medium w-12">Qty</th>
                                            <th className="text-right px-3 py-1.5 font-medium w-16">Kalori</th>
                                            <th className="text-left px-3 py-1.5 font-medium w-32">Catatan</th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {menuItems.map((item: any, idx: number) => (
                                            <tr key={item.id || idx} className={idx < menuItems.length - 1 ? "border-b" : ""}>
                                              <td className="px-3 py-1.5 font-medium">{item.menu?.name || "-"}</td>
                                              <td className="px-3 py-1.5 text-muted-foreground">{nutritionCategoryLabels[item.menu?.category] || item.menu?.category || "-"}</td>
                                              <td className="px-3 py-1.5 text-center">{item.quantity}</td>
                                              <td className="px-3 py-1.5 text-right text-muted-foreground">{item.menu?.calories ? `${Math.round(item.menu.calories * item.quantity)} kkal` : "-"}</td>
                                              <td className="px-3 py-1.5 text-muted-foreground">{item.notes || "-"}</td>
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    </div>
                                  );
                                })()}

                                {/* Special notes */}
                                {order.special_notes && (
                                  <p className="text-xs text-muted-foreground mt-1.5">Catatan: {order.special_notes}</p>
                                )}
                              </div>
                            ));
                          })}
                      </div>
                        </CollapsibleContent>
                      </div>
                    </Collapsible>
                  );
                });
              })()}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
