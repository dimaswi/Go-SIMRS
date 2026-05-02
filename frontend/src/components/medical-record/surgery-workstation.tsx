import { useEffect, useState } from "react";
import { usePermission } from "@/hooks/usePermission";
import {
  usePINVerification,
  PINVerificationDialog,
} from "@/components/medical-record/edit-mode-controller";
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
import { useToast } from "@/hooks/use-toast";
import {
  Loader2,
  Scissors,
  Play,
  CheckCircle2,
  Clock,
  User,
  ShieldCheck,
} from "lucide-react";
import {
  procedureOrdersApi,
  PROCEDURE_ORDER_STATUS,
  signatureApi,
  DOCUMENT_TYPES,
} from "@/lib/api";
import type {
  ProcedureOrder,
  ProcedureOrderItem,
  ProcedureParameter,
} from "@/lib/api/procedure-orders";
import { SignaturePINDialog } from "@/components/signature/signature-pin-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

const FOOTER_ACTION_EVENT = "medical-record-footer-action";

interface SurgeryWorkstationProps {
  visitId: number;
  readOnly?: boolean;
  rmDuplicateMode?: boolean;
  apiAdapter?: Pick<typeof procedureOrdersApi, "getAll" | "start" | "saveResults">;
  duplicateDoctorOptions?: { id: number; name: string }[];
  onUpdateDuplicateOrderMeta?: (
    runtimeOrderId: number,
    updates: { fake_date?: string; doctor_name?: string },
  ) => void;
}

export function SurgeryWorkstation({
  visitId,
  readOnly: _readOnly = false,
  rmDuplicateMode = false,
  apiAdapter,
  duplicateDoctorOptions = [],
  onUpdateDuplicateOrderMeta,
}: SurgeryWorkstationProps) {
  const { toast } = useToast();
  const { hasPermission } = usePermission();
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
  const [inlineResults, setInlineResults] = useState<
    Record<number, Record<number, string>>
  >({});
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
      if (customEvent.detail?.tabId !== "surgery-workstation") return;
      customEvent.detail.handled = true;

      if (submitting) return;
      if (!selectedOrder || selectedOrder.status !== "in_progress" || !canPerform || rmDuplicateMode) {
        toast({
          title: "Info",
          description: "Tidak ada data hasil yang dapat disimpan pada order aktif.",
        });
        return;
      }

      void requestPINVerification(handleSaveAllResults);
    };

    window.addEventListener(FOOTER_ACTION_EVENT, handleFooterAction as EventListener);
    return () => {
      window.removeEventListener(FOOTER_ACTION_EVENT, handleFooterAction as EventListener);
    };
  }, [submitting, selectedOrder, canPerform, rmDuplicateMode, requestPINVerification]);

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
      "rm-duplicate-open-surgery-order-picker",
      handleOpenOrderPicker,
    );

    return () => {
      window.removeEventListener("refresh-final-visit", handleRefreshOrders);
      window.removeEventListener("refresh-print-options", handleRefreshOrders);
      window.removeEventListener(
        "rm-duplicate-open-surgery-order-picker",
        handleOpenOrderPicker,
      );
    };
  }, [visitId, rmDuplicateMode, orders.length]);

  const initializeInlineResults = (order: ProcedureOrder) => {
    const results: Record<number, Record<number, string>> = {};
    order.items?.forEach((item) => {
      const itemId = item.id;
      if (!itemId) return;
      results[itemId] = {};
      item.procedure?.parameters?.forEach((param) => {
        if (!param.id) return;
        const existing = item.results?.find(
          (result) => result.procedure_parameter_id === param.id,
        );
        results[itemId][param.id] = existing?.value || "";
      });
    });
    setInlineResults(results);
  };

  const selectOrder = (order: ProcedureOrder) => {
    setSelectedOrder(order);
    initializeInlineResults(order);
    checkSignatureStatus(order.id);
    setPendingDoctorName(order.ordered_by?.nama_lengkap || "");
    setPendingOrderDate((order.created_at || "").replace(" ", "T").slice(0, 16));
    setDoctorSearch("");
  };

  const loadOrders = async () => {
    setLoading(true);
    try {
      const res = await orderApi.getAll({
        target_visit_id: visitId,
        order_type: "surgery",
      });
      const data = res.data || [];
      setOrders(data);

      const currentSelectedOrder = selectedOrder
        ? data.find((order: ProcedureOrder) => order.id === selectedOrder.id)
        : null;

      if (currentSelectedOrder) {
        selectOrder(currentSelectedOrder);
        return;
      }

      const activeOrder = data.find(
        (order: ProcedureOrder) =>
          order.status === "pending" || order.status === "in_progress",
      );
      if (activeOrder) {
        selectOrder(activeOrder);
      } else if (data.length > 0) {
        selectOrder(data[0]);
      } else {
        setSelectedOrder(null);
        setSignatureStatus(null);
      }
    } catch (error) {
      console.error("Error loading surgery orders:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Gagal memuat data order operasi",
      });
    } finally {
      setLoading(false);
    }
  };

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
        DOCUMENT_TYPES.OPERATIVE_REPORT,
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
      description: "Hasil operasi berhasil ditandatangani",
    });
  };

  const updateInlineResult = (itemId: number, paramId: number, value: string) => {
    setInlineResults((prev) => ({
      ...prev,
      [itemId]: {
        ...(prev[itemId] || {}),
        [paramId]: value,
      },
    }));
  };

  const parseSelectOptions = (param: ProcedureParameter): string[] => {
    if (!param.options) return [];
    try {
      const parsed = JSON.parse(param.options);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return param.options
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
    }
  };

  const renderInlineInput = (item: ProcedureOrderItem, param: ProcedureParameter) => {
    const itemId = item.id || 0;
    const value = inlineResults[itemId]?.[param.id] || "";
    const isEditable = selectedOrder?.status === "in_progress" && canPerform;

    if (!isEditable) {
      return <span className="text-sm">{value || "-"}</span>;
    }

    if (param.input_type === "textarea") {
      return (
        <Textarea
          value={value}
          onChange={(e) => updateInlineResult(itemId, param.id, e.target.value)}
          className="min-h-[56px] text-xs"
          placeholder="Isi hasil..."
        />
      );
    }

    if (param.input_type === "number") {
      return (
        <Input
          type="number"
          value={value}
          onChange={(e) => updateInlineResult(itemId, param.id, e.target.value)}
          className="h-7 text-xs"
          placeholder="0"
        />
      );
    }

    if (param.input_type === "select") {
      const options = parseSelectOptions(param);
      return (
        <Select
          value={value}
          onValueChange={(selected) => updateInlineResult(itemId, param.id, selected)}
        >
          <SelectTrigger className="h-7 min-w-[120px] text-xs">
            <SelectValue placeholder="Pilih" />
          </SelectTrigger>
          <SelectContent>
            {options.map((option) => (
              <SelectItem key={option} value={option}>
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    }

    if (param.input_type === "checkbox") {
      return (
        <Select
          value={value || "false"}
          onValueChange={(selected) => updateInlineResult(itemId, param.id, selected)}
        >
          <SelectTrigger className="h-7 min-w-[92px] text-xs">
            <SelectValue placeholder="Pilih" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="true">Ya</SelectItem>
            <SelectItem value="false">Tidak</SelectItem>
          </SelectContent>
        </Select>
      );
    }

    return (
      <Input
        value={value}
        onChange={(e) => updateInlineResult(itemId, param.id, e.target.value)}
        className="h-7 text-xs"
        placeholder="Isi hasil..."
      />
    );
  };

  const handleStartOrder = async () => {
    if (!selectedOrder) return;
    setSubmitting(true);
    try {
      const res = await orderApi.start(selectedOrder.id);
      setSelectedOrder(res.data);
      toast({ title: "Berhasil", description: "Pengerjaan operasi dimulai" });
      loadOrders();
      window.dispatchEvent(new CustomEvent("refresh-print-options"));
      window.dispatchEvent(new CustomEvent("refresh-final-visit"));
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.response?.data?.error || "Gagal memulai operasi",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveAllResults = async () => {
    if (!selectedOrder) return;
    setSubmitting(true);
    try {
      const items = (selectedOrder.items || [])
        .filter((item) => item.id && item.status !== "cancelled")
        .map((item) => ({
          item_id: item.id as number,
          notes: item.notes || "",
          results: (item.procedure?.parameters || [])
            .map((param) => {
              if (!param.id) return null;
              const rawValue = inlineResults[item.id as number]?.[param.id] ?? "";
              const value = String(rawValue).trim();
              if (value === "") return null;

              const payload: {
                parameter_id: number;
                value: string;
                numeric_value?: number;
                notes?: string;
              } = {
                parameter_id: param.id,
                value,
              };

              if (param.input_type === "number") {
                const numeric = Number(value);
                if (!Number.isNaN(numeric)) {
                  payload.numeric_value = numeric;
                }
              }

              return payload;
            })
            .filter((result): result is NonNullable<typeof result> => Boolean(result)),
        }));

      const res = await orderApi.saveResults(selectedOrder.id, {
        result_summary: "",
        conclusion: "",
        suggestion: "",
        items,
      });

      setSelectedOrder(res.data);
      toast({ title: "Berhasil", description: "Hasil operasi berhasil disimpan" });
      loadOrders();
      window.dispatchEvent(new CustomEvent("refresh-print-options"));
      window.dispatchEvent(new CustomEvent("refresh-final-visit"));
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.response?.data?.error || "Gagal menyimpan hasil operasi",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const config =
      PROCEDURE_ORDER_STATUS[status as keyof typeof PROCEDURE_ORDER_STATUS] || {
        label: status,
        variant: "secondary" as const,
      };
    return <Badge variant={config.variant}>{config.label}</Badge>;
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

  const getItemStatusBadge = (status: string) => {
    if (status === "completed") {
      return <Badge className="bg-green-100 text-green-800 text-xs">Selesai</Badge>;
    }
    if (status === "in_progress") {
      return (
        <Badge variant="outline" className="text-xs">
          Dikerjakan
        </Badge>
      );
    }
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

  if (orders.length === 0) {
    return (
      <div className="py-8">
        <div className="text-center text-muted-foreground">
          <Scissors className="h-10 w-10 mx-auto mb-3 opacity-50" />
          <p>Tidak ada order operasi untuk dikerjakan</p>
        </div>
      </div>
    );
  }

  const canShowSignatureArea = Boolean(
    selectedOrder && (selectedOrder.status === "completed" || signatureStatus?.is_signed),
  );

  return (
    <div className="space-y-4">
      {!rmDuplicateMode && orders.length > 1 && (
        <div className="border border-border/70 bg-background">
          <div className="p-3">
            <Select
              value={selectedOrder?.id.toString()}
              onValueChange={(value) => {
                const order = orders.find((item) => item.id === Number(value));
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
          </div>
        </div>
      )}

      {selectedOrder && (
        <div className="border border-border/70 bg-background">
          <div className="flex flex-wrap items-center justify-between border-b border-border/70 bg-muted/30 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            <span>Detail Order Operasi</span>
            <div className="flex items-center gap-2">
              {canPerform && selectedOrder.status === "pending" && (
                <Button onClick={handleStartOrder} disabled={submitting} size="sm" className="h-6 text-[10px] py-0 px-2">
                  {submitting ? (
                    <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                  ) : (
                    <Play className="h-3 w-3 mr-1" />
                  )}
                  Mulai Operasi
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
                    {selectedOrder.source_visit?.registration?.patient?.nama_lengkap ||
                      selectedOrder.registration?.patient?.nama_lengkap ||
                      "-"}
                  </td>
                </tr>
                <tr className="border-b">
                  <td className="py-1.5 text-muted-foreground w-28 align-top">No. RM</td>
                  <td className="py-1.5 font-medium break-words">
                    {selectedOrder.source_visit?.registration?.patient?.no_rm ||
                      selectedOrder.registration?.patient?.no_rm ||
                      "-"}
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
                            setPendingDoctorName(selectedOrder.ordered_by?.nama_lengkap || "");
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
                              (selectedOrder.created_at || "").replace(" ", "T").slice(0, 16),
                            );
                            setDateModalOpen(true);
                          }}
                        >
                          <Clock className="h-3 w-3" />
                        </Button>
                      </span>
                    ) : (
                      <span>
                        {selectedOrder.created_at
                          ? new Date(selectedOrder.created_at).toLocaleString("id-ID")
                          : "-"}
                      </span>
                    )}
                    {selectedOrder.priority !== "normal" && (
                      <Badge variant="destructive" className="text-xs ml-1">
                        {selectedOrder.priority.toUpperCase()}
                      </Badge>
                    )}
                  </td>
                </tr>
                <tr className="border-b">
                  <td className="py-1.5 text-muted-foreground w-28 align-top">No. Order</td>
                  <td className="py-1.5 font-medium break-words">{selectedOrder.order_number || "-"}</td>
                </tr>
                <tr className="border-b">
                  <td className="py-1.5 text-muted-foreground align-top">Jumlah Item</td>
                  <td className="py-1.5 font-medium break-words">
                    {(selectedOrder.items || []).filter((item) => item.status === "completed").length}/
                    {(selectedOrder.items || []).length} selesai
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

            <div className="border border-border/70 overflow-x-auto mt-4">
              <table className="w-full text-xs text-left">
                <thead className="bg-muted/50 border-b border-border/70">
                  <tr>
                    <th className="py-2 px-3 font-medium w-10">No</th>
                    <th className="py-2 px-3 font-medium">Tindakan Operasi</th>
                    <th className="py-2 px-3 font-medium">Parameter</th>
                    <th className="py-2 px-3 font-medium">Hasil</th>
                    <th className="py-2 px-3 font-medium w-20 text-center">Status</th>
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
                              <td
                                rowSpan={rowSpan}
                                className="align-top border-r border-border/70 py-2 px-3 text-xs font-medium"
                              >
                                {itemIdx + 1}
                              </td>
                              <td rowSpan={rowSpan} className="align-top border-r border-border/70 py-2 px-3">
                                <div className="text-sm font-medium">{item.procedure?.name}</div>
                                <div className="text-xs text-muted-foreground font-mono">
                                  {item.procedure?.code}
                                </div>
                              </td>
                            </>
                          )}
                          <td className="text-xs py-2 px-3">{param.name}</td>
                          <td className="py-2 px-3">{renderInlineInput(item, param)}</td>
                          {paramIdx === 0 && (
                            <td rowSpan={rowSpan} className="align-top border-l border-border/70 py-2 px-3 text-center">
                              {getItemStatusBadge(item.status)}
                            </td>
                          )}
                        </tr>
                      ))
                    ) : (
                      <tr key={item.id} className="border-b last:border-0 hover:bg-muted/50 transition-colors">
                        <td className="py-2 px-3 text-xs font-medium border-r border-border/70">{itemIdx + 1}</td>
                        <td className="py-2 px-3 border-r border-border/70">
                          <div className="text-sm font-medium">{item.procedure?.name}</div>
                          <div className="text-xs text-muted-foreground font-mono">
                            {item.procedure?.code}
                          </div>
                        </td>
                        <td colSpan={2} className="py-2 px-3 text-xs text-muted-foreground italic">
                          Tidak ada parameter
                        </td>
                        <td className="text-center py-2 px-3 border-l border-border/70">{getItemStatusBadge(item.status)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {selectedOrder.status === "in_progress" && canPerform && !rmDuplicateMode && (
              <div className="rounded border border-dashed px-3 py-2 text-sm text-muted-foreground">
                Gunakan tombol Simpan di footer untuk menyimpan hasil operasi.
              </div>
            )}

            {canShowSignatureArea && (
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
                          {new Date(signatureStatus.signed_at).toLocaleString("id-ID")}
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
                    Tanda Tangani Hasil Operasi
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

      {selectedOrder && (
        <SignaturePINDialog
          open={showSignatureDialog}
          onOpenChange={setShowSignatureDialog}
          documentType={DOCUMENT_TYPES.OPERATIVE_REPORT}
          documentId={selectedOrder.id}
          visitId={visitId}
          documentTitle={selectedOrder.order_number}
          onSuccess={handleSignatureSuccess}
        />
      )}

      {rmDuplicateMode && selectedOrder && (
        <Dialog open={orderPickerOpen} onOpenChange={setOrderPickerOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Pilih Order Operasi</DialogTitle>
            </DialogHeader>
            <div className="max-h-64 overflow-y-auto space-y-1">
              {orders.map((order) => {
                const isSelected = selectedOrder.id === order.id;
                return (
                  <button
                    key={order.id}
                    type="button"
                    onClick={() => {
                      selectOrder(order);
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
                        <span
                          className={cn(
                            "h-1.5 w-1.5 rounded-full",
                            getStatusDotClass(order.status),
                          )}
                        />
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
                    doc.name.toLowerCase().includes(doctorSearch.toLowerCase()),
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
                <Button type="button" variant="outline" onClick={() => setDoctorModalOpen(false)}>
                  Batal
                </Button>
                <Button type="button" onClick={() => applyDuplicateDoctor(pendingDoctorName)}>
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
                <Button type="button" variant="outline" onClick={() => setDateModalOpen(false)}>
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
    </div>
  );
}