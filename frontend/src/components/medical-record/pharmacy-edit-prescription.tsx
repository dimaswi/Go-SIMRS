import { useEffect, useMemo, useState } from "react";
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
  Clock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { medicineOrdersApi, getPharmacyRoomMedicines } from "@/lib/api";
import { medicinesApi } from "@/lib/api/medicines";
import type { Medicine } from "@/lib/api/medicines";
import type { MedicineOrder, MedicineOrderItem } from "@/lib/api";

interface PharmacyEditAdapter {
  getAll: typeof medicineOrdersApi.getAll;
  addItem: typeof medicineOrdersApi.addItem;
  updateItem: typeof medicineOrdersApi.updateItem;
  deleteItem: typeof medicineOrdersApi.deleteItem;
  cancel: typeof medicineOrdersApi.cancel;
  create?: (data?: { fake_date?: string }) => Promise<{ data: MedicineOrder }>;
}

interface PharmacyEditPrescriptionProps {
  visitId: number;
  readOnly?: boolean;
  rmDuplicateMode?: boolean;
  apiAdapter?: PharmacyEditAdapter;
  duplicateDoctorOptions?: { id: number; name: string }[];
  onUpdateDuplicateOrderMeta?: (
    runtimeOrderId: number,
    updates: { fake_date?: string; doctor_name?: string },
  ) => void;
}

const ORDER_STATUS_LABELS: Record<
  string,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline" }
> = {
  pending: { label: "Menunggu Telaah", variant: "secondary" },
  reviewed: { label: "Sudah Ditelaah", variant: "default" },
  preparing: { label: "Disiapkan", variant: "default" },
  ready: { label: "Siap Diserahkan", variant: "default" },
  delivered: { label: "Sudah Diserahkan", variant: "default" },
  cancelled: { label: "Dibatalkan", variant: "destructive" },
  partial: { label: "Sebagian", variant: "outline" },
  returned: { label: "Ada Return", variant: "outline" },
  in_progress: { label: "Dikerjakan", variant: "default" },
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
    generic_name?: string;
    code: string;
    unit: string;
    category?: string;
    form?: string;
    strength?: string;
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

const replaceOrderInList = (orders: MedicineOrder[], nextOrder: MedicineOrder) => {
  const existingIndex = orders.findIndex((order) => order.id === nextOrder.id);
  if (existingIndex < 0) {
    return [...orders, nextOrder];
  }
  return orders.map((order, index) => (index === existingIndex ? nextOrder : order));
};

const getStatusDotClass = (status?: string) => {
  switch (status) {
    case "delivered":
    case "ready":
    case "reviewed":
      return "bg-emerald-500";
    case "preparing":
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

export function PharmacyEditPrescription({
  visitId,
  readOnly = false,
  rmDuplicateMode = false,
  apiAdapter,
  duplicateDoctorOptions = [],
  onUpdateDuplicateOrderMeta,
}: PharmacyEditPrescriptionProps) {
  const { toast } = useToast();
  const { hasPermission } = usePermission();
  const orderApi = apiAdapter || medicineOrdersApi;

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [orders, setOrders] = useState<MedicineOrder[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<MedicineOrder | null>(null);
  const [roomMedicines, setRoomMedicines] = useState<RoomMedicine[]>([]);
  const [searchResults, setSearchResults] = useState<RoomMedicine[]>([]);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [deleteConfirmItem, setDeleteConfirmItem] = useState<MedicineOrderItem | null>(null);
  const [cancelConfirmOrder, setCancelConfirmOrder] = useState(false);
  const [rowEdits, setRowEdits] = useState<Record<number, RowEditData>>({});
  const [savingRowId, setSavingRowId] = useState<number | null>(null);
  const [doctorModalOpen, setDoctorModalOpen] = useState(false);
  const [dateModalOpen, setDateModalOpen] = useState(false);
  const [orderPickerOpen, setOrderPickerOpen] = useState(false);
  const [doctorSearch, setDoctorSearch] = useState("");
  const [pendingDoctorName, setPendingDoctorName] = useState("");
  const [pendingOrderDate, setPendingOrderDate] = useState("");

  const applyLocalOrderUpdate = (nextOrder: MedicineOrder) => {
    setOrders((prev) => replaceOrderInList(prev, nextOrder));
    setSelectedOrder((prev) => (prev?.id === nextOrder.id ? nextOrder : prev));
  };

  const removeLocalOrder = (orderId: number) => {
    setOrders((prev) => {
      const nextOrders = prev.filter((order) => order.id !== orderId);
      setSelectedOrder((prevSelected) => {
        if (prevSelected?.id !== orderId) {
          return prevSelected;
        }
        return nextOrders.find((order) => order.status !== "cancelled") || nextOrders[0] || null;
      });
      return nextOrders;
    });
  };

  useEffect(() => {
    loadOrders();
  }, [visitId, rmDuplicateMode]);

  useEffect(() => {
    const handleRefreshOrders = () => {
      loadOrders(true, selectedOrder?.id);
    };

    const handleOpenOrderPicker = () => {
      if (!rmDuplicateMode || orders.length <= 1) return;
      setOrderPickerOpen(true);
    };

    const handleCreateOrder = () => {
      if (!rmDuplicateMode) return;
      void createDuplicateOrder();
    };

    if (!rmDuplicateMode) {
      window.addEventListener("refresh-final-visit", handleRefreshOrders);
      window.addEventListener("refresh-print-options", handleRefreshOrders);
    }
    window.addEventListener("rm-duplicate-open-pharmacy-order-picker", handleOpenOrderPicker);
    window.addEventListener("rm-duplicate-create-pharmacy-order", handleCreateOrder);

    return () => {
      if (!rmDuplicateMode) {
        window.removeEventListener("refresh-final-visit", handleRefreshOrders);
        window.removeEventListener("refresh-print-options", handleRefreshOrders);
      }
      window.removeEventListener("rm-duplicate-open-pharmacy-order-picker", handleOpenOrderPicker);
      window.removeEventListener("rm-duplicate-create-pharmacy-order", handleCreateOrder);
    };
  }, [orders.length, rmDuplicateMode, selectedOrder?.id]);

  useEffect(() => {
    if (!selectedOrder?.pharmacy_room_id || rmDuplicateMode) return;
    loadRoomMedicines(selectedOrder.pharmacy_room_id);
  }, [selectedOrder?.pharmacy_room_id, rmDuplicateMode]);

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
    setPendingDoctorName(selectedOrder?.prescriber?.nama_lengkap || "");
    setPendingOrderDate((selectedOrder?.created_at || "").replace(" ", "T").slice(0, 16));
    setDoctorSearch("");
  }, [selectedOrder]);

  useEffect(() => {
    if (!showAddDialog) return;
    let active = true;

    const loadSearchResults = async () => {
      if (!rmDuplicateMode) return;
      try {
        const res = await medicinesApi.getAll({
          search: searchTerm || undefined,
          is_active: true,
          limit: searchTerm ? 20 : 10,
        });
        const rows = res.data?.data || res.data || [];
        const mapped: RoomMedicine[] = rows.map((medicine: Medicine) => ({
          id: medicine.id,
          medicine_id: medicine.id,
          unit_price: medicine.selling_price,
          selling_price: medicine.selling_price,
          medicine: {
            id: medicine.id,
            name: medicine.name,
            generic_name: medicine.generic_name,
            code: medicine.code,
            unit: medicine.unit,
            category: medicine.category,
            form: medicine.form,
            strength: medicine.strength,
            selling_price: medicine.selling_price,
            unit_price: medicine.selling_price,
          },
          quantity: medicine.current_stock || 0,
          min_quantity: 0,
        }));
        if (active) setSearchResults(mapped);
      } catch {
        if (active) setSearchResults([]);
      }
    };

    void loadSearchResults();
    return () => {
      active = false;
    };
  }, [showAddDialog, searchTerm, rmDuplicateMode]);

  const loadOrders = async (silent = false, preferredOrderId?: number) => {
    if (!silent) {
      setLoading(true);
    }
    try {
      const res = await orderApi.getAll(
        rmDuplicateMode ? { source_visit_id: visitId } : { pharmacy_visit_id: visitId },
      );
      const data = res.data || [];
      setOrders(data);
      if (data.length > 0) {
        const activeOrderId = preferredOrderId ?? selectedOrder?.id;
        const nextOrder =
          data.find((order) => order.id === activeOrderId) ||
          data.find((order) => order.status !== "cancelled") ||
          data[0];
        setSelectedOrder(nextOrder);
      } else {
        setSelectedOrder(null);
      }
    } catch (error) {
      console.error("Error loading orders:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Gagal memuat data order resep",
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
      setRoomMedicines([]);
    }
  };

  const createDuplicateOrder = async () => {
    if (!rmDuplicateMode || !apiAdapter?.create) return;
    setSubmitting(true);
    try {
      const res = await apiAdapter.create({
        fake_date: new Date().toISOString().slice(0, 19),
      });
      const createdOrder = res.data;
      setOrders((prev) => {
        const existingIndex = prev.findIndex((order) => order.id === createdOrder.id);
        if (existingIndex >= 0) {
          return prev.map((order, index) =>
            index === existingIndex ? createdOrder : order,
          );
        }
        return [...prev, createdOrder];
      });
      setSelectedOrder(createdOrder);
      setOrderPickerOpen(false);
      toast({ title: "Berhasil", description: "Resep baru berhasil ditambahkan" });
      if (!rmDuplicateMode) {
        window.dispatchEvent(new CustomEvent("refresh-print-options"));
        window.dispatchEvent(new CustomEvent("refresh-final-visit"));
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error?.response?.data?.error || "Gagal menambah resep baru",
      });
    } finally {
      setSubmitting(false);
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
      const res = await orderApi.addItem(selectedOrder.id, {
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

      if (rmDuplicateMode) {
        const addedItem = res.data;
        applyLocalOrderUpdate({
          ...selectedOrder,
          items: [...(selectedOrder.items || []), addedItem],
        });
      }

      toast({ title: "Berhasil", description: "Obat berhasil ditambahkan" });
      setShowAddDialog(false);
      setSearchTerm("");
      if (!rmDuplicateMode) {
        await loadOrders(true, selectedOrder.id);
        window.dispatchEvent(new CustomEvent("refresh-print-options"));
        window.dispatchEvent(new CustomEvent("refresh-final-visit"));
      }
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

  const handleConfirmDeleteItem = async () => {
    const item = deleteConfirmItem;
    if (!item || !selectedOrder || !item.id) return;
    setDeleteConfirmItem(null);

    try {
      await orderApi.deleteItem(selectedOrder.id, item.id);

      if (rmDuplicateMode) {
        applyLocalOrderUpdate({
          ...selectedOrder,
          items: (selectedOrder.items || []).filter((candidate) => candidate.id !== item.id),
        });
      }

      toast({ title: "Berhasil", description: "Obat berhasil dihapus" });
      if (!rmDuplicateMode) {
        await loadOrders(true, selectedOrder.id);
        window.dispatchEvent(new CustomEvent("refresh-print-options"));
        window.dispatchEvent(new CustomEvent("refresh-final-visit"));
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.response?.data?.error || "Gagal menghapus obat",
      });
    }
  };

  const handleConfirmCancelOrder = async () => {
    setCancelConfirmOrder(false);
    if (!selectedOrder) return;

    try {
      await orderApi.cancel(selectedOrder.id);

      if (rmDuplicateMode) {
        removeLocalOrder(selectedOrder.id);
      }

      toast({
        title: "Berhasil",
        description: rmDuplicateMode ? "Resep berhasil dihapus" : "Order berhasil dibatalkan",
      });
      if (!rmDuplicateMode) {
        await loadOrders(true);
        window.dispatchEvent(new CustomEvent("refresh-print-options"));
        window.dispatchEvent(new CustomEvent("refresh-final-visit"));
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.response?.data?.error || "Gagal membatalkan resep",
      });
    }
  };

  const filteredMedicines = useMemo(() => {
    const selectedMedicineIds = new Set(
      (selectedOrder?.items || [])
        .filter((item) => item.status !== "cancelled")
        .map((item) => item.medicine_id),
    );

    const source = rmDuplicateMode ? searchResults : roomMedicines;
    if (!rmDuplicateMode && !searchTerm) {
      return source.filter((rm) => !selectedMedicineIds.has(rm.medicine.id)).slice(0, 10);
    }

    if (rmDuplicateMode) {
      return source.filter((rm) => !selectedMedicineIds.has(rm.medicine.id));
    }

    const lower = searchTerm.toLowerCase();
    return source
      .filter(
        (rm) =>
          !selectedMedicineIds.has(rm.medicine.id) &&
          (rm.medicine.name.toLowerCase().includes(lower) ||
            rm.medicine.generic_name?.toLowerCase().includes(lower) ||
            rm.medicine.code?.toLowerCase().includes(lower)),
      )
      .slice(0, 20);
  }, [rmDuplicateMode, roomMedicines, searchResults, searchTerm, selectedOrder?.items]);

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
    if (!rmDuplicateMode) {
      const availableStock = roomMedicines.find((rm) => rm.medicine.id === item.medicine_id)?.quantity || 0;
      if (availableStock > 0 && row.quantity > availableStock) {
        toast({ variant: "destructive", title: "Jumlah melebihi stok tersedia" });
        return;
      }
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
      const res = await orderApi.updateItem(selectedOrder.id, item.id, {
        quantity: row.quantity,
        unit: row.unit,
        dosage: row.dosage,
        frequency: row.frequency,
        route: row.route,
        duration: row.duration,
        instructions: row.instructions,
        notes: row.notes,
      });

      if (rmDuplicateMode) {
        const updatedItem = res.data;
        applyLocalOrderUpdate({
          ...selectedOrder,
          items: (selectedOrder.items || []).map((candidate) =>
            candidate.id === item.id ? { ...candidate, ...updatedItem } : candidate,
          ),
        });
      }

      toast({ title: "Berhasil", description: "Obat berhasil diperbarui" });
      if (!rmDuplicateMode) {
        await loadOrders(true, selectedOrder.id);
        window.dispatchEvent(new CustomEvent("refresh-print-options"));
        window.dispatchEvent(new CustomEvent("refresh-final-visit"));
      }
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

  const applyDuplicateDoctor = () => {
    if (!selectedOrder) return;
    const doctorName = pendingDoctorName.trim();
    setSelectedOrder((prev) =>
      prev
        ? {
            ...prev,
            prescriber: doctorName
              ? { id: 0, nama_lengkap: doctorName, tipe_karyawan: "dokter" }
              : undefined,
          }
        : prev,
    );
    onUpdateDuplicateOrderMeta?.(selectedOrder.id, { doctor_name: doctorName });
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
    onUpdateDuplicateOrderMeta?.(selectedOrder.id, { fake_date: nextDate });
    setDateModalOpen(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 gap-2">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-muted-foreground">Memuat data...</span>
      </div>
    );
  }

  const patient = selectedOrder?.source_visit?.registration?.patient || selectedOrder?.registration?.patient;
  const canEdit = hasPermission("pharmacy.edit") && !readOnly;
  const isEditable =
    rmDuplicateMode ||
    selectedOrder?.status === "pending" ||
    selectedOrder?.status === "reviewed";
  const canModify = canEdit && Boolean(selectedOrder) && isEditable;
  const activeItems = selectedOrder?.items?.filter((item) => item.status !== "cancelled") || [];
  const grandTotal = activeItems.reduce((total, item) => {
    return total + getUnitPrice(item) * Number(item.quantity || 0);
  }, 0);

  return (
    <>
      <div className="space-y-3">
        {!rmDuplicateMode && (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap gap-2">
              {orders.map((order) => (
                <Button
                  key={order.id}
                  variant={selectedOrder?.id === order.id ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedOrder(order)}
                >
                  {order.order_number}
                  <Badge
                    variant={ORDER_STATUS_LABELS[order.status]?.variant || "secondary"}
                    className="ml-2"
                  >
                    {ORDER_STATUS_LABELS[order.status]?.label || order.status}
                  </Badge>
                </Button>
              ))}
            </div>
          </div>
        )}

        {!selectedOrder ? (
          <div className="py-8 text-center text-muted-foreground border rounded-lg">
            <Pill className="h-10 w-10 mx-auto mb-3 opacity-50" />
            <p>Belum ada resep obat.</p>
          </div>
        ) : (
          <>
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2 text-[11px] p-1.5 bg-muted/50 rounded items-center">
                <div className="flex items-center gap-1">
                  <User className="h-3 w-3 text-muted-foreground" />
                  <span className="font-medium truncate">{patient?.nama_lengkap || "Pasien"}</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-muted-foreground shrink-0">RM:</span>
                  <span className="font-medium">{patient?.no_rm || "-"}</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-muted-foreground shrink-0">Dokter:</span>
                  {rmDuplicateMode ? (
                    <span className="inline-flex items-center gap-1">
                      <span className="font-medium">{selectedOrder.prescriber?.nama_lengkap || "-"}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5"
                        title="Pilih dokter"
                        onClick={() => setDoctorModalOpen(true)}
                      >
                        <User className="h-3 w-3" />
                      </Button>
                    </span>
                  ) : (
                    <span className="font-medium">{selectedOrder.prescriber?.nama_lengkap || "-"}</span>
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
                        onClick={() => setDateModalOpen(true)}
                      >
                        <Clock className="h-3 w-3" />
                      </Button>
                    </span>
                  ) : (
                    <span className="font-medium">
                      {selectedOrder.created_at
                        ? new Date(selectedOrder.created_at).toLocaleString("id-ID")
                        : "-"}
                    </span>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                <div className="p-2 rounded border bg-muted/30">
                  <span className="text-muted-foreground">No. Resep</span>
                  <p className="font-medium mt-0.5">{selectedOrder.order_number || "-"}</p>
                </div>
                <div className="p-2 rounded border bg-muted/30">
                  <span className="text-muted-foreground">Jumlah Item</span>
                  <p className="font-medium mt-0.5">{activeItems.length}</p>
                </div>
                <div className="p-2 rounded border bg-muted/30">
                  <span className="text-muted-foreground">Status Order</span>
                  <div className="mt-1 flex items-center gap-1.5 font-medium">
                    <span className={cn("h-1.5 w-1.5 rounded-full", getStatusDotClass(selectedOrder.status))} />
                    <span>{ORDER_STATUS_LABELS[selectedOrder.status]?.label || selectedOrder.status}</span>
                  </div>
                </div>
              </div>

              {(selectedOrder.diagnosis || selectedOrder.notes) && (
                <div className="rounded border bg-background/70 px-3 py-2 text-xs space-y-1">
                  {selectedOrder.diagnosis && (
                    <div>
                      <span className="text-muted-foreground">Diagnosis: </span>
                      <span className="font-medium">{selectedOrder.diagnosis}</span>
                    </div>
                  )}
                  {selectedOrder.notes && (
                    <div>
                      <span className="text-muted-foreground">Catatan Resep: </span>
                      <span className="font-medium">{selectedOrder.notes}</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {!isEditable && (
              <div className="border rounded-lg p-3 bg-yellow-50 dark:bg-yellow-950/30 border-yellow-200 dark:border-yellow-800">
                <div className="flex items-center gap-2 text-yellow-800 dark:text-yellow-200">
                  <AlertCircle className="h-4 w-4" />
                  <span className="text-sm font-medium">Order sudah diproses, tidak dapat diedit</span>
                </div>
              </div>
            )}

            <div className="border rounded-lg overflow-hidden">
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
              <div className="p-0 overflow-x-auto">
                <table className="w-full min-w-[900px] text-sm">
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
                        const availableStock = rmDuplicateMode
                          ? 0
                          : roomMedicines.find((rm) => rm.medicine.id === item.medicine_id)?.quantity || 0;
                        const unitPrice = getUnitPrice(item);

                        return (
                          <tr key={item.id || index} className="border-b last:border-0 align-top">
                            <td className="py-2 px-2">
                              <p className="font-medium">{item.medicine?.name || "Obat"}</p>
                              <p className="text-xs text-muted-foreground">
                                {item.medicine?.code || "-"}
                                {!rmDuplicateMode && ` • Stok ${availableStock} ${item.unit}`}
                              </p>
                            </td>
                            <td className="py-2 px-2">
                              {canModify ? (
                                <>
                                  <Input
                                    type="number"
                                    min={1}
                                    max={!rmDuplicateMode && availableStock > 0 ? availableStock : undefined}
                                    value={row.quantity}
                                    onChange={(e) =>
                                      updateRowEdit(rowKey, "quantity", Number(e.target.value) || 1)
                                    }
                                    className="h-8"
                                    disabled={Boolean(item.dispensed_qty) && item.dispensed_qty > 0}
                                  />
                                  {!rmDuplicateMode && availableStock > 0 && (
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
                                  disabled={Boolean(item.dispensed_qty) && item.dispensed_qty > 0}
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
                                  disabled={Boolean(item.dispensed_qty) && item.dispensed_qty > 0}
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
                                  disabled={Boolean(item.dispensed_qty) && item.dispensed_qty > 0}
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
                                  disabled={Boolean(item.dispensed_qty) && item.dispensed_qty > 0}
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
                              <p className="text-sm font-semibold leading-4">
                                {formatRupiah(Number(row.quantity || 0) * unitPrice)}
                              </p>
                            </td>
                            {canModify && (
                              <td className="py-2 px-2">
                                <div className="flex justify-center gap-1">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-primary"
                                    onClick={() => handleSaveRow(item, rowKey)}
                                    disabled={
                                      (Boolean(item.dispensed_qty) && item.dispensed_qty > 0) ||
                                      savingRowId === item.id
                                    }
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
                                    onClick={() => setDeleteConfirmItem(item)}
                                    disabled={Boolean(item.dispensed_qty) && item.dispensed_qty > 0}
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
              <div className="border-t bg-primary/5 px-3 py-2 flex items-center justify-between">
                <div>
                  {canEdit && (
                    <Button
                      variant={rmDuplicateMode ? "destructive" : "outline"}
                      size="sm"
                      onClick={() => setCancelConfirmOrder(true)}
                    >
                      <AlertCircle className="h-4 w-4 mr-1" />
                      {rmDuplicateMode ? "Hapus Resep" : "Batalkan Order"}
                    </Button>
                  )}
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">Grand Total</p>
                  <p className="text-base font-semibold text-primary">{formatRupiah(grandTotal)}</p>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

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
                        {rm.medicine.code} • {rm.medicine.form || "-"} • {rm.medicine.strength || "-"}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={rm.quantity > rm.min_quantity ? "default" : "destructive"}>
                        {rmDuplicateMode ? `Harga ${formatRupiah(rm.unit_price || 0)}` : `Stok: ${rm.quantity}`}
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

      <AlertDialog open={cancelConfirmOrder} onOpenChange={setCancelConfirmOrder}>
        <AlertDialogContent className="max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-sm">
              {rmDuplicateMode ? "Hapus Resep?" : "Batalkan Order?"}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs">
              {rmDuplicateMode
                ? `Yakin ingin menghapus resep ${selectedOrder?.order_number}? Semua item pada resep ini akan ikut dihapus.`
                : `Yakin ingin membatalkan order ${selectedOrder?.order_number}? Semua item akan dibatalkan.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="h-8 text-xs">Batal</AlertDialogCancel>
            <AlertDialogAction
              className="h-8 text-xs bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleConfirmCancelOrder}
            >
              Ya
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {rmDuplicateMode && selectedOrder && (
        <Dialog open={orderPickerOpen} onOpenChange={setOrderPickerOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Pilih Resep</DialogTitle>
            </DialogHeader>
            <div className="max-h-64 overflow-y-auto space-y-1">
              {orders.map((order) => {
                const isSelected = selectedOrder.id === order.id;
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
                      <Badge variant={ORDER_STATUS_LABELS[order.status]?.variant || "secondary"}>
                        {ORDER_STATUS_LABELS[order.status]?.label || order.status}
                      </Badge>
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
              <DialogTitle>Pilih Dokter Resep</DialogTitle>
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
                  .filter((doc) => doc.name.toLowerCase().includes(doctorSearch.toLowerCase()))
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
                <Button type="button" onClick={applyDuplicateDoctor}>
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
    </>
  );
}