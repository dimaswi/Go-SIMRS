import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { usePermission } from "@/hooks/usePermission";
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
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Loader2,
  Plus,
  Trash2,
  Search,
  Pill,
  Clock,
  Send,
  Printer,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { roomsApi, medicineOrdersApi, getPharmacyRoomMedicines, printApi } from "@/lib/api";
import type { MedicineOrder, CreateMedicineOrderInput } from "@/lib/api";

interface MedicineOrderFormProps {
  visitId: number;
  registrationId: number;
  sourceRoomId: number;
  readOnly?: boolean;
}

interface OrderItem {
  medicine_id: number;
  medicine_name: string;
  medicine_code: string;
  quantity: number;
  unit: string;
  dosage: string;
  frequency: string;
  route: string;
  duration: string;
  instructions: string;
  available_stock: number;
}

interface PharmacyMedicine {
  id: number;
  room_id: number;
  medicine_id: number;
  medicine: {
    id: number;
    name: string;
    generic_name: string;
    code: string;
    unit: string;
    category: string;
    form: string;
    strength: string;
  };
  quantity: number;
  min_quantity: number;
}

const ORDER_STATUS_LABELS: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending: { label: "Menunggu", variant: "secondary" },
  reviewed: { label: "Sudah Ditelaah", variant: "default" },
  preparing: { label: "Disiapkan", variant: "default" },
  ready: { label: "Siap Ambil", variant: "default" },
  delivered: { label: "Sudah Diserahkan", variant: "default" },
  cancelled: { label: "Dibatalkan", variant: "destructive" },
  partial: { label: "Sebagian", variant: "outline" },
  returned: { label: "Ada Return", variant: "outline" },
};

// Collapsible Order Item Component
function OrderCollapsible({ order }: { order: MedicineOrder }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const { toast } = useToast();

  const handlePrintQueue = async () => {
    const queueId = order.pharmacy_visit?.room_queue?.id;
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
                <Badge variant={ORDER_STATUS_LABELS[order.status]?.variant || "secondary"} className="text-xs">
                  {ORDER_STATUS_LABELS[order.status]?.label || order.status}
                </Badge>
                {order.priority === "urgent" && (
                  <Badge variant="destructive" className="text-xs">Urgent</Badge>
                )}
                {order.pharmacy_visit?.room_queue && (
                  <Badge variant="outline" className="text-xs">
                    Antrian: {order.pharmacy_visit.room_queue.queue_number}
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {new Date(order.created_at).toLocaleString("id-ID")} • {order.pharmacy_room?.name} • {order.items?.filter(i => i.status !== "cancelled").length || 0} item
              </p>
            </div>
          </CollapsibleTrigger>
          {order.pharmacy_visit?.room_queue && (
            <Button variant="outline" size="sm" onClick={handlePrintQueue} disabled={isPrinting}>
              {isPrinting ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <Printer className="h-4 w-4 mr-1" />
              )}
              Cetak Antrian
            </Button>
          )}
        </div>
        <CollapsibleContent>
          <div className="mt-3 ml-6 space-y-3">
            {/* Order Info Table */}
            <div className="bg-muted/30 rounded-lg p-3">
              <table className="w-full text-sm">
                <tbody>
                  <tr>
                    <td className="py-1 text-muted-foreground w-1/3">Farmasi Tujuan</td>
                    <td className="py-1 font-medium">{order.pharmacy_room?.name || "-"}</td>
                  </tr>
                  <tr>
                    <td className="py-1 text-muted-foreground">Prioritas</td>
                    <td className="py-1">
                      <Badge variant={order.priority === "urgent" ? "destructive" : "outline"} className="text-xs">
                        {order.priority === "urgent" ? "Urgent" : "Normal"}
                      </Badge>
                    </td>
                  </tr>
                  <tr>
                    <td className="py-1 text-muted-foreground">Diagnosis</td>
                    <td className="py-1">{order.diagnosis || "-"}</td>
                  </tr>
                  <tr>
                    <td className="py-1 text-muted-foreground">Catatan</td>
                    <td className="py-1">{order.notes || "-"}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            
            {/* Order Items Table */}
            {order.items && order.items.length > 0 && (
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="py-2 px-3 text-left font-medium">Obat</th>
                      <th className="py-2 px-3 text-left font-medium">Dosis</th>
                      <th className="py-2 px-3 text-left font-medium">Frekuensi</th>
                      <th className="py-2 px-3 text-right font-medium">Jumlah</th>
                    </tr>
                  </thead>
                  <tbody>
                    {order.items
                      .filter((item) => item.status !== "cancelled")
                      .map((item, idx) => (
                      <tr key={idx} className="border-t">
                        <td className="py-2 px-3">
                          <p className="font-medium">{item.medicine?.name}</p>
                          {item.instructions && (
                            <p className="text-xs text-blue-600">"{item.instructions}"</p>
                          )}
                        </td>
                        <td className="py-2 px-3 text-muted-foreground">{item.dosage}</td>
                        <td className="py-2 px-3 text-muted-foreground">{item.frequency}</td>
                        <td className="py-2 px-3 text-right font-medium">{item.quantity} {item.unit}</td>
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

export function MedicineOrderForm({ visitId, readOnly = false }: MedicineOrderFormProps) {
  const { toast } = useToast();
  const { hasPermission } = usePermission();
  const [activeTab, setActiveTab] = useState<"form" | "history">("form");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [existingOrders, setExistingOrders] = useState<MedicineOrder[]>([]);
  const [pharmacyRooms, setPharmacyRooms] = useState<any[]>([]);
  const [selectedPharmacyRoom, setSelectedPharmacyRoom] = useState<number | null>(null);
  const [pharmacyMedicines, setPharmacyMedicines] = useState<PharmacyMedicine[]>([]);
  const [loadingMedicines, setLoadingMedicines] = useState(false);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [diagnosis, setDiagnosis] = useState("");
  const [notes, setNotes] = useState("");
  const [priority, setPriority] = useState("normal");
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [selectedMedicine, setSelectedMedicine] = useState<PharmacyMedicine | null>(null);
  const [newItem, setNewItem] = useState<Partial<OrderItem>>({
    quantity: 1,
    dosage: "",
    frequency: "",
    route: "oral",
    duration: "",
    instructions: "",
  });

  // Only pharmacy rooms with service_type 'farmasi' (exclude depo_farmasi)
  const isPharmacyRoom = (room: any) => 
    room.service_type === 'farmasi' && 
    room.room_type !== 'depo_farmasi' && 
    room.is_active;

  useEffect(() => {
    loadData();
  }, [visitId]);

  useEffect(() => {
    if (selectedPharmacyRoom) {
      loadPharmacyMedicines(selectedPharmacyRoom);
    }
  }, [selectedPharmacyRoom]);

  const loadData = async () => {
    setLoading(true);
    try {
      // Load existing orders for this visit
      const ordersRes = await medicineOrdersApi.getAll({ source_visit_id: visitId });
      const orders = ordersRes.data || [];
      
      // Recalculate status for orders that might have inconsistent status
      // This ensures order status matches item statuses
      for (const order of orders) {
        if (order.status !== "delivered" && order.status !== "cancelled") {
          try {
            await medicineOrdersApi.recalculate(order.id);
          } catch {
            // Ignore recalculate errors, just continue
          }
        }
      }
      
      // Reload orders after recalculation
      const updatedOrdersRes = await medicineOrdersApi.getAll({ source_visit_id: visitId });
      setExistingOrders(updatedOrdersRes.data || []);

      // Load pharmacy rooms - use high limit to get all rooms
      const roomsRes = await roomsApi.getAll({ limit: 1000, is_active: 'true' });
      const allRooms = roomsRes.data?.data || [];
      const pharmRooms = allRooms.filter(isPharmacyRoom);
      setPharmacyRooms(pharmRooms);

      // Auto-select first pharmacy room
      if (pharmRooms.length > 0 && !selectedPharmacyRoom) {
        setSelectedPharmacyRoom(pharmRooms[0].id);
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

  const loadPharmacyMedicines = async (roomId: number) => {
    setLoadingMedicines(true);
    try {
      const res = await getPharmacyRoomMedicines(roomId);
      setPharmacyMedicines(res.data || []);
    } catch (error) {
      console.error("Error loading pharmacy medicines:", error);
    } finally {
      setLoadingMedicines(false);
    }
  };

  const filteredMedicines = pharmacyMedicines.filter((pm) =>
    pm.medicine.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    pm.medicine.generic_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    pm.medicine.code.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSelectMedicine = (medicine: PharmacyMedicine) => {
    setSelectedMedicine(medicine);
    setNewItem({
      quantity: 1,
      dosage: "",
      frequency: "",
      route: "oral",
      duration: "",
      instructions: "",
    });
  };

  const handleAddItem = () => {
    if (!selectedMedicine) return;

    const item: OrderItem = {
      medicine_id: selectedMedicine.medicine.id,
      medicine_name: selectedMedicine.medicine.name,
      medicine_code: selectedMedicine.medicine.code,
      quantity: newItem.quantity || 1,
      unit: selectedMedicine.medicine.unit,
      dosage: newItem.dosage || "",
      frequency: newItem.frequency || "",
      route: newItem.route || "oral",
      duration: newItem.duration || "",
      instructions: newItem.instructions || "",
      available_stock: selectedMedicine.quantity,
    };

    setOrderItems([...orderItems, item]);
    setShowAddDialog(false);
    setSelectedMedicine(null);
    setSearchTerm("");
  };

  const handleRemoveItem = (index: number) => {
    const newItems = [...orderItems];
    newItems.splice(index, 1);
    setOrderItems(newItems);
  };

  const handleUpdateItemQuantity = (index: number, quantity: number) => {
    const newItems = [...orderItems];
    newItems[index].quantity = quantity;
    setOrderItems(newItems);
  };

  const handleSubmitOrder = async () => {
    if (!selectedPharmacyRoom) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Pilih ruang farmasi terlebih dahulu",
      });
      return;
    }

    if (orderItems.length === 0) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Tambahkan minimal 1 obat",
      });
      return;
    }

    setSubmitting(true);
    try {
      const input: CreateMedicineOrderInput = {
        source_visit_id: visitId,
        pharmacy_room_id: selectedPharmacyRoom,
        prescription_type: "regular",
        priority,
        diagnosis,
        notes,
        items: orderItems.map((item) => ({
          medicine_id: item.medicine_id,
          quantity: item.quantity,
          unit: item.unit,
          dosage: item.dosage,
          frequency: item.frequency,
          route: item.route,
          duration: item.duration,
          instructions: item.instructions,
        })),
      };

      const res = await medicineOrdersApi.create(input);

      toast({
        title: "Berhasil",
        description: `Order obat berhasil dibuat. Nomor Antrean Farmasi: ${res.data.pharmacy_visit?.room_queue?.queue_number || "-"}`,
      });

      // Reset form
      setOrderItems([]);
      setDiagnosis("");
      setNotes("");
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
        description: error.response?.data?.error || "Gagal membuat order obat",
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
    <Card>
      <CardHeader className="py-3 px-4">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <Pill className="h-4 w-4" />
          Order Obat
        </CardTitle>
        <CardDescription>
          Kelola pesanan obat untuk pasien
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
                <Pill className="h-4 w-4" />
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

        <div className="p-4">
            {/* Order Form Tab */}
            {activeTab === "form" && (
              <div className="space-y-4">
                <fieldset disabled={readOnly}>
          {/* Pharmacy Room Selection */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Ruang Farmasi Tujuan</Label>
              <Select
                value={selectedPharmacyRoom?.toString() || ""}
                onValueChange={(value) => setSelectedPharmacyRoom(Number(value))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Pilih ruang farmasi" />
                </SelectTrigger>
                <SelectContent>
                  {pharmacyRooms.map((room) => (
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
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Diagnosis Terkait</Label>
            <Input
              placeholder="Tulis diagnosis yang berkaitan dengan resep ini"
              value={diagnosis}
              onChange={(e) => setDiagnosis(e.target.value)}
            />
          </div>

          <Separator />

          {/* Order Items */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-base font-medium">Daftar Obat</Label>
              <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
                <DialogTrigger asChild>
                  <Button size="sm" disabled={!selectedPharmacyRoom || loadingMedicines || readOnly}>
                    <Plus className="h-4 w-4 mr-1" />
                    Tambah Obat
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
                  <DialogHeader>
                    <DialogTitle>Pilih Obat</DialogTitle>
                    <DialogDescription>
                      Pilih obat dari daftar yang tersedia di ruang farmasi
                    </DialogDescription>
                  </DialogHeader>
                  
                  {!selectedMedicine ? (
                    <>
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="Cari obat..."
                          className="pl-9"
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                        />
                      </div>
                      <ScrollArea className="flex-1 max-h-[400px] border rounded-md">
                        <div className="divide-y">
                          {loadingMedicines ? (
                            <div className="flex items-center justify-center py-8">
                              <Loader2 className="h-6 w-6 animate-spin" />
                            </div>
                          ) : filteredMedicines.length === 0 ? (
                            <div className="text-center py-8 text-muted-foreground">
                              {searchTerm ? "Tidak ada obat yang sesuai" : "Tidak ada obat tersedia"}
                            </div>
                          ) : (
                            filteredMedicines.map((pm) => (
                              <button
                                key={pm.id}
                                className="w-full p-3 text-left hover:bg-muted/50 flex items-center justify-between"
                                onClick={() => handleSelectMedicine(pm)}
                              >
                                <div>
                                  <p className="font-medium text-sm">{pm.medicine.name}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {pm.medicine.code} • {pm.medicine.form} • {pm.medicine.strength}
                                  </p>
                                </div>
                                <div className="text-right">
                                  <Badge variant={pm.quantity > pm.min_quantity ? "default" : "destructive"}>
                                    Stok: {pm.quantity}
                                  </Badge>
                                </div>
                              </button>
                            ))
                          )}
                        </div>
                      </ScrollArea>
                    </>
                  ) : (
                    <div className="space-y-4">
                      <div className="p-4 bg-muted/50 rounded-lg">
                        <p className="font-medium">{selectedMedicine.medicine.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {selectedMedicine.medicine.code} • {selectedMedicine.medicine.form} • {selectedMedicine.medicine.strength}
                        </p>
                        <Badge className="mt-2">Stok: {selectedMedicine.quantity} {selectedMedicine.medicine.unit}</Badge>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Jumlah</Label>
                          <Input
                            type="number"
                            min={1}
                            max={selectedMedicine.quantity}
                            value={newItem.quantity}
                            onChange={(e) => setNewItem({ ...newItem, quantity: Number(e.target.value) })}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Dosis (contoh: 3x1)</Label>
                          <Input
                            placeholder="3x1"
                            value={newItem.dosage}
                            onChange={(e) => setNewItem({ ...newItem, dosage: e.target.value })}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Frekuensi</Label>
                          <Select
                            value={newItem.frequency}
                            onValueChange={(value) => setNewItem({ ...newItem, frequency: value })}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Pilih frekuensi" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="1x1">1x1</SelectItem>
                              <SelectItem value="2x1">2x1</SelectItem>
                              <SelectItem value="3x1">3x1</SelectItem>
                              <SelectItem value="4x1">4x1</SelectItem>
                              <SelectItem value="1x sehari">1x sehari</SelectItem>
                              <SelectItem value="2x sehari">2x sehari</SelectItem>
                              <SelectItem value="3x sehari">3x sehari</SelectItem>
                              <SelectItem value="4x sehari">4x sehari</SelectItem>
                              <SelectItem value="setiap 4 jam">Setiap 4 jam</SelectItem>
                              <SelectItem value="setiap 6 jam">Setiap 6 jam</SelectItem>
                              <SelectItem value="setiap 8 jam">Setiap 8 jam</SelectItem>
                              <SelectItem value="setiap 12 jam">Setiap 12 jam</SelectItem>
                              <SelectItem value="bila perlu">Bila perlu (PRN)</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Rute</Label>
                          <Select
                            value={newItem.route}
                            onValueChange={(value) => setNewItem({ ...newItem, route: value })}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="oral">Oral</SelectItem>
                              <SelectItem value="sublingual">Sublingual</SelectItem>
                              <SelectItem value="topikal">Topikal</SelectItem>
                              <SelectItem value="intramuskular">Intramuskular (IM)</SelectItem>
                              <SelectItem value="intravena">Intravena (IV)</SelectItem>
                              <SelectItem value="subkutan">Subkutan (SC)</SelectItem>
                              <SelectItem value="rektal">Rektal</SelectItem>
                              <SelectItem value="inhalasi">Inhalasi</SelectItem>
                              <SelectItem value="nasal">Nasal</SelectItem>
                              <SelectItem value="otic">Otic (Telinga)</SelectItem>
                              <SelectItem value="ophthalmic">Ophthalmic (Mata)</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Durasi</Label>
                          <Input
                            placeholder="7 hari"
                            value={newItem.duration}
                            onChange={(e) => setNewItem({ ...newItem, duration: e.target.value })}
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>Instruksi Tambahan</Label>
                        <Textarea
                          placeholder="Contoh: Sesudah makan, diminum dengan air putih"
                          value={newItem.instructions}
                          onChange={(e) => setNewItem({ ...newItem, instructions: e.target.value })}
                        />
                      </div>
                    </div>
                  )}

                  <DialogFooter>
                    {selectedMedicine ? (
                      <>
                        <Button variant="outline" onClick={() => setSelectedMedicine(null)}>
                          Kembali
                        </Button>
                        <Button onClick={handleAddItem}>
                          <Plus className="h-4 w-4 mr-1" />
                          Tambahkan
                        </Button>
                      </>
                    ) : (
                      <Button variant="outline" onClick={() => setShowAddDialog(false)}>
                        Tutup
                      </Button>
                    )}
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>

            {orderItems.length === 0 ? (
              <div className="border-2 border-dashed rounded-lg p-8 text-center text-muted-foreground">
                <Pill className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>Belum ada obat ditambahkan</p>
                <p className="text-sm">Klik "Tambah Obat" untuk memulai</p>
              </div>
            ) : (
              <div className="border rounded-lg divide-y">
                {orderItems.map((item, index) => (
                  <div key={index} className="p-3 flex items-start gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{item.medicine_name}</span>
                        <Badge variant="outline" className="text-xs">{item.medicine_code}</Badge>
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {item.dosage && <span className="mr-2">Dosis: {item.dosage}</span>}
                        {item.frequency && <span className="mr-2">• {item.frequency}</span>}
                        {item.route && <span className="mr-2">• {item.route}</span>}
                        {item.duration && <span>• {item.duration}</span>}
                      </div>
                      {item.instructions && (
                        <p className="text-xs text-muted-foreground italic mt-1">{item.instructions}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        className="w-20 h-8 text-center"
                        min={1}
                        max={item.available_stock}
                        value={item.quantity}
                        onChange={(e) => handleUpdateItemQuantity(index, Number(e.target.value))}
                      />
                      <span className="text-sm text-muted-foreground">{item.unit}</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive"
                        onClick={() => handleRemoveItem(index)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label>Catatan untuk Farmasi</Label>
            <Textarea
              placeholder="Catatan tambahan untuk apoteker"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          {/* Submit Button */}
          <div className="flex justify-end pt-4">
            <Button
              size="lg"
              disabled={submitting || orderItems.length === 0 || !hasPermission('medicine_orders.create') || readOnly}
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
                  Kirim Order ke Farmasi
                </>
              )}
            </Button>
          </div>
                </fieldset>
              </div>
            )}

            {/* History Tab */}
            {activeTab === "history" && (
              <div className="space-y-2">
                {existingOrders.length > 0 ? (
                  <div className="divide-y border rounded-lg">
                    {existingOrders.map((order) => (
                      <OrderCollapsible key={order.id} order={order} />
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>Belum ada riwayat order obat</p>
                  </div>
                )}
              </div>
            )}
        </div>
      </CardContent>
    </Card>
  );
}
