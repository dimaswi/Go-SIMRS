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
import {
  Loader2,
  Truck,
  Package,
  CheckCheck,
  Info,
  ArrowLeft,
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
    <div className={cn("border border-border/70 bg-background/95 shadow-sm", className)}>
      <div className={cn("border-b border-border/70 bg-muted/20 px-4 py-3", headerClassName)}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="border border-border/70 bg-background p-2">
              <Icon className="h-4 w-4 text-muted-foreground" />
            </div>
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">{title}</div>
              <p className="mt-1 text-xs text-muted-foreground">{description}</p>
            </div>
          </div>
          {actions}
        </div>
      </div>
      <div className={cn("p-3 sm:p-4", contentClassName)}>{children}</div>
    </div>
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
  const [bulkBatchNumber, setBulkBatchNumber] = useState("");
  const [bulkExpiryDate, setBulkExpiryDate] = useState("");

  const [formData, setFormData] = useState({
    stock_request_id: requestId ? parseInt(requestId) : 0,
    from_room_id: 0,
    to_room_id: 0,
    notes: "",
  });

  const [items, setItems] = useState<DistributionItem[]>([]);

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

  // Apply batch number to all selected medicines
  const handleApplyBatchToSelected = (batchNumber: string) => {
    setItems(
      items.map((item) => ({
        ...item,
        batch_number:
          item.selected && item.item_type === "medicine"
            ? batchNumber
            : item.batch_number,
      }))
    );
  };

  // Apply expiry date to all selected medicines
  const handleApplyExpiryToSelected = (expiryDate: string) => {
    setItems(
      items.map((item) => ({
        ...item,
        expiry_date:
          item.selected && item.item_type === "medicine"
            ? expiryDate
            : item.expiry_date,
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
  const selectedMedicines = items.filter(
    (item) => item.selected && item.item_type === "medicine"
  ).length;

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
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => navigate('/distributions')}>
              <ArrowLeft className="h-4 w-4" />
              Kembali
            </Button>
            {selectedRequest && (
              <Button size="sm" onClick={handleSubmit} disabled={submitting || selectedCount === 0}>
                {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                <Truck className="h-4 w-4" />
                Kirim {selectedCount} Item
              </Button>
            )}
          </div>
        }
      >
      </PageHeader>

      <PageContent className="min-h-0 overflow-hidden pb-3">
        <div className="grid min-h-0 flex-1 gap-3 [&_label]:tracking-[0.01em] [&_input]:h-10 lg:grid-cols-[minmax(300px,360px)_minmax(0,1fr)] xl:grid-cols-[minmax(320px,380px)_minmax(0,1fr)]">
          <div className="min-h-0 overflow-hidden">
            <div className="flex h-full min-h-0 flex-col gap-3 overflow-y-auto pr-1">
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
                  title="Aksi Massal"
                  description="Pilih semua item yang masih tersisa, isi kuantitas sisa, lalu lengkapi batch obat secara massal bila perlu."
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
                  {selectedMedicines > 0 ? (
                    <div className="space-y-3">
                      <Alert className="rounded-none border-border/70 px-3 py-2.5">
                        <Info className="h-4 w-4" />
                        <AlertDescription>
                          {selectedMedicines} obat terpilih. Batch dan tanggal kadaluarsa dapat diterapkan sekaligus untuk mempercepat distribusi parsial berikutnya.
                        </AlertDescription>
                      </Alert>
                      <div className="grid gap-3">
                        <div className="space-y-2 border border-border/70 bg-muted/10 px-3 py-3">
                          <Label>Batch untuk Obat Terpilih</Label>
                          <div className="flex gap-2">
                            <Input value={bulkBatchNumber} onChange={(e) => setBulkBatchNumber(e.target.value)} placeholder="Masukkan batch number" className="rounded-none" />
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="rounded-none"
                              onClick={() => {
                                if (!bulkBatchNumber.trim()) {
                                  return;
                                }
                                handleApplyBatchToSelected(bulkBatchNumber.trim());
                                toast({ title: "Berhasil", description: `Batch number diterapkan ke ${selectedMedicines} obat.` });
                              }}
                            >
                              Terapkan
                            </Button>
                          </div>
                        </div>
                        <div className="space-y-2 border border-border/70 bg-muted/10 px-3 py-3">
                          <Label>Exp Date untuk Obat Terpilih</Label>
                          <div className="flex gap-2">
                            <Input type="date" value={bulkExpiryDate} onChange={(e) => setBulkExpiryDate(e.target.value)} className="rounded-none" />
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="rounded-none"
                              onClick={() => {
                                if (!bulkExpiryDate) {
                                  return;
                                }
                                handleApplyExpiryToSelected(bulkExpiryDate);
                                toast({ title: "Berhasil", description: `Tanggal kadaluarsa diterapkan ke ${selectedMedicines} obat.` });
                              }}
                            >
                              Terapkan
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="border border-dashed border-border/70 px-4 py-5 text-sm text-muted-foreground">
                      Belum ada obat terpilih yang membutuhkan batch dan exp date.
                    </div>
                  )}
                </SectionPanel>
              ) : null}
            </div>
          </div>

          <div className="flex min-h-0 flex-col overflow-hidden">
            <SectionPanel
              icon={Package}
              title="Daftar Item Distribusi"
              description="Distribusi dapat diulang selama masih ada quantity approved yang belum fulfilled. Setiap baris menunjukkan sisa kirim aktual."
              className="flex min-h-0 flex-1 flex-col overflow-hidden"
              headerClassName="px-2.5 py-2 sm:px-3"
              contentClassName="flex min-h-0 flex-1 flex-col overflow-hidden px-2.5 py-2.5 sm:px-3"
              actions={<span className="text-xs text-muted-foreground">{totalItems} item total</span>}
            >
              <div className="min-h-0 flex-1 overflow-hidden border border-border/80 bg-background">
                {!selectedRequest ? (
                  <div className="flex h-full items-center justify-center px-4 text-sm text-muted-foreground">
                    Pilih permintaan dari panel kiri untuk mulai menyiapkan distribusi.
                  </div>
                ) : items.length === 0 ? (
                  <div className="flex h-full items-center justify-center px-4 text-sm text-muted-foreground">
                    Semua item pada permintaan ini sudah terpenuhi.
                  </div>
                ) : (
                  <ScrollArea className="h-full">
                    <table className="w-full table-fixed border-collapse text-sm">
                      <thead className="sticky top-0 z-10 bg-background">
                        <tr className="bg-muted/20">
                          <th rowSpan={2} className="h-9 w-[7%] border-b border-r border-border/70 px-2 text-left text-[10px] font-semibold uppercase tracking-[0.18em] text-foreground/80">Pilih</th>
                          <th rowSpan={2} className="h-9 w-[26%] border-b border-r border-border/70 px-3 text-left text-[10px] font-semibold uppercase tracking-[0.18em] text-foreground/80">Item</th>
                          <th rowSpan={2} className="h-9 w-[10%] border-b border-r border-border/70 px-2 text-center text-[10px] font-semibold uppercase tracking-[0.18em] text-foreground/80">Sat</th>
                          <th colSpan={4} className="h-9 border-b border-r border-border/70 px-2 text-center text-[10px] font-semibold uppercase tracking-[0.18em] text-foreground/80">QTY</th>
                          <th rowSpan={2} className="h-9 w-[16%] border-b border-r border-border/70 px-3 text-left text-[10px] font-semibold uppercase tracking-[0.18em] text-foreground/80">Batch / Exp</th>
                          <th rowSpan={2} className="h-9 w-[10%] border-b border-border/70 px-3 text-left text-[10px] font-semibold uppercase tracking-[0.18em] text-foreground/80">Status</th>
                        </tr>
                        <tr className="bg-muted/10">
                          <th className="h-8 w-[10%] border-b border-r border-border/70 px-2 text-center text-[10px] font-medium text-foreground/80">Approved</th>
                          <th className="h-8 w-[10%] border-b border-r border-border/70 px-2 text-center text-[10px] font-medium text-foreground/80">Terkirim</th>
                          <th className="h-8 w-[10%] border-b border-r border-border/70 px-2 text-center text-[10px] font-medium text-foreground/80">Sisa</th>
                          <th className="h-8 w-[11%] border-b border-r border-border/70 px-2 text-center text-[10px] font-medium text-foreground/80">Qty Kirim</th>
                        </tr>
                      </thead>
                      <tbody>
                        {items.map((item) => {
                          const isComplete = item.remaining === 0;
                          const isMedicine = item.item_type === "medicine";
                          return (
                            <tr key={item.id} className={cn("hover:bg-muted/5", item.selected && !isComplete && "bg-primary/5", isComplete && "bg-muted/20") }>
                              <td className="border-b border-r border-border/60 px-2 py-1.5 align-middle">
                                <Checkbox
                                  checked={item.selected}
                                  onCheckedChange={(checked) => handleItemChange(item.id, "selected", checked)}
                                  disabled={isComplete}
                                />
                              </td>
                              <td className="border-b border-r border-border/60 px-3 py-1.5 align-middle">
                                <div className="space-y-0.5">
                                  <div className="text-xs font-semibold text-foreground">{item.name}</div>
                                  <div className="font-mono text-[11px] text-muted-foreground">{item.code || "-"}</div>
                                  <div className="text-[11px] text-muted-foreground">{isMedicine ? "Obat" : "Inventaris"}</div>
                                </div>
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
                                  <div className="grid gap-1.5">
                                    <Input
                                      placeholder="Batch"
                                      value={item.batch_number}
                                      onChange={(e) => handleItemChange(item.id, "batch_number", e.target.value)}
                                      disabled={!item.selected || isComplete}
                                      className="h-8 rounded-none text-xs"
                                    />
                                    <Input
                                      type="date"
                                      value={item.expiry_date}
                                      onChange={(e) => handleItemChange(item.id, "expiry_date", e.target.value)}
                                      disabled={!item.selected || isComplete}
                                      className="h-8 rounded-none text-xs"
                                    />
                                  </div>
                                ) : (
                                  <span className="text-[11px] text-muted-foreground">Tidak wajib</span>
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
