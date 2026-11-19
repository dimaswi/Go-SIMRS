import { useEffect, useState, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Combobox } from "@/components/ui/combobox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { usePermission } from "@/hooks/usePermission";
import {
  visitProceduresApi,
  getVisitProcedureStatusLabel,
  getVisitProcedureStatusColor,
} from "@/lib/api";
import type {
  RoomProcedureForVisit,
  VisitProcedure,
  SaveVisitProcedureResultsInput,
} from "@/lib/api";
import type { ProcedureParameter } from "@/lib/api/procedures";
import {
  Loader2,
  Plus,
  Save,
  Trash2,
  Play,
  CheckCircle,
  Scissors,
  User,
  AlertTriangle,
  AlertCircle,
  Search,
  ChevronDown,
  ChevronRight,
  XCircle,
  RotateCcw,
  Check,
  Tag,
} from "lucide-react";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";

interface ProcedureFormProps {
  visitId: number;
  readOnly?: boolean;
  externalData?: VisitProcedure[];
  useExternalData?: boolean;
  procedureTypeFilter?: string;
}

// Check if procedure has parameters
function procedureHasParameters(procedure: VisitProcedure): boolean {
  return (procedure.procedure?.parameters && procedure.procedure.parameters.length > 0) || false;
}

export function ProcedureForm({
  visitId,
  readOnly = false,
  externalData,
  useExternalData = false,
  procedureTypeFilter,
}: ProcedureFormProps) {
  const { toast } = useToast();
  const { hasPermission } = usePermission();

  // State
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [roomProcedures, setRoomProcedures] = useState<RoomProcedureForVisit[]>([]);
  const [visitProcedures, setVisitProcedures] = useState<VisitProcedure[]>([]);
  const [expandedProcedure, setExpandedProcedure] = useState<number | null>(null);
  const [resultValues, setResultValues] = useState<Record<number, { value: string; num_value: number; is_abnormal: boolean; is_critical: boolean }>>({});
  const [discountState, setDiscountState] = useState<{
    discount_type: string;
    discount_value: number;
    discount_note: string;
  }>({ discount_type: "", discount_value: 0, discount_note: "" });

  // New procedure form
  const [searchQuery, setSearchQuery] = useState("");
  const [queueSearchQuery, setQueueSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "in_progress" | "completed" | "cancelled">("all");

  // Dialogs
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [procedureToDelete, setProcedureToDelete] = useState<number | null>(null);
  
  // Discount Modal
  const [discountDialogOpen, setDiscountDialogOpen] = useState(false);
  const [procedureToDiscount, setProcedureToDiscount] = useState<number | null>(null);

  // Permissions
  const canCreate = hasPermission("medical_records.procedure") && !useExternalData;
  const canEdit = hasPermission("medical_records.procedure") && !useExternalData;
  const canDelete = hasPermission("medical_records.procedure") && !useExternalData;

  // Load data
  const loadData = useCallback(async (focusProcedureId?: number) => {
    setLoading(true);
    if (useExternalData) {
      setRoomProcedures([]);
      setVisitProcedures(externalData || []);
      setLoading(false);
      return;
    }
    try {
      const [roomProcRes, visitProcRes] = await Promise.all([
        visitProceduresApi.getRoomProcedures(visitId),
        visitProceduresApi.getAll(visitId),
      ]);
      const roomProcedureData = roomProcRes.data.data || [];
      const visitProcedureData = visitProcRes.data.data || [];
      setRoomProcedures(roomProcedureData);
      setVisitProcedures(visitProcedureData);

      if (focusProcedureId) {
        const focused = visitProcedureData.find((item) => item.id === focusProcedureId);
        if (focused) {
          const values: Record<number, { value: string; num_value: number; is_abnormal: boolean; is_critical: boolean }> = {};
          focused.procedure?.parameters?.forEach((param) => {
            const existingResult = focused.results?.find((r) => r.parameter_id === param.id);
            values[param.id] = {
              value: existingResult?.value || "",
              num_value: existingResult?.num_value || 0,
              is_abnormal: existingResult?.is_abnormal || false,
              is_critical: existingResult?.is_critical || false,
            };
          });
          setResultValues(values);
          setExpandedProcedure(focused.id);
        }
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.response?.data?.error || "Gagal memuat data tindakan",
      });
    } finally {
      setLoading(false);
    }
  }, [externalData, useExternalData, visitId, toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Initialize result values when expanding a procedure
  const handleExpandProcedure = (procedureId: number) => {
    if (expandedProcedure === procedureId) {
      setExpandedProcedure(null);
      return;
    }

    const procedure = visitProcedures.find((p) => p.id === procedureId);
    if (procedure) {
      const values: Record<number, { value: string; num_value: number; is_abnormal: boolean; is_critical: boolean }> = {};
      procedure.procedure?.parameters?.forEach((param) => {
        const existingResult = procedure.results?.find((r) => r.parameter_id === param.id);
        values[param.id] = {
          value: existingResult?.value || "",
          num_value: existingResult?.num_value || 0,
          is_abnormal: existingResult?.is_abnormal || false,
          is_critical: existingResult?.is_critical || false,
        };
      });
      setResultValues(values);
    }

    setExpandedProcedure(procedureId);
  };

  const handleQuickAddProcedure = async (procedureId: number) => {
    setSaving(true);
    try {
      const res = await visitProceduresApi.create(visitId, {
        procedure_id: procedureId,
      });
      const createdId = res.data?.data?.id;
      toast({
        title: "Berhasil",
        description: "Tindakan berhasil ditambahkan",
      });
      loadData(createdId);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.response?.data?.error || "Gagal menambahkan tindakan",
      });
    } finally {
      setSaving(false);
    }
  };

  // Delete procedure
  const handleDeleteProcedure = async () => {
    if (!procedureToDelete) return;

    try {
      await visitProceduresApi.delete(visitId, procedureToDelete);
      toast({
        title: "Berhasil",
        description: "Tindakan berhasil dihapus",
      });
      setDeleteDialogOpen(false);
      setProcedureToDelete(null);
      if (expandedProcedure === procedureToDelete) {
        setExpandedProcedure(null);
      }
      loadData();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.response?.data?.error || "Gagal menghapus tindakan",
      });
    }
  };

  const openDiscountDialog = (procedureId: number) => {
    const procedure = visitProcedures.find((p) => p.id === procedureId);
    if (procedure) {
      setProcedureToDiscount(procedureId);
      setDiscountState({
        discount_type: procedure.discount_type || "none",
        discount_value: procedure.discount_value || 0,
        discount_note: procedure.discount_note || "",
      });
      setDiscountDialogOpen(true);
    }
  };

  const handleSaveDiscount = async () => {
    if (!procedureToDiscount) return;
    const procedure = visitProcedures.find((p) => p.id === procedureToDiscount);
    if (!procedure) return;

    setSaving(true);
    try {
      // Keep existing results
      const resultsToSave = expandedProcedure === procedureToDiscount 
        ? Object.entries(resultValues).map(([paramId, val]) => ({
            parameter_id: parseInt(paramId),
            value: val.value,
            num_value: val.num_value,
            is_abnormal: val.is_abnormal,
            is_critical: val.is_critical,
          }))
        : procedure.results?.map(r => ({
            parameter_id: r.parameter_id,
            value: r.value,
            num_value: r.num_value || 0,
            is_abnormal: r.is_abnormal || false,
            is_critical: r.is_critical || false,
          })) || [];

      const data: SaveVisitProcedureResultsInput = {
        status: procedure.status,
        results: resultsToSave,
        discount_type: discountState.discount_type === "none" ? "" : discountState.discount_type,
        discount_value: discountState.discount_value,
        discount_amount: 0,
        discount_note: discountState.discount_note,
      };

      await visitProceduresApi.saveResults(visitId, procedureToDiscount, data);
      toast({
        title: "Berhasil",
        description: "Pengaturan diskon berhasil disimpan",
      });
      setDiscountDialogOpen(false);
      setProcedureToDiscount(null);
      loadData();
      window.dispatchEvent(new CustomEvent("refresh-print-options"));
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.response?.data?.error || "Gagal menyimpan pengaturan diskon",
      });
    } finally {
      setSaving(false);
    }
  };

  // Save results
  const handleSaveResults = async (procedureId: number, status?: string) => {
    const procedure = visitProcedures.find((p) => p.id === procedureId);
    if (!procedure) return;

    setSaving(true);
    try {
      const results = Object.entries(resultValues).map(([paramId, val]) => ({
        parameter_id: parseInt(paramId),
        value: val.value,
        num_value: val.num_value,
        is_abnormal: val.is_abnormal,
        is_critical: val.is_critical,
      }));

      const data: SaveVisitProcedureResultsInput = {
        status: status || procedure.status,
        results,
        discount_type: discountState.discount_type === "none" ? "" : discountState.discount_type,
        discount_value: discountState.discount_value,
        discount_amount: 0, // dihitung di backend
        discount_note: discountState.discount_note,
      };

      await visitProceduresApi.saveResults(visitId, procedureId, data);
      toast({
        title: "Berhasil",
        description: status === "completed" ? "Tindakan berhasil diselesaikan" :
          status === "cancelled" ? "Tindakan berhasil dibatalkan" :
            "Hasil tindakan berhasil disimpan",
      });
      setExpandedProcedure(null);
      loadData();
      // Trigger refresh on print options dropdown
      window.dispatchEvent(new CustomEvent("refresh-print-options"));
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.response?.data?.error || "Gagal menyimpan hasil tindakan",
      });
    } finally {
      setSaving(false);
    }
  };

  // Handle result value change
  const handleResultChange = (paramId: number, field: string, value: any) => {
    setResultValues((prev) => ({
      ...prev,
      [paramId]: {
        ...prev[paramId],
        [field]: value,
      },
    }));
  };

  // Render parameter input based on input_type
  const renderParameterInput = (param: ProcedureParameter, isDisabled: boolean) => {
    const value = resultValues[param.id] || { value: "", num_value: 0, is_abnormal: false, is_critical: false };

    switch (param.input_type) {
      case "textarea":
        return (
          <Textarea
            value={value.value}
            onChange={(e) => handleResultChange(param.id, "value", e.target.value)}
            placeholder={param.description || `Masukkan ${param.name}`}
            disabled={isDisabled}
            rows={3}
            className="text-xs rounded-none bg-white dark:bg-neutral-950 resize-none"
          />
        );
      case "number":
        return (
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <Input
                type="number"
                value={value.num_value || ""}
                onChange={(e) => {
                  const numVal = parseFloat(e.target.value) || 0;
                  handleResultChange(param.id, "num_value", numVal);
                  handleResultChange(param.id, "value", e.target.value);
                  // Auto-detect abnormal/critical
                  if (param.normal_min !== undefined && param.normal_max !== undefined) {
                    const isAbnormal = numVal < param.normal_min || numVal > param.normal_max;
                    handleResultChange(param.id, "is_abnormal", isAbnormal);
                  }
                  if (param.critical_min !== undefined && param.critical_max !== undefined) {
                    const isCritical = numVal < param.critical_min || numVal > param.critical_max;
                    handleResultChange(param.id, "is_critical", isCritical);
                  }
                }}
                placeholder={param.description || `Masukkan ${param.name}`}
                disabled={isDisabled}
                step={1 / Math.pow(10, param.decimal_places || 2)}
                className="h-9 text-xs rounded-none bg-white dark:bg-neutral-950"
              />
              {param.unit && <span className="text-xs text-muted-foreground shrink-0">{param.unit}</span>}
            </div>
            {(param.normal_min !== undefined || param.normal_max !== undefined || param.normal_text) && (
              <p className="text-[11px] text-muted-foreground">
                Nilai Normal: {param.normal_text || `${param.normal_min} - ${param.normal_max} ${param.unit || ""}`}
              </p>
            )}
            <div className="flex flex-wrap gap-1.5">
              {value.is_abnormal && (
                <Badge variant="outline" className="rounded-none text-[10px] h-5 px-1.5 bg-yellow-100 text-yellow-800">
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  Abnormal
                </Badge>
              )}
              {value.is_critical && (
                <Badge variant="destructive" className="rounded-none text-[10px] h-5 px-1.5">
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  Kritis
                </Badge>
              )}
            </div>
          </div>
        );
      case "select": {
        const options = param.options ? JSON.parse(param.options) : [];
        return (
          <Select
            value={value.value}
            onValueChange={(v) => handleResultChange(param.id, "value", v)}
            disabled={isDisabled}
          >
            <SelectTrigger className="h-9 text-xs rounded-none bg-white dark:bg-neutral-950">
              <SelectValue placeholder={`Pilih ${param.name}`} />
            </SelectTrigger>
            <SelectContent>
              {options.map((opt: string) => (
                <SelectItem key={opt} value={opt} className="text-xs">
                  {opt}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      }
      case "checkbox":
        return (
          <div className="flex items-center space-x-2">
            <Checkbox
              id={`param-${param.id}`}
              checked={value.value === "true" || value.value === "1"}
              onCheckedChange={(checked) => handleResultChange(param.id, "value", checked ? "true" : "false")}
              disabled={isDisabled}
              className="rounded-none"
            />
            <label
              htmlFor={`param-${param.id}`}
              className="text-xs font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              {param.description || param.name}
            </label>
          </div>
        );
      default: // text
        return (
          <Input
            value={value.value}
            onChange={(e) => handleResultChange(param.id, "value", e.target.value)}
            placeholder={param.description || `Masukkan ${param.name}`}
            disabled={isDisabled}
            className="h-9 text-xs rounded-none bg-white dark:bg-neutral-950"
          />
        );
    }
  };

  // Show all procedures (allow same procedure to be added multiple times)
  const availableProcedures = useMemo(() => {
    if (!procedureTypeFilter) return roomProcedures;
    return roomProcedures.filter((proc) => proc.procedure_type === procedureTypeFilter);
  }, [roomProcedures, procedureTypeFilter]);
  const filteredProcedures = availableProcedures.filter((proc) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return proc.name.toLowerCase().includes(q) || proc.code.toLowerCase().includes(q);
  });

  const scopedVisitProcedures = useMemo(() => {
    if (!procedureTypeFilter) return visitProcedures;
    return visitProcedures.filter((vp) => vp.procedure?.procedure_type === procedureTypeFilter);
  }, [visitProcedures, procedureTypeFilter]);

  const queueCounts = useMemo(() => {
    return {
      all: scopedVisitProcedures.length,
      pending: scopedVisitProcedures.filter((p) => p.status === "pending").length,
      in_progress: scopedVisitProcedures.filter((p) => p.status === "in_progress").length,
      completed: scopedVisitProcedures.filter((p) => p.status === "completed").length,
      cancelled: scopedVisitProcedures.filter((p) => p.status === "cancelled").length,
    };
  }, [scopedVisitProcedures]);

  const filteredVisitProcedures = useMemo(() => {
    return scopedVisitProcedures.filter((vp) => {
      if (statusFilter !== "all" && vp.status !== statusFilter) return false;
      if (!queueSearchQuery.trim()) return true;

      const q = queueSearchQuery.toLowerCase();
      const name = vp.procedure?.name?.toLowerCase() || "";
      const code = vp.procedure?.code?.toLowerCase() || "";
      const creator = vp.created_by?.full_name?.toLowerCase() || "";
      const filler = vp.filled_by?.full_name?.toLowerCase() || "";
      return name.includes(q) || code.includes(q) || creator.includes(q) || filler.includes(q);
    });
  }, [scopedVisitProcedures, statusFilter, queueSearchQuery]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!useExternalData && availableProcedures.length === 0 && scopedVisitProcedures.length === 0) {
    return (
      <div className="-mx-4 sm:-mx-5 -my-4 sm:-my-5">
        <div className="px-4 sm:px-5 py-8 border-b border-neutral-200 dark:border-neutral-800 text-center text-muted-foreground">
          <Scissors className="h-8 w-8 mx-auto mb-2 opacity-40" />
          <p className="text-xs font-semibold text-foreground">
            Tidak ada tindakan yang tersedia untuk ruangan ini.
          </p>
          <p className="text-[11px] mt-1">
            Silakan tambahkan tindakan ke ruangan melalui menu Manajemen Ruangan.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="-mx-4 sm:-mx-5 -my-4 sm:-my-5">
      <fieldset
        disabled={readOnly}
        className="[&_input]:h-9 [&_[role=combobox]]:h-9 [&_input]:rounded-none [&_textarea]:rounded-none [&_[role=combobox]]:rounded-none [&_input]:text-xs [&_[role=combobox]]:text-xs"
      >
        <div className="grid grid-cols-1 xl:grid-cols-12 divide-y xl:divide-y-0 xl:divide-x divide-neutral-200 dark:divide-neutral-800 border-b border-neutral-200 dark:border-neutral-800">
          {/* Column 1: Katalog & Assign Tindakan */}
          <section className="xl:col-span-5 flex flex-col min-w-0">
            <div className="px-4 sm:px-5 py-3.5 border-b border-neutral-200 dark:border-neutral-800 space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="border-l-2 border-neutral-900 dark:border-neutral-100 pl-2.5 text-xs font-bold uppercase tracking-wider text-neutral-900 dark:text-neutral-100">
                    Katalog Tindakan
                  </div>
                  <Badge variant="secondary" className="rounded-none h-5 px-1.5 text-[10px] font-mono">
                    {filteredProcedures.length} Item
                  </Badge>
                </div>
                <span className="text-[11px] text-muted-foreground">Klik + untuk assign cepat</span>
              </div>

              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Cari nama atau kode tindakan..."
                  className="pl-8"
                />
              </div>
            </div>

            {canCreate ? (
              filteredProcedures.length > 0 ? (
                <div className="max-h-[560px] overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-neutral-50 dark:bg-neutral-900 z-10 border-b border-neutral-200 dark:border-neutral-800">
                      <tr>
                        <th className="h-9 px-4 text-left font-bold uppercase tracking-wider text-muted-foreground">
                          Nama Tindakan
                        </th>
                        <th className="h-9 px-3 w-16 text-center font-bold uppercase tracking-wider text-muted-foreground">
                          Aksi
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
                      {filteredProcedures.map((proc) => (
                        <tr key={proc.id} className="hover:bg-muted/30 transition-colors">
                          <td className="py-2 px-4">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="font-semibold text-foreground">{proc.name}</span>
                              {proc.is_mandatory && (
                                <Badge variant="destructive" className="rounded-none text-[9px] h-4 px-1">
                                  Wajib
                                </Badge>
                              )}
                              {proc.is_prescription_fee && (
                                <Badge
                                  variant="outline"
                                  className="rounded-none text-[9px] h-4 px-1 border-emerald-500 text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40"
                                >
                                  Jasa Resep
                                </Badge>
                              )}
                            </div>
                            <p className="text-[11px] font-mono text-muted-foreground mt-0.5">{proc.code}</p>
                          </td>
                          <td className="py-2 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              className="h-7 w-7 rounded-none"
                              disabled={saving}
                              onClick={() => handleQuickAddProcedure(proc.id)}
                              title="Tambah cepat tindakan"
                            >
                              <Plus className="h-3.5 w-3.5" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="p-4">
                  <div className="border border-dashed border-neutral-200 dark:border-neutral-800 bg-neutral-50/30 dark:bg-neutral-900/10 px-3.5 py-2.5 text-xs text-muted-foreground">
                    Tidak ada tindakan yang cocok dengan kata kunci pencarian.
                  </div>
                </div>
              )
            ) : (
              <div className="p-4">
                <div className="border border-dashed border-neutral-200 dark:border-neutral-800 bg-neutral-50/30 dark:bg-neutral-900/10 px-3.5 py-2.5 text-xs text-muted-foreground">
                  Anda tidak memiliki izin untuk menambahkan tindakan.
                </div>
              </div>
            )}
          </section>

          {/* Column 2: Antrian Verifikasi & Isi Hasil */}
          <section className="xl:col-span-7 flex flex-col min-w-0">
            <div className="px-4 sm:px-5 py-3.5 border-b border-neutral-200 dark:border-neutral-800 space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="border-l-2 border-neutral-900 dark:border-neutral-100 pl-2.5 text-xs font-bold uppercase tracking-wider text-neutral-900 dark:text-neutral-100">
                    Daftar &amp; Hasil Tindakan
                  </div>
                  <Badge
                    variant={queueCounts.all > 0 ? "default" : "secondary"}
                    className="rounded-none h-5 px-1.5 text-[10px] font-mono"
                  >
                    {queueCounts.all} Tindakan
                  </Badge>
                </div>

                {/* Filter Pills */}
                <div className="flex flex-wrap items-center gap-1">
                  {(
                    [
                      { key: "all", label: "Semua", count: queueCounts.all },
                      { key: "pending", label: "Menunggu", count: queueCounts.pending },
                      { key: "in_progress", label: "Proses", count: queueCounts.in_progress },
                      { key: "completed", label: "Selesai", count: queueCounts.completed },
                      { key: "cancelled", label: "Batal", count: queueCounts.cancelled },
                    ] as const
                  ).map((item) => (
                    <Button
                      key={item.key}
                      type="button"
                      variant={statusFilter === item.key ? "default" : "outline"}
                      size="sm"
                      className="h-7 rounded-none px-2 text-[11px] gap-1"
                      onClick={() => setStatusFilter(item.key)}
                    >
                      <span>{item.label}</span>
                      <span className="font-mono text-[10px] opacity-80">({item.count})</span>
                    </Button>
                  ))}
                </div>
              </div>

              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  value={queueSearchQuery}
                  onChange={(e) => setQueueSearchQuery(e.target.value)}
                  placeholder="Cari di daftar tindakan kunjungan..."
                  className="pl-8"
                />
              </div>
            </div>

            {filteredVisitProcedures.length > 0 ? (
              <div className="divide-y divide-neutral-200 dark:divide-neutral-800">
                {filteredVisitProcedures.map((vp) => {
                  const isExpanded = expandedProcedure === vp.id;
                  const hasParams = procedureHasParameters(vp);
                  const isDisabled = vp.status === "completed" || vp.status === "cancelled";

                  return (
                    <Collapsible
                      key={vp.id}
                      open={isExpanded}
                      onOpenChange={() => handleExpandProcedure(vp.id)}
                    >
                      {/* Row Header */}
                      <div className={`hover:bg-muted/30 transition-colors ${isExpanded ? "bg-neutral-50/70 dark:bg-neutral-900/40" : ""}`}>
                        <CollapsibleTrigger className="w-full text-left">
                          <div className="flex items-center gap-2.5 px-4 sm:px-5 py-2.5">
                            {isExpanded ? (
                              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                            ) : (
                              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                            )}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-semibold text-xs text-foreground">{vp.procedure?.name}</span>
                                <Badge
                                  className={`rounded-none text-[10px] h-5 px-1.5 ${getVisitProcedureStatusColor(vp.status)}`}
                                  variant="secondary"
                                >
                                  {getVisitProcedureStatusLabel(vp.status)}
                                </Badge>
                              </div>
                              <div className="flex flex-wrap items-center gap-1.5 mt-0.5 text-[11px] text-muted-foreground">
                                <span className="font-mono">{vp.procedure?.code}</span>
                                {vp.created_by && (
                                  <>
                                    <span>•</span>
                                    <span className="flex items-center gap-1" title="Dibuat oleh">
                                      <Plus className="h-3 w-3" />
                                      {vp.created_by.full_name}
                                    </span>
                                  </>
                                )}
                                {vp.filled_by && vp.filled_by.id !== vp.created_by?.id && (
                                  <>
                                    <span>•</span>
                                    <span className="flex items-center gap-1" title="Dikerjakan oleh">
                                      <User className="h-3 w-3" />
                                      {vp.filled_by.full_name}
                                    </span>
                                  </>
                                )}
                                {vp.performed_at && (
                                  <>
                                    <span>•</span>
                                    <span>{format(new Date(vp.performed_at), "dd MMM HH:mm", { locale: idLocale })}</span>
                                  </>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                              {canDelete && vp.status === "pending" && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 rounded-none text-destructive"
                                  title="Hapus Tindakan"
                                  onClick={() => {
                                    setProcedureToDelete(vp.id);
                                    setDeleteDialogOpen(true);
                                  }}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              )}
                              {canEdit && !isDisabled && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 rounded-none text-blue-600"
                                  title="Pengaturan Diskon"
                                  onClick={() => openDiscountDialog(vp.id)}
                                >
                                  <Tag className="h-3.5 w-3.5" />
                                </Button>
                              )}
                              {canEdit && vp.status !== "completed" && vp.status !== "cancelled" && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 rounded-none text-orange-600"
                                  title="Batalkan Tindakan"
                                  onClick={() => handleSaveResults(vp.id, "cancelled")}
                                >
                                  <XCircle className="h-3.5 w-3.5" />
                                </Button>
                              )}
                              {canEdit && (vp.status === "pending" || vp.status === "in_progress") && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 rounded-none text-emerald-600"
                                  title="Selesaikan Tindakan"
                                  onClick={() => handleSaveResults(vp.id, "completed")}
                                >
                                  <CheckCircle className="h-3.5 w-3.5" />
                                </Button>
                              )}
                              {canEdit && vp.status === "completed" && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 rounded-none text-blue-600"
                                  title="Ubah ke Proses"
                                  onClick={() => handleSaveResults(vp.id, "in_progress")}
                                >
                                  <RotateCcw className="h-3.5 w-3.5" />
                                </Button>
                              )}
                              {canEdit && vp.status === "cancelled" && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 rounded-none text-emerald-600"
                                  title="Aktifkan Kembali"
                                  onClick={() => handleSaveResults(vp.id, "pending")}
                                >
                                  <Check className="h-3.5 w-3.5" />
                                </Button>
                              )}
                            </div>
                          </div>
                        </CollapsibleTrigger>
                      </div>

                      {/* Collapsible Content - Form */}
                      <CollapsibleContent>
                        <div className="border-t border-neutral-200 dark:border-neutral-800 bg-neutral-50/40 dark:bg-neutral-900/20 px-4 sm:px-5 py-3.5 space-y-3">
                          {/* Info Strip */}
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-2.5 text-xs">
                            <div>
                              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
                                Kode
                              </span>
                              <span className="font-mono font-semibold text-foreground">{vp.procedure?.code || "-"}</span>
                            </div>
                            <div>
                              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
                                Jenis
                              </span>
                              <span className="font-semibold text-foreground">{vp.procedure?.procedure_type || "-"}</span>
                            </div>
                            <div>
                              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
                                Dibuat Oleh
                              </span>
                              <span className="font-medium text-foreground">{vp.created_by?.full_name || "-"}</span>
                            </div>
                            <div>
                              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
                                Diisi Oleh
                              </span>
                              <span className="font-medium text-foreground">{vp.filled_by?.full_name || "-"}</span>
                            </div>
                          </div>

                          {/* Parameters Form */}
                          {hasParams ? (
                            <div className="space-y-3 border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-3">
                              <div className="border-l-2 border-neutral-900 dark:border-neutral-100 pl-2 text-[11px] font-bold uppercase tracking-wider text-neutral-800 dark:text-neutral-200">
                                Parameter Hasil Tindakan
                              </div>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {vp.procedure?.parameters?.map((param) => (
                                  <div key={param.id} className="space-y-1.5">
                                    <Label className="text-xs font-medium">
                                      {param.name}
                                      {param.is_required && <span className="text-destructive ml-1">*</span>}
                                    </Label>
                                    {renderParameterInput(param, isDisabled)}
                                  </div>
                                ))}
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2 border border-dashed border-neutral-200 dark:border-neutral-800 bg-white/60 dark:bg-neutral-950/60 px-3 py-2 text-xs text-muted-foreground">
                              <AlertCircle className="h-3.5 w-3.5 shrink-0 opacity-60" />
                              <span>Tindakan ini tidak memiliki parameter hasil. Klik "Selesai" untuk menyelesaikan tindakan.</span>
                            </div>
                          )}

                          {/* Action Buttons */}
                          {canEdit && !isDisabled && (
                            <div className="flex flex-wrap justify-end gap-1.5 pt-1">
                              {vp.status === "pending" && hasParams && (
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className="h-8 rounded-none text-xs"
                                  onClick={() => handleSaveResults(vp.id, "in_progress")}
                                  disabled={saving}
                                >
                                  <Play className="h-3.5 w-3.5 mr-1" />
                                  Mulai
                                </Button>
                              )}
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-8 rounded-none text-xs text-destructive border-destructive/40 hover:bg-destructive/10"
                                onClick={() => handleSaveResults(vp.id, "cancelled")}
                                disabled={saving}
                              >
                                <XCircle className="h-3.5 w-3.5 mr-1" />
                                Batal
                              </Button>
                              {hasParams && (
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className="h-8 rounded-none text-xs"
                                  onClick={() => handleSaveResults(vp.id)}
                                  disabled={saving}
                                >
                                  {saving ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Save className="h-3.5 w-3.5 mr-1" />}
                                  Simpan
                                </Button>
                              )}
                              <Button
                                type="button"
                                size="sm"
                                className="h-8 rounded-none text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                                onClick={() => handleSaveResults(vp.id, "completed")}
                                disabled={saving}
                              >
                                {saving ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <CheckCircle className="h-3.5 w-3.5 mr-1" />}
                                Selesai
                              </Button>
                            </div>
                          )}

                          {/* Completed/Cancelled Status Display */}
                          {vp.status === "completed" && (
                            <div className="border border-emerald-200 bg-emerald-50/70 dark:bg-emerald-950/30 px-3 py-2 flex items-center justify-between gap-2 text-xs">
                              <span className="font-semibold text-emerald-700 dark:text-emerald-300 flex items-center gap-1.5">
                                <CheckCircle className="h-3.5 w-3.5" />
                                Tindakan Selesai
                              </span>
                              {vp.performed_at && (
                                <span className="text-[11px] font-mono text-emerald-700 dark:text-emerald-300">
                                  {format(new Date(vp.performed_at), "dd MMMM yyyy HH:mm", { locale: idLocale })}
                                </span>
                              )}
                            </div>
                          )}

                          {vp.status === "cancelled" && (
                            <div className="border border-red-200 bg-red-50/70 dark:bg-red-950/30 px-3 py-2 text-xs">
                              <span className="font-semibold text-red-700 dark:text-red-300 flex items-center gap-1.5">
                                <XCircle className="h-3.5 w-3.5" />
                                Tindakan Dibatalkan
                              </span>
                            </div>
                          )}

                          {/* Results Display (for completed) */}
                          {vp.status === "completed" && vp.results && vp.results.length > 0 && (
                            <div className="border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 overflow-x-auto">
                              <table className="w-full text-xs">
                                <thead className="bg-neutral-50 dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800">
                                  <tr>
                                    <th className="h-8 px-3 text-left font-bold uppercase tracking-wider text-muted-foreground">
                                      Parameter
                                    </th>
                                    <th className="h-8 px-3 text-left font-bold uppercase tracking-wider text-muted-foreground">
                                      Hasil
                                    </th>
                                    <th className="h-8 px-3 text-left font-bold uppercase tracking-wider text-muted-foreground w-[110px]">
                                      Status
                                    </th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
                                  {vp.results.map((result, idx) => (
                                    <tr key={idx}>
                                      <td className="py-2 px-3">
                                        <p className="font-semibold text-foreground">{result.parameter?.name}</p>
                                        {result.parameter?.unit && (
                                          <p className="text-[11px] text-muted-foreground">Unit: {result.parameter.unit}</p>
                                        )}
                                      </td>
                                      <td className="py-2 px-3 font-mono">{result.num_value || result.value || "-"}</td>
                                      <td className="py-2 px-3">
                                        {result.is_critical ? (
                                          <Badge variant="destructive" className="rounded-none text-[10px] h-5 px-1.5">
                                            Kritis
                                          </Badge>
                                        ) : result.is_abnormal ? (
                                          <Badge variant="outline" className="rounded-none text-[10px] h-5 px-1.5 bg-yellow-100 text-yellow-800">
                                            Abnormal
                                          </Badge>
                                        ) : (
                                          <Badge variant="secondary" className="rounded-none text-[10px] h-5 px-1.5">
                                            Normal
                                          </Badge>
                                        )}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  );
                })}
              </div>
            ) : (
              <div className="p-4">
                <div className="border border-dashed border-neutral-200 dark:border-neutral-800 bg-neutral-50/30 dark:bg-neutral-900/10 px-3.5 py-2.5 text-xs text-muted-foreground">
                  Tidak ada tindakan pada filter atau pencarian ini.
                </div>
              </div>
            )}
          </section>
        </div>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent className="max-w-sm rounded-none">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-sm font-bold uppercase tracking-tight">Hapus Tindakan?</AlertDialogTitle>
              <AlertDialogDescription className="text-xs">
                Tindakan ini akan dihapus dari daftar. Tindakan hanya dapat dihapus jika statusnya masih "Menunggu".
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="h-8 rounded-none text-xs">Batal</AlertDialogCancel>
              <AlertDialogAction
                className="h-8 rounded-none text-xs bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={handleDeleteProcedure}
              >
                Hapus
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Discount Modal */}
        <Dialog open={discountDialogOpen} onOpenChange={setDiscountDialogOpen}>
          <DialogContent className="sm:max-w-md rounded-none p-0 gap-0 border-neutral-200 dark:border-neutral-800 overflow-hidden">
            <DialogHeader className="px-4 py-3 border-b border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950">
              <div className="flex items-center gap-2.5">
                <div className="size-8 bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 flex items-center justify-center shrink-0">
                  <Tag className="h-4 w-4" />
                </div>
                <div className="text-left min-w-0">
                  <DialogTitle className="text-sm font-bold uppercase tracking-tight">
                    Pengaturan Diskon Tindakan
                  </DialogTitle>
                  <DialogDescription className="text-xs mt-0.5">
                    Atur jenis, nominal/persentase, serta keterangan diskon untuk tindakan ini.
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <div className="p-4 space-y-3 [&_input]:h-9 [&_[role=combobox]]:h-9 [&_input]:rounded-none [&_[role=combobox]]:rounded-none [&_input]:text-xs [&_[role=combobox]]:text-xs">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Jenis Diskon</Label>
                <Select
                  value={discountState.discount_type || "none"}
                  onValueChange={(v) =>
                    setDiscountState((prev) => ({
                      ...prev,
                      discount_type: v,
                      discount_value: v === "full" ? 0 : prev.discount_value,
                    }))
                  }
                >
                  <SelectTrigger className="h-9 text-xs rounded-none">
                    <SelectValue placeholder="Pilih Jenis" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none" className="text-xs">Tidak Ada</SelectItem>
                    <SelectItem value="percentage" className="text-xs">Persentase (%)</SelectItem>
                    <SelectItem value="fixed" className="text-xs">Nominal (Rp)</SelectItem>
                    <SelectItem value="full" className="text-xs">Gratis (100%)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {discountState.discount_type !== "" &&
                discountState.discount_type !== "none" &&
                discountState.discount_type !== "full" && (
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">
                      {discountState.discount_type === "percentage" ? "Nilai Persentase (%)" : "Nominal Diskon (Rp)"}
                    </Label>
                    <Input
                      type="number"
                      min="0"
                      max={discountState.discount_type === "percentage" ? "100" : undefined}
                      value={discountState.discount_value || ""}
                      onChange={(e) =>
                        setDiscountState((prev) => ({
                          ...prev,
                          discount_value: parseFloat(e.target.value) || 0,
                        }))
                      }
                    />
                  </div>
                )}
              {discountState.discount_type !== "" && discountState.discount_type !== "none" && (
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Catatan / Alasan Diskon</Label>
                  <Combobox
                    options={[
                      { value: "Diskon Jasa Dokter", label: "Diskon Jasa Dokter" },
                      { value: "Diskon Jasa Perawat", label: "Diskon Jasa Perawat" },
                      { value: "Diskon Manajemen", label: "Diskon Manajemen" },
                      { value: "Promo / Gratis", label: "Promo / Gratis" },
                    ]}
                    value={discountState.discount_note}
                    onValueChange={(v) => setDiscountState((prev) => ({ ...prev, discount_note: v }))}
                    placeholder="Pilih atau ketik alasan diskon..."
                    allowCustomValue={true}
                    className="w-full"
                  />
                </div>
              )}
            </div>

            <DialogFooter className="px-4 py-3 border-t border-neutral-200 dark:border-neutral-800 bg-neutral-50/60 dark:bg-neutral-900/40 gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 rounded-none px-4 text-xs"
                onClick={() => setDiscountDialogOpen(false)}
              >
                Batal
              </Button>
              <Button
                type="button"
                size="sm"
                className="h-8 rounded-none px-4 text-xs"
                onClick={handleSaveDiscount}
                disabled={saving}
              >
                {saving && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                Simpan Diskon
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </fieldset>
    </div>
  );
}
