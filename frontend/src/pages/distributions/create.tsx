import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { setPageTitle } from "@/lib/page-title";
import {
  stockRequestsApi,
  distributionsApi,
  type StockRequest,
} from "@/lib/api/stock-requests";
import {
  Loader2,
  Truck,
  Package,
  Pill,
  CheckCheck,
  Info,
  AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";

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

export default function DistributionCreate() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const requestId = searchParams.get("request_id");

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [approvedRequests, setApprovedRequests] = useState<StockRequest[]>([]);
  const [selectedRequest, setSelectedRequest] = useState<StockRequest | null>(null);

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
      const requestsRes = await stockRequestsApi.getAll({ status: "approved", limit: 100 });

      const requests = requestsRes.data.data || [];
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
      items.map((item) =>
        item.id === itemId ? { ...item, [field]: value } : item
      )
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
  const completedItems = items.filter((item) => item.remaining === 0).length;
  const selectedMedicines = items.filter(
    (item) => item.selected && item.item_type === "medicine"
  ).length;

  const requestOptions: ComboboxOption[] = approvedRequests.map((r) => ({
    value: r.id.toString(),
    label: `${r.request_number} - ${r.from_room?.name} (${r.items?.filter((i) => i.quantity_approved > i.quantity_fulfilled).length || 0
      } item)`,
  }));

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col px-4">


      <div className="flex-1 space-y-6 [&_label]:tracking-[0.01em] [&_input]:h-11 [&_[role=combobox]]:h-11">
        <div className="border border-border/70">
          <div className="border-b border-border/70 bg-muted/30 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground flex justify-between items-center">
            <span>Pemilihan Permintaan</span>
            {selectedRequest && (
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="h-5 text-[10px]">
                  {completedItems} / {totalItems} Selesai
                </Badge>
                {selectedCount > 0 && (
                  <Badge className="bg-primary h-5 text-[10px]">{selectedCount} dipilih</Badge>
                )}
              </div>
            )}
          </div>
          <div className="p-3 sm:p-4 space-y-4">
            {/* Select Request */}
            <div className="space-y-2">
              <Label>Pilih Permintaan yang Disetujui *</Label>
              <Combobox
                options={requestOptions}
                value={formData.stock_request_id?.toString() || ""}
                onValueChange={(value) => {
                  const request = approvedRequests.find(
                    (r) => r.id === parseInt(value)
                  );
                  if (request) {
                    handleSelectRequest(request);
                  }
                }}
                placeholder="Pilih permintaan..."
              />
            </div>
          </div>
        </div>

        {selectedRequest && (
          <>
            {/* Request Info */}
            <div className="border border-border/70">
              <div className="border-b border-border/70 bg-muted/30 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Informasi Permintaan
              </div>
              <div className="p-3 sm:p-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">No. Permintaan</p>
                    <p className="font-medium">{selectedRequest.request_number}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Dari (Depo)</p>
                    <p className="font-medium">{selectedRequest.to_room?.name}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Ke (Pemohon)</p>
                    <p className="font-medium">{selectedRequest.from_room?.name}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Prioritas</p>
                    <Badge variant="outline">{selectedRequest.priority}</Badge>
                  </div>
                </div>
                <div className="border-t border-border/70 mt-4 pt-4">
                  <Label className="text-xs text-muted-foreground mb-2 block">Catatan Distribusi</Label>
                  <Input
                    placeholder="Catatan tambahan (opsional)..."
                    value={formData.notes}
                    onChange={(e) =>
                      setFormData({ ...formData, notes: e.target.value })
                    }
                  />
                </div>
              </div>
            </div>
          </>
        )}

        {/* Bulk Actions Card */}
        {selectedRequest && items.length > 0 && (
          <div className="border border-border/70">
            <div className="border-b border-border/70 bg-muted/30 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground flex items-center justify-between">
              <span>Aksi Massal</span>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleSelectAll}
                  className="h-6 px-2 text-[10px]"
                >
                  <CheckCheck className="h-3 w-3 mr-1" />
                  {selectedCount === itemsWithRemaining
                    ? "Batal Pilih Semua"
                    : "Pilih Semua"}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleFillAll}
                  disabled={selectedCount === 0}
                  className="h-6 px-2 text-[10px]"
                >
                  <Truck className="h-3 w-3 mr-1" />
                  Isi Sisa ke Terpilih
                </Button>
              </div>
            </div>
            {selectedMedicines > 0 && (
              <div className="p-3 sm:p-4">
                <Alert className="mb-4">
                  <Info className="h-4 w-4" />
                  <AlertDescription>
                    <strong>{selectedMedicines} obat</strong> terpilih. Anda dapat
                    mengisi batch number dan tanggal kadaluarsa secara massal.
                  </AlertDescription>
                </Alert>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label className="text-sm">
                      Batch Number untuk Semua Obat Terpilih
                    </Label>
                    <div className="flex gap-2">
                      <Input placeholder="Masukkan batch number..." id="bulk-batch" />
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                          const input = document.getElementById(
                            "bulk-batch"
                          ) as HTMLInputElement;
                          if (input?.value) {
                            handleApplyBatchToSelected(input.value);
                            toast({
                              title: "Berhasil",
                              description: `Batch number diterapkan ke ${selectedMedicines} obat.`,
                            });
                          }
                        }}
                      >
                        Terapkan
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm">
                      Tanggal Kadaluarsa untuk Semua Obat Terpilih
                    </Label>
                    <div className="flex gap-2">
                      <Input type="date" id="bulk-expiry" />
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                          const input = document.getElementById(
                            "bulk-expiry"
                          ) as HTMLInputElement;
                          if (input?.value) {
                            handleApplyExpiryToSelected(input.value);
                            toast({
                              title: "Berhasil",
                              description: `Tanggal kadaluarsa diterapkan ke ${selectedMedicines} obat.`,
                            });
                          }
                        }}
                      >
                        Terapkan
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Items Card */}
        {selectedRequest && (
          <div className="border border-border/70">
            <div className="border-b border-border/70 bg-muted/30 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground flex items-center justify-between">
              <span>Daftar Item</span>
              <span className="normal-case tracking-normal font-normal opacity-70">({totalItems} item total)</span>
            </div>

            <div className="p-0">
              <ScrollArea className="h-[500px]">
                {items.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                    <Package className="h-12 w-12 mb-3 opacity-50" />
                    <p className="text-sm font-medium">Tidak ada item</p>
                    <p className="text-xs mt-1">
                      Semua item sudah terpenuhi atau tidak ada item yang tersedia
                    </p>
                  </div>
                ) : (
                  <div className="divide-y">
                    {items.map((item) => {
                      const isComplete = item.remaining === 0;
                      const isSelected = item.selected;
                      const isMedicine = item.item_type === "medicine";

                      return (
                        <div
                          key={item.id}
                          className={cn(
                            "p-4 transition-colors",
                            isComplete && "bg-muted/30",
                            isSelected && !isComplete && "bg-primary/5"
                          )}
                        >
                          <div className="flex items-start gap-4">
                            {/* Checkbox */}
                            <div className="pt-1">
                              <Checkbox
                                checked={item.selected}
                                onCheckedChange={(checked) =>
                                  handleItemChange(item.id, "selected", checked)
                                }
                                disabled={isComplete}
                              />
                            </div>

                            {/* Icon */}
                            <div
                              className={cn(
                                "flex h-10 w-10 items-center justify-center rounded-full shrink-0",
                                isComplete
                                  ? "bg-green-100"
                                  : isMedicine
                                    ? "bg-blue-100"
                                    : "bg-purple-100"
                              )}
                            >
                              {isComplete ? (
                                <Truck className="h-5 w-5 text-green-600" />
                              ) : isMedicine ? (
                                <Pill className="h-5 w-5 text-blue-600" />
                              ) : (
                                <Package className="h-5 w-5 text-purple-600" />
                              )}
                            </div>

                            {/* Item Info */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="font-medium">{item.name}</p>
                                <Badge
                                  variant="outline"
                                  className={cn(
                                    "text-[10px]",
                                    isMedicine
                                      ? "bg-blue-50 text-blue-700"
                                      : "bg-purple-50 text-purple-700"
                                  )}
                                >
                                  {isMedicine ? "Obat" : "Inventaris"}
                                </Badge>
                                {isComplete && (
                                  <Badge className="bg-green-100 text-green-800 text-[10px]">
                                    Terpenuhi
                                  </Badge>
                                )}
                              </div>
                              {item.code && (
                                <p className="text-xs text-muted-foreground">
                                  {item.code}
                                </p>
                              )}

                              {/* Quantity Info */}
                              <div className="flex items-center gap-4 mt-2 text-sm">
                                <span>
                                  Disetujui:{" "}
                                  <strong>
                                    {item.quantity_approved} {item.unit}
                                  </strong>
                                </span>
                                <span>
                                  Terkirim:{" "}
                                  <strong>{item.quantity_fulfilled}</strong>
                                </span>
                                {!isComplete && (
                                  <span className="text-orange-600">
                                    Sisa: <strong>{item.remaining}</strong>
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Input Fields */}
                            {!isComplete && isSelected && (
                              <div className="flex flex-col gap-2 w-[280px]">
                                <div className="flex items-center gap-2">
                                  <Label className="text-xs w-16 shrink-0">
                                    Jumlah
                                  </Label>
                                  <Input
                                    type="number"
                                    min={1}
                                    max={item.remaining}
                                    value={item.quantity}
                                    onChange={(e) =>
                                      handleItemChange(
                                        item.id,
                                        "quantity",
                                        parseInt(e.target.value) || 0
                                      )
                                    }
                                    className="h-8"
                                  />
                                </div>

                                {isMedicine && (
                                  <>
                                    <div className="flex items-center gap-2">
                                      <Label className="text-xs w-16 shrink-0">
                                        Batch
                                      </Label>
                                      <Input
                                        placeholder="Batch no."
                                        value={item.batch_number}
                                        onChange={(e) =>
                                          handleItemChange(
                                            item.id,
                                            "batch_number",
                                            e.target.value
                                          )
                                        }
                                        className="h-8"
                                      />
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <Label className="text-xs w-16 shrink-0">
                                        Exp.
                                      </Label>
                                      <Input
                                        type="date"
                                        value={item.expiry_date}
                                        onChange={(e) =>
                                          handleItemChange(
                                            item.id,
                                            "expiry_date",
                                            e.target.value
                                          )
                                        }
                                        className="h-8"
                                      />
                                    </div>
                                  </>
                                )}
                              </div>
                            )}

                            {!isComplete && !isSelected && (
                              <div className="w-[280px] flex items-center justify-center text-muted-foreground text-sm">
                                <AlertTriangle className="h-4 w-4 mr-2" />
                                Centang untuk mengirim
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </ScrollArea>
            </div>
          </div>
        )}

        {/* No Request Selected */}
        {!selectedRequest && (
          <div className="border border-border/70">
            <div className="py-12">
              <div className="flex flex-col items-center justify-center text-muted-foreground">
                <Truck className="h-12 w-12 mb-3 opacity-50" />
                <p className="text-sm font-medium">Belum ada permintaan dipilih</p>
                <p className="text-xs mt-1">
                  Pilih permintaan yang sudah disetujui untuk membuat distribusi
                </p>
              </div>
            </div>
          </div>
        )}
      </div>



      {/* Sticky Footer Actions */}
      {selectedRequest && (
        <div className="shrink-0 sticky bottom-0 z-10 py-3 mt-4 flex items-center justify-between border-t bg-background">
          <p className="text-sm text-muted-foreground">
            {selectedCount} item akan dikirim
          </p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => navigate("/distributions")}>
              Batal
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={submitting || selectedCount === 0}
            >
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <Truck className="mr-2 h-4 w-4" />
              {submitting ? "Mengirim..." : `Kirim ${selectedCount} Item`}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
