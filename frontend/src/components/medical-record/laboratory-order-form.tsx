import { useState, useEffect } from "react";
import { usePermission } from "@/hooks/usePermission";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
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
  Send,
  TestTube,
  AlertCircle,
  CheckCircle2,
  Trash2,
  Clock,
  Search,
  Plus,
  ChevronDown,
  ChevronRight,
  ArrowUp,
  ArrowDown,
  Printer,
} from "lucide-react";
import { procedureOrdersApi, PROCEDURE_ORDER_STATUS, printApi, medicalRecordsApi } from "@/lib/api";
import type { ProcedureOrder, Procedure as ProcedureType } from "@/lib/api/procedure-orders";

interface LaboratoryOrderFormProps {
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

// Helper functions for lab results
const renderLabResultValue = (result: any) => {
  const param = result.procedure_parameter;
  if (!param) return result.value || "-";

  if (param.input_type === "number") {
    const value = result.numeric_value || parseFloat(result.value) || 0;
    let indicator = null;
    let colorClass = "";

    if (result.is_critical) {
      colorClass = "text-red-600 font-bold";
      indicator = <AlertCircle className="h-4 w-4 inline ml-1 text-red-600" />;
    } else if (result.is_low) {
      colorClass = "text-blue-600";
      indicator = <ArrowDown className="h-4 w-4 inline ml-1 text-blue-600" />;
    } else if (result.is_high) {
      colorClass = "text-orange-600";
      indicator = <ArrowUp className="h-4 w-4 inline ml-1 text-orange-600" />;
    }

    return (
      <span className={colorClass}>
        {value.toFixed(param.decimal_places || 0)} {param.unit}
        {indicator}
      </span>
    );
  }

  return result.value || "-";
};

const renderNormalRange = (param: any) => {
  if (!param) return "-";
  if (param.normal_text) return param.normal_text;
  if (param.normal_min !== 0 || param.normal_max !== 0) {
    return `${param.normal_min} - ${param.normal_max} ${param.unit || ""}`;
  }
  return "-";
};

// Collapsible Order History Component
function OrderCollapsible({ order, onCancel, canCancel }: { order: ProcedureOrder; onCancel: (id: number) => void; canCancel: boolean }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const { toast } = useToast();

  // Get patient info from registration or source_visit.registration
  const patient = order.registration?.patient || order.source_visit?.registration?.patient;

  const handlePrintQueue = async () => {
    const queueId = order.target_visit?.room_queue?.id;
    if (!queueId) {
      toast({
        title: "Error",
        description: "Nomor antrian tidak tersedia",
        variant: "destructive",
      });
      return;
    }

    setIsPrinting(true);
    try {
      const url = await printApi.queueTicket(queueId);
      window.open(url, "_blank");
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.response?.data?.error || "Gagal mencetak tiket antrian",
        variant: "destructive",
      });
    } finally {
      setIsPrinting(false);
    }
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div className="p-3 hover:bg-muted/50">
        <div className="flex items-center justify-between gap-2">
          <CollapsibleTrigger className="flex items-center gap-2 flex-1 text-left">
            {isOpen ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            )}
            <div className="flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium text-sm">{order.order_number}</span>
                <Badge variant={PROCEDURE_ORDER_STATUS[order.status as keyof typeof PROCEDURE_ORDER_STATUS]?.variant || "secondary"} className="text-xs">
                  {PROCEDURE_ORDER_STATUS[order.status as keyof typeof PROCEDURE_ORDER_STATUS]?.label || order.status}
                </Badge>
                {(order.priority === "urgent" || order.priority === "cito") && (
                  <Badge variant="destructive" className="text-xs">{order.priority.toUpperCase()}</Badge>
                )}
                {order.is_critical && (
                  <Badge variant="destructive" className="text-xs">
                    <AlertCircle className="h-3 w-3 mr-1" />
                    KRITIS
                  </Badge>
                )}
                <Badge variant="outline" className="text-xs">
                  Antrian: {order.target_visit?.room_queue?.queue_number || "-"}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {new Date(order.created_at).toLocaleString("id-ID")} • {order.target_room?.name} • {order.items?.filter(i => i.status !== "cancelled").length || 0} pemeriksaan
              </p>
            </div>
          </CollapsibleTrigger>
          <TooltipProvider delayDuration={120}>
            <div className="flex items-center gap-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" size="icon" className="h-8 w-8" onClick={handlePrintQueue} disabled={isPrinting} aria-label="Cetak antrian">
                    {isPrinting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Printer className="h-4 w-4" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top">Cetak Antrian</TooltipContent>
              </Tooltip>
              {order.status === "pending" && canCancel && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="outline" size="icon" className="h-8 w-8 text-destructive" onClick={() => onCancel(order.id)} aria-label="Batalkan order">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="top">Batalkan</TooltipContent>
                </Tooltip>
              )}
            </div>
          </TooltipProvider>
        </div>
        <CollapsibleContent>
          <div className="mt-3 ml-6 space-y-3">
            {/* Order Info Table */}
            <div className="bg-muted/30 border border-border/70 p-3">
              <table className="w-full min-w-[640px] text-sm">
                <tbody>
                  <tr>
                    <td className="py-1 text-muted-foreground w-1/3">No. RM</td>
                    <td className="py-1 font-medium">{patient?.no_rm || "-"}</td>
                  </tr>
                  <tr>
                    <td className="py-1 text-muted-foreground">Nama Pasien</td>
                    <td className="py-1 font-medium">{patient?.nama_lengkap || "-"}</td>
                  </tr>
                  <tr>
                    <td className="py-1 text-muted-foreground">Unit Laboratorium</td>
                    <td className="py-1 font-medium">{order.target_room?.name || "-"}</td>
                  </tr>
                  <tr>
                    <td className="py-1 text-muted-foreground">No. Antrian</td>
                    <td className="py-1 font-medium">{order.target_visit?.room_queue?.queue_number || "-"}</td>
                  </tr>
                  <tr>
                    <td className="py-1 text-muted-foreground">Prioritas</td>
                    <td className="py-1">
                      <Badge variant={order.priority === "urgent" || order.priority === "cito" ? "destructive" : "outline"} className="text-xs">
                        {order.priority === "urgent" || order.priority === "cito" ? order.priority.toUpperCase() : "Normal"}
                      </Badge>
                    </td>
                  </tr>
                  <tr>
                    <td className="py-1 text-muted-foreground">Diagnosis</td>
                    <td className="py-1">{order.diagnosis || "-"}</td>
                  </tr>
                  <tr>
                    <td className="py-1 text-muted-foreground">Catatan Klinis</td>
                    <td className="py-1">{order.clinical_notes || "-"}</td>
                  </tr>
                  <tr>
                    <td className="py-1 text-muted-foreground">Dokter</td>
                    <td className="py-1">{order.ordered_by?.nama_lengkap || "-"}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Results or Items */}
            {order.status === "completed" ? (
              <div className="space-y-3">
                {order.items?.filter(item => item.status !== "cancelled").map((item) => (
                  <div key={item.id} className="border border-border/70 overflow-x-auto">
                    <div className="bg-muted/50 px-3 py-2 font-medium flex items-center justify-between border-b border-border/70">
                      <span>{item.procedure?.name}</span>
                      <Badge variant="default">
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        Selesai
                      </Badge>
                    </div>
                    {item.results && item.results.length > 0 && (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Parameter</TableHead>
                            <TableHead>Hasil</TableHead>
                            <TableHead>Nilai Normal</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {item.results.map((result) => (
                            <TableRow key={result.id} className={result.is_critical ? "bg-red-50 dark:bg-red-950" : ""}>
                              <TableCell className="font-medium">
                                {result.procedure_parameter?.name || "-"}
                              </TableCell>
                              <TableCell>
                                {renderLabResultValue(result)}
                              </TableCell>
                              <TableCell className="text-muted-foreground">
                                {renderNormalRange(result.procedure_parameter)}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </div>
                ))}

                {/* Critical Alert */}
                {order.is_critical && (
                  <div className="p-3 border border-red-200 bg-red-50 dark:bg-red-950/30">
                    <span className="text-red-700 dark:text-red-300 font-bold flex items-center gap-2">
                      <AlertCircle className="h-5 w-5" />
                      NILAI KRITIS - Segera hubungi dokter!
                    </span>
                    {order.critical_notes && (
                      <p className="mt-2 text-sm">{order.critical_notes}</p>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="border border-border/70 overflow-x-auto">
                <table className="w-full min-w-[640px] text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="py-2 px-3 text-left font-medium">Pemeriksaan</th>
                      <th className="py-2 px-3 text-left font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {order.items?.filter(item => item.status !== "cancelled").map((item, idx) => (
                      <tr key={idx} className="border-t">
                        <td className="py-2 px-3">
                          <p className="font-medium">{item.procedure?.name}</p>
                        </td>
                        <td className="py-2 px-3">
                          <Badge variant="secondary" className="text-xs">
                            {item.status === "in_progress" ? "Dikerjakan" : item.status === "completed" ? "Selesai" : "Menunggu"}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

export function LaboratoryOrderForm({ visitId, readOnly = false }: LaboratoryOrderFormProps) {
  const { toast } = useToast();
  const { hasPermission } = usePermission();
  const [activeTab, setActiveTab] = useState<"form" | "history">("form");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [existingOrders, setExistingOrders] = useState<ProcedureOrder[]>([]);
  const [laboratoryRooms, setLaboratoryRooms] = useState<{ id: number; name: string; code: string }[]>([]);
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

  const canOrder = hasPermission("medical_records.laboratory_order");

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
        procedureOrdersApi.getBySourceVisit(visitId, "laboratory"),
        procedureOrdersApi.getLaboratoryRooms(),
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
      const updatedOrdersRes = await procedureOrdersApi.getBySourceVisit(visitId, "laboratory");
      setExistingOrders(updatedOrdersRes.data || []);
      setLaboratoryRooms(roomsRes.data || []);

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
      const res = await procedureOrdersApi.getProceduresByRoom(roomId, "laboratory");
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
        description: "Pilih unit laboratorium terlebih dahulu",
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
        order_type: "laboratory",
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
        description: "Order laboratorium berhasil dikirim",
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
    <div>
      <div className="p-0">
        {/* Inline Tabs with Underline */}
        <div>
          <div className="flex items-center gap-6 px-4">
            <button
              onClick={() => setActiveTab("form")}
              className={cn(
                "py-3 text-sm font-medium transition-colors relative flex items-center gap-2",
                activeTab === "form"
                  ? "text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <TestTube className={cn("h-4 w-4", activeTab === "form" ? "text-primary" : "text-muted-foreground")} />
              Order Baru
              {activeTab === "form" && (
                <div className="absolute bottom-[-1px] left-0 right-0 h-[2px] bg-primary rounded-t-sm" />
              )}
            </button>
            <button
              onClick={() => setActiveTab("history")}
              className={cn(
                "py-3 text-sm font-medium transition-colors relative flex items-center gap-2",
                activeTab === "history"
                  ? "text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Clock className={cn("h-4 w-4", activeTab === "history" ? "text-primary" : "text-muted-foreground")} />
              Riwayat Order
              {existingOrders.length > 0 && (
                <Badge variant="secondary" className="ml-1 h-5 px-1.5 font-normal">
                  {existingOrders.length}
                </Badge>
              )}
              {activeTab === "history" && (
                <div className="absolute bottom-[-1px] left-0 right-0 h-[2px] bg-primary rounded-t-sm" />
              )}
            </button>
          </div>
        </div>

        <div className="p-4">
          {/* Order Form Tab */}
          {activeTab === "form" && canOrder && (
            <div className="space-y-4">
              <fieldset disabled={readOnly} className="space-y-4 [&_input]:h-10 [&_[role=combobox]]:h-10">
                <div className="border border-border/70">
                  <div className="border-b border-border/70 bg-muted/30 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    Konfigurasi Order
                  </div>
                  <div className="space-y-4 p-3 sm:p-4">
                    {/* Room & Priority Selection */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Unit Laboratorium Tujuan</Label>
                        <Select
                          value={selectedRoom?.toString() || ""}
                          onValueChange={(value) => setSelectedRoom(Number(value))}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Pilih unit laboratorium" />
                          </SelectTrigger>
                          <SelectContent>
                            {laboratoryRooms.map((room) => (
                              <SelectItem key={room.id} value={room.id.toString()}>
                                {room.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Prioritas</Label>
                        <Select value={priority} onValueChange={setPriority}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="normal">Normal</SelectItem>
                            <SelectItem value="urgent">Urgent</SelectItem>
                            <SelectItem value="cito">CITO</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Diagnosis</Label>
                      <Textarea
                        placeholder="Tulis diagnosis terkait pemeriksaan"
                        value={diagnosis}
                        onChange={(e) => setDiagnosis(e.target.value)}
                        rows={2}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Catatan Klinis</Label>
                      <Textarea
                        placeholder="Catatan klinis untuk petugas laboratorium"
                        value={clinicalNotes}
                        onChange={(e) => setClinicalNotes(e.target.value)}
                        rows={2}
                      />
                    </div>
                  </div>
                </div>

                <div className="border border-border/70">
                  <div className="border-b border-border/70 bg-muted/30 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    Pemeriksaan
                  </div>
                  <div className="space-y-4 p-3 sm:p-4">

                    {/* Procedure Selection */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <Label className="text-base font-medium">Pilih Pemeriksaan</Label>
                        <Button
                          type="button"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => setShowAddDialog(true)}
                          disabled={!selectedRoom || readOnly}
                          aria-label="Tambah pemeriksaan"
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    {orderItems.length > 0 ? (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between gap-2 border-b border-border/70 pb-2">
                          <Label className="text-base font-medium">Pemeriksaan Dipilih</Label>
                          <Badge variant="secondary">{orderItems.length} item</Badge>
                        </div>
                        <div className="border border-border/70 divide-y">
                          {orderItems.map((item) => (
                            <div key={item.procedure_id} className="p-3 flex items-center justify-between gap-3">
                              <div className="flex-1">
                                <p className="font-medium text-sm">{item.procedure_name}</p>
                                <p className="text-xs text-muted-foreground">{item.procedure_code}</p>
                              </div>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive"
                                onClick={() => handleRemoveItem(item.procedure_id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="border border-dashed border-border/70 p-8 text-center text-muted-foreground">
                        <TestTube className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p>Belum ada pemeriksaan dipilih</p>
                        <p className="text-sm">Gunakan tombol + untuk menambah pemeriksaan.</p>
                      </div>
                    )}

                    <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
                      <DialogContent className="w-[calc(100vw-1rem)] sm:max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
                        <DialogHeader>
                          <DialogTitle>Pilih Pemeriksaan Laboratorium</DialogTitle>
                        </DialogHeader>
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input
                            placeholder="Cari pemeriksaan..."
                            className="pl-9"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                          />
                        </div>
                        <ScrollArea className="flex-1 max-h-[420px] border rounded-md">
                          {!selectedRoom ? (
                            <div className="text-center py-8 text-muted-foreground text-sm">Pilih unit laboratorium terlebih dahulu.</div>
                          ) : loadingProcedures ? (
                            <div className="flex items-center justify-center py-8">
                              <Loader2 className="h-6 w-6 animate-spin" />
                            </div>
                          ) : filteredProcedures.length === 0 ? (
                            <div className="text-center py-8 text-muted-foreground text-sm">
                              {searchTerm ? "Pemeriksaan tidak ditemukan" : "Tidak ada pemeriksaan tersedia"}
                            </div>
                          ) : (
                            <div className="divide-y">
                              {filteredProcedures.map((proc) => {
                                const isSelected = orderItems.some((item) => item.procedure_id === proc.id);
                                return (
                                  <button
                                    key={proc.id}
                                    type="button"
                                    className={cn(
                                      "w-full p-3 text-left flex items-center gap-3 hover:bg-muted/50",
                                      isSelected && "bg-primary/5"
                                    )}
                                    onClick={() => handleToggleProcedure(proc)}
                                  >
                                    <Checkbox checked={isSelected} />
                                    <div className="flex-1">
                                      <p className="font-medium text-sm">{proc.name}</p>
                                      <p className="text-xs text-muted-foreground">
                                        {proc.code}
                                        {proc.parameters && proc.parameters.length > 0 && ` • ${proc.parameters.length} parameter`}
                                      </p>
                                    </div>
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </ScrollArea>
                      </DialogContent>
                    </Dialog>
                  </div>
                </div>

                {/* Submit Button */}
                <div className="flex justify-stretch sm:justify-end pt-2">
                  <Button
                    size="lg"
                    className="w-full sm:w-auto"
                    disabled={submitting || orderItems.length === 0 || readOnly}
                    onClick={handleSubmitOrder}
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Mengirim...
                      </>
                    ) : (
                      <>
                        <Send className="h-4 w-4 mr-2" />
                        Kirim Order ke Laboratorium
                      </>
                    )}
                  </Button>
                </div>
              </fieldset>
            </div>
          )}

          {/* No permission notice for form tab */}
          {activeTab === "form" && !canOrder && (
            <div className="text-center py-12 text-muted-foreground">
              <TestTube className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Anda tidak memiliki akses untuk membuat order laboratorium</p>
            </div>
          )}

          {/* History Tab */}
          {activeTab === "history" && (
            <div className="space-y-2">
              {existingOrders.length > 0 ? (
                <div className="divide-y border border-border/70">
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
                <div className="text-center py-8 text-muted-foreground">
                  <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>Belum ada riwayat order laboratorium</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Cancel Confirmation Dialog */}
      <AlertDialog open={!!cancelConfirmOrderId} onOpenChange={(open) => !open && setCancelConfirmOrderId(null)}>
        <AlertDialogContent className="max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-sm">Batalkan Order Laboratorium?</AlertDialogTitle>
            <AlertDialogDescription className="text-xs">
              Yakin ingin membatalkan order laboratorium ini? Order yang dibatalkan tidak dapat dikembalikan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="h-8 text-xs">Batal</AlertDialogCancel>
            <AlertDialogAction
              className="h-8 text-xs bg-destructive text-destructive-foreground hover:bg-destructive/90"
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
