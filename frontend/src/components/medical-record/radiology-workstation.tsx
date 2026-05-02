import { useState, useEffect } from "react";
import { usePermission } from "@/hooks/usePermission";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2,
  FileImage,
  Play,
  Clock,
  User,
  Printer,
  ShieldCheck,
  ShieldX,
  CheckCircle2,
} from "lucide-react";
import { procedureOrdersApi, visitProceduresApi, printApi, PROCEDURE_ORDER_STATUS, signatureApi, DOCUMENT_TYPES } from "@/lib/api";
import type { ProcedureOrder, ProcedureOrderItem, ProcedureParameter } from "@/lib/api/procedure-orders";
import type { VisitProcedure } from "@/lib/api/visit-procedures";
import { usePINVerification, PINVerificationDialog } from "./edit-mode-controller";
import { SignaturePINDialog } from "@/components/signature/signature-pin-dialog";
import { RevokePINDialog } from "@/components/signature/revoke-pin-dialog";
import { formatPatientName } from "@/lib/print-utils";
import { cn } from "@/lib/utils";

const FOOTER_ACTION_EVENT = "medical-record-footer-action";

interface RadiologyWorkstationProps {
  visitId: number;
  readOnly?: boolean;
  rmDuplicateMode?: boolean;
  apiAdapter?: Pick<
    typeof procedureOrdersApi,
    "getAll" | "start" | "saveResults"
  >;
  duplicateDoctorOptions?: { id: number; name: string }[];
  onUpdateDuplicateOrderMeta?: (
    runtimeOrderId: number,
    updates: { fake_date?: string; doctor_name?: string },
  ) => void;
}

export function RadiologyWorkstation({
  visitId,
  readOnly: _readOnly = false,
  rmDuplicateMode = false,
  apiAdapter,
  duplicateDoctorOptions = [],
  onUpdateDuplicateOrderMeta,
}: RadiologyWorkstationProps) {
  const { toast } = useToast();
  const { hasPermission } = usePermission();
  const orderApi = apiAdapter || procedureOrdersApi;
  
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
  const [directProcedures, setDirectProcedures] = useState<VisitProcedure[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<ProcedureOrder | null>(null);
  
  // Inline results state - keyed by item.id -> param.id -> value
  const [inlineResults, setInlineResults] = useState<Record<number, Record<number, string>>>({});

  // Result summary form
  const [resultSummary, setResultSummary] = useState("");
  const [conclusion, setConclusion] = useState("");
  const [suggestion, setSuggestion] = useState("");
  const [isCritical, setIsCritical] = useState(false);
  const [criticalNotes, setCriticalNotes] = useState("");

  // Signature state
  const [showSignatureDialog, setShowSignatureDialog] = useState(false);
  const [showRevokeDialog, setShowRevokeDialog] = useState(false);
  const [signatureStatus, setSignatureStatus] = useState<{
    is_signed: boolean;
    signed_at?: string;
    signer_name?: string;
  } | null>(null);
  const [doctorModalOpen, setDoctorModalOpen] = useState(false);
  const [dateModalOpen, setDateModalOpen] = useState(false);
  const [doctorSearch, setDoctorSearch] = useState("");
  const [pendingDoctorName, setPendingDoctorName] = useState("");
  const [pendingOrderDate, setPendingOrderDate] = useState("");
  const [orderPickerOpen, setOrderPickerOpen] = useState(false);

  const canPerform = hasPermission("procedure_orders.perform");

  useEffect(() => {
    const handleFooterAction = (event: Event) => {
      const customEvent = event as CustomEvent<{
        tabId: string;
        action: "save" | "final";
        handled: boolean;
      }>;
      if (customEvent.detail?.tabId !== "radiology-workstation") return;
      customEvent.detail.handled = true;

      if (submitting) return;
      if (!selectedOrder || selectedOrder.status !== "in_progress" || !canPerform || rmDuplicateMode) {
        toast({
          title: "Info",
          description: "Tidak ada data hasil yang dapat disimpan pada order aktif.",
        });
        return;
      }

      handleSaveAllResults();
    };

    window.addEventListener(FOOTER_ACTION_EVENT, handleFooterAction as EventListener);
    return () => {
      window.removeEventListener(FOOTER_ACTION_EVENT, handleFooterAction as EventListener);
    };
  }, [submitting, selectedOrder, canPerform, rmDuplicateMode]);

  useEffect(() => {
    loadOrders();
  }, [visitId, apiAdapter]);

  useEffect(() => {
    const handleRefreshOrders = () => {
      loadOrders();
    };

    const handleOpenOrderPicker = () => {
      if (!rmDuplicateMode) return;
      if (orders.length <= 1) return;
      setOrderPickerOpen(true);
    };

    window.addEventListener("refresh-final-visit", handleRefreshOrders);
    window.addEventListener("refresh-print-options", handleRefreshOrders);
    window.addEventListener(
      "rm-duplicate-open-radiology-order-picker",
      handleOpenOrderPicker,
    );

    return () => {
      window.removeEventListener("refresh-final-visit", handleRefreshOrders);
      window.removeEventListener("refresh-print-options", handleRefreshOrders);
      window.removeEventListener(
        "rm-duplicate-open-radiology-order-picker",
        handleOpenOrderPicker,
      );
    };
  }, [visitId, rmDuplicateMode, orders.length]);

  useEffect(() => {
    if (selectedOrder) {
      setResultSummary(selectedOrder.result_summary || "");
      setConclusion(selectedOrder.conclusion || "");
      setSuggestion(selectedOrder.suggestion || "");
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
      setPendingDoctorName(selectedOrder.ordered_by?.nama_lengkap || "");
      setPendingOrderDate(
        (selectedOrder.created_at || "").replace(" ", "T").slice(0, 16),
      );
      setDoctorSearch("");
    }
  }, [selectedOrder]);

  useEffect(() => {
    if (orders.length > 0 && !selectedOrder) {
      const activeOrder = orders.find(
        (order) => order.status === "pending" || order.status === "in_progress",
      );
      setSelectedOrder(activeOrder || orders[0]);
    }
  }, [orders, selectedOrder]);

  const applyDuplicateDoctor = (doctorName: string) => {
    if (!selectedOrder) return;
    const nextDoctor = doctorName.trim();
    setSelectedOrder((prev) =>
      prev
        ? {
            ...prev,
            ordered_by: nextDoctor
              ? { id: 0, nama_lengkap: nextDoctor }
              : undefined,
          }
        : prev,
    );
    onUpdateDuplicateOrderMeta?.(selectedOrder.id, {
      doctor_name: nextDoctor,
    });
    setDoctorModalOpen(false);
  };

  const applyDuplicateDate = () => {
    if (!selectedOrder) return;
    const nextDate = pendingOrderDate ? `${pendingOrderDate}:00` : "";
    if (!nextDate) {
      setDateModalOpen(false);
      return;
    }
    setSelectedOrder((prev) =>
      prev
        ? {
            ...prev,
            created_at: nextDate,
            updated_at: nextDate,
          }
        : prev,
    );
    onUpdateDuplicateOrderMeta?.(selectedOrder.id, {
      fake_date: nextDate,
    });
    setDateModalOpen(false);
  };

  const checkSignatureStatus = async (orderId: number) => {
    try {
      const res = await signatureApi.getDocumentSignature(DOCUMENT_TYPES.RADIOLOGY_RESULT, orderId);
      setSignatureStatus(res.data);
    } catch {
      setSignatureStatus(null);
    }
  };

  const handleSignatureSuccess = () => {
    if (selectedOrder) {
      checkSignatureStatus(selectedOrder.id);
    }
    toast({ variant: "success", title: "Berhasil", description: "Hasil radiologi berhasil ditandatangani" });
  };

  const handleRevokeSuccess = () => {
    if (selectedOrder) {
      checkSignatureStatus(selectedOrder.id);
    }
    toast({ variant: "success", title: "Berhasil", description: "Tanda tangan radiologi berhasil dibatalkan" });
  };

  const loadOrders = async () => {
    setLoading(true);
    try {
      const res = await orderApi.getAll({
        target_visit_id: visitId,
        order_type: "radiology",
      });
      const data = res.data || [];
      setOrders(data);
      setDirectProcedures([]);

      const directRes = await visitProceduresApi.getAll(visitId).catch(() => ({ data: { data: [] as VisitProcedure[] } }));
      const directData = directRes.data?.data || [];
      setDirectProcedures(directData.filter((item: VisitProcedure) => item.procedure?.procedure_type === "radiology"));

      // Keep currently selected order if still present after refresh.
      const currentSelectedOrder = selectedOrder
        ? data.find((o: ProcedureOrder) => o.id === selectedOrder.id)
        : null;

      if (currentSelectedOrder) {
        setSelectedOrder(currentSelectedOrder);
        return;
      }

      const activeOrder = data.find(
        (o: ProcedureOrder) => o.status === "pending" || o.status === "in_progress"
      );
      if (activeOrder) {
        setSelectedOrder(activeOrder);
      } else if (data.length > 0) {
        setSelectedOrder(data[0]);
      } else {
        setSelectedOrder(null);
        setSignatureStatus(null);
      }
    } catch (error) {
      console.error("Error loading orders:", error);
      const directRes = await visitProceduresApi.getAll(visitId).catch(() => ({ data: { data: [] as VisitProcedure[] } }));
      const directData = directRes.data?.data || [];
      setDirectProcedures(directData.filter((item: VisitProcedure) => item.procedure?.procedure_type === "radiology"));
      setOrders([]);
      setSelectedOrder(null);
      toast({ variant: "destructive", title: "Error", description: "Gagal memuat data order, menampilkan tindakan langsung jika tersedia" });
    } finally {
      setLoading(false);
    }
  };

  const handleStartOrder = async () => {
    if (!selectedOrder) return;
    setSubmitting(true);
    try {
      const res = await orderApi.start(selectedOrder.id);
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

      const res = await orderApi.saveResults(selectedOrder.id, {
        result_summary: resultSummary,
        conclusion: conclusion,
        suggestion: suggestion,
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

  const renderInlineInput = (item: ProcedureOrderItem, param: ProcedureParameter) => {
    const value = inlineResults[item.id!]?.[param.id] || "";
    const isEditable = selectedOrder?.status === "in_progress" && canPerform;

    if (!isEditable) {
      return <span className="text-sm">{value || "-"}</span>;
    }

    if (param.input_type === "textarea") {
      return (
        <Textarea
          value={value}
          onChange={(e) => updateInlineResult(item.id!, param.id, e.target.value)}
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
        <Select value={value} onValueChange={(v) => updateInlineResult(item.id!, param.id, v)}>
          <SelectTrigger className="min-w-[120px] h-8 text-sm">
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
        placeholder={param.description || "..."}
        className="min-w-[120px] h-8 text-sm"
        step={param.input_type === "number" ? "any" : undefined}
      />
    );
  };

  const getStatusDotClass = (status?: string) => {
    switch (status) {
      case "completed":
        return "bg-emerald-500";
      case "in_progress":
        return "bg-blue-500";
      case "pending":
        return "bg-amber-500";
      case "cancelled":
        return "bg-rose-500";
      default:
        return "bg-zinc-400";
    }
  };

  const getStatusBadge = (status?: string) => {
    const config = status
      ? PROCEDURE_ORDER_STATUS[
          status as keyof typeof PROCEDURE_ORDER_STATUS
        ] || { label: status, variant: "secondary" as const }
      : { label: "Unknown", variant: "secondary" as const };
    return (
      <Badge variant={config.variant} className="text-[10px] px-1.5 py-0 h-5">
        {config.label}
      </Badge>
    );
  };

  const getItemStatusBadge = (status: string) => {
    if (status === "completed") return <Badge className="bg-green-100 text-green-800 text-xs">Selesai</Badge>;
    if (status === "in_progress") return <Badge variant="outline" className="text-xs">Dikerjakan</Badge>;
    return <Badge variant="secondary" className="text-xs">Menunggu</Badge>;
  };

  const allItemsCompleted =
    selectedOrder?.items?.length
      ? selectedOrder.items.every((item) => item.status === "completed")
      : false;
  const canShowSignatureArea =
    !!selectedOrder &&
    (selectedOrder.status === "completed" || allItemsCompleted || !!signatureStatus?.is_signed);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (orders.length === 0 && directProcedures.length === 0) {
    return (
      <div>
        <div className="py-8">
          <div className="text-center text-muted-foreground">
            <FileImage className="h-10 w-10 mx-auto mb-3 opacity-50" />
            <p>Tidak ada order radiologi untuk dikerjakan</p>
          </div>
        </div>
      </div>
    );
  }

  if (orders.length === 0 && directProcedures.length > 0) {
    return (
      <div className="space-y-4">
        <div className="rounded-lg border bg-muted/50 p-4 text-sm">
          <p className="font-semibold">Tindakan Radiologi Langsung</p>
          <p className="text-muted-foreground text-xs">
            Pasien terdaftar langsung ke radiologi, berikut tindakan yang tercatat pada kunjungan ini.
          </p>
        </div>
        <div className="rounded-lg border bg-background p-4">
          <div className="mb-3 text-xs font-medium text-muted-foreground">
            Daftar tindakan
          </div>
          <div className="space-y-2">
            {directProcedures.map((procedure) => (
              <div key={procedure.id} className="flex items-center justify-between gap-3 rounded-md border p-3">
                <div>
                  <div className="text-sm font-medium">
                    {procedure.procedure?.name || "Pemeriksaan"}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Status: {procedure.status || "pending"}
                  </div>
                </div>
                <Badge variant="outline" className="text-[10px] px-2 py-1">
                  {procedure.status === "pending"
                    ? "Menunggu"
                    : procedure.status === "in_progress"
                    ? "Dikerjakan"
                    : procedure.status === "completed"
                    ? "Selesai"
                    : procedure.status}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Selected Order */}
      {selectedOrder && (
        <div className="border border-border/70 bg-background">
          <div className="flex flex-wrap items-center justify-between border-b border-border/70 bg-muted/30 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            <span>Detail Order Radiologi</span>
            <div className="flex items-center gap-2">
              {canPerform && selectedOrder.status === "pending" && (
                <Button onClick={handleStartOrder} disabled={submitting} size="sm" className="h-6 text-[10px] py-0 px-2">
                  {submitting ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Play className="h-3 w-3 mr-1" />}
                  Mulai Pemeriksaan
                </Button>
              )}
            </div>
          </div>
          <div className="p-3 sm:p-4 space-y-4">
            <table className="w-full table-fixed text-xs">
              <tbody>
                <tr className="border-b">
                  <td className="py-1.5 text-muted-foreground w-28 align-top">Nama Pasien</td>
                  <td className="py-1.5 font-medium break-words">
                    {formatPatientName(
                      selectedOrder.source_visit?.registration?.patient?.nama_lengkap ||
                        selectedOrder.registration?.patient?.nama_lengkap,
                      selectedOrder.source_visit?.registration?.patient?.jenis_kelamin ||
                        selectedOrder.registration?.patient?.jenis_kelamin,
                      undefined,
                      selectedOrder.source_visit?.registration?.patient?.tanggal_lahir ||
                        selectedOrder.registration?.patient?.tanggal_lahir,
                    ) || "-"}
                  </td>
                </tr>
                <tr className="border-b">
                  <td className="py-1.5 text-muted-foreground w-28 align-top">No. RM</td>
                  <td className="py-1.5 font-medium break-words">
                    {selectedOrder.source_visit?.registration?.patient?.no_rm ||
                      selectedOrder.registration?.patient?.no_rm || "-"}
                  </td>
                </tr>
                <tr className="border-b">
                  <td className="py-1.5 text-muted-foreground w-28 align-top">Dokter</td>
                  <td className="py-1.5 font-medium break-words">
                    {rmDuplicateMode ? (
                      <span className="inline-flex items-center gap-1">
                        <span className="font-medium">
                          {selectedOrder.ordered_by?.nama_lengkap || "-"}
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-5 w-5"
                          title="Pilih dokter"
                          onClick={() => {
                            setPendingDoctorName(
                              selectedOrder.ordered_by?.nama_lengkap || "",
                            );
                            setDoctorSearch("");
                            setDoctorModalOpen(true);
                          }}
                        >
                          <User className="h-3 w-3" />
                        </Button>
                      </span>
                    ) : (
                      selectedOrder.ordered_by?.nama_lengkap || "-"
                    )}
                  </td>
                </tr>
                <tr className="border-b">
                  <td className="py-1.5 text-muted-foreground w-28 align-top">Tanggal Order</td>
                  <td className="py-1.5 font-medium break-words">
                    {rmDuplicateMode ? (
                      <span className="inline-flex items-center gap-1">
                        <span className="font-medium">
                          {selectedOrder.created_at
                            ? new Date(selectedOrder.created_at).toLocaleString("id-ID")
                            : "-"}
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-5 w-5"
                          title="Set tanggal order"
                          onClick={() => {
                            setPendingOrderDate(
                              (selectedOrder.created_at || "")
                                .replace(" ", "T")
                                .slice(0, 16),
                            );
                            setDateModalOpen(true);
                          }}
                        >
                          <Clock className="h-3 w-3" />
                        </Button>
                      </span>
                    ) : (
                      <span>{new Date(selectedOrder.created_at).toLocaleString("id-ID")}</span>
                    )}
                    {selectedOrder.priority !== "normal" && (
                      <Badge variant="destructive" className="text-xs ml-1">{selectedOrder.priority.toUpperCase()}</Badge>
                    )}
                  </td>
                </tr>
                <tr className="border-b">
                  <td className="py-1.5 text-muted-foreground w-28 align-top">No. Order</td>
                  <td className="py-1.5 font-medium break-words">{selectedOrder.order_number}</td>
                </tr>
                <tr className="border-b">
                  <td className="py-1.5 text-muted-foreground align-top">Jumlah Item</td>
                  <td className="py-1.5 font-medium break-words">
                    {selectedOrder.items?.filter((item) => item.status === "completed").length || 0}/
                    {selectedOrder.items?.length || 0} selesai
                  </td>
                </tr>
                {selectedOrder.diagnosis && (
                  <tr className="border-b">
                    <td className="py-1.5 text-muted-foreground align-top">Diagnosis</td>
                    <td className="py-1.5 font-medium break-words">{selectedOrder.diagnosis}</td>
                  </tr>
                )}
                {selectedOrder.clinical_notes && (
                  <tr>
                    <td className="py-1.5 text-muted-foreground align-top">Catatan Klinis</td>
                    <td className="py-1.5 font-medium break-words">{selectedOrder.clinical_notes}</td>
                  </tr>
                )}
              </tbody>
            </table>

                {/* Results Table - Inline Edit */}
                {/* Results Table - Inline Edit */}
                <div className="border border-border/70 overflow-x-auto mt-4">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-muted/50 border-b border-border/70">
                      <tr>
                        <th className="py-2 px-3 font-medium w-10">No</th>
                        <th className="py-2 px-3 font-medium">Pemeriksaan</th>
                        <th className="py-2 px-3 font-medium">Parameter</th>
                        <th className="py-2 px-3 font-medium">Hasil</th>
                        <th className="py-2 px-3 font-medium w-20 text-center">Status</th>
                        <th className="py-2 px-3 font-medium w-16 text-center">Cetak</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedOrder.items?.map((item, itemIdx) => {
                        const parameters = item.procedure?.parameters || [];
                        const rowSpan = Math.max(parameters.length, 1);

                        return parameters.length > 0 ? (
                          parameters.map((param, paramIdx) => (
                            <tr key={`${item.id}-${param.id}`} className="border-b last:border-0 hover:bg-muted/50 transition-colors">
                              {paramIdx === 0 && (
                                <>
                                  <td rowSpan={rowSpan} className="align-top border-r border-border/70 py-2 px-3 text-xs font-medium">
                                    {itemIdx + 1}
                                  </td>
                                  <td rowSpan={rowSpan} className="align-top border-r border-border/70 py-2 px-3">
                                    <div className="text-sm font-medium">{item.procedure?.name}</div>
                                    <div className="text-xs text-muted-foreground font-mono">{item.procedure?.code}</div>
                                  </td>
                                </>
                              )}
                              <td className="text-xs py-2 px-3">{param.name}</td>
                              <td className="py-2 px-3">{renderInlineInput(item, param)}</td>
                              {paramIdx === 0 && (
                                <>
                                  <td rowSpan={rowSpan} className="align-top border-l border-border/70 py-2 px-3 text-center">
                                    {getItemStatusBadge(item.status)}
                                  </td>
                                  <td rowSpan={rowSpan} className="align-middle text-center py-2 px-3">
                                    {item.status === "completed" && item.id && (
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-6 w-6 p-0 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                        onClick={() => printApi.radiologyResultItem(item.id!)}
                                        title="Cetak hasil"
                                      >
                                        <Printer className="h-3 w-3" />
                                      </Button>
                                    )}
                                  </td>
                                </>
                              )}
                            </tr>
                          ))
                        ) : (
                          <tr key={item.id} className="border-b last:border-0 hover:bg-muted/50 transition-colors">
                            <td className="py-2 px-3 text-xs font-medium border-r border-border/70">{itemIdx + 1}</td>
                            <td className="py-2 px-3 border-r border-border/70">
                              <div className="text-sm font-medium">{item.procedure?.name}</div>
                              <div className="text-xs text-muted-foreground font-mono">{item.procedure?.code}</div>
                            </td>
                            <td colSpan={2} className="py-2 px-3 text-xs text-muted-foreground italic">
                              Tidak ada parameter
                            </td>
                            <td className="text-center py-2 px-3 border-l border-border/70">{getItemStatusBadge(item.status)}</td>
                            <td className="align-middle text-center py-2 px-3">
                              {item.status === "completed" && item.id && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6 p-0 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                  onClick={() => printApi.radiologyResultItem(item.id!)}
                                  title="Cetak hasil"
                                >
                                  <Printer className="h-3 w-3" />
                                </Button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {selectedOrder.status === "in_progress" && canPerform && !rmDuplicateMode && (
                  <div className="rounded border border-dashed px-3 py-2 text-sm text-muted-foreground">
                    Gunakan tombol Simpan di footer untuk menyimpan hasil radiologi.
                  </div>
                )}

                {/* Signature status remains visible once signed even if order status changes. */}
                {canShowSignatureArea && (
                  <div className="border-t pt-3 mt-3 space-y-2">
                    {signatureStatus?.is_signed ? (
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between text-sm text-green-600 bg-green-50 dark:bg-green-950 p-3 rounded">
                        <div className="flex items-center gap-2">
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
                        <Button
                          onClick={() => setShowRevokeDialog(true)}
                          variant="outline"
                          size="sm"
                          className="text-red-600 hover:text-red-700"
                        >
                          <ShieldX className="h-4 w-4 mr-1" />
                          Batal TTD
                        </Button>
                      </div>
                    ) : (selectedOrder.status === "completed" || allItemsCompleted) ? (
                      <Button 
                        onClick={() => setShowSignatureDialog(true)} 
                        variant="outline" 
                        className="w-full" 
                        size="sm"
                      >
                        <ShieldCheck className="h-4 w-4 mr-1" />
                        Tanda Tangani Hasil Radiologi
                      </Button>
                    ) : null}
                    {signatureStatus?.is_signed && selectedOrder.status !== "completed" && (
                      <p className="text-xs text-muted-foreground">
                        Dokumen sudah ditandatangani. Status order saat ini: {selectedOrder.status}.
                      </p>
                    )}
                  </div>
                )}
          </div>
        </div>
      )}

      {rmDuplicateMode && selectedOrder && (
        <Dialog open={orderPickerOpen} onOpenChange={setOrderPickerOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Pilih Order Radiologi</DialogTitle>
            </DialogHeader>
            <div className="max-h-64 overflow-y-auto space-y-1">
              {orders.map((order) => {
                const isSelected = selectedOrder?.id === order.id;
                return (
                  <button
                    key={order.id}
                    type="button"
                    onClick={() => {
                      setSelectedOrder(order);
                      setOrderPickerOpen(false);
                    }}
                    className={cn(
                      "w-full rounded-md border px-3 py-2 text-left text-sm transition-colors",
                      isSelected
                        ? "border-primary bg-primary/10"
                        : "border-border hover:bg-accent",
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-2 font-medium">
                        <span className={cn("h-1.5 w-1.5 rounded-full", getStatusDotClass(order.status))} />
                        {order.order_number}
                      </span>
                      {getStatusBadge(order.status)}
                    </div>
                  </button>
                );
              })}
            </div>
          </DialogContent>
        </Dialog>
      )}

      {rmDuplicateMode && selectedOrder && (
        <Dialog open={doctorModalOpen} onOpenChange={setDoctorModalOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Pilih Dokter Order</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <Input
                value={pendingDoctorName}
                onChange={(e) => setPendingDoctorName(e.target.value)}
                placeholder="Nama dokter"
              />
              <Input
                value={doctorSearch}
                onChange={(e) => setDoctorSearch(e.target.value)}
                placeholder="Cari dari daftar dokter..."
              />
              <div className="max-h-52 overflow-y-auto rounded border divide-y">
                <button
                  type="button"
                  className="w-full px-3 py-2 text-left text-sm hover:bg-muted"
                  onClick={() => setPendingDoctorName("")}
                >
                  -
                </button>
                {duplicateDoctorOptions
                  .filter((doc) =>
                    doc.name
                      .toLowerCase()
                      .includes(doctorSearch.toLowerCase()),
                  )
                  .map((doc) => (
                    <button
                      key={doc.id}
                      type="button"
                      className="w-full px-3 py-2 text-left text-sm hover:bg-muted"
                      onClick={() => setPendingDoctorName(doc.name)}
                    >
                      {doc.name}
                    </button>
                  ))}
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDoctorModalOpen(false)}
                >
                  Batal
                </Button>
                <Button
                  type="button"
                  onClick={() => applyDuplicateDoctor(pendingDoctorName)}
                >
                  Simpan
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {rmDuplicateMode && selectedOrder && (
        <Dialog open={dateModalOpen} onOpenChange={setDateModalOpen}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>Set Tanggal Order</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <Input
                type="datetime-local"
                value={pendingOrderDate}
                onChange={(e) => setPendingOrderDate(e.target.value)}
              />
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDateModalOpen(false)}
                >
                  Batal
                </Button>
                <Button type="button" onClick={applyDuplicateDate}>
                  Simpan
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
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
          documentType={DOCUMENT_TYPES.RADIOLOGY_RESULT}
          documentId={selectedOrder.id}
          visitId={visitId}
          documentTitle={selectedOrder.order_number}
          patientName={selectedOrder.source_visit?.registration?.patient?.nama_lengkap}
          onSuccess={handleSignatureSuccess}
        />
      )}

      {selectedOrder && (
        <RevokePINDialog
          open={showRevokeDialog}
          onOpenChange={setShowRevokeDialog}
          documentType={DOCUMENT_TYPES.RADIOLOGY_RESULT}
          documentId={selectedOrder.id}
          documentTitle={selectedOrder.order_number}
          onSuccess={handleRevokeSuccess}
        />
      )}
    </div>
  );
}
