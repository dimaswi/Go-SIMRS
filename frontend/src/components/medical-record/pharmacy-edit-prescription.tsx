import { useState, useEffect, useMemo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { usePermission } from "@/hooks/usePermission";
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
  Loader2,
  Pill,
  User,
  Plus,
  Pencil,
  Trash2,
  Search,
  AlertCircle,
} from "lucide-react";
import { medicineOrdersApi, getPharmacyRoomMedicines } from "@/lib/api";
import type { MedicineOrder, MedicineOrderItem } from "@/lib/api";

interface PharmacyEditPrescriptionProps {
  visitId: number;
  readOnly?: boolean;
}

const ORDER_STATUS_LABELS: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending: { label: "Menunggu Telaah", variant: "secondary" },
  reviewed: { label: "Sudah Ditelaah", variant: "default" },
  preparing: { label: "Disiapkan", variant: "default" },
  ready: { label: "Siap Diserahkan", variant: "default" },
  delivered: { label: "Sudah Diserahkan", variant: "default" },
  cancelled: { label: "Dibatalkan", variant: "destructive" },
  partial: { label: "Sebagian", variant: "outline" },
  returned: { label: "Ada Return", variant: "outline" },
};

const ROUTE_OPTIONS = [
  { value: "oral", label: "Oral" },
  { value: "sublingual", label: "Sublingual" },
  { value: "topikal", label: "Topikal" },
  { value: "intramuskular", label: "Intramuskular (IM)" },
  { value: "intravena", label: "Intravena (IV)" },
  { value: "subkutan", label: "Subkutan (SC)" },
  { value: "rektal", label: "Rektal" },
  { value: "inhalasi", label: "Inhalasi" },
  { value: "nasal", label: "Nasal" },
  { value: "otic", label: "Otic (Telinga)" },
  { value: "ophthalmic", label: "Ophthalmic (Mata)" },
];

const FREQUENCY_OPTIONS = [
  { value: "1x1", label: "1x1" },
  { value: "2x1", label: "2x1" },
  { value: "3x1", label: "3x1" },
  { value: "4x1", label: "4x1" },
  { value: "1x sehari", label: "1x sehari" },
  { value: "2x sehari", label: "2x sehari" },
  { value: "3x sehari", label: "3x sehari" },
  { value: "4x sehari", label: "4x sehari" },
  { value: "setiap 4 jam", label: "Setiap 4 jam" },
  { value: "setiap 6 jam", label: "Setiap 6 jam" },
  { value: "setiap 8 jam", label: "Setiap 8 jam" },
  { value: "setiap 12 jam", label: "Setiap 12 jam" },
  { value: "bila perlu", label: "Bila perlu (PRN)" },
];

interface RoomMedicine {
  id: number;
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

interface ItemFormData {
  medicine_id: number;
  medicineName: string;
  quantity: number;
  unit: string;
  dosage: string;
  frequency: string;
  route: string;
  duration: string;
  instructions: string;
  notes: string;
}

export function PharmacyEditPrescription({ visitId, readOnly = false }: PharmacyEditPrescriptionProps) {
  const { toast } = useToast();
  const { hasPermission } = usePermission();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [orders, setOrders] = useState<MedicineOrder[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<MedicineOrder | null>(null);
  const [roomMedicines, setRoomMedicines] = useState<RoomMedicine[]>([]);
  
  // Dialog states
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingItem, setEditingItem] = useState<MedicineOrderItem | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  
  // Form state
  const [itemForm, setItemForm] = useState<ItemFormData>({
    medicine_id: 0,
    medicineName: "",
    quantity: 1,
    unit: "",
    dosage: "",
    frequency: "",
    route: "oral",
    duration: "",
    instructions: "",
    notes: "",
  });
  const [deleteConfirmItem, setDeleteConfirmItem] = useState<MedicineOrderItem | null>(null);
  const [cancelConfirmOrder, setCancelConfirmOrder] = useState(false);

  useEffect(() => {
    loadOrders();
  }, [visitId]);

  useEffect(() => {
    if (selectedOrder?.pharmacy_room_id) {
      loadRoomMedicines(selectedOrder.pharmacy_room_id);
    }
  }, [selectedOrder?.pharmacy_room_id]);

  const loadOrders = async () => {
    setLoading(true);
    try {
      const res = await medicineOrdersApi.getAll({ pharmacy_visit_id: visitId });
      const data = res.data || [];
      setOrders(data);
      if (data.length > 0) {
        setSelectedOrder(data[0]);
      }
    } catch (error) {
      console.error("Error loading orders:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Gagal memuat data order",
      });
    } finally {
      setLoading(false);
    }
  };

  const loadRoomMedicines = async (roomId: number) => {
    try {
      const res = await getPharmacyRoomMedicines(roomId);
      setRoomMedicines(res.data || []);
    } catch (error) {
      console.error("Error loading room medicines:", error);
    }
  };

  const resetItemForm = useCallback(() => {
    setItemForm({
      medicine_id: 0,
      medicineName: "",
      quantity: 1,
      unit: "",
      dosage: "",
      frequency: "",
      route: "oral",
      duration: "",
      instructions: "",
      notes: "",
    });
    setSearchTerm("");
  }, []);

  const openAddDialog = () => {
    resetItemForm();
    setShowAddDialog(true);
  };

  const openEditDialog = (item: MedicineOrderItem) => {
    setEditingItem(item);
    setItemForm({
      medicine_id: item.medicine_id,
      medicineName: item.medicine?.name || "",
      quantity: item.quantity,
      unit: item.unit,
      dosage: item.dosage,
      frequency: item.frequency,
      route: item.route,
      duration: item.duration,
      instructions: item.instructions,
      notes: item.notes,
    });
    setShowEditDialog(true);
  };

  const handleAddItem = async () => {
    if (!selectedOrder) return;
    if (!itemForm.medicine_id) {
      toast({ variant: "destructive", title: "Pilih obat terlebih dahulu" });
      return;
    }
    if (itemForm.quantity < 1) {
      toast({ variant: "destructive", title: "Jumlah minimal 1" });
      return;
    }

    setSubmitting(true);
    try {
      await medicineOrdersApi.addItem(selectedOrder.id, {
        medicine_id: itemForm.medicine_id,
        quantity: itemForm.quantity,
        unit: itemForm.unit,
        dosage: itemForm.dosage,
        frequency: itemForm.frequency,
        route: itemForm.route,
        duration: itemForm.duration,
        instructions: itemForm.instructions,
        notes: itemForm.notes,
      });
      
      toast({ title: "Berhasil", description: "Obat berhasil ditambahkan" });
      setShowAddDialog(false);
      loadOrders();
      // Trigger refresh on final visit component
      window.dispatchEvent(new CustomEvent("refresh-print-options"));
      window.dispatchEvent(new CustomEvent("refresh-final-visit"));
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.response?.data?.error || "Gagal menambahkan obat",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateItem = async () => {
    if (!selectedOrder || !editingItem) return;

    setSubmitting(true);
    try {
      await medicineOrdersApi.updateItem(selectedOrder.id, editingItem.id!, {
        quantity: itemForm.quantity,
        unit: itemForm.unit,
        dosage: itemForm.dosage,
        frequency: itemForm.frequency,
        route: itemForm.route,
        duration: itemForm.duration,
        instructions: itemForm.instructions,
        notes: itemForm.notes,
      });
      
      toast({ title: "Berhasil", description: "Obat berhasil diperbarui" });
      setShowEditDialog(false);
      setEditingItem(null);
      loadOrders();
      // Trigger refresh on final visit component
      window.dispatchEvent(new CustomEvent("refresh-print-options"));
      window.dispatchEvent(new CustomEvent("refresh-final-visit"));
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.response?.data?.error || "Gagal memperbarui obat",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteItem = async (item: MedicineOrderItem) => {
    if (!selectedOrder) return;
    setDeleteConfirmItem(item);
  };

  const handleConfirmDeleteItem = async () => {
    const item = deleteConfirmItem;
    if (!item || !selectedOrder) return;
    setDeleteConfirmItem(null);

    try {
      await medicineOrdersApi.deleteItem(selectedOrder.id, item.id!);
      toast({ title: "Berhasil", description: "Obat berhasil dihapus" });
      loadOrders();
      // Trigger refresh on final visit component
      window.dispatchEvent(new CustomEvent("refresh-print-options"));
      window.dispatchEvent(new CustomEvent("refresh-final-visit"));
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.response?.data?.error || "Gagal menghapus obat",
      });
    }
  };

  const handleCancelOrder = async () => {
    if (!selectedOrder) return;
    setCancelConfirmOrder(true);
  };

  const handleConfirmCancelOrder = async () => {
    setCancelConfirmOrder(false);
    if (!selectedOrder) return;

    try {
      await medicineOrdersApi.cancel(selectedOrder.id);
      toast({ title: "Berhasil", description: "Order berhasil dibatalkan" });
      loadOrders();
      // Trigger refresh on final visit component
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

  const selectMedicine = (medicine: RoomMedicine["medicine"]) => {
    setItemForm(prev => ({
      ...prev,
      medicine_id: medicine.id,
      medicineName: medicine.name,
      unit: medicine.unit,
    }));
    setSearchTerm("");
  };

  const filteredMedicines = useMemo(() => {
    if (!searchTerm) return roomMedicines.slice(0, 10);
    const lower = searchTerm.toLowerCase();
    return roomMedicines.filter(rm => 
      rm.medicine.name.toLowerCase().includes(lower) ||
      rm.medicine.generic_name?.toLowerCase().includes(lower) ||
      rm.medicine.code?.toLowerCase().includes(lower)
    ).slice(0, 20);
  }, [roomMedicines, searchTerm]);

  if (loading) {
    return (
      <div>
        <div className="p-4">
          <div className="flex items-center justify-center py-8 gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-muted-foreground">Memuat data...</span>
          </div>
        </div>
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div>
        <div className="p-4">
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
            <Pill className="h-12 w-12 mb-4 opacity-50" />
            <p>Tidak ada order obat untuk visit ini</p>
          </div>
        </div>
      </div>
    );
  }

  const patient = selectedOrder?.source_visit?.registration?.patient;
  const canEdit = hasPermission('pharmacy.edit') && !readOnly;
  
  // Can only edit if order is pending or reviewed (before dispense started)
  const isEditable = selectedOrder?.status === 'pending' || selectedOrder?.status === 'reviewed';
  const canModify = canEdit && isEditable;
  
  // Filter out cancelled items
  const activeItems = selectedOrder?.items?.filter(item => item.status !== 'cancelled') || [];

  return (
    <>
      <div>
        <div className="space-y-4">
              {/* Order Selection if multiple */}
              {orders.length > 1 && (
                <div className="border rounded-lg p-3 bg-muted/30">
                  <Label className="text-sm font-semibold mb-2 block">Pilih Order</Label>
                  <div className="flex flex-wrap gap-2">
                    {orders.map((order) => (
                      <Button
                        key={order.id}
                        variant={selectedOrder?.id === order.id ? "default" : "outline"}
                        size="sm"
                        onClick={() => setSelectedOrder(order)}
                      >
                        {order.order_number}
                        <Badge variant={ORDER_STATUS_LABELS[order.status]?.variant || "secondary"} className="ml-2">
                          {ORDER_STATUS_LABELS[order.status]?.label || order.status}
                        </Badge>
                      </Button>
                    ))}
                  </div>
                </div>
              )}

              {selectedOrder && (
                <>
                  {/* Patient & Order Info */}
                  <div className="border rounded-lg">
                    <div className="p-3 border-b bg-muted/30">
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="text-sm font-semibold flex items-center gap-2">
                            <User className="h-4 w-4" />
                            {patient?.nama_lengkap || "Pasien"}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            No. RM: {patient?.no_rm} | Order: {selectedOrder.order_number}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={ORDER_STATUS_LABELS[selectedOrder.status]?.variant || "secondary"}>
                            {ORDER_STATUS_LABELS[selectedOrder.status]?.label || selectedOrder.status}
                          </Badge>
                          {/* Cancel Order Button - only show if order is not delivered/cancelled */}
                          {selectedOrder.status !== "delivered" && selectedOrder.status !== "cancelled" && !readOnly && hasPermission("pharmacy.edit") && (
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={handleCancelOrder}
                            >
                              <AlertCircle className="h-4 w-4 mr-1" />
                              Batalkan Order
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="p-3">
                      <table className="w-full text-sm">
                        <tbody>
                          <tr className="border-b">
                            <td className="py-2 text-muted-foreground w-1/4">Diagnosis</td>
                            <td className="py-2 font-medium">{selectedOrder.diagnosis || "-"}</td>
                          </tr>
                          <tr className="border-b">
                            <td className="py-2 text-muted-foreground">Dokter/Petugas</td>
                            <td className="py-2 font-medium">{selectedOrder.prescriber?.nama_lengkap || "-"}</td>
                          </tr>
                          <tr>
                            <td className="py-2 text-muted-foreground">Waktu Order</td>
                            <td className="py-2 font-medium">
                              {selectedOrder.created_at ? new Date(selectedOrder.created_at).toLocaleString("id-ID") : "-"}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Status Warning */}
                  {!isEditable && (
                    <div className="border rounded-lg p-3 bg-yellow-50 dark:bg-yellow-950/30 border-yellow-200 dark:border-yellow-800">
                      <div className="flex items-center gap-2 text-yellow-800 dark:text-yellow-200">
                        <AlertCircle className="h-4 w-4" />
                        <span className="text-sm font-medium">
                          Order sudah diproses, tidak dapat diedit
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Order Items */}
                  <div className="border rounded-lg">
                    <div className="p-3 border-b bg-muted/30 flex justify-between items-center">
                      <Label className="text-sm font-semibold flex items-center gap-2">
                        <Pill className="h-4 w-4" />
                        Daftar Obat ({activeItems.length} item)
                      </Label>
                      {canModify && (
                        <Button size="sm" onClick={openAddDialog}>
                          <Plus className="h-4 w-4 mr-1" />
                          Tambah Obat
                        </Button>
                      )}
                    </div>
                    <div className="p-0">
                      <table className="w-full text-sm">
                        <thead className="bg-muted/50">
                          <tr>
                            <th className="py-2 px-3 text-left font-medium">Nama Obat</th>
                            <th className="py-2 px-3 text-left font-medium">Dosis</th>
                            <th className="py-2 px-3 text-left font-medium">Frekuensi</th>
                            <th className="py-2 px-3 text-left font-medium">Rute</th>
                            <th className="py-2 px-3 text-right font-medium">Jumlah</th>
                            {canModify && <th className="py-2 px-3 text-center font-medium w-24">Aksi</th>}
                          </tr>
                        </thead>
                        <tbody>
                          {activeItems.length === 0 ? (
                            <tr>
                              <td colSpan={canModify ? 6 : 5} className="py-8 text-center text-muted-foreground">
                                Belum ada obat dalam resep
                              </td>
                            </tr>
                          ) : (
                            activeItems.map((item, index) => (
                              <tr key={item.id || index} className="border-b last:border-0">
                                <td className="py-3 px-3">
                                  <p className="font-medium">{item.medicine?.name || "Obat"}</p>
                                  <p className="text-xs text-muted-foreground">{item.medicine?.generic_name}</p>
                                  {item.instructions && (
                                    <p className="text-xs text-blue-600 mt-1">"{item.instructions}"</p>
                                  )}
                                </td>
                                <td className="py-3 px-3">{item.dosage || "-"}</td>
                                <td className="py-3 px-3">{item.frequency || "-"}</td>
                                <td className="py-3 px-3">{item.route || "-"}</td>
                                <td className="py-3 px-3 text-right font-medium">{item.quantity} {item.unit}</td>
                                {canModify && (
                                  <td className="py-3 px-3">
                                    <div className="flex justify-center gap-1">
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8"
                                        onClick={() => openEditDialog(item)}
                                        disabled={item.dispensed_qty > 0}
                                      >
                                        <Pencil className="h-4 w-4" />
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 text-destructive hover:text-destructive"
                                        onClick={() => handleDeleteItem(item)}
                                        disabled={item.dispensed_qty > 0}
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    </div>
                                  </td>
                                )}
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              )}
        </div>
      </div>

      {/* Add Item Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Tambah Obat</DialogTitle>
            <DialogDescription>
              Tambahkan obat baru ke dalam resep
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* Medicine Search */}
            <div className="space-y-2">
              <Label>Pilih Obat *</Label>
              {itemForm.medicine_id ? (
                <div className="flex items-center justify-between border rounded-lg p-3 bg-muted/30">
                  <div>
                    <p className="font-medium">{itemForm.medicineName}</p>
                    <p className="text-xs text-muted-foreground">Unit: {itemForm.unit}</p>
                  </div>
                  <Button variant="ghost" size="sm" onClick={resetItemForm}>
                    Ganti
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Cari obat..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                  <div className="border rounded-lg max-h-48 overflow-auto">
                    {filteredMedicines.length === 0 ? (
                      <div className="p-4 text-center text-muted-foreground text-sm">
                        {searchTerm ? "Obat tidak ditemukan" : "Ketik untuk mencari obat"}
                      </div>
                    ) : (
                      filteredMedicines.map((rm) => (
                        <div
                          key={rm.id}
                          className="p-2 hover:bg-muted cursor-pointer border-b last:border-0"
                          onClick={() => selectMedicine(rm.medicine)}
                        >
                          <p className="font-medium text-sm">{rm.medicine.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {rm.medicine.generic_name} • Stok: {rm.quantity} {rm.medicine.unit}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Jumlah</Label>
                <Input
                  type="number"
                  min={1}
                  value={itemForm.quantity}
                  onChange={(e) => setItemForm({ ...itemForm, quantity: parseInt(e.target.value) || 1 })}
                />
              </div>
              <div className="space-y-2">
                <Label>Dosis (contoh: 3x1)</Label>
                <Input
                  placeholder="3x1"
                  value={itemForm.dosage}
                  onChange={(e) => setItemForm({ ...itemForm, dosage: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Frekuensi</Label>
                <Select value={itemForm.frequency} onValueChange={(v) => setItemForm({ ...itemForm, frequency: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih frekuensi" />
                  </SelectTrigger>
                  <SelectContent>
                    {FREQUENCY_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Rute</Label>
                <Select value={itemForm.route} onValueChange={(v) => setItemForm({ ...itemForm, route: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROUTE_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Durasi</Label>
                <Input
                  placeholder="7 hari"
                  value={itemForm.duration}
                  onChange={(e) => setItemForm({ ...itemForm, duration: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Instruksi Tambahan</Label>
              <Textarea
                placeholder="Contoh: Sesudah makan, diminum dengan air putih"
                value={itemForm.instructions}
                onChange={(e) => setItemForm({ ...itemForm, instructions: e.target.value })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              Batal
            </Button>
            <Button onClick={handleAddItem} disabled={submitting || !itemForm.medicine_id}>
              {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Tambahkan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Item Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Obat</DialogTitle>
            <DialogDescription>
              Ubah detail obat: {editingItem?.medicine?.name}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Jumlah</Label>
                <Input
                  type="number"
                  min={1}
                  value={itemForm.quantity}
                  onChange={(e) => setItemForm({ ...itemForm, quantity: parseInt(e.target.value) || 1 })}
                />
              </div>
              <div className="space-y-2">
                <Label>Dosis (contoh: 3x1)</Label>
                <Input
                  placeholder="3x1"
                  value={itemForm.dosage}
                  onChange={(e) => setItemForm({ ...itemForm, dosage: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Frekuensi</Label>
                <Select value={itemForm.frequency} onValueChange={(v) => setItemForm({ ...itemForm, frequency: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih frekuensi" />
                  </SelectTrigger>
                  <SelectContent>
                    {FREQUENCY_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Rute</Label>
                <Select value={itemForm.route} onValueChange={(v) => setItemForm({ ...itemForm, route: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROUTE_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Durasi</Label>
                <Input
                  placeholder="7 hari"
                  value={itemForm.duration}
                  onChange={(e) => setItemForm({ ...itemForm, duration: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Instruksi Tambahan</Label>
              <Textarea
                placeholder="Contoh: Sesudah makan, diminum dengan air putih"
                value={itemForm.instructions}
                onChange={(e) => setItemForm({ ...itemForm, instructions: e.target.value })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowEditDialog(false); setEditingItem(null); }}>
              Batal
            </Button>
            <Button onClick={handleUpdateItem} disabled={submitting}>
              {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Item Confirmation Dialog */}
      <AlertDialog open={!!deleteConfirmItem} onOpenChange={(open) => !open && setDeleteConfirmItem(null)}>
        <AlertDialogContent className="max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-sm">Hapus Obat?</AlertDialogTitle>
            <AlertDialogDescription className="text-xs">
              Yakin ingin menghapus {deleteConfirmItem?.medicine?.name}?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="h-8 text-xs">Batal</AlertDialogCancel>
            <AlertDialogAction
              className="h-8 text-xs bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleConfirmDeleteItem}
            >
              Ya, Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Cancel Order Confirmation Dialog */}
      <AlertDialog open={cancelConfirmOrder} onOpenChange={setCancelConfirmOrder}>
        <AlertDialogContent className="max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-sm">Batalkan Order?</AlertDialogTitle>
            <AlertDialogDescription className="text-xs">
              Yakin ingin membatalkan order {selectedOrder?.order_number}? Semua item akan dibatalkan.
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
    </>
  );
}
