import { useState, useEffect } from "react";
import { usePermission } from "@/hooks/usePermission";
import { useAuthStore } from "@/lib/store";
import { usePINVerification, PINVerificationDialog } from "@/components/medical-record/edit-mode-controller";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Loader2,
  Package,
  CheckCircle2,
  AlertCircle,
  Printer,
  ShieldCheck,
} from "lucide-react";
import { medicineOrdersApi, signatureApi, DOCUMENT_TYPES } from "@/lib/api";
import type { MedicineOrder, MedicineOrderItem, PrescriptionReview } from "@/lib/api";
import { SignaturePINDialog } from "@/components/signature/signature-pin-dialog";
import { OrderDetailInfoButton } from "./order-detail-info-button";
import { getPharmacyItemStatusMeta, getPharmacyOrderStatusMeta } from "./pharmacy-status";

const FOOTER_ACTION_EVENT = "medical-record-footer-action";
const PHARMACY_OPEN_FINAL_REVIEW_EVENT = "pharmacy-open-final-review";
const PHARMACY_FINAL_REVIEW_SAVED_EVENT = "pharmacy-final-review-saved";

interface PharmacyDispenseProps {
  visitId: number;
  readOnly?: boolean;
  rmDuplicateMode?: boolean;
  apiAdapter?: Pick<typeof medicineOrdersApi, "getAll" | "dispense">;
}

interface DispenseItem {
  item_id: number;
  item: MedicineOrderItem;
  dispensed_qty: number;
  selected: boolean;
  remaining: number;
}

const formatRupiah = (value: number) => {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Number.isFinite(value) ? value : 0);
};

export function PharmacyDispense({
  visitId,
  readOnly = false,
  rmDuplicateMode = false,
  apiAdapter,
}: PharmacyDispenseProps) {
  const { toast } = useToast();
  const { hasPermission } = usePermission();
  const { user } = useAuthStore();
  const orderApi = apiAdapter || medicineOrdersApi;
  const {
    showPINDialog,
    setShowPINDialog,
    pin,
    verifyingPIN,
    pinInputRefs,
    handlePINChange,
    handlePINKeyDown,
    handleVerifyPIN,
    requestPINVerification,
  } = usePINVerification({ isRequired: true });
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [orders, setOrders] = useState<MedicineOrder[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<MedicineOrder | null>(null);
  const [selectedOrderReview, setSelectedOrderReview] = useState<PrescriptionReview | null>(null);
  const [dispenseItems, setDispenseItems] = useState<DispenseItem[]>([]);
  const [showDeliveredRows, setShowDeliveredRows] = useState(false);
  const [showSelectedOnly, setShowSelectedOnly] = useState(false);
  const [pendingFinalReviewToken, setPendingFinalReviewToken] = useState<string | null>(null);

  // Signature state
  const [showSignatureDialog, setShowSignatureDialog] = useState(false);
  const [signatureStatus, setSignatureStatus] = useState<{
    is_signed: boolean;
    signed_at?: string;
    signer_name?: string;
  } | null>(null);

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
      initializeDispenseItems(selectedOrder);
      checkSignatureStatus(selectedOrder.id);
      void checkReviewStatus(selectedOrder.id);
    }
  }, [selectedOrder]);

  useEffect(() => {
    const handleFinalReviewSaved = (event: Event) => {
      const customEvent = event as CustomEvent<{ token?: string; orderId?: number }>;
      if (!pendingFinalReviewToken || customEvent.detail?.token !== pendingFinalReviewToken) {
        return;
      }
      if (!selectedOrder || customEvent.detail?.orderId !== selectedOrder.id) {
        return;
      }

      setPendingFinalReviewToken(null);
      void checkReviewStatus(selectedOrder.id).finally(() => {
        window.setTimeout(() => {
          void requestPINVerification(handleSubmitDispense);
        }, 80);
      });
    };

    window.addEventListener(
      PHARMACY_FINAL_REVIEW_SAVED_EVENT,
      handleFinalReviewSaved as EventListener,
    );
    return () => {
      window.removeEventListener(
        PHARMACY_FINAL_REVIEW_SAVED_EVENT,
        handleFinalReviewSaved as EventListener,
      );
    };
  }, [pendingFinalReviewToken, requestPINVerification, selectedOrder]);

  const checkReviewStatus = async (orderId: number) => {
    try {
      const res = await medicineOrdersApi.getReview(orderId);
      const review = res.data;
      if (review && review.id) {
        setSelectedOrderReview(review);
      } else {
        setSelectedOrderReview(null);
      }
    } catch {
      setSelectedOrderReview(null);
    }
  };

  const checkSignatureStatus = async (orderId: number) => {
    try {
      const res = await signatureApi.getDocumentSignature(DOCUMENT_TYPES.PHARMACY_HANDOVER, orderId);
      setSignatureStatus(res.data);
    } catch {
      setSignatureStatus(null);
    }
  };

  const loadOrders = async (options?: { silent?: boolean; preferredOrderId?: number }) => {
    if (!options?.silent) {
      setLoading(true);
    }

    try {
      const res = await orderApi.getAll({ pharmacy_visit_id: visitId });
      const data = res.data || [];
      setOrders(data);
      // Select first order that is reviewed/preparing/partial
      const preferredOrder = data.find((order) => order.id === options?.preferredOrderId);
      const eligibleOrder = preferredOrder || data.find((o: MedicineOrder) =>
        ["reviewed", "preparing", "partial"].includes(o.status)
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
      await orderApi.dispense(selectedOrder.id, {
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

  const hasDispensePermission = hasPermission("pharmacy.dispense");
  const isOrderDelivered = selectedOrder?.status === "delivered" || selectedOrder?.status === "ready";
  const isInitialReviewComplete =
    selectedOrderReview?.initial_review_completed === true ||
    !!selectedOrder?.reviewed_at ||
    !!selectedOrder?.reviewed_by_id ||
    ["reviewed", "preparing", "partial", "ready", "delivered", "returned"].includes(selectedOrder?.status || "");
  const isFinalReviewComplete = selectedOrderReview?.final_review_completed === true;
  const canDispenseByStatus = hasDispensePermission &&
    selectedOrder &&
    ["reviewed", "preparing", "partial"].includes(selectedOrder.status);
  const canDispense = canDispenseByStatus && isFinalReviewComplete;
  const reviewGuardMessage = !isInitialReviewComplete
    ? "Telaah Awal resep belum diselesaikan."
    : !isFinalReviewComplete
      ? "Telaah Akhir (Verifikasi Akhir dan PIO) belum diselesaikan."
      : null;
  const allDelivered = dispenseItems.every((item) => item.remaining === 0) || isOrderDelivered;
  const orderedGrandTotal = dispenseItems.reduce((total, dispenseItem) => {
    const unitPrice = Number((dispenseItem.item as any).unit_price ?? (dispenseItem.item as any).price ?? (dispenseItem.item.medicine as any)?.selling_price ?? 0);
    return total + unitPrice * Number(dispenseItem.item.quantity || 0);
  }, 0);
  const deliveredGrandTotal = dispenseItems.reduce((total, dispenseItem) => {
    const unitPrice = Number((dispenseItem.item as any).unit_price ?? (dispenseItem.item as any).price ?? (dispenseItem.item.medicine as any)?.selling_price ?? 0);
    return total + unitPrice * Number(dispenseItem.item.dispensed_qty || 0);
  }, 0);
  const selectedDispenseGrandTotal = dispenseItems
    .filter((item) => item.selected && item.dispensed_qty > 0)
    .reduce((total, dispenseItem) => {
      const unitPrice = Number((dispenseItem.item as any).unit_price ?? (dispenseItem.item as any).price ?? (dispenseItem.item.medicine as any)?.selling_price ?? 0);
      return total + unitPrice * Number(dispenseItem.dispensed_qty || 0);
    }, 0);
  const visibleDispenseItems = dispenseItems
    .filter((item) => (showDeliveredRows ? true : item.remaining > 0))
    .filter((item) => (showSelectedOnly ? item.selected : true));

  useEffect(() => {
    const handleFooterAction = (event: Event) => {
      const customEvent = event as CustomEvent<{
        tabId: string;
        action: "save" | "final";
        handled: boolean;
      }>;
      if (customEvent.detail?.tabId !== "medicine-dispense") return;
      customEvent.detail.handled = true;

      if (submitting || readOnly) return;
      if (!selectedOrder) {
        toast({
          title: "Info",
          description: "Tidak ada order obat yang bisa diproses.",
        });
        return;
      }
      if (allDelivered) {
        toast({
          title: "Info",
          description: "Tidak ada obat yang perlu diserahkan.",
        });
        return;
      }
      if (!canDispenseByStatus) {
        toast({
          title: "Info",
          description: "Order belum siap untuk proses penyerahan.",
        });
        return;
      }
      const nextToken = `${selectedOrder.id}-${Date.now()}`;
      setPendingFinalReviewToken(nextToken);
      window.dispatchEvent(
        new CustomEvent(PHARMACY_OPEN_FINAL_REVIEW_EVENT, {
          detail: { token: nextToken },
        }),
      );
    };

    window.addEventListener(FOOTER_ACTION_EVENT, handleFooterAction as EventListener);
    return () => {
      window.removeEventListener(FOOTER_ACTION_EVENT, handleFooterAction as EventListener);
    };
  }, [
    submitting,
    readOnly,
    allDelivered,
    selectedOrder,
    canDispenseByStatus,
    requestPINVerification,
    handleSubmitDispense,
    selectedOrder?.id,
  ]);

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
            <Package className="h-12 w-12 mb-4 opacity-50" />
            <p>Tidak ada order obat untuk visit ini</p>
          </div>
        </div>
      </div>
    );
  }

  const patient = selectedOrder?.source_visit?.registration?.patient || selectedOrder?.registration?.patient;

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
          <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: center;">${item.qty.toLocaleString('id-ID')} ${item.unit}</td>
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
                        {order.order_number} - {getPharmacyOrderStatusMeta(order.status).label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedOrder && (
                  <Badge
                    variant={getPharmacyOrderStatusMeta(selectedOrder.status).variant}
                    className={getPharmacyOrderStatusMeta(selectedOrder.status).className}
                  >
                    {getPharmacyOrderStatusMeta(selectedOrder.status).label}
                  </Badge>
                )}
              </div>
            </div>
          </div>
        )}

        {selectedOrder && (
          <>
            {/* Status Warning */}
            {reviewGuardMessage && !canDispense && !allDelivered && (
              <div className="border border-yellow-200 bg-yellow-50 dark:bg-yellow-950 rounded-lg p-3">
                <div className="flex items-center gap-2 text-yellow-700 dark:text-yellow-300">
                  <AlertCircle className="h-4 w-4" />
                  <p className="text-sm">
                    {reviewGuardMessage} Lanjutkan dengan tombol Simpan untuk membuka telaah yang masih diperlukan.
                  </p>
                </div>
              </div>
            )}

            {/* Dispense Items */}
            <div className="border border-border/70 bg-background mb-4">
              <div className="flex items-center justify-between gap-3 overflow-x-auto border-b border-border/70 bg-muted/30 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                <span className="flex shrink-0 items-center gap-2 whitespace-nowrap">
                  <Package className="h-3 w-3" />
                  Daftar Obat untuk Diserahkan
                </span>
                <div className="flex shrink-0 items-center gap-3 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="show_selected_only"
                        checked={showSelectedOnly}
                        onCheckedChange={(checked) => setShowSelectedOnly(checked === true)}
                      />
                      <Label htmlFor="show_selected_only" className="text-[10px] text-muted-foreground">
                        Hanya terpilih
                      </Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="show_delivered_rows"
                        checked={showDeliveredRows}
                        onCheckedChange={(checked) => setShowDeliveredRows(checked === true)}
                      />
                      <Label htmlFor="show_delivered_rows" className="text-[10px] text-muted-foreground">
                        Tampilkan item selesai
                      </Label>
                    </div>
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
                  {rmDuplicateMode && <Badge variant="outline" className="h-5 px-1.5 py-0 text-[10px]">Mode RM Duplikat</Badge>}
                  <Badge
                    variant={getPharmacyOrderStatusMeta(selectedOrder.status).variant}
                    className={`h-5 px-1.5 py-0 text-[10px] ${getPharmacyOrderStatusMeta(selectedOrder.status).className}`}
                  >
                    {getPharmacyOrderStatusMeta(selectedOrder.status).label}
                  </Badge>
                  <OrderDetailInfoButton
                    title="Detail Order Farmasi"
                    tooltip="Lihat detail order farmasi"
                    className="h-9 w-9 rounded-md"
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
                            <span className="font-medium">{selectedOrder.prescriber?.nama_lengkap || "-"}</span>
                          </td>
                        </tr>
                        <tr className="border-b">
                          <td className="w-28 py-1.5 align-top text-muted-foreground">Diagnosis</td>
                          <td className="py-1.5 font-medium break-words">{selectedOrder.diagnosis || "-"}</td>
                        </tr>
                        <tr className="border-b">
                          <td className="py-1.5 align-top text-muted-foreground">Ruang Asal</td>
                          <td className="py-1.5 font-medium break-words">{selectedOrder.source_room?.name || "-"}</td>
                        </tr>
                        <tr className="border-b">
                          <td className="py-1.5 align-top text-muted-foreground">Waktu Order</td>
                          <td className="py-1.5 font-medium break-words">
                            {selectedOrder.created_at ? new Date(selectedOrder.created_at).toLocaleString("id-ID") : "-"}
                          </td>
                        </tr>
                        <tr>
                          <td className="py-1.5 align-top text-muted-foreground">Prioritas</td>
                          <td className="py-1.5">
                            <Badge variant={selectedOrder.priority === "urgent" ? "destructive" : "outline"}>
                              {selectedOrder.priority === "urgent" ? "Urgent" : "Normal"}
                            </Badge>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </OrderDetailInfoButton>
                </div>
              </div>
              <div className="p-3 pb-0">
                <div className="mb-2 text-xs text-muted-foreground">
                  Menampilkan {visibleDispenseItems.length} dari {dispenseItems.length} item.
                </div>
                {/* {allDelivered && (
                  <div className="flex items-center gap-2 text-green-600 dark:text-green-400 text-sm bg-green-50 dark:bg-green-950 p-3 rounded mb-4 border border-green-200">
                    <CheckCircle2 className="h-5 w-5" />
                    <span className="font-medium">Semua obat sudah diserahkan kepada pasien</span>
                  </div>
                )} */}
              </div>
              
              <div className="overflow-x-auto">
                <table className="w-full table-fixed text-xs">
                  <thead className="bg-muted/50 border-y border-border/70">
                      <tr>
                        <th className="py-1.5 px-2 text-left font-medium w-[8%]">Pilih</th>
                        <th className="py-1.5 px-2 text-left font-medium w-[34%]">Obat</th>
                        <th className="py-1.5 px-2 text-left font-medium hidden xl:table-cell w-[14%]">Aturan</th>
                        <th className="py-1.5 px-2 text-left font-medium w-[18%]">Qty</th>
                        <th className="py-1.5 px-2 text-left font-medium w-[12%]">Qty Serah</th>
                        <th className="py-1.5 px-2 text-right font-medium hidden lg:table-cell w-[8%]">Harga</th>
                        <th className="py-1.5 px-2 text-right font-medium w-[10%]">Subtotal</th>
                        <th className="py-1.5 px-2 text-left font-medium w-[10%]">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleDispenseItems.map((dispenseItem) => {
                        const { item, remaining, selected, dispensed_qty } = dispenseItem;
                        const isDelivered = remaining === 0;
                        const unitPrice = Number((item as any).unit_price ?? (item as any).price ?? (item.medicine as any)?.selling_price ?? 0);
                        const orderedSubtotal = unitPrice * Number(item.quantity || 0);

                        return (
                          <tr
                            key={item.id || dispenseItem.item_id}
                            className={
                              isDelivered
                                ? "border-t bg-green-50/60 dark:bg-green-950/20"
                                : selected
                                  ? "border-t bg-blue-50/60 dark:bg-blue-950/20"
                                  : "border-t"
                            }
                          >
                            <td className="py-1.5 px-2 align-top">
                              {!isDelivered && canDispense ? (
                                <Checkbox
                                  checked={selected}
                                  onCheckedChange={(checked) => handleSelectItem(item.id!, checked as boolean)}
                                  disabled={readOnly}
                                />
                              ) : (
                                <span className="text-xs text-muted-foreground">-</span>
                              )}
                            </td>
                            <td className="py-1.5 px-2 align-top">
                              <p className="font-medium leading-5 break-words">{item.medicine?.name || "Obat"}</p>
                              <p className="text-[11px] text-muted-foreground break-words">{item.medicine?.generic_name || "-"}</p>
                            </td>
                            <td className="py-1.5 px-2 align-top hidden xl:table-cell">
                              <p className="text-[11px] break-words">{item.dosage || "-"}</p>
                              <p className="text-[11px] text-muted-foreground break-words">{item.frequency || "-"} / {item.route || "-"}</p>
                            </td>
                            <td className="py-1.5 px-2 align-top text-[11px]">
                              <p>Dipesan: <span className="font-medium">{item.quantity} {item.unit}</span></p>
                              <p>Diserah: <span className="font-medium">{item.dispensed_qty || 0} {item.unit}</span></p>
                              <p className="text-muted-foreground">Sisa: {remaining} {item.unit}</p>
                            </td>
                            <td className="py-1.5 px-2 align-top">
                              {remaining > 0 && canDispense ? (
                                <div className="space-y-1">
                                  <Input
                                    type="number"
                                    min={1}
                                    max={remaining}
                                    value={dispensed_qty}
                                    onChange={(e) => handleQuantityChange(item.id!, parseInt(e.target.value) || 0)}
                                    className="h-7 w-16 text-xs"
                                    disabled={readOnly || !selected}
                                  />
                                  <span className="text-[11px] text-muted-foreground block">maks {remaining}</span>
                                </div>
                              ) : (
                                <span className="text-[11px] text-muted-foreground">-</span>
                              )}
                            </td>
                            <td className="py-1.5 px-2 text-right align-top font-medium whitespace-nowrap hidden lg:table-cell">{formatRupiah(unitPrice)}</td>
                            <td className="py-1.5 px-2 text-right align-top font-medium whitespace-nowrap">{formatRupiah(orderedSubtotal)}</td>
                            <td className="py-1.5 px-2 align-top">
                              <Badge
                                variant={getPharmacyItemStatusMeta(item.status).variant}
                                className={getPharmacyItemStatusMeta(item.status).className}
                              >
                                {getPharmacyItemStatusMeta(item.status).label}
                              </Badge>
                            </td>
                          </tr>
                        );
                      })}
                      {visibleDispenseItems.length === 0 && (
                        <tr>
                          <td colSpan={8} className="py-3 px-2 text-center text-xs text-muted-foreground">
                            Tidak ada item aktif yang perlu diserahkan.
                          </td>
                        </tr>
                      )}
                    </tbody>
                    <tfoot>
                      <tr className="border-t bg-muted/30">
                        <td colSpan={6} className="py-2 px-2 text-right text-xs text-muted-foreground">Total Dipesan</td>
                        <td className="py-2 px-2 text-right font-semibold whitespace-nowrap">{formatRupiah(orderedGrandTotal)}</td>
                        <td className="py-2 px-2" />
                      </tr>
                      <tr className="border-t bg-muted/30">
                        <td colSpan={6} className="py-2 px-2 text-right text-xs text-muted-foreground">Total Sudah Diserahkan</td>
                        <td className="py-2 px-2 text-right font-semibold whitespace-nowrap">{formatRupiah(deliveredGrandTotal)}</td>
                        <td className="py-2 px-2" />
                      </tr>
                      {canDispense && !allDelivered && (
                        <tr className="border-t bg-primary/5">
                          <td colSpan={6} className="py-2 px-2 text-right text-xs text-muted-foreground">Total Akan Diserahkan (Terpilih)</td>
                          <td className="py-2 px-2 text-right font-semibold text-primary whitespace-nowrap">{formatRupiah(selectedDispenseGrandTotal)}</td>
                          <td className="py-2 px-2" />
                        </tr>
                      )}
                    </tfoot>
                  </table>
              </div>

              {/* Action buttons */}
              <div className="flex flex-wrap gap-2 p-3 mt-4 border-t border-border/70">
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

                  {/* Signature button - show when all delivered */}
                  {allDelivered && (
                    signatureStatus?.is_signed ? (
                      <div className="flex items-center gap-2 text-sm text-green-600 bg-green-50 dark:bg-green-950 p-3 rounded flex-1">
                        <CheckCircle2 className="h-4 w-4" />
                        <span className="font-medium">Ditandatangani: {signatureStatus.signer_name}</span>
                      </div>
                    ) : (
                      <Button
                        onClick={() => setShowSignatureDialog(true)}
                        variant="outline"
                        className="flex-1"
                      >
                        <ShieldCheck className="h-4 w-4 mr-2" />
                        Tanda Tangani Serah Terima
                      </Button>
                    )
                  )}
              </div>
            </div>
          </>
        )}      </div>

      <PINVerificationDialog
        open={showPINDialog}
        onOpenChange={setShowPINDialog}
        pin={pin}
        verifying={verifyingPIN}
        pinInputRefs={pinInputRefs}
        onPINChange={handlePINChange}
        onPINKeyDown={handlePINKeyDown}
        onVerify={handleVerifyPIN}
      />

      {/* Signature Dialog */}
      {selectedOrder && (
        <SignaturePINDialog
          open={showSignatureDialog}
          onOpenChange={setShowSignatureDialog}
          documentType={DOCUMENT_TYPES.PHARMACY_HANDOVER}
          documentId={selectedOrder.id}
          visitId={visitId}
          documentTitle={selectedOrder.order_number}
          patientName={selectedOrder.source_visit?.registration?.patient?.nama_lengkap}
          onSuccess={() => {
            loadOrders();
            toast({ variant: "success", title: "Berhasil", description: "Serah terima obat berhasil ditandatangani" });
          }}
        />
      )}
    </div>
  );
}
