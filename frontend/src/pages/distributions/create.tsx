import { useState, useEffect, type ComponentType, type ReactNode } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { setPageTitle } from "@/lib/page-title";
import {
  stockRequestsApi,
  distributionsApi,
  type StockRequest,
  stockRequestStatusLabels,
  priorityLabels,
} from "@/lib/api/stock-requests";
import { medicinesApi, type MedicineBatch } from "@/lib/api/medicines";
import {
  Loader2,
  Truck,
  Package,
  CheckCheck,
  Info,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { PageShell, PageHeader, PageContent } from '@/components/layout/page-shell';

const stockRequestStatusColors: Record<string, string> = {
  approved: "bg-emerald-100 text-emerald-800",
  partial: "bg-amber-100 text-amber-800",
};

interface DistributionItem {
  id: string;
  stock_request_item_id?: number;
  inventory_id?: number;
  medicine_id?: number;
  name: string;
  code: string;
  unit: string;
  item_type: "medicine" | "inventory";
  quantity_approved: number;
  quantity_fulfilled: number;
  remaining: number;
  selected: boolean;
  quantity: number;
  batch_number: string;
  expiry_date: string;
  notes: string;
}

function SectionPanel({
  icon: Icon,
  title,
  description,
  actions,
  children,
  className,
  headerClassName,
  contentClassName,
}: {
  icon: ComponentType<{ className?: string }>;
  title: string;
  description: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  headerClassName?: string;
  contentClassName?: string;
}) {
  return (
    <section className={cn("space-y-4", className)}>
      <div className={cn("border-b border-neutral-200 dark:border-neutral-800 pb-2.5", headerClassName)}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <Icon className="h-4 w-4 text-neutral-500 mt-0.5 shrink-0" />
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-neutral-800 dark:text-neutral-200">{title}</div>
              <p className="mt-0.5 text-[11px] font-mono text-neutral-500">{description}</p>
            </div>
          </div>
          {actions}
        </div>
      </div>
      <div className={cn("space-y-4", contentClassName)}>{children}</div>
    </section>
  );
}

function hasRemainingDistribution(request: StockRequest) {
  return (request.items || []).some((item) => item.quantity_approved > item.quantity_fulfilled);
}

function getRemainingItemCount(request: StockRequest) {
  return (request.items || []).filter((item) => item.quantity_approved > item.quantity_fulfilled).length;
}

function getRemainingQuantity(request: StockRequest) {
  return (request.items || []).reduce((sum, item) => sum + Math.max(0, item.quantity_approved - item.quantity_fulfilled), 0);
}

function isEligibleDistributionRequest(request: StockRequest) {
  return ["approved", "partial"].includes(request.status) && hasRemainingDistribution(request);
}

export default function DistributionCreate() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const requestId = searchParams.get("request_id");

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [approvedRequests, setApprovedRequests] = useState<StockRequest[]>([]);
  const [selectedRequest, setSelectedRequest] = useState<StockRequest | null>(null);
  const [requestPickerOpen, setRequestPickerOpen] = useState(false);
  const [requestSearch, setRequestSearch] = useState("");

  const [formData, setFormData] = useState({
    stock_request_id: requestId ? parseInt(requestId) : 0,
    from_room_id: 0,
    to_room_id: 0,
    notes: "",
  });

  const [items, setItems] = useState<DistributionItem[]>([]);
  const [availableBatches, setAvailableBatches] = useState<Record<number, MedicineBatch[]>>({});
  const [loadingBatches, setLoadingBatches] = useState(false);

  useEffect(() => {
    setPageTitle("Buat Distribusi");
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const requestsRes = await stockRequestsApi.getAll({ limit: 100 });

      const requests = (requestsRes.data.data || []).filter((request: StockRequest) => isEligibleDistributionRequest(request));
      setApprovedRequests(requests);

      // If request_id is provided, load that request
      if (requestId) {
        const request = requests.find(
          (r: StockRequest) => r.id === parseInt(requestId)
        );
        if (request) {
          handleSelectRequest(request);
        }
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Gagal memuat data.",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSelectRequest = (request: StockRequest) => {
    setSelectedRequest(request);
    setRequestPickerOpen(false);
    setFormData({
      ...formData,
      stock_request_id: request.id,
      from_room_id: request.to_room_id, // From depo
      to_room_id: request.from_room_id, // To requesting room
    });

    // Map request items to distribution items
    const distributionItems: DistributionItem[] = (request.items || []).map(
      (item) => {
        const itemData = item.inventory || item.medicine;
        const remaining = item.quantity_approved - item.quantity_fulfilled;
        const itemType = item.medicine_id ? "medicine" : "inventory";

        return {
          id: `item_${item.id}`,
          stock_request_item_id: item.id,
          inventory_id: item.inventory_id,
          medicine_id: item.medicine_id,
          name: itemData?.name || "Unknown",
          code: itemData?.code || "",
          unit: item.unit || itemData?.unit || "",
          item_type: itemType as "medicine" | "inventory",
          quantity_approved: item.quantity_approved,
          quantity_fulfilled: item.quantity_fulfilled,
          remaining: remaining,
          selected: remaining > 0,
          quantity: remaining,
          batch_number: "",
          expiry_date: "",
          notes: "",
        };
      }
    );
    setItems(distributionItems);

    // Load available batches for medicines from the source room
    const medIds = (request.items || [])
      .map((i) => i.medicine_id)
      .filter((id): id is number => typeof id === "number" && id > 0);

    if (medIds.length > 0 && request.to_room_id) {
      setLoadingBatches(true);
      medicinesApi
        .getBatchesBulk({
          medicine_ids: medIds.join(","),
          room_id: request.to_room_id,
          active_only: true,
        })
        .then((res) => {
          const grouped = (res.data?.grouped || {}) as Record<number, MedicineBatch[]>;
          setAvailableBatches(grouped);

          // Auto-assign earliest batch (FEFO) to distribution items if available
          setItems((prevItems) =>
            prevItems.map((itm) => {
              if (itm.medicine_id && grouped[itm.medicine_id]?.length) {
                const earliest = grouped[itm.medicine_id][0];
                return {
                  ...itm,
                  batch_number: itm.batch_number || earliest.batch_number,
                  expiry_date: itm.expiry_date || earliest.expiry_date,
                };
              }
              return itm;
            })
          );
        })
        .catch((err) => {
          console.error("Gagal memuat batch obat:", err);
        })
        .finally(() => {
          setLoadingBatches(false);
        });
    } else {
      setAvailableBatches({});
    }
  };

  // Toggle all items with remaining quantity
  const handleSelectAll = () => {
    const allSelected = items
      .filter((item) => item.remaining > 0)
      .every((item) => item.selected);

    setItems(
      items.map((item) => ({
        ...item,
        selected: item.remaining > 0 ? !allSelected : false,
      }))
    );
  };

  // Fill all selected items with remaining quantity
  const handleFillAll = () => {
    setItems(
      items.map((item) => ({
        ...item,
        quantity: item.selected ? item.remaining : item.quantity,
      }))
    );
  };

  const handleItemChange = (itemId: string, field: string, value: any) => {
    setItems(
      items.map((item) => {
        if (item.id !== itemId) {
          return item;
        }

        if (field === "quantity") {
          return {
            ...item,
            quantity: Math.min(Math.max(0, Number(value) || 0), item.remaining),
          };
        }

        return { ...item, [field]: value };
      })
    );
  };

  const handleSubmit = async () => {
    if (!formData.from_room_id || !formData.to_room_id) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Pilih ruangan asal dan tujuan.",
      });
      return;
    }

    // Filter only selected items with quantity > 0
    const selectedItems = items.filter(
      (item) => item.selected && item.quantity > 0
    );

    if (selectedItems.length === 0) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Pilih minimal satu item untuk dikirim.",
      });
      return;
    }

    // Validate quantities
    for (const item of selectedItems) {
      if (item.quantity > item.remaining) {
        toast({
          variant: "destructive",
          title: "Error",
          description: `Jumlah untuk ${item.name} melebihi sisa yang disetujui.`,
        });
        return;
      }
    }

    setSubmitting(true);
    try {
      await distributionsApi.create({
        stock_request_id: formData.stock_request_id || undefined,
        from_room_id: formData.from_room_id,
        to_room_id: formData.to_room_id,
        notes: formData.notes,
        items: selectedItems.map((item) => ({
          stock_request_item_id: item.stock_request_item_id,
          inventory_id: item.inventory_id,
          medicine_id: item.medicine_id,
          batch_number: item.batch_number || undefined,
          expiry_date: item.expiry_date || undefined,
          quantity: item.quantity,
          unit: item.unit,
          notes: item.notes,
        })),
      });

      toast({
        variant: "success",
        title: "Berhasil",
        description: `${selectedItems.length} item berhasil didistribusikan.`,
      });
      navigate("/distributions");
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.response?.data?.error || "Gagal membuat distribusi.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Calculate stats
  const selectedCount = items.filter((item) => item.selected).length;
  const totalItems = items.length;
  const itemsWithRemaining = items.filter((item) => item.remaining > 0).length;

  const filteredRequests = approvedRequests.filter((request) => {
    const search = requestSearch.trim().toLowerCase();
    if (!search) {
      return true;
    }

    return [
      request.request_number,
      request.from_room?.name,
      request.from_room?.code,
      request.to_room?.name,
      request.to_room?.code,
      request.priority,
    ]
      .filter(Boolean)
      .some((value) => value!.toLowerCase().includes(search));
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <PageShell>
      <PageHeader
        title="Buat Distribusi"
        description="Pilih permintaan yang disetujui, tentukan item yang dikirim, lalu lengkapi batch obat dengan alur yang lebih jelas."
        icon={Truck}
        onBack={() => navigate('/distributions')}
        actions={
          selectedRequest ? (
            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" onClick={handleSubmit} disabled={submitting || selectedCount === 0}>
                {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                <Truck className="h-4 w-4" />
                Kirim {selectedCount} Item
              </Button>
            </div>
          ) : undefined
        }
      >
      </PageHeader>

      <PageContent>
        <div className="grid gap-6 items-start [&_label]:tracking-[0.01em] [&_input]:h-9 lg:grid-cols-[360px_minmax(0,1fr)] xl:grid-cols-[380px_minmax(0,1fr)]">
          <div>
            <div className="flex flex-col gap-6">
              <SectionPanel
                icon={Truck}
                title="Pemilihan Permintaan"
                description="Pilih permintaan approved atau partial."
              >
                <div className="space-y-3">
                  <Button type="button" variant="outline" className="h-10 w-full justify-between rounded-none px-3" onClick={() => setRequestPickerOpen(true)}>
                    <span className="truncate text-left text-sm text-foreground">
                      {selectedRequest ? `${selectedRequest.request_number} - ${selectedRequest.from_room?.name}` : "Pilih permintaan via modal"}
                    </span>
                    <span className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Buka</span>
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    Hanya request dengan status approved atau partial yang masih memiliki sisa approved untuk dikirim yang akan muncul.
                  </p>
                </div>
              </SectionPanel>

              {selectedRequest ? (
                <SectionPanel icon={Info} title="Informasi Permintaan" description="Arah distribusi, sisa item, dan catatan pengiriman untuk sesi ini.">
                  <div className="grid gap-2 border border-border/70 bg-muted/10 px-3 py-3 text-sm sm:grid-cols-2">
                    <div>
                      <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">No. Permintaan</div>
                      <div className="mt-1 font-semibold text-foreground">{selectedRequest.request_number}</div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Status</div>
                      <div className="mt-1 font-semibold text-foreground">{stockRequestStatusLabels[selectedRequest.status]}</div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Dari Depo</div>
                      <div className="mt-1 font-semibold text-foreground">{selectedRequest.to_room?.name || "-"}</div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Ke Pemohon</div>
                      <div className="mt-1 font-semibold text-foreground">{selectedRequest.from_room?.name || "-"}</div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Sisa Item</div>
                      <div className="mt-1 font-semibold text-foreground">{getRemainingItemCount(selectedRequest)} item</div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Sisa Qty</div>
                      <div className="mt-1 font-semibold text-foreground">{getRemainingQuantity(selectedRequest)}</div>
                    </div>
                  </div>

                  <div className="space-y-2 border-t border-border/70 pt-3">
                    <Label className="text-xs text-muted-foreground">Catatan Distribusi</Label>
                    <Input
                      placeholder="Catatan tambahan untuk sesi distribusi ini"
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      className="rounded-none"
                    />
                  </div>
                </SectionPanel>
              ) : (
                <SectionPanel icon={Truck} title="Belum Ada Permintaan" description="Pilih permintaan agar tabel distribusi di kanan terisi otomatis.">
                  <div className="border border-dashed border-border/70 px-4 py-8 text-center text-sm text-muted-foreground">
                    Belum ada permintaan yang dipilih.
                  </div>
                </SectionPanel>
              )}

              {selectedRequest && items.length > 0 ? (
                <SectionPanel
                  icon={CheckCheck}
                  title="Aksi Cepat & FEFO"
                  description="Pilih semua item yang masih tersisa atau isi kuantitas sisa otomatis."
                  actions={
                    <div className="flex items-center gap-2">
                      <Button type="button" variant="outline" size="sm" className="h-7 rounded-none px-2 text-[10px]" onClick={handleSelectAll}>
                        {selectedCount === itemsWithRemaining ? "Batal Pilih" : "Pilih Semua"}
                      </Button>
                      <Button type="button" variant="outline" size="sm" className="h-7 rounded-none px-2 text-[10px]" onClick={handleFillAll} disabled={selectedCount === 0}>
                        Isi Sisa
                      </Button>
                    </div>
                  }
                >
                  <Alert className="rounded-none border-border/70 bg-sky-50/50 px-3 py-2.5 text-sky-900 border-sky-200">
                    <Info className="h-4 w-4 text-sky-600" />
                    <AlertDescription className="text-xs text-sky-800">
                      Sistem menerapkan metode <strong>FEFO (First Expired, First Out)</strong> otomatis. Stok obat dengan tanggal kadaluarsa (ED) terdekat dari ruangan asal akan dipotong otomatis tanpa perlu input manual nomor batch dan expired date.
                    </AlertDescription>
                  </Alert>
                </SectionPanel>
              ) : null}
            </div>
          </div>

          <div className="flex flex-col lg:border-l lg:border-neutral-200 dark:lg:border-neutral-800 lg:pl-6">
            <SectionPanel
              icon={Package}
              title="Daftar Item Distribusi"
              description="Distribusi dapat diulang selama masih ada quantity approved yang belum fulfilled. Setiap baris menunjukkan sisa kirim aktual."
              actions={<span className="text-xs text-muted-foreground">{totalItems} item total</span>}
            >
              <div className="overflow-x-auto border border-neutral-200 dark:border-neutral-800 bg-background">
                {!selectedRequest ? (
                  <div className="flex min-h-[280px] items-center justify-center px-4 text-sm text-muted-foreground">
                    Pilih permintaan dari panel kiri untuk mulai menyiapkan distribusi.
                  </div>
                ) : items.length === 0 ? (
                  <div className="flex min-h-[280px] items-center justify-center px-4 text-sm text-muted-foreground">
                    Semua item pada permintaan ini sudah terpenuhi.
                  </div>
                ) : (
                  <ScrollArea className="max-h-[560px]">
                    <table className="w-full table-fixed border-collapse text-sm">
                      <thead className="sticky top-0 z-10 bg-background">
                        <tr className="bg-muted/20">
                          <th rowSpan={2} className="h-9 w-[5%] border-b border-r border-border/70 px-2 text-center text-[10px] font-semibold uppercase tracking-[0.18em] text-foreground/80">Pilih</th>
                          <th rowSpan={2} className="h-9 w-[24%] border-b border-r border-border/70 px-3 text-left text-[10px] font-semibold uppercase tracking-[0.18em] text-foreground/80">Item</th>
                          <th rowSpan={2} className="h-9 w-[6%] border-b border-r border-border/70 px-2 text-center text-[10px] font-semibold uppercase tracking-[0.18em] text-foreground/80">Sat</th>
                          <th colSpan={4} className="h-9 border-b border-r border-border/70 px-2 text-center text-[10px] font-semibold uppercase tracking-[0.18em] text-foreground/80">QTY</th>
                          <th rowSpan={2} className="h-9 w-[24%] border-b border-r border-border/70 px-3 text-left text-[10px] font-semibold uppercase tracking-[0.18em] text-foreground/80">Batch / Exp</th>
                          <th rowSpan={2} className="h-9 w-[10%] border-b border-border/70 px-3 text-left text-[10px] font-semibold uppercase tracking-[0.18em] text-foreground/80">Status</th>
                        </tr>
                        <tr className="bg-muted/10">
                          <th className="h-8 w-[7%] border-b border-r border-border/70 px-2 text-center text-[10px] font-medium text-foreground/80">Approved</th>
                          <th className="h-8 w-[7%] border-b border-r border-border/70 px-2 text-center text-[10px] font-medium text-foreground/80">Terkirim</th>
                          <th className="h-8 w-[7%] border-b border-r border-border/70 px-2 text-center text-[10px] font-medium text-foreground/80">Sisa</th>
                          <th className="h-8 w-[10%] border-b border-r border-border/70 px-2 text-center text-[10px] font-medium text-foreground/80">Qty Kirim</th>
                        </tr>
                      </thead>
                      <tbody>
                        {items.map((item) => {
                          const isComplete = item.remaining === 0;
                          const isMedicine = item.item_type === "medicine";
                          return (
                            <tr key={item.id} className={cn("hover:bg-muted/5", item.selected && !isComplete && "bg-primary/5", isComplete && "bg-muted/20")}>
                              <td className="border-b border-r border-border/60 px-2 py-1.5 align-middle">
                                <Checkbox
                                  checked={item.selected}
                                  onCheckedChange={(checked) => handleItemChange(item.id, "selected", checked)}
                                  disabled={isComplete}
                                />
                              </td>
                              <td className="border-b border-r border-border/60 px-3 py-1.5 align-middle">
                                <div className="text-xs font-semibold text-foreground">{item.name}</div>
                              </td>
                              <td className="border-b border-r border-border/60 px-2 py-1.5 align-middle text-center text-[11px] text-muted-foreground">{item.unit || "-"}</td>
                              <td className="border-b border-r border-border/60 px-2 py-1.5 align-middle text-center text-sm font-medium text-foreground">{item.quantity_approved}</td>
                              <td className="border-b border-r border-border/60 px-2 py-1.5 align-middle text-center text-sm font-medium text-foreground">{item.quantity_fulfilled}</td>
                              <td className="border-b border-r border-border/60 px-2 py-1.5 align-middle text-center">
                                <Badge variant="outline" className={isComplete ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-amber-200 bg-amber-50 text-amber-700"}>
                                  {item.remaining}
                                </Badge>
                              </td>
                              <td className="border-b border-r border-border/60 px-2 py-1.5 align-middle">
                                <div className="max-w-[96px]">
                                  <Input
                                    type="number"
                                    min={0}
                                    max={item.remaining}
                                    value={item.quantity}
                                    onChange={(e) => handleItemChange(item.id, "quantity", parseInt(e.target.value) || 0)}
                                    disabled={!item.selected || isComplete}
                                    className="h-8 rounded-none text-center text-xs"
                                  />
                                </div>
                                <p className="mt-1 text-[10px] text-muted-foreground">Maks. {item.remaining}</p>
                              </td>
                              <td className="border-b border-r border-border/60 px-3 py-1.5 align-middle">
                                {isMedicine ? (
                                  (() => {
                                    const batches = (item.medicine_id ? availableBatches[item.medicine_id] : []) || [];
                                    if (loadingBatches) {
                                      return (
                                        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                                          <Loader2 className="h-3 w-3 animate-spin" />
                                          <span>Memuat batch...</span>
                                        </div>
                                      );
                                    }
                                    if (batches.length === 0) {
                                      return (
                                        <div className="space-y-0.5">
                                          <span className="text-[11px] font-medium text-amber-700">Belum ada batch aktif</span>
                                          <p className="text-[10px] text-muted-foreground">Otomatis FEFO saat stok ada</p>
                                        </div>
                                      );
                                    }
                                    return (
                                      <div className="space-y-1 py-0.5">
                                        {batches.map((b, bIdx) => {
                                          const isSelected = item.batch_number ? item.batch_number === b.batch_number : bIdx === 0;
                                          return (
                                            <div
                                              key={b.id}
                                              className={cn(
                                                "rounded border px-2 py-1 text-xs transition-colors cursor-pointer",
                                                isSelected
                                                  ? "border-sky-300 bg-sky-50/70 shadow-2xs"
                                                  : "border-border/60 bg-muted/15 hover:bg-muted/30"
                                              )}
                                              onClick={() => {
                                                handleItemChange(item.id, "batch_number", b.batch_number);
                                                handleItemChange(item.id, "expiry_date", b.expiry_date);
                                              }}
                                              title="Klik untuk memilih batch ini"
                                            >
                                              <div className="flex items-center justify-between gap-1.5">
                                                <div className="flex items-center gap-1.5">
                                                  <span className="text-[10px] font-semibold text-sky-700">BN:</span>
                                                  <span className="font-semibold text-foreground">{b.batch_number}</span>
                                                </div>
                                                <span className="text-[10px] font-medium text-muted-foreground">({b.remaining_qty} {item.unit})</span>
                                              </div>
                                              <div className="flex items-center gap-1 text-[11px] text-muted-foreground pt-0.5">
                                                <span className="font-medium text-foreground/70">ED:</span>
                                                <span className="font-medium text-foreground">
                                                  {b.expiry_date ? b.expiry_date.split("T")[0] : "-"}
                                                </span>
                                                {bIdx === 0 && (
                                                  <span className="ml-auto text-[9px] font-semibold uppercase tracking-wider text-emerald-700 bg-emerald-50 border border-emerald-200 px-1 rounded">
                                                    FEFO
                                                  </span>
                                                )}
                                              </div>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    );
                                  })()
                                ) : (
                                  <span className="text-[11px] text-muted-foreground">-</span>
                                )}
                              </td>
                              <td className="border-b border-border/60 px-3 py-1.5 align-middle text-[11px] text-muted-foreground">
                                {isComplete ? (
                                  <span className="text-emerald-600">Terpenuhi</span>
                                ) : item.selected ? (
                                  <span className="text-primary">Siap dikirim</span>
                                ) : (
                                  <span className="text-muted-foreground">Belum dipilih</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </ScrollArea>
                )}
              </div>
            </SectionPanel>
          </div>
        </div>

        <Dialog open={requestPickerOpen} onOpenChange={setRequestPickerOpen}>
          <DialogContent className="max-h-[85vh] max-w-6xl overflow-hidden rounded-none border-border/80 p-0">
            <DialogHeader className="border-b border-border/70 px-5 py-4 pr-12">
              <DialogTitle>Pilih Permintaan Disetujui</DialogTitle>
              <DialogDescription>
                Cari request approved atau partial yang masih punya sisa distribusi. Tabel menampilkan detail singkat agar lebih cepat dipindai.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 px-5 py-4">
              <Input
                value={requestSearch}
                onChange={(e) => setRequestSearch(e.target.value)}
                placeholder="Cari nomor permintaan, ruangan, atau prioritas..."
                className="rounded-none"
              />

              <div className="max-h-[60vh] overflow-auto border border-border/70">
                <table className="w-full border-collapse text-sm">
                  <thead className="sticky top-0 z-10 bg-background">
                    <tr className="bg-muted/20">
                      <th className="h-9 border-b border-r border-border/70 px-3 text-left text-[10px] font-semibold uppercase tracking-[0.16em] text-foreground/80">Req</th>
                      <th className="h-9 w-[10%] border-b border-r border-border/70 px-3 text-left text-[10px] font-semibold uppercase tracking-[0.16em] text-foreground/80">Status</th>
                      <th className="h-9 w-[18%] border-b border-r border-border/70 px-3 text-left text-[10px] font-semibold uppercase tracking-[0.16em] text-foreground/80">Pemohon</th>
                      <th className="h-9 w-[18%] border-b border-r border-border/70 px-3 text-left text-[10px] font-semibold uppercase tracking-[0.16em] text-foreground/80">Depo</th>
                      <th className="h-9 w-[10%] border-b border-r border-border/70 px-3 text-left text-[10px] font-semibold uppercase tracking-[0.16em] text-foreground/80">Prioritas</th>
                      <th className="h-9 w-[10%] border-b border-r border-border/70 px-3 text-left text-[10px] font-semibold uppercase tracking-[0.16em] text-foreground/80">Sisa Item</th>
                      <th className="h-9 w-[10%] border-b border-r border-border/70 px-3 text-left text-[10px] font-semibold uppercase tracking-[0.16em] text-foreground/80">Sisa Qty</th>
                      <th className="h-9 w-[12%] border-b border-border/70 px-3 text-left text-[10px] font-semibold uppercase tracking-[0.16em] text-foreground/80">Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRequests.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="px-4 py-10 text-center text-sm text-muted-foreground">
                          Tidak ada permintaan yang cocok.
                        </td>
                      </tr>
                    ) : (
                      filteredRequests.map((request) => (
                        <tr key={request.id} className="hover:bg-muted/5">
                          <td className="border-b border-r border-border/60 px-3 py-1.5 align-middle">
                            <div className="space-y-0.5">
                              <div className="font-mono text-sm font-semibold text-foreground">{request.request_number}</div>
                              <div className="text-[11px] text-muted-foreground">{request.items?.length || 0} item total</div>
                            </div>
                          </td>
                          <td className="border-b border-r border-border/60 px-3 py-1.5 align-middle">
                            <Badge className={stockRequestStatusColors[request.status] || "bg-muted text-foreground"}>
                              {stockRequestStatusLabels[request.status]}
                            </Badge>
                          </td>
                          <td className="border-b border-r border-border/60 px-3 py-1.5 align-middle text-sm text-foreground">{request.from_room?.name || "-"}</td>
                          <td className="border-b border-r border-border/60 px-3 py-1.5 align-middle text-sm text-foreground">{request.to_room?.name || "-"}</td>
                          <td className="border-b border-r border-border/60 px-3 py-1.5 align-middle text-sm text-foreground">{priorityLabels[request.priority]}</td>
                          <td className="border-b border-r border-border/60 px-3 py-1.5 align-middle text-sm font-medium text-foreground">{getRemainingItemCount(request)}</td>
                          <td className="border-b border-r border-border/60 px-3 py-1.5 align-middle text-sm font-medium text-foreground">{getRemainingQuantity(request)}</td>
                          <td className="border-b border-border/60 px-3 py-1.5 align-middle">
                            <Button type="button" variant="outline" size="sm" className="rounded-none" onClick={() => handleSelectRequest(request)}>
                              Pilih
                            </Button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </PageContent>
    </PageShell>
  );
}
