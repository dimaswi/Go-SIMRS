import { useState, useEffect } from "react";
import { usePermission } from "@/hooks/usePermission";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Combobox } from "@/components/ui/combobox";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2,
  Send,
  Scissors,
  AlertCircle,
  CheckCircle2,
  Trash2,
  Clock,
  ChevronDown,
  ChevronRight,
  Printer,
  CalendarIcon,
  User,
} from "lucide-react";
import { procedureOrdersApi, PROCEDURE_ORDER_STATUS } from "@/lib/api";
import type { ProcedureOrder, Procedure as ProcedureType } from "@/lib/api/procedure-orders";

interface SurgeryOrderFormProps {
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

  const patient = order.registration?.patient || order.source_visit?.registration?.patient;

  const handlePrintQueue = () => {
    const printWindow = window.open("", "_blank", "width=400,height=600");
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>Tiket Antrian Operasi</title>
            <style>
              body { font-family: Arial, sans-serif; text-align: center; padding: 20px; }
              .queue-number { font-size: 72px; font-weight: bold; margin: 20px 0; }
              .info { margin: 10px 0; font-size: 14px; }
              .header { font-size: 18px; font-weight: bold; margin-bottom: 10px; }
              .divider { border-top: 1px dashed #ccc; margin: 15px 0; }
            </style>
          </head>
          <body>
            <div class="header">ANTRIAN OPERASI</div>
            <div class="info">${order.target_room?.name || "Kamar Operasi"}</div>
            <div class="divider"></div>
            <div class="queue-number">${order.target_visit?.room_queue?.queue_number || "-"}</div>
            <div class="divider"></div>
            <div class="info"><strong>${patient?.nama_lengkap || "-"}</strong></div>
            <div class="info">No. RM: ${patient?.no_rm || "-"}</div>
            <div class="info">Order: ${order.order_number}</div>
            <div class="divider"></div>
            <div class="info">${new Date().toLocaleString("id-ID")}</div>
            <script>window.print(); window.close();</script>
          </body>
        </html>
      `);
      printWindow.document.close();
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
                <Badge variant="outline" className="text-xs">
                  Antrian: {order.target_visit?.room_queue?.queue_number || "-"}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {new Date(order.created_at).toLocaleString("id-ID")} • {order.target_room?.name} • {order.items?.length || 0} tindakan
              </p>
            </div>
          </CollapsibleTrigger>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handlePrintQueue}>
              <Printer className="h-4 w-4 mr-1" />
              Cetak Antrian
            </Button>
            {order.status === "pending" && canCancel && (
              <Button variant="outline" size="sm" className="text-destructive" onClick={() => onCancel(order.id)}>
                <Trash2 className="h-4 w-4 mr-1" />
                Batalkan
              </Button>
            )}
          </div>
        </div>
        <CollapsibleContent>
          <div className="mt-3 ml-6 space-y-3">
            {/* Order Info Table */}
            <div className="bg-muted/30 rounded-lg p-3">
              <table className="w-full text-sm">
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
                    <td className="py-1 text-muted-foreground">Kamar Operasi</td>
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
                    <td className="py-1 text-muted-foreground">Dokter Pengirim</td>
                    <td className="py-1">{order.ordered_by?.nama_lengkap || "-"}</td>
                  </tr>
                  {order.surgeon_doctor && (
                    <tr>
                      <td className="py-1 text-muted-foreground">Dokter Bedah</td>
                      <td className="py-1 font-medium">{order.surgeon_doctor.nama_lengkap}</td>
                    </tr>
                  )}
                  {order.scheduled_date && (
                    <tr>
                      <td className="py-1 text-muted-foreground">Jadwal Operasi</td>
                      <td className="py-1 font-medium">{new Date(order.scheduled_date).toLocaleString("id-ID")}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Order Items Table */}
            {order.items && order.items.length > 0 && (
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="py-2 px-3 text-left font-medium">Tindakan Operasi</th>
                      <th className="py-2 px-3 text-left font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {order.items.map((item, idx) => (
                      <tr key={idx} className="border-t">
                        <td className="py-2 px-3">
                          <p className="font-medium">{item.procedure?.name}</p>
                          {item.notes && (
                            <p className="text-xs text-muted-foreground">{item.notes}</p>
                          )}
                        </td>
                        <td className="py-2 px-3">
                          <Badge variant={item.status === "completed" ? "default" : "secondary"} className="text-xs">
                            {item.status === "completed" ? "Selesai" : "Menunggu"}
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
              <div className="bg-green-50 dark:bg-green-950 border border-green-200 rounded-lg p-3 space-y-2">
                <p className="font-medium text-green-700 dark:text-green-300 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4" />
                  Operasi Selesai
                </p>
                {order.result_summary && (
                  <div>
                    <span className="text-xs font-medium">Hasil:</span>
                    <p className="text-sm whitespace-pre-wrap">{order.result_summary}</p>
                  </div>
                )}
                {order.conclusion && (
                  <div>
                    <span className="text-xs font-medium">Kesan:</span>
                    <p className="text-sm whitespace-pre-wrap">{order.conclusion}</p>
                  </div>
                )}
                {order.suggestion && (
                  <div>
                    <span className="text-xs font-medium">Saran:</span>
                    <p className="text-sm whitespace-pre-wrap">{order.suggestion}</p>
                  </div>
                )}
                {order.is_critical && (
                  <div className="mt-2 p-2 bg-red-100 dark:bg-red-900 rounded text-sm">
                    <span className="text-red-700 dark:text-red-300 font-bold flex items-center gap-1">
                      <AlertCircle className="h-4 w-4" />
                      CATATAN PENTING
                    </span>
                    <p className="mt-1">{order.critical_notes}</p>
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

interface AvailableDoctor {
  employee_id: number;
  employee_name: string;
  start_time: string;
  end_time: string;
}

const DAY_NAMES = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];

export function SurgeryOrderForm({ visitId, readOnly = false }: SurgeryOrderFormProps) {
  const { toast } = useToast();
  const { hasPermission } = usePermission();
  const [activeTab, setActiveTab] = useState<"form" | "history">("form");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [existingOrders, setExistingOrders] = useState<ProcedureOrder[]>([]);
  const [surgeryRooms, setSurgeryRooms] = useState<{ id: number; name: string; code: string }[]>([]);
  const [selectedRoom, setSelectedRoom] = useState<number | null>(null);
  const [procedures, setProcedures] = useState<ProcedureType[]>([]);
  const [loadingProcedures, setLoadingProcedures] = useState(false);

  // Schedule-based doctor selection
  const [scheduledDate, setScheduledDate] = useState("");
  const [availableDoctors, setAvailableDoctors] = useState<AvailableDoctor[]>([]);
  const [loadingDoctors, setLoadingDoctors] = useState(false);
  const [roomClosed, setRoomClosed] = useState(false);
  const [selectedDoctor, setSelectedDoctor] = useState<number | null>(null);

  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [diagnosis, setDiagnosis] = useState("");
  const [clinicalNotes, setClinicalNotes] = useState("");
  const [priority, setPriority] = useState("normal");

  const canOrder = hasPermission("medical_records.surgery_order");

  useEffect(() => {
    loadData();
  }, [visitId]);

  // When room changes, load procedures
  useEffect(() => {
    if (selectedRoom) {
      loadProcedures(selectedRoom);
    } else {
      loadProcedures();
    }
    // Reset doctor selection when room changes
    setSelectedDoctor(null);
    setAvailableDoctors([]);
    setRoomClosed(false);
  }, [selectedRoom]);

  // When date OR room changes, load available doctors
  useEffect(() => {
    if (selectedRoom && scheduledDate) {
      const dateOnly = scheduledDate.includes("T")
        ? scheduledDate.split("T")[0]
        : scheduledDate;
      loadAvailableDoctors(selectedRoom, dateOnly);
    } else {
      setAvailableDoctors([]);
      setSelectedDoctor(null);
      setRoomClosed(false);
    }
  }, [selectedRoom, scheduledDate]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [ordersRes, roomsRes] = await Promise.all([
        procedureOrdersApi.getBySourceVisit(visitId, "surgery"),
        procedureOrdersApi.getSurgeryRooms(),
      ]);
      setExistingOrders(ordersRes.data || []);
      setSurgeryRooms(roomsRes.data || []);

      // Auto-select first room
      if (roomsRes.data?.length > 0 && !selectedRoom) {
        setSelectedRoom(roomsRes.data[0].id);
      }
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

  const loadProcedures = async (roomId?: number) => {
    setLoadingProcedures(true);
    try {
      const res = await procedureOrdersApi.getSurgicalProcedures(roomId);
      setProcedures(res.data || []);
    } catch (error) {
      console.error("Error loading procedures:", error);
    } finally {
      setLoadingProcedures(false);
    }
  };

  const loadAvailableDoctors = async (roomId: number, date: string) => {
    setLoadingDoctors(true);
    setSelectedDoctor(null);
    try {
      const res = await procedureOrdersApi.getAvailableDoctors(roomId, date);
      const responseData = res.data as any;
      const doctors: AvailableDoctor[] = responseData?.data || [];
      const isClosed: boolean = responseData?.room_closed || false;
      setAvailableDoctors(doctors);
      setRoomClosed(isClosed);
    } catch (error) {
      console.error("Error loading available doctors:", error);
      setAvailableDoctors([]);
    } finally {
      setLoadingDoctors(false);
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
    if (!confirm("Yakin ingin membatalkan order operasi ini?")) return;
    try {
      await procedureOrdersApi.cancel(orderId, "Dibatalkan oleh dokter");
      toast({
        title: "Berhasil",
        description: "Order operasi berhasil dibatalkan",
      });
      loadData();
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
        description: "Pilih kamar operasi terlebih dahulu",
      });
      return;
    }

    if (orderItems.length === 0) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Pilih minimal 1 tindakan operasi",
      });
      return;
    }

    // Validate time against doctor schedule
    if (selectedDoctor && scheduledDate && scheduledDate.includes("T")) {
      const time = scheduledDate.split("T")[1];
      const doc = availableDoctors.find(d => d.employee_id === selectedDoctor);
      if (doc && (time < doc.start_time || time > doc.end_time)) {
        toast({
          variant: "destructive",
          title: "Error",
          description: `Jam operasi (${time}) di luar jadwal dokter (${doc.start_time} - ${doc.end_time})`,
        });
        return;
      }
    }

    setSubmitting(true);
    try {
      await procedureOrdersApi.create({
        order_type: "surgery",
        source_visit_id: visitId,
        target_room_id: selectedRoom,
        priority,
        clinical_notes: clinicalNotes,
        diagnosis,
        surgeon_doctor_id: selectedDoctor || undefined,
        scheduled_date: scheduledDate || undefined,
        items: orderItems.map((item) => ({
          procedure_id: item.procedure_id,
          notes: item.notes,
        })),
      });

      toast({
        title: "Berhasil",
        description: "Order operasi berhasil dikirim",
      });

      // Reset form
      setOrderItems([]);
      setDiagnosis("");
      setClinicalNotes("");
      setPriority("normal");
      setSelectedDoctor(null);
      setScheduledDate("");

      // Reload orders
      loadData();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.response?.data?.error || "Gagal membuat order operasi",
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <Card className="shadow-md">
      <CardHeader className="border-b bg-muted/30 py-3 px-4">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <Scissors className="h-4 w-4" />
          Order Operasi / Bedah
        </CardTitle>
        <CardDescription>
          Kelola order tindakan operasi untuk pasien
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        {/* Inline Tabs with Underline */}
        <div className="border-b">
          <div className="flex">
            <button
              onClick={() => setActiveTab("form")}
              className={cn(
                "px-4 py-2.5 text-sm font-medium transition-colors relative",
                activeTab === "form"
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <span className="flex items-center gap-2">
                <Scissors className="h-4 w-4" />
                Order Baru
              </span>
              {activeTab === "form" && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
              )}
            </button>
            <button
              onClick={() => setActiveTab("history")}
              className={cn(
                "px-4 py-2.5 text-sm font-medium transition-colors relative",
                activeTab === "history"
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <span className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Riwayat Order
                {existingOrders.length > 0 && (
                  <Badge variant="secondary" className="ml-1 h-5 px-1.5">
                    {existingOrders.length}
                  </Badge>
                )}
              </span>
              {activeTab === "history" && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
              )}
            </button>
          </div>
        </div>

        <ScrollArea className="h-[calc(100vh-450px)] min-h-[570px]">
          <div className="p-4">
            {/* Order Form Tab */}
            {activeTab === "form" && canOrder && (
              <fieldset disabled={readOnly} className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Kamar Operasi Tujuan</Label>
                <Select
                  value={selectedRoom?.toString() || ""}
                  onValueChange={(value) => setSelectedRoom(Number(value))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih kamar operasi" />
                  </SelectTrigger>
                  <SelectContent>
                    {surgeryRooms.map((room) => (
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
                    <SelectItem value="normal">Elektif</SelectItem>
                    <SelectItem value="urgent">Urgent / Cito</SelectItem>
                    <SelectItem value="cito">Emergency</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="flex items-center gap-1">
                  <CalendarIcon className="h-3.5 w-3.5" />
                  Jadwal Operasi
                </Label>
                <Input
                  type="datetime-local"
                  value={scheduledDate}
                  onChange={(e) => setScheduledDate(e.target.value)}
                />
                {scheduledDate && (
                  <p className="text-xs text-muted-foreground">
                    Hari: {DAY_NAMES[new Date(scheduledDate).getDay()]}
                  </p>
                )}
                {selectedDoctor && scheduledDate && (() => {
                  const doc = availableDoctors.find(d => d.employee_id === selectedDoctor);
                  if (!doc) return null;
                  const time = scheduledDate.includes("T") ? scheduledDate.split("T")[1] : "";
                  if (time && (time < doc.start_time || time > doc.end_time)) {
                    return (
                      <p className="text-xs text-destructive">
                        Jam {time} di luar jadwal dokter ({doc.start_time} - {doc.end_time})
                      </p>
                    );
                  }
                  return null;
                })()}
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-1">
                  <User className="h-3.5 w-3.5" />
                  Dokter Bedah
                </Label>
                {!scheduledDate ? (
                  <div className="flex items-center h-9 px-3 border rounded-md text-sm text-muted-foreground bg-muted/30">
                    Pilih jadwal operasi dahulu
                  </div>
                ) : roomClosed ? (
                  <div className="flex items-center h-9 px-3 border border-destructive/50 rounded-md text-sm text-destructive bg-destructive/5">
                    <AlertCircle className="h-4 w-4 mr-2" />
                    Kamar operasi tutup di tanggal ini
                  </div>
                ) : availableDoctors.length > 0 ? (
                  <Combobox
                    options={availableDoctors.map((doc) => ({
                      value: doc.employee_id.toString(),
                      label: `${doc.employee_name} (${doc.start_time} - ${doc.end_time})`,
                    }))}
                    value={selectedDoctor?.toString() || ""}
                    onValueChange={(value) => setSelectedDoctor(value ? Number(value) : null)}
                    placeholder="Cari dokter bedah..."
                    searchPlaceholder="Ketik nama dokter..."
                    emptyText="Dokter tidak ditemukan"
                    loading={loadingDoctors}
                    disabled={readOnly}
                  />
                ) : loadingDoctors ? (
                  <div className="flex items-center gap-2 h-9 px-3 border rounded-md text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Memuat dokter...
                  </div>
                ) : (
                  <div className="flex items-center h-9 px-3 border border-amber-500/50 rounded-md text-sm text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950">
                    <AlertCircle className="h-4 w-4 mr-2 shrink-0" />
                    Tidak ada jadwal dokter di hari {DAY_NAMES[new Date(scheduledDate).getDay()]}
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Diagnosis Pre-Operasi</Label>
              <Textarea
                placeholder="Tulis diagnosis pre-operasi"
                value={diagnosis}
                onChange={(e) => setDiagnosis(e.target.value)}
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label>Catatan Klinis / Indikasi Operasi</Label>
              <Textarea
                placeholder="Catatan klinis, indikasi operasi, riwayat penyakit"
                value={clinicalNotes}
                onChange={(e) => setClinicalNotes(e.target.value)}
                rows={2}
              />
            </div>

            <Separator />

            {/* Procedure Selection */}
            <div className="space-y-2">
              <Label className="text-base font-medium">Pilih Tindakan Operasi</Label>

              {loadingProcedures ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : procedures.length === 0 ? (
                <div className="border-2 border-dashed rounded-lg p-8 text-center text-muted-foreground">
                  <Scissors className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>Tidak ada tindakan operasi tersedia</p>
                  <p className="text-sm">Pilih kamar operasi terlebih dahulu atau hubungi admin untuk menambahkan prosedur bedah</p>
                </div>
              ) : (
                <ScrollArea className="h-[250px] border rounded-lg">
                  <div className="divide-y">
                    {procedures.map((proc) => {
                      const isSelected = orderItems.some((item) => item.procedure_id === proc.id);
                      return (
                        <div
                          key={proc.id}
                          className={`p-3 flex items-center gap-3 ${!readOnly ? 'cursor-pointer hover:bg-muted/50' : 'opacity-60'} ${
                            isSelected ? "bg-primary/5 border-l-2 border-l-primary" : ""
                          }`}
                          onClick={() => !readOnly && handleToggleProcedure(proc)}
                        >
                          <Checkbox checked={isSelected} disabled={readOnly} />
                          <div className="flex-1">
                            <p className="font-medium text-sm">{proc.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {proc.code}
                              {proc.description && ` • ${proc.description}`}
                              {(proc as any).duration > 0 && ` • ${(proc as any).duration} menit`}
                              {(proc as any).requires_anesthesia && " • Perlu Anestesi"}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
              )}
            </div>

            {/* Selected Items Summary */}
            {orderItems.length > 0 && (
              <div className="space-y-2">
                <Label className="text-base font-medium">Tindakan Operasi Dipilih ({orderItems.length})</Label>
                <div className="border rounded-lg divide-y">
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
            )}

            {/* Submit Button */}
            <div className="flex justify-end pt-4">
              <Button
                size="lg"
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
                    Kirim Order ke Kamar Operasi
                  </>
                )}
              </Button>
            </div>
              </fieldset>
            )}

            {/* No permission notice for form tab */}
            {activeTab === "form" && !canOrder && (
              <div className="text-center py-12 text-muted-foreground">
                <Scissors className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Anda tidak memiliki akses untuk membuat order operasi</p>
              </div>
            )}

            {/* History Tab */}
            {activeTab === "history" && (
              <div className="space-y-2">
                {existingOrders.length > 0 ? (
                  <div className="divide-y border rounded-lg">
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
                    <p>Belum ada riwayat order operasi</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
