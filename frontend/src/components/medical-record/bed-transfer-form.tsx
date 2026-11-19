import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  ArrowRightLeft,
  Loader2,
  Building,
  Bed,
  Check,
  CheckCircle2,
  Calendar,
  History,
  Save,
  RotateCcw,
} from "lucide-react";
import { roomsApi, type Room, type RoomUnit } from "@/lib/api/rooms";
import { bedTransferApi, type BedTransfer, type CreateBedTransferInput, TRANSFER_TYPES, getTransferTypeLabel } from "@/lib/api/inpatient";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface BedTransferFormProps {
  visitId: number;
  currentRoomId?: number;
  currentBedId?: number;
  readOnly?: boolean;
  onTransferComplete?: () => void;
}

export function BedTransferForm({
  visitId,
  currentRoomId,
  currentBedId,
  readOnly = false,
  onTransferComplete,
}: BedTransferFormProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<"form" | "history">("form");
  
  // Transfer history
  const [transfers, setTransfers] = useState<BedTransfer[]>([]);
  
  // Room and bed selection
  const [rooms, setRooms] = useState<Room[]>([]);
  const [selectedRoomId, setSelectedRoomId] = useState<number | null>(null);
  const [roomUnits, setRoomUnits] = useState<RoomUnit[]>([]);
  const [selectedUnitId, setSelectedUnitId] = useState<number | null>(null);
  const [selectedBedId, setSelectedBedId] = useState<number | null>(null);
  const [loadingBeds, setLoadingBeds] = useState(false);
  
  // Form data
  const [transferReason, setTransferReason] = useState("");
  const [transferType, setTransferType] = useState("");
  const [notes, setNotes] = useState("");

  // Load transfer history and rooms on mount
  useEffect(() => {
    const loadInitialData = async () => {
      setLoading(true);
      try {
        // Load transfer history
        const transfersResponse = await bedTransferApi.getAll(visitId);
        setTransfers(transfersResponse.data.data || []);
        
        // Load rooms
        const roomsResponse = await roomsApi.getAll({ limit: 1000, is_active: 'true' });
        const allRooms = roomsResponse.data.data || [];
        // Filter to only inpatient rooms with beds
        setRooms(allRooms.filter(r => r.has_bed && r.is_active));
      } catch (error) {
        console.error("Failed to load data:", error);
      } finally {
        setLoading(false);
      }
    };
    loadInitialData();
  }, [visitId]);

  // Load beds when room is selected
  useEffect(() => {
    if (selectedRoomId) {
      loadBeds(selectedRoomId);
    } else {
      setRoomUnits([]);
      setSelectedUnitId(null);
      setSelectedBedId(null);
    }
  }, [selectedRoomId]);

  const loadBeds = async (roomId: number) => {
    setLoadingBeds(true);
    try {
      const response = await roomsApi.getById(roomId);
      const roomData = response.data.data;
      setRoomUnits(roomData.units || []);
      if (roomData.units && roomData.units.length > 0) {
        setSelectedUnitId(roomData.units[0].id);
      }
    } catch (error) {
      console.error("Failed to load beds:", error);
    } finally {
      setLoadingBeds(false);
    }
  };

  const handleReset = () => {
    setSelectedRoomId(null);
    setSelectedUnitId(null);
    setSelectedBedId(null);
    setTransferReason("");
    setTransferType("");
    setNotes("");
  };

  const handleSubmit = async () => {
    if (!selectedRoomId || !selectedBedId) {
      toast({
        title: "Error",
        description: "Pilih ruangan dan bed tujuan",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      const data: CreateBedTransferInput = {
        to_room_id: selectedRoomId,
        to_bed_id: selectedBedId,
        transfer_reason: transferReason,
        transfer_type: transferType,
        notes: notes,
      };
      
      const response = await bedTransferApi.create(visitId, data);
      
      toast({
        title: "Berhasil",
        description: response.data.message || "Mutasi pasien berhasil",
      });
      
      // Reset form
      handleReset();
      
      // Reload transfers
      const transfersResponse = await bedTransferApi.getAll(visitId);
      setTransfers(transfersResponse.data.data || []);
      
      // Trigger refresh print options dan final visit
      window.dispatchEvent(new CustomEvent("refresh-print-options"));
      window.dispatchEvent(new CustomEvent("refresh-final-visit"));
      
      onTransferComplete?.();
    } catch (error: any) {
      toast({
        title: "Gagal",
        description: error.response?.data?.error || "Gagal melakukan mutasi",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const selectedUnit = roomUnits.find(u => u.id === selectedUnitId);
  const bedsInUnit = selectedUnit?.beds || [];

  const selectedRoom = rooms.find((r) => r.id === selectedRoomId);
  const selectedBed = bedsInUnit.find((b) => b.id === selectedBedId);

  if (loading) {
    return (
      <div className="-mx-4 sm:-mx-5 -my-4 sm:-my-5 p-6 sm:p-8 flex items-center justify-center min-h-[240px]">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="-mx-4 sm:-mx-5 -my-4 sm:-my-5">
      {/* Inline Sub-Tabs */}
      <div className="border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/30 px-4 sm:px-5">
        <div className="flex gap-6">
          <button
            type="button"
            onClick={() => setActiveTab("form")}
            className={cn(
              "py-2.5 text-xs font-bold uppercase tracking-wider transition-colors relative flex items-center gap-2",
              activeTab === "form"
                ? "text-neutral-900 dark:text-neutral-100"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <ArrowRightLeft className="h-3.5 w-3.5" />
            Form Mutasi
            {activeTab === "form" && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-neutral-900 dark:bg-white" />
            )}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("history")}
            className={cn(
              "py-2.5 text-xs font-bold uppercase tracking-wider transition-colors relative flex items-center gap-2",
              activeTab === "history"
                ? "text-neutral-900 dark:text-neutral-100"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <History className="h-3.5 w-3.5" />
            Riwayat Mutasi
            {transfers.length > 0 && (
              <Badge variant="secondary" className="rounded-none text-[10px] h-4 px-1.5 font-mono">
                {transfers.length}
              </Badge>
            )}
            {activeTab === "history" && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-neutral-900 dark:bg-white" />
            )}
          </button>
        </div>
      </div>

      {/* Form Tab */}
      {activeTab === "form" && !readOnly && (
        <fieldset disabled={saving} className="divide-y divide-neutral-200 dark:divide-neutral-800 border-b border-neutral-200 dark:border-neutral-800">
          {/* Room Selection */}
          <div className="p-4 sm:p-5 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="border-l-2 border-neutral-900 dark:border-neutral-100 pl-2.5 text-xs font-bold uppercase tracking-wider text-neutral-900 dark:text-neutral-100">
                Pilih Ruangan Tujuan
              </div>
              <span className="text-[11px] font-mono text-muted-foreground">
                {rooms.length} ruangan tersedia
              </span>
            </div>

            {rooms.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5">
                {rooms.map((room) => {
                  const isSelected = selectedRoomId === room.id;
                  const isCurrent = room.id === currentRoomId;
                  const availableBedCount = room.available_beds || 0;
                  const totalBedCount = room.total_beds || 0;

                  return (
                    <button
                      key={room.id}
                      type="button"
                      onClick={() => {
                        setSelectedRoomId(room.id);
                        setSelectedUnitId(null);
                        setSelectedBedId(null);
                      }}
                      disabled={availableBedCount === 0 && !isCurrent}
                      className={cn(
                        "p-3.5 rounded-none border text-left transition-all relative",
                        isSelected
                          ? "border-neutral-900 dark:border-neutral-100 bg-neutral-900/[0.04] dark:bg-white/[0.06] ring-1 ring-neutral-900 dark:ring-neutral-100"
                          : isCurrent
                          ? "border-amber-300 dark:border-amber-800 bg-amber-50/70 dark:bg-amber-950/30"
                          : availableBedCount === 0
                          ? "border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/30 opacity-50 cursor-not-allowed"
                          : "border-neutral-200 dark:border-neutral-800 hover:border-neutral-400 dark:hover:border-neutral-600 hover:bg-neutral-50 dark:hover:bg-neutral-900/40"
                      )}
                    >
                      {isSelected && (
                        <CheckCircle2 className="absolute top-2.5 right-2.5 h-4 w-4 text-neutral-900 dark:text-neutral-100" />
                      )}
                      {isCurrent && !isSelected && (
                        <span className="absolute top-2 right-2 text-[10px] font-semibold uppercase tracking-wider bg-amber-500 text-white px-1.5 py-0.5">
                          Sekarang
                        </span>
                      )}
                      <div className="font-semibold text-xs text-foreground pr-12 truncate">
                        {room.name}
                      </div>
                      <div className="text-[11px] font-mono text-muted-foreground mt-0.5">
                        {room.code}
                      </div>
                      <div className="mt-2 flex items-center justify-between gap-2">
                        <span
                          className={cn(
                            "text-[11px] font-mono font-medium inline-flex items-center gap-1",
                            availableBedCount > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"
                          )}
                        >
                          <Bed className="h-3 w-3" />
                          {availableBedCount} / {totalBedCount} bed
                        </span>
                        {room.room_class && (
                          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                            {room.room_class.replace(/_/g, " ")}
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="border border-destructive/40 bg-destructive/5 px-3.5 py-2.5 text-xs text-destructive">
                Tidak ada ruangan rawat inap yang tersedia
              </div>
            )}
          </div>

          {/* Unit and Bed Selection */}
          {selectedRoomId && (
            <div className="p-4 sm:p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="border-l-2 border-neutral-900 dark:border-neutral-100 pl-2.5 text-xs font-bold uppercase tracking-wider text-neutral-900 dark:text-neutral-100">
                  Pilih Kamar & Tempat Tidur
                </div>
                <div className="flex flex-wrap items-center gap-3 text-[11px]">
                  <div className="flex items-center gap-1.5">
                    <div className="w-3.5 h-3.5 bg-emerald-500"></div>
                    <span>Tersedia</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-3.5 h-3.5 bg-red-400"></div>
                    <span>Terisi</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-3.5 h-3.5 bg-amber-400"></div>
                    <span>Saat Ini</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-3.5 h-3.5 bg-neutral-900 dark:bg-white ring-1 ring-neutral-900 dark:ring-white ring-offset-1"></div>
                    <span>Dipilih</span>
                  </div>
                </div>
              </div>

              {loadingBeds ? (
                <div className="flex items-center justify-center py-8 border border-dashed border-neutral-300 dark:border-neutral-700 gap-2">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Memuat data tempat tidur...</span>
                </div>
              ) : roomUnits.length > 0 ? (
                <div className="space-y-4">
                  {/* Unit/Kamar Selection */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5">
                    {roomUnits.map((unit) => {
                      const availableCount = unit.beds?.filter((b) => b.status === "available").length || 0;
                      const totalCount = unit.beds?.length || 0;
                      const isSelected = selectedUnitId === unit.id;

                      return (
                        <button
                          key={unit.id}
                          type="button"
                          onClick={() => {
                            setSelectedUnitId(unit.id);
                            setSelectedBedId(null);
                          }}
                          disabled={availableCount === 0}
                          className={cn(
                            "p-3 rounded-none border text-left transition-all",
                            isSelected
                              ? "border-neutral-900 dark:border-neutral-100 bg-neutral-900/[0.04] dark:bg-white/[0.06] ring-1 ring-neutral-900 dark:ring-neutral-100"
                              : availableCount === 0
                              ? "border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/30 opacity-50 cursor-not-allowed"
                              : "border-neutral-200 dark:border-neutral-800 hover:border-neutral-400 dark:hover:border-neutral-600 hover:bg-neutral-50 dark:hover:bg-neutral-900/40"
                          )}
                        >
                          <div className="font-semibold text-xs text-foreground truncate">{unit.name}</div>
                          <div className="text-[11px] text-muted-foreground mt-0.5">Lantai {unit.floor || 1}</div>
                          <div
                            className={cn(
                              "text-[11px] font-mono font-medium mt-1.5",
                              availableCount > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"
                            )}
                          >
                            {availableCount} / {totalCount} bed
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {/* Bed Grid */}
                  {selectedUnit && (
                    <div className="border border-neutral-200 dark:border-neutral-800 bg-background">
                      <div className="bg-neutral-50 dark:bg-neutral-900 px-3.5 py-2 border-b border-neutral-200 dark:border-neutral-800 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                        {selectedUnit.name} — Lantai {selectedUnit.floor || 1}
                      </div>
                      <div className="p-3.5">
                        <TooltipProvider delayDuration={200}>
                          <div className="grid grid-cols-3 sm:grid-cols-6 md:grid-cols-8 gap-2">
                            {bedsInUnit.map((bed) => {
                              const isAvailable = bed.status === "available";
                              const isSelected = selectedBedId === bed.id;
                              const isCurrent = bed.id === currentBedId;
                              const canSelect = isAvailable && !isCurrent;

                              return (
                                <Tooltip key={bed.id}>
                                  <TooltipTrigger asChild>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        if (canSelect) {
                                          setSelectedBedId(isSelected ? null : bed.id);
                                        }
                                      }}
                                      className={cn(
                                        "aspect-square rounded-none flex flex-col items-center justify-center text-xs font-medium transition-all",
                                        isSelected
                                          ? "bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 ring-2 ring-neutral-900 dark:ring-white ring-offset-2 cursor-pointer"
                                          : isCurrent
                                          ? "bg-amber-400 text-amber-950 cursor-not-allowed"
                                          : canSelect
                                          ? "bg-emerald-500 text-white hover:bg-emerald-600 cursor-pointer"
                                          : "bg-red-400 text-white cursor-not-allowed"
                                      )}
                                    >
                                      <Bed className="h-4 w-4 mb-0.5" />
                                      <span className="font-mono text-[11px]">{bed.bed_number}</span>
                                      {isSelected && <Check className="h-3 w-3 mt-0.5" />}
                                    </button>
                                  </TooltipTrigger>
                                  <TooltipContent side="top" className="max-w-xs rounded-none">
                                    <div className="space-y-1">
                                      <p className="font-semibold">Bed {bed.bed_number}</p>
                                      {isCurrent ? (
                                        <p className="text-amber-600">★ Bed saat ini (pasien ini)</p>
                                      ) : isAvailable ? (
                                        <p className="text-emerald-600 dark:text-emerald-400">✓ Tersedia</p>
                                      ) : (
                                        <>
                                          <p className="text-red-600 dark:text-red-400">✗ Terisi</p>
                                          {bed.current_patient && (
                                            <div className="text-xs space-y-0.5 pt-1 border-t mt-1">
                                              <p><span className="font-medium">Pasien:</span> {bed.current_patient.name || "N/A"}</p>
                                              <p><span className="font-medium">RM:</span> {bed.current_patient.medical_record_number || "N/A"}</p>
                                              {bed.current_patient.admission_date && (
                                                <p>
                                                  <span className="font-medium">Masuk:</span>{" "}
                                                  {new Date(bed.current_patient.admission_date).toLocaleDateString("id-ID", {
                                                    day: "2-digit",
                                                    month: "short",
                                                    year: "numeric",
                                                  })}
                                                </p>
                                              )}
                                            </div>
                                          )}
                                        </>
                                      )}
                                    </div>
                                  </TooltipContent>
                                </Tooltip>
                              );
                            })}
                          </div>
                        </TooltipProvider>
                        {bedsInUnit.length === 0 && (
                          <p className="text-center text-xs text-muted-foreground py-4">
                            Tidak ada bed di kamar ini
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="border border-destructive/40 bg-destructive/5 px-3.5 py-2.5 text-xs text-destructive">
                  Tidak ada unit/kamar di ruangan ini
                </div>
              )}
            </div>
          )}

          {/* Transfer Type, Reason & Notes */}
          <div className="p-4 sm:p-5 space-y-4">
            <div className="border-l-2 border-neutral-900 dark:border-neutral-100 pl-2.5 text-xs font-bold uppercase tracking-wider text-neutral-900 dark:text-neutral-100">
              Detail Mutasi Kamar
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-medium">Tipe Mutasi</Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-2">
                {TRANSFER_TYPES.map((type) => (
                  <button
                    key={type.value}
                    type="button"
                    onClick={() => setTransferType(type.value)}
                    className={cn(
                      "px-3 py-2 rounded-none border text-xs font-medium transition-colors text-left sm:text-center",
                      transferType === type.value
                        ? "border-neutral-900 dark:border-neutral-100 bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"
                        : "border-neutral-200 dark:border-neutral-800 hover:border-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-900/40"
                    )}
                  >
                    {type.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="transfer_reason" className="text-xs font-medium">
                  Alasan Mutasi
                </Label>
                <Textarea
                  id="transfer_reason"
                  placeholder="Alasan memindahkan pasien ke kamar/bed lain..."
                  value={transferReason}
                  onChange={(e) => setTransferReason(e.target.value)}
                  className="min-h-[80px] text-xs rounded-none resize-none"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="transfer_notes" className="text-xs font-medium">
                  Catatan Tambahan (Opsional)
                </Label>
                <Textarea
                  id="transfer_notes"
                  placeholder="Catatan tambahan..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="min-h-[80px] text-xs rounded-none resize-none"
                />
              </div>
            </div>

            {selectedRoom && selectedBed && (
              <div className="border border-neutral-200 dark:border-neutral-800 border-l-2 border-l-neutral-900 dark:border-l-neutral-100 bg-neutral-50/70 dark:bg-neutral-900/40 px-3.5 py-2.5 flex items-center gap-2.5 text-xs">
                <Building className="h-4 w-4 text-neutral-700 dark:text-neutral-300 shrink-0" />
                <div>
                  <span className="font-semibold text-foreground">Konfirmasi Mutasi:</span>{" "}
                  <span className="text-muted-foreground">
                    Pasien akan dipindahkan ke{" "}
                    <strong className="text-foreground">{selectedRoom.name}</strong> — Bed{" "}
                    <strong className="text-foreground">{selectedBed.bed_number}</strong>
                    {transferType && <> ({getTransferTypeLabel(transferType)})</>}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="px-4 sm:px-5 py-3 bg-neutral-50/40 dark:bg-neutral-900/20 flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleReset}
              disabled={saving}
              className="h-8 rounded-none text-xs gap-1.5"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Reset
            </Button>
            <Button
              type="button"
              onClick={handleSubmit}
              disabled={saving || !selectedRoomId || !selectedBedId}
              className="h-8 rounded-none text-xs gap-1.5 bg-neutral-900 hover:bg-neutral-800 text-white dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
            >
              {saving ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Save className="h-3.5 w-3.5" />
              )}
              Simpan Mutasi
            </Button>
          </div>
        </fieldset>
      )}

      {/* Form Tab - readOnly empty state */}
      {activeTab === "form" && readOnly && (
        <div className="p-4 sm:p-5 border-b border-neutral-200 dark:border-neutral-800">
          <div className="border border-dashed border-neutral-300 dark:border-neutral-700 py-8 px-4 flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <ArrowRightLeft className="h-4 w-4 opacity-50" />
            <span>Mode hanya baca — tidak dapat melakukan mutasi kamar pada kunjungan ini.</span>
          </div>
        </div>
      )}

      {/* History Tab */}
      {activeTab === "history" && (
        <div className="p-4 sm:p-5 space-y-3 border-b border-neutral-200 dark:border-neutral-800">
          <div className="flex items-center justify-between gap-2">
            <div className="border-l-2 border-neutral-900 dark:border-neutral-100 pl-2.5 text-xs font-bold uppercase tracking-wider text-neutral-900 dark:text-neutral-100">
              Riwayat Mutasi Kamar
            </div>
            <span className="text-[11px] font-mono text-muted-foreground">
              {transfers.length} entri
            </span>
          </div>

          {transfers.length > 0 ? (
            <div className="border border-neutral-200 dark:border-neutral-800 divide-y divide-neutral-200 dark:divide-neutral-800">
              {transfers.map((transfer, index) => (
                <div
                  key={transfer.id}
                  className={cn(
                    "p-3.5 space-y-2.5",
                    index === 0 ? "bg-neutral-50/70 dark:bg-neutral-900/30" : "bg-background"
                  )}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <div className="border border-neutral-200 dark:border-neutral-800 bg-background px-2.5 py-1.5 min-w-[160px]">
                        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Dari Kamar / Bed</div>
                        <div className="text-xs font-semibold">
                          {transfer.from_room?.name || "Penempatan Awal"}
                          {transfer.from_bed && (
                            <span className="font-normal text-muted-foreground"> — Bed {transfer.from_bed.bed_number}</span>
                          )}
                        </div>
                      </div>

                      <ArrowRightLeft className="h-3.5 w-3.5 text-muted-foreground shrink-0" />

                      <div className="border border-neutral-900/20 dark:border-neutral-100/20 bg-neutral-50 dark:bg-neutral-900/60 px-2.5 py-1.5 min-w-[160px]">
                        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Ke Kamar / Bed</div>
                        <div className="text-xs font-semibold">
                          {transfer.to_room?.name || "-"}
                          {transfer.to_bed && (
                            <span className="font-normal text-muted-foreground"> — Bed {transfer.to_bed.bed_number}</span>
                          )}
                        </div>
                      </div>

                      {index === 0 && (
                        <Badge className="rounded-none text-[10px] h-5 px-1.5 bg-neutral-900 text-white dark:bg-white dark:text-neutral-900">
                          Terbaru
                        </Badge>
                      )}
                    </div>

                    <div className="text-left sm:text-right text-[11px] text-muted-foreground shrink-0">
                      <div className="flex items-center sm:justify-end gap-1 font-mono">
                        <Calendar className="h-3 w-3" />
                        {new Date(transfer.transfer_date).toLocaleDateString("id-ID", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </div>
                      {transfer.transfer_type && (
                        <Badge variant="outline" className="mt-1 rounded-none text-[10px] h-5 px-1.5">
                          {getTransferTypeLabel(transfer.transfer_type)}
                        </Badge>
                      )}
                    </div>
                  </div>

                  {(transfer.transfer_reason || transfer.notes) && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-neutral-100 dark:border-neutral-800/80 text-xs text-muted-foreground">
                      {transfer.transfer_reason && (
                        <p>
                          <span className="font-semibold text-foreground">Alasan:</span> {transfer.transfer_reason}
                        </p>
                      )}
                      {transfer.notes && (
                        <p>
                          <span className="font-semibold text-foreground">Catatan:</span> {transfer.notes}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="border border-dashed border-neutral-300 dark:border-neutral-700 py-8 px-4 flex items-center justify-center gap-2 text-xs text-muted-foreground">
              <History className="h-4 w-4 opacity-50" />
              <span>Belum ada riwayat mutasi kamar — pasien belum pernah dipindahkan ke kamar/bed lain.</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
