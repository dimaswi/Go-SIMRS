import { useState, useEffect } from "react";
import { usePermission } from "@/hooks/usePermission";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2,
  TestTube,
  Play,
  Clock,
  User,
  ArrowUp,
  ArrowDown,
  Printer,
  ShieldCheck,
  CheckCircle2,
} from "lucide-react";
import {
  procedureOrdersApi,
  visitProceduresApi,
  printApi,
  signatureApi,
  DOCUMENT_TYPES,
  PROCEDURE_ORDER_STATUS,
} from "@/lib/api";
import { SignaturePINDialog } from "@/components/signature/signature-pin-dialog";
import type {
  ProcedureOrder,
  ProcedureOrderItem,
  ProcedureParameter,
} from "@/lib/api/procedure-orders";
import type { VisitProcedure } from "@/lib/api/visit-procedures";
import { formatPatientName } from "@/lib/print-utils";
import {
  usePINVerification,
  PINVerificationDialog,
} from "./edit-mode-controller";
import { cn } from "@/lib/utils";

const FOOTER_ACTION_EVENT = "medical-record-footer-action";

interface LaboratoryWorkstationProps {
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

export function LaboratoryWorkstation({
  visitId,
  readOnly: _readOnly = false,
  rmDuplicateMode = false,
  apiAdapter,
  duplicateDoctorOptions = [],
  onUpdateDuplicateOrderMeta,
}: LaboratoryWorkstationProps) {
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
  const [directProcedures, setDirectProcedures] = useState<VisitProcedure[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<ProcedureOrder | null>(
    null,
  );

  // Inline results state - keyed by item.id -> param.id -> value
  const [inlineResults, setInlineResults] = useState<
    Record<number, Record<number, string>>
  >({});

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
  const [doctorModalOpen, setDoctorModalOpen] = useState(false);
  const [dateModalOpen, setDateModalOpen] = useState(false);
  const [doctorSearch, setDoctorSearch] = useState("");
  const [pendingDoctorName, setPendingDoctorName] = useState("");
  const [pendingOrderDate, setPendingOrderDate] = useState("");
  const [orderPickerOpen, setOrderPickerOpen] = useState(false);

  const canPerform = hasPermission("procedure_orders.perform");
  const orderApi = apiAdapter || procedureOrdersApi;

  useEffect(() => {
    const handleFooterAction = (event: Event) => {
      const customEvent = event as CustomEvent<{
        tabId: string;
        action: "save" | "final";
        handled: boolean;
      }>;
      if (customEvent.detail?.tabId !== "laboratory-workstation") return;
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
      "rm-duplicate-open-lab-order-picker",
      handleOpenOrderPicker,
    );

    return () => {
      window.removeEventListener("refresh-final-visit", handleRefreshOrders);
      window.removeEventListener("refresh-print-options", handleRefreshOrders);
      window.removeEventListener(
        "rm-duplicate-open-lab-order-picker",
        handleOpenOrderPicker,
      );
    };
  }, [visitId, rmDuplicateMode, orders.length]);

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
          const existing = item.results?.find(
            (r) => r.procedure_parameter_id === param.id,
          );
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
      const res = await signatureApi.getDocumentSignature(
        DOCUMENT_TYPES.LAB_RESULT,
        orderId,
      );
      setSignatureStatus(res.data);
    } catch {
      setSignatureStatus(null);
    }
  };

  const handleSignatureSuccess = () => {
    if (selectedOrder) {
      checkSignatureStatus(selectedOrder.id);
    }
    toast({
      variant: "success",
      title: "Berhasil",
      description: "Hasil lab berhasil ditandatangani",
    });
  };

  const loadOrders = async () => {
    setLoading(true);
    try {
      const res = await orderApi.getAll({
        target_visit_id: visitId,
        order_type: "laboratory",
      });
      const data = res.data || [];
      setOrders(data);
      setDirectProcedures([]);

      const directRes = await visitProceduresApi.getAll(visitId).catch(() => ({ data: { data: [] as VisitProcedure[] } }));
      const directData = directRes.data?.data || [];
      setDirectProcedures(directData.filter((item: VisitProcedure) => item.procedure?.procedure_type === "laboratory"));

      // Keep previously selected order when still available to avoid
      // signature/status panel appearing to "disappear" after cross-view refresh.
      const currentSelectedOrder = selectedOrder
        ? data.find((o: ProcedureOrder) => o.id === selectedOrder.id)
        : null;

      if (currentSelectedOrder) {
        setSelectedOrder(currentSelectedOrder);
        return;
      }

      const activeOrder = data.find(
        (o: ProcedureOrder) =>
          o.status === "pending" || o.status === "in_progress",
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
      setDirectProcedures(directData.filter((item: VisitProcedure) => item.procedure?.procedure_type === "laboratory"));
      setOrders([]);
      setSelectedOrder(null);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Gagal memuat data order, menampilkan tindakan langsung jika tersedia",
      });
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
      toast({
        variant: "destructive",
        title: "Error",
        description: error.response?.data?.error || "Gagal memulai pemeriksaan",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const updateInlineResult = (
    itemId: number,
    paramId: number,
    value: string,
  ) => {
    setInlineResults((prev) => ({
      ...prev,
      [itemId]: { ...prev[itemId], [paramId]: value },
    }));
  };

  const doSaveAllResults = async () => {
    if (!selectedOrder) return;
    setSubmitting(true);
    try {
      const items =
        selectedOrder.items?.map((item) => ({
          item_id: item.id!,
          notes: "",
          results: Object.entries(inlineResults[item.id!] || {}).map(
            ([paramId, value]) => ({
              parameter_id: Number(paramId),
              value: value,
            }),
          ),
        })) || [];

      const res = await orderApi.saveResults(selectedOrder.id, {
        result_summary: resultSummary,
        conclusion: conclusion,
        is_critical: isCritical,
        critical_notes: criticalNotes,
        items,
      });

      setSelectedOrder(res.data);
      toast({
        title: "Berhasil",
        description: "Hasil pemeriksaan berhasil disimpan",
      });
      loadOrders();
      // Trigger refresh on print options dropdown and final visit
      window.dispatchEvent(new CustomEvent("refresh-print-options"));
      window.dispatchEvent(new CustomEvent("refresh-final-visit"));
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.response?.data?.error || "Gagal menyimpan hasil",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveAllResults = () => {
    if (!selectedOrder) return;
    requestPINVerification(doSaveAllResults);
  };

  const getValueIndicator = (value: string, param: ProcedureParameter) => {
    if (
      !value ||
      param.normal_min === undefined ||
      param.normal_max === undefined
    )
      return null;
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

  const renderInlineInput = (
    item: ProcedureOrderItem,
    param: ProcedureParameter,
  ) => {
    const value = inlineResults[item.id!]?.[param.id] || "";
    const isEditable = selectedOrder?.status === "in_progress" && canPerform;

    if (!isEditable) {
      const isAbnormal =
        param.normal_min !== undefined &&
        param.normal_max !== undefined &&
        value &&
        (parseFloat(value) < param.normal_min ||
          parseFloat(value) > param.normal_max);
      return (
        <span
          className={`text-sm ${isAbnormal ? "font-bold text-orange-600" : ""}`}
        >
          {value || "-"}
        </span>
      );
    }

    if (param.input_type === "select" && param.options) {
      let options: string[] = [];
      try {
        options = JSON.parse(param.options);
      } catch {
        options = param.options.split(",").map((o) => o.trim());
      }
      return (
        <Select
          value={value}
          onValueChange={(v) => updateInlineResult(item.id!, param.id, v)}
        >
          <SelectTrigger className="min-w-[100px] h-7 text-xs">
            <SelectValue placeholder="Pilih..." />
          </SelectTrigger>
          <SelectContent>
            {options.map((opt) => (
              <SelectItem key={opt} value={opt}>
                {opt}
              </SelectItem>
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

  const getOrderStatusLabel = (status?: string) => {
    const config = status
      ? PROCEDURE_ORDER_STATUS[
          status as keyof typeof PROCEDURE_ORDER_STATUS
        ] || { label: status }
      : { label: "Unknown" };
    return config.label;
  };

  const getItemStatusBadge = (status: string) => {
    if (status === "completed")
      return (
        <Badge className="bg-green-100 text-green-800 text-xs">Selesai</Badge>
      );
    if (status === "in_progress")
      return (
        <Badge variant="outline" className="text-xs">
          Dikerjakan
        </Badge>
      );
    return (
      <Badge variant="secondary" className="text-xs">
        Menunggu
      </Badge>
    );
  };

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
            <TestTube className="h-10 w-10 mx-auto mb-3 opacity-50" />
            <p>Tidak ada order laboratorium untuk dikerjakan</p>
          </div>
        </div>
      </div>
    );
  }

  if (orders.length === 0 && directProcedures.length > 0) {
    return (
      <div className="space-y-4">
        <div className="rounded-lg border bg-muted/50 p-4 text-sm">
          <p className="font-semibold">Tindakan Laboratorium Langsung</p>
          <p className="text-muted-foreground text-xs">
            Pasien terdaftar langsung ke laboratorium, berikut tindakan yang tercatat pada kunjungan ini.
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
                    {procedure.procedure?.name || "Tindakan"}
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
    <div className="space-y-3">
      {/* Selected Order */}
      {selectedOrder && (
        <div className="shadow-sm">
          <div className="pb-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div></div>
              <div className="flex items-center gap-2">
                {canPerform && selectedOrder.status === "pending" && (
                  <Button
                    onClick={handleStartOrder}
                    disabled={submitting}
                    size="sm"
                  >
                    {submitting ? (
                      <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                    ) : (
                      <Play className="h-4 w-4 mr-1" />
                    )}
                    Mulai Pemeriksaan
                  </Button>
                )}
              </div>
            </div>
          </div>
          <div className="space-y-3">
            {/* Patient Info */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2 text-[11px] p-1.5 bg-muted/50 rounded items-center">
              <div className="flex items-center gap-1">
                <User className="h-3 w-3 text-muted-foreground" />
                <span className="font-medium truncate">
                  {formatPatientName(
                    selectedOrder.source_visit?.registration?.patient
                      ?.nama_lengkap ||
                      selectedOrder.registration?.patient?.nama_lengkap,
                    selectedOrder.source_visit?.registration?.patient
                      ?.jenis_kelamin ||
                      selectedOrder.registration?.patient?.jenis_kelamin,
                    undefined,
                    selectedOrder.source_visit?.registration?.patient
                      ?.tanggal_lahir ||
                      selectedOrder.registration?.patient?.tanggal_lahir,
                  ) || "-"}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-muted-foreground shrink-0">RM:</span>
                <span className="font-medium">
                  {selectedOrder.source_visit?.registration?.patient?.no_rm ||
                    selectedOrder.registration?.patient?.no_rm ||
                    "-"}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-muted-foreground shrink-0">Dokter:</span>
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
              </div>
              <div className="flex items-center gap-1">
                <Clock className="h-3 w-3 text-muted-foreground" />
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
                  <span>
                    {new Date(selectedOrder.created_at).toLocaleString("id-ID")}
                  </span>
                )}
                {selectedOrder.priority !== "normal" && (
                  <Badge variant="destructive" className="text-xs ml-1">
                    {selectedOrder.priority.toUpperCase()}
                  </Badge>
                )}
              </div>
            </div>

            {/* Clinical Notes */}
            {selectedOrder.clinical_notes && (
              <div className="p-2 bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 rounded text-xs">
                <span className="font-medium text-yellow-800 dark:text-yellow-200">
                  Catatan Klinis:
                </span>
                <span className="ml-1">{selectedOrder.clinical_notes}</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
              <div className="p-2 rounded border bg-muted/30">
                <span className="text-muted-foreground">No. Order</span>
                <p className="font-medium mt-0.5">{selectedOrder.order_number}</p>
              </div>
              <div className="p-2 rounded border bg-muted/30">
                <span className="text-muted-foreground">Item Selesai</span>
                <p className="font-medium mt-0.5">
                  {selectedOrder.items?.filter((item) => item.status === "completed").length || 0}/
                  {selectedOrder.items?.length || 0}
                </p>
              </div>
              <div className="p-2 rounded border bg-muted/30">
                <span className="text-muted-foreground">Status Order</span>
                <div className="mt-1">
                  <div className="flex items-center gap-1.5 font-medium">
                    <span className={cn("h-1.5 w-1.5 rounded-full", getStatusDotClass(selectedOrder.status))} />
                    <span>{getOrderStatusLabel(selectedOrder.status)}</span>
                  </div>
                </div>
              </div>
            </div>

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
                              <TableCell
                                rowSpan={rowSpan}
                                className="align-top border-r text-xs font-medium"
                              >
                                {item.procedure?.name}
                              </TableCell>
                            )}
                            <TableCell className="text-xs py-1">
                              {param.name}
                            </TableCell>
                            <TableCell className="py-1">
                              {renderInlineInput(item, param)}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground py-1">
                              {param.normal_min !== undefined &&
                              param.normal_max !== undefined
                                ? `${param.normal_min} - ${param.normal_max}`
                                : param.normal_min !== undefined
                                  ? `≥ ${param.normal_min}`
                                  : param.normal_max !== undefined
                                    ? `≤ ${param.normal_max}`
                                    : "-"}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground py-1">
                              {param.unit || "-"}
                            </TableCell>
                            <TableCell className="text-center py-1">
                              {value
                                ? getValueIndicator(value, param)
                                : paramIdx === 0
                                  ? getItemStatusBadge(item.status)
                                  : null}
                            </TableCell>
                            {paramIdx === 0 && (
                              <TableCell
                                rowSpan={rowSpan}
                                className="align-top text-center"
                              >
                                {item.status === "completed" && item.id && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 w-6 p-0"
                                    onClick={() =>
                                      printApi.laboratoryResultItem(item.id!)
                                    }
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
                        <TableCell className="text-xs font-medium">
                          {item.procedure?.name}
                        </TableCell>
                        <TableCell
                          colSpan={4}
                          className="text-xs text-muted-foreground italic"
                        >
                          Tidak ada parameter
                        </TableCell>
                        <TableCell>{getItemStatusBadge(item.status)}</TableCell>
                        <TableCell>
                          {item.status === "completed" && item.id && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0"
                              onClick={() =>
                                printApi.laboratoryResultItem(item.id!)
                              }
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

            {selectedOrder.status === "in_progress" && canPerform && !rmDuplicateMode && (
              <div className="rounded border border-dashed px-3 py-2 text-sm text-muted-foreground">
                Gunakan tombol Simpan di footer untuk menyimpan hasil laboratorium.
              </div>
            )}

            {/* Signature Status is shown whenever the document is already signed.
                Sign action remains available only when order is completed. */}
            {(selectedOrder.status === "completed" || signatureStatus?.is_signed) && (
              <div className="border-t pt-3 mt-3 space-y-2">
                {signatureStatus?.is_signed ? (
                  <div className="flex items-center gap-2 text-sm text-green-600 bg-green-50 dark:bg-green-950 p-3 rounded">
                    <CheckCircle2 className="h-4 w-4" />
                    <div>
                      <span className="font-medium">
                        Ditandatangani oleh {signatureStatus.signer_name}
                      </span>
                      {signatureStatus.signed_at && (
                        <span className="text-xs text-muted-foreground ml-2">
                          {new Date(signatureStatus.signed_at).toLocaleString(
                            "id-ID",
                          )}
                        </span>
                      )}
                    </div>
                  </div>
                ) : selectedOrder.status === "completed" ? (
                  <Button
                    onClick={() => setShowSignatureDialog(true)}
                    variant="outline"
                    className="w-full"
                    size="sm"
                  >
                    <ShieldCheck className="h-4 w-4 mr-1" />
                    Tanda Tangani Hasil Lab
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
              <DialogTitle>Pilih Order Laboratorium</DialogTitle>
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
          documentType={DOCUMENT_TYPES.LAB_RESULT}
          documentId={selectedOrder.id}
          visitId={visitId}
          documentTitle={selectedOrder.order_number}
          patientName={
            selectedOrder.source_visit?.registration?.patient?.nama_lengkap
          }
          onSuccess={handleSignatureSuccess}
        />
      )}
    </div>
  );
}
