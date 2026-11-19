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
import { CalendarClock, ChevronLeft, ChevronRight, Clock, Loader2, Pill, Plus, Trash2 } from "lucide-react";

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

const SIGNA_OPTIONS = [
  "3 x 1 Setelah Makan",
  "3 x 1 Sebelum Makan",
  "3 x 1 Bersama Makan",
  "2 x 1 Setelah Makan",
  "2 x 1 Sebelum Makan",
  "2 x 1 Pagi & Malam",
  "1 x 1 Pagi Hari Setelah Makan",
  "1 x 1 Malam Hari Setelah Makan",
  "1 x 1 Sebelum Tidur",
  "4 x 1 Setelah Makan",
  "1 x 1 Tablet Bila Perlu (PRN)",
  "3 x 1 Sendok Takar (5 ml)",
  "2 x 1 Sendok Takar (5 ml)",
  "1 x 1 Sendok Takar (5 ml)",
  "1 x 1 Tetes Pada Mata/Telinga",
  "2 x 1 Tetes Pada Mata/Telinga",
  "3 x 1 Tetes Pada Mata/Telinga",
  "Oleskan Tipis 2x Sehari (Topikal)",
  "Oleskan Tipis 3x Sehari (Topikal)",
  "Bila Perlu / Jika Demam (P.R.N)",
  "Bila Nyeri (P.R.N)",
  "Sebelum Makan",
  "Setelah Makan",
  "1x Sehari",
  "2x Sehari",
  "3x Sehari",
].map((o) => ({ value: o, label: o }));

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
  instructions: "",
  notes: "",
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
  const base = "h-10 w-full rounded-none border p-1 text-[11px] font-semibold transition-colors";
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
        return "bg-background text-muted-foreground border-dashed border-neutral-300 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-900/40";
    }
  })();
  const selectedClass = selected ? "ring-1 ring-neutral-900 dark:ring-neutral-100" : "";
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
          label: medicine.name,
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

    const combinedInstructions = [itemForm.instructions.trim(), itemForm.notes.trim()]
      .filter(Boolean)
      .join(" • ");

    setItemSubmitting(true);
    try {
      await medicineOrdersApi.createTimesheetItem({
        visit_id: visitId,
        medicine_id: Number(itemForm.medicineId),
        quantity: Number(itemForm.quantity) || 1,
        unit: itemForm.unit.trim() || undefined,
        dosage: itemForm.dosage.trim() || undefined,
        frequency: (itemForm.frequency || itemForm.instructions).trim() || undefined,
        instructions: combinedInstructions || undefined,
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
    <div className="-mx-4 sm:-mx-5 -my-4 sm:-my-5 divide-y divide-neutral-200 dark:divide-neutral-800 border-b border-neutral-200 dark:border-neutral-800">
      {/* Header & Legend */}
      <div className="p-4 sm:p-5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="border-l-2 border-neutral-900 dark:border-neutral-100 pl-2.5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-900 dark:text-neutral-100">
              Timesheet Pemberian Obat Ruangan
            </h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Pilih satu slot jam untuk mengisi status, alasan klinis, dan catatan pemberian obat.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2">
              <Label htmlFor="timesheet-date" className="text-xs text-muted-foreground">
                Tanggal
              </Label>
              <Input
                id="timesheet-date"
                type="date"
                value={timesheetDate}
                onChange={(e) => setTimesheetDate(e.target.value)}
                className="h-8 text-xs rounded-none w-[160px]"
              />
            </div>
            {!readOnly && (
              <Button
                type="button"
                className="h-8 rounded-none text-xs gap-1.5 bg-neutral-900 hover:bg-neutral-800 text-white dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
                onClick={() => {
                  resetItemForm();
                  setIsItemDialogOpen(true);
                }}
              >
                <Plus className="h-3.5 w-3.5" />
                Tambah Obat
              </Button>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
          <span className="border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 px-2 py-0.5 font-mono text-muted-foreground">
            Slot tercatat: {loggedSlotCount}
          </span>
          <span className={cn("inline-flex items-center rounded-none border px-1.5 py-0.5", getStatusLegendClass("given"))}>OK: Diberikan</span>
          <span className={cn("inline-flex items-center rounded-none border px-1.5 py-0.5", getStatusLegendClass("held"))}>HLD: Ditahan</span>
          <span className={cn("inline-flex items-center rounded-none border px-1.5 py-0.5", getStatusLegendClass("skipped"))}>SKP: Dilewati</span>
          <span className={cn("inline-flex items-center rounded-none border px-1.5 py-0.5", getStatusLegendClass("refused"))}>RFS: Ditolak</span>
          <span className={cn("inline-flex items-center rounded-none border px-1.5 py-0.5", getStatusLegendClass("not_available"))}>N/A: Tidak tersedia</span>
          <span className={cn("inline-flex items-center rounded-none border px-1.5 py-0.5", getStatusLegendClass("contraindicated"))}>KON: Kontraindikasi</span>
          <span className={cn("inline-flex items-center rounded-none border px-1.5 py-0.5", getStatusLegendClass("patient_absent"))}>ABS: Pasien tidak di ruangan</span>
        </div>
      </div>

      {/* Table / Loading / Empty State */}
      <div className="p-4 sm:p-5">
        {timesheetLoading ? (
          <div className="flex items-center justify-center h-40 border border-dashed border-neutral-300 dark:border-neutral-700">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : timesheetItems.length === 0 ? (
          <div className="border border-dashed border-neutral-300 dark:border-neutral-700 py-8 px-4 flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <CalendarClock className="h-4 w-4 opacity-60 shrink-0" />
            <span>
              Belum ada obat pada timesheet — tambahkan obat dari master obat untuk mulai mencatat pemberian per jam.
            </span>
          </div>
        ) : (
          <div className="space-y-2.5">
            <div ref={tableScrollRef} className="border border-neutral-200 dark:border-neutral-800 overflow-x-auto overflow-y-hidden">
              <table className="w-max min-w-full text-xs">
                <thead className="border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900">
                  <tr>
                    <th className="py-2 px-3 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground sticky left-0 bg-neutral-50 dark:bg-neutral-900 z-20 min-w-[300px] w-[300px] border-r border-neutral-200 dark:border-neutral-800">
                      Obat
                    </th>
                    {TIMESHEET_HOURS.map((hour) => (
                      <th
                        key={`hour-head-${hour}`}
                        className="py-2 px-1 text-center text-[11px] font-semibold font-mono text-muted-foreground min-w-[54px] w-[54px] bg-neutral-50 dark:bg-neutral-900"
                      >
                        {String(hour).padStart(2, "0")}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
                  {timesheetItems.map((item) => (
                    <tr key={`timesheet-row-${item.item_id}`} className="align-middle hover:bg-neutral-50/40 dark:hover:bg-neutral-900/20">
                      <td className="py-2.5 px-3 align-middle border-r border-neutral-200 dark:border-neutral-800 sticky left-0 bg-background z-10 min-w-[300px] w-[300px]">
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <p className="font-medium text-xs leading-snug truncate">{item.medicine_name}</p>
                          </div>
                          {!readOnly && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 rounded-none shrink-0 text-destructive hover:text-destructive hover:bg-destructive/10"
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
                          <td key={key} className="py-1 px-1 min-w-[54px] w-[54px]">
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
                                  <span className="text-[10px] leading-none font-mono font-normal">{String(hour).padStart(2, "0")}</span>
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

            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-8 w-8 rounded-none"
                  onClick={() => scrollTableHours("left")}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-8 w-8 rounded-none"
                  onClick={() => scrollTableHours("right")}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
              <span className="text-[11px] font-mono text-muted-foreground">
                Rentang waktu: 00:00 – 23:00
              </span>
            </div>

            <Dialog
              open={Boolean(selectedCell && selectedItem)}
              onOpenChange={(open) => {
                if (!open) closeEditor();
              }}
            >
              <DialogContent className="sm:max-w-lg rounded-none p-0 gap-0 border-neutral-200 dark:border-neutral-800 overflow-hidden">
                <DialogHeader className="px-5 py-4 border-b border-neutral-200 dark:border-neutral-800 flex flex-row items-center gap-3 space-y-0 text-left">
                  <div className="size-8 bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 flex items-center justify-center shrink-0">
                    <Clock className="h-4 w-4" />
                  </div>
                  <div>
                    <DialogTitle className="text-sm font-bold uppercase tracking-tight">
                      Editor Slot Timesheet
                    </DialogTitle>
                    <DialogDescription className="text-xs mt-0.5">
                      Isi status dan catatan klinis untuk slot jam yang dipilih.
                    </DialogDescription>
                  </div>
                </DialogHeader>

                {selectedCell && selectedItem ? (
                  <>
                    <div className="p-5 space-y-4">
                      <div className="border border-neutral-200 dark:border-neutral-800 border-l-2 border-l-neutral-900 dark:border-l-neutral-100 bg-neutral-50/70 dark:bg-neutral-900/40 px-3 py-2 space-y-0.5">
                        <p className="text-xs font-semibold text-foreground">
                          {selectedItem.medicine_name} • Jam {String(selectedCell.hour).padStart(2, "0")}:00
                        </p>
                        <p className="text-[11px] text-muted-foreground">
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
                            <SelectTrigger className="h-9 text-xs rounded-none">
                              <SelectValue placeholder="Pilih status" />
                            </SelectTrigger>
                            <SelectContent className="rounded-none">
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
                          <Label className="text-xs">
                            Alasan Klinis {requiresReason(editorState.status) ? "*" : "(opsional)"}
                          </Label>
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
                            <SelectTrigger className="h-9 text-xs rounded-none">
                              <SelectValue placeholder="Pilih alasan" />
                            </SelectTrigger>
                            <SelectContent className="rounded-none">
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
                            className="h-9 text-xs rounded-none"
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
                          className="min-h-[84px] text-xs rounded-none resize-none"
                        />
                        <p className="text-[11px] text-muted-foreground">
                          Alasan dan catatan wajib untuk status selain Diberikan/Terjadwal.
                        </p>
                      </div>

                      {selectedCellKey && getCellEntry(selectedCell.itemId, selectedCell.hour)?.status && (
                        <div className="border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/30 p-2.5 text-[11px] text-muted-foreground space-y-1">
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
                    </div>

                    <DialogFooter className="px-5 py-3 border-t border-neutral-200 dark:border-neutral-800 bg-neutral-50/60 dark:bg-neutral-900/40 flex flex-wrap items-center justify-between gap-2 sm:justify-between">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8 rounded-none text-xs"
                        disabled={readOnly || (selectedCellKey !== null && timesheetSavingKey === selectedCellKey)}
                        onClick={() => persistSelectedCell(true)}
                      >
                        Kosongkan Slot
                      </Button>
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-8 rounded-none text-xs"
                          onClick={closeEditor}
                        >
                          Tutup
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          className="h-8 rounded-none text-xs bg-neutral-900 hover:bg-neutral-800 text-white dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
                          disabled={readOnly || (selectedCellKey !== null && timesheetSavingKey === selectedCellKey)}
                          onClick={() => persistSelectedCell(false)}
                        >
                          {selectedCellKey !== null && timesheetSavingKey === selectedCellKey && (
                            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                          )}
                          Simpan Slot
                        </Button>
                      </div>
                    </DialogFooter>
                  </>
                ) : null}
              </DialogContent>
            </Dialog>
          </div>
        )}
      </div>

      <Dialog open={isItemDialogOpen} onOpenChange={setIsItemDialogOpen}>
        <DialogContent className="w-[calc(100vw-1rem)] sm:max-w-2xl max-h-[90vh] rounded-none p-0 gap-0 border-neutral-200 dark:border-neutral-800 overflow-hidden flex flex-col">
          <DialogHeader className="px-4 py-3 border-b border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="size-8 bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 flex items-center justify-center shrink-0">
                <Pill className="h-4 w-4" />
              </div>
              <div className="text-left min-w-0">
                <DialogTitle className="text-sm font-bold uppercase tracking-tight">
                  Tambah Obat Timesheet
                </DialogTitle>
                <DialogDescription className="text-xs mt-0.5">
                  Pilih obat dari master obat, lalu lengkapi jumlah, dosis, aturan pakai (signa), dan catatan tambahan.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto p-4 space-y-4 [&_input]:h-9 [&_[role=combobox]]:h-9 [&_input]:rounded-none [&_textarea]:rounded-none [&_[role=combobox]]:rounded-none [&_input]:text-xs [&_[role=combobox]]:text-xs">
            {(() => {
              const selectedMedicine = medicineResults.find(
                (medicine: Medicine) => String(medicine.id) === itemForm.medicineId,
              );
              if (!selectedMedicine) return null;
              return (
                <div className="border-l-4 border-l-neutral-900 dark:border-l-neutral-100 border border-neutral-200 dark:border-neutral-800 bg-neutral-50/60 dark:bg-neutral-900/40 px-3.5 py-2.5 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold text-xs text-foreground truncate">{selectedMedicine.name}</p>
                    <p className="text-[11px] font-mono text-muted-foreground">
                      {selectedMedicine.code}
                      {selectedMedicine.form ? ` • ${selectedMedicine.form}` : ""}
                      {selectedMedicine.strength ? ` • ${selectedMedicine.strength}` : ""}
                    </p>
                  </div>
                  {selectedMedicine.unit && (
                    <span className="border border-neutral-200 dark:border-neutral-700 bg-background text-[10px] h-5 px-1.5 font-mono inline-flex items-center shrink-0">
                      Satuan: {selectedMedicine.unit}
                    </span>
                  )}
                </div>
              );
            })()}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1.5 md:col-span-2">
                <Label className="text-xs font-medium">Obat *</Label>
                <Combobox
                  options={medicineOptions}
                  value={itemForm.medicineId}
                  onValueChange={(value) => {
                    const selectedMedicine = medicineResults.find((medicine: Medicine) => String(medicine.id) === value);
                    setItemForm((prev) => ({
                      ...prev,
                      medicineId: value,
                      unit: selectedMedicine?.unit || prev.unit,
                      dosage: selectedMedicine?.strength || prev.dosage,
                    }));
                  }}
                  onSearchChange={setMedicineSearch}
                  placeholder="Pilih obat dari master obat..."
                  searchPlaceholder="Cari master obat..."
                  emptyText="Tidak ada obat yang cocok."
                  loading={medicineLoading}
                  className="w-full"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Jumlah *</Label>
                <Input
                  type="number"
                  min={1}
                  value={itemForm.quantity}
                  onChange={(event) => setItemForm((prev) => ({ ...prev, quantity: event.target.value }))}
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Dosis</Label>
                <Input
                  value={itemForm.dosage}
                  onChange={(event) => setItemForm((prev) => ({ ...prev, dosage: event.target.value }))}
                  placeholder="Misal: 500 mg / 1 tablet"
                />
              </div>

              <div className="space-y-1.5 md:col-span-2">
                <Label className="text-xs font-medium">Signa / Aturan Pakai</Label>
                <Combobox
                  allowCustomValue
                  options={SIGNA_OPTIONS}
                  value={itemForm.instructions}
                  onValueChange={(value) =>
                    setItemForm((prev) => ({
                      ...prev,
                      instructions: value,
                      frequency: value,
                    }))
                  }
                  placeholder="Pilih atau ketik signa (contoh: 3 x 1 Setelah Makan)"
                  searchPlaceholder="Cari atau ketik signa..."
                  emptyText="Tekan enter untuk menggunakan signa ini"
                  className="w-full"
                />
              </div>

              <div className="space-y-1.5 md:col-span-2">
                <Label className="text-xs font-medium">Catatan Tambahan</Label>
                <Textarea
                  value={itemForm.notes}
                  onChange={(event) => setItemForm((prev) => ({ ...prev, notes: event.target.value }))}
                  placeholder="Catatan khusus pemakaian obat ini (opsional)..."
                  className="min-h-[68px] resize-none text-xs rounded-none"
                />
              </div>
            </div>
          </div>

          <DialogFooter className="px-4 py-3 border-t border-neutral-200 dark:border-neutral-800 bg-neutral-50/60 dark:bg-neutral-900/40 shrink-0 gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 rounded-none px-4 text-xs"
              onClick={() => setIsItemDialogOpen(false)}
              disabled={itemSubmitting}
            >
              Batal
            </Button>
            <Button
              type="button"
              size="sm"
              className="h-8 rounded-none px-4 text-xs bg-neutral-900 hover:bg-neutral-800 text-white dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
              onClick={() => void handleCreateItem()}
              disabled={itemSubmitting}
            >
              {itemSubmitting && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
              Simpan Obat
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
