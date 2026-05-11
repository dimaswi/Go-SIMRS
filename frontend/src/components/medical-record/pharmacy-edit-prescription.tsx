import { Fragment, useEffect, useMemo, useState } from "react";
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
  Pencil,
  Pill,
  User,
  Plus,
  Trash2,
  Search,
  AlertCircle,
  Clock,
} from "lucide-react";
import { OrderDetailInfoButton } from "./order-detail-info-button";
import { cn } from "@/lib/utils";
import { medicineOrdersApi, getPharmacyRoomMedicines } from "@/lib/api";
import { medicinesApi } from "@/lib/api/medicines";
import type { Medicine } from "@/lib/api/medicines";
import type { MedicineOrder, MedicineOrderItem } from "@/lib/api";
import {
  groupMedicineOrderItems,
  MEDICINE_ORDER_ITEM_TYPE_NON_RACIKAN,
  MEDICINE_ORDER_ITEM_TYPE_RACIKAN,
  RACIKAN_TYPE_OPTIONS,
} from "@/lib/medicine-order-racikan";

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
  ordered: { label: "Aktif", variant: "default" },
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

const FREQUENCY_OPTIONS = [
  { value: "1x", label: "1x" },
  { value: "2x", label: "2x" },
  { value: "3x", label: "3x" },
  { value: "4x", label: "4x" },
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
  dosage?: string;
  available_stock?: number;
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
  medicine_id: number;
  quantity: number;
  unit: string;
  dosage: string;
  frequency: string;
  route: string;
  duration: string;
  instructions: string;
  notes: string;
  item_type: string;
  racikan_group: string;
  racikan_name: string;
  racikan_type: string;
  racikan_qty: number;
  racikan_unit: string;
}

interface RacikanDraft {
  name: string;
  type: string;
  quantity: number;
  unit: string;
  dosage: string;
  frequency: string;
  route: string;
  duration: string;
  instructions: string;
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
    case "ordered":
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
  const [showRacikanDialog, setShowRacikanDialog] = useState(false);
  const [racikanSearchTerm, setRacikanSearchTerm] = useState("");
  const [racikanItems, setRacikanItems] = useState<RoomMedicine[]>([]);
  const [savingGroupKey, setSavingGroupKey] = useState<string | null>(null);
  const [expandedRacikanGroups, setExpandedRacikanGroups] = useState<Record<string, boolean>>({});
  const [editItemDialogOpen, setEditItemDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<MedicineOrderItem | null>(null);
  const [editItemMedicineSearchTerm, setEditItemMedicineSearchTerm] = useState("");
  const [editRacikanDialogOpen, setEditRacikanDialogOpen] = useState(false);
  const [editingRacikanKey, setEditingRacikanKey] = useState<string | null>(null);
  const [editingRacikanItems, setEditingRacikanItems] = useState<MedicineOrderItem[]>([]);
  const [editRacikanSearchTerm, setEditRacikanSearchTerm] = useState("");
  const [racikanDraft, setRacikanDraft] = useState<RacikanDraft>({
    name: "",
    type: RACIKAN_TYPE_OPTIONS[0],
    quantity: 1,
    unit: "bungkus",
    dosage: "",
    frequency: "",
    route: "",
    duration: "",
    instructions: "",
  });

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
          medicine_id: item.medicine_id,
          quantity: Number(item.quantity || 1),
          unit: item.unit || "",
          dosage: item.dosage || "",
          frequency: item.frequency || "",
          route: item.route || "oral",
          duration: item.duration || "",
          instructions: item.instructions || "",
          notes: item.notes || "",
          item_type: item.item_type || MEDICINE_ORDER_ITEM_TYPE_NON_RACIKAN,
          racikan_group: item.racikan_group || "",
          racikan_name: item.racikan_name || "",
          racikan_type: item.racikan_type || "",
          racikan_qty: Number(item.racikan_qty || 0),
          racikan_unit: item.racikan_unit || "",
        };
      });
    setRowEdits(next);
    setPendingDoctorName(selectedOrder?.prescriber?.nama_lengkap || "");
    setPendingOrderDate((selectedOrder?.created_at || "").replace(" ", "T").slice(0, 16));
    setDoctorSearch("");
  }, [selectedOrder]);

  useEffect(() => {
    if (!showAddDialog && !showRacikanDialog && !editRacikanDialogOpen && !editItemDialogOpen) return;
    let active = true;

    const loadSearchResults = async () => {
      if (!rmDuplicateMode) return;
      try {
        const activeSearchTerm = editRacikanDialogOpen
          ? editRacikanSearchTerm
          : editItemDialogOpen
            ? editItemMedicineSearchTerm
          : showRacikanDialog
            ? racikanSearchTerm
            : searchTerm;
        const res = await medicinesApi.getAll({
          search: activeSearchTerm || undefined,
          is_active: true,
          limit: activeSearchTerm ? 20 : 10,
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
  }, [showAddDialog, showRacikanDialog, editRacikanDialogOpen, editItemDialogOpen, searchTerm, racikanSearchTerm, editRacikanSearchTerm, editItemMedicineSearchTerm, rmDuplicateMode]);

  const resetRacikanDraft = () => {
    setRacikanDraft({
      name: "",
      type: RACIKAN_TYPE_OPTIONS[0],
      quantity: 1,
      unit: "bungkus",
      dosage: "",
      frequency: "",
      route: "",
      duration: "",
      instructions: "",
    });
    setRacikanItems([]);
    setRacikanSearchTerm("");
  };

  const getRowKey = (item: MedicineOrderItem, fallbackIndex = 0) => item.id ?? -(fallbackIndex + 1);

  const getRowEditData = (item: MedicineOrderItem, fallbackIndex = 0): RowEditData => {
    const rowKey = getRowKey(item, fallbackIndex);
    return rowEdits[rowKey] || {
      medicine_id: item.medicine_id,
      quantity: Number(item.quantity || 1),
      unit: item.unit || "",
      dosage: item.dosage || "",
      frequency: item.frequency || "",
      route: item.route || "oral",
      duration: item.duration || "",
      instructions: item.instructions || "",
      notes: item.notes || "",
      item_type: item.item_type || MEDICINE_ORDER_ITEM_TYPE_NON_RACIKAN,
      racikan_group: item.racikan_group || "",
      racikan_name: item.racikan_name || "",
      racikan_type: item.racikan_type || "",
      racikan_qty: Number(item.racikan_qty || 0),
      racikan_unit: item.racikan_unit || "",
    };
  };

  const createRacikanGroupKey = () => {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
    return `racikan-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  };

  const toggleRacikanGroup = (groupKey: string) => {
    setExpandedRacikanGroups((prev) => ({
      ...prev,
      [groupKey]: !prev[groupKey],
    }));
  };

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

  const openRacikanDialog = () => {
    setRacikanSearchTerm("");
    setShowRacikanDialog(true);
  };

  const openEditItemDialog = (item: MedicineOrderItem) => {
    setEditingItem(item);
    setEditItemDialogOpen(true);
  };

  const openEditRacikanDialog = (groupItems: MedicineOrderItem[], groupKey: string) => {
    setEditingRacikanItems(groupItems);
    setEditingRacikanKey(groupKey);
    setEditRacikanDialogOpen(true);
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
        route: "",
        duration: "",
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

  const filteredRacikanMedicines = useMemo(() => {
    const selectedMedicineIds = new Set(racikanItems.map((item) => item.medicine.id));
    const source = rmDuplicateMode ? searchResults : roomMedicines;
    const lower = racikanSearchTerm.toLowerCase();

    const candidates = source
      .filter(
        (rm) =>
          !selectedMedicineIds.has(rm.medicine.id) &&
          (!lower ||
            rm.medicine.name.toLowerCase().includes(lower) ||
            rm.medicine.generic_name?.toLowerCase().includes(lower) ||
            rm.medicine.code?.toLowerCase().includes(lower)),
      )
    return lower ? candidates.slice(0, 20) : candidates.slice(0, 8);
  }, [rmDuplicateMode, racikanItems, racikanSearchTerm, roomMedicines, searchResults]);

  const filteredEditRacikanMedicines = useMemo(() => {
    const selectedMedicineIds = new Set(editingRacikanItems.map((item) => item.medicine_id));
    const source = rmDuplicateMode ? searchResults : roomMedicines;
    const lower = editRacikanSearchTerm.toLowerCase();

    const candidates = source
      .filter(
        (rm) =>
          !selectedMedicineIds.has(rm.medicine.id) &&
          (!lower ||
            rm.medicine.name.toLowerCase().includes(lower) ||
            rm.medicine.generic_name?.toLowerCase().includes(lower) ||
            rm.medicine.code?.toLowerCase().includes(lower)),
      )
    return lower ? candidates.slice(0, 20) : candidates.slice(0, 8);
  }, [editRacikanSearchTerm, editingRacikanItems, rmDuplicateMode, roomMedicines, searchResults]);

  const updateRowEdit = (rowKey: number, field: keyof RowEditData, value: string | number) => {
    setRowEdits((prev) => ({
      ...prev,
      [rowKey]: {
        ...(prev[rowKey] || {
          medicine_id: 0,
          quantity: 1,
          unit: "",
          dosage: "",
          frequency: "",
          route: "oral",
          duration: "",
          instructions: "",
          notes: "",
          item_type: MEDICINE_ORDER_ITEM_TYPE_NON_RACIKAN,
          racikan_group: "",
          racikan_name: "",
          racikan_type: "",
          racikan_qty: 0,
          racikan_unit: "",
        }),
        [field]: value,
      },
    }));
  };

  const updateRacikanGroupEdit = (
    groupItems: MedicineOrderItem[],
    field: keyof RowEditData,
    value: string | number,
  ) => {
    setRowEdits((prev) => {
      const next = { ...prev };
      groupItems.forEach((item, index) => {
        const rowKey = getRowKey(item, index);
        next[rowKey] = {
          ...getRowEditData(item, index),
          [field]: value,
        };
      });
      return next;
    });
  };

  const handleAddRacikanItem = (roomMedicine: RoomMedicine) => {
    setRacikanItems((prev) => [
      ...prev,
      {
        ...roomMedicine,
        dosage: roomMedicine.medicine.strength || "",
        available_stock: roomMedicine.quantity,
        quantity: 1,
      },
    ]);
    setRacikanSearchTerm("");
  };

  const handleAddEditRacikanItem = (roomMedicine: RoomMedicine) => {
    const alreadyExists = editingRacikanItems.some((item) => item.medicine_id === roomMedicine.medicine.id);
    if (alreadyExists) {
      toast({
        title: "Obat sudah ada",
        description: "Komponen racikan ini sudah terdaftar.",
      });
      return;
    }

    const baseRow = editingRacikanItems.length > 0 ? getRowEditData(editingRacikanItems[0], 0) : undefined;
    const stock = roomMedicine.quantity || 0;

    const newItem: MedicineOrderItem = {
      medicine_id: roomMedicine.medicine.id,
      medicine: {
        id: roomMedicine.medicine.id,
        name: roomMedicine.medicine.name,
        code: roomMedicine.medicine.code,
        unit: roomMedicine.medicine.unit,
      } as any,
      quantity: 1,
      unit: roomMedicine.medicine.unit,
      dosage: baseRow?.dosage || "",
      frequency: baseRow?.frequency || "",
      route: "",
      duration: "",
      instructions: baseRow?.instructions || "",
      notes: "",
      item_type: MEDICINE_ORDER_ITEM_TYPE_RACIKAN,
      racikan_group: editingRacikanKey || baseRow?.racikan_group || "",
      racikan_name: baseRow?.racikan_name || "",
      racikan_type: baseRow?.racikan_type || "",
      racikan_qty: Number(baseRow?.racikan_qty || 1),
      racikan_unit: baseRow?.racikan_unit || "bungkus",
      available_stock: stock,
      unit_price: Number(roomMedicine.unit_price || roomMedicine.price || roomMedicine.selling_price || roomMedicine.medicine.selling_price || 0),
      status: "pending",
      dispensed_qty: 0,
    } as any;

    setEditingRacikanItems((prev) => [...prev, newItem]);
    setEditRacikanSearchTerm("");
  };

  const handleUpdateRacikanItemQuantity = (index: number, quantity: number) => {
    setRacikanItems((prev) => {
      const next = [...prev];
      const maxStock = next[index].available_stock ?? next[index].quantity;
      next[index] = {
        ...next[index],
        quantity: Math.max(1, Math.min(quantity || 0, maxStock || quantity || 1)),
      };
      return next;
    });
  };

  const handleUpdateRacikanItemDosage = (index: number, dosage: string) => {
    setRacikanItems((prev) => {
      const next = [...prev];
      next[index] = {
        ...next[index],
        dosage,
      };
      return next;
    });
  };

  const handleRemoveRacikanItem = (index: number) => {
    setRacikanItems((prev) => prev.filter((_, itemIndex) => itemIndex !== index));
  };

  const handleSaveNewRacikan = async () => {
    if (!selectedOrder) return;
    const name = racikanDraft.name.trim();
    if (!name) {
      toast({ variant: "destructive", title: "Nama racikan wajib diisi" });
      return;
    }
    if (!racikanDraft.dosage.trim() || !racikanDraft.frequency.trim() || !racikanDraft.instructions.trim()) {
      toast({
        variant: "destructive",
        title: "Data racikan belum lengkap",
        description: "Lengkapi dosis, frekuensi, dan cara pakai racikan.",
      });
      return;
    }
    if (racikanItems.length === 0) {
      toast({ variant: "destructive", title: "Tambahkan minimal satu komponen racikan" });
      return;
    }
    if (racikanItems.some((item) => !(item.dosage || "").trim())) {
      toast({
        variant: "destructive",
        title: "Dosis bahan belum lengkap",
        description: "Isi dosis untuk setiap bahan racikan.",
      });
      return;
    }

    const racikanGroup = createRacikanGroupKey();
    setSubmitting(true);
    try {
      const responses = await Promise.all(
        racikanItems.map((roomMedicine) =>
          orderApi.addItem(selectedOrder.id, {
            medicine_id: roomMedicine.medicine.id,
            quantity: Number(roomMedicine.quantity || 1),
            unit: roomMedicine.medicine.unit,
            dosage: (roomMedicine.dosage || racikanDraft.dosage || "").trim(),
            frequency: racikanDraft.frequency,
            route: "",
            duration: "",
            instructions: racikanDraft.instructions,
            notes: "",
            item_type: MEDICINE_ORDER_ITEM_TYPE_RACIKAN,
            racikan_group: racikanGroup,
            racikan_name: name,
            racikan_type: racikanDraft.type,
            racikan_qty: Math.max(1, racikanDraft.quantity || 1),
            racikan_unit: racikanDraft.unit.trim() || "bungkus",
          }),
        ),
      );

      if (rmDuplicateMode) {
        applyLocalOrderUpdate({
          ...selectedOrder,
          items: [...(selectedOrder.items || []), ...responses.map((response) => response.data)],
        });
      }

      setExpandedRacikanGroups((prev) => ({
        ...prev,
        [racikanGroup]: true,
      }));

      resetRacikanDraft();
      setShowRacikanDialog(false);
      toast({ title: "Berhasil", description: "Racikan berhasil ditambahkan" });
      if (!rmDuplicateMode) {
        await loadOrders(true, selectedOrder.id);
        window.dispatchEvent(new CustomEvent("refresh-print-options"));
        window.dispatchEvent(new CustomEvent("refresh-final-visit"));
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.response?.data?.error || "Gagal menambahkan racikan",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveRow = async (item: MedicineOrderItem, rowKey: number): Promise<boolean> => {
    if (!selectedOrder || !item.id) return false;
    const row = rowEdits[rowKey];
    if (!row) return false;

    if (!row.quantity || row.quantity < 1) {
      toast({ variant: "destructive", title: "Jumlah minimal 1" });
      return false;
    }
    if (!rmDuplicateMode) {
      const availableStock = roomMedicines.find((rm) => rm.medicine.id === row.medicine_id)?.quantity || 0;
      if (availableStock > 0 && row.quantity > availableStock) {
        toast({ variant: "destructive", title: "Jumlah melebihi stok tersedia" });
        return false;
      }
    }
    if (!row.dosage?.trim()) {
      toast({ variant: "destructive", title: "Dosis wajib diisi" });
      return false;
    }
    if (!row.frequency?.trim()) {
      toast({ variant: "destructive", title: "Frekuensi wajib diisi" });
      return false;
    }
    if (!row.instructions?.trim()) {
      toast({ variant: "destructive", title: "Cara pemakaian wajib diisi" });
      return false;
    }

    setSavingRowId(item.id);
    try {
      const res = await orderApi.updateItem(selectedOrder.id, item.id, {
        medicine_id: row.medicine_id,
        quantity: row.quantity,
        unit: row.unit,
        dosage: row.dosage,
        frequency: row.frequency,
        route: row.route,
        duration: row.duration,
        instructions: row.instructions,
        notes: row.notes,
        item_type: row.item_type,
        racikan_group: row.racikan_group,
        racikan_name: row.racikan_name,
        racikan_type: row.racikan_type,
        racikan_qty: row.racikan_qty,
        racikan_unit: row.racikan_unit,
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
      return true;
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.response?.data?.error || "Gagal memperbarui obat",
      });
      return false;
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

  const handleSaveRacikanGroup = async (groupItems: MedicineOrderItem[]): Promise<boolean> => {
    if (!selectedOrder || groupItems.length === 0) return false;
    const racikanKey = groupItems[0].racikan_group || `racikan-${groupItems[0].id || 0}`;
    const firstRow = getRowEditData(groupItems[0], 0);

    setSavingGroupKey(racikanKey);
    try {
      const responses = await Promise.all(
        groupItems.map((item, index) => {
          const row = getRowEditData(item, index);
          const payload = {
            quantity: row.quantity,
            unit: row.unit,
            dosage: row.dosage,
            frequency: row.frequency,
            route: "",
            duration: "",
            instructions: row.instructions,
            notes: row.notes,
            item_type: row.item_type,
            racikan_group: row.racikan_group || firstRow.racikan_group || racikanKey,
            racikan_name: row.racikan_name || firstRow.racikan_name,
            racikan_type: row.racikan_type || firstRow.racikan_type,
            racikan_qty: Number(row.racikan_qty || firstRow.racikan_qty || 1),
            racikan_unit: row.racikan_unit || firstRow.racikan_unit || "bungkus",
          };

          if (item.id) {
            return orderApi.updateItem(selectedOrder.id, item.id, payload);
          }

          return orderApi.addItem(selectedOrder.id, {
            medicine_id: item.medicine_id,
            ...payload,
          });
        }),
      );

      if (rmDuplicateMode) {
        const updatesById = new Map(responses.map((response) => [response.data.id, response.data]));
        applyLocalOrderUpdate({
          ...selectedOrder,
          items: [
            ...(selectedOrder.items || []).map((candidate) => updatesById.get(candidate.id) || candidate),
            ...responses
              .map((response) => response.data)
              .filter((item) => !(selectedOrder.items || []).some((candidate) => candidate.id === item.id)),
          ],
        });
      }

      toast({ title: "Berhasil", description: "Racikan berhasil diperbarui" });
      if (!rmDuplicateMode) {
        await loadOrders(true, selectedOrder.id);
        window.dispatchEvent(new CustomEvent("refresh-print-options"));
        window.dispatchEvent(new CustomEvent("refresh-final-visit"));
      }
      return true;
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error?.response?.data?.error || error?.message || "Gagal memperbarui racikan",
      });
      return false;
    } finally {
      setSavingGroupKey(null);
    }
  };

  const handleDeleteRacikanGroup = async (groupItems: MedicineOrderItem[]) => {
    if (!selectedOrder || groupItems.length === 0) return;

    const racikanKey = groupItems[0].racikan_group || `racikan-${groupItems[0].id || 0}`;

    try {
      await Promise.all(
        groupItems.map((item) => {
          if (!item.id) {
            throw new Error("Komponen racikan tidak memiliki ID");
          }
          return orderApi.deleteItem(selectedOrder.id, item.id);
        }),
      );

      if (rmDuplicateMode) {
        const deletedIds = new Set(groupItems.map((item) => item.id));
        applyLocalOrderUpdate({
          ...selectedOrder,
          items: (selectedOrder.items || []).filter((candidate) => !deletedIds.has(candidate.id)),
        });
      }

      setExpandedRacikanGroups((prev) => {
        const next = { ...prev };
        delete next[racikanKey];
        return next;
      });

      toast({ title: "Berhasil", description: "Racikan berhasil dihapus" });
      if (!rmDuplicateMode) {
        await loadOrders(true, selectedOrder.id);
        window.dispatchEvent(new CustomEvent("refresh-print-options"));
        window.dispatchEvent(new CustomEvent("refresh-final-visit"));
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error?.response?.data?.error || error?.message || "Gagal menghapus racikan",
      });
    }
  };

  const handleSubmitEditItem = async () => {
    if (!editingItem) return;
    const currentActiveItems = (selectedOrder?.items || []).filter((item) => item.status !== "cancelled");
    const fallbackIndex = currentActiveItems.findIndex((item) => item.id === editingItem.id);
    const rowKey = getRowKey(editingItem, fallbackIndex >= 0 ? fallbackIndex : 0);
    const success = await handleSaveRow(editingItem, rowKey);
    if (!success) return;

    setEditItemDialogOpen(false);
    setEditingItem(null);
  };

  const handleSubmitEditRacikan = async () => {
    if (!editingRacikanItems.length) return;
    const success = await handleSaveRacikanGroup(editingRacikanItems);
    if (!success) return;

    setEditRacikanDialogOpen(false);
    setEditingRacikanItems([]);
    setEditingRacikanKey(null);
  };

  const patient = selectedOrder?.source_visit?.registration?.patient || selectedOrder?.registration?.patient;
  const canEdit = hasPermission("pharmacy.edit") && !readOnly;
  const isEditable =
    rmDuplicateMode ||
    selectedOrder?.status === "pending" ||
    selectedOrder?.status === "reviewed";
  const canModify = canEdit && Boolean(selectedOrder) && isEditable;
  const activeItems = selectedOrder?.items?.filter((item) => item.status !== "cancelled") || [];
  const groupedActiveItems = groupMedicineOrderItems(activeItems);
  const grandTotal = activeItems.reduce((total, item) => {
    return total + getUnitPrice(item) * Number(item.quantity || 0);
  }, 0);
  const editingItemIndex = editingItem
    ? activeItems.findIndex((candidate) => candidate.id === editingItem.id)
    : -1;
  const editingItemRowKey = editingItem
    ? getRowKey(editingItem, editingItemIndex >= 0 ? editingItemIndex : 0)
    : null;
  const editingItemRow =
    editingItem && editingItemRowKey !== null
      ? getRowEditData(editingItem, editingItemIndex >= 0 ? editingItemIndex : 0)
      : null;
  const editingItemAvailableStock = editingItem
    ? roomMedicines.find((rm) => rm.medicine.id === (editingItemRow?.medicine_id || editingItem.medicine_id))?.quantity || 0
    : 0;
  const editingItemLocked = editingItem ? Boolean(editingItem.dispensed_qty) && editingItem.dispensed_qty > 0 : false;
  const editItemMedicineOptions = useMemo(() => {
    if (!editingItem) return [];

    const source = rmDuplicateMode ? searchResults : roomMedicines;
    const usedMedicineIds = new Set(
      activeItems
        .filter((candidate) => candidate.id !== editingItem.id)
        .map((candidate) => candidate.medicine_id),
    );

    return source
      .filter((roomMedicine) => !usedMedicineIds.has(roomMedicine.medicine.id))
      .map((roomMedicine) => ({
        value: String(roomMedicine.medicine.id),
        label: `${roomMedicine.medicine.name} (${roomMedicine.medicine.code})`,
      }));
  }, [activeItems, editingItem, rmDuplicateMode, roomMedicines, searchResults]);
  const selectedEditingMedicine = useMemo(() => {
    if (!editingItemRow) return null;
    const source = rmDuplicateMode ? searchResults : roomMedicines;
    return source.find((roomMedicine) => roomMedicine.medicine.id === editingItemRow.medicine_id) || null;
  }, [editingItemRow, rmDuplicateMode, roomMedicines, searchResults]);
  const editingRacikanFirstItem = editingRacikanItems[0] || null;
  const editingRacikanFirstIndex = editingRacikanFirstItem
    ? activeItems.findIndex((candidate) => candidate.id === editingRacikanFirstItem.id)
    : -1;
  const editingRacikanRow = editingRacikanFirstItem
    ? getRowEditData(editingRacikanFirstItem, editingRacikanFirstIndex >= 0 ? editingRacikanFirstIndex : 0)
    : null;
  const editingRacikanLocked = editingRacikanItems.some((item) => Boolean(item.dispensed_qty) && item.dispensed_qty > 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 gap-2">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-muted-foreground">Memuat data...</span>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-3">
        {!selectedOrder ? (
          <div className="py-8 text-center text-muted-foreground border rounded-lg">
            <Pill className="h-10 w-10 mx-auto mb-3 opacity-50" />
            <p>Belum ada resep obat.</p>
          </div>
        ) : (
          <>
            {!isEditable && (
              <div className="border border-yellow-200 bg-yellow-50 dark:bg-yellow-950/30 rounded p-3 mb-4">
                <div className="flex items-center gap-2 text-yellow-800 dark:text-yellow-200">
                  <AlertCircle className="h-4 w-4" />
                  <span className="text-sm font-medium">Order sudah diproses, tidak dapat diedit</span>
                </div>
              </div>
            )}

            <div className="border border-border/70 bg-background mb-4">
              <div className="flex flex-col gap-3 border-b border-border/70 bg-muted/30 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground sm:flex-row sm:items-start sm:justify-between">
                <span className="flex items-center gap-2">
                  <Pill className="h-3 w-3" />
                  Daftar Obat ({groupedActiveItems.length} entri)
                </span>
                <div className="flex w-full flex-col gap-2 sm:w-auto sm:min-w-[320px] sm:items-end">
                  {canModify && (
                    <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                      <Button size="sm" variant="outline" onClick={openRacikanDialog} className="h-6 text-[10px] py-0 px-2">
                        <Pill className="h-3 w-3 mr-1" />
                        Tambah Racikan
                      </Button>
                      <Button size="sm" onClick={openAddDialog} className="h-6 text-[10px] py-0 px-2">
                        <Plus className="h-3 w-3 mr-1" />
                        Tambah Obat
                      </Button>
                    </div>
                  )}
                  <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                    {rmDuplicateMode && <Badge variant="outline" className="text-[10px] h-5 px-1.5 py-0">Mode RM Duplikat</Badge>}
                    <Badge variant={ORDER_STATUS_LABELS[selectedOrder.status]?.variant || "secondary"} className="text-[10px] h-5 px-1.5 py-0">
                      {ORDER_STATUS_LABELS[selectedOrder.status]?.label || selectedOrder.status}
                    </Badge>
                    <OrderDetailInfoButton
                      title="Detail Order Farmasi"
                      tooltip="Lihat detail order farmasi"
                      className="h-6 w-6 rounded-md"
                    >
                      <table className="w-full table-fixed text-xs">
                        <tbody>
                          <tr className="border-b">
                            <td className="w-28 py-1.5 align-top text-muted-foreground">Nama Pasien</td>
                            <td className="py-1.5 font-medium break-words">{patient?.nama_lengkap || "-"}</td>
                          </tr>
                          <tr className="border-b">
                            <td className="w-28 py-1.5 align-top text-muted-foreground">No. RM</td>
                            <td className="py-1.5 font-medium break-words">{patient?.no_rm || "-"}</td>
                          </tr>
                          <tr className="border-b">
                            <td className="w-28 py-1.5 align-top text-muted-foreground">Dokter</td>
                            <td className="py-1.5 font-medium break-words">
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
                            </td>
                          </tr>
                          <tr className="border-b">
                            <td className="w-28 py-1.5 align-top text-muted-foreground">Tanggal Order</td>
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
                            </td>
                          </tr>
                          <tr className="border-b">
                            <td className="w-28 py-1.5 align-top text-muted-foreground">No. Resep</td>
                            <td className="py-1.5 font-medium break-words">{selectedOrder.order_number || "-"}</td>
                          </tr>
                          <tr className="border-b">
                            <td className="py-1.5 align-top text-muted-foreground">Jumlah Item</td>
                            <td className="py-1.5 font-medium break-words">{groupedActiveItems.length}</td>
                          </tr>
                          {selectedOrder.diagnosis && (
                            <tr className="border-b">
                              <td className="py-1.5 align-top text-muted-foreground">Diagnosis</td>
                              <td className="py-1.5 font-medium break-words">{selectedOrder.diagnosis}</td>
                            </tr>
                          )}
                          {selectedOrder.notes && (
                            <tr>
                              <td className="py-1.5 align-top text-muted-foreground">Catatan Resep</td>
                              <td className="py-1.5 font-medium break-words">{selectedOrder.notes}</td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </OrderDetailInfoButton>
                  </div>
                </div>
              </div>
              <div className="p-0 overflow-x-auto">
                <table className="w-full min-w-[980px] text-sm">
                  <thead className="bg-muted/50 border-y border-border/70">
                    <tr>
                      <th className="py-2 px-3 text-left font-medium">Nama Item</th>
                      <th className="py-2 px-3 text-left font-medium">Detail Resep</th>
                      <th className="py-2 px-3 text-left font-medium w-[130px]">Jumlah</th>
                      <th className="py-2 px-3 text-right font-medium w-[160px]">Harga</th>
                      <th className="py-2 px-3 text-left font-medium w-[130px]">Status</th>
                      {canModify && <th className="py-2 px-3 text-center font-medium w-[120px]">Aksi</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {groupedActiveItems.length === 0 ? (
                      <tr>
                        <td colSpan={canModify ? 6 : 5} className="py-8 text-center text-muted-foreground">
                          Belum ada obat dalam resep
                        </td>
                      </tr>
                    ) : (
                      groupedActiveItems.map((group, groupIndex) => {
                        if (group.type === "racikan") {
                          const firstItem = group.items[0];
                          const firstIndex = activeItems.findIndex((candidate) => candidate === firstItem);
                          const firstRow = getRowEditData(firstItem, firstIndex);
                          const groupKey = group.racikanGroup || group.key;
                          const isExpanded = expandedRacikanGroups[groupKey] ?? false;
                          const groupTotal = group.items.reduce((sum, item) => {
                            const itemIndex = activeItems.findIndex((candidate) => candidate === item);
                            const row = getRowEditData(item, itemIndex);
                            return sum + getUnitPrice(item) * Number(row.quantity || 0);
                          }, 0);
                          const groupDisabled = group.items.some((item) => Boolean(item.dispensed_qty) && item.dispensed_qty > 0);
                          const detailSummary = [
                            firstRow.dosage || "-",
                            firstRow.frequency || "-",
                          ].join(" • ");

                          return (
                            <Fragment key={group.key}>
                              <tr className="border-b bg-muted/20 align-top">
                                <td className="py-2 px-3">
                                  <button
                                    type="button"
                                    className="flex w-full items-start gap-2 text-left"
                                    onClick={() => toggleRacikanGroup(groupKey)}
                                  >
                                    <div className="min-w-0">
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <span className="font-semibold truncate">{firstRow.racikan_name || group.racikanName || "Racikan"}</span>
                                        <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">Racikan</Badge>
                                      </div>
                                      <p className="text-xs text-muted-foreground truncate">
                                        {firstRow.racikan_type || group.racikanType || "Tanpa jenis"} • {group.items.length} komponen
                                      </p>
                                    </div>
                                  </button>
                                </td>
                                <td className="py-2 px-3">
                                  <p className="truncate">{detailSummary}</p>
                                  <p className="text-xs text-muted-foreground truncate">Instruksi: {firstRow.instructions || "-"}</p>
                                </td>
                                <td className="py-2 px-3 font-medium">{firstRow.racikan_qty || 1} {firstRow.racikan_unit || "bungkus"}</td>
                                <td className="py-2 px-3 text-right">
                                  <p className="text-sm font-semibold leading-5">{formatRupiah(groupTotal)}</p>
                                </td>
                                <td className="py-2 px-3">
                                  <Badge variant={groupDisabled ? "outline" : "default"}>
                                    {groupDisabled ? "Sudah Diproses" : "Aktif"}
                                  </Badge>
                                </td>
                                {canModify && (
                                  <td className="py-2 px-3">
                                    <div className="flex items-center justify-center gap-1">
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8"
                                        title="Edit detail racikan"
                                        onClick={() => openEditRacikanDialog(group.items, groupKey)}
                                        disabled={groupDisabled}
                                      >
                                        <Pencil className="h-4 w-4" />
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 text-destructive hover:text-destructive"
                                        title="Hapus racikan"
                                        onClick={() => handleDeleteRacikanGroup(group.items)}
                                        disabled={groupDisabled}
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    </div>
                                  </td>
                                )}
                              </tr>
                              {isExpanded &&
                                group.items.map((item, index) => {
                                  const actualIndex = activeItems.findIndex((candidate) => candidate === item);
                                  const row = getRowEditData(item, actualIndex);
                                  const unitPrice = getUnitPrice(item);

                                  return (
                                    <tr key={`${group.key}-${item.id || index}`} className="border-b bg-background">
                                      <td className="py-2 px-3 pl-11">
                                        <div className="flex items-center gap-2 min-w-0">
                                          <span className="h-px w-4 bg-border" />
                                          <span className="truncate text-muted-foreground">{item.medicine?.name || "Komponen"}</span>
                                        </div>
                                        <p className="text-xs text-muted-foreground pl-6 truncate">{item.medicine?.code || "-"}</p>
                                      </td>
                                      <td className="py-2 px-3 text-xs text-muted-foreground">Bahan racikan</td>
                                      <td className="py-2 px-3">{row.quantity} {row.unit || item.unit}</td>
                                      <td className="py-2 px-3 text-right">{formatRupiah(Number(row.quantity || 0) * unitPrice)}</td>
                                      <td className="py-2 px-3 text-muted-foreground text-xs">Komponen</td>
                                      {canModify && <td className="py-2 px-3 text-center text-muted-foreground">-</td>}
                                    </tr>
                                  );
                                })}
                            </Fragment>
                          );
                        }

                        const item = group.items[0];
                        const actualIndex = activeItems.findIndex((candidate) => candidate === item);
                        const row = getRowEditData(item, actualIndex);
                        const availableStock = rmDuplicateMode
                          ? 0
                          : roomMedicines.find((rm) => rm.medicine.id === item.medicine_id)?.quantity || 0;
                        const unitPrice = getUnitPrice(item);
                        const itemDisabled = Boolean(item.dispensed_qty) && item.dispensed_qty > 0;
                        const detailSummary = [row.dosage || "-", row.frequency || "-"].join(" • ");

                        return (
                          <tr key={item.id || groupIndex} className="border-b align-top">
                            <td className="py-2 px-3">
                              <p className="font-medium truncate">{item.medicine?.name || "Obat"}</p>
                              <p className="text-xs text-muted-foreground truncate">
                                {item.medicine?.code || "-"}
                                {!rmDuplicateMode && ` • Stok ${availableStock} ${item.unit}`}
                              </p>
                            </td>
                            <td className="py-2 px-3">
                              <p className="truncate">{detailSummary}</p>
                              <p className="text-xs text-muted-foreground truncate">Instruksi: {row.instructions || "-"}</p>
                              {row.notes ? <p className="text-xs text-muted-foreground truncate">Catatan: {row.notes}</p> : null}
                            </td>
                            <td className="py-2 px-3 font-medium">{row.quantity} {row.unit || item.unit}</td>
                            <td className="py-2 px-3 text-right">
                              <p className="text-xs text-muted-foreground">@ {formatRupiah(unitPrice)}</p>
                              <p className="text-sm font-semibold leading-4">{formatRupiah(Number(row.quantity || 0) * unitPrice)}</p>
                            </td>
                            <td className="py-2 px-3">
                              <Badge variant={ORDER_STATUS_LABELS[item.status || "pending"]?.variant || "secondary"}>
                                {ORDER_STATUS_LABELS[item.status || "pending"]?.label || item.status || "Aktif"}
                              </Badge>
                            </td>
                            {canModify && (
                              <td className="py-2 px-3">
                                <div className="flex items-center justify-center gap-1">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8"
                                    title="Edit detail resep"
                                    onClick={() => openEditItemDialog(item)}
                                    disabled={itemDisabled}
                                  >
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-destructive hover:text-destructive"
                                    title="Hapus obat"
                                    onClick={() => setDeleteConfirmItem(item)}
                                    disabled={itemDisabled}
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

      <Dialog
        open={showRacikanDialog}
        onOpenChange={(open) => {
          setShowRacikanDialog(open);
          if (!open) {
            resetRacikanDraft();
          }
        }}
      >
        <DialogContent className="w-[calc(100vw-1rem)] sm:max-w-[96vw] 2xl:max-w-[1440px] max-h-[92vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Tambah Racikan</DialogTitle>
            <DialogDescription>
              Tambahkan racikan baru ke resep ini. Stok akan tetap dihitung dari tiap komponen bahan.
            </DialogDescription>
          </DialogHeader>

          <div className="grid flex-1 gap-4 overflow-y-auto pr-1 xl:grid-cols-[minmax(0,1.2fr)_minmax(400px,0.8fr)]">
            <div className="space-y-4">
              <div className="rounded-lg border p-4 space-y-4">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <h4 className="text-sm font-semibold">Informasi Racikan</h4>
                    <p className="text-xs text-muted-foreground">Isi identitas racikan dan aturan pakai utamanya.</p>
                  </div>
                  <Badge variant="outline">{racikanItems.length} komponen</Badge>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label>Nama Racikan</Label>
                    <Input
                      value={racikanDraft.name}
                      onChange={(e) => setRacikanDraft((prev) => ({ ...prev, name: e.target.value }))}
                      placeholder="Contoh: Racikan Demam Anak"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Jenis Racikan</Label>
                    <Select value={racikanDraft.type} onValueChange={(value) => setRacikanDraft((prev) => ({ ...prev, type: value }))}>
                      <SelectTrigger>
                        <SelectValue placeholder="Pilih jenis racikan" />
                      </SelectTrigger>
                      <SelectContent>
                        {RACIKAN_TYPE_OPTIONS.map((option) => (
                          <SelectItem key={option} value={option}>{option}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label>Jumlah Hasil</Label>
                    <Input
                      type="number"
                      min={1}
                      value={racikanDraft.quantity}
                      onChange={(e) => setRacikanDraft((prev) => ({ ...prev, quantity: Number(e.target.value) || 1 }))}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Satuan Hasil</Label>
                    <Input
                      value={racikanDraft.unit}
                      onChange={(e) => setRacikanDraft((prev) => ({ ...prev, unit: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Dosis</Label>
                    <Input
                      value={racikanDraft.dosage}
                      onChange={(e) => setRacikanDraft((prev) => ({ ...prev, dosage: e.target.value }))}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label>Frekuensi</Label>
                    <Combobox
                      options={FREQUENCY_OPTIONS}
                      value={racikanDraft.frequency}
                      onValueChange={(value) => setRacikanDraft((prev) => ({ ...prev, frequency: value }))}
                      allowCustomValue
                      placeholder="Pilih frekuensi"
                      searchPlaceholder="Cari frekuensi..."
                      emptyText="Frekuensi tidak ditemukan"
                      className="w-full"
                    />
                  </div>
                  <div className="space-y-1 md:col-span-1 xl:col-span-2">
                    <Label>Cara Pakai</Label>
                    <Combobox
                      options={INSTRUCTION_OPTIONS}
                      value={racikanDraft.instructions}
                      onValueChange={(value) => setRacikanDraft((prev) => ({ ...prev, instructions: value }))}
                      allowCustomValue
                      placeholder="Pilih cara pakai"
                      searchPlaceholder="Cari cara pakai..."
                      emptyText="Cara pakai tidak ditemukan"
                      className="w-full"
                    />
                  </div>
                </div>
              </div>

              <div className="rounded-lg border p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <h4 className="text-sm font-semibold">Komponen Terpilih</h4>
                    <p className="text-xs text-muted-foreground">Atur jumlah tiap bahan tanpa keluar dari modal.</p>
                  </div>
                  <Badge variant="secondary">{racikanItems.length}</Badge>
                </div>

                {racikanItems.length > 0 ? (
                  <div className="overflow-x-auto rounded-md border">
                    <table className="w-full min-w-[780px] text-sm">
                      <thead className="bg-muted/50 border-b">
                        <tr>
                          <th className="py-2 px-3 text-left font-medium">Nama Bahan</th>
                          <th className="py-2 px-3 text-left font-medium w-[140px]">Dosis Bahan</th>
                          <th className="py-2 px-3 text-left font-medium w-[140px]">Qty Bahan</th>
                          <th className="py-2 px-3 text-left font-medium w-[180px]">Info</th>
                          <th className="py-2 px-3 text-center font-medium w-[72px]">Aksi</th>
                        </tr>
                      </thead>
                      <tbody>
                        {racikanItems.map((item, index) => (
                          <tr key={`racikan-item-${item.id}-${index}`} className="border-t align-top">
                            <td className="py-2 px-3">
                              <p className="font-medium text-sm truncate">{item.medicine.name}</p>
                              <p className="text-xs text-muted-foreground truncate">{item.medicine.code}</p>
                            </td>
                            <td className="py-2 px-3">
                              <Input
                                value={item.dosage || ""}
                                onChange={(e) => handleUpdateRacikanItemDosage(index, e.target.value)}
                                placeholder="Contoh: 1/2 tablet"
                                className="h-8"
                              />
                            </td>
                            <td className="py-2 px-3">
                              <Input
                                type="number"
                                min={1}
                                max={rmDuplicateMode ? undefined : item.available_stock}
                                value={item.quantity}
                                onChange={(e) => handleUpdateRacikanItemQuantity(index, Number(e.target.value))}
                                className="h-8 w-28"
                              />
                            </td>
                            <td className="py-2 px-3 text-xs text-muted-foreground">
                              {rmDuplicateMode ? `Harga ${formatRupiah(item.unit_price || 0)}` : `Stok tersedia ${item.available_stock ?? item.quantity} ${item.medicine.unit}`}
                            </td>
                            <td className="py-2 px-3 text-center">
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive"
                                onClick={() => handleRemoveRacikanItem(index)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
                    Belum ada komponen racikan. Pilih bahan dari panel kanan.
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-lg border p-4 space-y-3 h-fit">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h4 className="text-sm font-semibold">Pilih Bahan Obat</h4>
                  <p className="text-xs text-muted-foreground">Daftar dipersingkat saat belum mencari supaya modal lebih fokus.</p>
                </div>
                <Badge variant="outline">{filteredRacikanMedicines.length} kandidat</Badge>
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Cari nama atau kode obat..."
                  className="pl-9"
                  value={racikanSearchTerm}
                  onChange={(e) => setRacikanSearchTerm(e.target.value)}
                />
              </div>
              <ScrollArea className="h-[24rem] border rounded-md">
                <div className="divide-y">
                  {filteredRacikanMedicines.length === 0 ? (
                    <div className="text-center py-8 text-sm text-muted-foreground">
                      {racikanSearchTerm ? "Tidak ada obat yang sesuai" : "Semua bahan sudah dipilih"}
                    </div>
                  ) : (
                    filteredRacikanMedicines.map((rm) => (
                      <button
                        key={`racikan-pick-${rm.id}`}
                        type="button"
                        className="w-full p-3 hover:bg-muted/50 flex items-start justify-between gap-3 text-left"
                        onClick={() => handleAddRacikanItem(rm)}
                      >
                        <div className="min-w-0">
                          <p className="font-medium text-sm truncate">{rm.medicine.name}</p>
                          <p className="text-xs text-muted-foreground truncate">
                            {rm.medicine.code} • {rm.medicine.form || "-"} • {rm.medicine.strength || "-"}
                          </p>
                        </div>
                        <Badge variant={rm.quantity > rm.min_quantity ? "default" : "destructive"} className="shrink-0">
                          {rmDuplicateMode ? `Harga ${formatRupiah(rm.unit_price || 0)}` : `Stok ${rm.quantity}`}
                        </Badge>
                      </button>
                    ))
                  )}
                </div>
              </ScrollArea>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRacikanDialog(false)}>
              Tutup
            </Button>
            <Button onClick={handleSaveNewRacikan} disabled={submitting || racikanItems.length === 0}>
              Simpan Racikan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={editItemDialogOpen}
        onOpenChange={(open) => {
          setEditItemDialogOpen(open);
          if (!open) {
            setEditingItem(null);
            setEditItemMedicineSearchTerm("");
          }
        }}
      >
        <DialogContent className="w-[calc(100vw-1rem)] sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Detail Obat</DialogTitle>
            <DialogDescription>
              Ubah obat, jumlah, dosis, frekuensi, cara pakai, dan catatan tambahan dari tombol aksi.
            </DialogDescription>
          </DialogHeader>

          {editingItem && editingItemRow ? (
            <div className="space-y-4">
              <div className="rounded-md border bg-muted/20 px-3 py-2">
                <p className="font-medium">{selectedEditingMedicine?.medicine.name || editingItem.medicine?.name || "Obat"}</p>
                <p className="text-xs text-muted-foreground">{selectedEditingMedicine?.medicine.code || editingItem.medicine?.code || "-"}</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1 md:col-span-2">
                  <Label>Ganti Obat</Label>
                  <Combobox
                    options={editItemMedicineOptions}
                    value={String(editingItemRow.medicine_id)}
                    onValueChange={(value) => {
                      if (editingItemRowKey === null) return;
                      const nextMedicine = (rmDuplicateMode ? searchResults : roomMedicines).find(
                        (roomMedicine) => roomMedicine.medicine.id === Number(value),
                      );
                      if (!nextMedicine) return;
                      updateRowEdit(editingItemRowKey, "medicine_id", nextMedicine.medicine.id);
                      updateRowEdit(editingItemRowKey, "unit", nextMedicine.medicine.unit);
                      updateRowEdit(editingItemRowKey, "dosage", nextMedicine.medicine.strength || "");
                      updateRowEdit(
                        editingItemRowKey,
                        "quantity",
                        rmDuplicateMode ? editingItemRow.quantity : Math.min(editingItemRow.quantity, Math.max(1, nextMedicine.quantity)),
                      );
                    }}
                    onSearchChange={setEditItemMedicineSearchTerm}
                    placeholder="Pilih obat pengganti"
                    searchPlaceholder="Cari obat..."
                    emptyText="Obat tidak ditemukan"
                    disabled={editingItemLocked}
                    className="w-full"
                  />
                </div>
                <div className="space-y-1">
                  <Label>Jumlah</Label>
                  <Input
                    type="number"
                    min={1}
                    max={!rmDuplicateMode && editingItemAvailableStock > 0 ? editingItemAvailableStock : undefined}
                    value={editingItemRow.quantity}
                    onChange={(e) => {
                      if (editingItemRowKey === null) return;
                      updateRowEdit(editingItemRowKey, "quantity", Number(e.target.value) || 1);
                    }}
                    disabled={editingItemLocked}
                  />
                  {!rmDuplicateMode && editingItemAvailableStock > 0 && (
                    <p className="text-[11px] text-muted-foreground">Maks stok: {editingItemAvailableStock}</p>
                  )}
                </div>
                <div className="space-y-1">
                  <Label>Dosis</Label>
                  <Input
                    value={editingItemRow.dosage}
                    onChange={(e) => {
                      if (editingItemRowKey === null) return;
                      updateRowEdit(editingItemRowKey, "dosage", e.target.value);
                    }}
                    disabled={editingItemLocked}
                  />
                </div>
                <div className="space-y-1">
                  <Label>Frekuensi</Label>
                  <Combobox
                    options={FREQUENCY_OPTIONS}
                    value={editingItemRow.frequency}
                    onValueChange={(value) => {
                      if (editingItemRowKey === null) return;
                      updateRowEdit(editingItemRowKey, "frequency", value);
                    }}
                    allowCustomValue
                    placeholder="Pilih frekuensi"
                    searchPlaceholder="Cari frekuensi..."
                    emptyText="Frekuensi tidak ditemukan"
                    disabled={editingItemLocked}
                  />
                </div>
                <div className="space-y-1">
                  <Label>Cara Pakai</Label>
                  <Combobox
                    options={INSTRUCTION_OPTIONS}
                    value={editingItemRow.instructions}
                    onValueChange={(value) => {
                      if (editingItemRowKey === null) return;
                      updateRowEdit(editingItemRowKey, "instructions", value);
                    }}
                    allowCustomValue
                    placeholder="Pilih cara pakai"
                    searchPlaceholder="Cari cara pakai..."
                    emptyText="Cara pakai tidak ditemukan"
                    className="w-full"
                  />
                </div>
                <div className="space-y-1 md:col-span-2">
                  <Label>Catatan Tambahan</Label>
                  <Input
                    value={editingItemRow.notes}
                    onChange={(e) => {
                      if (editingItemRowKey === null) return;
                      updateRowEdit(editingItemRowKey, "notes", e.target.value);
                    }}
                    disabled={editingItemLocked}
                    placeholder="Opsional"
                  />
                </div>
              </div>
            </div>
          ) : null}

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditItemDialogOpen(false)}>
              Batal
            </Button>
            <Button
              onClick={handleSubmitEditItem}
              disabled={
                !editingItem ||
                !editingItemRow ||
                editingItemLocked ||
                (editingItem?.id ? savingRowId === editingItem.id : false)
              }
            >
              {editingItem?.id && savingRowId === editingItem.id ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : null}
              Simpan Perubahan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={editRacikanDialogOpen}
        onOpenChange={(open) => {
          setEditRacikanDialogOpen(open);
          if (!open) {
            setEditingRacikanKey(null);
            setEditingRacikanItems([]);
            setEditRacikanSearchTerm("");
          }
        }}
      >
        <DialogContent className="w-[calc(100vw-1rem)] sm:max-w-[96vw] 2xl:max-w-[1440px] max-h-[92vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Edit Detail Racikan</DialogTitle>
            <DialogDescription>
              Atur detail racikan dan jumlah bahan dari satu tombol aksi.
            </DialogDescription>
          </DialogHeader>

          {editingRacikanRow ? (
            <div className="grid flex-1 gap-4 overflow-y-auto pr-1 xl:grid-cols-[minmax(0,1.2fr)_minmax(400px,0.8fr)]">
              <div className="space-y-4">
                <div className="rounded-lg border p-4 space-y-4">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <h4 className="text-sm font-semibold">Detail Racikan</h4>
                      <p className="text-xs text-muted-foreground">Atur identitas racikan dan aturan pakai tanpa field yang tidak diperlukan.</p>
                    </div>
                    <Badge variant="outline">{editingRacikanItems.length} komponen</Badge>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label>Nama Racikan</Label>
                      <Input
                        value={editingRacikanRow.racikan_name || ""}
                        onChange={(e) => updateRacikanGroupEdit(editingRacikanItems, "racikan_name", e.target.value)}
                        disabled={editingRacikanLocked}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>Jenis Racikan</Label>
                      <Select
                        value={editingRacikanRow.racikan_type || RACIKAN_TYPE_OPTIONS[0]}
                        onValueChange={(value) => updateRacikanGroupEdit(editingRacikanItems, "racikan_type", value)}
                        disabled={editingRacikanLocked}
                      >
                        <SelectTrigger><SelectValue placeholder="Pilih jenis" /></SelectTrigger>
                        <SelectContent>
                          {RACIKAN_TYPE_OPTIONS.map((option) => (
                            <SelectItem key={`edit-group-type-${option}`} value={option}>{option}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <Label>Jumlah Hasil</Label>
                      <Input
                        type="number"
                        min={1}
                        value={editingRacikanRow.racikan_qty || 1}
                        onChange={(e) => updateRacikanGroupEdit(editingRacikanItems, "racikan_qty", Number(e.target.value) || 1)}
                        disabled={editingRacikanLocked}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>Satuan Hasil</Label>
                      <Input
                        value={editingRacikanRow.racikan_unit || "bungkus"}
                        onChange={(e) => updateRacikanGroupEdit(editingRacikanItems, "racikan_unit", e.target.value)}
                        disabled={editingRacikanLocked}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>Dosis</Label>
                      <Input
                        value={editingRacikanRow.dosage}
                        onChange={(e) => updateRacikanGroupEdit(editingRacikanItems, "dosage", e.target.value)}
                        disabled={editingRacikanLocked}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <Label>Frekuensi</Label>
                      <Combobox
                        options={FREQUENCY_OPTIONS}
                        value={editingRacikanRow.frequency}
                        onValueChange={(value) => updateRacikanGroupEdit(editingRacikanItems, "frequency", value)}
                        allowCustomValue
                        placeholder="Pilih frekuensi"
                        searchPlaceholder="Cari frekuensi..."
                        emptyText="Frekuensi tidak ditemukan"
                        className="w-full"
                      />
                    </div>
                    <div className="space-y-1 md:col-span-1 xl:col-span-2">
                      <Label>Cara Pakai</Label>
                      <Combobox
                        options={INSTRUCTION_OPTIONS}
                        value={editingRacikanRow.instructions}
                        onValueChange={(value) => updateRacikanGroupEdit(editingRacikanItems, "instructions", value)}
                        allowCustomValue
                        placeholder="Pilih cara pakai"
                        searchPlaceholder="Cari cara pakai..."
                        emptyText="Cara pakai tidak ditemukan"
                        className="w-full"
                      />
                    </div>
                  </div>
                </div>

                <div className="rounded-lg border p-4 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <h4 className="text-sm font-semibold">Komponen Racikan</h4>
                      <p className="text-xs text-muted-foreground">Jumlah bahan bisa diedit langsung tanpa tabel panjang.</p>
                    </div>
                    <Badge variant="secondary">{editingRacikanItems.length}</Badge>
                  </div>

                  <div className="overflow-x-auto rounded-md border">
                    <table className="w-full min-w-[720px] text-sm">
                      <thead className="bg-muted/50 border-b">
                        <tr>
                          <th className="py-2 px-3 text-left font-medium">Nama Bahan</th>
                          <th className="py-2 px-3 text-left font-medium w-[140px]">Dosis Bahan</th>
                          <th className="py-2 px-3 text-left font-medium w-[140px]">Qty Bahan</th>
                          <th className="py-2 px-3 text-left font-medium w-[180px]">Info</th>
                          <th className="py-2 px-3 text-right font-medium w-[140px]">Subtotal</th>
                        </tr>
                      </thead>
                      <tbody>
                        {editingRacikanItems.map((item, index) => {
                          const actualIndex = activeItems.findIndex((candidate) => candidate.id === item.id);
                          const rowKey = getRowKey(item, actualIndex >= 0 ? actualIndex : index);
                          const row = getRowEditData(item, actualIndex >= 0 ? actualIndex : index);
                          const stock = roomMedicines.find((rm) => rm.medicine.id === item.medicine_id)?.quantity || 0;
                          const unitPrice = getUnitPrice(item);

                          return (
                            <tr key={`edit-racikan-component-${item.id || index}`} className="border-t align-top">
                              <td className="py-2 px-3">
                                <p className="font-medium text-sm truncate">{item.medicine?.name || "Komponen"}</p>
                                <p className="text-xs text-muted-foreground truncate">{item.medicine?.code || "-"}</p>
                              </td>
                              <td className="py-2 px-3 text-sm">{row.dosage || "-"}</td>
                              <td className="py-2 px-3">
                                <Input
                                  type="number"
                                  min={1}
                                  max={!rmDuplicateMode && stock > 0 ? stock : undefined}
                                  value={row.quantity}
                                  onChange={(e) => updateRowEdit(rowKey, "quantity", Number(e.target.value) || 1)}
                                  disabled={editingRacikanLocked}
                                  className="h-8 w-28"
                                />
                              </td>
                              <td className="py-2 px-3 text-xs text-muted-foreground">
                                {rmDuplicateMode ? formatRupiah(unitPrice) : `Maks ${stock} ${row.unit || item.unit}`}
                              </td>
                              <td className="py-2 px-3 text-right font-medium">{formatRupiah(Number(row.quantity || 0) * unitPrice)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {!editingRacikanLocked ? (
                <div className="rounded-lg border p-4 space-y-3 h-fit">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <h4 className="text-sm font-semibold">Tambah Bahan</h4>
                      <p className="text-xs text-muted-foreground">Pilih komponen tambahan tanpa menambah tinggi modal.</p>
                    </div>
                    <Badge variant="outline">{filteredEditRacikanMedicines.length} kandidat</Badge>
                  </div>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Cari nama atau kode obat..."
                      className="pl-9"
                      value={editRacikanSearchTerm}
                      onChange={(e) => setEditRacikanSearchTerm(e.target.value)}
                    />
                  </div>
                  <ScrollArea className="h-[24rem] border rounded-md">
                    <div className="divide-y">
                      {filteredEditRacikanMedicines.length === 0 ? (
                        <div className="text-center py-6 text-sm text-muted-foreground">
                          {editRacikanSearchTerm ? "Obat tidak ditemukan" : "Tidak ada kandidat obat"}
                        </div>
                      ) : (
                        filteredEditRacikanMedicines.map((rm) => (
                          <button
                            key={`edit-racikan-add-${rm.id}`}
                            type="button"
                            className="w-full p-3 hover:bg-muted/50 flex items-start justify-between gap-3 text-left"
                            onClick={() => handleAddEditRacikanItem(rm)}
                          >
                            <div className="min-w-0">
                              <p className="font-medium text-sm truncate">{rm.medicine.name}</p>
                              <p className="text-xs text-muted-foreground truncate">{rm.medicine.code} • {rm.medicine.strength || "-"}</p>
                            </div>
                            <Badge variant={rm.quantity > rm.min_quantity ? "default" : "destructive"} className="shrink-0">
                              {rmDuplicateMode ? `Harga ${formatRupiah(rm.unit_price || 0)}` : `Stok ${rm.quantity}`}
                            </Badge>
                          </button>
                        ))
                      )}
                    </div>
                  </ScrollArea>
                </div>
              ) : (
                <div className="rounded-lg border p-4 text-sm text-muted-foreground h-fit">
                  Komponen racikan sudah diproses sehingga perubahan bahan tidak dapat dilakukan.
                </div>
              )}
            </div>
          ) : null}

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditRacikanDialogOpen(false)}>
              Batal
            </Button>
            <Button
              onClick={handleSubmitEditRacikan}
              disabled={
                editingRacikanItems.length === 0 ||
                editingRacikanLocked ||
                (editingRacikanKey ? savingGroupKey === editingRacikanKey : false)
              }
            >
              {editingRacikanKey && savingGroupKey === editingRacikanKey ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : null}
              Simpan Racikan
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