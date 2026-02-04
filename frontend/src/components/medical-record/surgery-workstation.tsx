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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2,
  Scissors,
  Play,
  CheckCircle2,
  Save,
  AlertCircle,
  Clock,
  User,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { procedureOrdersApi, PROCEDURE_ORDER_STATUS } from "@/lib/api";
import type { ProcedureOrder, ProcedureOrderItem, ProcedureParameter } from "@/lib/api/procedure-orders";

interface SurgeryWorkstationProps {
  visitId: number;
  readOnly?: boolean;
}

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

const WOUND_CLASSES = [
  { value: "", label: "Pilih klasifikasi..." },
  { value: "clean", label: "Bersih (Clean)" },
  { value: "clean_contaminated", label: "Bersih Terkontaminasi" },
  { value: "contaminated", label: "Terkontaminasi" },
  { value: "dirty", label: "Kotor/Infeksi" },
];

export function SurgeryWorkstation({ visitId, readOnly: _readOnly = false }: SurgeryWorkstationProps) {
  const { toast } = useToast();
  const { hasPermission } = usePermission();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [orders, setOrders] = useState<ProcedureOrder[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<ProcedureOrder | null>(null);

  // Surgery Report Fields
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

  // Inline parameter results
  const [itemResults, setItemResults] = useState<Record<number, Record<number, string>>>({});

  // Section collapse
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    report: true,
    parameters: false,
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
      const orderToSelect = activeOrder || (res.data?.length > 0 ? res.data[0] : null);
      if (orderToSelect) selectOrder(orderToSelect);
    } catch (error) {
      console.error("Error loading orders:", error);
      toast({ variant: "destructive", title: "Error", description: "Gagal memuat data order operasi" });
    } finally {
      setLoading(false);
    }
  };

  const selectOrder = (order: ProcedureOrder) => {
    setSelectedOrder(order);
    parseResultFields(order);
    initializeParameterResults(order);
  };

  const parseResultFields = (order: ProcedureOrder) => {
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
      } catch { /* fallback */ }
    }
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
        const existing = item.results?.find((r) => r.procedure_parameter_id === param.id);
        results[item.id!][param.id] = existing?.value || "";
      });
    });
    setItemResults(results);
  };

  const updateItemResult = (itemId: number, paramId: number, value: string) => {
    setItemResults((prev) => ({
      ...prev,
      [itemId]: { ...prev[itemId], [paramId]: value },
    }));
  };

  const handleStartOrder = async () => {
    if (!selectedOrder) return;
    setSubmitting(true);
    try {
      const res = await procedureOrdersApi.start(selectedOrder.id);
      selectOrder(res.data);
      toast({ title: "Berhasil", description: "Operasi dimulai" });
      loadOrders();
      // Trigger refresh print options dan final visit
      window.dispatchEvent(new CustomEvent("refresh-print-options"));
      window.dispatchEvent(new CustomEvent("refresh-final-visit"));
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error", description: error.response?.data?.error || "Gagal memulai operasi" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveAllResults = async () => {
    if (!selectedOrder) return;
    setSubmitting(true);
    try {
      const items = selectedOrder.items?.map((item) => ({
        item_id: item.id!,
        notes: "",
        results: Object.entries(itemResults[item.id!] || {})
          .filter(([, v]) => v !== "")
          .map(([paramId, value]) => ({
            parameter_id: Number(paramId),
            value,
          })),
      })) || [];

      const res = await procedureOrdersApi.saveResults(selectedOrder.id, {
        result_summary: buildResultSummary(),
        conclusion: diagnosisPostOp,
        suggestion: postOpInstructions,
        items,
      });

      selectOrder(res.data);
      toast({ title: "Berhasil", description: "Laporan operasi berhasil disimpan" });
      loadOrders();
      // Trigger refresh on print options dropdown and final visit
      window.dispatchEvent(new CustomEvent("refresh-print-options"));
      window.dispatchEvent(new CustomEvent("refresh-final-visit"));
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error", description: error.response?.data?.error || "Gagal menyimpan laporan" });
    } finally {
      setSubmitting(false);
    }
  };

  const renderInlineInput = (item: ProcedureOrderItem, param: ProcedureParameter) => {
    const value = itemResults[item.id!]?.[param.id] || "";
    const isEditable = selectedOrder?.status === "in_progress" && canPerform;

    if (!isEditable) {
      return <span className="text-sm">{value || "-"}</span>;
    }

    if (param.input_type === "textarea") {
      return (
        <Textarea
          value={value}
          onChange={(e) => updateItemResult(item.id!, param.id, e.target.value)}
          placeholder={param.description || "..."}
          rows={2}
          className="min-w-[150px] text-sm"
        />
      );
    }
    if (param.input_type === "select" && param.options) {
      let options: string[] = [];
      try { options = JSON.parse(param.options); } catch { options = param.options.split(",").map((o) => o.trim()); }
      return (
        <Select value={value} onValueChange={(v) => updateItemResult(item.id!, param.id, v)}>
          <SelectTrigger className="min-w-[120px] h-7 text-xs">
            <SelectValue placeholder="Pilih..." />
          </SelectTrigger>
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
        placeholder={param.description || "..."}
        className="min-w-[100px] h-7 text-xs"
        step={param.input_type === "number" ? "any" : undefined}
      />
    );
  };

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  const getStatusBadge = (status: string) => {
    const config = PROCEDURE_ORDER_STATUS[status as keyof typeof PROCEDURE_ORDER_STATUS] || { label: status, variant: "secondary" as const };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const getItemStatusBadge = (status: string) => {
    if (status === "completed") return <Badge className="bg-green-100 text-green-800 text-xs">Selesai</Badge>;
    if (status === "in_progress") return <Badge variant="outline" className="text-xs">Dikerjakan</Badge>;
    return <Badge variant="secondary" className="text-xs">Menunggu</Badge>;
  };

  const hasParameters = (items?: ProcedureOrderItem[]) => {
    return items?.some((item) => item.procedure?.parameters && item.procedure.parameters.length > 0);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="text-center text-muted-foreground">
            <Scissors className="h-10 w-10 mx-auto mb-3 opacity-50" />
            <p>Tidak ada order operasi untuk dikerjakan</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const isEditable = selectedOrder?.status === "in_progress" && canPerform;

  return (
    <div className="space-y-3">
      {/* Order Selection */}
      {orders.length > 1 && (
        <Card className="shadow-sm">
          <CardContent className="py-3">
            <Select
              value={selectedOrder?.id.toString()}
              onValueChange={(val) => {
                const order = orders.find((o) => o.id === Number(val));
                if (order) selectOrder(order);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Pilih order" />
              </SelectTrigger>
              <SelectContent>
                {orders.map((order) => (
                  <SelectItem key={order.id} value={order.id.toString()}>
                    {order.order_number} - {getStatusBadge(order.status)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>
      )}

      {/* Selected Order */}
      {selectedOrder && (
        <Card className="shadow-sm">
          <CardHeader className="py-3 px-4">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <Scissors className="h-4 w-4" />
                  {selectedOrder.order_number}
                </CardTitle>
                <CardDescription className="text-xs">
                  Order dari {selectedOrder.source_room?.name}
                </CardDescription>
              </div>
              {getStatusBadge(selectedOrder.status)}
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[calc(100vh-380px)] min-h-[350px]">
              <div className="p-4 space-y-3">
                {/* Patient Info */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs p-2 bg-muted/50 rounded">
                  <div className="flex items-center gap-1">
                    <User className="h-3 w-3 text-muted-foreground" />
                    <span className="font-medium truncate">
                      {selectedOrder.source_visit?.registration?.patient?.nama_lengkap ||
                        selectedOrder.registration?.patient?.nama_lengkap || "-"}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">RM:</span>{" "}
                    {selectedOrder.source_visit?.registration?.patient?.no_rm ||
                      selectedOrder.registration?.patient?.no_rm || "-"}
                  </div>
                  <div>
                    <span className="text-muted-foreground">Dokter:</span>{" "}
                    {selectedOrder.ordered_by?.nama_lengkap || "-"}
                  </div>
                  <div className="flex items-center gap-1">
                    <Clock className="h-3 w-3 text-muted-foreground" />
                    <span>{new Date(selectedOrder.created_at).toLocaleString("id-ID")}</span>
                    {selectedOrder.priority !== "normal" && (
                      <Badge variant="destructive" className="text-xs ml-1">{selectedOrder.priority.toUpperCase()}</Badge>
                    )}
                  </div>
                </div>

                {/* Clinical Notes */}
                {selectedOrder.clinical_notes && (
                  <div className="p-2 bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 rounded text-xs">
                    <span className="font-medium text-yellow-800 dark:text-yellow-200">Catatan Klinis:</span>
                    <span className="ml-1">{selectedOrder.clinical_notes}</span>
                  </div>
                )}

                {/* Start Button */}
                {canPerform && selectedOrder.status === "pending" && (
                  <Button onClick={handleStartOrder} disabled={submitting} size="sm">
                    {submitting ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Play className="h-4 w-4 mr-1" />}
                    Mulai Operasi
                  </Button>
                )}

                {/* Procedures Table */}
                <div className="border rounded overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead className="w-10 text-xs">No</TableHead>
                        <TableHead className="text-xs">Tindakan Operasi</TableHead>
                        <TableHead className="w-20 text-xs">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedOrder.items?.map((item, idx) => (
                        <TableRow key={item.id}>
                          <TableCell className="text-xs font-medium">{idx + 1}</TableCell>
                          <TableCell>
                            <div className="text-sm font-medium">{item.procedure?.name}</div>
                            <div className="text-xs text-muted-foreground font-mono">{item.procedure?.code}</div>
                          </TableCell>
                          <TableCell>{getItemStatusBadge(item.status)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Surgery Report Section */}
                {(selectedOrder.status === "in_progress" || selectedOrder.status === "completed") && (
                  <Collapsible open={expandedSections.report} onOpenChange={() => toggleSection("report")}>
                    <div className="border rounded">
                      <CollapsibleTrigger asChild>
                        <div className="flex items-center justify-between p-3 bg-muted/50 cursor-pointer hover:bg-muted/70">
                          <h4 className="font-semibold text-sm flex items-center gap-2">
                            <CheckCircle2 className="h-4 w-4 text-primary" />
                            Laporan Operasi
                          </h4>
                          {expandedSections.report ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        </div>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <div className="p-3 space-y-3">
                          {isEditable ? (
                            <>
                              <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1">
                                  <Label className="text-xs">Diagnosis Pre-Op</Label>
                                  <Textarea value={diagnosisPreOp} onChange={(e) => setDiagnosisPreOp(e.target.value)} rows={2} className="text-sm" />
                                </div>
                                <div className="space-y-1">
                                  <Label className="text-xs">Diagnosis Post-Op</Label>
                                  <Textarea value={diagnosisPostOp} onChange={(e) => setDiagnosisPostOp(e.target.value)} rows={2} className="text-sm" />
                                </div>
                              </div>

                              <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1">
                                  <Label className="text-xs">Jenis Anestesi</Label>
                                  <Select value={anesthesiaType} onValueChange={setAnesthesiaType}>
                                    <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Pilih..." /></SelectTrigger>
                                    <SelectContent>
                                      {ANESTHESIA_TYPES.filter((t) => t.value).map((t) => (
                                        <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                                <div className="space-y-1">
                                  <Label className="text-xs">Klasifikasi Luka</Label>
                                  <Select value={woundClassification} onValueChange={setWoundClassification}>
                                    <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Pilih..." /></SelectTrigger>
                                    <SelectContent>
                                      {WOUND_CLASSES.filter((t) => t.value).map((t) => (
                                        <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                              </div>

                              <div className="space-y-1">
                                <Label className="text-xs">Temuan Operasi</Label>
                                <Textarea value={surgicalFindings} onChange={(e) => setSurgicalFindings(e.target.value)} rows={2} className="text-sm" />
                              </div>

                              <div className="space-y-1">
                                <Label className="text-xs">Tindakan yang Dilakukan</Label>
                                <Textarea value={surgicalProcedure} onChange={(e) => setSurgicalProcedure(e.target.value)} rows={2} className="text-sm" />
                              </div>

                              <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1">
                                  <Label className="text-xs">Perkiraan Perdarahan (ml)</Label>
                                  <Input type="number" value={bloodLoss} onChange={(e) => setBloodLoss(e.target.value)} className="h-8 text-sm" />
                                </div>
                                <div className="space-y-2">
                                  <div className="flex items-center gap-2">
                                    <Checkbox id="has-specimen" checked={hasSpecimen} onCheckedChange={(c) => setHasSpecimen(c === true)} />
                                    <label htmlFor="has-specimen" className="text-xs cursor-pointer">Ada Spesimen PA</label>
                                  </div>
                                  {hasSpecimen && (
                                    <Input value={specimen} onChange={(e) => setSpecimen(e.target.value)} placeholder="Jenis spesimen..." className="h-8 text-sm" />
                                  )}
                                </div>
                              </div>

                              <div className="flex items-center gap-2">
                                <Checkbox id="has-complication" checked={hasComplications} onCheckedChange={(c) => setHasComplications(c === true)} />
                                <label htmlFor="has-complication" className="text-xs font-medium text-red-600 cursor-pointer flex items-center gap-1">
                                  <AlertCircle className="h-3 w-3" /> Ada Komplikasi
                                </label>
                              </div>
                              {hasComplications && (
                                <div className="space-y-1 bg-red-50 dark:bg-red-950/30 border border-red-200 rounded p-2">
                                  <Label className="text-xs text-red-700">Komplikasi</Label>
                                  <Textarea value={complications} onChange={(e) => setComplications(e.target.value)} rows={2} className="text-sm border-red-200" />
                                </div>
                              )}

                              <Separator />

                              <div className="space-y-1">
                                <Label className="text-xs">Instruksi Post-Op</Label>
                                <Textarea value={postOpInstructions} onChange={(e) => setPostOpInstructions(e.target.value)} rows={2} className="text-sm" />
                              </div>
                            </>
                          ) : (
                            <div className="space-y-2 text-sm">
                              {diagnosisPreOp && <div><span className="font-medium">Diagnosis Pre-Op:</span> {diagnosisPreOp}</div>}
                              {diagnosisPostOp && <div><span className="font-medium">Diagnosis Post-Op:</span> {diagnosisPostOp}</div>}
                              {anesthesiaType && <div><span className="font-medium">Anestesi:</span> {ANESTHESIA_TYPES.find((t) => t.value === anesthesiaType)?.label}</div>}
                              {surgicalFindings && <div><span className="font-medium">Temuan:</span> {surgicalFindings}</div>}
                              {surgicalProcedure && <div><span className="font-medium">Tindakan:</span> {surgicalProcedure}</div>}
                              {bloodLoss && <div><span className="font-medium">Perdarahan:</span> {bloodLoss} ml</div>}
                              {woundClassification && <div><span className="font-medium">Klasifikasi Luka:</span> {WOUND_CLASSES.find((t) => t.value === woundClassification)?.label}</div>}
                              {specimen && <div><span className="font-medium">Spesimen:</span> {specimen}</div>}
                              {complications && (
                                <div className="p-2 bg-red-100 dark:bg-red-900 rounded">
                                  <span className="text-red-700 dark:text-red-300 font-bold text-xs flex items-center gap-1">
                                    <AlertCircle className="h-4 w-4" /> KOMPLIKASI
                                  </span>
                                  <p className="text-xs mt-1">{complications}</p>
                                </div>
                              )}
                              {postOpInstructions && <div><span className="font-medium">Instruksi Post-Op:</span> {postOpInstructions}</div>}
                            </div>
                          )}
                        </div>
                      </CollapsibleContent>
                    </div>
                  </Collapsible>
                )}

                {/* Extra Parameters Table */}
                {hasParameters(selectedOrder.items) && (selectedOrder.status === "in_progress" || selectedOrder.status === "completed") && (
                  <Collapsible open={expandedSections.parameters} onOpenChange={() => toggleSection("parameters")}>
                    <div className="border rounded">
                      <CollapsibleTrigger asChild>
                        <div className="flex items-center justify-between p-3 bg-muted/50 cursor-pointer hover:bg-muted/70">
                          <h4 className="font-semibold text-sm">Parameter Tambahan</h4>
                          {expandedSections.parameters ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        </div>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <div className="p-3">
                          <Table>
                            <TableHeader>
                              <TableRow className="bg-muted/30">
                                <TableHead className="text-xs">Tindakan</TableHead>
                                <TableHead className="text-xs">Parameter</TableHead>
                                <TableHead className="text-xs">Nilai</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {selectedOrder.items?.map((item) => {
                                const params = item.procedure?.parameters || [];
                                if (params.length === 0) return null;
                                return params.map((param, idx) => (
                                  <TableRow key={`${item.id}-${param.id}`}>
                                    {idx === 0 && (
                                      <TableCell rowSpan={params.length} className="align-top border-r text-xs font-medium">
                                        {item.procedure?.name}
                                      </TableCell>
                                    )}
                                    <TableCell className="text-xs py-1">{param.name}</TableCell>
                                    <TableCell className="py-1">{renderInlineInput(item, param)}</TableCell>
                                  </TableRow>
                                ));
                              })}
                            </TableBody>
                          </Table>
                        </div>
                      </CollapsibleContent>
                    </div>
                  </Collapsible>
                )}

                {/* Save Button */}
                {isEditable && (
                  <Button onClick={handleSaveAllResults} disabled={submitting} className="w-full" size="sm">
                    {submitting && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                    <Save className="h-4 w-4 mr-1" />
                    Simpan Laporan Operasi
                  </Button>
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
