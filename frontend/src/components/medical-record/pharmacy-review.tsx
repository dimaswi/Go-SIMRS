import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { usePermission } from "@/hooks/usePermission";
import {
  Loader2,
  FileCheck,
  Pill,
  AlertTriangle,
  CheckCircle2,
  Clock,
} from "lucide-react";
import { medicineOrdersApi } from "@/lib/api";
import type { MedicineOrder, PrescriptionReview } from "@/lib/api";
import { OrderDetailInfoButton } from "./order-detail-info-button";

const FOOTER_ACTION_EVENT = "medical-record-footer-action";

interface PharmacyReviewProps {
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

export function PharmacyReview({ visitId, readOnly = false }: PharmacyReviewProps) {
  const { toast } = useToast();
  const { hasPermission } = usePermission();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [orders, setOrders] = useState<MedicineOrder[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<MedicineOrder | null>(null);
  const [existingReview, setExistingReview] = useState<PrescriptionReview | null>(null);
  const [hasDecided, setHasDecided] = useState(false);
  const [showAllReviewItems, setShowAllReviewItems] = useState(false);

  const [reviewForm, setReviewForm] = useState({
    drug_interaction_check: false,
    dose_check: false,
    duplication_check: false,
    allergy_check: false,
    contraindication_check: false,
    indication_check: false,
    is_approved: false,
    notes: "",
    warnings: "",
    suggestion: "",
    requires_doctor_confirmation: false,
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
      loadReview(selectedOrder.id);
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
      if (data.length > 0) {
        const nextSelectedOrder =
          data.find((order) => order.id === options?.preferredOrderId) || data[0];
        setSelectedOrder(nextSelectedOrder);
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

  const loadReview = async (orderId: number) => {
    try {
      const res = await medicineOrdersApi.getReview(orderId);
      const review = res.data;

      // Check if review exists (has id) or is just empty placeholder
      if (review && review.id) {
        setExistingReview(review);
        setHasDecided(true);
        setReviewForm({
          drug_interaction_check: review.drug_interaction_check || false,
          dose_check: review.dose_check || false,
          duplication_check: review.duplication_check || false,
          allergy_check: review.allergy_check || false,
          contraindication_check: review.contraindication_check || false,
          indication_check: review.indication_check || false,
          is_approved: review.is_approved !== false,
          notes: review.notes || "",
          warnings: review.warnings || "",
          suggestion: review.suggestion || "",
          requires_doctor_confirmation: review.requires_doctor_confirmation || false,
        });
      } else {
        // No existing review
        setExistingReview(null);
        setHasDecided(false);
        setReviewForm({
          drug_interaction_check: false,
          dose_check: false,
          duplication_check: false,
          allergy_check: false,
          contraindication_check: false,
          indication_check: false,
          is_approved: false,
          notes: "",
          warnings: "",
          suggestion: "",
          requires_doctor_confirmation: false,
        });
      }
    } catch {
      // Error loading review
      setExistingReview(null);
      setHasDecided(false);
      setReviewForm({
        drug_interaction_check: false,
        dose_check: false,
        duplication_check: false,
        allergy_check: false,
        contraindication_check: false,
        indication_check: false,
        is_approved: false,
        notes: "",
        warnings: "",
        suggestion: "",
        requires_doctor_confirmation: false,
      });
    }
  };

  const canReview = hasPermission("pharmacy.review");

  // Check if order is already reviewed
  const isAlreadyReviewed = selectedOrder?.status === "reviewed" ||
    selectedOrder?.status === "preparing" ||
    selectedOrder?.status === "ready" ||
    selectedOrder?.status === "delivered" ||
    selectedOrder?.status === "completed";

  // Check if already approved (has existing review with is_approved = true)
  const isAlreadyApproved = existingReview?.is_approved === true;

  // Check if all checklist items are checked
  const allChecklistCompleted =
    reviewForm.drug_interaction_check &&
    reviewForm.dose_check &&
    reviewForm.duplication_check &&
    reviewForm.allergy_check &&
    reviewForm.contraindication_check &&
    reviewForm.indication_check;

  // Can only approve if all checklist is completed, not already reviewed, and not already approved
  const canApprove = canReview && allChecklistCompleted && !isAlreadyReviewed && !isAlreadyApproved;

  const submitReview = async () => {
    if (!selectedOrder || submitting || readOnly || !canReview) return;
    if (isAlreadyApproved) {
      toast({
        title: "Info",
        description: "Telaah resep sudah disetujui.",
      });
      return;
    }
    if (isAlreadyReviewed && !existingReview) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Resep sudah ditelaah dan tidak dapat diubah.",
      });
      return;
    }
    if (!hasDecided) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Pilih keputusan telaah terlebih dahulu.",
      });
      return;
    }
    if (reviewForm.is_approved && !canApprove) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Lengkapi semua checklist untuk menyetujui resep.",
      });
      return;
    }

    setSubmitting(true);
    try {
      await medicineOrdersApi.submitReview(selectedOrder.id, reviewForm);
      toast({
        title: "Berhasil",
        description: reviewForm.is_approved
          ? "Telaah resep disetujui"
          : "Telaah resep tidak disetujui",
      });
      loadOrders();
      window.dispatchEvent(new CustomEvent("refresh-print-options"));
      window.dispatchEvent(new CustomEvent("refresh-final-visit"));
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.response?.data?.error || "Gagal menyimpan telaah resep",
      });
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    const handleFooterAction = (event: Event) => {
      const customEvent = event as CustomEvent<{
        tabId: string;
        action: "save" | "final";
        handled: boolean;
      }>;
      if (customEvent.detail?.tabId !== "prescription-review") return;
      customEvent.detail.handled = true;
      void submitReview();
    };

    window.addEventListener(FOOTER_ACTION_EVENT, handleFooterAction as EventListener);
    return () => {
      window.removeEventListener(FOOTER_ACTION_EVENT, handleFooterAction as EventListener);
    };
  }, [
    selectedOrder,
    submitting,
    readOnly,
    canReview,
    isAlreadyApproved,
    isAlreadyReviewed,
    existingReview,
    hasDecided,
    reviewForm,
    canApprove,
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
            <Pill className="h-12 w-12 mb-4 opacity-50" />
            <p>Tidak ada order obat untuk visit ini</p>
          </div>
        </div>
      </div>
    );
  }

  const patient = selectedOrder?.source_visit?.registration?.patient;
  const reviewDecision = hasDecided
    ? reviewForm.is_approved
      ? "approved"
      : "rejected"
    : "";
  const activeItems = selectedOrder?.items?.filter((i) => i.status !== "cancelled") || [];
  const displayedReviewItems = showAllReviewItems ? activeItems : activeItems.slice(0, 8);
  const grandTotal = activeItems.reduce((total, item) => {
    return total + getUnitPrice(item) * Number(item.quantity || 0);
  }, 0);

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
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <OrderDetailInfoButton title="Detail Order Farmasi" tooltip="Lihat detail order farmasi">
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
              </OrderDetailInfoButton>
              <Badge variant={ORDER_STATUS_LABELS[selectedOrder.status]?.variant || "secondary"} className="text-[10px] h-5 px-1.5 py-0">
                {ORDER_STATUS_LABELS[selectedOrder.status]?.label || selectedOrder.status}
              </Badge>
            </div>

            {/* Order Items Table */}
            <div className="border border-border/70 bg-background mb-4">
              <div className="flex flex-wrap items-center justify-between border-b border-border/70 bg-muted/30 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                <span className="flex items-center gap-2">
                  <Pill className="h-3 w-3" />
                  Daftar Obat ({activeItems.length} item)
                </span>
                {activeItems.length > 8 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-[10px] py-0"
                    onClick={() => setShowAllReviewItems((prev) => !prev)}
                  >
                    {showAllReviewItems ? "Ringkas" : `Lihat Semua (${activeItems.length})`}
                  </Button>
                )}
              </div>
              <div className="p-0">
                <table className="w-full table-fixed text-xs">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="py-1.5 px-2 text-left font-medium w-[40%]">Obat</th>
                      <th className="py-1.5 px-2 text-left font-medium hidden lg:table-cell w-[18%]">Aturan</th>
                      <th className="py-1.5 px-2 text-left font-medium hidden md:table-cell w-[16%]">Cara Pakai</th>
                      <th className="py-1.5 px-2 text-right font-medium w-[11%]">Jumlah</th>
                      <th className="py-1.5 px-2 text-right font-medium hidden sm:table-cell w-[15%]">Harga</th>
                      <th className="py-1.5 px-2 text-right font-medium w-[14%]">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayedReviewItems.map((item, index) => {
                      const unitPrice = getUnitPrice(item);
                      const subtotal = unitPrice * Number(item.quantity || 0);

                      return (
                        <tr key={item.id || index} className="border-b last:border-0 align-top">
                          <td className="py-1.5 px-2">
                            <p className="font-medium break-words">{item.medicine?.name || "Obat"}</p>
                            <p className="text-[11px] text-muted-foreground break-words">{item.medicine?.generic_name || "-"}</p>
                          </td>
                          <td className="py-1.5 px-2 hidden lg:table-cell">
                            <p className="text-[11px] break-words">{item.dosage || "-"}</p>
                            <p className="text-[11px] text-muted-foreground break-words">{item.frequency || "-"} / {item.route || "-"} / {item.duration || "-"}</p>
                          </td>
                          <td className="py-1.5 px-2 hidden md:table-cell text-[11px] break-words">{item.instructions || item.notes || "-"}</td>
                          <td className="py-1.5 px-2 text-right font-medium whitespace-nowrap">{item.quantity} {item.unit}</td>
                          <td className="py-1.5 px-2 text-right font-medium hidden sm:table-cell whitespace-nowrap">{formatRupiah(unitPrice)}</td>
                          <td className="py-1.5 px-2 text-right font-medium whitespace-nowrap">{formatRupiah(subtotal)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="border-t bg-primary/5 px-3 py-2 flex items-center justify-end">
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">Grand Total</p>
                  <p className="text-base font-semibold text-primary">{formatRupiah(grandTotal)}</p>
                </div>
              </div>
            </div>

            {/* Review Form */}
            <div className="border border-border/70 bg-background mb-4">
              <div className="flex flex-wrap items-center justify-between border-b border-border/70 bg-muted/30 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                <span className="flex items-center gap-2">
                  <FileCheck className="h-3 w-3" />
                  Formulir Telaah Resep
                </span>
                {existingReview && (
                  <Badge variant="outline" className="text-[10px] h-5 px-1.5 py-0">
                    <Clock className="h-3 w-3 mr-1" />
                    Sudah ditelaah
                  </Badge>
                )}
              </div>
              <div className="p-3 space-y-4">
                {/* Checklist Items */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="drug_interaction"
                      checked={reviewForm.drug_interaction_check}
                      onCheckedChange={(checked) =>
                        setReviewForm({ ...reviewForm, drug_interaction_check: checked as boolean })
                      }
                      disabled={readOnly || isAlreadyReviewed}
                    />
                    <Label htmlFor="drug_interaction" className="text-xs">
                      Cek Interaksi Obat
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="dose_check"
                      checked={reviewForm.dose_check}
                      onCheckedChange={(checked) =>
                        setReviewForm({ ...reviewForm, dose_check: checked as boolean })
                      }
                      disabled={readOnly || isAlreadyReviewed}
                    />
                    <Label htmlFor="dose_check" className="text-xs">
                      Cek Dosis
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="duplication_check"
                      checked={reviewForm.duplication_check}
                      onCheckedChange={(checked) =>
                        setReviewForm({ ...reviewForm, duplication_check: checked as boolean })
                      }
                      disabled={readOnly || isAlreadyReviewed}
                    />
                    <Label htmlFor="duplication_check" className="text-xs">
                      Cek Duplikasi
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="allergy_check"
                      checked={reviewForm.allergy_check}
                      onCheckedChange={(checked) =>
                        setReviewForm({ ...reviewForm, allergy_check: checked as boolean })
                      }
                      disabled={readOnly || isAlreadyReviewed}
                    />
                    <Label htmlFor="allergy_check" className="text-xs">
                      Cek Alergi
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="contraindication_check"
                      checked={reviewForm.contraindication_check}
                      onCheckedChange={(checked) =>
                        setReviewForm({ ...reviewForm, contraindication_check: checked as boolean })
                      }
                      disabled={readOnly || isAlreadyReviewed}
                    />
                    <Label htmlFor="contraindication_check" className="text-xs">
                      Cek Kontraindikasi
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="indication_check"
                      checked={reviewForm.indication_check}
                      onCheckedChange={(checked) =>
                        setReviewForm({ ...reviewForm, indication_check: checked as boolean })
                      }
                      disabled={readOnly || isAlreadyReviewed}
                    />
                    <Label htmlFor="indication_check" className="text-xs">
                      Cek Indikasi
                    </Label>
                  </div>
                </div>

                <Separator />

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="warnings" className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-yellow-500" />
                      Peringatan (jika ada)
                    </Label>
                    <Textarea
                      id="warnings"
                      placeholder="Catatan peringatan untuk pasien..."
                      value={reviewForm.warnings}
                      onChange={(e) => setReviewForm({ ...reviewForm, warnings: e.target.value })}
                      rows={3}
                      disabled={readOnly || isAlreadyReviewed}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="suggestion">Saran untuk Dokter (jika perlu)</Label>
                    <Textarea
                      id="suggestion"
                      placeholder="Saran perubahan resep untuk dokter..."
                      value={reviewForm.suggestion}
                      onChange={(e) => setReviewForm({ ...reviewForm, suggestion: e.target.value })}
                      rows={3}
                      disabled={readOnly || isAlreadyReviewed}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="notes">Catatan Tambahan</Label>
                    <Textarea
                      id="notes"
                      placeholder="Catatan lainnya..."
                      value={reviewForm.notes}
                      onChange={(e) => setReviewForm({ ...reviewForm, notes: e.target.value })}
                      rows={3}
                      disabled={readOnly || isAlreadyReviewed}
                    />
                  </div>
                </div>

                <Separator />

                {/* Approval */}
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center space-x-2">
                      <Switch
                        id="requires_confirmation"
                        checked={reviewForm.requires_doctor_confirmation}
                        onCheckedChange={(checked) =>
                          setReviewForm({ ...reviewForm, requires_doctor_confirmation: checked })
                        }
                        disabled={!canReview}
                      />
                      <Label htmlFor="requires_confirmation" className="text-sm">
                        Perlu konfirmasi dokter
                      </Label>
                    </div>
                  </div>

                  {!allChecklistCompleted && !isAlreadyReviewed && (
                    <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 text-sm bg-amber-50 dark:bg-amber-950 p-2 rounded">
                      <AlertTriangle className="h-4 w-4" />
                      <span>Lengkapi semua checklist untuk dapat menyetujui resep</span>
                    </div>
                  )}

                  {isAlreadyReviewed && (
                    <div className="flex items-center gap-2 text-green-600 dark:text-green-400 text-sm bg-green-50 dark:bg-green-950 p-2 rounded">
                      <CheckCircle2 className="h-4 w-4" />
                      <span>Resep sudah ditelaah dan disetujui</span>
                    </div>
                  )}

                  {!hasDecided && allChecklistCompleted && !isAlreadyReviewed && !isAlreadyApproved && (
                    <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 text-sm bg-blue-50 dark:bg-blue-950 p-2 rounded">
                      <Clock className="h-4 w-4" />
                      <span>Pilih keputusan, lalu tekan Simpan di footer</span>
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="review-decision">Keputusan Telaah</Label>
                    <Select
                      value={reviewDecision}
                      onValueChange={(value) => {
                        setHasDecided(true);
                        setReviewForm((prev) => ({
                          ...prev,
                          is_approved: value === "approved",
                        }));
                      }}
                      disabled={!canReview || isAlreadyReviewed || isAlreadyApproved || submitting || readOnly}
                    >
                      <SelectTrigger id="review-decision">
                        <SelectValue placeholder="Pilih keputusan" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="approved" disabled={!allChecklistCompleted}>
                          Setuju
                        </SelectItem>
                        <SelectItem value="rejected">Tidak Setuju</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Gunakan tombol Simpan di footer untuk menyimpan telaah resep.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}      </div>
    </div>
  );
}
