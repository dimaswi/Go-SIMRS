import { useState, useEffect } from "react";
import { usePermission } from "@/hooks/usePermission";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
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
  Pill,
  User,
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

export function PharmacyReturn({ visitId, readOnly = false }: PharmacyReturnProps) {
  const { toast } = useToast();
  const { hasPermission } = usePermission();
  const canReturn = hasPermission("pharmacy.return");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [orders, setOrders] = useState<MedicineOrder[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<MedicineOrder | null>(null);
  const [returns, setReturns] = useState<MedicineReturn[]>([]);

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
    if (selectedOrder) {
      loadReturns(selectedOrder.id);
    }
  }, [selectedOrder]);

  const loadOrders = async () => {
    setLoading(true);
    try {
      const res = await medicineOrdersApi.getAll({ pharmacy_visit_id: visitId });
      const data = res.data || [];
      setOrders(data);
      // Select first order that has delivered items
      const eligibleOrder = data.find((o: MedicineOrder) => 
        o.items?.some((i: MedicineOrderItem) => (i.dispensed_qty || 0) > 0)
      ) || data[0];
      if (eligibleOrder) {
        setSelectedOrder(eligibleOrder);
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
      <Card className="shadow-md">
        <CardHeader className="border-b bg-muted/50">
          <CardTitle className="text-lg">Pengembalian Obat</CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          <div className="flex items-center justify-center py-8 gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-muted-foreground">Memuat data...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (orders.length === 0) {
    return (
      <Card className="shadow-md">
        <CardHeader className="border-b bg-muted/50">
          <CardTitle className="text-lg">Pengembalian Obat</CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
            <RotateCcw className="h-12 w-12 mb-4 opacity-50" />
            <p>Tidak ada order obat untuk visit ini</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const patient = selectedOrder?.source_visit?.registration?.patient || selectedOrder?.registration?.patient;
  const deliveredItems = selectedOrder?.items?.filter(
    (item) => (item.dispensed_qty || 0) > 0
  ) || [];

  return (
    <Card className="shadow-md">
      <CardHeader className="border-b bg-muted/30 py-3 px-4">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <RotateCcw className="h-4 w-4" />
          Pengembalian Obat
        </CardTitle>
        <CardDescription>
          Proses pengembalian obat yang tidak digunakan atau ada masalah
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-[calc(100vh-300px)] min-h-[400px]">
          <div className="p-4 space-y-4">
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
          {/* Patient & Order Info Table */}
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
                <Badge variant={ORDER_STATUS_LABELS[selectedOrder.status]?.variant || "secondary"}>
                  {ORDER_STATUS_LABELS[selectedOrder.status]?.label || selectedOrder.status}
                </Badge>
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
                    <td className="py-2 text-muted-foreground">Ruang Asal</td>
                    <td className="py-2 font-medium">{selectedOrder.source_room?.name || "-"}</td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-2 text-muted-foreground">Petugas Order</td>
                    <td className="py-2 font-medium">{selectedOrder.prescriber?.nama_lengkap || "-"}</td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-2 text-muted-foreground">Waktu Order</td>
                    <td className="py-2 font-medium">
                      {selectedOrder.created_at ? new Date(selectedOrder.created_at).toLocaleString("id-ID") : "-"}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2 text-muted-foreground">Prioritas</td>
                    <td className="py-2">
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
            <div className="border rounded-lg">
              <div className="p-3 border-b bg-muted/30">
                <Label className="text-sm font-semibold flex items-center gap-2">
                  <History className="h-4 w-4" />
                  Riwayat Pengembalian
                </Label>
              </div>
              <div className="p-3">
                <div className="space-y-2">
                  {returns.map((ret) => (
                    <div
                      key={ret.id}
                      className="p-3 bg-orange-50 dark:bg-orange-950 rounded-lg border border-orange-200"
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-medium">{ret.medicine?.name || "Obat"}</p>
                          <p className="text-sm text-muted-foreground">
                            Jumlah: {ret.quantity} | Kondisi: {ret.condition}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            Alasan: {ret.return_reason}
                          </p>
                        </div>
                        <Badge variant={ret.is_restocked ? "default" : "outline"}>
                          {ret.is_restocked ? "Dikembalikan ke Stok" : "Tidak Restock"}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                      {ret.created_at && new Date(ret.created_at).toLocaleString("id-ID")}
                    </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Delivered Items for Return */}
          <div className="border rounded-lg">
            <div className="p-3 border-b bg-muted/30">
              <Label className="text-sm font-semibold flex items-center gap-2">
                <Package className="h-4 w-4" />
                Obat yang Sudah Diserahkan
              </Label>
            </div>
            <div className="p-3">
              {deliveredItems.length === 0 ? (
                <div className="text-center py-6 text-muted-foreground">
                  <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>Belum ada obat yang diserahkan</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {deliveredItems.map((item) => {
                    const returnableQty = (item.dispensed_qty || 0) - (item.returned_qty || 0);
                    
                    return (
                      <div
                        key={item.id}
                        className="p-3 bg-muted/50 rounded-lg border"
                      >
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <Pill className="h-4 w-4" />
                              <p className="font-medium">{item.medicine?.name || "Obat"}</p>
                            </div>
                            <p className="text-sm text-muted-foreground mt-1">
                              {item.medicine?.generic_name}
                            </p>
                            <div className="mt-2 grid grid-cols-3 gap-2 text-sm">
                              <div>
                                <span className="text-muted-foreground">Dipesan:</span>{" "}
                                <span className="font-medium">{item.quantity}</span>
                              </div>
                              <div>
                                <span className="text-muted-foreground">Diserahkan:</span>{" "}
                                <span className="font-medium">{item.dispensed_qty || 0}</span>
                              </div>
                              <div>
                                <span className="text-muted-foreground">Dikembalikan:</span>{" "}
                                <span className="font-medium">{item.returned_qty || 0}</span>
                              </div>
                            </div>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleOpenReturnDialog(item)}
                            disabled={returnableQty <= 0 || !canReturn || readOnly}
                          >
                            <RotateCcw className="h-4 w-4 mr-1" />
                            Return
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </>
      )}          </div>
        </ScrollArea>      </CardContent>

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

            <div className="flex items-center justify-between">
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
    </Card>
  );
}
