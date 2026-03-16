import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
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
  Trash2,
  Search,
  Pill,
  Clock,
  Send,
  Printer,
  ChevronDown,
  ChevronRight,
  Package,
  BookmarkPlus,
} from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { roomsApi, medicineOrdersApi, getPharmacyRoomMedicines, printApi, medicalRecordsApi } from "@/lib/api";
import {
  medicineOrderTemplatesApi,
  type DoctorMedicineTemplate,
} from "@/lib/api/medicine-order-templates";
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
  unit_price: number;
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
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-sm">
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
            </div>
            
            {/* Order Items Table */}
            {order.items && order.items.length > 0 && (
              <div className="border rounded-lg overflow-x-auto">
                <table className="w-full min-w-[640px] text-sm">
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
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-medium">{item.medicine?.name}</p>
                            {item.added_by_pharmacy && (
                              <Badge variant="outline" className="text-[10px] h-5 px-1.5 border-blue-300 text-blue-700 bg-blue-50">
                                Ditambah Farmasi
                              </Badge>
                            )}
                          </div>
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

  const formatRupiah = (value: number) =>
    new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 0,
    }).format(value || 0);

  const frequencyOptions = [
    "1x1",
    "2x1",
    "3x1",
    "4x1",
    "1x sehari",
    "2x sehari",
    "3x sehari",
    "4x sehari",
    "setiap 4 jam",
    "setiap 6 jam",
    "setiap 8 jam",
    "setiap 12 jam",
    "bila perlu",
  ];

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

  const instructionOptions = [
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
  ].map((o) => ({ value: o, label: o }));

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

  const filteredTemplateMedicines = pharmacyMedicines.filter((pm) => {
    const alreadyAdded = templateItems.some((item) => item.medicine_id === pm.medicine.id);
    if (alreadyAdded) return false;

    return (
      pm.medicine.name.toLowerCase().includes(templateMedicineSearch.toLowerCase()) ||
      pm.medicine.generic_name?.toLowerCase().includes(templateMedicineSearch.toLowerCase()) ||
      pm.medicine.code.toLowerCase().includes(templateMedicineSearch.toLowerCase())
    );
  });

  const filteredTemplates = useMemo(() => {
    const keyword = templateSearchTerm.trim().toLowerCase();
    if (!keyword) return doctorTemplates;
    return doctorTemplates.filter((template) =>
      [template.name, template.notes]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(keyword))
    );
  }, [doctorTemplates, templateSearchTerm]);

  const orderGrandTotal = orderItems.reduce((sum, item) => sum + item.quantity * item.unit_price, 0);

  const handleAddItem = (medicine: PharmacyMedicine) => {
    const unitPrice =
      medicine.medicine.selling_price ||
      medicine.medicine.unit_price ||
      medicine.medicine.price ||
      medicine.unit_price ||
      medicine.price ||
      medicine.selling_price ||
      0;

    const item: OrderItem = {
      medicine_id: medicine.medicine.id,
      medicine_name: medicine.medicine.name,
      medicine_code: medicine.medicine.code,
      quantity: 1,
      unit: medicine.medicine.unit,
      dosage: medicine.medicine.strength || "",
      frequency: "",
      route: "oral",
      duration: "",
      instructions: "",
      available_stock: medicine.quantity,
      unit_price: unitPrice,
    };

    setOrderItems((prev) => [...prev, item]);
    setItemErrors({});
    setSearchTerm("");
    setShowAddDialog(false);
  };

  const handleAddTemplateItem = (medicine: PharmacyMedicine) => {
    const unitPrice =
      medicine.medicine.selling_price ||
      medicine.medicine.unit_price ||
      medicine.medicine.price ||
      medicine.unit_price ||
      medicine.price ||
      medicine.selling_price ||
      0;

    const item: OrderItem = {
      medicine_id: medicine.medicine.id,
      medicine_name: medicine.medicine.name,
      medicine_code: medicine.medicine.code,
      quantity: 1,
      unit: medicine.medicine.unit,
      dosage: medicine.medicine.strength || "",
      frequency: "",
      route: "oral",
      duration: "",
      instructions: "",
      available_stock: medicine.quantity,
      unit_price: unitPrice,
    };

    setTemplateItems((prev) => [...prev, item]);
    setTemplateMedicineSearch("");
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
          quantity: Math.min(pm.quantity, qty),
          unit: item.unit || pm.medicine.unit,
          dosage: item.dosage || pm.medicine.strength || "",
          frequency: item.frequency || "",
          route: item.route || "oral",
          duration: item.duration || "",
          instructions: item.instructions || "",
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

  const handleUpdateItemQuantity = (index: number, quantity: number) => {
    const newItems = [...orderItems];
    const maxStock = newItems[index].available_stock;
    const nextQty = Math.max(1, Math.min(quantity || 0, maxStock));
    newItems[index].quantity = nextQty;
    setOrderItems(newItems);
    setItemErrors({});
  };

  const handleUpdateItemField = (index: number, field: keyof OrderItem, value: string | number) => {
    const newItems = [...orderItems];
    (newItems[index] as any)[field] = value;
    setOrderItems(newItems);
    setItemErrors({});
  };

  const validateItems = () => {
    const errors: Record<number, string[]> = {};

    orderItems.forEach((item, index) => {
      const rowErrors: string[] = [];
      if (!item.quantity || item.quantity <= 0) rowErrors.push("Jumlah harus lebih dari 0");
      if (item.quantity > item.available_stock) rowErrors.push("Jumlah melebihi stok");
      if (!item.dosage?.trim()) rowErrors.push("Dosis wajib diisi");
      if (!item.frequency?.trim()) rowErrors.push("Frekuensi wajib diisi");
      if (!item.route?.trim()) rowErrors.push("Rute wajib diisi");
      if (!item.duration?.trim()) rowErrors.push("Durasi wajib diisi");
      if (!item.instructions?.trim()) rowErrors.push("Instruksi wajib diisi");

      if (rowErrors.length > 0) {
        errors[index] = rowErrors;
      }
    });

    return errors;
  };

  const plainFieldClass = "h-8 border-0 bg-transparent shadow-none px-2 focus-visible:ring-1 focus-visible:ring-primary/30";

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
        description: "Pastikan jumlah, dosis, frekuensi, rute, durasi, dan instruksi sudah diisi dengan benar.",
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
    <div>
      <div className="p-0">
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
          {/* Order Items */}
          <div className="space-y-2 pt-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Label className="text-base font-medium">Daftar Obat</Label>
              <div className="flex items-center gap-2">
                <Dialog open={showTemplateDialog} onOpenChange={setShowTemplateDialog}>
                  <DialogTrigger asChild>
                    <Button size="sm" variant="outline" disabled={!selectedPharmacyRoom || loadingTemplates || readOnly}>
                      <Package className="h-4 w-4 mr-1" />
                      Tambah Template
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="w-[calc(100vw-1rem)] sm:max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
                    <DialogHeader>
                      <DialogTitle>Pilih Template Resep</DialogTitle>
                      <DialogDescription>
                        Template ini hanya milik akun dokter Anda. Pilih satu template untuk menambahkan obat otomatis.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Cari template..."
                        className="pl-9"
                        value={templateSearchTerm}
                        onChange={(e) => setTemplateSearchTerm(e.target.value)}
                      />
                    </div>
                    <ScrollArea className="flex-1 max-h-[400px] border rounded-md">
                      <div className="divide-y">
                        {loadingTemplates ? (
                          <div className="flex items-center justify-center py-8">
                            <Loader2 className="h-6 w-6 animate-spin" />
                          </div>
                        ) : filteredTemplates.length === 0 ? (
                          <div className="text-center py-8 text-muted-foreground">
                            {templateSearchTerm ? "Template tidak ditemukan" : "Belum ada template resep"}
                          </div>
                        ) : (
                          filteredTemplates.map((template) => (
                            <button
                              key={template.id}
                              type="button"
                              className="w-full p-3 hover:bg-muted/50 flex items-center justify-between gap-3 text-left"
                              onClick={() => handleApplyTemplate(template)}
                            >
                              <div>
                                <p className="font-medium text-sm">{template.name}</p>
                                <p className="text-xs text-muted-foreground">
                                  {(template.items?.length || 0)} obat
                                  {template.notes ? ` • ${template.notes}` : ""}
                                  {template.dpjp_employee_id ? " • Scope: DPJP" : ""}
                                </p>
                              </div>
                            </button>
                          ))
                        )}
                      </div>
                    </ScrollArea>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setShowTemplateDialog(false)}>
                        Tutup
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>

                <Dialog open={showCreateTemplateDialog} onOpenChange={setShowCreateTemplateDialog}>
                  <DialogTrigger asChild>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={readOnly}
                      onClick={() => {
                        setTemplateItems(orderItems.map((item) => ({ ...item })));
                        setTemplateMedicineSearch("");
                      }}
                    >
                      <BookmarkPlus className="h-4 w-4 mr-1" />
                      Buat Template
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="w-[calc(100vw-1rem)] sm:max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
                    <DialogHeader>
                      <DialogTitle>Simpan Template Resep</DialogTitle>
                      <DialogDescription>
                        Simpan template resep pribadi dokter. Anda bisa ambil dari order saat ini, lalu tambah/ubah item di modal ini.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-3 overflow-y-auto pr-1">
                      <div className="space-y-1">
                        <Label>Nama Template</Label>
                        <Input
                          value={templateName}
                          onChange={(e) => setTemplateName(e.target.value)}
                          placeholder="Contoh: Resep ISPA Dewasa"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label>Catatan (opsional)</Label>
                        <Textarea
                          value={templateNotes}
                          onChange={(e) => setTemplateNotes(e.target.value)}
                          placeholder="Keterangan tambahan"
                        />
                      </div>
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={bindTemplateToDPJP}
                          onChange={(e) => setBindTemplateToDPJP(e.target.checked)}
                        />
                        Scope hanya untuk DPJP pasien ini
                      </label>

                      <div className="space-y-2 border rounded-md p-3">
                        <div className="flex items-center justify-between gap-2">
                          <Label className="text-sm font-medium">Isi Obat Template</Label>
                          <Badge variant="outline">{templateItems.length} obat</Badge>
                        </div>

                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input
                            placeholder="Cari obat untuk ditambahkan ke template..."
                            className="pl-9"
                            value={templateMedicineSearch}
                            onChange={(e) => setTemplateMedicineSearch(e.target.value)}
                          />
                        </div>

                        <ScrollArea className="h-44 border rounded-md">
                          <div className="divide-y">
                            {filteredTemplateMedicines.length === 0 ? (
                              <div className="text-center py-6 text-sm text-muted-foreground">
                                {templateMedicineSearch ? "Obat tidak ditemukan" : "Semua obat sudah masuk ke template"}
                              </div>
                            ) : (
                              filteredTemplateMedicines.map((pm) => (
                                <button
                                  key={`template-${pm.id}`}
                                  type="button"
                                  className="w-full p-2.5 hover:bg-muted/50 flex items-center justify-between text-left"
                                  onClick={() => handleAddTemplateItem(pm)}
                                >
                                  <div>
                                    <p className="text-sm font-medium">{pm.medicine.name}</p>
                                    <p className="text-xs text-muted-foreground">{pm.medicine.code} • Stok {pm.quantity}</p>
                                  </div>
                                  <Plus className="h-4 w-4 text-muted-foreground" />
                                </button>
                              ))
                            )}
                          </div>
                        </ScrollArea>

                        {templateItems.length > 0 ? (
                          <div className="border rounded-md overflow-x-auto">
                            <table className="w-full text-xs min-w-[900px]">
                              <thead className="bg-muted/50 border-b">
                                <tr>
                                  <th className="py-2 px-2 text-left">Obat</th>
                                  <th className="py-2 px-2 text-left w-[80px]">Qty</th>
                                  <th className="py-2 px-2 text-left w-[120px]">Dosis</th>
                                  <th className="py-2 px-2 text-left w-[130px]">Frekuensi</th>
                                  <th className="py-2 px-2 text-left w-[140px]">Rute</th>
                                  <th className="py-2 px-2 text-left w-[110px]">Durasi</th>
                                  <th className="py-2 px-2 text-left">Instruksi</th>
                                  <th className="py-2 px-2 text-left w-[52px]">Aksi</th>
                                </tr>
                              </thead>
                              <tbody>
                                {templateItems.map((item, index) => (
                                  <tr key={`template-item-${item.medicine_id}-${index}`} className="border-t align-top">
                                    <td className="py-2 px-2">
                                      <p className="font-medium">{item.medicine_name}</p>
                                      <p className="text-[11px] text-muted-foreground">{item.medicine_code}</p>
                                    </td>
                                    <td className="py-2 px-2">
                                      <Input
                                        type="number"
                                        min={1}
                                        max={item.available_stock}
                                        value={item.quantity}
                                        onChange={(e) => handleUpdateTemplateItemQuantity(index, Number(e.target.value))}
                                        className="h-7"
                                      />
                                    </td>
                                    <td className="py-2 px-2">
                                      <Input
                                        value={item.dosage}
                                        onChange={(e) => handleUpdateTemplateItemField(index, "dosage", e.target.value)}
                                        className="h-7"
                                      />
                                    </td>
                                    <td className="py-2 px-2">
                                      <Select
                                        value={item.frequency}
                                        onValueChange={(value) => handleUpdateTemplateItemField(index, "frequency", value)}
                                      >
                                        <SelectTrigger className="h-7"><SelectValue placeholder="Pilih" /></SelectTrigger>
                                        <SelectContent>
                                          {frequencyOptions.map((option) => (
                                            <SelectItem key={`tmp-freq-${option}`} value={option}>{option}</SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                    </td>
                                    <td className="py-2 px-2">
                                      <Select
                                        value={item.route}
                                        onValueChange={(value) => handleUpdateTemplateItemField(index, "route", value)}
                                      >
                                        <SelectTrigger className="h-7"><SelectValue placeholder="Pilih" /></SelectTrigger>
                                        <SelectContent>
                                          {routeOptions.map((option) => (
                                            <SelectItem key={`tmp-route-${option.value}`} value={option.value}>{option.label}</SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                    </td>
                                    <td className="py-2 px-2">
                                      <Input
                                        value={item.duration}
                                        onChange={(e) => handleUpdateTemplateItemField(index, "duration", e.target.value)}
                                        className="h-7"
                                      />
                                    </td>
                                    <td className="py-2 px-2">
                                      <Combobox
                                        options={instructionOptions}
                                        value={item.instructions}
                                        onValueChange={(value) => handleUpdateTemplateItemField(index, "instructions", value)}
                                        placeholder="Pilih instruksi"
                                        searchPlaceholder="Cari instruksi..."
                                        emptyText="Instruksi tidak ditemukan"
                                      />
                                    </td>
                                    <td className="py-2 px-2">
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className="h-7 w-7 text-destructive"
                                        onClick={() => handleRemoveTemplateItem(index)}
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
                          <p className="text-xs text-muted-foreground">Belum ada obat pada template. Tambahkan obat dari daftar di atas.</p>
                        )}
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setShowCreateTemplateDialog(false)}>
                        Batal
                      </Button>
                      <Button onClick={handleCreateTemplate} disabled={templateSaving || templateItems.length === 0}>
                        {templateSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                        Simpan Template
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>

                <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
                  <DialogTrigger asChild>
                    <Button size="sm" disabled={!selectedPharmacyRoom || loadingMedicines || readOnly}>
                      <Plus className="h-4 w-4 mr-1" />
                      Tambah Obat
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="w-[calc(100vw-1rem)] sm:max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
                    <DialogHeader>
                      <DialogTitle>Pilih Obat</DialogTitle>
                      <DialogDescription>
                        Pilih obat, lalu lengkapi semua detail resep langsung di tabel order
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
                        {loadingMedicines ? (
                          <div className="flex items-center justify-center py-8">
                            <Loader2 className="h-6 w-6 animate-spin" />
                          </div>
                        ) : filteredMedicines.length === 0 ? (
                          <div className="text-center py-8 text-muted-foreground">
                            {searchTerm ? "Tidak ada obat yang sesuai" : "Semua obat yang tersedia sudah dipilih"}
                          </div>
                        ) : (
                          filteredMedicines.map((pm) => (
                            <button
                              key={pm.id}
                              type="button"
                              className="w-full p-3 hover:bg-muted/50 flex items-center justify-between gap-3 text-left"
                              onClick={() => handleAddItem(pm)}
                            >
                              <div>
                                <p className="font-medium text-sm">{pm.medicine.name}</p>
                                <p className="text-xs text-muted-foreground">
                                  {pm.medicine.code} • {pm.medicine.form} • {pm.medicine.strength}
                                </p>
                              </div>
                              <div className="flex items-center gap-2">
                                <Badge variant={pm.quantity > pm.min_quantity ? "default" : "destructive"}>
                                  Stok: {pm.quantity}
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
              </div>
            </div>

            {orderItems.length === 0 ? (
              <div className="border-2 border-dashed rounded-lg p-8 text-center text-muted-foreground">
                <Pill className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>Belum ada obat ditambahkan</p>
                <p className="text-sm">Klik "Tambah Obat" atau "Tambah Template" untuk memulai</p>
              </div>
            ) : (
              <>
                <div className="space-y-3 md:hidden">
                  {orderItems.map((item, index) => (
                    <div key={index} className="rounded-lg border p-3 space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-medium text-sm leading-5">{item.medicine_name}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{item.medicine_code} • Stok {item.available_stock} {item.unit}</p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive shrink-0"
                          onClick={() => handleRemoveItem(index)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <Label className="text-xs">Jumlah*</Label>
                          <Input
                            type="number"
                            min={1}
                            max={item.available_stock}
                            value={item.quantity}
                            onChange={(e) => handleUpdateItemQuantity(index, Number(e.target.value))}
                            className={cn(plainFieldClass, itemErrors[index]?.length ? "border border-destructive bg-destructive/5" : "")}
                          />
                          <p className="text-[10px] text-muted-foreground">Maks {item.available_stock}</p>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Dosis*</Label>
                          <Input
                            placeholder="Contoh: 3x1"
                            value={item.dosage}
                            onChange={(e) => handleUpdateItemField(index, "dosage", e.target.value)}
                            className={cn(plainFieldClass, itemErrors[index]?.length ? "border border-destructive bg-destructive/5" : "")}
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 gap-2">
                        <div className="space-y-1">
                          <Label className="text-xs">Frekuensi*</Label>
                          <Select
                            value={item.frequency}
                            onValueChange={(value) => handleUpdateItemField(index, "frequency", value)}
                          >
                            <SelectTrigger className={cn(plainFieldClass, itemErrors[index]?.length ? "border border-destructive bg-destructive/5" : "")}> 
                              <SelectValue placeholder="Pilih" />
                            </SelectTrigger>
                            <SelectContent>
                              {frequencyOptions.map((option) => (
                                <SelectItem key={option} value={option}>{option}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-1">
                          <Label className="text-xs">Rute*</Label>
                          <Select
                            value={item.route}
                            onValueChange={(value) => handleUpdateItemField(index, "route", value)}
                          >
                            <SelectTrigger className={cn(plainFieldClass, itemErrors[index]?.length ? "border border-destructive bg-destructive/5" : "")}> 
                              <SelectValue placeholder="Pilih" />
                            </SelectTrigger>
                            <SelectContent>
                              {routeOptions.map((option) => (
                                <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-1">
                          <Label className="text-xs">Durasi*</Label>
                          <Input
                            placeholder="Contoh: 7 hari"
                            value={item.duration}
                            onChange={(e) => handleUpdateItemField(index, "duration", e.target.value)}
                            className={cn(plainFieldClass, itemErrors[index]?.length ? "border border-destructive bg-destructive/5" : "")}
                          />
                        </div>

                        <div className="space-y-1">
                          <Label className="text-xs">Instruksi*</Label>
                          <Combobox
                            options={instructionOptions}
                            value={item.instructions}
                            onValueChange={(value) => handleUpdateItemField(index, "instructions", value)}
                            placeholder="Pilih instruksi"
                            searchPlaceholder="Cari instruksi..."
                            emptyText="Instruksi tidak ditemukan"
                            className={cn("w-full", itemErrors[index]?.length ? "border border-destructive bg-destructive/5" : "")}
                          />
                          {itemErrors[index]?.length ? (
                            <p className="text-[11px] text-destructive mt-1">{itemErrors[index][0]}</p>
                          ) : null}
                        </div>
                      </div>

                      <div className="rounded-md bg-primary/5 p-2 text-right">
                        <p className="text-xs text-muted-foreground">@ {formatRupiah(item.unit_price)}</p>
                        <p className="text-sm font-semibold leading-4">{formatRupiah(item.quantity * item.unit_price)}</p>
                      </div>
                    </div>
                  ))}

                  <div className="rounded-lg border bg-primary/5 p-3 text-right">
                    <p className="text-sm font-medium text-muted-foreground">Grand Total</p>
                    <p className="text-lg font-bold text-primary">{formatRupiah(orderGrandTotal)}</p>
                  </div>
                </div>

                <div className="hidden md:block border rounded-lg overflow-auto">
                  <table className="w-full text-sm min-w-[1100px]">
                  <thead className="bg-muted/50 border-b">
                    <tr>
                      <th className="py-2 px-2 text-left font-medium w-[220px]">Obat</th>
                      <th className="py-2 px-2 text-left font-medium w-[90px]">Jumlah*</th>
                      <th className="py-2 px-2 text-left font-medium w-[140px]">Dosis*</th>
                      <th className="py-2 px-2 text-left font-medium w-[140px]">Frekuensi*</th>
                      <th className="py-2 px-2 text-left font-medium w-[150px]">Rute*</th>
                      <th className="py-2 px-2 text-left font-medium w-[120px]">Durasi*</th>
                      <th className="py-2 px-2 text-left font-medium">Instruksi*</th>
                      <th className="py-2 px-2 text-right font-medium w-[170px]">Harga</th>
                      <th className="py-2 px-2 text-left font-medium w-[60px]">Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orderItems.map((item, index) => (
                      <tr key={index} className="border-t align-top">
                        <td className="py-2 px-2">
                          <p className="font-medium text-sm leading-4">{item.medicine_name}</p>
                          <p className="text-xs text-muted-foreground">{item.medicine_code} • Stok {item.available_stock} {item.unit}</p>
                        </td>
                        <td className="py-2 px-2">
                          <Input
                            type="number"
                            min={1}
                            max={item.available_stock}
                            value={item.quantity}
                            onChange={(e) => handleUpdateItemQuantity(index, Number(e.target.value))}
                            className={cn(plainFieldClass, itemErrors[index]?.length ? "border border-destructive bg-destructive/5" : "")}
                          />
                          <p className="text-[10px] text-muted-foreground mt-1">Maks {item.available_stock}</p>
                        </td>
                        <td className="py-2 px-2">
                          <Input
                            placeholder="Contoh: 3x1"
                            value={item.dosage}
                            onChange={(e) => handleUpdateItemField(index, "dosage", e.target.value)}
                            className={cn(plainFieldClass, itemErrors[index]?.length ? "border border-destructive bg-destructive/5" : "")}
                          />
                        </td>
                        <td className="py-2 px-2">
                          <Select
                            value={item.frequency}
                            onValueChange={(value) => handleUpdateItemField(index, "frequency", value)}
                          >
                            <SelectTrigger className={cn(plainFieldClass, itemErrors[index]?.length ? "border border-destructive bg-destructive/5" : "")}> 
                              <SelectValue placeholder="Pilih" />
                            </SelectTrigger>
                            <SelectContent>
                              {frequencyOptions.map((option) => (
                                <SelectItem key={option} value={option}>{option}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="py-2 px-2">
                          <Select
                            value={item.route}
                            onValueChange={(value) => handleUpdateItemField(index, "route", value)}
                          >
                            <SelectTrigger className={cn(plainFieldClass, itemErrors[index]?.length ? "border border-destructive bg-destructive/5" : "")}> 
                              <SelectValue placeholder="Pilih" />
                            </SelectTrigger>
                            <SelectContent>
                              {routeOptions.map((option) => (
                                <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="py-2 px-2">
                          <Input
                            placeholder="Contoh: 7 hari"
                            value={item.duration}
                            onChange={(e) => handleUpdateItemField(index, "duration", e.target.value)}
                            className={cn(plainFieldClass, itemErrors[index]?.length ? "border border-destructive bg-destructive/5" : "")}
                          />
                        </td>
                        <td className="py-2 px-2">
                          <Combobox
                            options={instructionOptions}
                            value={item.instructions}
                            onValueChange={(value) => handleUpdateItemField(index, "instructions", value)}
                            placeholder="Pilih instruksi"
                            searchPlaceholder="Cari instruksi..."
                            emptyText="Instruksi tidak ditemukan"
                            className={cn("w-full", itemErrors[index]?.length ? "border border-destructive bg-destructive/5" : "")}
                          />
                          {itemErrors[index]?.length ? (
                            <p className="text-[11px] text-destructive mt-1 line-clamp-2">{itemErrors[index][0]}</p>
                          ) : null}
                        </td>
                        <td className="py-2 px-2 text-right">
                          <p className="text-xs text-muted-foreground">@ {formatRupiah(item.unit_price)}</p>
                          <p className="text-sm font-semibold leading-4">{formatRupiah(item.quantity * item.unit_price)}</p>
                        </td>
                        <td className="py-2 px-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive"
                            onClick={() => handleRemoveItem(index)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 bg-primary/5">
                      <td colSpan={7} className="py-3 px-2 text-right">
                        <span className="text-sm font-medium text-muted-foreground">Grand Total</span>
                      </td>
                      <td className="py-3 px-2 text-right">
                        <span className="text-lg font-bold text-primary">{formatRupiah(orderGrandTotal)}</span>
                      </td>
                      <td className="py-3 px-2" />
                    </tr>
                  </tfoot>
                </table>
                </div>
              </>
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
          <div className="flex justify-stretch sm:justify-end pt-4">
            <Button
              size="lg"
              className="w-full sm:w-auto"
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
      </div>
    </div>
  );
}
