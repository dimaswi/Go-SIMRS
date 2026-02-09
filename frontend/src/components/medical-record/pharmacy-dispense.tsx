import { useState, useEffect } from "react";
import { usePermission } from "@/hooks/usePermission";
import { useAuthStore } from "@/lib/store";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2,
  Package,
  Pill,
  User,
  CheckCircle2,
  AlertCircle,
  Printer,
} from "lucide-react";
import { medicineOrdersApi } from "@/lib/api";
import type { MedicineOrder, MedicineOrderItem } from "@/lib/api";

interface PharmacyDispenseProps {
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

const ITEM_STATUS_LABELS: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  ordered: { label: "Dipesan", variant: "secondary" },
  available: { label: "Tersedia", variant: "default" },
  ready: { label: "Siap", variant: "default" },
  delivered: { label: "Diserahkan", variant: "default" },
  returned: { label: "Dikembalikan", variant: "outline" },
  cancelled: { label: "Dibatalkan", variant: "destructive" },
};

interface DispenseItem {
  item_id: number;
  item: MedicineOrderItem;
  dispensed_qty: number;
  selected: boolean;
  remaining: number;
}

export function PharmacyDispense({ visitId, readOnly = false }: PharmacyDispenseProps) {
  const { toast } = useToast();
  const { hasPermission } = usePermission();
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [orders, setOrders] = useState<MedicineOrder[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<MedicineOrder | null>(null);
  const [dispenseItems, setDispenseItems] = useState<DispenseItem[]>([]);

  useEffect(() => {
    loadOrders();
  }, [visitId]);

  useEffect(() => {
    if (selectedOrder) {
      initializeDispenseItems(selectedOrder);
    }
  }, [selectedOrder]);

  const loadOrders = async () => {
    setLoading(true);
    try {
      const res = await medicineOrdersApi.getAll({ pharmacy_visit_id: visitId });
      const data = res.data || [];
      setOrders(data);
      // Select first order that is reviewed/preparing/partial
      const eligibleOrder = data.find((o: MedicineOrder) => 
        ["reviewed", "preparing", "partial"].includes(o.status)
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

  const initializeDispenseItems = (order: MedicineOrder) => {
    // Filter out cancelled items
    const items: DispenseItem[] = (order.items || [])
      .filter((item) => item.status !== "cancelled")
      .map((item) => {
        const remaining = item.quantity - (item.dispensed_qty || 0);
        return {
          item_id: item.id!,
          item,
          dispensed_qty: remaining,
          selected: remaining > 0 && item.status !== "delivered",
          remaining,
        };
      });
    setDispenseItems(items);
  };

  const handleSelectItem = (itemId: number, selected: boolean) => {
    setDispenseItems((prev) =>
      prev.map((item) =>
        item.item_id === itemId ? { ...item, selected } : item
      )
    );
  };

  const handleQuantityChange = (itemId: number, qty: number) => {
    setDispenseItems((prev) =>
      prev.map((item) =>
        item.item_id === itemId
          ? { ...item, dispensed_qty: Math.min(Math.max(0, qty), item.remaining) }
          : item
      )
    );
  };

  const handleSelectAll = (selected: boolean) => {
    setDispenseItems((prev) =>
      prev.map((item) => ({
        ...item,
        selected: item.remaining > 0 ? selected : false,
      }))
    );
  };

  const handleSubmitDispense = async () => {
    if (!selectedOrder) return;

    const selectedItems = dispenseItems.filter((item) => item.selected && item.dispensed_qty > 0);
    if (selectedItems.length === 0) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Pilih minimal 1 obat untuk diserahkan",
      });
      return;
    }

    setSubmitting(true);
    try {
      await medicineOrdersApi.dispense(selectedOrder.id, {
        items: selectedItems.map((item) => ({
          item_id: item.item_id,
          dispensed_qty: item.dispensed_qty,
        })),
      });
      toast({
        title: "Berhasil",
        description: "Obat berhasil diserahkan",
      });
      loadOrders();
      // Trigger refresh on print options dropdown and final visit
      window.dispatchEvent(new CustomEvent("refresh-print-options"));
      window.dispatchEvent(new CustomEvent("refresh-final-visit"));
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.response?.data?.error || "Gagal menyerahkan obat",
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Penyerahan Obat</CardTitle>
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
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Penyerahan Obat</CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
            <Package className="h-12 w-12 mb-4 opacity-50" />
            <p>Tidak ada order obat untuk visit ini</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const patient = selectedOrder?.source_visit?.registration?.patient || selectedOrder?.registration?.patient;
  const hasDispensePermission = hasPermission("pharmacy.dispense");
  const isOrderDelivered = selectedOrder?.status === "delivered" || selectedOrder?.status === "ready";
  const canDispense = hasDispensePermission && selectedOrder && ["reviewed", "preparing", "partial"].includes(selectedOrder.status);
  const allDelivered = dispenseItems.every((item) => item.remaining === 0) || isOrderDelivered;

  const handlePrintDeliveredMedicines = () => {
    if (!selectedOrder) return;
    
    // Print all delivered items from the order
    const deliveredItems = (selectedOrder.items || []).filter(item => (item.dispensed_qty || 0) > 0);
    printMedicineReceipt(deliveredItems.map(item => ({
      name: item.medicine?.name || "-",
      qty: item.dispensed_qty || 0,
      unit: item.unit,
      dosage: item.dosage,
      frequency: item.frequency,
    })));
  };

  const printMedicineReceipt = (items: { name: string; qty: number; unit: string; dosage?: string; frequency?: string }[]) => {
    if (!selectedOrder || items.length === 0) return;
    
    const printWindow = window.open("", "_blank", "width=600,height=800");
    if (printWindow) {
      const itemsHtml = items.map(item => `
        <tr>
          <td style="padding: 8px; border-bottom: 1px solid #ddd;">${item.name}</td>
          <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: center;">${item.qty} ${item.unit}</td>
          <td style="padding: 8px; border-bottom: 1px solid #ddd;">${item.dosage || "-"}</td>
          <td style="padding: 8px; border-bottom: 1px solid #ddd;">${item.frequency || "-"}</td>
        </tr>
      `).join("");

      printWindow.document.write(`
        <html>
          <head>
            <title>Daftar Obat - ${selectedOrder.order_number}</title>
            <style>
              body { font-family: Arial, sans-serif; padding: 20px; font-size: 12px; }
              .header { text-align: center; margin-bottom: 20px; }
              .header h2 { margin: 0; }
              .info-table { width: 100%; margin-bottom: 20px; }
              .info-table td { padding: 4px 0; }
              .medicine-table { width: 100%; border-collapse: collapse; }
              .medicine-table th { background: #f5f5f5; padding: 8px; text-align: left; border-bottom: 2px solid #333; }
              .medicine-table td { padding: 8px; border-bottom: 1px solid #ddd; }
              .footer { margin-top: 30px; }
              .signature { display: flex; justify-content: space-between; margin-top: 40px; }
              .signature div { width: 45%; text-align: center; }
              .signature-line { border-top: 1px solid #333; margin-top: 60px; padding-top: 5px; }
            </style>
          </head>
          <body>
            <div class="header">
              <h2>DAFTAR OBAT</h2>
              <p>No. Order: ${selectedOrder.order_number}</p>
            </div>
            
            <table class="info-table">
              <tr>
                <td width="120">Nama Pasien</td>
                <td>: <strong>${patient?.nama_lengkap || "-"}</strong></td>
              </tr>
              <tr>
                <td>No. RM</td>
                <td>: ${patient?.no_rm || "-"}</td>
              </tr>
              <tr>
                <td>Diagnosis</td>
                <td>: ${selectedOrder.diagnosis || "-"}</td>
              </tr>
              <tr>
                <td>Ruang</td>
                <td>: ${selectedOrder.source_room?.name || "-"}</td>
              </tr>
              <tr>
                <td>Dokter</td>
                <td>: ${selectedOrder.prescriber?.nama_lengkap || "-"}</td>
              </tr>
            </table>
            
            <table class="medicine-table">
              <thead>
                <tr>
                  <th>Nama Obat</th>
                  <th style="text-align: center;">Jumlah</th>
                  <th>Dosis</th>
                  <th>Aturan Pakai</th>
                </tr>
              </thead>
              <tbody>
                ${itemsHtml}
              </tbody>
            </table>
            
            <div class="footer">
              <p style="font-size: 11px;">Tanggal cetak: ${new Date().toLocaleString("id-ID")}</p>
            </div>
            
            <div class="signature">
              <div>
                <p>Petugas Farmasi</p>
                <p style="margin-top: 5px;">&nbsp;</p>
                <p class="signature-line">${user?.full_name || "-"}</p>
              </div>
              <div>
                <p>Penerima</p>
                <p style="margin-top: 5px;">&nbsp;</p>
                <p class="signature-line">(...........................)</p>
              </div>
            </div>
            
            <script>window.print();</script>
          </body>
        </html>
      `);
      printWindow.document.close();
    }
  };

  return (
    <Card>
      <CardHeader className="py-3 px-4">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <Package className="h-4 w-4" />
          Penyerahan Obat
        </CardTitle>
        <CardDescription>
          Serahkan obat yang telah disiapkan kepada pasien
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
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

          {/* Status Warning */}
          {!canDispense && !allDelivered && (
            <div className="border border-yellow-200 bg-yellow-50 dark:bg-yellow-950 rounded-lg p-3">
              <div className="flex items-center gap-2 text-yellow-700 dark:text-yellow-300">
                <AlertCircle className="h-4 w-4" />
                <p className="text-sm">
                  Order ini belum ditelaah. Silakan lakukan telaah resep terlebih dahulu.
                </p>
              </div>
            </div>
          )}

          {allDelivered && (
            <div className="border border-green-200 bg-green-50 dark:bg-green-950 rounded-lg p-3">
              <div className="flex items-center gap-2 text-green-700 dark:text-green-300">
                <CheckCircle2 className="h-4 w-4" />
                <p className="text-sm">
                  Semua obat sudah diserahkan.
                </p>
              </div>
            </div>
          )}

          {/* Dispense Items */}
          <div className="border rounded-lg">
            <div className="p-3 border-b bg-muted/30">
              <div className="flex justify-between items-center">
                <Label className="text-sm font-semibold flex items-center gap-2">
                  <Package className="h-4 w-4" />
                  Daftar Obat untuk Diserahkan
                </Label>
                {canDispense && !allDelivered && (
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="select_all"
                      checked={dispenseItems.filter((i) => i.remaining > 0).every((i) => i.selected)}
                      onCheckedChange={(checked) => handleSelectAll(checked as boolean)}
                    />
                    <Label htmlFor="select_all" className="text-sm">
                      Pilih Semua
                    </Label>
                  </div>
                )}
              </div>
            </div>
            <div className="p-3">
              {allDelivered && (
                <div className="flex items-center gap-2 text-green-600 dark:text-green-400 text-sm bg-green-50 dark:bg-green-950 p-3 rounded-lg mb-4 border border-green-200">
                  <CheckCircle2 className="h-5 w-5" />
                  <span className="font-medium">Semua obat sudah diserahkan kepada pasien</span>
                </div>
              )}
              
              <div className="space-y-3">
                {dispenseItems.map((dispenseItem) => {
                  const { item, remaining, selected, dispensed_qty } = dispenseItem;
                  const isDelivered = remaining === 0;

                  return (
                    <div
                      key={item.id}
                      className={`p-3 rounded-lg border ${
                        isDelivered
                          ? "bg-green-50 dark:bg-green-950 border-green-200"
                          : selected
                          ? "bg-blue-50 dark:bg-blue-950 border-blue-200"
                          : "bg-muted/50"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        {!isDelivered && canDispense && (
                          <Checkbox
                            checked={selected}
                            onCheckedChange={(checked) =>
                              handleSelectItem(item.id!, checked as boolean)
                            }
                            className="mt-1"
                            disabled={readOnly}
                          />
                        )}
                        <div className="flex-1">
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="font-medium flex items-center gap-2">
                                <Pill className="h-4 w-4" />
                                {item.medicine?.name || "Obat"}
                              </p>
                              <p className="text-sm text-muted-foreground">
                                {item.medicine?.generic_name}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge variant={ITEM_STATUS_LABELS[item.status]?.variant || "secondary"}>
                                {ITEM_STATUS_LABELS[item.status]?.label || item.status}
                              </Badge>
                            </div>
                          </div>
                          <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                            <div>
                              <span className="text-muted-foreground">Dipesan:</span>{" "}
                              <span className="font-medium">{item.quantity} {item.unit}</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Sudah diserahkan:</span>{" "}
                              <span className="font-medium">{item.dispensed_qty || 0} {item.unit}</span>
                            </div>
                          </div>
                          {remaining > 0 && canDispense && selected && (
                            <div className="mt-3 flex items-center gap-2">
                              <Label className="text-sm">Jumlah diserahkan:</Label>
                              <Input
                                type="number"
                                min={1}
                                max={remaining}
                                value={dispensed_qty}
                                onChange={(e) =>
                                  handleQuantityChange(item.id!, parseInt(e.target.value) || 0)
                                }
                                className="w-24 h-8"
                                disabled={readOnly}
                              />
                              <span className="text-sm text-muted-foreground">
                                (maks: {remaining})
                              </span>
                            </div>
                          )}
                          {isDelivered && (
                            <div className="mt-2 flex items-center gap-2 text-green-600">
                              <CheckCircle2 className="h-4 w-4" />
                              <span className="text-sm">Sudah diserahkan semua</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Action buttons */}
              <div className="flex flex-wrap gap-2 mt-4">
                {/* Print delivered medicines list */}
                {(selectedOrder?.items || []).some(item => (item.dispensed_qty || 0) > 0) && (
                  <Button
                    variant="outline"
                    onClick={handlePrintDeliveredMedicines}
                  >
                    <Printer className="h-4 w-4 mr-2" />
                    Cetak Daftar Obat
                  </Button>
                )}
                
                {/* Dispense button - only show if can dispense and not all delivered */}
                {canDispense && !allDelivered && (
                  <Button
                    className="flex-1"
                    onClick={handleSubmitDispense}
                    disabled={submitting || dispenseItems.filter((i) => i.selected).length === 0 || readOnly}
                  >
                    {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    <Package className="h-4 w-4 mr-2" />
                    Serahkan Obat Terpilih
                  </Button>
                )}
              </div>
            </div>
          </div>
        </>
      )}      </CardContent>
    </Card>
  );
}
