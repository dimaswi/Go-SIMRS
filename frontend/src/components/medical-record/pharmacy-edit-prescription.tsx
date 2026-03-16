import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Combobox } from "@/components/ui/combobox";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Loader2,
  Save,
  Pill,
  User,
  Plus,
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

const formatRupiah = (value: number) => {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Number.isFinite(value) ? value : 0);
};

const getUnitPrice = (item: any): number => {
  return Number(item?.unit_price ?? item?.price ?? item?.medicine?.selling_price ?? 0);
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
  { value: "setiap 4 jam", label: "setiap 4 jam" },
  { value: "setiap 6 jam", label: "setiap 6 jam" },
  { value: "setiap 8 jam", label: "setiap 8 jam" },
  { value: "setiap 12 jam", label: "setiap 12 jam" },
  { value: "bila perlu", label: "bila perlu" },
];

const INSTRUCTION_OPTIONS = [
  "Sebelum makan",
  "Sesudah makan",
  "Bersama makan",
  "Pagi hari",
  "Malam hari",
  "Pagi dan malam",
  "Saat perut kosong",
  "Sebelum tidur",
  "Bila perlu",
  "Bila demam",
  "Bila nyeri",
  "Bila mual",
  "Dikunyah",
  "Diteteskan",
  "Dioleskan",
  "Dikocok dulu",
  "Dilarutkan dulu",
].map((option) => ({ value: option, label: option }));

interface RoomMedicine {
  id: number;
  medicine_id: number;
  unit_price?: number;
  price?: number;
  selling_price?: number;
  medicine: {
    id: number;
    name: string;
    generic_name: string;
    code: string;
    unit: string;
    category: string;
    form: string;
    strength: string;
    selling_price?: number;
    price?: number;
    unit_price?: number;
  };
  quantity: number;
  min_quantity: number;
}

interface RowEditData {
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
  const [searchTerm, setSearchTerm] = useState("");

  const [deleteConfirmItem, setDeleteConfirmItem] = useState<MedicineOrderItem | null>(null);
  const [cancelConfirmOrder, setCancelConfirmOrder] = useState(false);
  const [rowEdits, setRowEdits] = useState<Record<number, RowEditData>>({});
  const [savingRowId, setSavingRowId] = useState<number | null>(null);

  useEffect(() => {
    loadOrders();
  }, [visitId]);

  useEffect(() => {
    if (selectedOrder?.pharmacy_room_id) {
      loadRoomMedicines(selectedOrder.pharmacy_room_id);
    }
  }, [selectedOrder?.pharmacy_room_id]);

  useEffect(() => {
    const next: Record<number, RowEditData> = {};
    (selectedOrder?.items || [])
      .filter((item) => item.status !== "cancelled")
      .forEach((item, index) => {
        const key = item.id ?? -(index + 1);
        next[key] = {
          quantity: Number(item.quantity || 1),
          unit: item.unit || "",
          dosage: item.dosage || "",
          frequency: item.frequency || "",
          route: item.route || "oral",
          duration: item.duration || "",
          instructions: item.instructions || "",
          notes: item.notes || "",
        };
      });
    setRowEdits(next);
  }, [selectedOrder]);

  const loadOrders = async (silent = false) => {
    if (!silent) {
      setLoading(true);
    }
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
      if (!silent) {
        setLoading(false);
      }
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

  const openAddDialog = () => {
    setSearchTerm("");
    setShowAddDialog(true);
  };

  const handleAddItemFromMedicine = async (roomMedicine: RoomMedicine) => {
    if (!selectedOrder) return;

    setSubmitting(true);
    try {
      const medicine = roomMedicine.medicine;
      await medicineOrdersApi.addItem(selectedOrder.id, {
        medicine_id: medicine.id,
        quantity: 1,
        unit: medicine.unit,
        dosage: medicine.strength || "-",
        frequency: "1x sehari",
        route: "oral",
        duration: "1 hari",
        instructions: "Sesudah makan",
        notes: "",
      });
      
      toast({ title: "Berhasil", description: "Obat berhasil ditambahkan" });
      setShowAddDialog(false);
      setSearchTerm("");
      await loadOrders(true);
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
      await loadOrders(true);
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

  const filteredMedicines = useMemo(() => {
    const selectedMedicineIds = new Set(
      (selectedOrder?.items || [])
        .filter((item) => item.status !== "cancelled")
        .map((item) => item.medicine_id)
    );

    if (!searchTerm) {
      return roomMedicines
        .filter((rm) => !selectedMedicineIds.has(rm.medicine.id))
        .slice(0, 10);
    }
    const lower = searchTerm.toLowerCase();
    return roomMedicines.filter(rm =>
      !selectedMedicineIds.has(rm.medicine.id) && (
        rm.medicine.name.toLowerCase().includes(lower) ||
        rm.medicine.generic_name?.toLowerCase().includes(lower) ||
        rm.medicine.code?.toLowerCase().includes(lower)
      )
    ).slice(0, 20);
  }, [roomMedicines, searchTerm, selectedOrder?.items]);

  const updateRowEdit = (rowKey: number, field: keyof RowEditData, value: string | number) => {
    setRowEdits((prev) => ({
      ...prev,
      [rowKey]: {
        ...(prev[rowKey] || {
          quantity: 1,
          unit: "",
          dosage: "",
          frequency: "",
          route: "oral",
          duration: "",
          instructions: "",
          notes: "",
        }),
        [field]: value,
      },
    }));
  };

  const handleSaveRow = async (item: MedicineOrderItem, rowKey: number) => {
    if (!selectedOrder || !item.id) return;
    const row = rowEdits[rowKey];
    if (!row) return;

    if (!row.quantity || row.quantity < 1) {
      toast({ variant: "destructive", title: "Jumlah minimal 1" });
      return;
    }

    const availableStock = roomMedicines.find((rm) => rm.medicine.id === item.medicine_id)?.quantity || 0;
    if (availableStock > 0 && row.quantity > availableStock) {
      toast({ variant: "destructive", title: "Jumlah melebihi stok tersedia" });
      return;
    }
    if (!row.dosage?.trim()) {
      toast({ variant: "destructive", title: "Dosis wajib diisi" });
      return;
    }
    if (!row.frequency?.trim()) {
      toast({ variant: "destructive", title: "Frekuensi wajib diisi" });
      return;
    }
    if (!row.route?.trim()) {
      toast({ variant: "destructive", title: "Rute wajib diisi" });
      return;
    }
    if (!row.duration?.trim()) {
      toast({ variant: "destructive", title: "Durasi wajib diisi" });
      return;
    }
    if (!row.instructions?.trim()) {
      toast({ variant: "destructive", title: "Cara pemakaian wajib diisi" });
      return;
    }

    setSavingRowId(item.id);
    try {
      await medicineOrdersApi.updateItem(selectedOrder.id, item.id, {
        quantity: row.quantity,
        unit: row.unit,
        dosage: row.dosage,
        frequency: row.frequency,
        route: row.route,
        duration: row.duration,
        instructions: row.instructions,
        notes: row.notes,
      });

      toast({ title: "Berhasil", description: "Obat berhasil diperbarui" });
      await loadOrders();
      window.dispatchEvent(new CustomEvent("refresh-print-options"));
      window.dispatchEvent(new CustomEvent("refresh-final-visit"));
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.response?.data?.error || "Gagal memperbarui obat",
      });
    } finally {
      setSavingRowId(null);
    }
  };

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
  const grandTotal = activeItems.reduce((total, item) => {
    return total + getUnitPrice(item) * Number(item.quantity || 0);
  }, 0);

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
                      <table className="w-full min-w-[640px] text-sm">
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
                      <table className="w-full min-w-[640px] text-sm">
                        <thead className="bg-muted/50">
                          <tr>
                            <th className="py-1.5 px-2 text-left font-medium">Nama Obat</th>
                            <th className="py-1.5 px-2 text-left font-medium">Jumlah*</th>
                            <th className="py-1.5 px-2 text-left font-medium">Dosis*</th>
                            <th className="py-1.5 px-2 text-left font-medium">Frekuensi*</th>
                            <th className="py-1.5 px-2 text-left font-medium">Rute*</th>
                            <th className="py-1.5 px-2 text-left font-medium">Durasi*</th>
                            <th className="py-1.5 px-2 text-left font-medium">Cara Pakai*</th>
                            <th className="py-1.5 px-2 text-right font-medium">Harga</th>
                            {canModify && <th className="py-1.5 px-2 text-center font-medium w-24">Aksi</th>}
                          </tr>
                        </thead>
                        <tbody>
                          {activeItems.length === 0 ? (
                            <tr>
                              <td colSpan={canModify ? 9 : 8} className="py-8 text-center text-muted-foreground">
                                Belum ada obat dalam resep
                              </td>
                            </tr>
                          ) : (
                            activeItems.map((item, index) => {
                              const rowKey = item.id ?? -(index + 1);
                              const row = rowEdits[rowKey] || {
                                quantity: Number(item.quantity || 1),
                                unit: item.unit || "",
                                dosage: item.dosage || "",
                                frequency: item.frequency || "",
                                route: item.route || "oral",
                                duration: item.duration || "",
                                instructions: item.instructions || "",
                                notes: item.notes || "",
                              };
                              const availableStock = roomMedicines.find((rm) => rm.medicine.id === item.medicine_id)?.quantity || 0;
                              const unitPrice = getUnitPrice(item);

                              return (
                                <tr key={item.id || index} className="border-b last:border-0 align-top">
                                  <td className="py-2 px-2">
                                    <p className="font-medium">{item.medicine?.name || "Obat"}</p>
                                    <p className="text-xs text-muted-foreground">
                                      {item.medicine?.code || "-"} • Stok {availableStock} {item.unit}
                                    </p>
                                  </td>
                                  <td className="py-2 px-2">
                                    {canModify ? (
                                      <>
                                        <Input
                                          type="number"
                                          min={1}
                                          max={availableStock > 0 ? availableStock : undefined}
                                          value={row.quantity}
                                          onChange={(e) => updateRowEdit(rowKey, "quantity", Number(e.target.value) || 1)}
                                          className="h-8"
                                          disabled={item.dispensed_qty > 0}
                                        />
                                        {availableStock > 0 && (
                                          <p className="text-[10px] text-muted-foreground mt-1">Maks {availableStock}</p>
                                        )}
                                      </>
                                    ) : (
                                      <span className="font-medium">{item.quantity} {item.unit}</span>
                                    )}
                                  </td>
                                  <td className="py-2 px-2">
                                    {canModify ? (
                                      <Input
                                        value={row.dosage}
                                        onChange={(e) => updateRowEdit(rowKey, "dosage", e.target.value)}
                                        className="h-8"
                                        disabled={item.dispensed_qty > 0}
                                      />
                                    ) : (
                                      item.dosage || "-"
                                    )}
                                  </td>
                                  <td className="py-2 px-2">
                                    {canModify ? (
                                      <Select
                                        value={row.frequency}
                                        onValueChange={(value) => updateRowEdit(rowKey, "frequency", value)}
                                        disabled={item.dispensed_qty > 0}
                                      >
                                        <SelectTrigger className="h-8">
                                          <SelectValue placeholder="Pilih" />
                                        </SelectTrigger>
                                        <SelectContent>
                                          {FREQUENCY_OPTIONS.map((opt) => (
                                            <SelectItem key={opt.value} value={opt.value}>
                                              {opt.label}
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                    ) : (
                                      item.frequency || "-"
                                    )}
                                  </td>
                                  <td className="py-2 px-2">
                                    {canModify ? (
                                      <Select
                                        value={row.route}
                                        onValueChange={(value) => updateRowEdit(rowKey, "route", value)}
                                        disabled={item.dispensed_qty > 0}
                                      >
                                        <SelectTrigger className="h-8">
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
                                    ) : (
                                      item.route || "-"
                                    )}
                                  </td>
                                  <td className="py-2 px-2">
                                    {canModify ? (
                                      <Input
                                        value={row.duration}
                                        onChange={(e) => updateRowEdit(rowKey, "duration", e.target.value)}
                                        className="h-8"
                                        disabled={item.dispensed_qty > 0}
                                      />
                                    ) : (
                                      item.duration || "-"
                                    )}
                                  </td>
                                  <td className="py-2 px-2 min-w-[220px]">
                                    {canModify ? (
                                      <Combobox
                                        options={INSTRUCTION_OPTIONS}
                                        value={row.instructions}
                                        onValueChange={(value) => updateRowEdit(rowKey, "instructions", value)}
                                        placeholder="Pilih cara pemakaian"
                                        searchPlaceholder="Cari cara pemakaian..."
                                        emptyText="Cara pemakaian tidak ditemukan"
                                        className="w-full"
                                      />
                                    ) : (
                                      item.instructions || item.notes || "-"
                                    )}
                                  </td>
                                  <td className="py-2 px-2 text-right">
                                    <p className="text-xs text-muted-foreground">@ {formatRupiah(unitPrice)}</p>
                                    <p className="text-sm font-semibold leading-4">{formatRupiah(Number(row.quantity || 0) * unitPrice)}</p>
                                  </td>
                                  {canModify && (
                                    <td className="py-2 px-2">
                                      <div className="flex justify-center gap-1">
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          className="h-8 w-8 text-primary"
                                          onClick={() => handleSaveRow(item, rowKey)}
                                          disabled={item.dispensed_qty > 0 || savingRowId === item.id}
                                        >
                                          {savingRowId === item.id ? (
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                          ) : (
                                            <Save className="h-4 w-4" />
                                          )}
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
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
                    <div className="border-t bg-primary/5 px-3 py-2 flex items-center justify-end">
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground">Grand Total</p>
                        <p className="text-base font-semibold text-primary">{formatRupiah(grandTotal)}</p>
                      </div>
                    </div>
                  </div>
                </>
              )}
        </div>
      </div>

      {/* Add Item Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="w-[calc(100vw-1rem)] sm:max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Pilih Obat</DialogTitle>
            <DialogDescription>
              Pilih obat, lalu ubah detail resep langsung di row tabel
            </DialogDescription>
          </DialogHeader>
          
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
              {filteredMedicines.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  {searchTerm ? "Tidak ada obat yang sesuai" : "Semua obat yang tersedia sudah dipilih"}
                </div>
              ) : (
                filteredMedicines.map((rm) => (
                  <button
                    key={rm.id}
                    type="button"
                    className="w-full p-3 hover:bg-muted/50 flex items-center justify-between gap-3 text-left"
                    onClick={() => handleAddItemFromMedicine(rm)}
                    disabled={submitting}
                  >
                    <div>
                      <p className="font-medium text-sm">{rm.medicine.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {rm.medicine.code} • {rm.medicine.form} • {rm.medicine.strength}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={rm.quantity > rm.min_quantity ? "default" : "destructive"}>
                        Stok: {rm.quantity}
                      </Badge>
                    </div>
                  </button>
                ))
              )}
            </div>
          </ScrollArea>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              Tutup
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
