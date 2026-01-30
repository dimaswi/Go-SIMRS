import { useState, useEffect } from "react";
import { usePermission } from "@/hooks/usePermission";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2,
  Scissors,
  Play,
  CheckCircle2,
  Save,
  AlertCircle,
  Clock,
  FileText,
  Stethoscope,
  ClipboardList,
  Syringe,
  Droplets,
  ShieldAlert,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { procedureOrdersApi, PROCEDURE_ORDER_STATUS } from "@/lib/api";
import type { ProcedureOrder, ProcedureOrderItem, ProcedureParameter } from "@/lib/api/procedure-orders";

interface SurgeryWorkstationProps {
  visitId: number;
  readOnly?: boolean;
}

// Anesthesia type options
const ANESTHESIA_TYPES = [
  { value: "", label: "Pilih jenis anestesi..." },
  { value: "general", label: "General Anesthesia (GA)" },
  { value: "regional_spinal", label: "Regional - Spinal" },
  { value: "regional_epidural", label: "Regional - Epidural" },
  { value: "regional_cse", label: "Regional - CSE (Combined)" },
  { value: "regional_block", label: "Regional - Nerve Block" },
  { value: "local", label: "Local Anesthesia" },
  { value: "sedation", label: "Sedasi" },
  { value: "none", label: "Tanpa Anestesi" },
];

// Wound classification
const WOUND_CLASSES = [
  { value: "", label: "Pilih klasifikasi..." },
  { value: "clean", label: "Bersih (Clean)" },
  { value: "clean_contaminated", label: "Bersih Terkontaminasi (Clean-Contaminated)" },
  { value: "contaminated", label: "Terkontaminasi (Contaminated)" },
  { value: "dirty", label: "Kotor/Infeksi (Dirty/Infected)" },
];

export function SurgeryWorkstation({ visitId, readOnly: _readOnly = false }: SurgeryWorkstationProps) {
  const { toast } = useToast();
  const { hasPermission } = usePermission();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [orders, setOrders] = useState<ProcedureOrder[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<ProcedureOrder | null>(null);

  // ===== Standard Surgery Report Fields =====
  // These map to ProcedureOrder's result_summary, conclusion, suggestion
  const [diagnosisPreOp, setDiagnosisPreOp] = useState("");
  const [diagnosisPostOp, setDiagnosisPostOp] = useState("");
  const [anesthesiaType, setAnesthesiaType] = useState("");
  const [surgicalFindings, setSurgicalFindings] = useState("");
  const [surgicalProcedure, setSurgicalProcedure] = useState("");
  const [complications, setComplications] = useState("");
  const [hasComplications, setHasComplications] = useState(false);
  const [bloodLoss, setBloodLoss] = useState("");
  const [woundClassification, setWoundClassification] = useState("");
  const [specimen, setSpecimen] = useState("");
  const [hasSpecimen, setHasSpecimen] = useState(false);
  const [postOpInstructions, setPostOpInstructions] = useState("");

  // Extra parameter results (from master data)
  const [itemResults, setItemResults] = useState<Record<number, Record<number, string>>>({});

  // Section collapse states
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    report: true,
    parameters: true,
  });

  const canPerform = hasPermission("procedure_orders.perform");

  useEffect(() => {
    loadOrders();
  }, [visitId]);

  const loadOrders = async () => {
    setLoading(true);
    try {
      const res = await procedureOrdersApi.getAll({
        target_visit_id: visitId,
        order_type: "surgery",
      });
      setOrders(res.data || []);

      const activeOrder = (res.data || []).find(
        (o: ProcedureOrder) => o.status === "pending" || o.status === "in_progress"
      );
      const orderToSelect = activeOrder || (res.data && res.data.length > 0 ? res.data[0] : null);

      if (orderToSelect) {
        selectOrder(orderToSelect);
      }
    } catch (error) {
      console.error("Error loading orders:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Gagal memuat data order operasi",
      });
    } finally {
      setLoading(false);
    }
  };

  const selectOrder = (order: ProcedureOrder) => {
    setSelectedOrder(order);
    parseResultFields(order);
    initializeParameterResults(order);
  };

  /**
   * Parse the 3 ProcedureOrder result fields back into structured surgery fields.
   * We store structured data as a simple key-value format in result_summary.
   */
  const parseResultFields = (order: ProcedureOrder) => {
    // Try to parse structured data from result_summary
    const summary = order.result_summary || "";

    if (summary.startsWith("{{STRUCTURED}}")) {
      try {
        const data = JSON.parse(summary.replace("{{STRUCTURED}}", ""));
        setDiagnosisPreOp(data.diagnosis_pre_op || order.diagnosis || "");
        setDiagnosisPostOp(data.diagnosis_post_op || "");
        setAnesthesiaType(data.anesthesia_type || "");
        setSurgicalFindings(data.surgical_findings || "");
        setSurgicalProcedure(data.surgical_procedure || "");
        setComplications(data.complications || "");
        setHasComplications(!!data.complications);
        setBloodLoss(data.blood_loss || "");
        setWoundClassification(data.wound_classification || "");
        setSpecimen(data.specimen || "");
        setHasSpecimen(!!data.specimen);
        setPostOpInstructions(order.suggestion || "");
        return;
      } catch {
        // Fall through to plain text parsing
      }
    }

    // Fallback: use plain fields
    setDiagnosisPreOp(order.diagnosis || "");
    setDiagnosisPostOp(order.conclusion || "");
    setSurgicalFindings(summary);
    setSurgicalProcedure("");
    setAnesthesiaType("");
    setComplications("");
    setHasComplications(false);
    setBloodLoss("");
    setWoundClassification("");
    setSpecimen("");
    setHasSpecimen(false);
    setPostOpInstructions(order.suggestion || "");
  };

  /**
   * Build structured result_summary for saving
   */
  const buildResultSummary = (): string => {
    const data = {
      diagnosis_pre_op: diagnosisPreOp,
      diagnosis_post_op: diagnosisPostOp,
      anesthesia_type: anesthesiaType,
      surgical_findings: surgicalFindings,
      surgical_procedure: surgicalProcedure,
      complications: hasComplications ? complications : "",
      blood_loss: bloodLoss,
      wound_classification: woundClassification,
      specimen: hasSpecimen ? specimen : "",
    };
    return "{{STRUCTURED}}" + JSON.stringify(data);
  };

  const initializeParameterResults = (order: ProcedureOrder) => {
    const results: Record<number, Record<number, string>> = {};
    order.items?.forEach((item) => {
      if (!item.id) return;
      results[item.id] = {};
      item.procedure?.parameters?.forEach((param) => {
        const existingResult = item.results?.find(
          (r) => r.procedure_parameter_id === param.id
        );
        results[item.id!][param.id] = existingResult?.value || "";
      });
    });
    setItemResults(results);
  };

  const updateItemResult = (itemId: number, paramId: number, value: string) => {
    setItemResults((prev) => ({
      ...prev,
      [itemId]: {
        ...prev[itemId],
        [paramId]: value,
      },
    }));
  };

  const buildItemResultsPayload = () => {
    if (!selectedOrder?.items) return [];
    return selectedOrder.items
      .filter((item) => item.id && itemResults[item.id!])
      .map((item) => ({
        item_id: item.id!,
        results: Object.entries(itemResults[item.id!] || {})
          .filter(([, value]) => value !== "")
          .map(([paramId, value]) => ({
            parameter_id: Number(paramId),
            value,
          })),
      }));
  };

  const hasParameters = (items?: ProcedureOrderItem[]) => {
    return items?.some((item) => item.procedure?.parameters && item.procedure.parameters.length > 0);
  };

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  // ===== Handlers =====
  const handleStartOrder = async () => {
    if (!selectedOrder) return;
    setSubmitting(true);
    try {
      await procedureOrdersApi.start(selectedOrder.id);
      toast({ title: "Berhasil", description: "Order operasi dimulai" });
      loadOrders();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.response?.data?.error || "Gagal memulai order",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveResults = async () => {
    if (!selectedOrder) return;
    setSubmitting(true);
    try {
      await procedureOrdersApi.saveResults(selectedOrder.id, {
        result_summary: buildResultSummary(),
        conclusion: diagnosisPostOp,
        suggestion: postOpInstructions,
        items: buildItemResultsPayload(),
      });
      toast({ title: "Berhasil", description: "Laporan operasi berhasil disimpan" });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.response?.data?.error || "Gagal menyimpan laporan",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleCompleteOrder = async () => {
    if (!selectedOrder) return;

    // Validate required fields
    if (!surgicalProcedure.trim()) {
      toast({
        variant: "destructive",
        title: "Validasi",
        description: "Uraian tindakan operasi wajib diisi",
      });
      return;
    }

    if (!confirm("Yakin ingin menyelesaikan operasi ini? Pastikan laporan sudah lengkap.")) return;

    setSubmitting(true);
    try {
      // Save results first, then complete
      await procedureOrdersApi.saveResults(selectedOrder.id, {
        result_summary: buildResultSummary(),
        conclusion: diagnosisPostOp,
        suggestion: postOpInstructions,
        items: buildItemResultsPayload(),
      });
      await procedureOrdersApi.complete(selectedOrder.id);
      toast({ title: "Berhasil", description: "Operasi telah diselesaikan" });
      loadOrders();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.response?.data?.error || "Gagal menyelesaikan operasi",
      });
    } finally {
      setSubmitting(false);
    }
  };

  // ===== Render Helpers =====
  const renderParameterInput = (item: ProcedureOrderItem, param: ProcedureParameter) => {
    const value = itemResults[item.id!]?.[param.id] || "";

    if (param.input_type === "textarea") {
      return (
        <Textarea
          value={value}
          onChange={(e) => updateItemResult(item.id!, param.id, e.target.value)}
          placeholder={param.description || param.name}
          rows={3}
        />
      );
    }
    if (param.input_type === "checkbox") {
      return (
        <div className="flex items-center gap-2 mt-1">
          <Checkbox
            checked={value === "true"}
            onCheckedChange={(checked) =>
              updateItemResult(item.id!, param.id, checked ? "true" : "false")
            }
          />
          <span className="text-sm">{param.description || param.name}</span>
        </div>
      );
    }
    if (param.input_type === "select" && param.options) {
      let options: string[] = [];
      try { options = JSON.parse(param.options); } catch { options = param.options.split(",").map((o) => o.trim()); }
      return (
        <Select value={value} onValueChange={(v) => updateItemResult(item.id!, param.id, v)}>
          <SelectTrigger><SelectValue placeholder="Pilih..." /></SelectTrigger>
          <SelectContent>
            {options.map((opt) => (
              <SelectItem key={opt} value={opt}>{opt}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    }
    return (
      <Input
        type={param.input_type === "number" ? "number" : "text"}
        value={value}
        onChange={(e) => updateItemResult(item.id!, param.id, e.target.value)}
        placeholder={param.description || param.name}
        step={param.input_type === "number" ? "any" : undefined}
      />
    );
  };

  /**
   * Parse structured result_summary for display in completed view
   */
  const parseCompletedData = (order: ProcedureOrder) => {
    const summary = order.result_summary || "";
    if (summary.startsWith("{{STRUCTURED}}")) {
      try {
        return JSON.parse(summary.replace("{{STRUCTURED}}", ""));
      } catch {
        return null;
      }
    }
    return null;
  };

  const getAnesthesiaLabel = (value: string) => {
    return ANESTHESIA_TYPES.find((t) => t.value === value)?.label || value;
  };

  const getWoundClassLabel = (value: string) => {
    return WOUND_CLASSES.find((w) => w.value === value)?.label || value;
  };

  // ===== Loading / Empty States =====
  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <Card className="shadow-md">
        <CardContent className="py-12 text-center">
          <Scissors className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
          <p className="text-muted-foreground">Belum ada order operasi untuk kunjungan ini</p>
        </CardContent>
      </Card>
    );
  }

  const patient = selectedOrder?.registration?.patient || selectedOrder?.source_visit?.registration?.patient;

  return (
    <Card className="shadow-md">
      <CardHeader className="border-b bg-muted/30 py-3 px-4">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Scissors className="h-4 w-4" />
              Pengerjaan Operasi / Bedah
            </CardTitle>
            <CardDescription>Kelola proses operasi untuk pasien</CardDescription>
          </div>
          {selectedOrder && (
            <div className="flex items-center gap-2">
              <Badge variant={PROCEDURE_ORDER_STATUS[selectedOrder.status as keyof typeof PROCEDURE_ORDER_STATUS]?.variant || "secondary"}>
                {PROCEDURE_ORDER_STATUS[selectedOrder.status as keyof typeof PROCEDURE_ORDER_STATUS]?.label || selectedOrder.status}
              </Badge>
              {selectedOrder.priority !== "normal" && (
                <Badge variant="destructive">{selectedOrder.priority.toUpperCase()}</Badge>
              )}
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent className="p-0">
        {/* Order selector */}
        {orders.length > 1 && (
          <div className="border-b p-3">
            <div className="flex gap-2 flex-wrap">
              {orders.map((order) => (
                <Button
                  key={order.id}
                  variant={selectedOrder?.id === order.id ? "default" : "outline"}
                  size="sm"
                  onClick={() => selectOrder(order)}
                >
                  {order.order_number}
                </Button>
              ))}
            </div>
          </div>
        )}

        {selectedOrder && (
          <ScrollArea className="h-[calc(100vh-400px)] min-h-[570px]">
            <div className="p-4 space-y-4">
              {/* ===== Order Info Summary ===== */}
              <div className="bg-muted/30 rounded-lg p-4 space-y-3">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                  <div>
                    <span className="text-muted-foreground text-xs">No. Order</span>
                    <p className="font-medium font-mono">{selectedOrder.order_number}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-xs">Pasien</span>
                    <p className="font-medium">{patient?.nama_lengkap || "-"}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-xs">No. RM</span>
                    <p className="font-medium font-mono">{patient?.no_rm || "-"}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-xs">Kamar Operasi</span>
                    <p className="font-medium">{selectedOrder.target_room?.name || "-"}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                  {selectedOrder.ordered_by && (
                    <div>
                      <span className="text-muted-foreground text-xs">Dokter Pengirim</span>
                      <p className="font-medium">{selectedOrder.ordered_by.nama_lengkap}</p>
                    </div>
                  )}
                  {selectedOrder.surgeon_doctor && (
                    <div>
                      <span className="text-muted-foreground text-xs">Dokter Bedah</span>
                      <p className="font-medium">{selectedOrder.surgeon_doctor.nama_lengkap}</p>
                    </div>
                  )}
                  {selectedOrder.scheduled_date && (
                    <div>
                      <span className="text-muted-foreground text-xs">Jadwal Operasi</span>
                      <p className="font-medium flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" />
                        {new Date(selectedOrder.scheduled_date).toLocaleString("id-ID", {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })}
                      </p>
                    </div>
                  )}
                </div>
                {selectedOrder.diagnosis && (
                  <div className="text-sm">
                    <span className="text-muted-foreground text-xs">Diagnosis</span>
                    <p>{selectedOrder.diagnosis}</p>
                  </div>
                )}
                {selectedOrder.clinical_notes && (
                  <div className="text-sm">
                    <span className="text-muted-foreground text-xs">Catatan Klinis</span>
                    <p>{selectedOrder.clinical_notes}</p>
                  </div>
                )}
                {/* Procedure items */}
                {selectedOrder.items && selectedOrder.items.length > 0 && (
                  <div className="text-sm">
                    <span className="text-muted-foreground text-xs">Tindakan Operasi</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {selectedOrder.items.map((item, idx) => (
                        <Badge key={idx} variant="outline" className="text-xs">
                          {item.procedure?.name || `Tindakan #${idx + 1}`}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* ===== Start Button ===== */}
              {canPerform && selectedOrder.status === "pending" && (
                <Button onClick={handleStartOrder} disabled={submitting} className="w-full" size="lg">
                  {submitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Play className="h-4 w-4 mr-2" />}
                  Mulai Proses Operasi
                </Button>
              )}

              {/* ===== SURGERY REPORT FORM (in_progress) ===== */}
              {selectedOrder.status === "in_progress" && canPerform && (
                <div className="space-y-4">
                  {/* Section: Laporan Operasi */}
                  <div className="border rounded-lg overflow-hidden">
                    <button
                      type="button"
                      className="w-full flex items-center justify-between p-3 bg-muted/50 hover:bg-muted/70 transition-colors"
                      onClick={() => toggleSection("report")}
                    >
                      <h4 className="font-semibold text-sm flex items-center gap-2">
                        <FileText className="h-4 w-4 text-primary" />
                        Laporan Operasi
                      </h4>
                      {expandedSections.report ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </button>

                    {expandedSections.report && (
                      <div className="p-4 space-y-4">
                        {/* Row 1: Diagnosis Pre & Post */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-1.5">
                            <Label className="text-xs font-medium flex items-center gap-1.5">
                              <Stethoscope className="h-3.5 w-3.5 text-muted-foreground" />
                              Diagnosis Pre-Operasi
                            </Label>
                            <Textarea
                              value={diagnosisPreOp}
                              onChange={(e) => setDiagnosisPreOp(e.target.value)}
                              placeholder="Diagnosis sebelum operasi..."
                              rows={2}
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs font-medium flex items-center gap-1.5">
                              <Stethoscope className="h-3.5 w-3.5 text-muted-foreground" />
                              Diagnosis Post-Operasi
                            </Label>
                            <Textarea
                              value={diagnosisPostOp}
                              onChange={(e) => setDiagnosisPostOp(e.target.value)}
                              placeholder="Diagnosis setelah operasi..."
                              rows={2}
                            />
                          </div>
                        </div>

                        {/* Row 2: Anesthesia & Wound Classification */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-1.5">
                            <Label className="text-xs font-medium flex items-center gap-1.5">
                              <Syringe className="h-3.5 w-3.5 text-muted-foreground" />
                              Jenis Anestesi
                            </Label>
                            <Select value={anesthesiaType} onValueChange={setAnesthesiaType}>
                              <SelectTrigger>
                                <SelectValue placeholder="Pilih jenis anestesi..." />
                              </SelectTrigger>
                              <SelectContent>
                                {ANESTHESIA_TYPES.filter((t) => t.value).map((type) => (
                                  <SelectItem key={type.value} value={type.value}>
                                    {type.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs font-medium flex items-center gap-1.5">
                              <ClipboardList className="h-3.5 w-3.5 text-muted-foreground" />
                              Klasifikasi Luka
                            </Label>
                            <Select value={woundClassification} onValueChange={setWoundClassification}>
                              <SelectTrigger>
                                <SelectValue placeholder="Pilih klasifikasi luka..." />
                              </SelectTrigger>
                              <SelectContent>
                                {WOUND_CLASSES.filter((w) => w.value).map((wc) => (
                                  <SelectItem key={wc.value} value={wc.value}>
                                    {wc.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>

                        <Separator />

                        {/* Uraian Tindakan */}
                        <div className="space-y-1.5">
                          <Label className="text-xs font-medium flex items-center gap-1.5">
                            <Scissors className="h-3.5 w-3.5 text-muted-foreground" />
                            Uraian Tindakan Operasi <span className="text-red-500">*</span>
                          </Label>
                          <Textarea
                            value={surgicalProcedure}
                            onChange={(e) => setSurgicalProcedure(e.target.value)}
                            placeholder="Deskripsikan langkah-langkah tindakan operasi yang dilakukan secara rinci..."
                            rows={5}
                            className="font-mono text-sm"
                          />
                        </div>

                        {/* Temuan Intra-Operatif */}
                        <div className="space-y-1.5">
                          <Label className="text-xs font-medium">Temuan Intra-Operatif</Label>
                          <Textarea
                            value={surgicalFindings}
                            onChange={(e) => setSurgicalFindings(e.target.value)}
                            placeholder="Deskripsikan temuan selama operasi berlangsung..."
                            rows={3}
                          />
                        </div>

                        {/* Row: Blood Loss & Complications */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-1.5">
                            <Label className="text-xs font-medium flex items-center gap-1.5">
                              <Droplets className="h-3.5 w-3.5 text-muted-foreground" />
                              Estimasi Perdarahan
                            </Label>
                            <div className="flex items-center gap-2">
                              <Input
                                type="number"
                                value={bloodLoss}
                                onChange={(e) => setBloodLoss(e.target.value)}
                                placeholder="0"
                                min="0"
                                className="flex-1"
                              />
                              <span className="text-sm text-muted-foreground whitespace-nowrap">ml</span>
                            </div>
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs font-medium flex items-center gap-1.5">
                              <ShieldAlert className="h-3.5 w-3.5 text-muted-foreground" />
                              Komplikasi
                            </Label>
                            <div className="flex items-center gap-2 h-9">
                              <Checkbox
                                id="has-complications"
                                checked={hasComplications}
                                onCheckedChange={(checked) => setHasComplications(checked === true)}
                              />
                              <label htmlFor="has-complications" className="text-sm cursor-pointer">
                                Ada komplikasi
                              </label>
                            </div>
                          </div>
                        </div>

                        {hasComplications && (
                          <div className="space-y-1.5 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg p-3">
                            <Label className="text-xs font-medium text-red-700 dark:text-red-400">Detail Komplikasi</Label>
                            <Textarea
                              value={complications}
                              onChange={(e) => setComplications(e.target.value)}
                              placeholder="Deskripsikan komplikasi yang terjadi..."
                              rows={2}
                              className="border-red-200 dark:border-red-800"
                            />
                          </div>
                        )}

                        {/* Specimen */}
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-2">
                            <Checkbox
                              id="has-specimen"
                              checked={hasSpecimen}
                              onCheckedChange={(checked) => setHasSpecimen(checked === true)}
                            />
                            <label htmlFor="has-specimen" className="text-sm cursor-pointer font-medium">
                              Jaringan / Spesimen Patologi
                            </label>
                          </div>
                        </div>
                        {hasSpecimen && (
                          <div className="space-y-1.5 pl-6">
                            <Textarea
                              value={specimen}
                              onChange={(e) => setSpecimen(e.target.value)}
                              placeholder="Jenis dan deskripsi spesimen yang diambil..."
                              rows={2}
                            />
                          </div>
                        )}

                        <Separator />

                        {/* Instruksi Post-Operasi */}
                        <div className="space-y-1.5">
                          <Label className="text-xs font-medium flex items-center gap-1.5">
                            <ClipboardList className="h-3.5 w-3.5 text-muted-foreground" />
                            Instruksi Post-Operasi
                          </Label>
                          <Textarea
                            value={postOpInstructions}
                            onChange={(e) => setPostOpInstructions(e.target.value)}
                            placeholder="Instruksi perawatan pasca operasi, termasuk diet, mobilisasi, obat, kontrol ulang..."
                            rows={4}
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Section: Additional Parameters (from master data) */}
                  {hasParameters(selectedOrder.items) && (
                    <div className="border rounded-lg overflow-hidden">
                      <button
                        type="button"
                        className="w-full flex items-center justify-between p-3 bg-muted/50 hover:bg-muted/70 transition-colors"
                        onClick={() => toggleSection("parameters")}
                      >
                        <h4 className="font-semibold text-sm flex items-center gap-2">
                          <ClipboardList className="h-4 w-4 text-primary" />
                          Parameter Tambahan Tindakan
                        </h4>
                        {expandedSections.parameters ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      </button>

                      {expandedSections.parameters && (
                        <div className="p-4 space-y-4">
                          {selectedOrder.items?.map((item) => {
                            const params = item.procedure?.parameters || [];
                            if (params.length === 0) return null;
                            return (
                              <div key={item.id} className="space-y-3">
                                <p className="text-sm font-medium text-muted-foreground">{item.procedure?.name}</p>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                  {params.map((param) => (
                                    <div key={param.id} className="space-y-1">
                                      <Label className="text-xs">
                                        {param.name}
                                        {param.is_required && <span className="text-red-500 ml-0.5">*</span>}
                                        {param.unit && (
                                          <span className="text-muted-foreground ml-1">({param.unit})</span>
                                        )}
                                      </Label>
                                      {renderParameterInput(item, param)}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="flex gap-2 justify-end pt-2">
                    <Button variant="outline" onClick={handleSaveResults} disabled={submitting}>
                      {submitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                      Simpan Draft
                    </Button>
                    <Button onClick={handleCompleteOrder} disabled={submitting}>
                      {submitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
                      Selesaikan Operasi
                    </Button>
                  </div>
                </div>
              )}

              {/* ===== COMPLETED VIEW ===== */}
              {selectedOrder.status === "completed" && (
                <div className="space-y-4">
                  <div className="bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg p-4">
                    <p className="font-medium text-green-700 dark:text-green-300 flex items-center gap-2 mb-1">
                      <CheckCircle2 className="h-4 w-4" />
                      Operasi Telah Selesai
                    </p>
                    {selectedOrder.completed_at && (
                      <p className="text-xs text-green-600 dark:text-green-400">
                        Selesai: {new Date(selectedOrder.completed_at).toLocaleString("id-ID")}
                      </p>
                    )}
                    {selectedOrder.performed_by && (
                      <p className="text-xs text-green-600 dark:text-green-400">
                        Dikerjakan oleh: {selectedOrder.performed_by.nama_lengkap}
                      </p>
                    )}
                  </div>

                  {/* Structured completed data */}
                  {(() => {
                    const data = parseCompletedData(selectedOrder);
                    if (data) {
                      return (
                        <div className="border rounded-lg overflow-hidden">
                          <div className="p-3 bg-muted/50">
                            <h4 className="font-semibold text-sm flex items-center gap-2">
                              <FileText className="h-4 w-4 text-primary" />
                              Laporan Operasi
                            </h4>
                          </div>
                          <div className="p-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                              <InfoField label="Diagnosis Pre-Operasi" value={data.diagnosis_pre_op} />
                              <InfoField label="Diagnosis Post-Operasi" value={data.diagnosis_post_op} />
                              <InfoField label="Jenis Anestesi" value={data.anesthesia_type ? getAnesthesiaLabel(data.anesthesia_type) : ""} />
                              <InfoField label="Klasifikasi Luka" value={data.wound_classification ? getWoundClassLabel(data.wound_classification) : ""} />
                            </div>
                            <Separator className="my-4" />
                            <div className="space-y-3 text-sm">
                              <InfoField label="Uraian Tindakan Operasi" value={data.surgical_procedure} full />
                              <InfoField label="Temuan Intra-Operatif" value={data.surgical_findings} full />
                              {data.blood_loss && (
                                <InfoField label="Estimasi Perdarahan" value={`${data.blood_loss} ml`} />
                              )}
                              {data.complications && (
                                <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg p-3">
                                  <InfoField label="Komplikasi" value={data.complications} full className="text-red-700 dark:text-red-400" />
                                </div>
                              )}
                              {data.specimen && (
                                <InfoField label="Spesimen Patologi" value={data.specimen} full />
                              )}
                            </div>
                            {selectedOrder.suggestion && (
                              <>
                                <Separator className="my-4" />
                                <InfoField label="Instruksi Post-Operasi" value={selectedOrder.suggestion} full />
                              </>
                            )}
                          </div>
                        </div>
                      );
                    }

                    // Fallback: plain text display
                    return (
                      <div className="border rounded-lg p-4 space-y-3">
                        {selectedOrder.result_summary && (
                          <InfoField label="Temuan & Tindakan" value={selectedOrder.result_summary} full />
                        )}
                        {selectedOrder.conclusion && (
                          <InfoField label="Kesan" value={selectedOrder.conclusion} full />
                        )}
                        {selectedOrder.suggestion && (
                          <InfoField label="Instruksi Post-Operasi" value={selectedOrder.suggestion} full />
                        )}
                      </div>
                    );
                  })()}

                  {/* Per-item parameter results */}
                  {selectedOrder.items?.some((item) => item.results && item.results.length > 0) && (
                    <div className="border rounded-lg overflow-hidden">
                      <div className="p-3 bg-muted/50">
                        <h4 className="font-semibold text-sm flex items-center gap-2">
                          <ClipboardList className="h-4 w-4 text-primary" />
                          Parameter Tambahan
                        </h4>
                      </div>
                      <div className="p-4 space-y-3">
                        {selectedOrder.items?.map((item) => {
                          if (!item.results || item.results.length === 0) return null;
                          return (
                            <div key={item.id} className="space-y-2">
                              <p className="text-sm font-medium text-muted-foreground">{item.procedure?.name}</p>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                {item.results.map((result) => (
                                  <div key={result.id} className="flex gap-2 text-sm">
                                    <span className="font-medium text-muted-foreground min-w-[120px]">
                                      {result.procedure_parameter?.name}:
                                    </span>
                                    <span className="whitespace-pre-wrap">{result.value || "-"}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ===== CANCELLED ===== */}
              {selectedOrder.status === "cancelled" && (
                <div className="bg-red-50 dark:bg-red-950 border border-red-200 rounded-lg p-4">
                  <p className="font-medium text-red-700 dark:text-red-300 flex items-center gap-2">
                    <AlertCircle className="h-4 w-4" />
                    Order Dibatalkan
                  </p>
                  {selectedOrder.notes && (
                    <p className="text-sm mt-1">{selectedOrder.notes}</p>
                  )}
                </div>
              )}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}

// ===== Helper Components =====

function InfoField({
  label,
  value,
  full = false,
  className = "",
}: {
  label: string;
  value?: string;
  full?: boolean;
  className?: string;
}) {
  if (!value) return null;
  return (
    <div className={full ? "col-span-full" : ""}>
      <p className={`text-xs font-medium text-muted-foreground mb-0.5 ${className}`}>{label}</p>
      <p className={`text-sm whitespace-pre-wrap ${className}`}>{value}</p>
    </div>
  );
}
