import { useState, useEffect } from "react";
import { usePermission } from "@/hooks/usePermission";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
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
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2,
  Send,
  UserRound,
  AlertCircle,
  CheckCircle2,
  Trash2,
  Clock,
  ChevronDown,
  ChevronRight,
  Printer,
  Stethoscope,
  ChevronsUpDown,
  Check,
} from "lucide-react";
import { procedureOrdersApi, PROCEDURE_ORDER_STATUS } from "@/lib/api";
import type { ProcedureOrder, Procedure as ProcedureType } from "@/lib/api/procedure-orders";

interface ConsultationOrderFormProps {
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
  
  // Get patient info from registration or source_visit.registration
  const patient = order.registration?.patient || order.source_visit?.registration?.patient;
  
  const handlePrintQueue = () => {
    const printWindow = window.open("", "_blank", "width=400,height=600");
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>Tiket Antrian Konsultasi</title>
            <style>
              body { font-family: Arial, sans-serif; text-align: center; padding: 20px; }
              .queue-number { font-size: 72px; font-weight: bold; margin: 20px 0; }
              .info { margin: 10px 0; font-size: 14px; }
              .header { font-size: 18px; font-weight: bold; margin-bottom: 10px; }
              .divider { border-top: 1px dashed #ccc; margin: 15px 0; }
            </style>
          </head>
          <body>
            <div class="header">ANTRIAN KONSULTASI</div>
            <div class="info">${order.target_room?.name || "Konsultasi"}</div>
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
                {(order.consultation?.consultant || order.performed_by) && order.status === "completed" && (
                  <span className="text-xs text-muted-foreground">• Dijawab oleh: {order.consultation?.consultant?.nama_lengkap || order.performed_by?.nama_lengkap}</span>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {new Date(order.created_at).toLocaleString("id-ID")} • {order.target_room?.name}
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
                    <td className="py-1 text-muted-foreground">Tujuan Konsultasi</td>
                    <td className="py-1 font-medium">{order.target_room?.name || "-"}</td>
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
                    <td className="py-1 text-muted-foreground">Alasan Konsultasi</td>
                    <td className="py-1">{order.clinical_notes || "-"}</td>
                  </tr>
                  <tr>
                    <td className="py-1 text-muted-foreground">Diagnosis</td>
                    <td className="py-1">{order.diagnosis || "-"}</td>
                  </tr>
                  <tr>
                    <td className="py-1 text-muted-foreground">Dokter Pemesan</td>
                    <td className="py-1">{order.ordered_by?.nama_lengkap || "-"}</td>
                  </tr>
                  {(order.consultation?.consultant || order.performed_by) && order.status === "completed" && (
                    <tr>
                      <td className="py-1 text-muted-foreground">Dokter Pengisi</td>
                      <td className="py-1 font-medium text-green-600">{order.consultation?.consultant?.nama_lengkap || order.performed_by?.nama_lengkap}</td>
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
                      <th className="py-2 px-3 text-left font-medium">Jenis Konsultasi</th>
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
              <div className="bg-green-50 dark:bg-green-950 border border-green-200 rounded-lg p-3 space-y-3">
                <p className="font-medium text-green-700 dark:text-green-300 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4" />
                  Hasil Konsultasi
                </p>
                {order.consultation && (
                  <div className="space-y-3 text-sm">
                    {order.consultation.subjective && (
                      <div>
                        <span className="font-medium text-green-800 dark:text-green-200">S (Subjective) - Keluhan:</span>
                        <p className="whitespace-pre-wrap bg-white dark:bg-gray-900 p-2 rounded mt-1">{order.consultation.subjective}</p>
                      </div>
                    )}
                    {order.consultation.objective && (
                      <div>
                        <span className="font-medium text-green-800 dark:text-green-200">O (Objective) - Pemeriksaan:</span>
                        <p className="whitespace-pre-wrap bg-white dark:bg-gray-900 p-2 rounded mt-1">{order.consultation.objective}</p>
                      </div>
                    )}
                    {order.consultation.assessment && (
                      <div>
                        <span className="font-medium text-green-800 dark:text-green-200">A (Assessment) - Penilaian:</span>
                        <p className="whitespace-pre-wrap bg-white dark:bg-gray-900 p-2 rounded mt-1">{order.consultation.assessment}</p>
                      </div>
                    )}
                    {order.consultation.plan && (
                      <div>
                        <span className="font-medium text-green-800 dark:text-green-200">P (Plan) - Rencana:</span>
                        <p className="whitespace-pre-wrap bg-white dark:bg-gray-900 p-2 rounded mt-1">{order.consultation.plan}</p>
                      </div>
                    )}
                    {order.consultation.recommendation && (
                      <div>
                        <span className="font-medium text-green-800 dark:text-green-200">Rekomendasi:</span>
                        <p className="whitespace-pre-wrap bg-white dark:bg-gray-900 p-2 rounded mt-1">{order.consultation.recommendation}</p>
                      </div>
                    )}
                    {order.consultation.notes && (
                      <div>
                        <span className="font-medium text-green-800 dark:text-green-200">Catatan:</span>
                        <p className="whitespace-pre-wrap bg-white dark:bg-gray-900 p-2 rounded mt-1">{order.consultation.notes}</p>
                      </div>
                    )}
                  </div>
                )}
                {/* Fallback jika tidak ada data consultation (data lama) */}
                {!order.consultation && order.result_summary && (
                  <div>
                    <span className="text-xs font-medium">Jawaban:</span>
                    <p className="text-sm whitespace-pre-wrap bg-white dark:bg-gray-900 p-2 rounded mt-1">{order.result_summary}</p>
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

export function ConsultationOrderForm({ visitId, sourceRoomId, readOnly = false }: ConsultationOrderFormProps) {
  const { toast } = useToast();
  const { hasPermission } = usePermission();
  const [activeTab, setActiveTab] = useState<"form" | "history">("form");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [existingOrders, setExistingOrders] = useState<ProcedureOrder[]>([]);
  const [consultationRooms, setConsultationRooms] = useState<{ id: number; name: string; code: string }[]>([]);
  const [selectedRoom, setSelectedRoom] = useState<number | null>(null);
  const [doctors, setDoctors] = useState<{ id: number; nama_lengkap: string }[]>([]);
  const [selectedDoctor, setSelectedDoctor] = useState<number | null>(null);
  const [openRoomCombo, setOpenRoomCombo] = useState(false);
  const [openDoctorCombo, setOpenDoctorCombo] = useState(false);
  const [procedures, setProcedures] = useState<ProcedureType[]>([]);
  const [loadingProcedures, setLoadingProcedures] = useState(false);
  const [loadingDoctors, setLoadingDoctors] = useState(false);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [diagnosis, setDiagnosis] = useState("");
  const [clinicalNotes, setClinicalNotes] = useState("");
  const [priority, setPriority] = useState("normal");

  const canOrder = hasPermission("medical_records.consultation_order");

  useEffect(() => {
    loadData();
  }, [visitId]);

  useEffect(() => {
    if (selectedRoom) {
      loadProcedures(selectedRoom);
      loadDoctors(selectedRoom);
    } else {
      setProcedures([]);
      setDoctors([]);
    }
  }, [selectedRoom]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [ordersRes, roomsRes] = await Promise.all([
        procedureOrdersApi.getBySourceVisit(visitId, "consultation"),
        procedureOrdersApi.getConsultationRooms(sourceRoomId),
      ]);
      setExistingOrders(ordersRes.data || []);
      // Handle nested data response
      const roomsData = Array.isArray(roomsRes.data) 
        ? roomsRes.data 
        : ((roomsRes.data as any)?.data || []);
      setConsultationRooms(roomsData);
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
      const res = await procedureOrdersApi.getConsultationProcedures(roomId);
      // Handle nested data response
      const procedureData = Array.isArray(res.data) 
        ? res.data 
        : ((res.data as any)?.data || []);
      setProcedures(procedureData);
    } catch (error) {
      console.error("Error loading procedures:", error);
    } finally {
      setLoadingProcedures(false);
    }
  };

  const loadDoctors = async (roomId: number) => {
    setLoadingDoctors(true);
    try {
      const res = await procedureOrdersApi.getDoctorsByRoom(roomId);
      
      // Handle nested data response
      const doctorData = Array.isArray(res.data) 
        ? res.data 
        : ((res.data as any)?.data || []);
      
      setDoctors(doctorData);
    } catch (error) {
      console.error("Error loading doctors:", error);
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
    if (!confirm("Yakin ingin membatalkan order konsultasi ini?")) return;
    try {
      await procedureOrdersApi.cancel(orderId, "Dibatalkan oleh dokter");
      toast({
        title: "Berhasil",
        description: "Order konsultasi berhasil dibatalkan",
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
        description: "Pilih ruangan tujuan konsultasi terlebih dahulu",
      });
      return;
    }

    if (orderItems.length === 0) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Pilih minimal 1 jenis konsultasi",
      });
      return;
    }

    if (!clinicalNotes.trim()) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Alasan/indikasi konsultasi wajib diisi",
      });
      return;
    }

    setSubmitting(true);
    try {
      await procedureOrdersApi.create({
        order_type: "consultation",
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
        description: "Order konsultasi berhasil dikirim",
      });

      // Reset form
      setOrderItems([]);
      setDiagnosis("");
      setClinicalNotes("");
      setPriority("normal");
      setSelectedDoctor(null);

      // Reload orders
      loadData();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.response?.data?.error || "Gagal membuat order konsultasi",
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
          <Stethoscope className="h-4 w-4" />
          Order Konsultasi
        </CardTitle>
        <CardDescription>
          Kelola konsultasi ke dokter spesialis
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
                <Stethoscope className="h-4 w-4" />
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

        <ScrollArea className="h-[calc(100vh-300px)] min-h-[400px]">
          <div className="p-4">
            {/* Order Form Tab */}
            {activeTab === "form" && canOrder && (
              <div className="space-y-4">
                <fieldset disabled={readOnly}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Ruangan Tujuan Konsultasi</Label>
                  <Popover open={openRoomCombo} onOpenChange={setOpenRoomCombo}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={openRoomCombo}
                        className="w-full justify-between"
                      >
                        {selectedRoom
                          ? consultationRooms.find((room) => room.id === selectedRoom)?.name
                          : "Pilih ruangan tujuan"}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-full p-0" align="start">
                      <Command>
                        <CommandInput placeholder="Cari ruangan..." />
                        <CommandEmpty>Ruangan tidak ditemukan.</CommandEmpty>
                        <CommandGroup>
                          <ScrollArea className="h-[200px]">
                            {consultationRooms.map((room) => (
                              <CommandItem
                                key={room.id}
                                value={`${room.name} ${room.code}`}
                                onSelect={() => {
                                  setSelectedRoom(room.id);
                                  setSelectedDoctor(null);
                                  setOrderItems([]);
                                  setOpenRoomCombo(false);
                                }}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    selectedRoom === room.id ? "opacity-100" : "opacity-0"
                                  )}
                                />
                                {room.name}
                              </CommandItem>
                            ))}
                          </ScrollArea>
                        </CommandGroup>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="space-y-2">
                  <Label>Dokter Tujuan (Opsional)</Label>
                  <Popover open={openDoctorCombo} onOpenChange={setOpenDoctorCombo}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={openDoctorCombo}
                        className="w-full justify-between"
                        disabled={!selectedRoom || loadingDoctors}
                      >
                        {loadingDoctors ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Memuat...
                          </>
                        ) : selectedDoctor ? (
                          doctors.find((doc) => doc.id === selectedDoctor)?.nama_lengkap
                        ) : (
                          "Pilih dokter (opsional)"
                        )}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-full p-0" align="start">
                      <Command>
                        <CommandInput placeholder="Cari dokter..." />
                        <CommandEmpty>Dokter tidak ditemukan.</CommandEmpty>
                        <CommandGroup>
                          <ScrollArea className="h-[200px]">
                            <CommandItem
                              value="semua-dokter"
                              onSelect={() => {
                                setSelectedDoctor(null);
                                setOpenDoctorCombo(false);
                              }}
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  selectedDoctor === null ? "opacity-100" : "opacity-0"
                                )}
                              />
                              Semua Dokter
                            </CommandItem>
                            {doctors.map((doctor) => (
                              <CommandItem
                                key={doctor.id}
                                value={doctor.nama_lengkap}
                                onSelect={() => {
                                  setSelectedDoctor(doctor.id);
                                  setOpenDoctorCombo(false);
                                }}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    selectedDoctor === doctor.id ? "opacity-100" : "opacity-0"
                                  )}
                                />
                                {doctor.nama_lengkap}
                              </CommandItem>
                            ))}
                          </ScrollArea>
                        </CommandGroup>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
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

              <div className="space-y-2 mt-4">
                <Label>Diagnosis Saat Ini</Label>
                <Textarea
                  placeholder="Tulis diagnosis saat ini"
                  value={diagnosis}
                  onChange={(e) => setDiagnosis(e.target.value)}
                  rows={2}
                />
              </div>

              <div className="space-y-2 mt-4">
                <Label>Alasan / Indikasi Konsultasi <span className="text-red-500">*</span></Label>
                <Textarea
                  placeholder="Jelaskan alasan konsultasi dan apa yang ingin dikonsultasikan"
                  value={clinicalNotes}
                  onChange={(e) => setClinicalNotes(e.target.value)}
                  rows={3}
                />
              </div>

              <Separator className="my-4" />

              {/* Procedure Selection */}
              <div className="space-y-2">
                <Label className="text-base font-medium">Pilih Jenis Konsultasi</Label>
                
                {!selectedRoom ? (
                  <div className="border-2 border-dashed rounded-lg p-8 text-center text-muted-foreground">
                    <UserRound className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>Pilih ruangan tujuan terlebih dahulu</p>
                  </div>
                ) : loadingProcedures ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin" />
                  </div>
                ) : procedures.length === 0 ? (
                  <div className="border-2 border-dashed rounded-lg p-8 text-center text-muted-foreground">
                    <Stethoscope className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>Tidak ada tindakan konsultasi tersedia untuk ruangan ini</p>
                    <p className="text-sm mt-1">Hubungi admin untuk menambahkan tindakan konsultasi</p>
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
                <div className="space-y-2 mt-4">
                  <Label className="text-base font-medium">Konsultasi Dipilih ({orderItems.length})</Label>
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
                  disabled={submitting || orderItems.length === 0 || !clinicalNotes.trim() || readOnly}
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
                      Kirim Order Konsultasi
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
                <Stethoscope className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Anda tidak memiliki akses untuk membuat order konsultasi</p>
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
                    <p>Belum ada riwayat order konsultasi</p>
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
