import { useState, useEffect, useMemo, useRef } from "react";
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
import { procedureOrdersApi, proceduresApi, visitProceduresApi, printApi, PROCEDURE_ORDER_STATUS, signatureApi, DOCUMENT_TYPES } from "@/lib/api";
import type { ProcedureOrder, ProcedureOrderItem, ProcedureParameter, Procedure } from "@/lib/api/procedure-orders";
import type { VisitProcedure } from "@/lib/api/visit-procedures";
import { usePINVerification, PINVerificationDialog } from "./edit-mode-controller";
import { SignaturePINDialog } from "@/components/signature/signature-pin-dialog";
import { RevokePINDialog } from "@/components/signature/revoke-pin-dialog";
import { OrderDetailInfoButton } from "./order-detail-info-button";
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
  onCreateDuplicateOrder?: (payload?: {
    ordered_by_id?: number;
    order_date?: string;
  }) => Promise<ProcedureOrder>;
}

export function RadiologyWorkstation({
  visitId,
  readOnly: _readOnly = false,
  rmDuplicateMode = false,
  apiAdapter,
  duplicateDoctorOptions = [],
  onUpdateDuplicateOrderMeta,
  onCreateDuplicateOrder,
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
  const [viewMode, setViewMode] = useState<"list" | "editor">("list");
  const [createOrderOpen, setCreateOrderOpen] = useState(false);
  const [newOrderDoctorId, setNewOrderDoctorId] = useState<string>("");
  const [newOrderDate, setNewOrderDate] = useState("");
  const [addItemOpen, setAddItemOpen] = useState(false);
  const [itemSearch, setItemSearch] = useState("");
  const [availableProcedures, setAvailableProcedures] = useState<Procedure[]>([]);
  const [addingItem, setAddingItem] = useState(false);
  const selectedOrderIDRef = useRef<number | null>(null);

  const canPerform = hasPermission("procedure_orders.perform");
  const canEditDuplicate = rmDuplicateMode && hasPermission("eklaim.edit");
  const canPerformOrDuplicate = canPerform || canEditDuplicate;
  const cloneOrder = (order: ProcedureOrder | null | undefined): ProcedureOrder | null =>
    order ? (JSON.parse(JSON.stringify(order)) as ProcedureOrder) : null;
  const cloneOrders = (items: ProcedureOrder[]): ProcedureOrder[] =>
    items.map((item) => JSON.parse(JSON.stringify(item)) as ProcedureOrder);
  const casemixScope = useMemo(() => {
    if (!rmDuplicateMode) return undefined;
    const rawEklaimID = sessionStorage.getItem("casemix_eklaim_id");
    const parsedEklaimID = rawEklaimID ? Number(rawEklaimID) : NaN;
    if (Number.isFinite(parsedEklaimID) && parsedEklaimID > 0) {
      return {
        is_casemix: "true" as const,
        casemix_eklaim_id: parsedEklaimID,
      };
    }
    return { is_casemix: "true" as const };
  }, [rmDuplicateMode]);

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
      if (!selectedOrder || selectedOrder.status !== "in_progress" || !canPerformOrDuplicate) {
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
  }, [
    submitting,
    selectedOrder,
    canPerformOrDuplicate,
    inlineResults,
    resultSummary,
    conclusion,
    suggestion,
    isCritical,
    criticalNotes,
  ]);

  useEffect(() => {
    loadOrders();
  }, [visitId, apiAdapter]);

  useEffect(() => {
    const handleRefreshOrders = () => {
      const preferredOrderID = selectedOrderIDRef.current || undefined;
      loadOrders(preferredOrderID);
    };

    const handleOpenOrderPicker = () => {
      if (!rmDuplicateMode) return;
      if (orders.length <= 1) return;
      setOrderPickerOpen(true);
    };
    const handleAddOrder = () => {
      if (!canEditDuplicate) return;
      setNewOrderDoctorId("");
      setNewOrderDate(new Date().toISOString().slice(0, 16));
      setCreateOrderOpen(true);
    };

    window.addEventListener("refresh-final-visit", handleRefreshOrders);
    window.addEventListener("refresh-print-options", handleRefreshOrders);
    window.addEventListener(
      "rm-duplicate-open-radiology-order-picker",
      handleOpenOrderPicker,
    );
    window.addEventListener("rm-duplicate-add-radiology-order", handleAddOrder);

    return () => {
      window.removeEventListener("refresh-final-visit", handleRefreshOrders);
      window.removeEventListener("refresh-print-options", handleRefreshOrders);
      window.removeEventListener(
        "rm-duplicate-open-radiology-order-picker",
        handleOpenOrderPicker,
      );
      window.removeEventListener("rm-duplicate-add-radiology-order", handleAddOrder);
    };
  }, [visitId, rmDuplicateMode, orders.length, canEditDuplicate]);

  useEffect(() => {
    if (selectedOrder) {
      selectedOrderIDRef.current = selectedOrder.id;
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
    } else {
      selectedOrderIDRef.current = null;
    }
  }, [selectedOrder]);

  useEffect(() => {
    if (orders.length > 0 && !selectedOrder) {
      const activeOrder = orders.find(
        (order) => order.status === "pending" || order.status === "in_progress",
      );
      setSelectedOrder(cloneOrder(activeOrder || orders[0]));
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

  const loadOrders = async (preferredOrderId?: number) => {
    setLoading(true);
    try {
      const res = await orderApi.getAll(
        rmDuplicateMode
          ? {
              source_visit_id: visitId,
              order_type: "radiology",
              ...(casemixScope || {}),
            }
          : {
              target_visit_id: visitId,
              order_type: "radiology",
            },
      );
      const data = cloneOrders(res.data || []);
      setOrders(data);
      setDirectProcedures([]);

      const directRes = await visitProceduresApi.getAll(visitId).catch(() => ({ data: { data: [] as VisitProcedure[] } }));
      const directData = directRes.data?.data || [];
      setDirectProcedures(directData.filter((item: VisitProcedure) => item.procedure?.procedure_type === "radiology"));

      // Keep currently selected order if still present after refresh.
      const activeOrderId = preferredOrderId ?? selectedOrder?.id;
      const currentSelectedOrder = activeOrderId
        ? data.find((o: ProcedureOrder) => o.id === activeOrderId)
        : null;

      if (currentSelectedOrder) {
        setSelectedOrder(cloneOrder(currentSelectedOrder));
        return;
      }

      const activeOrder = data.find(
        (o: ProcedureOrder) => o.status === "pending" || o.status === "in_progress"
      );
      if (activeOrder) {
        setSelectedOrder(cloneOrder(activeOrder));
      } else if (data.length > 0) {
        setSelectedOrder(cloneOrder(data[0]));
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

  const handleCreateDuplicateOrder = async () => {
    if (!rmDuplicateMode || !onCreateDuplicateOrder) return;
    try {
      setSubmitting(true);
      const payload: { ordered_by_id?: number; order_date?: string } = {};
      if (newOrderDoctorId) {
        const nextDoctorID = Number(newOrderDoctorId);
        if (Number.isFinite(nextDoctorID) && nextDoctorID > 0) {
          payload.ordered_by_id = nextDoctorID;
        }
      }
      if (newOrderDate) payload.order_date = newOrderDate;
      const created = await onCreateDuplicateOrder(payload);
      await loadOrders(created?.id);
      if (created?.id) {
        const latest = await procedureOrdersApi.getById(created.id, casemixScope);
        setSelectedOrder(cloneOrder(latest.data));
      }
      setViewMode("editor");
      setCreateOrderOpen(false);
      toast({
        title: "Berhasil",
        description: "Order radiologi duplikat berhasil dibuat",
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Gagal membuat order",
        description: error?.response?.data?.error || "Order radiologi duplikat gagal dibuat.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenAddItem = async () => {
    if (!selectedOrder) return;
    try {
      setAddingItem(true);
      const roomID = selectedOrder.target_room_id || selectedOrder.source_room_id;
      const merged = new Map<number, Procedure>();

      try {
        const roomRes = await procedureOrdersApi.getProceduresByRoom(
          roomID,
          "radiology",
        );
        const roomProcedures = Array.isArray(roomRes.data) ? roomRes.data : [];
        roomProcedures.forEach((proc) => merged.set(proc.id, proc));
      } catch {
        // Fallback still continues with all radiology procedures
      }

      const allRes = await proceduresApi.getAll({
        procedure_type: "radiology",
        is_active: true,
      });
      const allProcedures = Array.isArray(allRes.data?.data) ? allRes.data.data : [];
      allProcedures.forEach((proc) => {
        if (!merged.has(proc.id)) {
          merged.set(proc.id, {
            id: proc.id,
            code: proc.code,
            name: proc.name,
            description: proc.description,
            procedure_type: proc.procedure_type,
            is_active: proc.is_active,
          } as Procedure);
        }
      });

      setAvailableProcedures(
        Array.from(merged.values()).sort((a, b) =>
          (a.name || "").localeCompare(b.name || "", "id"),
        ),
      );
      setItemSearch("");
      setAddItemOpen(true);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Gagal memuat pemeriksaan",
        description: error?.response?.data?.error || "Daftar pemeriksaan radiologi tidak dapat dimuat.",
      });
    } finally {
      setAddingItem(false);
    }
  };

  const handleAddOrderItem = async (procedureID: number) => {
    if (!selectedOrder || !procedureID) return;
    const activeOrderId = selectedOrder.id;
    try {
      setAddingItem(true);
      await procedureOrdersApi.addItem(selectedOrder.id, { procedure_id: procedureID }, casemixScope);
      await loadOrders(activeOrderId);
      toast({ title: "Berhasil", description: "Pemeriksaan berhasil ditambahkan ke order." });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Gagal menambahkan pemeriksaan",
        description: error?.response?.data?.error || "Pemeriksaan tidak dapat ditambahkan.",
      });
    } finally {
      setAddingItem(false);
      setAddItemOpen(false);
    }
  };

  const handleStartOrder = async () => {
    if (!selectedOrder) return;
    const activeOrderId = selectedOrder.id;
    setSubmitting(true);
    try {
      const res = await orderApi.start(selectedOrder.id, casemixScope);
      setSelectedOrder(cloneOrder(res.data));
      toast({ title: "Berhasil", description: "Pemeriksaan dimulai" });
      loadOrders(activeOrderId);
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
    setSelectedOrder((prev) => {
      if (!prev) return prev;
      const nextItems = (prev.items || []).map((item) => {
        if (Number(item.id) !== Number(itemId)) return item;
        const nextResults = [...(item.results || [])];
        const existingIndex = nextResults.findIndex(
          (result) => Number(result.procedure_parameter_id) === Number(paramId),
        );
        if (existingIndex >= 0) {
          nextResults[existingIndex] = {
            ...nextResults[existingIndex],
            value,
          };
        } else {
          nextResults.push({
            procedure_order_item_id: Number(item.id || itemId),
            procedure_parameter_id: Number(paramId),
            value,
          });
        }
        return {
          ...item,
          results: nextResults,
        };
      });
      return {
        ...prev,
        items: nextItems,
      };
    });
  };

  const doSaveAllResults = async () => {
    if (!selectedOrder) return;
    const activeOrderId = selectedOrder.id;
    setSubmitting(true);
    try {
      const items = (selectedOrder.items || [])
        .map((item) => {
          const rawItemId = Number(item.id);
          if (!Number.isFinite(rawItemId) || rawItemId <= 0) return null;
          const itemId = rawItemId;
          const inlineMap = inlineResults[itemId] || {};
          const params = item.procedure?.parameters || [];
          const existingResults = Array.isArray(item.results) ? item.results : [];

          const mergedResults = params
            .map((param) => {
              const paramID = Number(param.id);
              if (!Number.isFinite(paramID) || paramID <= 0) return null;

              const hasInlineValue = Object.prototype.hasOwnProperty.call(inlineMap, paramID);
              const inlineValue = hasInlineValue ? String(inlineMap[paramID] ?? "") : undefined;
              const existingValue =
                existingResults.find((r) => Number(r.procedure_parameter_id) === paramID)?.value ?? "";
              const finalValue = hasInlineValue ? inlineValue ?? "" : String(existingValue ?? "");

              return {
                parameter_id: paramID,
                value: finalValue,
              };
            })
            .filter((result): result is { parameter_id: number; value: string } => !!result)
            .filter((result) => String(result.value ?? "").trim() !== "");

          return {
            item_id: itemId,
            notes: "",
            results: mergedResults,
          };
        })
        .filter((item): item is { item_id: number; notes: string; results: { parameter_id: number; value: string }[] } => !!item)
        .filter((item) => item.results.length > 0);

      const res = await orderApi.saveResults(selectedOrder.id, {
        result_summary: resultSummary,
        conclusion: conclusion,
        suggestion: suggestion,
        is_critical: isCritical,
        critical_notes: criticalNotes,
        items,
      }, casemixScope);

      setSelectedOrder(cloneOrder(res.data));
      const latest = await procedureOrdersApi.getById(activeOrderId, casemixScope);
      setSelectedOrder(cloneOrder(latest.data));
      toast({ title: "Berhasil", description: "Hasil pemeriksaan berhasil disimpan" });
      await loadOrders(activeOrderId);
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
    if (rmDuplicateMode) {
      void doSaveAllResults();
      return;
    }
    requestPINVerification(doSaveAllResults);
  };

  const renderInlineInput = (item: ProcedureOrderItem, param: ProcedureParameter) => {
    const value = inlineResults[item.id!]?.[param.id] || "";
    const isEditable = selectedOrder?.status === "in_progress" && canPerformOrDuplicate;

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

  if (!rmDuplicateMode && orders.length === 0 && directProcedures.length === 0) {
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

  if (!rmDuplicateMode && orders.length === 0 && directProcedures.length > 0) {
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
      {rmDuplicateMode && viewMode === "list" && (
        <div className="border border-border/70 bg-background">
          <div className="border-b border-border/70 bg-muted/30 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Daftar Order Radiologi Duplikat
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-muted/20">
                <tr className="border-b border-border/70">
                  <th className="px-3 py-2 text-left font-medium">No. Order</th>
                  <th className="px-3 py-2 text-left font-medium">Tanggal</th>
                  <th className="px-3 py-2 text-left font-medium">Dokter</th>
                  <th className="px-3 py-2 text-left font-medium">Jumlah Item</th>
                  <th className="px-3 py-2 text-left font-medium">Status</th>
                  <th className="px-3 py-2 text-right font-medium">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {orders.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">
                      Belum ada order radiologi duplikat.
                    </td>
                  </tr>
                )}
                {orders.map((order) => (
                  <tr key={order.id} className="border-b border-border/50">
                    <td className="px-3 py-2 font-medium">{order.order_number}</td>
                    <td className="px-3 py-2">
                      {order.created_at ? new Date(order.created_at).toLocaleString("id-ID") : "-"}
                    </td>
                    <td className="px-3 py-2">{order.ordered_by?.nama_lengkap || "-"}</td>
                    <td className="px-3 py-2">{order.items?.length || 0}</td>
                    <td className="px-3 py-2">{getStatusBadge(order.status)}</td>
                    <td className="px-3 py-2 text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 rounded-none"
                        onClick={() => {
                          setSelectedOrder(cloneOrder(order));
                          setViewMode("editor");
                        }}
                      >
                        Isi Order
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Selected Order */}
      {selectedOrder && (!rmDuplicateMode || viewMode === "editor") && (
        <div className="space-y-4">
          {rmDuplicateMode && (
            <div className="flex items-center justify-between">
              <Button
                variant="outline"
                size="sm"
                className="h-8 rounded-none"
                onClick={() => setViewMode("list")}
              >
                Kembali ke List Order
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8 rounded-none"
                disabled={!canEditDuplicate || addingItem}
                onClick={handleOpenAddItem}
              >
                Tambah Pemeriksaan
              </Button>
            </div>
          )}
          <div className="border border-border/70 bg-background">
            <div className="flex flex-col gap-3 border-b border-border/70 bg-muted/30 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground sm:flex-row sm:items-start sm:justify-between">
              <span>Hasil Radiologi</span>
              <div className="flex w-full flex-col gap-2 sm:w-auto sm:min-w-[240px] sm:items-end">
                {canPerformOrDuplicate && selectedOrder.status === "pending" && (
                  <Button onClick={handleStartOrder} disabled={submitting} size="sm" className="h-6 px-2 py-0 text-[10px]">
                    {submitting ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Play className="mr-1 h-3 w-3" />}
                    Mulai Pemeriksaan
                  </Button>
                )}
                <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                  {getStatusBadge(selectedOrder.status)}
                  <OrderDetailInfoButton
                    title="Detail Order Radiologi"
                    tooltip="Lihat detail order radiologi"
                    className="h-6 w-6 rounded-md"
                  >
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
                  </OrderDetailInfoButton>
                </div>
              </div>
            </div>
            <div className="p-3 sm:p-4 space-y-4">
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
                      setSelectedOrder(cloneOrder(order));
                      setViewMode("editor");
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

      {rmDuplicateMode && (
        <Dialog open={createOrderOpen} onOpenChange={setCreateOrderOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Buat Order Radiologi</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground">Dokter Pengirim</div>
                <Select value={newOrderDoctorId} onValueChange={setNewOrderDoctorId}>
                  <SelectTrigger className="h-9 rounded-none">
                    <SelectValue placeholder="Pilih dokter (opsional)" />
                  </SelectTrigger>
                  <SelectContent>
                    {duplicateDoctorOptions.map((doc) => (
                      <SelectItem key={doc.id} value={String(doc.id)}>
                        {doc.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground">Tanggal Order</div>
                <Input
                  type="datetime-local"
                  value={newOrderDate}
                  onChange={(e) => setNewOrderDate(e.target.value)}
                  className="rounded-none"
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setCreateOrderOpen(false)}>
                  Batal
                </Button>
                <Button
                  type="button"
                  disabled={submitting || !onCreateDuplicateOrder}
                  onClick={handleCreateDuplicateOrder}
                >
                  {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Buat Order
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {rmDuplicateMode && selectedOrder && (
        <Dialog open={addItemOpen} onOpenChange={setAddItemOpen}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Tambah Pemeriksaan Radiologi</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <Input
                value={itemSearch}
                onChange={(e) => setItemSearch(e.target.value)}
                placeholder="Cari pemeriksaan..."
              />
              <div className="max-h-72 overflow-y-auto rounded-none border">
                {availableProcedures.length === 0 && (
                  <div className="px-3 py-6 text-center text-sm text-muted-foreground">
                    Belum ada tindakan radiologi aktif.
                  </div>
                )}
                {availableProcedures
                  .filter((proc) => {
                    const q = itemSearch.toLowerCase();
                    if (!q) return true;
                    return (
                      proc.name.toLowerCase().includes(q) ||
                      (proc.code || "").toLowerCase().includes(q)
                    );
                  })
                  .map((proc) => (
                    <button
                      key={proc.id}
                      type="button"
                      className="flex w-full items-center justify-between border-b px-3 py-2 text-left text-sm last:border-b-0 hover:bg-accent"
                      onClick={() => handleAddOrderItem(proc.id)}
                      disabled={addingItem}
                    >
                      <div>
                        <div className="font-medium">{proc.name}</div>
                        <div className="text-xs text-muted-foreground">{proc.code || "-"}</div>
                      </div>
                    </button>
                  ))}
              </div>
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
