import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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

  if (loading) {
    return (
      <div>
        <div className="p-6 flex items-center justify-center min-h-[300px]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="space-y-3">
        <div className="rounded-lg border border-border/70 bg-muted/20 px-3 py-3 sm:px-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-foreground">Mutasi Pasien</p>
              <p className="text-xs text-muted-foreground">Kelola perpindahan kamar/bed dan pantau riwayat mutasi pasien.</p>
            </div>
            <div className="inline-flex items-center gap-1 rounded-md border border-border/70 bg-background p-1">
              <button
                type="button"
                onClick={() => setActiveTab("form")}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-medium transition-colors",
                  activeTab === "form"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <ArrowRightLeft className="h-3.5 w-3.5" />
                Form Mutasi
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("history")}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-medium transition-colors",
                  activeTab === "history"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <History className="h-3.5 w-3.5" />
                Riwayat
                {transfers.length > 0 && (
                  <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
                    {transfers.length}
                  </Badge>
                )}
              </button>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-border/70 bg-background overflow-hidden">
          <div className="border-b border-border/70 bg-muted/30 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            {activeTab === "form" ? "Form Mutasi Pasien" : "Riwayat Mutasi Pasien"}
          </div>

          <div className="p-4 space-y-6">
            {/* Form Tab */}
            {activeTab === "form" && !readOnly && (
              <fieldset disabled={saving}>
                {/* Room Selection */}
                <div className="space-y-3">
                  <Label className="text-sm font-semibold flex items-center gap-2">
                    <Building className="h-4 w-4" />
                    Pilih Ruangan Tujuan
                  </Label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                    {rooms.map(room => {
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
                            "p-4 rounded-lg border-2 text-left transition-all relative",
                            isSelected
                              ? "border-primary bg-primary/10 ring-2 ring-primary/20"
                              : isCurrent
                              ? "border-yellow-400 bg-yellow-50"
                              : availableBedCount === 0
                              ? "border-muted bg-muted/30 opacity-50 cursor-not-allowed"
                              : "border-muted hover:border-primary/50 hover:bg-muted/30"
                          )}
                        >
                          {isSelected && (
                            <CheckCircle2 className="absolute top-2 right-2 h-5 w-5 text-primary" />
                          )}
                          {isCurrent && !isSelected && (
                            <span className="absolute top-2 right-2 text-xs bg-yellow-400 text-yellow-900 px-1.5 py-0.5 rounded font-medium">
                              Sekarang
                            </span>
                          )}
                          <div className="font-semibold text-sm mb-1">{room.name}</div>
                          <div className="text-xs text-muted-foreground">{room.code}</div>
                          <div className={cn(
                            "text-xs font-medium mt-2 flex items-center gap-1",
                            availableBedCount > 0 ? "text-green-600" : "text-red-600"
                          )}>
                            <Bed className="h-3 w-3" />
                            {availableBedCount} / {totalBedCount} tersedia
                          </div>
                          {room.room_class && (
                            <div className="text-xs text-muted-foreground mt-1 capitalize">
                              {room.room_class.replace(/_/g, ' ')}
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                  {rooms.length === 0 && (
                    <Alert variant="destructive">
                      <AlertDescription>Tidak ada ruangan rawat inap yang tersedia</AlertDescription>
                    </Alert>
                  )}
                </div>

                {/* Unit and Bed Selection */}
                {selectedRoomId && (
                  <div className="space-y-4 border rounded-lg p-4 bg-muted/30 mt-6">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <Label className="text-sm font-semibold flex items-center gap-2">
                        <Bed className="h-4 w-4" />
                        Pilih Tempat Tidur
                      </Label>
                      <div className="flex items-center gap-4 text-xs">
                        <div className="flex items-center gap-1">
                          <div className="w-4 h-4 rounded bg-green-500"></div>
                          <span>Tersedia</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <div className="w-4 h-4 rounded bg-red-400"></div>
                          <span>Terisi</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <div className="w-4 h-4 rounded bg-yellow-400"></div>
                          <span>Saat Ini</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <div className="w-4 h-4 rounded bg-primary ring-2 ring-primary ring-offset-2"></div>
                          <span>Dipilih</span>
                        </div>
                      </div>
                    </div>

                    {loadingBeds ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-6 w-6 animate-spin text-primary" />
                        <span className="ml-2 text-sm text-muted-foreground">Memuat data bed...</span>
                      </div>
                    ) : roomUnits.length > 0 ? (
                      <div className="space-y-4">
                        {/* Unit/Kamar Tabs */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                          {roomUnits.map(unit => {
                            const availableCount = unit.beds?.filter(b => b.status === 'available').length || 0;
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
                                  "p-3 rounded-lg border-2 text-left transition-all",
                                  isSelected
                                    ? "border-primary bg-primary/10 ring-2 ring-primary/20"
                                    : availableCount === 0
                                    ? "border-muted bg-muted/30 opacity-50 cursor-not-allowed"
                                    : "border-muted hover:border-primary/50 hover:bg-muted/30"
                                )}
                              >
                                <div className="font-semibold text-sm mb-1">{unit.name}</div>
                                <div className="text-xs text-muted-foreground">Lantai {unit.floor || 1}</div>
                                <div className={cn(
                                  "text-xs font-medium mt-1.5",
                                  availableCount > 0 ? "text-green-600" : "text-red-600"
                                )}>
                                  {availableCount} / {totalCount} bed
                                </div>
                              </button>
                            );
                          })}
                        </div>

                        {/* Bed Grid */}
                        {selectedUnit && (
                          <div className="bg-background rounded-lg p-4 border">
                            <div className="text-center text-xs text-muted-foreground mb-4 pb-2 border-b">
                              {selectedUnit.name} - Lantai {selectedUnit.floor || 1}
                            </div>
                            <TooltipProvider delayDuration={200}>
                              <div className="grid grid-cols-2 sm:grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2">
                                {bedsInUnit.map(bed => {
                                  const isAvailable = bed.status === 'available';
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
                                            "aspect-square rounded-lg flex flex-col items-center justify-center text-xs font-medium transition-all",
                                            isSelected
                                              ? "bg-primary text-primary-foreground ring-2 ring-primary ring-offset-2 cursor-pointer"
                                              : isCurrent
                                              ? "bg-yellow-400 text-yellow-900 cursor-not-allowed"
                                              : canSelect
                                              ? "bg-green-500 text-white hover:bg-green-600 cursor-pointer"
                                              : "bg-red-400 text-white cursor-not-allowed"
                                          )}
                                        >
                                          <Bed className="h-4 w-4 mb-0.5" />
                                          <span>{bed.bed_number}</span>
                                          {isSelected && <Check className="h-3 w-3 mt-0.5" />}
                                        </button>
                                      </TooltipTrigger>
                                      <TooltipContent side="top" className="max-w-xs">
                                        <div className="space-y-1">
                                          <p className="font-semibold">Bed {bed.bed_number}</p>
                                          {isCurrent ? (
                                            <p className="text-yellow-600">★ Bed saat ini (pasien ini)</p>
                                          ) : isAvailable ? (
                                            <p className="text-green-600 dark:text-green-400">✓ Tersedia</p>
                                          ) : (
                                            <>
                                              <p className="text-red-600 dark:text-red-400">✗ Terisi</p>
                                              {bed.current_patient && (
                                                <div className="text-sm space-y-0.5 pt-1 border-t mt-1">
                                                  <p><span className="font-medium">Pasien:</span> {bed.current_patient.name || 'N/A'}</p>
                                                  <p><span className="font-medium">RM:</span> {bed.current_patient.medical_record_number || 'N/A'}</p>
                                                  {bed.current_patient.admission_date && (
                                                    <p><span className="font-medium">Masuk:</span> {new Date(bed.current_patient.admission_date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
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
                              <p className="text-center text-sm text-muted-foreground py-4">
                                Tidak ada bed di kamar ini
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    ) : (
                      <Alert variant="destructive" className="py-2">
                        <AlertDescription>
                          Tidak ada unit/kamar di ruangan ini
                        </AlertDescription>
                      </Alert>
                    )}
                  </div>
                )}

                {/* Transfer Type */}
                <div className="space-y-3 mt-6">
                  <Label className="text-sm font-semibold">Tipe Mutasi</Label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-2">
                    {TRANSFER_TYPES.map(type => (
                      <button
                        key={type.value}
                        type="button"
                        onClick={() => setTransferType(type.value)}
                        className={cn(
                          "p-3 rounded-lg border-2 text-sm transition-all",
                          transferType === type.value
                            ? "border-primary bg-primary/10 ring-2 ring-primary/20"
                            : "border-muted hover:border-primary/50 hover:bg-muted/30"
                        )}
                      >
                        {type.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Reason */}
                <div className="space-y-2 mt-6">
                  <Label htmlFor="transfer_reason" className="text-sm font-semibold">
                    Alasan Mutasi
                  </Label>
                  <Textarea
                    id="transfer_reason"
                    placeholder="Alasan memindahkan pasien ke kamar/bed lain..."
                    value={transferReason}
                    onChange={(e) => setTransferReason(e.target.value)}
                    className="min-h-[80px] resize-none"
                  />
                </div>

                {/* Notes */}
                <div className="space-y-2 mt-4">
                  <Label htmlFor="transfer_notes" className="text-sm">
                    Catatan Tambahan (Opsional)
                  </Label>
                  <Textarea
                    id="transfer_notes"
                    placeholder="Catatan tambahan..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="min-h-[60px] resize-none"
                  />
                </div>

                {/* Summary */}
                {selectedRoomId && selectedBedId && (
                  <Alert className="bg-blue-50 border-blue-200 mt-6">
                    <Building className="h-4 w-4 text-blue-600" />
                    <AlertTitle className="text-blue-700">Konfirmasi Mutasi</AlertTitle>
                    <AlertDescription className="text-blue-600">
                      Pasien akan dipindahkan ke{' '}
                      <strong>{rooms.find(r => r.id === selectedRoomId)?.name}</strong>
                      {' '}- Bed <strong>{bedsInUnit.find(b => b.id === selectedBedId)?.bed_number}</strong>
                      {transferType && <> ({getTransferTypeLabel(transferType)})</>}
                    </AlertDescription>
                  </Alert>
                )}

                {/* Action Buttons */}
                <div className="flex items-center justify-end gap-3 pt-6 border-t mt-6">
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={handleReset}
                    disabled={saving}
                  >
                    Reset
                  </Button>
                  <Button
                    type="button"
                    onClick={handleSubmit}
                    disabled={saving || !selectedRoomId || !selectedBedId}
                    className="gap-2"
                  >
                    {saving ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4" />
                    )}
                    Simpan Mutasi
                  </Button>
                </div>
              </fieldset>
            )}

            {/* Form Tab - readOnly empty state */}
            {activeTab === "form" && readOnly && (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <ArrowRightLeft className="h-12 w-12 text-muted-foreground/30 mb-3" />
                <p className="text-muted-foreground">Mode Hanya Baca</p>
                <p className="text-sm text-muted-foreground">
                  Tidak dapat melakukan mutasi pada kunjungan ini
                </p>
              </div>
            )}

            {/* History Tab */}
            {activeTab === "history" && (
              <div className="space-y-3">
                {transfers.length > 0 ? (
                  transfers.map((transfer, index) => (
                    <div
                      key={transfer.id}
                      className={cn(
                        "p-3 rounded-lg border",
                        index === 0 ? "bg-primary/5 border-primary/20" : "bg-muted/30"
                      )}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-center gap-3 flex-wrap">
                          {/* From */}
                          <div className="flex items-center gap-2 p-2 rounded bg-background border text-sm">
                            <Building className="h-4 w-4 text-muted-foreground" />
                            <div>
                              <span className="font-medium">{transfer.from_room?.name || "Penempatan Awal"}</span>
                              {transfer.from_bed && (
                                <span className="text-muted-foreground"> - Bed {transfer.from_bed.bed_number}</span>
                              )}
                            </div>
                          </div>
                          
                          {/* Arrow */}
                          <ArrowRightLeft className="h-4 w-4 text-muted-foreground" />
                          
                          {/* To */}
                          <div className="flex items-center gap-2 p-2 rounded bg-primary/10 border-primary/20 border text-sm">
                            <Building className="h-4 w-4 text-primary" />
                            <div>
                              <span className="font-medium">{transfer.to_room?.name}</span>
                              <span className="text-muted-foreground"> - Bed {transfer.to_bed?.bed_number}</span>
                            </div>
                          </div>
                        </div>
                        
                        {/* Info */}
                        <div className="text-right text-sm shrink-0">
                          <div className="flex items-center justify-end gap-1 text-xs text-muted-foreground">
                            <Calendar className="h-3 w-3" />
                            {new Date(transfer.transfer_date).toLocaleDateString('id-ID', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </div>
                          {transfer.transfer_type && (
                            <span className="inline-block mt-1 px-2 py-0.5 text-xs rounded-full bg-primary/10 text-primary">
                              {getTransferTypeLabel(transfer.transfer_type)}
                            </span>
                          )}
                        </div>
                      </div>
                      
                      {/* Reason */}
                      {transfer.transfer_reason && (
                        <p className="mt-2 text-sm text-muted-foreground">
                          <span className="font-medium text-foreground">Alasan:</span> {transfer.transfer_reason}
                        </p>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <History className="h-12 w-12 text-muted-foreground/30 mb-3" />
                    <p className="text-muted-foreground">Belum ada riwayat mutasi</p>
                    <p className="text-sm text-muted-foreground">
                      Pasien belum pernah dipindahkan ke kamar/bed lain
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
