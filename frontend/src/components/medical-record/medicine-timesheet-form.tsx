import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { medicineOrdersApi, medicinesApi } from "@/lib/api";
import type {
  Medicine,
  MedicationTimesheetEntry,
  MedicationTimesheetItem,
  MedicationTimesheetReasonCode,
  MedicationTimesheetStatus,
} from "@/lib/api";
import { emitMedicalRecordTabIndicator, emitMedicalRecordTabSaved } from "@/components/medical-record/tab-indicator";
import { CalendarClock, ChevronLeft, ChevronRight, Loader2, Plus, Trash2 } from "lucide-react";

interface MedicineTimesheetFormProps {
  visitId: number;
  readOnly?: boolean;
}

interface SelectedTimesheetCell {
  itemId: number;
  hour: number;
}

interface TimesheetEditorState {
  status: MedicationTimesheetStatus | "";
  reasonCode: MedicationTimesheetReasonCode | "";
  reasonDetail: string;
  notes: string;
}

interface TimesheetStatusOption {
  value: MedicationTimesheetStatus;
  label: string;
  shortLabel: string;
}

interface TimesheetReasonOption {
  value: MedicationTimesheetReasonCode;
  label: string;
}

const TIMESHEET_HOURS = Array.from({ length: 24 }, (_, i) => i);

const TIMESHEET_STATUS_OPTIONS: TimesheetStatusOption[] = [
  { value: "given", label: "Diberikan", shortLabel: "OK" },
  { value: "held", label: "Ditahan", shortLabel: "HLD" },
  { value: "skipped", label: "Dilewati", shortLabel: "SKP" },
  { value: "refused", label: "Ditolak Pasien", shortLabel: "RFS" },
  { value: "not_available", label: "Obat Tidak Tersedia", shortLabel: "N/A" },
  { value: "contraindicated", label: "Kontraindikasi", shortLabel: "KON" },
  { value: "patient_absent", label: "Pasien Tidak di Ruangan", shortLabel: "ABS" },
  { value: "scheduled", label: "Terjadwal", shortLabel: "SCH" },
];

const TIMESHEET_REASON_OPTIONS: TimesheetReasonOption[] = [
  { value: "clinical_hold", label: "Pertimbangan klinis sementara" },
  { value: "contraindication", label: "Kontraindikasi" },
  { value: "patient_refused", label: "Pasien menolak" },
  { value: "drug_unavailable", label: "Stok/obat tidak tersedia" },
  { value: "patient_unavailable", label: "Pasien tidak ada di tempat" },
  { value: "other", label: "Lainnya" },
];

const emptyEditorState: TimesheetEditorState = {
  status: "",
  reasonCode: "",
  reasonDetail: "",
  notes: "",
};

const emptyItemForm = {
  medicineId: "",
  quantity: "1",
  unit: "",
  dosage: "",
  frequency: "",
  route: "",
  duration: "",
  instructions: "",
};

const getTimesheetStatusShortLabel = (status?: MedicationTimesheetStatus) => {
  if (!status) return "-";
  return TIMESHEET_STATUS_OPTIONS.find((option) => option.value === status)?.shortLabel || "-";
};

const getTimesheetStatusLabel = (status?: MedicationTimesheetStatus) => {
  if (!status) return "Belum diisi";
  return TIMESHEET_STATUS_OPTIONS.find((option) => option.value === status)?.label || status;
};

const getTimesheetReasonLabel = (reasonCode?: MedicationTimesheetReasonCode) => {
  if (!reasonCode) return "-";
  return TIMESHEET_REASON_OPTIONS.find((option) => option.value === reasonCode)?.label || reasonCode;
};

const requiresReason = (status: MedicationTimesheetStatus | "") => {
  return status !== "" && status !== "given" && status !== "scheduled";
};

const getAllowedReasonOptions = (status: MedicationTimesheetStatus | "") => {
  if (!requiresReason(status)) return [];

  if (status === "refused") {
    return TIMESHEET_REASON_OPTIONS.filter((option) => ["patient_refused", "other"].includes(option.value));
  }

  if (status === "not_available") {
    return TIMESHEET_REASON_OPTIONS.filter((option) => ["drug_unavailable", "other"].includes(option.value));
  }

  if (status === "contraindicated") {
    return TIMESHEET_REASON_OPTIONS.filter((option) =>
      ["contraindication", "clinical_hold", "other"].includes(option.value),
    );
  }

  if (status === "patient_absent") {
    return TIMESHEET_REASON_OPTIONS.filter((option) => ["patient_unavailable", "other"].includes(option.value));
  }

  return TIMESHEET_REASON_OPTIONS;
};

const getCellButtonClassName = (status: MedicationTimesheetStatus | undefined, selected: boolean) => {
  const base = "h-11 w-full rounded-md border p-1 text-[11px] font-semibold transition-colors";
  const stateClass = (() => {
    switch (status) {
      case "given":
        return "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-300";
      case "held":
        return "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-300";
      case "skipped":
        return "border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-300";
      case "refused":
        return "border-red-200 bg-red-50 text-red-700 hover:bg-red-100 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300";
      case "not_available":
        return "border-slate-200 bg-slate-100 text-slate-700 hover:bg-slate-200 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-300";
      case "contraindicated":
        return "border-violet-200 bg-violet-50 text-violet-700 hover:bg-violet-100 dark:border-violet-900/40 dark:bg-violet-950/30 dark:text-violet-300";
      case "patient_absent":
        return "border-orange-200 bg-orange-50 text-orange-700 hover:bg-orange-100 dark:border-orange-900/40 dark:bg-orange-950/30 dark:text-orange-300";
      case "scheduled":
        return "border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-100 dark:border-sky-900/40 dark:bg-sky-950/30 dark:text-sky-300";
      default:
        return "bg-background text-muted-foreground border-dashed hover:bg-muted/30";
    }
  })();
  const selectedClass = selected ? "ring-2 ring-primary/60" : "";
  return cn(base, stateClass, selectedClass);
};

const getStatusLegendClass = (status: MedicationTimesheetStatus) => {
  switch (status) {
    case "given":
      return "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-300";
    case "held":
      return "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-300";
    case "skipped":
      return "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-300";
    case "refused":
      return "border-red-200 bg-red-50 text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300";
    case "not_available":
      return "border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-300";
    case "contraindicated":
      return "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-900/40 dark:bg-violet-950/30 dark:text-violet-300";
    case "patient_absent":
      return "border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-900/40 dark:bg-orange-950/30 dark:text-orange-300";
    case "scheduled":
      return "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900/40 dark:bg-sky-950/30 dark:text-sky-300";
    default:
      return "border-border bg-background text-foreground";
  }
};

export function MedicineTimesheetForm({ visitId, readOnly = false }: MedicineTimesheetFormProps) {
  const { toast } = useToast();
  const [inFlightKeys, setInFlightKeys] = useState<Set<string>>(new Set());
  const tableScrollRef = useRef<HTMLDivElement | null>(null);

  const [timesheetDate, setTimesheetDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [timesheetLoading, setTimesheetLoading] = useState(false);
  const [timesheetItems, setTimesheetItems] = useState<MedicationTimesheetItem[]>([]);
  const [timesheetEntries, setTimesheetEntries] = useState<Record<string, MedicationTimesheetEntry>>({});
  const [timesheetSavingKey, setTimesheetSavingKey] = useState<string | null>(null);
  const [selectedCell, setSelectedCell] = useState<SelectedTimesheetCell | null>(null);
  const [editorState, setEditorState] = useState<TimesheetEditorState>(emptyEditorState);

  const [isItemDialogOpen, setIsItemDialogOpen] = useState(false);
  const [itemForm, setItemForm] = useState(emptyItemForm);
  const [itemSubmitting, setItemSubmitting] = useState(false);
  const [deletingItemId, setDeletingItemId] = useState<number | null>(null);
  const [medicineOptions, setMedicineOptions] = useState<ComboboxOption[]>([]);
  const [medicineResults, setMedicineResults] = useState<Medicine[]>([]);
  const [medicineSearch, setMedicineSearch] = useState("");
  const [medicineLoading, setMedicineLoading] = useState(false);

  const getCellKey = (itemId: number, hour: number) => `${itemId}-${hour}`;

  const getCellEntry = (itemId: number, hour: number) => {
    return timesheetEntries[getCellKey(itemId, hour)];
  };

  const selectedItem = useMemo(() => {
    if (!selectedCell) return null;
    return timesheetItems.find((item) => item.item_id === selectedCell.itemId) || null;
  }, [selectedCell, timesheetItems]);

  const loggedSlotCount = useMemo(() => Object.keys(timesheetEntries).length, [timesheetEntries]);
  const selectedCellKey = selectedCell ? getCellKey(selectedCell.itemId, selectedCell.hour) : null;
  const allowedReasonOptions = useMemo(() => getAllowedReasonOptions(editorState.status), [editorState.status]);

  const scrollTableHours = (direction: "left" | "right") => {
    const container = tableScrollRef.current;
    if (!container) return;
    container.scrollBy({
      left: direction === "left" ? -420 : 420,
      behavior: "smooth",
    });
  };

  const closeEditor = () => {
    setSelectedCell(null);
    setEditorState(emptyEditorState);
  };

  const resetItemForm = () => {
    setItemForm(emptyItemForm);
    setMedicineSearch("");
  };

  const loadMedicineOptions = async (search: string) => {
    setMedicineLoading(true);
    try {
      const response = await medicinesApi.getAll({
        page: 1,
        limit: 20,
        is_active: true,
        search: search.trim() || undefined,
      });
      const rows = Array.isArray(response.data?.data)
        ? response.data.data
        : Array.isArray(response.data)
          ? response.data
          : [];
      setMedicineResults(rows);
      setMedicineOptions(
        rows.map((medicine: Medicine) => ({
          value: String(medicine.id),
          label: `${medicine.name}${medicine.generic_name ? ` - ${medicine.generic_name}` : ""}${medicine.code ? ` (${medicine.code})` : ""}`,
        })),
      );
    } catch {
      setMedicineResults([]);
      setMedicineOptions([]);
    } finally {
      setMedicineLoading(false);
    }
  };

  const loadTimesheet = async () => {
    setTimesheetLoading(true);
    try {
      const res = await medicineOrdersApi.getTimesheet(visitId, timesheetDate);
      const data = res.data;
      setTimesheetItems(data.items || []);

      const mappedEntries: Record<string, MedicationTimesheetEntry> = {};
      (data.entries || []).forEach((entry) => {
        const hour = new Date(entry.scheduled_at).getHours();
        mappedEntries[getCellKey(entry.timesheet_item_id, hour)] = entry;
      });
      setTimesheetEntries(mappedEntries);
      closeEditor();
    } catch (error: any) {
      emitMedicalRecordTabIndicator("medicine-timesheet", "0");
      emitMedicalRecordTabSaved("medicine-timesheet", false);
      toast({
        variant: "destructive",
        title: "Error",
        description: error.response?.data?.error || "Gagal memuat timesheet obat",
      });
    } finally {
      setTimesheetLoading(false);
    }
  };

  const openCellEditor = (itemId: number, hour: number) => {
    const entry = getCellEntry(itemId, hour);
    setSelectedCell({ itemId, hour });
    setEditorState({
      status: entry?.status || "",
      reasonCode: entry?.reason_code || "",
      reasonDetail: entry?.reason_detail || "",
      notes: entry?.notes || "",
    });
  };

  const handleCreateItem = async () => {
    if (!itemForm.medicineId) {
      toast({
        variant: "destructive",
        title: "Validasi",
        description: "Pilih obat dari master obat terlebih dahulu.",
      });
      return;
    }

    setItemSubmitting(true);
    try {
      await medicineOrdersApi.createTimesheetItem({
        visit_id: visitId,
        medicine_id: Number(itemForm.medicineId),
        quantity: Number(itemForm.quantity) || 1,
        unit: itemForm.unit.trim() || undefined,
        dosage: itemForm.dosage.trim() || undefined,
        frequency: itemForm.frequency.trim() || undefined,
        route: itemForm.route.trim() || undefined,
        duration: itemForm.duration.trim() || undefined,
        instructions: itemForm.instructions.trim() || undefined,
      });
      setIsItemDialogOpen(false);
      resetItemForm();
      await loadTimesheet();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.response?.data?.error || "Gagal menambahkan obat timesheet",
      });
    } finally {
      setItemSubmitting(false);
    }
  };

  const handleDeleteItem = async (itemId: number) => {
    setDeletingItemId(itemId);
    try {
      await medicineOrdersApi.deleteTimesheetItem(visitId, itemId);
      setTimesheetItems((prev) => prev.filter((item) => item.item_id !== itemId));
      setTimesheetEntries((prev) => {
        const next = { ...prev };
        Object.keys(next).forEach((key) => {
          if (key.startsWith(`${itemId}-`)) {
            delete next[key];
          }
        });
        return next;
      });
      if (selectedCell?.itemId === itemId) {
        closeEditor();
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.response?.data?.error || "Gagal menghapus item timesheet",
      });
    } finally {
      setDeletingItemId(null);
    }
  };

  const persistSelectedCell = async (clearSlot = false) => {
    if (!selectedCell) return;

    const key = getCellKey(selectedCell.itemId, selectedCell.hour);
    if (inFlightKeys.has(key)) return;

    const nextStatus: MedicationTimesheetStatus | "" = clearSlot ? "" : editorState.status;
    const reasonRequired = requiresReason(nextStatus);
    const allowedReasons = getAllowedReasonOptions(nextStatus);
    const isReasonAllowed = !reasonRequired
      ? true
      : allowedReasons.some((option) => option.value === editorState.reasonCode);

    if (reasonRequired && !editorState.reasonCode) {
      toast({
        variant: "destructive",
        title: "Validasi",
        description: "Alasan wajib diisi untuk status selain Diberikan/Terjadwal.",
      });
      return;
    }

    if (reasonRequired && !isReasonAllowed) {
      toast({
        variant: "destructive",
        title: "Validasi",
        description: "Alasan tidak sesuai dengan status yang dipilih.",
      });
      return;
    }

    if (reasonRequired && editorState.reasonCode === "other" && !editorState.reasonDetail.trim()) {
      toast({
        variant: "destructive",
        title: "Validasi",
        description: "Rincian alasan wajib diisi jika alasan Lainnya.",
      });
      return;
    }

    if (reasonRequired && !editorState.notes.trim()) {
      toast({
        variant: "destructive",
        title: "Validasi",
        description: "Catatan klinis wajib diisi untuk status selain Diberikan/Terjadwal.",
      });
      return;
    }

    setInFlightKeys((prev) => new Set(prev).add(key));
    setTimesheetSavingKey(key);

    try {
      const response = await medicineOrdersApi.upsertTimesheetEntry({
        visit_id: visitId,
        timesheet_item_id: selectedCell.itemId,
        date: timesheetDate,
        hour: selectedCell.hour,
        status: nextStatus,
        reason_code: reasonRequired ? editorState.reasonCode : "",
        reason_detail: reasonRequired ? editorState.reasonDetail.trim() : "",
        notes: clearSlot ? "" : editorState.notes.trim(),
      });

      const result = response.data as MedicationTimesheetEntry | { message: string };
      if ("status" in result) {
        setTimesheetEntries((prev) => ({
          ...prev,
          [key]: result,
        }));
      } else {
        setTimesheetEntries((prev) => {
          const updated = { ...prev };
          delete updated[key];
          return updated;
        });
      }

      closeEditor();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.response?.data?.error || "Gagal menyimpan timesheet",
      });
    } finally {
      setInFlightKeys((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
      setTimesheetSavingKey(null);
    }
  };

  useEffect(() => {
    void loadTimesheet();
  }, [visitId, timesheetDate]);

  useEffect(() => {
    if (!isItemDialogOpen) return;
    const timer = setTimeout(() => {
      void loadMedicineOptions(medicineSearch);
    }, 250);
    return () => clearTimeout(timer);
  }, [isItemDialogOpen, medicineSearch]);

  useEffect(() => {
    emitMedicalRecordTabIndicator("medicine-timesheet", `${loggedSlotCount}`);
    emitMedicalRecordTabSaved("medicine-timesheet", loggedSlotCount > 0);
  }, [loggedSlotCount]);

  return (
    <div className="space-y-4">
      <div className="border p-3 sm:p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium">Timesheet Pemberian Obat Ruangan</p>
            <p className="text-xs text-muted-foreground">
              Pilih satu slot jam untuk mengisi status, alasan klinis, dan catatan pemberian obat.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Label htmlFor="timesheet-date" className="text-xs text-muted-foreground">Tanggal</Label>
            <Input
              id="timesheet-date"
              type="date"
              value={timesheetDate}
              onChange={(e) => setTimesheetDate(e.target.value)}
              className="h-9 w-[170px]"
            />
            {!readOnly && (
              <Button
                type="button"
                className="h-9"
                onClick={() => {
                  resetItemForm();
                  setIsItemDialogOpen(true);
                }}
              >
                <Plus className="mr-2 h-4 w-4" />
                Tambah Obat
              </Button>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
          <span className="text-muted-foreground mr-1">Slot tercatat: {loggedSlotCount}</span>
          <span className={cn("inline-flex items-center rounded border px-1.5 py-0.5", getStatusLegendClass("given"))}>OK: Diberikan</span>
          <span className={cn("inline-flex items-center rounded border px-1.5 py-0.5", getStatusLegendClass("held"))}>HLD: Ditahan</span>
          <span className={cn("inline-flex items-center rounded border px-1.5 py-0.5", getStatusLegendClass("skipped"))}>SKP: Dilewati</span>
          <span className={cn("inline-flex items-center rounded border px-1.5 py-0.5", getStatusLegendClass("refused"))}>RFS: Ditolak</span>
          <span className={cn("inline-flex items-center rounded border px-1.5 py-0.5", getStatusLegendClass("not_available"))}>N/A: Tidak tersedia</span>
          <span className={cn("inline-flex items-center rounded border px-1.5 py-0.5", getStatusLegendClass("contraindicated"))}>KON: Kontraindikasi</span>
          <span className={cn("inline-flex items-center rounded border px-1.5 py-0.5", getStatusLegendClass("patient_absent"))}>ABS: Pasien tidak di ruangan</span>
        </div>
      </div>

      {timesheetLoading ? (
        <div className="flex items-center justify-center h-44 border rounded-lg">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : timesheetItems.length === 0 ? (
        <div className="text-center py-10 border rounded-lg text-muted-foreground">
          <CalendarClock className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p>Belum ada obat pada timesheet</p>
          <p className="text-xs mt-1">Tambahkan obat dari master obat untuk mulai mencatat pemberian per jam.</p>
          {!readOnly && (
            <div className="mt-4">
              <Button
                type="button"
                onClick={() => {
                  resetItemForm();
                  setIsItemDialogOpen(true);
                }}
              >
                <Plus className="mr-2 h-4 w-4" />
                Tambah Obat
              </Button>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          <div ref={tableScrollRef} className="border rounded-lg overflow-x-auto overflow-y-hidden">
            <table className="w-max min-w-full text-xs">
              <thead className="bg-background border-b">
                <tr>
                  <th className="py-2 px-3 text-left font-medium sticky left-0 bg-gray-100 z-20 min-w-[320px] w-[320px] border-r">
                    Obat
                  </th>
                  {TIMESHEET_HOURS.map((hour) => (
                    <th key={`hour-head-${hour}`} className="py-2 px-1 text-center font-medium min-w-[56px] w-[56px] bg-gray-100">
                      {String(hour).padStart(2, "0")}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {timesheetItems.map((item) => (
                  <tr key={`timesheet-row-${item.item_id}`} className="border-t align-top">
                    <td className="py-3 px-3 align-top border-r sticky left-0 bg-background z-10 min-w-[320px] w-[320px]">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-medium text-sm leading-4">{item.medicine_name}</p>
                        </div>
                        {!readOnly && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 shrink-0 text-destructive"
                            disabled={deletingItemId === item.item_id}
                            onClick={() => handleDeleteItem(item.item_id)}
                          >
                            {deletingItemId === item.item_id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Trash2 className="h-3.5 w-3.5" />
                            )}
                          </Button>
                        )}
                      </div>
                    </td>
                    {TIMESHEET_HOURS.map((hour) => {
                      const key = getCellKey(item.item_id, hour);
                      const entry = getCellEntry(item.item_id, hour);
                      const status = entry?.status;
                      const isSelected = selectedCellKey === key;

                      return (
                        <td key={key} className="py-1 px-1 min-w-[56px] w-[56px]">
                          <Button
                            type="button"
                            variant="ghost"
                            className={cn(getCellButtonClassName(status, isSelected), "flex flex-col items-center justify-center")}
                            disabled={readOnly || timesheetSavingKey === key}
                            onClick={() => openCellEditor(item.item_id, hour)}
                          >
                            {timesheetSavingKey === key ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <>
                                <span className="text-[10px] leading-none font-normal">{String(hour).padStart(2, "0")}</span>
                                <span className="leading-none mt-1">{getTimesheetStatusShortLabel(status)}</span>
                              </>
                            )}
                          </Button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between gap-2 px-1">
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => scrollTableHours("left")}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => scrollTableHours("right")}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <Dialog
            open={Boolean(selectedCell && selectedItem)}
            onOpenChange={(open) => {
              if (!open) closeEditor();
            }}
          >
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>Editor Slot Timesheet</DialogTitle>
                <DialogDescription>
                  Isi status dan catatan klinis untuk slot jam yang dipilih.
                </DialogDescription>
              </DialogHeader>

              {selectedCell && selectedItem ? (
                <>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">
                      {selectedItem.medicine_name} • Jam {String(selectedCell.hour).padStart(2, "0")}:00
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Status saat ini: {getTimesheetStatusLabel(getCellEntry(selectedCell.itemId, selectedCell.hour)?.status)}
                    </p>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Status Slot</Label>
                      <Select
                        disabled={readOnly}
                        value={editorState.status || "none"}
                        onValueChange={(value) => {
                          const nextStatus = value === "none" ? "" : (value as MedicationTimesheetStatus);
                          const nextReasons = getAllowedReasonOptions(nextStatus);
                          const keepReason = nextReasons.some((option) => option.value === editorState.reasonCode);
                          setEditorState((prev) => ({
                            ...prev,
                            status: nextStatus,
                            reasonCode: keepReason ? prev.reasonCode : "",
                            reasonDetail: keepReason ? prev.reasonDetail : "",
                          }));
                        }}
                      >
                        <SelectTrigger className="h-9">
                          <SelectValue placeholder="Pilih status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Kosongkan slot</SelectItem>
                          {TIMESHEET_STATUS_OPTIONS.map((option) => (
                            <SelectItem key={`status-${option.value}`} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs">Alasan Klinis {requiresReason(editorState.status) ? "*" : "(opsional)"}</Label>
                      <Select
                        disabled={readOnly || !requiresReason(editorState.status)}
                        value={editorState.reasonCode || "none"}
                        onValueChange={(value) =>
                          setEditorState((prev) => ({
                            ...prev,
                            reasonCode: value === "none" ? "" : (value as MedicationTimesheetReasonCode),
                          }))
                        }
                      >
                        <SelectTrigger className="h-9">
                          <SelectValue placeholder="Pilih alasan" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Tidak ada</SelectItem>
                          {allowedReasonOptions.map((option) => (
                            <SelectItem key={`reason-${option.value}`} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {editorState.reasonCode === "other" && (
                    <div className="space-y-1.5">
                      <Label className="text-xs">Rincian Alasan *</Label>
                      <Input
                        disabled={readOnly}
                        value={editorState.reasonDetail}
                        onChange={(event) => setEditorState((prev) => ({ ...prev, reasonDetail: event.target.value }))}
                        placeholder="Tuliskan rincian alasan"
                        className="h-9"
                      />
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <Label className="text-xs">
                      Catatan Klinis {requiresReason(editorState.status) ? "*" : "(opsional)"}
                    </Label>
                    <Textarea
                      disabled={readOnly}
                      value={editorState.notes}
                      onChange={(event) => setEditorState((prev) => ({ ...prev, notes: event.target.value }))}
                      placeholder="Contoh: TD 86/54, dosis ditahan, observasi ulang 30 menit"
                      className="min-h-[88px] resize-y"
                    />
                    <p className="text-[11px] text-muted-foreground">
                      Alasan dan catatan wajib untuk status selain Diberikan/Terjadwal.
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      type="button"
                      size="sm"
                      disabled={readOnly || (selectedCellKey !== null && timesheetSavingKey === selectedCellKey)}
                      onClick={() => persistSelectedCell(false)}
                    >
                      {selectedCellKey !== null && timesheetSavingKey === selectedCellKey && (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      )}
                      Simpan Slot
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={readOnly || (selectedCellKey !== null && timesheetSavingKey === selectedCellKey)}
                      onClick={() => persistSelectedCell(true)}
                    >
                      Kosongkan Slot
                    </Button>
                    <Button type="button" variant="outline" size="sm" onClick={closeEditor}>
                      Tutup
                    </Button>
                  </div>

                  {selectedCellKey && getCellEntry(selectedCell.itemId, selectedCell.hour)?.status && (
                    <div className="border rounded-md p-2 text-[11px] text-muted-foreground space-y-1">
                      <p>
                        Alasan tersimpan: {getTimesheetReasonLabel(getCellEntry(selectedCell.itemId, selectedCell.hour)?.reason_code)}
                      </p>
                      {getCellEntry(selectedCell.itemId, selectedCell.hour)?.reason_detail && (
                        <p>
                          Rincian: {getCellEntry(selectedCell.itemId, selectedCell.hour)?.reason_detail}
                        </p>
                      )}
                      {getCellEntry(selectedCell.itemId, selectedCell.hour)?.administered_at && (
                        <p>
                          Waktu eksekusi: {new Date(getCellEntry(selectedCell.itemId, selectedCell.hour)!.administered_at!).toLocaleString("id-ID")}
                        </p>
                      )}
                    </div>
                  )}
                </>
              ) : null}
            </DialogContent>
          </Dialog>
        </div>
      )}

      <Dialog open={isItemDialogOpen} onOpenChange={setIsItemDialogOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Tambah Obat Timesheet</DialogTitle>
            <DialogDescription>
              Pilih obat langsung dari master obat, lalu lengkapi detail regimen bila diperlukan.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Obat *</Label>
              <Combobox
                options={medicineOptions}
                value={itemForm.medicineId}
                onValueChange={(value) => {
                  const selectedMedicine = medicineResults.find((medicine: Medicine) => String(medicine.id) === value);
                  setItemForm((prev) => ({
                    ...prev,
                    medicineId: value,
                    unit: selectedMedicine?.unit || prev.unit,
                  }));
                }}
                onSearchChange={setMedicineSearch}
                placeholder="Pilih obat dari master obat..."
                searchPlaceholder="Cari master obat..."
                emptyText="Tidak ada obat yang cocok."
                loading={medicineLoading}
              />
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Jumlah</Label>
                <Input
                  type="number"
                  min={1}
                  value={itemForm.quantity}
                  onChange={(event) => setItemForm((prev) => ({ ...prev, quantity: event.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Satuan</Label>
                <Input
                  value={itemForm.unit}
                  onChange={(event) => setItemForm((prev) => ({ ...prev, unit: event.target.value }))}
                  placeholder="ampul, vial, tablet"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Dosis</Label>
                <Input
                  value={itemForm.dosage}
                  onChange={(event) => setItemForm((prev) => ({ ...prev, dosage: event.target.value }))}
                  placeholder="500 mg"
                />
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Frekuensi</Label>
                <Input
                  value={itemForm.frequency}
                  onChange={(event) => setItemForm((prev) => ({ ...prev, frequency: event.target.value }))}
                  placeholder="3x1, q8h"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Rute</Label>
                <Input
                  value={itemForm.route}
                  onChange={(event) => setItemForm((prev) => ({ ...prev, route: event.target.value }))}
                  placeholder="PO, IV, IM"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Durasi</Label>
                <Input
                  value={itemForm.duration}
                  onChange={(event) => setItemForm((prev) => ({ ...prev, duration: event.target.value }))}
                  placeholder="3 hari"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Instruksi</Label>
              <Textarea
                value={itemForm.instructions}
                onChange={(event) => setItemForm((prev) => ({ ...prev, instructions: event.target.value }))}
                placeholder="Contoh: berikan sesudah makan"
                className="min-h-[88px] resize-y"
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setIsItemDialogOpen(false)} disabled={itemSubmitting}>
              Tutup
            </Button>
            <Button type="button" onClick={() => void handleCreateItem()} disabled={itemSubmitting}>
              {itemSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Simpan Obat
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
