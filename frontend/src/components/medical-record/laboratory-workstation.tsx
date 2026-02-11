import { useState, useEffect } from "react";
import { usePermission } from "@/hooks/usePermission";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
import { useToast } from "@/hooks/use-toast";
import {
  Loader2,
  TestTube,
  Play,
  Save,
  Clock,
  User,
  ArrowUp,
  ArrowDown,
  Printer,
  ShieldCheck,
  CheckCircle2,
} from "lucide-react";
import { procedureOrdersApi, PROCEDURE_ORDER_STATUS, printApi, signatureApi, DOCUMENT_TYPES } from "@/lib/api";
import { SignaturePINDialog } from "@/components/signature/signature-pin-dialog";
import type { ProcedureOrder, ProcedureOrderItem, ProcedureParameter } from "@/lib/api/procedure-orders";
import { usePINVerification, PINVerificationDialog } from "./edit-mode-controller";

interface LaboratoryWorkstationProps {
  visitId: number;
  readOnly?: boolean;
}

export function LaboratoryWorkstation({ visitId, readOnly: _readOnly = false }: LaboratoryWorkstationProps) {
  const { toast } = useToast();
  const { hasPermission } = usePermission();
  
  // PIN verification for saving results
  const {
    showPINDialog,
    setShowPINDialog,
    pin,
    verifyingPIN,
    pinInputRefs,
    handlePINChange,
    handlePINKeyDown,
    handleVerifyPIN,
    requestPINVerification,
  } = usePINVerification({ isRequired: true });
  
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [orders, setOrders] = useState<ProcedureOrder[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<ProcedureOrder | null>(null);
  
  // Inline results state - keyed by item.id -> param.id -> value
  const [inlineResults, setInlineResults] = useState<Record<number, Record<number, string>>>({});

  // Result summary form
  const [resultSummary, setResultSummary] = useState("");
  const [conclusion, setConclusion] = useState("");
  const [isCritical, setIsCritical] = useState(false);
  const [criticalNotes, setCriticalNotes] = useState("");

  // Signature state
  const [showSignatureDialog, setShowSignatureDialog] = useState(false);
  const [signatureStatus, setSignatureStatus] = useState<{
    is_signed: boolean;
    signed_at?: string;
    signer_name?: string;
  } | null>(null);

  const canPerform = hasPermission("procedure_orders.perform");

  useEffect(() => {
    loadOrders();
  }, [visitId]);

  useEffect(() => {
    if (selectedOrder) {
      setResultSummary(selectedOrder.result_summary || "");
      setConclusion(selectedOrder.conclusion || "");
      setIsCritical(selectedOrder.is_critical || false);
      setCriticalNotes(selectedOrder.critical_notes || "");
      
      // Initialize inline results from existing data
      const results: Record<number, Record<number, string>> = {};
      selectedOrder.items?.forEach((item) => {
        results[item.id!] = {};
        item.procedure?.parameters?.forEach((param) => {
          const existing = item.results?.find((r) => r.procedure_parameter_id === param.id);
          results[item.id!][param.id] = existing?.value || "";
        });
      });
      setInlineResults(results);
      
      // Check signature status
      checkSignatureStatus(selectedOrder.id);
    }
  }, [selectedOrder]);

  const checkSignatureStatus = async (orderId: number) => {
    try {
      const res = await signatureApi.getDocumentSignature(DOCUMENT_TYPES.LAB_RESULT, orderId);
      setSignatureStatus(res.data);
    } catch {
      setSignatureStatus(null);
    }
  };

  const handleSignatureSuccess = () => {
    if (selectedOrder) {
      checkSignatureStatus(selectedOrder.id);
    }
    toast({ variant: "success", title: "Berhasil", description: "Hasil lab berhasil ditandatangani" });
  };

  const loadOrders = async () => {
    setLoading(true);
    try {
      const res = await procedureOrdersApi.getAll({
        target_visit_id: visitId,
        order_type: "laboratory",
      });
      setOrders(res.data || []);
      const activeOrder = (res.data || []).find(
        (o: ProcedureOrder) => o.status === "pending" || o.status === "in_progress"
      );
      if (activeOrder) {
        setSelectedOrder(activeOrder);
      } else if (res.data?.length > 0) {
        setSelectedOrder(res.data[0]);
      }
    } catch (error) {
      console.error("Error loading orders:", error);
      toast({ variant: "destructive", title: "Error", description: "Gagal memuat data order" });
    } finally {
      setLoading(false);
    }
  };

  const handleStartOrder = async () => {
    if (!selectedOrder) return;
    setSubmitting(true);
    try {
      const res = await procedureOrdersApi.start(selectedOrder.id);
      setSelectedOrder(res.data);
      toast({ title: "Berhasil", description: "Pemeriksaan dimulai" });
      loadOrders();
      // Trigger refresh print options dan final visit
      window.dispatchEvent(new CustomEvent("refresh-print-options"));
      window.dispatchEvent(new CustomEvent("refresh-final-visit"));
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error", description: error.response?.data?.error || "Gagal memulai pemeriksaan" });
    } finally {
      setSubmitting(false);
    }
  };

  const updateInlineResult = (itemId: number, paramId: number, value: string) => {
    setInlineResults((prev) => ({
      ...prev,
      [itemId]: { ...prev[itemId], [paramId]: value },
    }));
  };

  const doSaveAllResults = async () => {
    if (!selectedOrder) return;
    setSubmitting(true);
    try {
      const items = selectedOrder.items?.map((item) => ({
        item_id: item.id!,
        notes: "",
        results: Object.entries(inlineResults[item.id!] || {}).map(([paramId, value]) => ({
          parameter_id: Number(paramId),
          value: value,
        })),
      })) || [];

      const res = await procedureOrdersApi.saveResults(selectedOrder.id, {
        result_summary: resultSummary,
        conclusion: conclusion,
        is_critical: isCritical,
        critical_notes: criticalNotes,
        items,
      });

      setSelectedOrder(res.data);
      toast({ title: "Berhasil", description: "Hasil pemeriksaan berhasil disimpan" });
      loadOrders();
      // Trigger refresh on print options dropdown and final visit
      window.dispatchEvent(new CustomEvent("refresh-print-options"));
      window.dispatchEvent(new CustomEvent("refresh-final-visit"));
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error", description: error.response?.data?.error || "Gagal menyimpan hasil" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveAllResults = () => {
    if (!selectedOrder) return;
    requestPINVerification(doSaveAllResults);
  };

  const getValueIndicator = (value: string, param: ProcedureParameter) => {
    if (!value || param.normal_min === undefined || param.normal_max === undefined) return null;
    const numValue = parseFloat(value);
    if (isNaN(numValue)) return null;

    if (numValue < param.normal_min) {
      return (
        <span className="text-blue-600 flex items-center gap-1">
          <ArrowDown className="h-3 w-3" /> Rendah
        </span>
      );
    }
    if (numValue > param.normal_max) {
      return (
        <span className="text-orange-600 flex items-center gap-1">
          <ArrowUp className="h-3 w-3" /> Tinggi
        </span>
      );
    }
    return <span className="text-green-600 text-xs">Normal</span>;
  };

  const renderInlineInput = (item: ProcedureOrderItem, param: ProcedureParameter) => {
    const value = inlineResults[item.id!]?.[param.id] || "";
    const isEditable = selectedOrder?.status === "in_progress" && canPerform;

    if (!isEditable) {
      const isAbnormal = param.normal_min !== undefined && param.normal_max !== undefined &&
        value && (parseFloat(value) < param.normal_min || parseFloat(value) > param.normal_max);
      return (
        <span className={`text-sm ${isAbnormal ? "font-bold text-orange-600" : ""}`}>
          {value || "-"}
        </span>
      );
    }

    if (param.input_type === "select" && param.options) {
      let options: string[] = [];
      try { options = JSON.parse(param.options); } catch { options = param.options.split(",").map((o) => o.trim()); }
      return (
        <Select value={value} onValueChange={(v) => updateInlineResult(item.id!, param.id, v)}>
          <SelectTrigger className="min-w-[100px] h-7 text-xs">
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
        onChange={(e) => updateInlineResult(item.id!, param.id, e.target.value)}
        placeholder="..."
        className="min-w-[80px] h-7 text-xs"
        step={param.input_type === "number" ? "any" : undefined}
      />
    );
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
            <TestTube className="h-10 w-10 mx-auto mb-3 opacity-50" />
            <p>Tidak ada order laboratorium untuk dikerjakan</p>
          </div>
        </CardContent>
      </Card>
    );
  }

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
                if (order) setSelectedOrder(order);
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
                  <TestTube className="h-4 w-4" />
                  {selectedOrder.order_number}
                </CardTitle>
                <CardDescription className="text-xs">
                  Order dari {selectedOrder.source_room?.name}
                </CardDescription>
              </div>
              {getStatusBadge(selectedOrder.status)}
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
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

                {/* Lab Results Table - Inline Edit */}
                <div className="border rounded overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead className="text-xs">Pemeriksaan</TableHead>
                        <TableHead className="text-xs">Parameter</TableHead>
                        <TableHead className="text-xs">Hasil</TableHead>
                        <TableHead className="text-xs">Nilai Normal</TableHead>
                        <TableHead className="text-xs">Satuan</TableHead>
                        <TableHead className="text-xs">Status</TableHead>
                        <TableHead className="text-xs w-16">Cetak</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedOrder.items?.map((item) => {
                        const parameters = item.procedure?.parameters || [];
                        const rowSpan = Math.max(parameters.length, 1);

                        return parameters.length > 0 ? (
                          parameters.map((param, paramIdx) => {
                            const value = inlineResults[item.id!]?.[param.id] || "";
                            return (
                              <TableRow key={`${item.id}-${param.id}`}>
                                {paramIdx === 0 && (
                                  <TableCell rowSpan={rowSpan} className="align-top border-r text-xs font-medium">
                                    {item.procedure?.name}
                                  </TableCell>
                                )}
                                <TableCell className="text-xs py-1">{param.name}</TableCell>
                                <TableCell className="py-1">{renderInlineInput(item, param)}</TableCell>
                                <TableCell className="text-xs text-muted-foreground py-1">
                                  {param.normal_min !== undefined && param.normal_max !== undefined
                                    ? `${param.normal_min} - ${param.normal_max}`
                                    : param.normal_min !== undefined
                                    ? `≥ ${param.normal_min}`
                                    : param.normal_max !== undefined
                                    ? `≤ ${param.normal_max}`
                                    : "-"}
                                </TableCell>
                                <TableCell className="text-xs text-muted-foreground py-1">{param.unit || "-"}</TableCell>
                                <TableCell className="text-center py-1">
                                  {value ? getValueIndicator(value, param) : (paramIdx === 0 ? getItemStatusBadge(item.status) : null)}
                                </TableCell>
                                {paramIdx === 0 && (
                                  <TableCell rowSpan={rowSpan} className="align-top text-center">
                                    {item.status === "completed" && item.id && (
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-6 w-6 p-0"
                                        onClick={() => printApi.laboratoryResultItem(item.id!)}
                                        title="Cetak hasil"
                                      >
                                        <Printer className="h-3 w-3" />
                                      </Button>
                                    )}
                                  </TableCell>
                                )}
                              </TableRow>
                            );
                          })
                        ) : (
                          <TableRow key={item.id}>
                            <TableCell className="text-xs font-medium">{item.procedure?.name}</TableCell>
                            <TableCell colSpan={4} className="text-xs text-muted-foreground italic">
                              Tidak ada parameter
                            </TableCell>
                            <TableCell>{getItemStatusBadge(item.status)}</TableCell>
                            <TableCell>
                              {item.status === "completed" && item.id && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 w-6 p-0"
                                  onClick={() => printApi.laboratoryResultItem(item.id!)}
                                  title="Cetak hasil"
                                >
                                  <Printer className="h-3 w-3" />
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>

                {/* Start Button */}
                {canPerform && selectedOrder.status === "pending" && (
                  <Button onClick={handleStartOrder} disabled={submitting} size="sm">
                    {submitting ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Play className="h-4 w-4 mr-1" />}
                    Mulai Pemeriksaan
                  </Button>
                )}

                {/* Save Button - Only when in progress */}
                {selectedOrder.status === "in_progress" && canPerform && (
                  <Button onClick={handleSaveAllResults} disabled={submitting} className="w-full" size="sm">
                    {submitting && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                    <Save className="h-4 w-4 mr-1" />
                    Simpan Semua Hasil
                  </Button>
                )}

                {/* Signature Status & Button - Only when completed */}
                {selectedOrder.status === "completed" && (
                  <div className="border-t pt-3 mt-3 space-y-2">
                    {signatureStatus?.is_signed ? (
                      <div className="flex items-center gap-2 text-sm text-green-600 bg-green-50 dark:bg-green-950 p-3 rounded">
                        <CheckCircle2 className="h-4 w-4" />
                        <div>
                          <span className="font-medium">Ditandatangani oleh {signatureStatus.signer_name}</span>
                          {signatureStatus.signed_at && (
                            <span className="text-xs text-muted-foreground ml-2">
                              {new Date(signatureStatus.signed_at).toLocaleString("id-ID")}
                            </span>
                          )}
                        </div>
                      </div>
                    ) : (
                      <Button 
                        onClick={() => setShowSignatureDialog(true)} 
                        variant="outline" 
                        className="w-full" 
                        size="sm"
                      >
                        <ShieldCheck className="h-4 w-4 mr-1" />
                        Tanda Tangani Hasil Lab
                      </Button>
                    )}
                  </div>
                )}
          </CardContent>
        </Card>
      )}

      {/* PIN Verification Dialog */}
      <PINVerificationDialog
        open={showPINDialog}
        onOpenChange={setShowPINDialog}
        pin={pin}
        verifying={verifyingPIN}
        pinInputRefs={pinInputRefs}
        onPINChange={handlePINChange}
        onPINKeyDown={handlePINKeyDown}
        onVerify={handleVerifyPIN}
      />

      {/* Signature Dialog */}
      {selectedOrder && (
        <SignaturePINDialog
          open={showSignatureDialog}
          onOpenChange={setShowSignatureDialog}
          documentType={DOCUMENT_TYPES.LAB_RESULT}
          documentId={selectedOrder.id}
          visitId={visitId}
          documentTitle={selectedOrder.order_number}
          patientName={selectedOrder.source_visit?.registration?.patient?.nama_lengkap}
          onSuccess={handleSignatureSuccess}
        />
      )}
    </div>
  );
}
