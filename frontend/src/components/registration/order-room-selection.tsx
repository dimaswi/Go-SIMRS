import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Combobox } from "@/components/ui/combobox";
import { cn } from "@/lib/utils";
import {
  medicineFormLabels,
  medicineTypeLabels,
  type RoomMedicine,
} from "@/lib/api/medicines";
import type { RoomProcedure } from "@/lib/api/procedures";
import { Loader2, Minus, Pill, Plus, ScanSearch, Stethoscope, X } from "lucide-react";

export interface SelectedProcedureItem {
  procedure_id: number;
  target_room_id?: number;
  notes: string;
}

interface OrderTargetRoomOption {
  value: string;
  label: string;
}

interface PharmacyRoomOption {
  value: string;
  label: string;
}

export interface SelectedMedicineItem {
  medicine_id: number;
  pharmacy_room_id?: number;
  quantity: number;
  unit: string;
  dosage: string;
  frequency: string;
  route: string;
  duration: string;
  instructions: string;
  notes: string;
}

interface OrderRoomSelectionProps {
  loading: boolean;
  procedures: RoomProcedure[];
  selectedProcedures: SelectedProcedureItem[];
  onToggleProcedure: (procedureId: number) => void;
  onUpdateProcedureTargetRoom?: (procedureId: number, targetRoomId: number | null) => void;
  orderRoomOptionsByProcedureId?: Record<number, OrderTargetRoomOption[]>;
  medicines: RoomMedicine[];
  selectedMedicines: SelectedMedicineItem[];
  onUpdateMedicinePharmacyRoom?: (medicineId: number, pharmacyRoomId: number | null) => void;
  pharmacyRoomOptionsByMedicineId?: Record<number, PharmacyRoomOption[]>;
  onAddMedicine: (medicine: RoomMedicine) => void;
  onUpdateMedicineQuantity: (medicineId: number, quantity: number) => void;
  onRemoveMedicine: (medicineId: number) => void;
  className?: string;
}

const PROCEDURE_TYPE_LABELS: Record<string, string> = {
  consultation: "Konsultasi",
  radiology: "Radiologi",
  laboratory: "Laboratorium",
  medical: "Medis",
};

function normalizeText(value?: string | null) {
  return (value || "").trim().toLowerCase();
}

export function OrderRoomSelection({
  loading,
  procedures,
  selectedProcedures,
  onToggleProcedure,
  onUpdateProcedureTargetRoom,
  orderRoomOptionsByProcedureId,
  medicines,
  selectedMedicines,
  onUpdateMedicinePharmacyRoom,
  pharmacyRoomOptionsByMedicineId,
  onAddMedicine,
  onUpdateMedicineQuantity,
  onRemoveMedicine,
  className,
}: OrderRoomSelectionProps) {
  const [procedureSearch, setProcedureSearch] = useState("");
  const [medicineSearch, setMedicineSearch] = useState("");
  const [procedureDialogOpen, setProcedureDialogOpen] = useState(false);
  const [procedureDialogMode, setProcedureDialogMode] = useState<"select-procedure" | "select-target-room">("select-procedure");
  const [medicineDialogOpen, setMedicineDialogOpen] = useState(false);
  const [medicineDialogMode, setMedicineDialogMode] = useState<"select-medicine" | "select-pharmacy-room">("select-medicine");

  const openProcedureSelectionDialog = () => {
    setProcedureDialogMode("select-procedure");
    setProcedureDialogOpen(true);
  };

  const openProcedureTargetRoomDialog = () => {
    setProcedureDialogMode("select-target-room");
    setProcedureDialogOpen(true);
  };

  const openMedicineSelectionDialog = () => {
    setMedicineDialogMode("select-medicine");
    setMedicineDialogOpen(true);
  };

  const openMedicinePharmacyDialog = () => {
    setMedicineDialogMode("select-pharmacy-room");
    setMedicineDialogOpen(true);
  };

  const procedureMap = useMemo(
    () => new Map(procedures.map((roomProcedure) => [roomProcedure.procedure_id, roomProcedure])),
    [procedures]
  );

  const medicineMap = useMemo(
    () => new Map(medicines.map((roomMedicine) => [roomMedicine.medicine_id, roomMedicine])),
    [medicines]
  );

  const filteredProcedures = useMemo(() => {
    const keyword = normalizeText(procedureSearch);
    if (!keyword) return procedures;

    return procedures.filter((roomProcedure) => {
      const procedure = roomProcedure.procedure;
      return [
        procedure?.name,
        procedure?.code,
        procedure?.description,
        PROCEDURE_TYPE_LABELS[procedure?.procedure_type || ""],
      ].some((value) => normalizeText(value).includes(keyword));
    });
  }, [procedureSearch, procedures]);

  const filteredMedicines = useMemo(() => {
    const keyword = normalizeText(medicineSearch);
    if (!keyword) return medicines;

    return medicines.filter((roomMedicine) => {
      const medicine = roomMedicine.medicine;
      return [
        medicine?.name,
        medicine?.code,
        medicine?.generic_name,
        medicine?.strength,
        medicine?.form,
        medicine?.type,
      ].some((value) => normalizeText(value).includes(keyword));
    });
  }, [medicineSearch, medicines]);

  const selectedProcedureDetails = selectedProcedures
    .map((item) => ({
      item,
      procedure: procedureMap.get(item.procedure_id)?.procedure,
    }))
    .filter((entry) => entry.procedure);

  const selectedMedicineDetails = selectedMedicines
    .map((item) => ({
      item,
      roomMedicine: medicineMap.get(item.medicine_id),
    }))
    .filter((entry) => entry.roomMedicine?.medicine);

  const selectionRows = [
    ...selectedProcedureDetails.map(({ item, procedure }, index) => {
      const roomOptions = orderRoomOptionsByProcedureId?.[item.procedure_id] || [];
      const selectedTargetRoomLabel = roomOptions.find((room) => Number(room.value) === item.target_room_id)?.label;
      const procedureType = procedure?.procedure_type;
      const isOrderableProcedure = procedureType === "consultation" || procedureType === "radiology" || procedureType === "laboratory";

      return {
        id: `procedure-${procedure!.id}`,
        no: index + 1,
        category: "Tindakan",
        name: procedure!.name,
        kind: "procedure" as const,
        procedureId: item.procedure_id,
        isOrderableProcedure,
        targetRoomId: item.target_room_id,
        targetRoomOptions: roomOptions,
        detail: [
          procedure!.code || "Tanpa kode",
          PROCEDURE_TYPE_LABELS[procedure!.procedure_type || ""] || "Tindakan",
          isOrderableProcedure
            ? (selectedTargetRoomLabel ? `Tujuan: ${selectedTargetRoomLabel}` : "Tujuan: belum dipilih")
            : null,
        ].join(" • "),
      };
    }),
    ...selectedMedicineDetails.map(({ item, roomMedicine }, index) => {
      const medicine = roomMedicine!.medicine!;
      const pharmacyOptions = pharmacyRoomOptionsByMedicineId?.[item.medicine_id] || [];
      const pharmacyRoomLabel = pharmacyOptions
        .find((room) => Number(room.value) === item.pharmacy_room_id)?.label;
      return {
        id: `medicine-${item.medicine_id}`,
        no: selectedProcedureDetails.length + index + 1,
        category: "Obat",
        name: medicine.name,
        kind: "medicine" as const,
        medicineId: item.medicine_id,
        pharmacyRoomId: item.pharmacy_room_id,
        pharmacyOptions,
        detail: [
          pharmacyRoomLabel ? `Farmasi: ${pharmacyRoomLabel}` : "Farmasi: belum dipilih",
          `Qty ${item.quantity} ${item.unit || medicine.unit || "unit"}`,
          medicine.form ? medicineFormLabels[medicine.form] || medicine.form : null,
          medicine.type ? medicineTypeLabels[medicine.type] || medicine.type : null,
          `Stok ${roomMedicine!.quantity}`,
        ]
          .filter(Boolean)
          .join(" • "),
      };
    }),
  ];

  if (!loading && procedures.length === 0 && medicines.length === 0) {
    return null;
  }

  const hasSelections = selectedProcedureDetails.length > 0 || selectedMedicineDetails.length > 0;

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        {procedures.length > 0 ? (
          <button
            type="button"
            onClick={openProcedureSelectionDialog}
            className="inline-flex items-center gap-1 text-xs font-medium text-sky-700 underline-offset-4 hover:text-sky-800 hover:underline"
          >
            <Stethoscope className="h-3.5 w-3.5" />
            Tambahkan tindakan
            {selectedProcedures.length > 0 ? (
              <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[11px]">
                {selectedProcedures.length}
              </Badge>
            ) : null}
          </button>
        ) : null}

        {medicines.length > 0 ? (
          <button
            type="button"
            onClick={openMedicineSelectionDialog}
            className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 underline-offset-4 hover:text-emerald-800 hover:underline"
          >
            <Pill className="h-3.5 w-3.5" />
            Tambahkan obat
            {selectedMedicines.length > 0 ? (
              <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[11px]">
                {selectedMedicines.length}
              </Badge>
            ) : null}
          </button>
        ) : null}
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Memuat tindakan dan obat ruangan...
        </div>
      ) : null}

      {!loading && hasSelections ? (
        <div className="overflow-hidden rounded-md border border-border/70 bg-background">
          <div className="border-b bg-muted/40 px-3 py-2 text-xs font-medium text-foreground">
            Ringkasan Item Terpilih
          </div>
          <div className="max-h-52 overflow-auto">
            <table className="w-full text-xs">
              <thead className="bg-muted/20 text-left text-muted-foreground">
                <tr>
                  <th className="w-12 px-3 py-2 font-medium">No</th>
                  <th className="w-24 px-3 py-2 font-medium">Jenis</th>
                  <th className="px-3 py-2 font-medium">Item</th>
                  <th className="px-3 py-2 font-medium">Informasi</th>
                </tr>
              </thead>
              <tbody>
                {selectionRows.map((row, index) => (
                  <tr key={row.id} className={cn("border-t", index % 2 === 0 ? "bg-background" : "bg-muted/10")}>
                    <td className="px-3 py-2 align-top text-muted-foreground">{row.no}</td>
                    <td className="px-3 py-2 align-top font-medium">{row.category}</td>
                    <td className="px-3 py-2 align-top text-foreground">{row.name}</td>
                    <td className="px-3 py-2 align-top text-muted-foreground">
                      <div className="space-y-1">
                        <div>{row.detail}</div>
                        {row.kind === "procedure" && row.isOrderableProcedure ? (
                          <button
                            type="button"
                            className="text-[11px] font-medium text-sky-700 underline-offset-2 hover:underline"
                            onClick={openProcedureTargetRoomDialog}
                          >
                            Atur ruangan
                          </button>
                        ) : null}
                        {row.kind === "medicine" ? (
                          <button
                            type="button"
                            className="text-[11px] font-medium text-emerald-700 underline-offset-2 hover:underline"
                            onClick={openMedicinePharmacyDialog}
                          >
                            Atur farmasi
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      <Dialog
        open={procedureDialogOpen}
        onOpenChange={(open) => {
          setProcedureDialogOpen(open);
          if (!open) {
            setProcedureDialogMode("select-procedure");
          }
        }}
      >
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              {procedureDialogMode === "select-target-room" ? "Atur Ruangan Tindakan" : "Pilih Tindakan Ruangan"}
            </DialogTitle>
            <DialogDescription>
              {procedureDialogMode === "select-target-room"
                ? "Pilih ruangan tindak lanjut untuk tindakan order yang sudah dipilih."
                : "Cari berdasarkan nama, kode, atau jenis tindakan. Klik item untuk memilih atau membatalkan pilihan."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {procedureDialogMode === "select-target-room" ? (
              <div className="space-y-2 rounded-lg border bg-amber-50/60 p-3">
                <p className="text-xs font-medium text-amber-900">Ruangan tindak lanjut tindakan order</p>
                <div className="space-y-2">
                  {selectedProcedureDetails
                    .filter(({ procedure }) => {
                      const t = procedure?.procedure_type;
                      return t === "consultation" || t === "radiology" || t === "laboratory";
                    })
                    .map(({ item, procedure }) => (
                      <div key={`target-room-${item.procedure_id}`} className="grid gap-1">
                        <p className="text-xs font-medium text-foreground">{procedure?.name}</p>
                        <Combobox
                          options={orderRoomOptionsByProcedureId?.[item.procedure_id] || []}
                          value={item.target_room_id ? String(item.target_room_id) : ""}
                          onValueChange={(value) =>
                            onUpdateProcedureTargetRoom?.(
                              item.procedure_id,
                              value ? Number(value) : null
                            )
                          }
                          placeholder="Pilih ruangan tindak lanjut"
                          searchPlaceholder="Cari ruangan..."
                          emptyText="Belum ada ruangan yang mendukung tindakan ini"
                          className="h-8 text-xs"
                        />
                      </div>
                    ))}
                </div>
              </div>
            ) : (
              <>
                <div className="relative">
                  <ScanSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={procedureSearch}
                    onChange={(event) => setProcedureSearch(event.target.value)}
                    placeholder="Cari tindakan ruangan..."
                    className="pl-9"
                  />
                </div>

                {selectedProcedureDetails.length > 0 ? (
                  <div className="rounded-lg border bg-sky-50/60 p-3">
                    <p className="mb-2 text-xs font-medium text-sky-900">Tindakan dipilih</p>
                    <div className="flex flex-wrap gap-2">
                      {selectedProcedureDetails.map(({ item, procedure }) => (
                        <Badge key={item.procedure_id} variant="secondary" className="gap-1 bg-sky-100 text-sky-900 hover:bg-sky-100">
                          <span className="max-w-[240px] truncate">{procedure!.name}</span>
                          <button
                            type="button"
                            className="inline-flex"
                            onClick={() => onToggleProcedure(item.procedure_id)}
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  </div>
                ) : null}

                <div className="max-h-[55vh] overflow-y-auto pr-1">
                  {filteredProcedures.length > 0 ? (
                    <div className="grid gap-2 lg:grid-cols-2">
                      {filteredProcedures.map((roomProcedure) => {
                        const procedure = roomProcedure.procedure;
                        const isSelected = selectedProcedures.some((item) => item.procedure_id === roomProcedure.procedure_id);
                        const typeLabel = PROCEDURE_TYPE_LABELS[procedure?.procedure_type || ""] || "Tindakan";

                        return (
                          <button
                            key={roomProcedure.id}
                            type="button"
                            onClick={() => onToggleProcedure(roomProcedure.procedure_id)}
                            className={cn(
                              "rounded-xl border p-3 text-left transition-colors",
                              isSelected ? "border-sky-500 bg-sky-50" : "hover:border-slate-300 hover:bg-muted/40"
                            )}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0 space-y-1">
                                <p className="truncate text-sm font-medium">{procedure?.name}</p>
                                <p className="text-xs text-muted-foreground">{procedure?.code || "Tanpa kode tindakan"}</p>
                              </div>
                              <Badge variant={isSelected ? "default" : "outline"} className="shrink-0">
                                {typeLabel}
                              </Badge>
                            </div>
                            <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                              {roomProcedure.requires_booking ? <span>Perlu booking</span> : <span>Siap order langsung</span>}
                              {roomProcedure.max_per_day > 0 ? <span>Maks. {roomProcedure.max_per_day}/hari</span> : null}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="rounded-lg border border-dashed py-8 text-center text-sm text-muted-foreground">
                      Tidak ada tindakan yang cocok dengan pencarian.
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          <DialogFooter>
            <Button type="button" onClick={() => setProcedureDialogOpen(false)}>
              Selesai
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={medicineDialogOpen}
        onOpenChange={(open) => {
          setMedicineDialogOpen(open);
          if (!open) {
            setMedicineDialogMode("select-medicine");
          }
        }}
      >
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>
              {medicineDialogMode === "select-pharmacy-room" ? "Atur Farmasi Obat" : "Pilih Obat Ruangan"}
            </DialogTitle>
            <DialogDescription>
              {medicineDialogMode === "select-pharmacy-room"
                ? "Pilih ruangan farmasi untuk setiap obat yang sudah dipilih."
                : "Cari obat ruangan, lihat stok yang tersedia, lalu atur jumlah pada panel obat yang sudah dipilih."}
            </DialogDescription>
          </DialogHeader>

          {medicineDialogMode === "select-pharmacy-room" ? (
            <div className="space-y-2 rounded-lg border bg-emerald-50/60 p-3">
              <p className="text-xs font-medium text-emerald-900">Ruangan farmasi per item obat</p>
              <div className="space-y-2">
                {selectedMedicineDetails.length > 0 ? selectedMedicineDetails.map(({ item, roomMedicine }) => {
                  const medicine = roomMedicine!.medicine!;
                  const pharmacyOptions = pharmacyRoomOptionsByMedicineId?.[item.medicine_id] || [];
                  return (
                    <div key={`pharmacy-room-${item.medicine_id}`} className="grid gap-1">
                      <p className="text-xs font-medium text-foreground">{medicine.name}</p>
                      <Combobox
                        options={pharmacyOptions}
                        value={item.pharmacy_room_id ? String(item.pharmacy_room_id) : ""}
                        onValueChange={(value) =>
                          onUpdateMedicinePharmacyRoom?.(
                            item.medicine_id,
                            value ? Number(value) : null
                          )
                        }
                        placeholder="Pilih farmasi tujuan"
                        searchPlaceholder="Cari ruangan farmasi..."
                        emptyText="Obat belum ter-assign ke farmasi mana pun"
                        className="h-8 text-xs"
                      />
                    </div>
                  );
                }) : (
                  <div className="rounded-lg border border-dashed py-8 text-center text-sm text-muted-foreground">
                    Belum ada obat dipilih.
                  </div>
                )}
              </div>
            </div>
          ) : (
          <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="space-y-4">
              <div className="relative">
                <ScanSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={medicineSearch}
                  onChange={(event) => setMedicineSearch(event.target.value)}
                  placeholder="Cari obat ruangan..."
                  className="pl-9"
                />
              </div>

              <div className="max-h-[52vh] overflow-y-auto pr-1">
                {filteredMedicines.length > 0 ? (
                  <div className="grid gap-2">
                    {filteredMedicines.map((roomMedicine) => {
                      const medicine = roomMedicine.medicine;
                      const isSelected = selectedMedicines.some((item) => item.medicine_id === roomMedicine.medicine_id);

                      return (
                        <button
                          key={roomMedicine.id}
                          type="button"
                          onClick={() => onAddMedicine(roomMedicine)}
                          disabled={isSelected}
                          className={cn(
                            "rounded-xl border p-3 text-left transition-colors disabled:cursor-default",
                            isSelected
                              ? "border-emerald-500 bg-emerald-50"
                              : "hover:border-slate-300 hover:bg-muted/40"
                          )}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 space-y-1">
                              <p className="truncate text-sm font-medium">{medicine?.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {[medicine?.code, medicine?.generic_name, medicine?.strength].filter(Boolean).join(" • ") || "Tanpa detail tambahan"}
                              </p>
                            </div>
                            <Badge variant={isSelected ? "default" : "outline"} className="shrink-0">
                              {isSelected ? "Dipilih" : `${roomMedicine.quantity} ${medicine?.unit || "unit"}`}
                            </Badge>
                          </div>
                          <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                            {medicine?.form ? <span>{medicineFormLabels[medicine.form] || medicine.form}</span> : null}
                            {medicine?.type ? <span>{medicineTypeLabels[medicine.type] || medicine.type}</span> : null}
                            <span>Stok ruangan {roomMedicine.quantity}</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="rounded-lg border border-dashed py-8 text-center text-sm text-muted-foreground">
                    Tidak ada obat yang cocok dengan pencarian.
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-3 rounded-xl border bg-muted/20 p-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold">Obat Dipilih</p>
                  <p className="text-xs text-muted-foreground">Atur jumlah atau hapus item dari sini.</p>
                </div>
                <Badge variant="secondary">{selectedMedicines.length}</Badge>
              </div>

              <div className="max-h-[52vh] space-y-2 overflow-y-auto pr-1">
                {selectedMedicineDetails.length > 0 ? (
                  selectedMedicineDetails.map(({ item, roomMedicine }) => {
                    const medicine = roomMedicine!.medicine!;
                    const pharmacyOptions = pharmacyRoomOptionsByMedicineId?.[item.medicine_id] || [];
                    return (
                      <div key={item.medicine_id} className="rounded-lg border bg-background p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">{medicine.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {[medicine.code, medicine.generic_name, medicine.strength].filter(Boolean).join(" • ") || "Tanpa detail tambahan"}
                            </p>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive"
                            onClick={() => onRemoveMedicine(item.medicine_id)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>

                        <div className="mt-3 space-y-1">
                          <p className="text-xs font-medium text-muted-foreground">Farmasi Tujuan</p>
                          <Combobox
                            options={pharmacyOptions}
                            value={item.pharmacy_room_id ? String(item.pharmacy_room_id) : ""}
                            onValueChange={(value) =>
                              onUpdateMedicinePharmacyRoom?.(
                                item.medicine_id,
                                value ? Number(value) : null
                              )
                            }
                            placeholder="Pilih farmasi tujuan"
                            searchPlaceholder="Cari ruangan farmasi..."
                            emptyText="Obat belum ter-assign ke farmasi mana pun"
                            className="h-8 text-xs"
                          />
                        </div>

                        <div className="mt-3 flex items-center gap-2">
                          <div className="flex items-center gap-1 rounded-lg border bg-background px-1 py-1">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => onUpdateMedicineQuantity(item.medicine_id, item.quantity - 1)}
                            >
                              <Minus className="h-3 w-3" />
                            </Button>
                            <Input
                              type="number"
                              min={1}
                              value={item.quantity}
                              onChange={(event) => onUpdateMedicineQuantity(item.medicine_id, parseInt(event.target.value, 10) || 1)}
                              className="h-8 w-16 border-0 px-1 text-center shadow-none"
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => onUpdateMedicineQuantity(item.medicine_id, item.quantity + 1)}
                            >
                              <Plus className="h-3 w-3" />
                            </Button>
                          </div>
                          <span className="text-xs text-muted-foreground">{item.unit || medicine.unit}</span>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="rounded-lg border border-dashed py-8 text-center text-sm text-muted-foreground">
                    Belum ada obat dipilih.
                  </div>
                )}
              </div>
            </div>
          </div>
          )}

          <DialogFooter>
            <Button type="button" onClick={() => setMedicineDialogOpen(false)}>
              Selesai
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}