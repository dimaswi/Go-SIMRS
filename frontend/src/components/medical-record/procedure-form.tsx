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
          />
        );
      case "number":
        return (
          <div className="space-y-2">
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
              />
              {param.unit && <span className="text-sm text-muted-foreground">{param.unit}</span>}
            </div>
            {(param.normal_min !== undefined || param.normal_max !== undefined || param.normal_text) && (
              <p className="text-xs text-muted-foreground">
                Nilai Normal: {param.normal_text || `${param.normal_min} - ${param.normal_max} ${param.unit || ""}`}
              </p>
            )}
            {value.is_abnormal && (
              <Badge variant="outline" className="bg-yellow-100 text-yellow-800">
                <AlertTriangle className="h-3 w-3 mr-1" />
                Abnormal
              </Badge>
            )}
            {value.is_critical && (
              <Badge variant="destructive">
                <AlertTriangle className="h-3 w-3 mr-1" />
                Kritis
              </Badge>
            )}
          </div>
        );
      case "select":
        const options = param.options ? JSON.parse(param.options) : [];
        return (
          <Select
            value={value.value}
            onValueChange={(v) => handleResultChange(param.id, "value", v)}
            disabled={isDisabled}
          >
            <SelectTrigger>
              <SelectValue placeholder={`Pilih ${param.name}`} />
            </SelectTrigger>
            <SelectContent>
              {options.map((opt: string) => (
                <SelectItem key={opt} value={opt}>
                  {opt}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      case "checkbox":
        return (
          <div className="flex items-center space-x-2">
            <Checkbox
              id={`param-${param.id}`}
              checked={value.value === "true" || value.value === "1"}
              onCheckedChange={(checked) => handleResultChange(param.id, "value", checked ? "true" : "false")}
              disabled={isDisabled}
            />
            <label
              htmlFor={`param-${param.id}`}
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
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

  // Count how many times each procedure has been added
  const procedureCounts = visitProcedures.reduce((acc, vp) => {
    acc[vp.procedure_id] = (acc[vp.procedure_id] || 0) + 1;
    return acc;
  }, {} as Record<number, number>);

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

  if (availableProcedures.length === 0) {
    return (
      <div>
        <div className="py-12">
          <div className="text-center text-muted-foreground">
            <Scissors className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Tidak ada tindakan yang tersedia untuk ruangan ini.</p>
            <p className="text-sm mt-2">
              Silakan tambahkan tindakan ke ruangan melalui menu Manajemen Ruangan.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <fieldset disabled={readOnly}>
      <div className="space-y-6">
        <div className="grid gap-4 xl:grid-cols-2 items-start">
          <div className="rounded-lg border border-border/70 bg-background">
            <div className="border-b border-border/70 bg-muted/25 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Kolom 1 - Assign Tindakan
            </div>
            <div className="border-b p-3 space-y-2 bg-muted/10">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold">Katalog Tindakan</p>
                <Badge variant="secondary" className="text-xs">{filteredProcedures.length} item</Badge>
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Cari tindakan (nama/kode)..."
                  className="pl-9"
                />
              </div>
              <p className="text-xs text-muted-foreground">Klik tombol plus pada tindakan untuk assign cepat.</p>
            </div>

            {canCreate ? (
              filteredProcedures.length > 0 ? (
                <div>
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-background z-10 border-b">
                      <tr>
                        <th className="py-2 px-3 text-left">Tindakan</th>
                        <th className="py-2 px-3 w-24 text-left">Kode</th>
                        <th className="py-2 px-3 w-24 text-left">Status</th>
                        <th className="py-2 px-3 w-16 text-left">Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredProcedures.map((proc) => {
                        const addedCount = procedureCounts[proc.id] || 0;
                        return (
                          <tr key={proc.id} className="border-b hover:bg-muted/40 transition-colors">
                            <td className="py-2 px-3">
                              <p className="font-medium text-sm truncate">{proc.name}</p>
                              <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                                {proc.has_parameters && <span>Memiliki parameter</span>}
                                {proc.duration && <span>â€¢ {proc.duration} menit</span>}
                              </div>
                            </td>
                            <td className="py-2 px-3 text-xs text-muted-foreground">{proc.code}</td>
                            <td className="py-2 px-3">
                              {addedCount > 0 ? (
                                <Badge variant="secondary" className="text-xs">{addedCount}x</Badge>
                              ) : (
                                <span className="text-xs text-muted-foreground">baru</span>
                              )}
                            </td>
                            <td className="py-2 px-3" onClick={(e) => e.stopPropagation()}>
                              <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                className="h-8 w-8"
                                disabled={saving}
                                onClick={() => handleQuickAddProcedure(proc.id)}
                                title="Tambah cepat"
                              >
                                <Plus className="h-4 w-4" />
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="py-12 text-center text-muted-foreground">
                  <AlertCircle className="h-10 w-10 mx-auto mb-3 opacity-50" />
                  <p className="font-medium">Tidak ada tindakan yang cocok</p>
                  <p className="text-sm mt-1">Ubah kata kunci pencarian untuk melihat tindakan lain.</p>
                </div>
              )
            ) : (
              <div className="py-12 text-center text-muted-foreground">
                <AlertCircle className="h-10 w-10 mx-auto mb-3 opacity-50" />
                <p>Anda tidak memiliki izin untuk menambahkan tindakan.</p>
              </div>
            )}

          </div>

          <div className="rounded-lg border border-border/70 bg-background">
            <div className="border-b border-border/70 bg-muted/25 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Kolom 2 - Verifikasi dan Isi Hasil
            </div>
            <div className="border-b p-3 space-y-2 bg-muted/10">
              <div className="flex flex-wrap items-center gap-2 justify-between">
                <div className="flex flex-wrap items-center gap-2">
                  <Button type="button" variant={statusFilter === "all" ? "default" : "outline"} size="sm" onClick={() => setStatusFilter("all")}>
                    Semua ({queueCounts.all})
                  </Button>
                  <Button type="button" variant={statusFilter === "pending" ? "default" : "outline"} size="sm" onClick={() => setStatusFilter("pending")}>
                    Menunggu ({queueCounts.pending})
                  </Button>
                  <Button type="button" variant={statusFilter === "in_progress" ? "default" : "outline"} size="sm" onClick={() => setStatusFilter("in_progress")}>
                    Proses ({queueCounts.in_progress})
                  </Button>
                  <Button type="button" variant={statusFilter === "completed" ? "default" : "outline"} size="sm" onClick={() => setStatusFilter("completed")}>
                    Selesai ({queueCounts.completed})
                  </Button>
                  <Button type="button" variant={statusFilter === "cancelled" ? "default" : "outline"} size="sm" onClick={() => setStatusFilter("cancelled")}>
                    Batal ({queueCounts.cancelled})
                  </Button>
                </div>
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={queueSearchQuery}
                  onChange={(e) => setQueueSearchQuery(e.target.value)}
                  placeholder="Cari di antrian tindakan..."
                  className="pl-9"
                />
              </div>
            </div>

            {filteredVisitProcedures.length > 0 ? (
              <div className="divide-y">
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
                      <div className={`hover:bg-muted/50 ${isExpanded ? "bg-primary/5" : ""}`}>
                        <CollapsibleTrigger className="w-full">
                          <div className="flex items-center gap-3 p-3">
                            {isExpanded ? (
                              <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                            ) : (
                              <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                            )}
                            <div className="flex-1 text-left">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-medium text-sm">{vp.procedure?.name}</span>
                                <Badge className={getVisitProcedureStatusColor(vp.status)} variant="secondary">
                                  {getVisitProcedureStatusLabel(vp.status)}
                                </Badge>
                              </div>
                              <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                                <span>{vp.procedure?.code}</span>
                                {vp.created_by && (
                                  <>
                                    <span>â€¢</span>
                                    <span className="flex items-center gap-1" title="Dibuat oleh">
                                      <Plus className="h-3 w-3" />
                                      {vp.created_by.full_name}
                                    </span>
                                  </>
                                )}
                                {vp.filled_by && vp.filled_by.id !== vp.created_by?.id && (
                                  <>
                                    <span>â€¢</span>
                                    <span className="flex items-center gap-1" title="Dikerjakan oleh">
                                      <User className="h-3 w-3" />
                                      {vp.filled_by.full_name}
                                    </span>
                                  </>
                                )}
                                {vp.performed_at && (
                                  <>
                                    <span>â€¢</span>
                                    <span>{format(new Date(vp.performed_at), "dd MMM HH:mm", { locale: idLocale })}</span>
                                  </>
                                )}
                              </div>
                            </div>
                            {canDelete && vp.status === "pending" && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive flex-shrink-0"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setProcedureToDelete(vp.id);
                                  setDeleteDialogOpen(true);
                                }}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                            {canEdit && !isDisabled && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-blue-600 flex-shrink-0"
                                title="Pengaturan Diskon"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openDiscountDialog(vp.id);
                                }}
                              >
                                <Tag className="h-4 w-4" />
                              </Button>
                            )}
                            {canEdit && vp.status !== "completed" && vp.status !== "cancelled" && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-orange-600 flex-shrink-0"
                                title="Batalkan Tindakan"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleSaveResults(vp.id, "cancelled");
                                }}
                              >
                                <XCircle className="h-4 w-4" />
                              </Button>
                            )}
                            {canEdit && (vp.status === "pending" || vp.status === "in_progress") && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-green-600 flex-shrink-0"
                                title="Selesaikan Tindakan"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleSaveResults(vp.id, "completed");
                                }}
                              >
                                <CheckCircle className="h-4 w-4" />
                              </Button>
                            )}
                            {canEdit && vp.status === "completed" && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-blue-600 flex-shrink-0"
                                title="Ubah ke Proses"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleSaveResults(vp.id, "in_progress");
                                }}
                              >
                                <RotateCcw className="h-4 w-4" />
                              </Button>
                            )}
                            {canEdit && vp.status === "cancelled" && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-green-600 flex-shrink-0"
                                title="Aktifkan Kembali"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleSaveResults(vp.id, "pending");
                                }}
                              >
                                <Check className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </CollapsibleTrigger>
                      </div>

                      {/* Collapsible Content - Form */}
                      <CollapsibleContent>
                        <div className="border-t bg-muted/20 p-4 space-y-4">
                          {/* Info Section */}
                          <div className="bg-background rounded-lg p-3 border">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                              <div>
                                <span className="text-muted-foreground">Kode:</span>{" "}
                                <span className="font-medium">{vp.procedure?.code}</span>
                              </div>
                              <div>
                                <span className="text-muted-foreground">Jenis:</span>{" "}
                                <span className="font-medium">{vp.procedure?.procedure_type || "-"}</span>
                              </div>
                              <div>
                                <span className="text-muted-foreground">Dibuat:</span>{" "}
                                <span className="font-medium">{vp.created_by?.full_name || "-"}</span>
                              </div>
                              <div>
                                <span className="text-muted-foreground">Diisi:</span>{" "}
                                <span className="font-medium">{vp.filled_by?.full_name || "-"}</span>
                              </div>
                            </div>
                          </div>

                          {/* Parameters Form */}
                          {hasParams ? (
                            <div className="space-y-3">
                              <Label className="text-sm font-medium">Parameter Hasil</Label>
                              {vp.procedure?.parameters?.map((param) => (
                                <div key={param.id} className="space-y-1">
                                  <Label className="text-sm">
                                    {param.name}
                                    {param.is_required && <span className="text-destructive ml-1">*</span>}
                                  </Label>
                                  {renderParameterInput(param, isDisabled)}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="border-2 border-dashed rounded-lg p-4 text-center text-muted-foreground">
                              <AlertCircle className="h-6 w-6 mx-auto mb-2 opacity-50" />
                              <p className="text-sm">Tindakan ini tidak memiliki parameter hasil.</p>
                              <p className="text-xs mt-1">Klik "Selesai" untuk menyelesaikan tindakan.</p>
                            </div>
                          )}

                          {/* Action Buttons */}
                          {canEdit && !isDisabled && (
                            <div className="flex flex-wrap justify-end gap-2 pt-2">
                              {vp.status === "pending" && hasParams && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleSaveResults(vp.id, "in_progress")}
                                  disabled={saving}
                                >
                                  <Play className="h-4 w-4 mr-1" />
                                  Mulai
                                </Button>
                              )}
                              <Button
                                variant="outline"
                                size="sm"
                                className="text-destructive border-destructive hover:bg-destructive/10"
                                onClick={() => handleSaveResults(vp.id, "cancelled")}
                                disabled={saving}
                              >
                                <XCircle className="h-4 w-4 mr-1" />
                                Batal
                              </Button>
                              {hasParams && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleSaveResults(vp.id)}
                                  disabled={saving}
                                >
                                  {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
                                  Simpan
                                </Button>
                              )}
                              <Button
                                size="sm"
                                className="bg-green-600 hover:bg-green-700"
                                onClick={() => handleSaveResults(vp.id, "completed")}
                                disabled={saving}
                              >
                                {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <CheckCircle className="h-4 w-4 mr-1" />}
                                Selesai
                              </Button>
                            </div>
                          )}

                          {/* Completed/Cancelled Status Display */}
                          {vp.status === "completed" && (
                            <div className="bg-green-50 dark:bg-green-950 border border-green-200 rounded-lg p-3">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <div>
                                  <p className="font-medium text-green-700 dark:text-green-300 flex items-center gap-2 text-sm">
                                    <CheckCircle className="h-4 w-4" />
                                    Tindakan Selesai
                                  </p>
                                  {vp.performed_at && (
                                    <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                                      {format(new Date(vp.performed_at), "dd MMMM yyyy HH:mm", { locale: idLocale })}
                                    </p>
                                  )}
                                </div>
                              </div>
                            </div>
                          )}

                          {vp.status === "cancelled" && (
                            <div className="bg-red-50 dark:bg-red-950 border border-red-200 rounded-lg p-3">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <p className="font-medium text-red-700 dark:text-red-300 flex items-center gap-2 text-sm">
                                  <XCircle className="h-4 w-4" />
                                  Tindakan Dibatalkan
                                </p>
                              </div>
                            </div>
                          )}

                          {/* Results Display (for completed) */}
                          {vp.status === "completed" && vp.results && vp.results.length > 0 && (
                            <div className="border rounded-lg">
                              <table className="w-full text-sm">
                                <thead className="bg-muted/50">
                                  <tr>
                                    <th className="py-2 px-3 text-left font-medium">Parameter</th>
                                    <th className="py-2 px-3 text-left font-medium">Hasil</th>
                                    <th className="py-2 px-3 text-left font-medium">Status</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {vp.results.map((result, idx) => (
                                    <tr key={idx} className="border-t">
                                      <td className="py-2 px-3">
                                        <p className="font-medium">{result.parameter?.name}</p>
                                        {result.parameter?.unit && (
                                          <p className="text-xs text-muted-foreground">Unit: {result.parameter.unit}</p>
                                        )}
                                      </td>
                                      <td className="py-2 px-3">{result.num_value || result.value || "-"}</td>
                                      <td className="py-2 px-3">
                                        {result.is_critical ? (
                                          <Badge variant="destructive" className="text-xs">Kritis</Badge>
                                        ) : result.is_abnormal ? (
                                          <Badge variant="outline" className="bg-yellow-100 text-yellow-800 text-xs">Abnormal</Badge>
                                        ) : (
                                          <Badge variant="secondary" className="text-xs">Normal</Badge>
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
              <div className="py-12 text-center text-muted-foreground">
                <Scissors className="h-10 w-10 mx-auto mb-3 opacity-50" />
                <p className="font-medium">Tidak ada data pada filter ini</p>
                <p className="text-sm mt-1">Coba ubah status filter atau kata kunci pencarian.</p>
              </div>
            )}
          </div>
        </div>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Hapus Tindakan?</AlertDialogTitle>
              <AlertDialogDescription>
                Tindakan ini akan dihapus dari daftar. Tindakan hanya dapat dihapus jika statusnya masih "Menunggu".
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Batal</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={handleDeleteProcedure}
              >
                Hapus
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Discount Modal */}
        <Dialog open={discountDialogOpen} onOpenChange={setDiscountDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Pengaturan Diskon</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Jenis Diskon</Label>
                <Select
                  value={discountState.discount_type || "none"}
                  onValueChange={(v) => setDiscountState((prev) => ({ ...prev, discount_type: v, discount_value: v === "full" ? 0 : prev.discount_value }))}
                >
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue placeholder="Pilih Jenis" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Tidak Ada</SelectItem>
                    <SelectItem value="percentage">Persentase (%)</SelectItem>
                    <SelectItem value="fixed">Nominal (Rp)</SelectItem>
                    <SelectItem value="full">Gratis (100%)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {discountState.discount_type !== "" && discountState.discount_type !== "none" && discountState.discount_type !== "full" && (
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">
                    {discountState.discount_type === "percentage" ? "Nilai Persentase (%)" : "Nominal Diskon (Rp)"}
                  </Label>
                  <Input
                    type="number"
                    min="0"
                    max={discountState.discount_type === "percentage" ? "100" : undefined}
                    value={discountState.discount_value || ""}
                    onChange={(e) => setDiscountState((prev) => ({ ...prev, discount_value: parseFloat(e.target.value) || 0 }))}
                    className="h-9 text-sm"
                  />
                </div>
              )}
              {discountState.discount_type !== "" && discountState.discount_type !== "none" && (
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Catatan / Alasan</Label>
                  <Combobox
                    options={[
                      { value: "Diskon Jasa Dokter", label: "Diskon Jasa Dokter" },
                      { value: "Diskon Jasa Perawat", label: "Diskon Jasa Perawat" },
                      { value: "Diskon Manajemen", label: "Diskon Manajemen" },
                      { value: "Promo / Gratis", label: "Promo / Gratis" }
                    ]}
                    value={discountState.discount_note}
                    onValueChange={(v) => setDiscountState((prev) => ({ ...prev, discount_note: v }))}
                    placeholder="Pilih/ketik manual..."
                    allowCustomValue={true}
                    className="w-full"
                  />
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDiscountDialogOpen(false)}>Batal</Button>
              <Button onClick={handleSaveDiscount} disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Simpan
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </fieldset>
  );
}
