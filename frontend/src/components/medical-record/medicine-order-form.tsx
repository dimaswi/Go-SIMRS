import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { Combobox } from "@/components/ui/combobox";
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
  Pencil,
  Trash2,
  Search,
  Pill,
  Clock,
  Send,
  Printer,
  Package,
  BookmarkPlus,
  FlaskConical,
  CheckCircle2,
} from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { roomsApi, medicineOrdersApi, getPharmacyRoomMedicines, printApi, medicalRecordsApi } from "@/lib/api";
import { getDoctorItemsFromOrder } from "@/lib/api/medicine-orders";
import {
  medicineOrderTemplatesApi,
  type DoctorMedicineTemplate,
} from "@/lib/api/medicine-order-templates";
import type {
  MedicineOrder,
  CreateMedicineOrderInput,
  MedicineFulfillmentType,
} from "@/lib/api";
import {
  derivePrescriptionTypeFromItems,
  groupMedicineOrderItems,
  MEDICINE_ORDER_ITEM_TYPE_NON_RACIKAN,
  MEDICINE_ORDER_ITEM_TYPE_RACIKAN,
  RACIKAN_TYPE_OPTIONS,
} from "@/lib/medicine-order-racikan";

const FOOTER_ACTION_EVENT = "medical-record-footer-action";

interface MedicineOrderFormProps {
  visitId: number;
  registrationId: number;
  sourceRoomId: number;
  sourceServiceType?: string;
  readOnly?: boolean;
}

interface OrderItem {
  medicine_id: number;
  medicine_name: string;
  medicine_code: string;
  item_type?: string;
  racikan_group?: string;
  racikan_name?: string;
  racikan_type?: string;
  racikan_qty?: number;
  racikan_unit?: string;
  quantity: number;
  unit: string;
  dosage: string;
  frequency: string;
  route: string;
  duration: string;
  instructions: string;
  notes: string;
  available_stock: number;
  unit_price: number;
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
  notes: string;
}

interface RacikanEditMeta {
  name: string;
  type: string;
  qty: number;
  unit: string;
  dosage: string;
  frequency: string;
  route: string;
  duration: string;
  instructions: string;
  notes: string;
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
    selling_price?: number;
    price?: number;
    unit_price?: number;
  };
  quantity: number;
  min_quantity: number;
  unit_price?: number;
  price?: number;
  selling_price?: number;
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

const FULFILLMENT_TYPE_LABELS: Record<MedicineFulfillmentType, string> = {
  in_room: "Dipakai di Ruangan",
  take_home: "Dibawa Pulang",
};

// Collapsible Order Item Component
function OrderCollapsible({ order, onCancel, canCancel }: { order: MedicineOrder; onCancel?: (id: number) => void; canCancel?: boolean }) {
  const [isOpen, setIsOpen] = useState(false);
  const [printingResep, setPrintingResep] = useState(false);
  const [expandedHistoryRacikanGroups, setExpandedHistoryRacikanGroups] = useState<Record<string, boolean>>({});
  const { toast } = useToast();

  const displayItems = useMemo(() => getDoctorItemsFromOrder(order), [order]);
  const groupedOrderItems = useMemo(
    () => groupMedicineOrderItems(displayItems),
    [displayItems],
  );

  const handlePrintResep = async () => {
    setPrintingResep(true);
    try {
      await printApi.prescription(order.id, { version: "doctor" });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.response?.data?.error || "Gagal mencetak resep",
        variant: "destructive",
      });
    } finally {
      setPrintingResep(false);
    }
  };

  const toggleHistoryRacikanGroup = (groupKey: string) => {
    setExpandedHistoryRacikanGroups((prev) => ({
      ...prev,
      [groupKey]: !prev[groupKey],
    }));
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div className="px-3.5 py-2.5 hover:bg-muted/30 transition-colors">
        <div className="flex items-center justify-between gap-2">
          <CollapsibleTrigger className="flex items-center gap-2 flex-1 text-left">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="font-mono font-bold text-xs">{order.order_number}</span>
                <Badge
                  variant={ORDER_STATUS_LABELS[order.status]?.variant || "secondary"}
                  className="rounded-none text-[10px] h-5 px-1.5"
                >
                  {ORDER_STATUS_LABELS[order.status]?.label || order.status}
                </Badge>
                <Badge
                  variant={order.fulfillment_type === "in_room" ? "outline" : "secondary"}
                  className="rounded-none text-[10px] h-5 px-1.5"
                >
                  {FULFILLMENT_TYPE_LABELS[order.fulfillment_type as MedicineFulfillmentType] || "Dibawa Pulang"}
                </Badge>
                {order.priority === "urgent" && (
                  <Badge variant="destructive" className="rounded-none text-[10px] h-5 px-1.5">
                    Urgent
                  </Badge>
                )}
                {order.pharmacy_visit?.room_queue && (
                  <Badge variant="outline" className="rounded-none text-[10px] h-5 px-1.5 font-mono">
                    Antrian: {order.pharmacy_visit.room_queue.queue_number}
                  </Badge>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {new Date(order.created_at).toLocaleString("id-ID")} • {order.pharmacy_room?.name} • {groupedOrderItems.length || 0} entri
              </p>
            </div>
          </CollapsibleTrigger>
          <div className="flex items-center gap-1.5 flex-wrap">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 rounded-none text-xs gap-1.5 px-2.5"
              disabled={printingResep}
              onClick={handlePrintResep}
              title="Cetak Resep"
            >
              {printingResep ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Printer className="h-3.5 w-3.5" />}
              <span className="hidden sm:inline">Cetak Resep</span>
            </Button>

            {order.status === "pending" && canCancel && onCancel && (
              <TooltipProvider delayDuration={120}>
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
              </TooltipProvider>
            )}
          </div>
        </div>
        <CollapsibleContent>
          <div className="mt-3 pt-3 border-t border-neutral-200 dark:border-neutral-800 space-y-3">
            {/* Order Info Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/30 p-2.5 text-xs">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">Farmasi Tujuan</span>
                <span className="font-semibold text-foreground">{order.pharmacy_room?.name || "-"}</span>
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">Prioritas</span>
                <span className="font-semibold text-foreground">{order.priority === "urgent" ? "Urgent" : "Normal"}</span>
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">Pemakaian Obat</span>
                <span className="font-semibold text-foreground">
                  {FULFILLMENT_TYPE_LABELS[order.fulfillment_type as MedicineFulfillmentType] || "Dibawa Pulang"}
                </span>
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">Diagnosis</span>
                <span className="font-medium text-foreground">{order.diagnosis || "-"}</span>
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">Catatan</span>
                <span className="font-medium text-foreground">{order.notes || "-"}</span>
              </div>
            </div>

            {displayItems && displayItems.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <span className="border-l-2 border-neutral-900 dark:border-neutral-100 pl-2 text-[11px] font-bold uppercase tracking-wider text-neutral-800 dark:text-neutral-200">
                    Daftar Item Resep
                  </span>
                </div>
                <div className="border border-neutral-200 dark:border-neutral-800 overflow-x-auto">
                  <table className="w-full min-w-[760px] text-xs">
                    <thead className="bg-neutral-50 dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800">
                      <tr>
                        <th className="h-8 px-3 text-left font-bold uppercase tracking-wider text-muted-foreground">Nama Item</th>
                        <th className="h-8 px-3 text-left font-bold uppercase tracking-wider text-muted-foreground">Detail</th>
                        <th className="h-8 px-3 text-left font-bold uppercase tracking-wider text-muted-foreground w-[160px]">Jumlah</th>
                      </tr>
                    </thead>
                    <tbody>
                      {groupedOrderItems.map((group) => {
                        if (group.type === "racikan") {
                          const groupKey = group.racikanGroup || group.key;
                          const isExpanded = expandedHistoryRacikanGroups[groupKey] ?? true;

                          return (
                            <Fragment key={group.key}>
                              <tr className="border-t border-neutral-200 dark:border-neutral-800 bg-neutral-50/60 dark:bg-neutral-900/40 align-top">
                                <td className="py-2 px-3">
                                  <button
                                    type="button"
                                    className="flex w-full items-start gap-2 text-left"
                                    onClick={() => toggleHistoryRacikanGroup(groupKey)}
                                  >
                                    <div className="min-w-0">
                                      <div className="flex items-center gap-2">
                                        <span className="font-semibold truncate">{group.racikanName || "Racikan"}</span>
                                        <Badge variant="secondary" className="rounded-none h-5 px-1.5 text-[10px]">Racikan</Badge>
                                      </div>
                                      <p className="text-[11px] text-muted-foreground truncate">
                                        {group.racikanType || "Tanpa jenis"} • {group.items.length} komponen
                                      </p>
                                    </div>
                                  </button>
                                </td>
                                <td className="py-2 px-3">
                                  <p className="truncate">
                                    {(group.sharedFields.dosage || "-") + " • " + (group.sharedFields.frequency || "-")}
                                  </p>
                                  <p className="text-[11px] text-muted-foreground truncate">Instruksi: {group.sharedFields.instructions || "-"}</p>
                                  {group.sharedFields.notes ? (
                                    <p className="text-[11px] text-muted-foreground truncate">Catatan: {group.sharedFields.notes}</p>
                                  ) : null}
                                </td>
                                <td className="py-2 px-3 font-semibold">{group.racikanQty || 1} {group.racikanUnit || "bungkus"}</td>
                              </tr>
                              {isExpanded &&
                                group.items.map((item, componentIndex) => (
                                  <tr key={`${group.key}-${item.id || componentIndex}`} className="border-t border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950">
                                    <td className="py-2 px-3 pl-9">
                                      <div className="flex items-center gap-2 min-w-0">
                                        <span className="h-px w-3 bg-border" />
                                        <span className="truncate text-muted-foreground">{item.medicine?.name || "Obat"}</span>
                                      </div>
                                    </td>
                                    <td className="py-2 px-3 text-[11px] text-muted-foreground">
                                      {item.dosage ? `Dosis: ${item.dosage}` : "Komponen racikan"}
                                    </td>
                                    <td className="py-2 px-3">{item.quantity} {item.unit}</td>
                                  </tr>
                                ))}
                            </Fragment>
                          );
                        }

                        const item = group.items[0];
                        const detailSummary = [item.dosage || "-", item.frequency || "-"].join(" • ");
                        return (
                          <tr key={group.key} className="border-t border-neutral-200 dark:border-neutral-800">
                            <td className="py-2 px-3">
                              <p className="font-semibold truncate">{item.medicine?.name}</p>
                            </td>
                            <td className="py-2 px-3">
                              <p className="truncate">{detailSummary}</p>
                              <p className="text-[11px] text-muted-foreground truncate">Instruksi: {item.instructions || "-"}</p>
                              {item.notes ? <p className="text-[11px] text-muted-foreground truncate">Catatan: {item.notes}</p> : null}
                            </td>
                            <td className="py-2 px-3 font-semibold">{item.quantity} {item.unit}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

export function MedicineOrderForm({ visitId, sourceServiceType, readOnly = false }: MedicineOrderFormProps) {
  const { toast } = useToast();
  const { hasPermission } = usePermission();

  const initialFulfillmentType: MedicineFulfillmentType = sourceServiceType === "rawat_inap" ? "in_room" : "take_home";

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
  const [fulfillmentType, setFulfillmentType] = useState<MedicineFulfillmentType>(initialFulfillmentType);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showTemplateDialog, setShowTemplateDialog] = useState(false);
  const [showCreateTemplateDialog, setShowCreateTemplateDialog] = useState(false);
  const [templateSearchTerm, setTemplateSearchTerm] = useState("");
  const [templateName, setTemplateName] = useState("");
  const [templateNotes, setTemplateNotes] = useState("");
  const [bindTemplateToDPJP, setBindTemplateToDPJP] = useState(false);
  const [templateSaving, setTemplateSaving] = useState(false);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [doctorTemplates, setDoctorTemplates] = useState<DoctorMedicineTemplate[]>([]);
  const [templateItems, setTemplateItems] = useState<OrderItem[]>([]);
  const [templateMedicineSearch, setTemplateMedicineSearch] = useState("");
  const [itemErrors, setItemErrors] = useState<Record<number, string[]>>({});
  const [expandedRacikanGroups, setExpandedRacikanGroups] = useState<Record<string, boolean>>({});
  const [showRacikanDialog, setShowRacikanDialog] = useState(false);
  const [racikanSearchTerm, setRacikanSearchTerm] = useState("");
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
    notes: "",
  });
  const [racikanItems, setRacikanItems] = useState<OrderItem[]>([]);
  const [showEditItemDialog, setShowEditItemDialog] = useState(false);
  const [editingItemIndex, setEditingItemIndex] = useState<number | null>(null);
  const [editingItemDraft, setEditingItemDraft] = useState<OrderItem | null>(null);
  const [editingMedicineSearch, setEditingMedicineSearch] = useState("");
  const [showEditRacikanDialog, setShowEditRacikanDialog] = useState(false);
  const [editingRacikanKey, setEditingRacikanKey] = useState<string | null>(null);
  const [editingRacikanMeta, setEditingRacikanMeta] = useState<RacikanEditMeta>({
    name: "",
    type: RACIKAN_TYPE_OPTIONS[0],
    qty: 1,
    unit: "bungkus",
    dosage: "",
    frequency: "",
    route: "",
    duration: "",
    instructions: "",
    notes: "",
  });
  const [editingRacikanComponents, setEditingRacikanComponents] = useState<OrderItem[]>([]);
  const [editingRacikanSearch, setEditingRacikanSearch] = useState("");
  const [cancelConfirmOrderId, setCancelConfirmOrderId] = useState<number | null>(null);

  const formatRupiah = (value: number) =>
    new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 0,
    }).format(value || 0);

  const routeOptions = [
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

  const signaOptions = [
    "3 x 1 Setelah Makan",
    "3 x 1 Sebelum Makan",
    "3 x 1 Bersama Makan",
    "2 x 1 Setelah Makan",
    "2 x 1 Sebelum Makan",
    "2 x 1 Pagi & Malam",
    "1 x 1 Pagi Hari Setelah Makan",
    "1 x 1 Malam Hari Setelah Makan",
    "1 x 1 Sebelum Tidur",
    "4 x 1 Setelah Makan",
    "1 x 1 Tablet Bila Perlu (PRN)",
    "3 x 1 Sendok Takar (5 ml)",
    "2 x 1 Sendok Takar (5 ml)",
    "1 x 1 Sendok Takar (5 ml)",
    "1 x 1 Tetes Pada Mata/Telinga",
    "2 x 1 Tetes Pada Mata/Telinga",
    "3 x 1 Tetes Pada Mata/Telinga",
    "Oleskan Tipis 2x Sehari (Topikal)",
    "Oleskan Tipis 3x Sehari (Topikal)",
    "Bila Perlu / Jika Demam (P.R.N)",
    "Bila Nyeri (P.R.N)",
    "Sebelum Makan",
    "Setelah Makan",
    "1x Sehari",
    "2x Sehari",
    "3x Sehari",
  ].map((o) => ({ value: o, label: o }));

  // Only pharmacy rooms with service_type 'farmasi' (exclude depo_farmasi)
  // const isPharmacyRoom = (room: any) =>
  //   room.service_type === 'farmasi' &&
  //   room.room_type !== 'depo_farmasi' &&
  //   room.is_active;

  useEffect(() => {
    loadData();
  }, [visitId]);

  useEffect(() => {
    setFulfillmentType(sourceServiceType === "rawat_inap" ? "in_room" : "take_home");
  }, [sourceServiceType, visitId]);

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

      // Load pharmacy rooms
      const roomsRes = await roomsApi.getPharmacyRooms();
      const pharmRooms = roomsRes.data?.data || [];
      setPharmacyRooms(pharmRooms);

      // Load private doctor templates (optionally scoped by DPJP of this visit)
      try {
        setLoadingTemplates(true);
        const templatesRes = await medicineOrderTemplatesApi.getAll({ source_visit_id: visitId });
        setDoctorTemplates(templatesRes.data?.data || []);
      } catch (error) {
        console.error("Error loading doctor templates:", error);
        setDoctorTemplates([]);
      } finally {
        setLoadingTemplates(false);
      }

      // Auto-select first pharmacy room
      if (pharmRooms.length > 0 && !selectedPharmacyRoom) {
        setSelectedPharmacyRoom(pharmRooms[0].id);
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

  const filteredMedicines = pharmacyMedicines.filter((pm) => {
    const alreadyAdded = orderItems.some((item) => item.medicine_id === pm.medicine.id);
    if (alreadyAdded) return false;

    return (
      pm.medicine.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      pm.medicine.generic_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      pm.medicine.code.toLowerCase().includes(searchTerm.toLowerCase())
    );
  });

  const filteredRacikanMedicines = useMemo(() => {
    return pharmacyMedicines.filter((pm) => {
      const alreadyAdded = racikanItems.some((item) => item.medicine_id === pm.medicine.id);
      if (alreadyAdded) return false;

      return (
        pm.medicine.name.toLowerCase().includes(racikanSearchTerm.toLowerCase()) ||
        pm.medicine.generic_name?.toLowerCase().includes(racikanSearchTerm.toLowerCase()) ||
        pm.medicine.code.toLowerCase().includes(racikanSearchTerm.toLowerCase())
      );
    });
  }, [pharmacyMedicines, racikanItems, racikanSearchTerm]);

  const filteredTemplateMedicines = pharmacyMedicines.filter((pm) => {
    const alreadyAdded = templateItems.some((item) => item.medicine_id === pm.medicine.id);
    if (alreadyAdded) return false;

    return (
      pm.medicine.name.toLowerCase().includes(templateMedicineSearch.toLowerCase()) ||
      pm.medicine.generic_name?.toLowerCase().includes(templateMedicineSearch.toLowerCase()) ||
      pm.medicine.code.toLowerCase().includes(templateMedicineSearch.toLowerCase())
    );
  });

  const filteredEditingRacikanMedicines = useMemo(() => {
    return pharmacyMedicines.filter((pm) => {
      const alreadyAdded = editingRacikanComponents.some((item) => item.medicine_id === pm.medicine.id);
      if (alreadyAdded) return false;

      return (
        pm.medicine.name.toLowerCase().includes(editingRacikanSearch.toLowerCase()) ||
        pm.medicine.generic_name?.toLowerCase().includes(editingRacikanSearch.toLowerCase()) ||
        pm.medicine.code.toLowerCase().includes(editingRacikanSearch.toLowerCase())
      );
    });
  }, [pharmacyMedicines, editingRacikanComponents, editingRacikanSearch]);

  const filteredTemplates = useMemo(() => {
    const keyword = templateSearchTerm.trim().toLowerCase();
    if (!keyword) return doctorTemplates;
    return doctorTemplates.filter((template) =>
      [template.name, template.notes]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(keyword))
    );
  }, [doctorTemplates, templateSearchTerm]);

  const groupedDraftOrderItems = useMemo(() => groupMedicineOrderItems(orderItems), [orderItems]);
  const orderGrandTotal = orderItems.reduce((sum, item) => sum + item.quantity * item.unit_price, 0);

  const createOrderItemFromMedicine = (medicine: PharmacyMedicine): OrderItem => {
    const unitPrice =
      medicine.medicine.selling_price ||
      medicine.medicine.unit_price ||
      medicine.medicine.price ||
      medicine.unit_price ||
      medicine.price ||
      medicine.selling_price ||
      0;

    return {
      medicine_id: medicine.medicine.id,
      medicine_name: medicine.medicine.name,
      medicine_code: medicine.medicine.code,
      item_type: MEDICINE_ORDER_ITEM_TYPE_NON_RACIKAN,
      quantity: 1,
      unit: medicine.medicine.unit,
      dosage: medicine.medicine.strength || "",
      frequency: "",
      route: "",
      duration: "",
      instructions: "",
      notes: "",
      available_stock: medicine.quantity,
      unit_price: unitPrice,
    };
  };

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
      notes: "",
    });
    setRacikanItems([]);
    setRacikanSearchTerm("");
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

  const handleAddItem = (medicine: PharmacyMedicine) => {
    const item = createOrderItemFromMedicine(medicine);

    setItemErrors({});
    setSearchTerm("");
    setShowAddDialog(false);
    
    // Open edit dialog immediately for the newly selected item, but don't add to list yet
    setEditingItemIndex(-1); // -1 signifies a new pending item
    setEditingItemDraft(item);
    setShowEditItemDialog(true);
  };

  const handleAddTemplateItem = (medicine: PharmacyMedicine) => {
    const item = createOrderItemFromMedicine(medicine);

    setTemplateItems((prev) => [...prev, item]);
    setTemplateMedicineSearch("");
  };

  const handleAddRacikanComponent = (medicine: PharmacyMedicine) => {
    const item = createOrderItemFromMedicine(medicine);
    setRacikanItems((prev) => [...prev, item]);
    setRacikanSearchTerm("");
  };

  const handleUpdateRacikanDraft = (field: keyof RacikanDraft, value: string | number) => {
    setRacikanDraft((prev) => ({ ...prev, [field]: value }));
  };

  const handleUpdateRacikanItemDosage = (index: number, dosage: string) => {
    setRacikanItems((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], dosage };
      return next;
    });
  };

  const openEditItemDialog = (index: number) => {
    const item = orderItems[index];
    if (!item) return;
    setEditingItemIndex(index);
    setEditingItemDraft({ ...item });
    setShowEditItemDialog(true);
  };

  const handleSaveEditedItem = () => {
    if (editingItemIndex === null || !editingItemDraft) return;

    if (!editingItemDraft.quantity || editingItemDraft.quantity <= 0) {
      toast({ variant: "destructive", title: "Jumlah harus lebih dari 0" });
      return;
    }
    if (editingItemDraft.quantity > editingItemDraft.available_stock) {
      toast({ variant: "destructive", title: "Jumlah melebihi stok" });
      return;
    }
    if (!editingItemDraft.dosage?.trim() || !editingItemDraft.instructions?.trim()) {
      toast({
        variant: "destructive",
        title: "Data resep belum lengkap",
        description: "Lengkapi dosis dan signa.",
      });
      return;
    }

    const finalDraft = {
      ...editingItemDraft,
      frequency: editingItemDraft.frequency || editingItemDraft.instructions,
    };

    if (editingItemIndex === -1) {
      setOrderItems((prev) => [...prev, finalDraft]);
    } else {
      setOrderItems((prev) => prev.map((item, idx) => (idx === editingItemIndex ? finalDraft : item)));
    }
    
    setItemErrors({});
    setShowEditItemDialog(false);
    setEditingItemIndex(null);
    setEditingItemDraft(null);
  };

  const openEditRacikanDialog = (group: any) => {
    const groupKey = group.racikanGroup || group.key;
    setEditingRacikanKey(groupKey);
    setEditingRacikanMeta({
      name: group.racikanName || "",
      type: group.racikanType || RACIKAN_TYPE_OPTIONS[0],
      qty: group.racikanQty || 1,
      unit: group.racikanUnit || "bungkus",
      dosage: group.sharedFields.dosage || "",
      frequency: group.sharedFields.frequency || "",
      route: group.sharedFields.route || "",
      duration: group.sharedFields.duration || "",
      instructions: group.sharedFields.instructions || "",
      notes: group.sharedFields.notes || "",
    });
    setEditingRacikanComponents(group.items.map((item: OrderItem) => ({ ...item })));
    setEditingRacikanSearch("");
    setShowEditRacikanDialog(true);
  };

  const handleAddEditingRacikanComponent = (medicine: PharmacyMedicine) => {
    const alreadyExists = editingRacikanComponents.some((item) => item.medicine_id === medicine.medicine.id);
    if (alreadyExists) {
      toast({
        title: "Obat sudah ada",
        description: "Obat ini sudah menjadi komponen racikan.",
      });
      return;
    }

    const groupKey = editingRacikanKey || createRacikanGroupKey();
    if (!editingRacikanKey) {
      setEditingRacikanKey(groupKey);
    }

    const item = createOrderItemFromMedicine(medicine);
    setEditingRacikanComponents((prev) => [
      ...prev,
      {
        ...item,
        item_type: MEDICINE_ORDER_ITEM_TYPE_RACIKAN,
        racikan_group: groupKey,
        racikan_name: editingRacikanMeta.name,
        racikan_type: editingRacikanMeta.type,
        racikan_qty: editingRacikanMeta.qty,
        racikan_unit: editingRacikanMeta.unit,
        frequency: editingRacikanMeta.frequency,
        route: editingRacikanMeta.route,
        duration: editingRacikanMeta.duration,
        instructions: editingRacikanMeta.instructions,
        notes: editingRacikanMeta.notes || "",
      },
    ]);
    setEditingRacikanSearch("");
  };

  const handleEditRacikanComponentDosage = (index: number, dosage: string) => {
    setEditingRacikanComponents((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], dosage };
      return next;
    });
  };

  const handleRemoveEditingRacikanComponent = (index: number) => {
    setEditingRacikanComponents((prev) => prev.filter((_, itemIndex) => itemIndex !== index));
  };

  const handleSaveEditedRacikan = () => {
    if (!editingRacikanKey) return;

    if (!editingRacikanMeta.name.trim()) {
      toast({ variant: "destructive", title: "Nama racikan wajib diisi" });
      return;
    }
    if (!editingRacikanMeta.dosage.trim() || !editingRacikanMeta.instructions.trim()) {
      toast({
        variant: "destructive",
        title: "Data racikan belum lengkap",
        description: "Lengkapi dosis dan signa racikan.",
      });
      return;
    }
    if (editingRacikanComponents.length === 0) {
      toast({
        variant: "destructive",
        title: "Komponen racikan belum ada",
        description: "Tambahkan minimal satu obat ke racikan.",
      });
      return;
    }
    if (editingRacikanComponents.some((item) => !item.dosage?.trim())) {
      toast({
        variant: "destructive",
        title: "Dosis bahan belum lengkap",
        description: "Lengkapi dosis pada setiap bahan racikan.",
      });
      return;
    }

    setOrderItems((prev) => {
      const firstIndex = prev.findIndex((item) => item.racikan_group === editingRacikanKey);
      const nextItems = prev.filter((item) => item.racikan_group !== editingRacikanKey);
      const mappedComponents = editingRacikanComponents.map((item) => ({
        ...item,
        item_type: MEDICINE_ORDER_ITEM_TYPE_RACIKAN,
        racikan_group: editingRacikanKey,
        racikan_name: editingRacikanMeta.name,
        racikan_type: editingRacikanMeta.type,
        racikan_qty: Math.max(1, editingRacikanMeta.qty || 1),
        racikan_unit: editingRacikanMeta.unit.trim() || "bungkus",
        dosage: item.dosage,
        frequency: editingRacikanMeta.frequency,
        route: "",
        duration: "",
        instructions: editingRacikanMeta.instructions,
        notes: editingRacikanMeta.notes || "",
      }));

      if (firstIndex < 0) return [...nextItems, ...mappedComponents];
      return [
        ...nextItems.slice(0, firstIndex),
        ...mappedComponents,
        ...nextItems.slice(firstIndex),
      ];
    });

    setItemErrors({});
    setShowEditRacikanDialog(false);
    setEditingRacikanKey(null);
    setEditingRacikanComponents([]);
  };

  const handleRemoveRacikanItem = (index: number) => {
    setRacikanItems((prev) => prev.filter((_, itemIndex) => itemIndex !== index));
  };

  const handleSaveRacikan = () => {
    const name = racikanDraft.name.trim();
    if (!name) {
      toast({
        variant: "destructive",
        title: "Nama racikan wajib diisi",
      });
      return;
    }
    if (racikanItems.length === 0) {
      toast({
        variant: "destructive",
        title: "Komponen racikan belum ada",
        description: "Tambahkan minimal satu obat ke racikan.",
      });
      return;
    }
    if (!racikanDraft.dosage.trim() || !racikanDraft.instructions.trim()) {
      toast({
        variant: "destructive",
        title: "Data racikan belum lengkap",
        description: "Lengkapi dosis dan signa racikan.",
      });
      return;
    }
    if (racikanItems.some((item) => !item.dosage?.trim())) {
      toast({
        variant: "destructive",
        title: "Dosis bahan belum lengkap",
        description: "Lengkapi dosis pada setiap bahan racikan.",
      });
      return;
    }

    const racikanGroup = createRacikanGroupKey();
    setOrderItems((prev) => [
      ...prev,
      ...racikanItems.map((item) => ({
        ...item,
        item_type: MEDICINE_ORDER_ITEM_TYPE_RACIKAN,
        racikan_group: racikanGroup,
        racikan_name: name,
        racikan_type: racikanDraft.type,
        racikan_qty: Math.max(1, racikanDraft.quantity || 1),
        racikan_unit: racikanDraft.unit.trim() || "bungkus",
        dosage: item.dosage,
        frequency: racikanDraft.frequency,
        route: "",
        duration: "",
        instructions: racikanDraft.instructions,
        notes: racikanDraft.notes || "",
      })),
    ]);
    setExpandedRacikanGroups((prev) => ({
      ...prev,
      [racikanGroup]: true,
    }));
    setItemErrors({});
    setShowRacikanDialog(false);
    resetRacikanDraft();
  };

  const handleUpdateTemplateItemField = (index: number, field: keyof OrderItem, value: string | number) => {
    setTemplateItems((prev) => {
      const next = [...prev];
      (next[index] as any)[field] = value;
      return next;
    });
  };

  const handleUpdateTemplateItemQuantity = (index: number, quantity: number) => {
    setTemplateItems((prev) => {
      const next = [...prev];
      const maxStock = next[index].available_stock;
      next[index].quantity = Math.max(1, Math.min(quantity || 0, maxStock));
      return next;
    });
  };

  const handleRemoveTemplateItem = (index: number) => {
    setTemplateItems((prev) => {
      const next = [...prev];
      next.splice(index, 1);
      return next;
    });
  };

  const handleApplyTemplate = (template: DoctorMedicineTemplate) => {
    const templateItems = template.items || [];
    if (templateItems.length === 0) {
      toast({
        variant: "destructive",
        title: "Template kosong",
        description: "Template ini tidak memiliki item obat",
      });
      return;
    }

    const pharmacyMedicineById = new Map(pharmacyMedicines.map((pm) => [pm.medicine.id, pm]));
    const unavailable: string[] = [];
    let inserted = 0;
    let merged = 0;

    setOrderItems((prev) => {
      const next = [...prev];
      for (const item of templateItems) {
        const pm = pharmacyMedicineById.get(item.medicine_id);
        const label = item.medicine?.name || `Obat #${item.medicine_id}`;
        if (!pm) {
          unavailable.push(label);
          continue;
        }

        const qty = Math.max(1, Number(item.quantity) || 1);
        const existingIndex = next.findIndex((row) => row.medicine_id === item.medicine_id);
        if (existingIndex >= 0) {
          const current = next[existingIndex];
          next[existingIndex] = {
            ...current,
            quantity: Math.min(current.available_stock, current.quantity + qty),
            dosage: current.dosage || item.dosage || "",
            frequency: current.frequency || item.frequency || "",
            route: current.route || item.route || "oral",
            duration: current.duration || item.duration || "",
            instructions: current.instructions || item.instructions || "",
            notes: current.notes || item.notes || "",
          };
          merged += 1;
          continue;
        }

        const unitPrice =
          pm.medicine.selling_price ||
          pm.medicine.unit_price ||
          pm.medicine.price ||
          pm.unit_price ||
          pm.price ||
          pm.selling_price ||
          0;

        next.push({
          medicine_id: pm.medicine.id,
          medicine_name: pm.medicine.name,
          medicine_code: pm.medicine.code,
          item_type: MEDICINE_ORDER_ITEM_TYPE_NON_RACIKAN,
          quantity: Math.min(pm.quantity, qty),
          unit: item.unit || pm.medicine.unit,
          dosage: item.dosage || pm.medicine.strength || "",
          frequency: item.frequency || "",
          route: item.route || "oral",
          duration: item.duration || "",
          instructions: item.instructions || "",
          notes: item.notes || "",
          available_stock: pm.quantity,
          unit_price: unitPrice,
        });
        inserted += 1;
      }
      return next;
    });

    setShowTemplateDialog(false);
    setTemplateSearchTerm("");

    const summary = [`${inserted} ditambahkan`];
    if (merged > 0) summary.push(`${merged} digabung`);
    if (unavailable.length > 0) summary.push(`${unavailable.length} tidak tersedia`);

    toast({
      title: `Template "${template.name}" diterapkan`,
      description: summary.join(", "),
    });
  };

  const handleCreateTemplate = async () => {
    const name = templateName.trim();
    if (!name) {
      toast({
        variant: "destructive",
        title: "Nama template wajib diisi",
      });
      return;
    }
    if (templateItems.length === 0) {
      toast({
        variant: "destructive",
        title: "Belum ada item obat",
        description: "Tambahkan minimal satu obat ke daftar template sebelum menyimpan.",
      });
      return;
    }

    try {
      setTemplateSaving(true);
      await medicineOrderTemplatesApi.create({
        name,
        notes: templateNotes,
        source_visit_id: visitId,
        bind_to_dpjp: bindTemplateToDPJP,
        items: templateItems.map((item, index) => ({
          medicine_id: item.medicine_id,
          quantity: item.quantity,
          unit: item.unit,
          dosage: item.dosage,
          frequency: item.frequency,
          route: item.route,
          duration: item.duration,
          instructions: item.instructions,
          sort_order: index + 1,
        })),
      });

      const templatesRes = await medicineOrderTemplatesApi.getAll({ source_visit_id: visitId });
      setDoctorTemplates(templatesRes.data?.data || []);

      setTemplateName("");
      setTemplateNotes("");
      setBindTemplateToDPJP(false);
      setTemplateItems([]);
      setTemplateMedicineSearch("");
      setShowCreateTemplateDialog(false);

      toast({
        title: "Template resep disimpan",
        description: "Template dapat digunakan kembali untuk order berikutnya.",
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Gagal menyimpan template",
        description: error.response?.data?.error || "Terjadi kesalahan saat menyimpan template.",
      });
    } finally {
      setTemplateSaving(false);
    }
  };

  const handleRemoveItem = (index: number) => {
    const newItems = [...orderItems];
    newItems.splice(index, 1);
    setOrderItems(newItems);
    setItemErrors({});
  };

  const handleRemoveRacikanGroup = (racikanGroup: string) => {
    setOrderItems((prev) => prev.filter((item) => item.racikan_group !== racikanGroup));
    setExpandedRacikanGroups((prev) => {
      const next = { ...prev };
      delete next[racikanGroup];
      return next;
    });
    setItemErrors({});
  };

  const validateItems = () => {
    const errors: Record<number, string[]> = {};

    orderItems.forEach((item, index) => {
      const rowErrors: string[] = [];
      if (!item.quantity || item.quantity <= 0) rowErrors.push("Jumlah harus lebih dari 0");
      if (item.quantity > item.available_stock) rowErrors.push("Jumlah melebihi stok");
      if (!item.dosage?.trim()) rowErrors.push("Dosis wajib diisi");
      if (!item.instructions?.trim()) rowErrors.push("Signa wajib diisi");

      if (rowErrors.length > 0) {
        errors[index] = rowErrors;
      }
    });

    return errors;
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

    const validationErrors = validateItems();
    if (Object.keys(validationErrors).length > 0) {
      setItemErrors(validationErrors);
      toast({
        variant: "destructive",
        title: "Validasi gagal",
        description: "Pastikan jumlah, dosis, dan signa sudah diisi dengan benar.",
      });
      return;
    }

    setSubmitting(true);
    try {
      const input: CreateMedicineOrderInput = {
        source_visit_id: visitId,
        pharmacy_room_id: selectedPharmacyRoom,
        prescription_type: derivePrescriptionTypeFromItems(orderItems),
        fulfillment_type: fulfillmentType,
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
          notes: item.notes,
          item_type: item.item_type,
          racikan_group: item.racikan_group,
          racikan_name: item.racikan_name,
          racikan_type: item.racikan_type,
          racikan_qty: item.racikan_qty,
          racikan_unit: item.racikan_unit,
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
      setFulfillmentType(sourceServiceType === "rawat_inap" ? "in_room" : "take_home");
      resetRacikanDraft();

      toast({
        title: "Order Terkirim",
        description: "Order obat berhasil dikirim ke farmasi.",
      });

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

  const handleSubmitOrderRef = useRef(handleSubmitOrder);
  useEffect(() => {
    handleSubmitOrderRef.current = handleSubmitOrder;
  });

  useEffect(() => {
    const handleFooterAction = (event: Event) => {
      const customEvent = event as CustomEvent<{
        tabId: string;
        action: "save" | "final" | "cancel";
        handled: boolean;
      }>;
      if (customEvent.detail?.tabId === "medicine-order" && customEvent.detail?.action === "save") {
        customEvent.detail.handled = true;
        handleSubmitOrderRef.current();
      }
    };

    window.addEventListener(FOOTER_ACTION_EVENT, handleFooterAction as EventListener);
    return () => {
      window.removeEventListener(FOOTER_ACTION_EVENT, handleFooterAction as EventListener);
    };
  }, []);

  const handleCancelOrder = (orderId: number) => {
    setCancelConfirmOrderId(orderId);
  };

  const handleConfirmCancelOrder = async () => {
    if (!cancelConfirmOrderId) return;
    
    try {
      await medicineOrdersApi.cancel(cancelConfirmOrderId);
      toast({
        title: "Berhasil",
        description: "Order berhasil dibatalkan",
      });
      setCancelConfirmOrderId(null);
      loadData();
    } catch (error: any) {
      toast({
        title: "Gagal",
        description: error.response?.data?.error || "Gagal membatalkan order",
        variant: "destructive",
      });
      setCancelConfirmOrderId(null);
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
              <Pill className="h-3.5 w-3.5" />
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
          <TooltipProvider delayDuration={120}>
            {/* Order Form Tab */}
            {activeTab === "form" && (
              <div>
                <fieldset
                  disabled={readOnly}
                  className="divide-y divide-neutral-200 dark:divide-neutral-800 border-b border-neutral-200 dark:border-neutral-800 [&_input]:h-9 [&_[role=combobox]]:h-9 [&_input]:rounded-none [&_textarea]:rounded-none [&_[role=combobox]]:rounded-none [&_input]:text-xs [&_[role=combobox]]:text-xs"
                >
                  {/* Section 1: Konfigurasi Order */}
                  <section className="px-4 sm:px-5 py-4 space-y-3">
                    <div className="border-l-2 border-neutral-900 dark:border-neutral-100 pl-2.5 text-xs font-bold uppercase tracking-wider text-neutral-900 dark:text-neutral-100">
                      Konfigurasi Order Resep
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3">
                      <div className="lg:col-span-3 space-y-1.5">
                        <Label className="text-xs font-medium">Ruang Farmasi Tujuan</Label>
                        <Select
                          value={selectedPharmacyRoom?.toString() || ""}
                          onValueChange={(value) => setSelectedPharmacyRoom(Number(value))}
                        >
                          <SelectTrigger className="h-9 text-xs rounded-none">
                            <SelectValue placeholder="Pilih ruang farmasi" />
                          </SelectTrigger>
                          <SelectContent>
                            {pharmacyRooms.map((room) => (
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
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="lg:col-span-3 space-y-1.5">
                        <Label className="text-xs font-medium">Pemakaian Obat</Label>
                        <Select
                          value={fulfillmentType}
                          onValueChange={(value) => setFulfillmentType(value as MedicineFulfillmentType)}
                        >
                          <SelectTrigger className="h-9 text-xs rounded-none">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="in_room" className="text-xs">Dipakai di Ruangan</SelectItem>
                            <SelectItem value="take_home" className="text-xs">Dibawa Pulang</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="sm:col-span-2 lg:col-span-4 space-y-1.5">
                        <Label className="text-xs font-medium">Diagnosis Terkait</Label>
                        <Input
                          placeholder="Tulis diagnosis yang berkaitan dengan resep ini..."
                          value={diagnosis}
                          onChange={(e) => setDiagnosis(e.target.value)}
                        />
                      </div>
                    </div>
                  </section>

                  {/* Section 2: Daftar Obat */}
                  <section className="px-4 sm:px-5 py-4 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="border-l-2 border-neutral-900 dark:border-neutral-100 pl-2.5 text-xs font-bold uppercase tracking-wider text-neutral-900 dark:text-neutral-100">
                          Daftar Obat
                        </div>
                        <Badge
                          variant={groupedDraftOrderItems.length > 0 ? "default" : "secondary"}
                          className="rounded-none h-5 px-1.5 text-[10px] font-mono"
                        >
                          {groupedDraftOrderItems.length} Entri
                        </Badge>
                        <Badge
                          variant="outline"
                          className="rounded-none h-5 px-1.5 text-[10px] font-mono"
                        >
                          {formatRupiah(orderGrandTotal)}
                        </Badge>

                        {/* Template Resep */}
                        <div className="flex items-center gap-1.5 ml-1 border-l border-neutral-200 dark:border-neutral-800 pl-2">
                          <Dialog open={showTemplateDialog} onOpenChange={setShowTemplateDialog}>
                            <DialogTrigger asChild>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="h-8 rounded-none px-2.5 text-xs gap-1.5"
                                title="Pilih Template Resep"
                                aria-label="Pilih template resep"
                                data-exclude-footer-action="true"
                                disabled={!selectedPharmacyRoom || loadingTemplates || readOnly}
                                onClick={() => setShowTemplateDialog(true)}
                              >
                                <Package className="h-3.5 w-3.5" />
                                <span className="hidden sm:inline">Pilih Template</span>
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="w-[calc(100vw-1rem)] sm:max-w-2xl max-h-[82vh] rounded-none p-0 gap-0 border-neutral-200 dark:border-neutral-800 overflow-hidden flex flex-col">
                              <DialogHeader className="px-4 py-3 border-b border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 shrink-0">
                                <div className="flex items-center gap-2.5">
                                  <div className="size-8 bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 flex items-center justify-center shrink-0">
                                    <Package className="h-4 w-4" />
                                  </div>
                                  <div className="text-left min-w-0">
                                    <DialogTitle className="text-sm font-bold uppercase tracking-tight">
                                      Pilih Template Resep
                                    </DialogTitle>
                                    <DialogDescription className="text-xs mt-0.5">
                                      Pilih salah satu template resep dokter untuk mengisi daftar obat secara otomatis.
                                    </DialogDescription>
                                  </div>
                                </div>
                              </DialogHeader>

                              <div className="p-3.5 border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50/70 dark:bg-neutral-900/40 shrink-0">
                                <div className="relative">
                                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                                  <Input
                                    placeholder="Cari nama template resep..."
                                    className="h-9 pl-8 text-xs rounded-none bg-white dark:bg-neutral-950"
                                    value={templateSearchTerm}
                                    onChange={(e) => setTemplateSearchTerm(e.target.value)}
                                  />
                                </div>
                              </div>

                              <div className="flex-1 max-h-[380px] overflow-y-auto divide-y divide-neutral-200 dark:divide-neutral-800">
                                {loadingTemplates ? (
                                  <div className="flex items-center justify-center py-10 text-xs text-muted-foreground">
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Memuat template resep...
                                  </div>
                                ) : filteredTemplates.length === 0 ? (
                                  <div className="text-center py-10 text-xs text-muted-foreground">
                                    {templateSearchTerm ? "Template tidak ditemukan" : "Belum ada template resep tersimpan"}
                                  </div>
                                ) : (
                                  filteredTemplates.map((template) => (
                                    <button
                                      key={template.id}
                                      type="button"
                                      className="w-full px-4 py-2.5 hover:bg-muted/30 flex items-center justify-between gap-3 text-left transition-colors"
                                      onClick={() => handleApplyTemplate(template)}
                                    >
                                      <div className="min-w-0">
                                        <p className="font-semibold text-xs text-foreground truncate">{template.name}</p>
                                        <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                                          {template.items?.length || 0} obat
                                          {template.notes ? ` • ${template.notes}` : ""}
                                          {template.dpjp_employee_id ? " • Scope: DPJP" : ""}
                                        </p>
                                      </div>
                                      <Badge variant="outline" className="rounded-none text-[10px] h-5 px-1.5 font-mono shrink-0">
                                        {template.items?.length || 0} Item
                                      </Badge>
                                    </button>
                                  ))
                                )}
                              </div>

                              <DialogFooter className="px-4 py-3 border-t border-neutral-200 dark:border-neutral-800 bg-neutral-50/60 dark:bg-neutral-900/40 shrink-0">
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className="h-8 rounded-none px-4 text-xs"
                                  onClick={() => setShowTemplateDialog(false)}
                                >
                                  Tutup
                                </Button>
                              </DialogFooter>
                            </DialogContent>
                          </Dialog>

                          <Dialog open={showCreateTemplateDialog} onOpenChange={setShowCreateTemplateDialog}>
                            <DialogTrigger asChild>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="h-8 rounded-none px-2.5 text-xs gap-1.5"
                                title="Buat Template Resep"
                                aria-label="Buat template resep"
                                data-exclude-footer-action="true"
                                disabled={readOnly}
                                onClick={() => {
                                  setTemplateItems(orderItems.map((item) => ({ ...item })));
                                  setTemplateMedicineSearch("");
                                  setShowCreateTemplateDialog(true);
                                }}
                              >
                                <BookmarkPlus className="h-3.5 w-3.5" />
                                <span className="hidden sm:inline">Buat Template</span>
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="w-[calc(100vw-1rem)] sm:max-w-4xl max-h-[88vh] rounded-none p-0 gap-0 border-neutral-200 dark:border-neutral-800 overflow-hidden flex flex-col">
                              <DialogHeader className="px-4 py-3 border-b border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 shrink-0">
                                <div className="flex items-center gap-2.5">
                                  <div className="size-8 bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 flex items-center justify-center shrink-0">
                                    <BookmarkPlus className="h-4 w-4" />
                                  </div>
                                  <div className="text-left min-w-0">
                                    <DialogTitle className="text-sm font-bold uppercase tracking-tight">
                                      Simpan Template Resep
                                    </DialogTitle>
                                    <DialogDescription className="text-xs mt-0.5">
                                      Simpan template resep pribadi dokter. Ambil dari order saat ini atau tambahkan item obat di bawah.
                                    </DialogDescription>
                                  </div>
                                </div>
                              </DialogHeader>

                              <div className="flex-1 min-h-0 overflow-y-auto divide-y divide-neutral-200 dark:divide-neutral-800 [&_input]:h-9 [&_[role=combobox]]:h-9 [&_input]:rounded-none [&_textarea]:rounded-none [&_[role=combobox]]:rounded-none [&_input]:text-xs [&_[role=combobox]]:text-xs">
                                {/* Section 1: Identitas Template */}
                                <div className="p-4 space-y-3">
                                  <div className="flex flex-wrap items-center justify-between gap-2">
                                    <div className="border-l-2 border-neutral-900 dark:border-neutral-100 pl-2.5 text-xs font-bold uppercase tracking-wider text-neutral-900 dark:text-neutral-100">
                                      Informasi Template
                                    </div>
                                    <label className="flex items-center gap-2 border border-neutral-200 dark:border-neutral-800 bg-neutral-50/70 dark:bg-neutral-900/50 px-2.5 h-7 text-xs cursor-pointer select-none">
                                      <input
                                        type="checkbox"
                                        checked={bindTemplateToDPJP}
                                        onChange={(e) => setBindTemplateToDPJP(e.target.checked)}
                                        className="rounded-none"
                                      />
                                      <span className="font-medium text-neutral-700 dark:text-neutral-300">
                                        Scope hanya untuk DPJP pasien ini
                                      </span>
                                    </label>
                                  </div>

                                  <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                                    <div className="md:col-span-5 space-y-1.5">
                                      <Label className="text-xs font-medium">Nama Template *</Label>
                                      <Input
                                        value={templateName}
                                        onChange={(e) => setTemplateName(e.target.value)}
                                        placeholder="Contoh: Resep ISPA Dewasa"
                                      />
                                    </div>
                                    <div className="md:col-span-7 space-y-1.5">
                                      <Label className="text-xs font-medium">Catatan Template (Opsional)</Label>
                                      <Input
                                        value={templateNotes}
                                        onChange={(e) => setTemplateNotes(e.target.value)}
                                        placeholder="Keterangan singkat indikasi atau catatan template..."
                                      />
                                    </div>
                                  </div>
                                </div>

                                {/* Section 2: Isi Obat Template */}
                                <div className="p-4 space-y-3">
                                  <div className="flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-2">
                                      <div className="border-l-2 border-neutral-900 dark:border-neutral-100 pl-2.5 text-xs font-bold uppercase tracking-wider text-neutral-900 dark:text-neutral-100">
                                        Isi Obat Template
                                      </div>
                                      <Badge variant="secondary" className="rounded-none h-5 px-1.5 text-[10px] font-mono">
                                        {templateItems.length} Obat
                                      </Badge>
                                    </div>
                                  </div>

                                  <div className="relative">
                                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                                    <Input
                                      placeholder="Cari obat untuk ditambahkan ke template..."
                                      className="pl-8"
                                      value={templateMedicineSearch}
                                      onChange={(e) => setTemplateMedicineSearch(e.target.value)}
                                    />
                                  </div>

                                  <div className="max-h-36 overflow-y-auto border border-neutral-200 dark:border-neutral-800 divide-y divide-neutral-200 dark:divide-neutral-800">
                                    {filteredTemplateMedicines.length === 0 ? (
                                      <div className="text-center py-5 text-xs text-muted-foreground">
                                        {templateMedicineSearch ? "Obat tidak ditemukan" : "Semua obat sudah masuk ke template"}
                                      </div>
                                    ) : (
                                      filteredTemplateMedicines.map((pm) => (
                                        <button
                                          key={`template-${pm.id}`}
                                          type="button"
                                          className="w-full px-3 py-2 hover:bg-muted/40 flex items-center justify-between text-left transition-colors"
                                          onClick={() => handleAddTemplateItem(pm)}
                                        >
                                          <div>
                                            <p className="text-xs font-semibold text-foreground">{pm.medicine.name}</p>
                                            <p className="text-[11px] text-muted-foreground">{pm.medicine.code} • Stok {pm.quantity}</p>
                                          </div>
                                          <span className="inline-flex items-center gap-1 border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 px-2 py-0.5 text-[11px] font-medium">
                                            <Plus className="h-3 w-3" /> Tambah
                                          </span>
                                        </button>
                                      ))
                                    )}
                                  </div>

                                  {templateItems.length > 0 ? (
                                    <div className="border border-neutral-200 dark:border-neutral-800 overflow-x-auto">
                                      <table className="w-full text-xs min-w-[860px]">
                                        <thead className="bg-neutral-50 dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800">
                                          <tr>
                                            <th className="h-8 px-2.5 text-left font-bold uppercase tracking-wider text-muted-foreground">Obat</th>
                                            <th className="h-8 px-2 text-left font-bold uppercase tracking-wider text-muted-foreground w-[76px]">Qty</th>
                                            <th className="h-8 px-2 text-left font-bold uppercase tracking-wider text-muted-foreground w-[110px]">Dosis</th>
                                            <th className="h-8 px-2 text-left font-bold uppercase tracking-wider text-muted-foreground min-w-[190px]">Signa</th>
                                            <th className="h-8 px-2 text-left font-bold uppercase tracking-wider text-muted-foreground w-[135px]">Rute</th>
                                            <th className="h-8 px-2 text-left font-bold uppercase tracking-wider text-muted-foreground w-[105px]">Durasi</th>
                                            <th className="h-8 px-2 text-center font-bold uppercase tracking-wider text-muted-foreground w-[44px]">Aksi</th>
                                          </tr>
                                        </thead>
                                        <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
                                          {templateItems.map((item, index) => (
                                            <tr key={`template-item-${item.medicine_id}-${index}`} className="align-middle">
                                              <td className="py-2 px-2.5">
                                                <p className="font-semibold text-foreground">{item.medicine_name}</p>
                                                <p className="text-[11px] text-muted-foreground">{item.medicine_code}</p>
                                              </td>
                                              <td className="py-2 px-2">
                                                <Input
                                                  type="number"
                                                  min={1}
                                                  max={item.available_stock}
                                                  value={item.quantity}
                                                  onChange={(e) => handleUpdateTemplateItemQuantity(index, Number(e.target.value))}
                                                  className="!h-8"
                                                />
                                              </td>
                                              <td className="py-2 px-2">
                                                <Input
                                                  value={item.dosage}
                                                  onChange={(e) => handleUpdateTemplateItemField(index, "dosage", e.target.value)}
                                                  className="!h-8"
                                                />
                                              </td>
                                              <td className="py-2 px-2">
                                                <Combobox
                                                  allowCustomValue
                                                  options={signaOptions}
                                                  value={item.instructions}
                                                  onValueChange={(value) => {
                                                    handleUpdateTemplateItemField(index, "instructions", value);
                                                    handleUpdateTemplateItemField(index, "frequency", value);
                                                  }}
                                                  placeholder="Pilih/ketik signa"
                                                  searchPlaceholder="Cari/ketik signa..."
                                                  emptyText="Gunakan signa ini"
                                                  className="!h-8 text-xs"
                                                />
                                              </td>
                                              <td className="py-2 px-2">
                                                <Select
                                                  value={item.route}
                                                  onValueChange={(value) => handleUpdateTemplateItemField(index, "route", value)}
                                                >
                                                  <SelectTrigger className="h-8 text-xs rounded-none">
                                                    <SelectValue placeholder="Pilih" />
                                                  </SelectTrigger>
                                                  <SelectContent>
                                                    {routeOptions.map((option) => (
                                                      <SelectItem key={`tmp-route-${option.value}`} value={option.value} className="text-xs">
                                                        {option.label}
                                                      </SelectItem>
                                                    ))}
                                                  </SelectContent>
                                                </Select>
                                              </td>
                                              <td className="py-2 px-2">
                                                <Input
                                                  value={item.duration}
                                                  onChange={(e) => handleUpdateTemplateItemField(index, "duration", e.target.value)}
                                                  className="!h-8"
                                                />
                                              </td>
                                              <td className="py-2 px-2 text-center">
                                                <Button
                                                  type="button"
                                                  variant="ghost"
                                                  size="icon"
                                                  className="h-7 w-7 rounded-none text-destructive"
                                                  onClick={() => handleRemoveTemplateItem(index)}
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
                                      Belum ada obat pada template. Klik "+ Tambah" pada daftar obat di atas.
                                    </div>
                                  )}
                                </div>
                              </div>

                              <DialogFooter className="px-4 py-3 border-t border-neutral-200 dark:border-neutral-800 bg-neutral-50/60 dark:bg-neutral-900/40 shrink-0 gap-2">
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className="h-8 rounded-none px-4 text-xs"
                                  onClick={() => setShowCreateTemplateDialog(false)}
                                >
                                  Batal
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  className="h-8 rounded-none px-4 text-xs"
                                  onClick={handleCreateTemplate}
                                  disabled={templateSaving || templateItems.length === 0}
                                >
                                  {templateSaving ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : null}
                                  Simpan Template
                                </Button>
                              </DialogFooter>
                            </DialogContent>
                          </Dialog>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
                          <DialogTrigger asChild>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="h-8 rounded-none px-2.5 text-xs gap-1.5"
                              title="Tambah Obat Non-Racikan"
                              aria-label="Tambah obat non-racikan"
                              data-exclude-footer-action="true"
                              disabled={!selectedPharmacyRoom || loadingMedicines || readOnly}
                              onClick={() => setShowAddDialog(true)}
                            >
                              <Pill className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                              <span>+ Non-Racikan</span>
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="w-[calc(100vw-1rem)] sm:max-w-2xl max-h-[82vh] rounded-none p-0 gap-0 border-neutral-200 dark:border-neutral-800 overflow-hidden flex flex-col">
                            <DialogHeader className="px-4 py-3 border-b border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 shrink-0">
                              <div className="flex items-center gap-2.5">
                                <div className="size-8 bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 flex items-center justify-center shrink-0">
                                  <Pill className="h-4 w-4" />
                                </div>
                                <div className="text-left min-w-0">
                                  <DialogTitle className="text-sm font-bold uppercase tracking-tight">
                                    Pilih Obat Non-Racikan
                                  </DialogTitle>
                                  <DialogDescription className="text-xs mt-0.5">
                                    Pilih obat dari stok farmasi tujuan, lalu lengkapi detail resep pada tabel order.
                                  </DialogDescription>
                                </div>
                              </div>
                            </DialogHeader>

                            <div className="p-3.5 border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50/70 dark:bg-neutral-900/40 shrink-0">
                              <div className="relative">
                                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                                <Input
                                  placeholder="Cari nama atau kode obat..."
                                  className="h-9 pl-8 text-xs rounded-none bg-white dark:bg-neutral-950"
                                  value={searchTerm}
                                  onChange={(e) => setSearchTerm(e.target.value)}
                                />
                              </div>
                            </div>

                            <div className="flex-1 max-h-[380px] overflow-y-auto divide-y divide-neutral-200 dark:divide-neutral-800">
                              {loadingMedicines ? (
                                <div className="flex items-center justify-center py-10 text-xs text-muted-foreground">
                                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                  Memuat daftar obat...
                                </div>
                              ) : filteredMedicines.length === 0 ? (
                                <div className="text-center py-10 text-xs text-muted-foreground">
                                  {searchTerm ? "Tidak ada obat yang sesuai" : "Semua obat yang tersedia sudah dipilih"}
                                </div>
                              ) : (
                                filteredMedicines.map((pm) => (
                                  <button
                                    key={pm.id}
                                    type="button"
                                    className="w-full px-4 py-2.5 hover:bg-muted/30 flex items-center justify-between gap-3 text-left transition-colors"
                                    onClick={() => handleAddItem(pm)}
                                  >
                                    <div className="min-w-0">
                                      <p className="font-semibold text-xs text-foreground truncate">{pm.medicine.name}</p>
                                      <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                                        {pm.medicine.code} • {pm.medicine.form} • {pm.medicine.strength}
                                      </p>
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0">
                                      <Badge
                                        variant={pm.quantity > pm.min_quantity ? "default" : "destructive"}
                                        className="rounded-none text-[10px] h-5 px-1.5 font-mono"
                                      >
                                        Stok: {pm.quantity}
                                      </Badge>
                                    </div>
                                  </button>
                                ))
                              )}
                            </div>

                            <DialogFooter className="px-4 py-3 border-t border-neutral-200 dark:border-neutral-800 bg-neutral-50/60 dark:bg-neutral-900/40 shrink-0">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-8 rounded-none px-4 text-xs"
                                onClick={() => setShowAddDialog(false)}
                              >
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
                          <DialogTrigger asChild>
                            <Button
                              type="button"
                              size="sm"
                              variant="default"
                              className="h-8 rounded-none px-2.5 text-xs gap-1.5"
                              title="Tambah Obat Racikan"
                              aria-label="Tambah obat racikan"
                              data-exclude-footer-action="true"
                              disabled={!selectedPharmacyRoom || loadingMedicines || readOnly}
                              onClick={() => setShowRacikanDialog(true)}
                            >
                              <FlaskConical className="h-3.5 w-3.5" />
                              <span>+ Racikan</span>
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="sm:max-w-4xl lg:max-w-5xl max-h-[90vh] rounded-none p-0 gap-0 border-neutral-200 dark:border-neutral-800 overflow-hidden flex flex-col">
                            <DialogHeader className="px-4 py-3 border-b border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 shrink-0">
                              <div className="flex items-center gap-2.5">
                                <div className="size-8 bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 flex items-center justify-center shrink-0">
                                  <FlaskConical className="h-4 w-4" />
                                </div>
                                <div className="text-left min-w-0">
                                  <DialogTitle className="text-sm font-bold uppercase tracking-tight">
                                    Tambah Obat Racikan
                                  </DialogTitle>
                                  <DialogDescription className="text-xs mt-0.5">
                                    Tentukan identitas racikan, aturan pakai, serta pilih bahan obat beserta dosis tiap komponen.
                                  </DialogDescription>
                                </div>
                              </div>
                            </DialogHeader>

                            <div className="grid flex-1 min-h-0 overflow-y-auto md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-neutral-200 dark:divide-neutral-800 [&_input]:h-9 [&_[role=combobox]]:h-9 [&_input]:rounded-none [&_[role=combobox]]:rounded-none [&_input]:text-xs [&_[role=combobox]]:text-xs">
                              {/* Left Column: Informasi Racikan */}
                              <div className="p-4 space-y-3">
                                <div className="flex items-center justify-between gap-2">
                                  <div className="border-l-2 border-neutral-900 dark:border-neutral-100 pl-2.5 text-xs font-bold uppercase tracking-wider text-neutral-900 dark:text-neutral-100">
                                    Informasi &amp; Aturan Pakai Racikan
                                  </div>
                                  <Badge variant="secondary" className="rounded-none text-[10px] h-5 px-1.5 font-mono">
                                    {racikanItems.length} Komponen
                                  </Badge>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                  <div className="space-y-1.5">
                                    <Label className="text-xs font-medium">Nama Racikan</Label>
                                    <Input
                                      value={racikanDraft.name}
                                      onChange={(e) => handleUpdateRacikanDraft("name", e.target.value)}
                                      placeholder="Contoh: Racikan Demam Anak"
                                    />
                                  </div>
                                  <div className="space-y-1.5">
                                    <Label className="text-xs font-medium">Jenis Racikan</Label>
                                    <Select value={racikanDraft.type} onValueChange={(value) => handleUpdateRacikanDraft("type", value)}>
                                      <SelectTrigger className="h-9 text-xs rounded-none">
                                        <SelectValue placeholder="Pilih jenis racikan" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {RACIKAN_TYPE_OPTIONS.map((option) => (
                                          <SelectItem key={option} value={option} className="text-xs">
                                            {option}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </div>
                                </div>

                                <div className="grid grid-cols-3 gap-3">
                                  <div className="space-y-1.5">
                                    <Label className="text-xs font-medium">Jumlah Hasil</Label>
                                    <Input
                                      type="number"
                                      min={1}
                                      value={racikanDraft.quantity}
                                      onChange={(e) => handleUpdateRacikanDraft("quantity", Number(e.target.value) || 1)}
                                    />
                                  </div>
                                  <div className="space-y-1.5">
                                    <Label className="text-xs font-medium">Satuan Hasil</Label>
                                    <Input
                                      value={racikanDraft.unit}
                                      onChange={(e) => handleUpdateRacikanDraft("unit", e.target.value)}
                                    />
                                  </div>
                                  <div className="space-y-1.5">
                                    <Label className="text-xs font-medium">Dosis</Label>
                                    <Input
                                      value={racikanDraft.dosage}
                                      onChange={(e) => handleUpdateRacikanDraft("dosage", e.target.value)}
                                      placeholder="Contoh: 1 bungkus"
                                    />
                                  </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                  <div className="space-y-1.5">
                                    <Label className="text-xs font-medium">Signa / Aturan Pakai</Label>
                                    <Combobox
                                      allowCustomValue
                                      options={signaOptions}
                                      value={racikanDraft.instructions}
                                      onValueChange={(value) => {
                                        handleUpdateRacikanDraft("instructions", value);
                                        handleUpdateRacikanDraft("frequency", value);
                                      }}
                                      placeholder="Pilih atau ketik signa"
                                      searchPlaceholder="Cari signa..."
                                      emptyText="Tekan enter"
                                      className="w-full"
                                    />
                                  </div>
                                  <div className="space-y-1.5">
                                    <Label className="text-xs font-medium">Catatan Racikan</Label>
                                    <Input
                                      value={racikanDraft.notes}
                                      onChange={(e) => handleUpdateRacikanDraft("notes", e.target.value)}
                                      placeholder="Catatan racikan (opsional)"
                                    />
                                  </div>
                                </div>
                              </div>

                              {/* Right Column: Pilih Bahan Obat */}
                              <div className="p-4 space-y-3 flex flex-col">
                                <div className="flex items-center justify-between gap-2">
                                  <div className="border-l-2 border-neutral-900 dark:border-neutral-100 pl-2.5 text-xs font-bold uppercase tracking-wider text-neutral-900 dark:text-neutral-100">
                                    Komponen Bahan Obat
                                  </div>
                                  <Badge variant="outline" className="rounded-none text-[10px] h-5 px-1.5 font-mono">
                                    {racikanItems.length} Dipilih
                                  </Badge>
                                </div>

                                <div className="relative">
                                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                                  <Input
                                    placeholder="Cari nama atau kode bahan obat..."
                                    className="pl-8"
                                    value={racikanSearchTerm}
                                    onChange={(e) => setRacikanSearchTerm(e.target.value)}
                                  />
                                </div>

                                <div className="flex-1 min-h-[220px] max-h-[300px] overflow-y-auto border border-neutral-200 dark:border-neutral-800 p-2 space-y-2">
                                  {racikanItems.length > 0 && (
                                    <div className="space-y-1.5">
                                      <div className="flex items-center justify-between px-0.5">
                                        <span className="text-[11px] font-bold uppercase tracking-wider text-foreground flex items-center gap-1">
                                          <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                                          Bahan Terpilih ({racikanItems.length})
                                        </span>
                                      </div>
                                      <div className="divide-y divide-neutral-200 dark:divide-neutral-800 border border-neutral-200 dark:border-neutral-800">
                                        {racikanItems.map((item, index) => (
                                          <div
                                            key={`racikan-item-${item.medicine_id}-${index}`}
                                            className="border-l-4 border-l-neutral-900 dark:border-l-neutral-100 bg-neutral-50/60 dark:bg-neutral-900/40 px-2.5 py-1.5 flex items-center justify-between gap-2"
                                          >
                                            <div className="min-w-0 flex-1">
                                              <p className="font-semibold text-xs text-foreground truncate">{item.medicine_name}</p>
                                              <p className="text-[10px] text-muted-foreground truncate">{item.medicine_code}</p>
                                            </div>
                                            <div className="flex items-center gap-1.5 shrink-0">
                                              <Label className="text-[11px] text-muted-foreground whitespace-nowrap shrink-0">
                                                Dosis:
                                              </Label>
                                              <Input
                                                value={item.dosage || ""}
                                                onChange={(e) => handleUpdateRacikanItemDosage(index, e.target.value)}
                                                placeholder="Misal: 1/2 tab"
                                                className="!h-7 w-24 sm:w-28 text-xs bg-white dark:bg-neutral-950 px-2"
                                                autoFocus={index === racikanItems.length - 1 && !item.dosage}
                                              />
                                              <Button
                                                type="button"
                                                variant="ghost"
                                                size="icon"
                                                className="h-6 w-6 rounded-none text-destructive hover:bg-destructive/10 shrink-0"
                                                onClick={() => handleRemoveRacikanItem(index)}
                                                title="Hapus bahan"
                                              >
                                                <Trash2 className="h-3 w-3" />
                                              </Button>
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}

                                  <div>
                                    {racikanItems.length > 0 && (
                                      <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground px-0.5 py-1">
                                        Pilih Bahan Lainnya
                                      </div>
                                    )}
                                    <div className="divide-y divide-neutral-200 dark:divide-neutral-800 border border-neutral-200 dark:border-neutral-800">
                                      {filteredRacikanMedicines.length === 0 ? (
                                        <div className="text-center py-5 text-xs text-muted-foreground">
                                          {racikanSearchTerm ? "Tidak ada obat yang sesuai" : "Semua bahan sudah dipilih"}
                                        </div>
                                      ) : (
                                        filteredRacikanMedicines.map((pm) => (
                                          <button
                                            key={`racikan-${pm.id}`}
                                            type="button"
                                            className="w-full px-2.5 py-2 hover:bg-muted/40 flex items-center justify-between gap-2 text-left transition-colors"
                                            onClick={() => handleAddRacikanComponent(pm)}
                                          >
                                            <div className="min-w-0 flex-1">
                                              <p className="font-semibold text-xs text-foreground truncate">{pm.medicine.name}</p>
                                              <p className="text-[10px] text-muted-foreground truncate">
                                                {pm.medicine.code} • {pm.medicine.form || "-"} • {pm.medicine.strength || "-"}
                                              </p>
                                            </div>
                                            <span className="text-[11px] font-medium border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 px-2 py-0.5 shrink-0 flex items-center gap-0.5">
                                              <Plus className="h-3 w-3" /> Pilih
                                            </span>
                                          </button>
                                        ))
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>

                            <DialogFooter className="px-4 py-3 border-t border-neutral-200 dark:border-neutral-800 bg-neutral-50/60 dark:bg-neutral-900/40 shrink-0 gap-2">
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="h-8 rounded-none px-4 text-xs"
                                onClick={() => setShowRacikanDialog(false)}
                              >
                                Tutup
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                className="h-8 rounded-none px-4 text-xs"
                                onClick={handleSaveRacikan}
                                disabled={racikanItems.length === 0}
                              >
                                Simpan Racikan
                              </Button>
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>
                      </div>
                    </div>

                    {groupedDraftOrderItems.length === 0 ? (
                      <div className="border border-dashed border-neutral-200 dark:border-neutral-800 bg-neutral-50/30 dark:bg-neutral-900/10 px-3.5 py-2.5 text-xs text-muted-foreground">
                        Belum ada item obat yang ditambahkan ke dalam resep.
                      </div>
                    ) : (
                      <>
                        <div className="border border-neutral-200 dark:border-neutral-800 overflow-x-auto">
                          <table className="w-full text-xs min-w-[980px]">
                            <thead className="bg-neutral-50 dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800">
                              <tr>
                                <th className="h-9 px-3 text-left font-bold uppercase tracking-wider text-muted-foreground">Nama Item</th>
                                <th className="h-9 px-3 text-left font-bold uppercase tracking-wider text-muted-foreground">Detail Resep</th>
                                <th className="h-9 px-3 text-left font-bold uppercase tracking-wider text-muted-foreground w-[140px]">Jumlah</th>
                                <th className="h-9 px-3 text-right font-bold uppercase tracking-wider text-muted-foreground w-[170px]">Harga</th>
                                <th className="h-9 px-3 text-left font-bold uppercase tracking-wider text-muted-foreground w-[140px]">Status</th>
                                <th className="h-9 px-3 text-center font-bold uppercase tracking-wider text-muted-foreground w-[100px]">Aksi</th>
                              </tr>
                            </thead>
                            <tbody>
                              {groupedDraftOrderItems.map((group) => {
                                const groupTotal = group.items.reduce((sum, item) => sum + item.quantity * item.unit_price, 0);

                                if (group.type === "racikan") {
                                  const groupHasError = group.items.some((item) => {
                                    const itemIndex = orderItems.findIndex((candidate) => candidate === item);
                                    return itemErrors[itemIndex]?.length;
                                  });
                                  const groupKey = group.racikanGroup || group.key;
                                  const isExpanded = expandedRacikanGroups[groupKey] ?? groupHasError;
                                  const detailSummary = [group.sharedFields.dosage || "-", group.sharedFields.frequency || "-"].join(" • ");

                                  return (
                                    <Fragment key={group.key}>
                                      <tr className="border-t border-neutral-200 dark:border-neutral-800 align-top bg-neutral-50/60 dark:bg-neutral-900/40">
                                        <td className="py-2.5 px-3">
                                          <button
                                            type="button"
                                            className="flex w-full items-start gap-2 text-left"
                                            onClick={() => toggleRacikanGroup(groupKey)}
                                          >
                                            <div className="min-w-0">
                                              <div className="flex items-center gap-2 flex-wrap">
                                                <span className="font-semibold truncate text-foreground">{group.racikanName || "Racikan"}</span>
                                                <Badge variant="secondary" className="rounded-none h-5 px-1.5 text-[10px]">Racikan</Badge>
                                              </div>
                                              <p className="text-[11px] text-muted-foreground truncate">
                                                {group.racikanType || "Tanpa jenis"} • {group.items.length} komponen
                                              </p>
                                            </div>
                                          </button>
                                        </td>
                                        <td className="py-2.5 px-3">
                                          <p className="truncate">{detailSummary}</p>
                                          <p className="text-[11px] text-muted-foreground truncate">Instruksi: {group.sharedFields.instructions || "-"}</p>
                                          {group.sharedFields.notes ? (
                                            <p className="text-[11px] text-muted-foreground truncate">Catatan: {group.sharedFields.notes}</p>
                                          ) : null}
                                        </td>
                                        <td className="py-2.5 px-3 font-semibold">{group.racikanQty || 1} {group.racikanUnit || "bungkus"}</td>
                                        <td className="py-2.5 px-3 text-right">
                                          <p className="text-xs font-mono font-bold leading-5">{formatRupiah(groupTotal)}</p>
                                        </td>
                                        <td className="py-2.5 px-3">
                                          {groupHasError ? (
                                            <Badge variant="destructive" className="rounded-none text-[10px] h-5 px-1.5">Perlu Lengkapi</Badge>
                                          ) : (
                                            <Badge variant="outline" className="rounded-none text-[10px] h-5 px-1.5">Siap</Badge>
                                          )}
                                        </td>
                                        <td className="py-2 px-3">
                                          <div className="flex items-center justify-center gap-1">
                                            <Button
                                              type="button"
                                              variant="ghost"
                                              size="icon"
                                              className="h-7 w-7 rounded-none"
                                              title="Edit racikan"
                                              onClick={() => openEditRacikanDialog(group)}
                                            >
                                              <Pencil className="h-3.5 w-3.5" />
                                            </Button>
                                            <Button
                                              type="button"
                                              variant="ghost"
                                              size="icon"
                                              className="h-7 w-7 rounded-none text-destructive"
                                              title="Hapus racikan"
                                              onClick={() => handleRemoveRacikanGroup(groupKey)}
                                            >
                                              <Trash2 className="h-3.5 w-3.5" />
                                            </Button>
                                          </div>
                                        </td>
                                      </tr>
                                      {isExpanded &&
                                        group.items.map((item, componentIndex) => (
                                          <tr key={`${group.key}-${item.medicine_id}-${componentIndex}`} className="border-t border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950">
                                            <td className="py-2 px-3 pl-9">
                                              <div className="flex items-center gap-2 min-w-0">
                                                <span className="h-px w-3 bg-border" />
                                                <span className="truncate text-muted-foreground">{item.medicine_name}</span>
                                              </div>
                                              <p className="text-[11px] text-muted-foreground pl-5 truncate">{item.medicine_code}</p>
                                            </td>
                                            <td className="py-2 px-3 text-[11px] text-muted-foreground">
                                              {item.dosage ? `Dosis: ${item.dosage}` : "Komponen racikan"}
                                            </td>
                                            <td className="py-2 px-3">{item.quantity} {item.unit}</td>
                                            <td className="py-2 px-3 text-right font-mono">{formatRupiah(item.quantity * item.unit_price)}</td>
                                            <td className="py-2 px-3 text-[11px] text-muted-foreground">Komponen</td>
                                            <td className="py-2 px-3 text-center text-muted-foreground">-</td>
                                          </tr>
                                        ))}
                                    </Fragment>
                                  );
                                }

                                const item = group.items[0];
                                const index = orderItems.findIndex((candidate) => candidate === item);
                                const detailSummary = [item.dosage || "-", item.frequency || "-"].join(" • ");
                                const hasError = Boolean(itemErrors[index]?.length);

                                return (
                                  <tr key={group.key} className="border-t border-neutral-200 dark:border-neutral-800 align-top">
                                    <td className="py-2.5 px-3">
                                      <p className="font-semibold text-xs text-foreground truncate">{item.medicine_name}</p>
                                      <p className="text-[11px] text-muted-foreground truncate">{item.medicine_code} • Stok {item.available_stock} {item.unit}</p>
                                    </td>
                                    <td className="py-2.5 px-3">
                                      <p className="truncate">{detailSummary}</p>
                                      <p className="text-[11px] text-muted-foreground truncate">Instruksi: {item.instructions || "-"}</p>
                                      {item.notes ? <p className="text-[11px] text-muted-foreground truncate">Catatan: {item.notes}</p> : null}
                                    </td>
                                    <td className="py-2.5 px-3 font-semibold">{item.quantity} {item.unit}</td>
                                    <td className="py-2.5 px-3 text-right">
                                      <p className="text-[11px] font-mono text-muted-foreground">@ {formatRupiah(item.unit_price)}</p>
                                      <p className="text-xs font-mono font-bold leading-4">{formatRupiah(item.quantity * item.unit_price)}</p>
                                    </td>
                                    <td className="py-2.5 px-3">
                                      {hasError ? (
                                        <Badge variant="destructive" className="rounded-none text-[10px] h-5 px-1.5" title={itemErrors[index][0]}>Perlu Lengkapi</Badge>
                                      ) : (
                                        <Badge variant="outline" className="rounded-none text-[10px] h-5 px-1.5">Siap</Badge>
                                      )}
                                    </td>
                                    <td className="py-2 px-3">
                                      <div className="flex items-center justify-center gap-1">
                                        <Button
                                          type="button"
                                          variant="ghost"
                                          size="icon"
                                          className="h-7 w-7 rounded-none"
                                          title="Edit detail obat"
                                          onClick={() => openEditItemDialog(index)}
                                        >
                                          <Pencil className="h-3.5 w-3.5" />
                                        </Button>
                                        <Button
                                          type="button"
                                          variant="ghost"
                                          size="icon"
                                          className="h-7 w-7 rounded-none text-destructive"
                                          title="Hapus obat"
                                          onClick={() => handleRemoveItem(index)}
                                        >
                                          <Trash2 className="h-3.5 w-3.5" />
                                        </Button>
                                      </div>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                            <tfoot>
                              <tr className="border-t border-neutral-300 dark:border-neutral-700 bg-neutral-50/80 dark:bg-neutral-900/60">
                                <td colSpan={3} className="py-2.5 px-3 text-right">
                                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Grand Total</span>
                                </td>
                                <td className="py-2.5 px-3 text-right">
                                  <span className="text-sm font-mono font-bold text-foreground">{formatRupiah(orderGrandTotal)}</span>
                                </td>
                                <td colSpan={2} className="py-2.5 px-3" />
                              </tr>
                            </tfoot>
                          </table>
                        </div>
                      </>
                    )}

                    <Dialog
                      open={showEditItemDialog}
                      onOpenChange={(open) => {
                        setShowEditItemDialog(open);
                        if (!open) {
                          setEditingItemIndex(null);
                          setEditingItemDraft(null);
                          setEditingMedicineSearch("");
                        }
                      }}
                    >
                      <DialogContent className="w-[calc(100vw-1rem)] sm:max-w-2xl max-h-[90vh] rounded-none p-0 gap-0 border-neutral-200 dark:border-neutral-800 overflow-hidden flex flex-col">
                        <DialogHeader className="px-4 py-3 border-b border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 shrink-0">
                          <div className="flex items-center gap-2.5">
                            <div className="size-8 bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 flex items-center justify-center shrink-0">
                              <Pencil className="h-4 w-4" />
                            </div>
                            <div className="text-left min-w-0">
                              <DialogTitle className="text-sm font-bold uppercase tracking-tight">
                                Edit Detail Obat
                              </DialogTitle>
                              <DialogDescription className="text-xs mt-0.5">
                                Ubah obat, jumlah, dosis, aturan pakai (signa), dan catatan tambahan untuk item ini.
                              </DialogDescription>
                            </div>
                          </div>
                        </DialogHeader>

                        {editingItemDraft ? (
                          <div className="flex-1 overflow-y-auto p-4 space-y-4 [&_input]:h-9 [&_[role=combobox]]:h-9 [&_input]:rounded-none [&_textarea]:rounded-none [&_[role=combobox]]:rounded-none [&_input]:text-xs [&_[role=combobox]]:text-xs">
                            <div className="border-l-4 border-l-neutral-900 dark:border-l-neutral-100 border border-neutral-200 dark:border-neutral-800 bg-neutral-50/60 dark:bg-neutral-900/40 px-3.5 py-2.5 flex items-center justify-between gap-2">
                              <div className="min-w-0">
                                <p className="font-semibold text-xs text-foreground truncate">{editingItemDraft.medicine_name}</p>
                                <p className="text-[11px] font-mono text-muted-foreground">{editingItemDraft.medicine_code}</p>
                              </div>
                              <Badge variant="outline" className="rounded-none text-[10px] h-5 px-1.5 font-mono shrink-0">
                                Stok: {editingItemDraft.available_stock} {editingItemDraft.unit}
                              </Badge>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              <div className="space-y-1.5 md:col-span-2">
                                <Label className="text-xs font-medium">Ganti Obat</Label>
                                <Combobox
                                  options={pharmacyMedicines
                                    .filter(
                                      (medicine) =>
                                        medicine.medicine.id === editingItemDraft.medicine_id ||
                                        !orderItems.some(
                                          (item, index) =>
                                            index !== editingItemIndex && item.medicine_id === medicine.medicine.id,
                                        ),
                                    )
                                    .filter(
                                      (medicine) =>
                                        !editingMedicineSearch ||
                                        medicine.medicine.name.toLowerCase().includes(editingMedicineSearch.toLowerCase()) ||
                                        medicine.medicine.code.toLowerCase().includes(editingMedicineSearch.toLowerCase()),
                                    )
                                    .map((medicine) => ({
                                      value: String(medicine.medicine.id),
                                      label: medicine.medicine.name,
                                    }))}
                                  value={String(editingItemDraft.medicine_id)}
                                  onSearchChange={setEditingMedicineSearch}
                                  onValueChange={(value) => {
                                    const nextMedicine = pharmacyMedicines.find(
                                      (medicine) => medicine.medicine.id === Number(value),
                                    );
                                    if (!nextMedicine) return;
                                    const nextUnitPrice =
                                      nextMedicine.medicine.selling_price ||
                                      nextMedicine.medicine.unit_price ||
                                      nextMedicine.medicine.price ||
                                      nextMedicine.unit_price ||
                                      nextMedicine.price ||
                                      nextMedicine.selling_price ||
                                      0;
                                    setEditingItemDraft((prev) =>
                                      prev
                                        ? {
                                            ...prev,
                                            medicine_id: nextMedicine.medicine.id,
                                            medicine_name: nextMedicine.medicine.name,
                                            medicine_code: nextMedicine.medicine.code,
                                            unit: nextMedicine.medicine.unit,
                                            available_stock: nextMedicine.quantity,
                                            unit_price: nextUnitPrice,
                                            quantity: Math.min(prev.quantity, Math.max(1, nextMedicine.quantity)),
                                          }
                                        : prev,
                                    );
                                  }}
                                  placeholder="Pilih obat pengganti"
                                  searchPlaceholder="Cari obat..."
                                  emptyText="Obat tidak ditemukan"
                                  className="w-full"
                                />
                              </div>
                              <div className="space-y-1.5">
                                <Label className="text-xs font-medium">Jumlah *</Label>
                                <Input
                                  type="number"
                                  min={1}
                                  max={editingItemDraft.available_stock}
                                  value={editingItemDraft.quantity}
                                  onChange={(e) =>
                                    setEditingItemDraft((prev) =>
                                      prev ? { ...prev, quantity: Number(e.target.value) || 1 } : prev,
                                    )
                                  }
                                />
                              </div>
                              <div className="space-y-1.5">
                                <Label className="text-xs font-medium">Dosis *</Label>
                                <Input
                                  value={editingItemDraft.dosage}
                                  onChange={(e) =>
                                    setEditingItemDraft((prev) => (prev ? { ...prev, dosage: e.target.value } : prev))
                                  }
                                  placeholder="Misal: 500 mg / 1 tablet"
                                />
                              </div>
                              <div className="space-y-1.5 md:col-span-2">
                                <Label className="text-xs font-medium">Signa / Aturan Pakai *</Label>
                                <Combobox
                                  allowCustomValue
                                  options={signaOptions}
                                  value={editingItemDraft.instructions}
                                  onValueChange={(value) =>
                                    setEditingItemDraft((prev) =>
                                      prev ? { ...prev, instructions: value, frequency: value } : prev,
                                    )
                                  }
                                  placeholder="Pilih atau ketik signa (contoh: 3 x 1 Setelah Makan)"
                                  searchPlaceholder="Cari atau ketik signa..."
                                  emptyText="Tekan enter untuk menggunakan signa ini"
                                  className="w-full"
                                />
                              </div>
                              <div className="space-y-1.5 md:col-span-2">
                                <Label className="text-xs font-medium">Catatan Tambahan</Label>
                                <Textarea
                                  placeholder="Catatan khusus pemakaian obat ini (opsional)..."
                                  value={editingItemDraft.notes}
                                  onChange={(e) =>
                                    setEditingItemDraft((prev) => (prev ? { ...prev, notes: e.target.value } : prev))
                                  }
                                  className="min-h-[68px] resize-none text-xs rounded-none"
                                />
                              </div>
                            </div>
                          </div>
                        ) : null}

                        <DialogFooter className="px-4 py-3 border-t border-neutral-200 dark:border-neutral-800 bg-neutral-50/60 dark:bg-neutral-900/40 shrink-0 gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-8 rounded-none px-4 text-xs"
                            onClick={() => setShowEditItemDialog(false)}
                          >
                            Batal
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            className="h-8 rounded-none px-4 text-xs"
                            onClick={handleSaveEditedItem}
                            disabled={!editingItemDraft}
                          >
                            Simpan Perubahan
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>

                    <Dialog
                      open={showEditRacikanDialog}
                      onOpenChange={(open) => {
                        setShowEditRacikanDialog(open);
                        if (!open) {
                          setEditingRacikanKey(null);
                          setEditingRacikanComponents([]);
                          setEditingRacikanSearch("");
                        }
                      }}
                    >
                      <DialogContent className="sm:max-w-4xl lg:max-w-5xl max-h-[90vh] rounded-none p-0 gap-0 border-neutral-200 dark:border-neutral-800 overflow-hidden flex flex-col">
                        <DialogHeader className="px-4 py-3 border-b border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 shrink-0">
                          <div className="flex items-center gap-2.5">
                            <div className="size-8 bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 flex items-center justify-center shrink-0">
                              <FlaskConical className="h-4 w-4" />
                            </div>
                            <div className="text-left min-w-0">
                              <DialogTitle className="text-sm font-bold uppercase tracking-tight">
                                Edit Detail Racikan
                              </DialogTitle>
                              <DialogDescription className="text-xs mt-0.5">
                                Atur kembali identitas racikan, aturan pakai, serta komponen dan dosis bahan racikan.
                              </DialogDescription>
                            </div>
                          </div>
                        </DialogHeader>

                        <div className="grid flex-1 min-h-0 overflow-y-auto md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-neutral-200 dark:divide-neutral-800 [&_input]:h-9 [&_[role=combobox]]:h-9 [&_input]:rounded-none [&_[role=combobox]]:rounded-none [&_input]:text-xs [&_[role=combobox]]:text-xs">
                          {/* Left Column: Detail Racikan */}
                          <div className="p-4 space-y-3">
                            <div className="flex items-center justify-between gap-2">
                              <div className="border-l-2 border-neutral-900 dark:border-neutral-100 pl-2.5 text-xs font-bold uppercase tracking-wider text-neutral-900 dark:text-neutral-100">
                                Detail &amp; Aturan Pakai Racikan
                              </div>
                              <Badge variant="secondary" className="rounded-none text-[10px] h-5 px-1.5 font-mono">
                                {editingRacikanComponents.length} Komponen
                              </Badge>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <div className="space-y-1.5">
                                <Label className="text-xs font-medium">Nama Racikan</Label>
                                <Input
                                  value={editingRacikanMeta.name}
                                  onChange={(e) => setEditingRacikanMeta((prev) => ({ ...prev, name: e.target.value }))}
                                />
                              </div>
                              <div className="space-y-1.5">
                                <Label className="text-xs font-medium">Jenis Racikan</Label>
                                <Select
                                  value={editingRacikanMeta.type}
                                  onValueChange={(value) => setEditingRacikanMeta((prev) => ({ ...prev, type: value }))}
                                >
                                  <SelectTrigger className="h-9 text-xs rounded-none">
                                    <SelectValue placeholder="Pilih jenis" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {RACIKAN_TYPE_OPTIONS.map((option) => (
                                      <SelectItem key={`edit-racikan-type-${option}`} value={option} className="text-xs">
                                        {option}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>

                            <div className="grid grid-cols-3 gap-3">
                              <div className="space-y-1.5">
                                <Label className="text-xs font-medium">Jumlah Hasil</Label>
                                <Input
                                  type="number"
                                  min={1}
                                  value={editingRacikanMeta.qty}
                                  onChange={(e) =>
                                    setEditingRacikanMeta((prev) => ({ ...prev, qty: Number(e.target.value) || 1 }))
                                  }
                                />
                              </div>
                              <div className="space-y-1.5">
                                <Label className="text-xs font-medium">Satuan Hasil</Label>
                                <Input
                                  value={editingRacikanMeta.unit}
                                  onChange={(e) => setEditingRacikanMeta((prev) => ({ ...prev, unit: e.target.value }))}
                                />
                              </div>
                              <div className="space-y-1.5">
                                <Label className="text-xs font-medium">Dosis</Label>
                                <Input
                                  value={editingRacikanMeta.dosage}
                                  onChange={(e) =>
                                    setEditingRacikanMeta((prev) => ({ ...prev, dosage: e.target.value }))
                                  }
                                />
                              </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <div className="space-y-1.5">
                                <Label className="text-xs font-medium">Signa / Aturan Pakai</Label>
                                <Combobox
                                  allowCustomValue
                                  options={signaOptions}
                                  value={editingRacikanMeta.instructions}
                                  onValueChange={(value) =>
                                    setEditingRacikanMeta((prev) => ({ ...prev, instructions: value, frequency: value }))
                                  }
                                  placeholder="Pilih atau ketik signa"
                                  searchPlaceholder="Cari signa..."
                                  emptyText="Tekan enter"
                                  className="w-full"
                                />
                              </div>
                              <div className="space-y-1.5">
                                <Label className="text-xs font-medium">Catatan Racikan</Label>
                                <Input
                                  value={editingRacikanMeta.notes}
                                  onChange={(e) =>
                                    setEditingRacikanMeta((prev) => ({ ...prev, notes: e.target.value }))
                                  }
                                  placeholder="Catatan racikan (opsional)"
                                />
                              </div>
                            </div>
                          </div>

                          {/* Right Column: Komponen Bahan Obat */}
                          <div className="p-4 space-y-3 flex flex-col">
                            <div className="flex items-center justify-between gap-2">
                              <div className="border-l-2 border-neutral-900 dark:border-neutral-100 pl-2.5 text-xs font-bold uppercase tracking-wider text-neutral-900 dark:text-neutral-100">
                                Komponen Bahan Obat
                              </div>
                              <Badge variant="outline" className="rounded-none text-[10px] h-5 px-1.5 font-mono">
                                {editingRacikanComponents.length} Dipilih
                              </Badge>
                            </div>

                            <div className="relative">
                              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                              <Input
                                placeholder="Cari nama atau kode bahan obat..."
                                className="pl-8"
                                value={editingRacikanSearch}
                                onChange={(e) => setEditingRacikanSearch(e.target.value)}
                              />
                            </div>

                            <div className="flex-1 min-h-[220px] max-h-[300px] overflow-y-auto border border-neutral-200 dark:border-neutral-800 p-2 space-y-2">
                              {editingRacikanComponents.length > 0 && (
                                <div className="space-y-1.5">
                                  <div className="flex items-center justify-between px-0.5">
                                    <span className="text-[11px] font-bold uppercase tracking-wider text-foreground flex items-center gap-1">
                                      <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                                      Bahan Terpilih ({editingRacikanComponents.length})
                                    </span>
                                  </div>
                                  <div className="divide-y divide-neutral-200 dark:divide-neutral-800 border border-neutral-200 dark:border-neutral-800">
                                    {editingRacikanComponents.map((item, index) => (
                                      <div
                                        key={`edit-racikan-comp-${item.medicine_id}-${index}`}
                                        className="border-l-4 border-l-neutral-900 dark:border-l-neutral-100 bg-neutral-50/60 dark:bg-neutral-900/40 px-2.5 py-1.5 flex items-center justify-between gap-2"
                                      >
                                        <div className="min-w-0 flex-1">
                                          <p className="font-semibold text-xs text-foreground truncate">{item.medicine_name}</p>
                                          <p className="text-[10px] text-muted-foreground truncate">{item.medicine_code}</p>
                                        </div>
                                        <div className="flex items-center gap-1.5 shrink-0">
                                          <Label className="text-[11px] text-muted-foreground whitespace-nowrap shrink-0">
                                            Dosis:
                                          </Label>
                                          <Input
                                            value={item.dosage || ""}
                                            onChange={(e) => handleEditRacikanComponentDosage(index, e.target.value)}
                                            placeholder="Misal: 1/2 tab"
                                            className="!h-7 w-24 sm:w-28 text-xs bg-white dark:bg-neutral-950 px-2"
                                            autoFocus={index === editingRacikanComponents.length - 1 && !item.dosage}
                                          />
                                          <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            className="h-6 w-6 rounded-none text-destructive hover:bg-destructive/10 shrink-0"
                                            onClick={() => handleRemoveEditingRacikanComponent(index)}
                                            title="Hapus bahan"
                                          >
                                            <Trash2 className="h-3 w-3" />
                                          </Button>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              <div>
                                {editingRacikanComponents.length > 0 && (
                                  <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground px-0.5 py-1">
                                    Pilih Bahan Lainnya
                                  </div>
                                )}
                                <div className="divide-y divide-neutral-200 dark:divide-neutral-800 border border-neutral-200 dark:border-neutral-800">
                                  {filteredEditingRacikanMedicines.length === 0 ? (
                                    <div className="text-center py-5 text-xs text-muted-foreground">
                                      {editingRacikanSearch ? "Tidak ada obat yang sesuai" : "Semua bahan sudah dipilih"}
                                    </div>
                                  ) : (
                                    filteredEditingRacikanMedicines.map((pm) => (
                                      <button
                                        key={`edit-racikan-add-${pm.id}`}
                                        type="button"
                                        className="w-full px-2.5 py-2 hover:bg-muted/40 flex items-center justify-between gap-2 text-left transition-colors"
                                        onClick={() => handleAddEditingRacikanComponent(pm)}
                                      >
                                        <div className="min-w-0 flex-1">
                                          <p className="font-semibold text-xs text-foreground truncate">{pm.medicine.name}</p>
                                          <p className="text-[10px] text-muted-foreground truncate">
                                            {pm.medicine.code} • {pm.medicine.form || "-"} • {pm.medicine.strength || "-"}
                                          </p>
                                        </div>
                                        <span className="text-[11px] font-medium border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 px-2 py-0.5 shrink-0 flex items-center gap-0.5">
                                          <Plus className="h-3 w-3" /> Pilih
                                        </span>
                                      </button>
                                    ))
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>

                        <DialogFooter className="px-4 py-3 border-t border-neutral-200 dark:border-neutral-800 bg-neutral-50/60 dark:bg-neutral-900/40 shrink-0 gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-8 rounded-none px-4 text-xs"
                            onClick={() => setShowEditRacikanDialog(false)}
                          >
                            Batal
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            className="h-8 rounded-none px-4 text-xs"
                            onClick={handleSaveEditedRacikan}
                            disabled={editingRacikanComponents.length === 0}
                          >
                            Simpan Racikan
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </section>

                  {/* Section 3: Catatan untuk Farmasi */}
                  <section className="px-4 sm:px-5 py-4 space-y-3">
                    <div className="border-l-2 border-neutral-900 dark:border-neutral-100 pl-2.5 text-xs font-bold uppercase tracking-wider text-neutral-900 dark:text-neutral-100">
                      Catatan untuk Farmasi
                    </div>
                    <Textarea
                      placeholder="Catatan atau instruksi tambahan untuk apoteker / petugas farmasi..."
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      className="min-h-[72px] resize-none text-xs rounded-none"
                    />
                  </section>

                  {/* Submit Button */}
                  <div className="flex justify-stretch sm:justify-end px-4 sm:px-5 py-3">
                    <Button
                      size="sm"
                      className="h-8 rounded-none text-xs w-full sm:w-auto"
                      disabled={submitting || orderItems.length === 0 || !hasPermission("medicine_orders.create") || readOnly}
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
              <section className="px-4 sm:px-5 py-4 space-y-3 border-b border-neutral-200 dark:border-neutral-800">
                <div className="flex items-center gap-2">
                  <div className="border-l-2 border-neutral-900 dark:border-neutral-100 pl-2.5 text-xs font-bold uppercase tracking-wider text-neutral-900 dark:text-neutral-100">
                    Riwayat Order Obat
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
                        canCancel={
                          hasPermission("medicine_orders.cancel") ||
                          hasPermission("medicine_order.cancel") ||
                          hasPermission("medical_records.medicine_order")
                        }
                      />
                    ))}
                  </div>
                ) : (
                  <div className="border border-dashed border-neutral-200 dark:border-neutral-800 bg-neutral-50/30 dark:bg-neutral-900/10 px-3.5 py-2.5 text-xs text-muted-foreground">
                    Belum ada riwayat order obat pada kunjungan ini.
                  </div>
                )}
              </section>
            )}
          </TooltipProvider>
        </div>
      </div>

      {/* Cancel Confirmation Dialog */}
      <Dialog open={cancelConfirmOrderId !== null} onOpenChange={(open) => !open && setCancelConfirmOrderId(null)}>
        <DialogContent className="max-w-sm rounded-none">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold uppercase tracking-tight">Konfirmasi Pembatalan</DialogTitle>
            <DialogDescription className="text-xs">
              Apakah Anda yakin ingin membatalkan order obat ini? Tindakan ini tidak dapat dibatalkan.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" size="sm" className="h-8 rounded-none text-xs" onClick={() => setCancelConfirmOrderId(null)}>
              Batal
            </Button>
            <Button variant="destructive" size="sm" className="h-8 rounded-none text-xs" onClick={handleConfirmCancelOrder}>
              Ya, Batalkan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}


