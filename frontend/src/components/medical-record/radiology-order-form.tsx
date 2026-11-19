import { useState, useEffect } from "react";
import { usePermission } from "@/hooks/usePermission";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { useToast } from "@/hooks/use-toast";
import {
  Loader2,
  Send,
  FileImage,
  Search,
  Plus,
  AlertCircle,
  CheckCircle2,
  Trash2,
  Clock,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { procedureOrdersApi, PROCEDURE_ORDER_STATUS, medicalRecordsApi } from "@/lib/api";
import type { ProcedureOrder, Procedure as ProcedureType } from "@/lib/api/procedure-orders";

interface RadiologyOrderFormProps {
  visitId: number;
  registrationId?: number;
  sourceRoomId?: number;
  readOnly?: boolean;
}

interface OrderItem {
  procedure_id: number;
  procedure_name: string;
  procedure_code: string;
  notes: string;
}

// Collapsible Order History Component
function OrderCollapsible({ order, onCancel, canCancel }: { order: ProcedureOrder; onCancel: (id: number) => void; canCancel: boolean }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div className="px-3.5 py-2.5 hover:bg-muted/30 transition-colors">
        <div className="flex items-center justify-between gap-2">
          <CollapsibleTrigger className="flex items-center gap-2 flex-1 text-left">
            {isOpen ? (
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="font-mono font-bold text-xs">{order.order_number}</span>
                <Badge
                  variant={PROCEDURE_ORDER_STATUS[order.status as keyof typeof PROCEDURE_ORDER_STATUS]?.variant || "secondary"}
                  className="rounded-none text-[10px] h-5 px-1.5"
                >
                  {PROCEDURE_ORDER_STATUS[order.status as keyof typeof PROCEDURE_ORDER_STATUS]?.label || order.status}
                </Badge>
                {(order.priority === "urgent" || order.priority === "cito") && (
                  <Badge variant="destructive" className="rounded-none text-[10px] h-5 px-1.5">
                    {order.priority.toUpperCase()}
                  </Badge>
                )}
                {order.is_critical && (
                  <Badge variant="destructive" className="rounded-none text-[10px] h-5 px-1.5">
                    <AlertCircle className="h-3 w-3 mr-1" />
                    KRITIS
                  </Badge>
                )}
                {order.target_visit?.room_queue?.queue_number && (
                  <Badge variant="outline" className="rounded-none text-[10px] h-5 px-1.5 font-mono">
                    Antrian: {order.target_visit.room_queue.queue_number}
                  </Badge>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {new Date(order.created_at).toLocaleString("id-ID")} • {order.target_room?.name} •{" "}
                {order.items?.filter((i) => i.status !== "cancelled").length || 0} pemeriksaan
              </p>
            </div>
          </CollapsibleTrigger>
          <TooltipProvider delayDuration={120}>
            <div className="flex items-center gap-1.5">
              {order.status === "pending" && canCancel && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-7 w-7 rounded-none text-destructive"
                      onClick={() => onCancel(order.id)}
                      aria-label="Batalkan order"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="top">Batalkan</TooltipContent>
                </Tooltip>
              )}
            </div>
          </TooltipProvider>
        </div>
        <CollapsibleContent>
          <div className="mt-3 pt-3 border-t border-neutral-200 dark:border-neutral-800 space-y-3">
            {/* Order Info Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/30 p-2.5 text-xs">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
                  Unit Radiologi
                </span>
                <span className="font-semibold text-foreground">{order.target_room?.name || "-"}</span>
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
                  Prioritas
                </span>
                <span className="font-semibold text-foreground">
                  {order.priority === "urgent" || order.priority === "cito"
                    ? order.priority.toUpperCase()
                    : "Normal"}
                </span>
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
                  Dokter Pengirim
                </span>
                <span className="font-medium text-foreground">{order.ordered_by?.nama_lengkap || "-"}</span>
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
                  Diagnosis
                </span>
                <span className="font-medium text-foreground">{order.diagnosis || "-"}</span>
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
                  Catatan Klinis
                </span>
                <span className="font-medium text-foreground">{order.clinical_notes || "-"}</span>
              </div>
            </div>

            {/* Order Items Table */}
            {order.items && order.items.length > 0 && (
              <div className="border border-neutral-200 dark:border-neutral-800 overflow-x-auto">
                <table className="w-full min-w-[600px] text-xs">
                  <thead className="bg-neutral-50 dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800">
                    <tr>
                      <th className="h-8 px-3 text-left font-bold uppercase tracking-wider text-muted-foreground">
                        Pemeriksaan
                      </th>
                      <th className="h-8 px-3 text-left font-bold uppercase tracking-wider text-muted-foreground w-[140px]">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
                    {order.items
                      .filter((item) => item.status !== "cancelled")
                      .map((item, idx) => (
                        <tr key={idx}>
                          <td className="py-2 px-3">
                            <p className="font-semibold text-foreground">{item.procedure?.name}</p>
                            {item.notes && <p className="text-[11px] text-muted-foreground">{item.notes}</p>}
                          </td>
                          <td className="py-2 px-3">
                            <Badge
                              variant={item.status === "completed" ? "default" : "secondary"}
                              className="rounded-none text-[10px] h-5 px-1.5"
                            >
                              {item.status === "completed"
                                ? "Selesai"
                                : item.status === "in_progress"
                                  ? "Dikerjakan"
                                  : "Menunggu"}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Results if completed */}
            {order.status === "completed" && (
              <div className="border border-neutral-200 dark:border-neutral-800 bg-neutral-50/40 dark:bg-neutral-900/20 p-3 space-y-3">
                <div className="flex items-center gap-2 border-l-2 border-neutral-900 dark:border-neutral-100 pl-2 text-xs font-bold uppercase tracking-wider text-neutral-900 dark:text-neutral-100">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                  Hasil Pemeriksaan Radiologi
                </div>

                {/* Detail Results per Item */}
                {order.items
                  ?.filter((item) => item.status !== "cancelled")
                  .map((item) => (
                    <div
                      key={item.id}
                      className="border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-2.5 space-y-1.5"
                    >
                      <h5 className="font-semibold text-xs text-foreground">{item.procedure?.name}</h5>
                      {item.results && item.results.length > 0 ? (
                        <div className="space-y-1">
                          {item.results.map((result) => (
                            <div key={result.id} className="grid grid-cols-[140px_1fr] gap-2 text-xs">
                              <span className="font-medium text-muted-foreground">
                                {result.procedure_parameter?.name}:
                              </span>
                              <span className="whitespace-pre-wrap text-foreground">{result.value}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-[11px] text-muted-foreground italic">Tidak ada hasil parameter</p>
                      )}
                    </div>
                  ))}

                {(order.result_summary || order.conclusion || order.suggestion) && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 border-t border-neutral-200 dark:border-neutral-800 pt-2.5 text-xs">
                    {order.result_summary && (
                      <div className="space-y-0.5">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
                          Hasil
                        </span>
                        <p className="whitespace-pre-wrap text-foreground">{order.result_summary}</p>
                      </div>
                    )}
                    {order.conclusion && (
                      <div className="space-y-0.5">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
                          Kesan
                        </span>
                        <p className="whitespace-pre-wrap text-foreground">{order.conclusion}</p>
                      </div>
                    )}
                    {order.suggestion && (
                      <div className="space-y-0.5">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
                          Saran
                        </span>
                        <p className="whitespace-pre-wrap text-foreground">{order.suggestion}</p>
                      </div>
                    )}
                  </div>
                )}

                {order.is_critical && (
                  <div className="p-2.5 border border-red-300 bg-red-50 dark:bg-red-950/30 text-xs">
                    <span className="text-red-700 dark:text-red-300 font-bold flex items-center gap-1.5">
                      <AlertCircle className="h-4 w-4" />
                      NILAI KRITIS
                    </span>
                    {order.critical_notes && <p className="mt-1">{order.critical_notes}</p>}
                  </div>
                )}
              </div>
            )}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

export function RadiologyOrderForm({ visitId, readOnly = false }: RadiologyOrderFormProps) {
  const { toast } = useToast();
  const { hasPermission } = usePermission();
  const [activeTab, setActiveTab] = useState<"form" | "history">("form");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [existingOrders, setExistingOrders] = useState<ProcedureOrder[]>([]);
  const [radiologyRooms, setRadiologyRooms] = useState<{ id: number; name: string; code: string }[]>([]);
  const [selectedRoom, setSelectedRoom] = useState<number | null>(null);
  const [procedures, setProcedures] = useState<ProcedureType[]>([]);
  const [loadingProcedures, setLoadingProcedures] = useState(false);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [diagnosis, setDiagnosis] = useState("");
  const [clinicalNotes, setClinicalNotes] = useState("");
  const [priority, setPriority] = useState("normal");
  const [cancelConfirmOrderId, setCancelConfirmOrderId] = useState<number | null>(null);

  const canOrder = hasPermission("medical_records.radiology_order");

  useEffect(() => {
    loadData();
  }, [visitId]);

  useEffect(() => {
    if (selectedRoom) {
      loadProcedures(selectedRoom);
    } else {
      setProcedures([]);
    }
  }, [selectedRoom]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [ordersRes, roomsRes] = await Promise.all([
        procedureOrdersApi.getBySourceVisit(visitId, "radiology"),
        procedureOrdersApi.getRadiologyRooms(),
      ]);
      const orders = ordersRes.data || [];

      // Recalculate status for orders that might have inconsistent status
      for (const order of orders) {
        if (order.status !== "completed" && order.status !== "cancelled") {
          try {
            await procedureOrdersApi.recalculate(order.id);
          } catch {
            // Ignore recalculate errors
          }
        }
      }

      // Reload orders after recalculation
      const updatedOrdersRes = await procedureOrdersApi.getBySourceVisit(visitId, "radiology");
      setExistingOrders(updatedOrdersRes.data || []);
      setRadiologyRooms(roomsRes.data || []);

      // Auto-select first room
      if (roomsRes.data?.length > 0 && !selectedRoom) {
        setSelectedRoom(roomsRes.data[0].id);
      }

      // Auto-fill diagnosis from diagnosis tab
      try {
        const diagRes = await medicalRecordsApi.getDiagnosis(visitId);
        if (diagRes.data?.items?.length) {
          const diagTexts = diagRes.data.items
            .filter((d: any) => d.icd10_code && d.icd10_name)
            .map((d: any) => `${d.icd10_code} - ${d.icd10_name}`)
            .join("; ");
          if (diagTexts && !diagnosis) {
            setDiagnosis(diagTexts);
          }
        }
      } catch { /* diagnosis data may not exist yet */ }
    } catch (error) {
      console.error("Error loading data:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Gagal memuat data",
      });
    } finally {
      setLoading(false);
    }
  };

  const loadProcedures = async (roomId: number) => {
    setLoadingProcedures(true);
    try {
      const res = await procedureOrdersApi.getProceduresByRoom(roomId, "radiology");
      setProcedures(res.data || []);
    } catch (error) {
      console.error("Error loading procedures:", error);
    } finally {
      setLoadingProcedures(false);
    }
  };

  const handleToggleProcedure = (proc: ProcedureType) => {
    const exists = orderItems.find((item) => item.procedure_id === proc.id);
    if (exists) {
      setOrderItems(orderItems.filter((item) => item.procedure_id !== proc.id));
    } else {
      setOrderItems([
        ...orderItems,
        {
          procedure_id: proc.id,
          procedure_name: proc.name,
          procedure_code: proc.code,
          notes: "",
        },
      ]);
    }
  };

  const handleRemoveItem = (procedureId: number) => {
    setOrderItems(orderItems.filter((item) => item.procedure_id !== procedureId));
  };

  const handleCancelOrder = async (orderId: number) => {
    setCancelConfirmOrderId(orderId);
  };

  const handleConfirmCancelOrder = async () => {
    const orderId = cancelConfirmOrderId;
    if (!orderId) return;
    setCancelConfirmOrderId(null);

    try {
      await procedureOrdersApi.cancel(orderId, "Dibatalkan oleh dokter");
      toast({
        title: "Berhasil",
        description: "Order berhasil dibatalkan",
      });
      loadData();
      // Trigger refresh print options dan final visit
      window.dispatchEvent(new CustomEvent("refresh-print-options"));
      window.dispatchEvent(new CustomEvent("refresh-final-visit"));
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.response?.data?.error || "Gagal membatalkan order",
      });
    }
  };

  const handleSubmitOrder = async () => {
    if (!selectedRoom) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Pilih unit radiologi terlebih dahulu",
      });
      return;
    }

    if (orderItems.length === 0) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Pilih minimal 1 pemeriksaan",
      });
      return;
    }

    setSubmitting(true);
    try {
      await procedureOrdersApi.create({
        order_type: "radiology",
        source_visit_id: visitId,
        target_room_id: selectedRoom,
        priority,
        clinical_notes: clinicalNotes,
        diagnosis,
        items: orderItems.map((item) => ({
          procedure_id: item.procedure_id,
          notes: item.notes,
        })),
      });

      toast({
        title: "Berhasil",
        description: "Order radiologi berhasil dikirim",
      });

      // Reset form
      setOrderItems([]);
      setDiagnosis("");
      setClinicalNotes("");
      setPriority("normal");

      // Reload orders
      loadData();

      // Trigger refresh print options dan final visit
      window.dispatchEvent(new CustomEvent("refresh-print-options"));
      window.dispatchEvent(new CustomEvent("refresh-final-visit"));
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.response?.data?.error || "Gagal membuat order",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const filteredProcedures = procedures.filter((proc) => {
    const keyword = searchTerm.trim().toLowerCase();
    if (!keyword) return true;
    return `${proc.name} ${proc.code} ${proc.description || ""}`.toLowerCase().includes(keyword);
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="-mx-4 sm:-mx-5 -my-4 sm:-my-5">
      <div>
        {/* Full-Bleed Sub-Tabs Bar */}
        <div className="border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/30 px-4 sm:px-5">
          <div className="flex items-center gap-6">
            <button
              type="button"
              onClick={() => setActiveTab("form")}
              className={cn(
                "py-2.5 text-xs font-bold uppercase tracking-wider transition-colors relative flex items-center gap-1.5",
                activeTab === "form"
                  ? "text-neutral-900 dark:text-white"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <FileImage className="h-3.5 w-3.5" />
              Order Baru
              {activeTab === "form" && (
                <div className="absolute bottom-[-1px] left-0 right-0 h-[2px] bg-neutral-900 dark:bg-white" />
              )}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("history")}
              className={cn(
                "py-2.5 text-xs font-bold uppercase tracking-wider transition-colors relative flex items-center gap-1.5",
                activeTab === "history"
                  ? "text-neutral-900 dark:text-white"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Clock className="h-3.5 w-3.5" />
              Riwayat Order
              {existingOrders.length > 0 && (
                <Badge variant="secondary" className="rounded-none ml-0.5 h-5 px-1.5 text-[10px] font-mono">
                  {existingOrders.length}
                </Badge>
              )}
              {activeTab === "history" && (
                <div className="absolute bottom-[-1px] left-0 right-0 h-[2px] bg-neutral-900 dark:bg-white" />
              )}
            </button>
          </div>
        </div>

        <div>
          {/* Order Form Tab */}
          {activeTab === "form" && canOrder && (
            <div>
              <fieldset
                disabled={readOnly}
                className="divide-y divide-neutral-200 dark:divide-neutral-800 border-b border-neutral-200 dark:border-neutral-800 [&_input]:h-9 [&_[role=combobox]]:h-9 [&_input]:rounded-none [&_textarea]:rounded-none [&_[role=combobox]]:rounded-none [&_input]:text-xs [&_[role=combobox]]:text-xs"
              >
                {/* Section 1: Konfigurasi Order Radiologi */}
                <section className="px-4 sm:px-5 py-4 space-y-3">
                  <div className="border-l-2 border-neutral-900 dark:border-neutral-100 pl-2.5 text-xs font-bold uppercase tracking-wider text-neutral-900 dark:text-neutral-100">
                    Konfigurasi Order Radiologi
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3">
                    <div className="lg:col-span-4 space-y-1.5">
                      <Label className="text-xs font-medium">Unit Radiologi Tujuan</Label>
                      <Select
                        value={selectedRoom?.toString() || ""}
                        onValueChange={(value) => setSelectedRoom(Number(value))}
                      >
                        <SelectTrigger className="h-9 text-xs rounded-none">
                          <SelectValue placeholder="Pilih unit radiologi" />
                        </SelectTrigger>
                        <SelectContent>
                          {radiologyRooms.map((room) => (
                            <SelectItem key={room.id} value={room.id.toString()} className="text-xs">
                              {room.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="lg:col-span-2 space-y-1.5">
                      <Label className="text-xs font-medium">Prioritas</Label>
                      <Select value={priority} onValueChange={setPriority}>
                        <SelectTrigger className="h-9 text-xs rounded-none">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="normal" className="text-xs">Normal</SelectItem>
                          <SelectItem value="urgent" className="text-xs">Urgent</SelectItem>
                          <SelectItem value="cito" className="text-xs">CITO</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="sm:col-span-2 lg:col-span-6 space-y-1.5">
                      <Label className="text-xs font-medium">Diagnosis Terkait</Label>
                      <Input
                        placeholder="Tulis diagnosis terkait pemeriksaan radiologi..."
                        value={diagnosis}
                        onChange={(e) => setDiagnosis(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Catatan Klinis / Indikasi Pemeriksaan</Label>
                    <Textarea
                      placeholder="Catatan klinis atau indikasi pemeriksaan untuk petugas radiologi..."
                      value={clinicalNotes}
                      onChange={(e) => setClinicalNotes(e.target.value)}
                      className="min-h-[68px] resize-none text-xs rounded-none"
                    />
                  </div>
                </section>

                {/* Section 2: Daftar Pemeriksaan Radiologi */}
                <section className="px-4 sm:px-5 py-4 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className="border-l-2 border-neutral-900 dark:border-neutral-100 pl-2.5 text-xs font-bold uppercase tracking-wider text-neutral-900 dark:text-neutral-100">
                        Daftar Pemeriksaan Radiologi
                      </div>
                      <Badge
                        variant={orderItems.length > 0 ? "default" : "secondary"}
                        className="rounded-none h-5 px-1.5 text-[10px] font-mono"
                      >
                        {orderItems.length} Pemeriksaan
                      </Badge>
                    </div>

                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 rounded-none px-3 text-xs gap-1.5"
                      onClick={() => setShowAddDialog(true)}
                      disabled={!selectedRoom || readOnly}
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Pilih Pemeriksaan
                    </Button>
                  </div>

                  {orderItems.length > 0 ? (
                    <div className="border border-neutral-200 dark:border-neutral-800 overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead className="bg-neutral-50 dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800">
                          <tr>
                            <th className="h-9 px-3 text-left font-bold uppercase tracking-wider text-muted-foreground w-[140px]">
                              Kode
                            </th>
                            <th className="h-9 px-3 text-left font-bold uppercase tracking-wider text-muted-foreground">
                              Nama Pemeriksaan Radiologi
                            </th>
                            <th className="h-9 px-3 text-center font-bold uppercase tracking-wider text-muted-foreground w-[64px]">
                              Aksi
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
                          {orderItems.map((item) => (
                            <tr key={item.procedure_id}>
                              <td className="py-2 px-3 font-mono text-muted-foreground">
                                {item.procedure_code}
                              </td>
                              <td className="py-2 px-3 font-semibold text-foreground">
                                {item.procedure_name}
                              </td>
                              <td className="py-1.5 px-3 text-center">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 rounded-none text-destructive"
                                  onClick={() => handleRemoveItem(item.procedure_id)}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="border border-dashed border-neutral-200 dark:border-neutral-800 bg-neutral-50/30 dark:bg-neutral-900/10 px-3.5 py-2.5 text-xs text-muted-foreground">
                      Belum ada pemeriksaan radiologi yang dipilih.
                    </div>
                  )}

                  {/* Modal Pilih Pemeriksaan Radiologi */}
                  <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
                    <DialogContent className="w-[calc(100vw-1rem)] sm:max-w-2xl max-h-[82vh] rounded-none p-0 gap-0 border-neutral-200 dark:border-neutral-800 overflow-hidden flex flex-col">
                      <DialogHeader className="px-4 py-3 border-b border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 shrink-0">
                        <div className="flex items-center gap-2.5">
                          <div className="size-8 bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 flex items-center justify-center shrink-0">
                            <FileImage className="h-4 w-4" />
                          </div>
                          <div className="text-left min-w-0">
                            <DialogTitle className="text-sm font-bold uppercase tracking-tight">
                              Pilih Pemeriksaan Radiologi
                            </DialogTitle>
                            <DialogDescription className="text-xs mt-0.5">
                              Centang satu atau beberapa pemeriksaan radiologi yang akan diorder.
                            </DialogDescription>
                          </div>
                        </div>
                      </DialogHeader>

                      <div className="p-3.5 border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50/70 dark:bg-neutral-900/40 shrink-0">
                        <div className="relative">
                          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                          <Input
                            placeholder="Cari nama atau kode pemeriksaan radiologi..."
                            className="h-9 pl-8 text-xs rounded-none bg-white dark:bg-neutral-950"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                          />
                        </div>
                      </div>

                      <div className="flex-1 max-h-[380px] overflow-y-auto divide-y divide-neutral-200 dark:divide-neutral-800">
                        {!selectedRoom ? (
                          <div className="text-center py-10 text-xs text-muted-foreground">
                            Pilih unit radiologi terlebih dahulu.
                          </div>
                        ) : loadingProcedures ? (
                          <div className="flex items-center justify-center py-10 text-xs text-muted-foreground">
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Memuat daftar pemeriksaan...
                          </div>
                        ) : filteredProcedures.length === 0 ? (
                          <div className="text-center py-10 text-xs text-muted-foreground">
                            {searchTerm ? "Pemeriksaan tidak ditemukan" : "Tidak ada pemeriksaan tersedia"}
                          </div>
                        ) : (
                          filteredProcedures.map((proc) => {
                            const isSelected = orderItems.some((item) => item.procedure_id === proc.id);
                            return (
                              <button
                                key={proc.id}
                                type="button"
                                className={cn(
                                  "w-full px-4 py-2.5 text-left flex items-center gap-3 hover:bg-muted/30 transition-colors",
                                  isSelected && "bg-neutral-100/70 dark:bg-neutral-900/50",
                                )}
                                onClick={() => handleToggleProcedure(proc)}
                              >
                                <Checkbox checked={isSelected} className="rounded-none" />
                                <div className="flex-1 min-w-0">
                                  <p className="font-semibold text-xs text-foreground truncate">{proc.name}</p>
                                  <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                                    <span className="font-mono">{proc.code}</span>
                                    {proc.description && ` • ${proc.description}`}
                                  </p>
                                </div>
                              </button>
                            );
                          })
                        )}
                      </div>

                      <DialogFooter className="px-4 py-3 border-t border-neutral-200 dark:border-neutral-800 bg-neutral-50/60 dark:bg-neutral-900/40 shrink-0 flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">
                          Terpilih: <strong className="text-foreground">{orderItems.length}</strong> pemeriksaan
                        </span>
                        <Button
                          type="button"
                          size="sm"
                          className="h-8 rounded-none px-4 text-xs"
                          onClick={() => setShowAddDialog(false)}
                        >
                          Selesai
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </section>

                {/* Submit Button */}
                <div className="flex justify-stretch sm:justify-end px-4 sm:px-5 py-3">
                  <Button
                    size="sm"
                    className="h-8 rounded-none text-xs w-full sm:w-auto"
                    disabled={submitting || orderItems.length === 0 || readOnly}
                    onClick={handleSubmitOrder}
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                        Mengirim...
                      </>
                    ) : (
                      <>
                        <Send className="h-3.5 w-3.5 mr-1.5" />
                        Kirim Order ke Radiologi
                      </>
                    )}
                  </Button>
                </div>
              </fieldset>
            </div>
          )}

          {/* No permission notice for form tab */}
          {activeTab === "form" && !canOrder && (
            <div className="px-4 sm:px-5 py-8 text-center text-xs text-muted-foreground border-b border-neutral-200 dark:border-neutral-800">
              Anda tidak memiliki akses untuk membuat order radiologi.
            </div>
          )}

          {/* History Tab */}
          {activeTab === "history" && (
            <section className="px-4 sm:px-5 py-4 space-y-3 border-b border-neutral-200 dark:border-neutral-800">
              <div className="flex items-center gap-2">
                <div className="border-l-2 border-neutral-900 dark:border-neutral-100 pl-2.5 text-xs font-bold uppercase tracking-wider text-neutral-900 dark:text-neutral-100">
                  Riwayat Order Radiologi
                </div>
                <Badge variant="secondary" className="rounded-none h-5 px-1.5 text-[10px] font-mono">
                  {existingOrders.length} Order
                </Badge>
              </div>

              {existingOrders.length > 0 ? (
                <div className="divide-y divide-neutral-200 dark:divide-neutral-800 border border-neutral-200 dark:border-neutral-800">
                  {existingOrders.map((order) => (
                    <OrderCollapsible
                      key={order.id}
                      order={order}
                      onCancel={handleCancelOrder}
                      canCancel={canOrder}
                    />
                  ))}
                </div>
              ) : (
                <div className="border border-dashed border-neutral-200 dark:border-neutral-800 bg-neutral-50/30 dark:bg-neutral-900/10 px-3.5 py-2.5 text-xs text-muted-foreground">
                  Belum ada riwayat order radiologi pada kunjungan ini.
                </div>
              )}
            </section>
          )}
        </div>
      </div>

      {/* Cancel Confirmation Dialog */}
      <AlertDialog open={!!cancelConfirmOrderId} onOpenChange={(open) => !open && setCancelConfirmOrderId(null)}>
        <AlertDialogContent className="max-w-sm rounded-none">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-sm font-bold uppercase tracking-tight">
              Batalkan Order Radiologi?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs">
              Yakin ingin membatalkan order radiologi ini? Order yang dibatalkan tidak dapat dikembalikan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="h-8 rounded-none text-xs">Batal</AlertDialogCancel>
            <AlertDialogAction
              className="h-8 rounded-none text-xs bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleConfirmCancelOrder}
            >
              Ya, Batalkan
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
