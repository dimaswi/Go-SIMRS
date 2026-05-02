import { useState, useEffect } from "react";
import { usePermission } from "@/hooks/usePermission";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2,
  RotateCcw,
  Package,
  AlertCircle,
  History,
} from "lucide-react";
import { medicineOrdersApi } from "@/lib/api";
import type { MedicineOrder, MedicineOrderItem, MedicineReturn } from "@/lib/api";

interface PharmacyReturnProps {
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

export function PharmacyReturn({ visitId, readOnly = false }: PharmacyReturnProps) {
  const { toast } = useToast();
  const { hasPermission } = usePermission();
  const canReturn = hasPermission("pharmacy.return");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [orders, setOrders] = useState<MedicineOrder[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<MedicineOrder | null>(null);
  const [returns, setReturns] = useState<MedicineReturn[]>([]);
  const [showAllReturns, setShowAllReturns] = useState(false);
  const [showAllDeliveredItems, setShowAllDeliveredItems] = useState(false);

  // Return dialog
  const [showReturnDialog, setShowReturnDialog] = useState(false);
  const [returnItem, setReturnItem] = useState<MedicineOrderItem | null>(null);
  const [returnForm, setReturnForm] = useState({
    quantity: 1,
    return_reason: "",
    condition: "baik",
    is_restocked: true,
    notes: "",
  });

  useEffect(() => {
    loadOrders();
  }, [visitId]);

  useEffect(() => {
    const handleRefreshOrders = () => {
      loadOrders({
        silent: true,
        preferredOrderId: selectedOrder?.id,
      });
    };

    window.addEventListener("refresh-final-visit", handleRefreshOrders);
    window.addEventListener("refresh-print-options", handleRefreshOrders);

    return () => {
      window.removeEventListener("refresh-final-visit", handleRefreshOrders);
      window.removeEventListener("refresh-print-options", handleRefreshOrders);
    };
  }, [visitId, selectedOrder?.id]);

  useEffect(() => {
    if (selectedOrder) {
      loadReturns(selectedOrder.id);
    }
  }, [selectedOrder]);

  const loadOrders = async (options?: { silent?: boolean; preferredOrderId?: number }) => {
    if (!options?.silent) {
      setLoading(true);
    }

    try {
      const res = await medicineOrdersApi.getAll({ pharmacy_visit_id: visitId });
      const data = res.data || [];
      setOrders(data);
      // Select first order that has delivered items
      const preferredOrder = data.find((order) => order.id === options?.preferredOrderId);
      const eligibleOrder = preferredOrder || data.find((o: MedicineOrder) =>
        o.items?.some((i: MedicineOrderItem) => (i.dispensed_qty || 0) > 0)
      ) || data[0];
      if (eligibleOrder) {
        setSelectedOrder(eligibleOrder);
      } else {
        setSelectedOrder(null);
      }
    } catch (error) {
      console.error("Error loading orders:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Gagal memuat data order",
      });
    } finally {
      if (!options?.silent) {
        setLoading(false);
      }
    }
  };

  const loadReturns = async (orderId: number) => {
    try {
      const res = await medicineOrdersApi.getReturns(orderId);
      setReturns(res.data || []);
    } catch {
      setReturns([]);
    }
  };

  const handleOpenReturnDialog = (item: MedicineOrderItem) => {
    const maxReturn = (item.dispensed_qty || 0) - (item.returned_qty || 0);
    if (maxReturn <= 0) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Tidak ada obat yang bisa dikembalikan",
      });
      return;
    }
    setReturnItem(item);
    setReturnForm({
      quantity: 1,
      return_reason: "",
      condition: "baik",
      is_restocked: true,
      notes: "",
    });
    setShowReturnDialog(true);
  };

  const handleSubmitReturn = async () => {
    if (!returnItem || !selectedOrder) return;

    if (!returnForm.return_reason) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Alasan pengembalian harus diisi",
      });
      return;
    }

    setSubmitting(true);
    try {
      await medicineOrdersApi.createReturn(selectedOrder.id, {
        item_id: returnItem.id,
        medicine_id: returnItem.medicine_id,
        quantity: returnForm.quantity,
        return_reason: returnForm.return_reason,
        condition: returnForm.condition,
        is_restocked: returnForm.is_restocked,
        notes: returnForm.notes,
      });
      toast({
        title: "Berhasil",
        description: "Pengembalian obat berhasil dicatat",
      });
      setShowReturnDialog(false);
      loadOrders();
      // Trigger refresh print options dan final visit
      window.dispatchEvent(new CustomEvent("refresh-print-options"));
      window.dispatchEvent(new CustomEvent("refresh-final-visit"));
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.response?.data?.error || "Gagal mencatat pengembalian",
      });
    } finally {
      setSubmitting(false);
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
            <RotateCcw className="h-12 w-12 mb-4 opacity-50" />
            <p>Tidak ada order obat untuk visit ini</p>
          </div>
        </div>
      </div>
    );
  }

  const patient = selectedOrder?.source_visit?.registration?.patient || selectedOrder?.registration?.patient;
  const deliveredItems = selectedOrder?.items?.filter(
    (item) => (item.dispensed_qty || 0) > 0
  ) || [];
  const displayedReturns = showAllReturns ? returns : returns.slice(0, 5);
  const displayedDeliveredItems = showAllDeliveredItems ? deliveredItems : deliveredItems.slice(0, 8);

  return (
    <div className="pharmacy-no-sticky-head">
      <div className="space-y-4">
        {/* Order Selection if multiple */}
        {orders.length > 1 && (
          <div className="border border-border/70 bg-background mb-4">
            <div className="p-3">
              <div className="grid grid-cols-1 gap-2 md:grid-cols-[120px_minmax(0,1fr)_auto] md:items-center">
                <Label className="text-sm font-semibold">Pilih Order</Label>
                <Select
                  value={selectedOrder?.id ? String(selectedOrder.id) : ""}
                  onValueChange={(value) => {
                    const nextOrder = orders.find((order) => String(order.id) === value);
                    if (nextOrder) setSelectedOrder(nextOrder);
                  }}
                >
                  <SelectTrigger className="h-8">
                    <SelectValue placeholder="Pilih order" />
                  </SelectTrigger>
                  <SelectContent>
                    {orders.map((order) => (
                      <SelectItem key={order.id} value={String(order.id)}>
                        {order.order_number} - {ORDER_STATUS_LABELS[order.status]?.label || order.status}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedOrder && (
                  <Badge variant={ORDER_STATUS_LABELS[selectedOrder.status]?.variant || "secondary"} className="w-fit">
                    {ORDER_STATUS_LABELS[selectedOrder.status]?.label || selectedOrder.status}
                  </Badge>
                )}
              </div>
            </div>
          </div>
        )}

        {selectedOrder && (
          <>
            {/* Patient & Order Info Table */}
            <div className="border border-border/70 bg-background mb-4">
              <div className="flex flex-wrap items-center justify-between border-b border-border/70 bg-muted/30 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                <span>Detail Order Farmasi</span>
                <Badge variant={ORDER_STATUS_LABELS[selectedOrder.status]?.variant || "secondary"} className="text-[10px] h-5 px-1.5 py-0">
                  {ORDER_STATUS_LABELS[selectedOrder.status]?.label || selectedOrder.status}
                </Badge>
              </div>
              <div className="p-3 sm:p-4 space-y-4">
                <table className="w-full table-fixed text-xs">
                  <tbody>
                    <tr className="border-b">
                      <td className="py-1.5 text-muted-foreground w-28 align-top">Nama Pasien</td>
                      <td className="py-1.5 font-medium break-words">{patient?.nama_lengkap || "-"}</td>
                    </tr>
                    <tr className="border-b">
                      <td className="py-1.5 text-muted-foreground w-28 align-top">No. RM</td>
                      <td className="py-1.5 font-medium break-words">{patient?.no_rm || "-"}</td>
                    </tr>
                    <tr className="border-b">
                      <td className="py-1.5 text-muted-foreground w-28 align-top">Dokter</td>
                      <td className="py-1.5 font-medium break-words">
                        <span className="font-medium">{selectedOrder.prescriber?.nama_lengkap || "-"}</span>
                      </td>
                    </tr>
                    <tr className="border-b">
                      <td className="py-1.5 text-muted-foreground w-28 align-top">Diagnosis</td>
                      <td className="py-1.5 font-medium break-words">{selectedOrder.diagnosis || "-"}</td>
                    </tr>
                    <tr className="border-b">
                      <td className="py-1.5 text-muted-foreground align-top">Ruang Asal</td>
                      <td className="py-1.5 font-medium break-words">{selectedOrder.source_room?.name || "-"}</td>
                    </tr>
                    <tr className="border-b">
                      <td className="py-1.5 text-muted-foreground align-top">Waktu Order</td>
                      <td className="py-1.5 font-medium break-words">
                        {selectedOrder.created_at ? new Date(selectedOrder.created_at).toLocaleString("id-ID") : "-"}
                      </td>
                    </tr>
                    <tr>
                      <td className="py-1.5 text-muted-foreground align-top">Prioritas</td>
                      <td className="py-1.5">
                        <Badge variant={selectedOrder.priority === "urgent" ? "destructive" : "outline"}>
                          {selectedOrder.priority === "urgent" ? "Urgent" : "Normal"}
                        </Badge>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Return History */}
            {returns.length > 0 && (
              <div className="border border-border/70 bg-background mb-4">
                <div className="flex flex-wrap items-center justify-between border-b border-border/70 bg-muted/30 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  <span className="flex items-center gap-2">
                    <History className="h-3 w-3" />
                    Riwayat Pengembalian
                  </span>
                  {returns.length > 5 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-[10px] py-0"
                      onClick={() => setShowAllReturns((prev) => !prev)}
                    >
                      {showAllReturns ? "Ringkas" : `Lihat Semua (${returns.length})`}
                    </Button>
                  )}
                </div>
                <div className="p-0">
                  <table className="w-full table-fixed text-xs">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="py-1.5 px-2 text-left font-medium w-[34%]">Obat</th>
                        <th className="py-1.5 px-2 text-left font-medium w-[10%]">Qty</th>
                        <th className="py-1.5 px-2 text-left font-medium hidden sm:table-cell w-[12%]">Kondisi</th>
                        <th className="py-1.5 px-2 text-left font-medium w-[24%]">Alasan</th>
                        <th className="py-1.5 px-2 text-left font-medium hidden md:table-cell w-[10%]">Restock</th>
                        <th className="py-1.5 px-2 text-left font-medium hidden lg:table-cell w-[20%]">Waktu</th>
                      </tr>
                    </thead>
                    <tbody>
                      {displayedReturns.map((ret) => (
                        <tr key={ret.id} className="border-b last:border-0 align-top">
                          <td className="py-1.5 px-2">
                            <p className="font-medium break-words">{ret.medicine?.name || "Obat"}</p>
                          </td>
                          <td className="py-1.5 px-2 font-medium">{ret.quantity}</td>
                          <td className="py-1.5 px-2 hidden sm:table-cell break-words">{ret.condition}</td>
                          <td className="py-1.5 px-2 text-[11px] break-words">{ret.return_reason}</td>
                          <td className="py-1.5 px-2 hidden md:table-cell">
                            <Badge variant={ret.is_restocked ? "default" : "outline"}>
                              {ret.is_restocked ? "Ya" : "Tidak"}
                            </Badge>
                          </td>
                          <td className="py-1.5 px-2 text-[11px] hidden lg:table-cell">
                            {ret.created_at && new Date(ret.created_at).toLocaleString("id-ID")}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Delivered Items for Return */}
            <div className="border border-border/70 bg-background mb-4">
              <div className="flex flex-wrap items-center justify-between border-b border-border/70 bg-muted/30 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                <span className="flex items-center gap-2">
                  <Package className="h-3 w-3" />
                  Obat yang Sudah Diserahkan
                </span>
                {deliveredItems.length > 8 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-[10px] py-0"
                    onClick={() => setShowAllDeliveredItems((prev) => !prev)}
                  >
                    {showAllDeliveredItems ? "Ringkas" : `Lihat Semua (${deliveredItems.length})`}
                  </Button>
                )}
              </div>
              <div className="p-0">
                {deliveredItems.length === 0 ? (
                  <div className="text-center py-6 text-muted-foreground">
                    <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>Belum ada obat yang diserahkan</p>
                  </div>
                ) : (
                  <table className="w-full table-fixed text-xs">
                    <thead className="bg-muted/50 border-b border-border/70">
                        <tr>
                          <th className="py-1.5 px-2 text-left font-medium w-[36%]">Obat</th>
                          <th className="py-1.5 px-2 text-left font-medium w-[26%]">Qty</th>
                          <th className="py-1.5 px-2 text-right font-medium hidden sm:table-cell w-[12%]">Harga</th>
                          <th className="py-1.5 px-2 text-right font-medium w-[14%]">Subtotal Return</th>
                          <th className="py-1.5 px-2 text-right font-medium w-[12%]">Aksi</th>
                        </tr>
                      </thead>
                      <tbody>
                        {displayedDeliveredItems.map((item) => {
                          const returnableQty = (item.dispensed_qty || 0) - (item.returned_qty || 0);
                          const unitPrice = getUnitPrice(item);
                          const returnableSubtotal = unitPrice * Number(returnableQty || 0);

                          return (
                            <tr key={item.id} className="border-b last:border-0 align-top">
                              <td className="py-1.5 px-2">
                                <p className="font-medium break-words">{item.medicine?.name || "Obat"}</p>
                                <p className="text-[11px] text-muted-foreground break-words">{item.medicine?.generic_name || "-"}</p>
                              </td>
                              <td className="py-1.5 px-2">
                                <p className="text-[11px]">Dipesan: <span className="font-medium">{item.quantity}</span></p>
                                <p className="text-[11px]">Diserahkan: <span className="font-medium">{item.dispensed_qty || 0}</span></p>
                                <p className="text-[11px]">Dikembalikan: <span className="font-medium">{item.returned_qty || 0}</span></p>
                                <p className="text-[11px] text-muted-foreground">Sisa return: {returnableQty}</p>
                              </td>
                              <td className="py-1.5 px-2 text-right font-medium whitespace-nowrap hidden sm:table-cell">{formatRupiah(unitPrice)}</td>
                              <td className="py-1.5 px-2 text-right font-medium whitespace-nowrap">{formatRupiah(returnableSubtotal)}</td>
                              <td className="py-1.5 px-2 text-right">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-7 px-2 text-xs"
                                  onClick={() => handleOpenReturnDialog(item)}
                                  disabled={returnableQty <= 0 || !canReturn || readOnly}
                                >
                                  <RotateCcw className="h-4 w-4 mr-1" />
                                  Return
                                </Button>
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </>
        )}      </div>

      {/* Return Dialog */}
      <Dialog open={showReturnDialog} onOpenChange={setShowReturnDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RotateCcw className="h-5 w-5" />
              Pengembalian Obat
            </DialogTitle>
            <DialogDescription>
              {returnItem?.medicine?.name || "Obat"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Jumlah Dikembalikan</Label>
              <Input
                type="number"
                min={1}
                max={(returnItem?.dispensed_qty || 0) - (returnItem?.returned_qty || 0)}
                value={returnForm.quantity}
                onChange={(e) =>
                  setReturnForm({ ...returnForm, quantity: parseInt(e.target.value) || 1 })
                }
              />
              <p className="text-xs text-muted-foreground">
                Maksimal: {(returnItem?.dispensed_qty || 0) - (returnItem?.returned_qty || 0)} {returnItem?.unit}
              </p>
            </div>

            <div className="space-y-2">
              <Label>Alasan Pengembalian <span className="text-red-500">*</span></Label>
              <Select
                value={returnForm.return_reason}
                onValueChange={(value) => setReturnForm({ ...returnForm, return_reason: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Pilih alasan" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pasien_meninggal">Pasien Meninggal</SelectItem>
                  <SelectItem value="alergi">Alergi</SelectItem>
                  <SelectItem value="efek_samping">Efek Samping</SelectItem>
                  <SelectItem value="tidak_mau_minum">Pasien Tidak Mau Minum</SelectItem>
                  <SelectItem value="penggantian_obat">Penggantian Obat</SelectItem>
                  <SelectItem value="kelebihan_dosis">Kelebihan Dosis</SelectItem>
                  <SelectItem value="lainnya">Lainnya</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Kondisi Obat</Label>
              <Select
                value={returnForm.condition}
                onValueChange={(value) => setReturnForm({ ...returnForm, condition: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="baik">Baik</SelectItem>
                  <SelectItem value="rusak">Rusak</SelectItem>
                  <SelectItem value="kadaluarsa">Kadaluarsa</SelectItem>
                  <SelectItem value="terkontaminasi">Terkontaminasi</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center space-x-2">
                <Switch
                  id="is_restocked"
                  checked={returnForm.is_restocked}
                  onCheckedChange={(checked) =>
                    setReturnForm({ ...returnForm, is_restocked: checked })
                  }
                  disabled={returnForm.condition !== "baik"}
                />
                <Label htmlFor="is_restocked" className="text-sm">
                  Kembalikan ke Stok
                </Label>
              </div>
              {returnForm.condition !== "baik" && (
                <p className="text-xs text-muted-foreground">
                  Obat tidak dalam kondisi baik tidak bisa di-restock
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Catatan</Label>
              <Textarea
                placeholder="Catatan tambahan..."
                value={returnForm.notes}
                onChange={(e) => setReturnForm({ ...returnForm, notes: e.target.value })}
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowReturnDialog(false)}>
              Batal
            </Button>
            <Button onClick={handleSubmitReturn} disabled={submitting || !canReturn || readOnly}>
              {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Simpan Pengembalian
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
