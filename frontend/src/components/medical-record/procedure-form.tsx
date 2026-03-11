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
  Clock,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  XCircle,
  RotateCcw,
  Check,
} from "lucide-react";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";

interface ProcedureFormProps {
  visitId: number;
  readOnly?: boolean;
}

// Check if procedure has parameters
function procedureHasParameters(procedure: VisitProcedure): boolean {
  return (procedure.procedure?.parameters && procedure.procedure.parameters.length > 0) || false;
}

export function ProcedureForm({ visitId, readOnly = false }: ProcedureFormProps) {
  const { toast } = useToast();
  const { hasPermission } = usePermission();

  // State
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [roomProcedures, setRoomProcedures] = useState<RoomProcedureForVisit[]>([]);
  const [visitProcedures, setVisitProcedures] = useState<VisitProcedure[]>([]);
  const [expandedProcedure, setExpandedProcedure] = useState<number | null>(null);
  const [resultValues, setResultValues] = useState<Record<number, { value: string; num_value: number; is_abnormal: boolean; is_critical: boolean }>>({});
  const [editingNotes, setEditingNotes] = useState<string>("");

  // New procedure form
  const [selectedProcedureIds, setSelectedProcedureIds] = useState<number[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [addNotes, setAddNotes] = useState("");
  const [queueSearchQuery, setQueueSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "in_progress" | "completed" | "cancelled">("all");

  // Dialogs
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [procedureToDelete, setProcedureToDelete] = useState<number | null>(null);

  // Permissions
  const canCreate = hasPermission("medical_records.procedure");
  const canEdit = hasPermission("medical_records.procedure");
  const canDelete = hasPermission("medical_records.procedure");

  // Load data
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [roomProcRes, visitProcRes] = await Promise.all([
        visitProceduresApi.getRoomProcedures(visitId),
        visitProceduresApi.getAll(visitId),
      ]);
      setRoomProcedures(roomProcRes.data.data || []);
      setVisitProcedures(visitProcRes.data.data || []);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.response?.data?.error || "Gagal memuat data tindakan",
      });
    } finally {
      setLoading(false);
    }
  }, [visitId, toast]);

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
      setEditingNotes(procedure.notes || "");
    }

    setExpandedProcedure(procedureId);
  };

  // Add procedures (bulk)
  const handleAddProcedure = async () => {
    if (selectedProcedureIds.length === 0) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Pilih minimal satu tindakan terlebih dahulu",
      });
      return;
    }

    setSaving(true);
    try {
      await Promise.all(
        selectedProcedureIds.map((procedureId) =>
          visitProceduresApi.create(visitId, {
            procedure_id: procedureId,
            notes: addNotes,
          })
        )
      );
      toast({
        title: "Berhasil",
        description: `${selectedProcedureIds.length} tindakan berhasil ditambahkan`,
      });
      setSelectedProcedureIds([]);
      setAddNotes("");
      loadData();
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
        notes: editingNotes,
        results,
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
  const availableProcedures = roomProcedures;
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

  const toggleProcedureSelection = (procedureId: number) => {
    setSelectedProcedureIds((prev) =>
      prev.includes(procedureId)
        ? prev.filter((id) => id !== procedureId)
        : [...prev, procedureId]
    );
  };

  const queueCounts = useMemo(() => {
    return {
      all: visitProcedures.length,
      pending: visitProcedures.filter((p) => p.status === "pending").length,
      in_progress: visitProcedures.filter((p) => p.status === "in_progress").length,
      completed: visitProcedures.filter((p) => p.status === "completed").length,
      cancelled: visitProcedures.filter((p) => p.status === "cancelled").length,
    };
  }, [visitProcedures]);

  const filteredVisitProcedures = useMemo(() => {
    return visitProcedures.filter((vp) => {
      if (statusFilter !== "all" && vp.status !== statusFilter) return false;
      if (!queueSearchQuery.trim()) return true;

      const q = queueSearchQuery.toLowerCase();
      const name = vp.procedure?.name?.toLowerCase() || "";
      const code = vp.procedure?.code?.toLowerCase() || "";
      const creator = vp.created_by?.full_name?.toLowerCase() || "";
      const filler = vp.filled_by?.full_name?.toLowerCase() || "";
      return name.includes(q) || code.includes(q) || creator.includes(q) || filler.includes(q);
    });
  }, [visitProcedures, statusFilter, queueSearchQuery]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (roomProcedures.length === 0) {
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
    <div className="space-y-4">
    <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">
      {/* Left Column - Available Procedures to Add */}
      <div className="xl:col-span-2">
        <div className="rounded-lg border bg-background overflow-hidden">
          <div className="border-b p-3 space-y-2 bg-muted/20">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold">Katalog Tindakan</p>
              <Badge variant="secondary" className="text-xs">{filteredProcedures.length} item</Badge>
            </div>
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari tindakan (nama/kode)..."
            />
            <Textarea
              value={addNotes}
              onChange={(e) => setAddNotes(e.target.value)}
              placeholder="Catatan untuk tindakan terpilih (opsional)..."
              rows={2}
            />
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-muted-foreground">{selectedProcedureIds.length} terpilih</span>
              <div className="flex items-center gap-2">
                {selectedProcedureIds.length > 0 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8"
                    onClick={() => setSelectedProcedureIds([])}
                  >
                    Reset
                  </Button>
                )}
                <Button
                  type="button"
                  size="sm"
                  className="h-8"
                  disabled={saving || selectedProcedureIds.length === 0}
                  onClick={handleAddProcedure}
                >
                  {saving ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Menambahkan...
                    </>
                  ) : (
                    <>
                      <Plus className="h-4 w-4 mr-2" />
                      Assign {selectedProcedureIds.length > 0 ? selectedProcedureIds.length : ""}
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>

          {canCreate ? (
            filteredProcedures.length > 0 ? (
              <div className="max-h-[520px] overflow-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-background z-10 border-b">
                    <tr>
                      <th className="py-2 px-3 w-10 text-left">✓</th>
                      <th className="py-2 px-3 text-left">Tindakan</th>
                      <th className="py-2 px-3 w-24 text-left">Kode</th>
                      <th className="py-2 px-3 w-24 text-left">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                  {filteredProcedures.map((proc) => {
                    const isSelected = selectedProcedureIds.includes(proc.id);
                    const addedCount = procedureCounts[proc.id] || 0;
                    return (
                      <tr
                        key={proc.id}
                        className={`cursor-pointer border-b hover:bg-muted/40 transition-colors ${
                          isSelected ? "bg-primary/10" : ""
                        }`}
                        onClick={() => toggleProcedureSelection(proc.id)}
                      >
                        <td className="py-2 px-3" onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => toggleProcedureSelection(proc.id)}
                          />
                        </td>
                        <td className="py-2 px-3">
                          <p className="font-medium text-sm truncate">{proc.name}</p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                            {proc.has_parameters && <span>Memiliki parameter</span>}
                            {proc.duration && <span>• {proc.duration} menit</span>}
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
      </div>

      {/* Right Column - Added Procedures with Collapsible Form */}
      <div className="xl:col-span-3">
        <div className="rounded-lg border bg-background overflow-hidden">
          <div className="border-b p-3 space-y-2 bg-muted/20">
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
            <Input
              value={queueSearchQuery}
              onChange={(e) => setQueueSearchQuery(e.target.value)}
              placeholder="Cari di antrian tindakan..."
            />
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
                            <div className="grid grid-cols-2 gap-2 text-sm">
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

                          {/* Notes */}
                          <div className="space-y-1">
                            <Label className="text-sm">Catatan</Label>
                            <Textarea
                              value={editingNotes}
                              onChange={(e) => setEditingNotes(e.target.value)}
                              placeholder="Catatan tambahan..."
                              disabled={isDisabled}
                              rows={2}
                            />
                          </div>

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
                              <div className="flex items-center justify-between">
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
                              <div className="flex items-center justify-between">
                                <p className="font-medium text-red-700 dark:text-red-300 flex items-center gap-2 text-sm">
                                  <XCircle className="h-4 w-4" />
                                  Tindakan Dibatalkan
                                </p>
                              </div>
                            </div>
                          )}

                          {/* Results Display (for completed) */}
                          {vp.status === "completed" && vp.results && vp.results.length > 0 && (
                            <div className="border rounded-lg overflow-hidden">
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
    </div>
    </div>
    </fieldset>
  );
}
