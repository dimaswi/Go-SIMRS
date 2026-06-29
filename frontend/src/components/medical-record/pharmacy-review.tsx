import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { usePermission } from "@/hooks/usePermission";
import {
  CheckCircle2,
  Clock,
  FileCheck,
  Loader2,
  Pill,
} from "lucide-react";
import { medicineOrdersApi } from "@/lib/api";
import type {
  MedicineOrder,
  PrescriptionReview,
} from "@/lib/api";
import { getPharmacyOrderStatusMeta } from "./pharmacy-status";

const FOOTER_ACTION_EVENT = "medical-record-footer-action";
const PHARMACY_REVIEW_REQUEST_EVENT = "pharmacy-review-request";
const PHARMACY_FINAL_REVIEW_SAVED_EVENT = "pharmacy-final-review-saved";

interface PharmacyReviewProps {
  visitId: number;
  readOnly?: boolean;
  onInitialReviewSaved?: () => void;
}

type ReviewFormState = {
  patient_identity_check: boolean;
  doctor_name_sign_check: boolean;
  prescription_date_check: boolean;
  medicine_data_check: boolean;
  dose_check: boolean;
  administration_route_check: boolean;
  drug_interaction_check: boolean;
  duplication_check: boolean;
  contraindication_check: boolean;
  allergy_check: boolean;
  final_patient_check: boolean;
  final_medicine_check: boolean;
  final_dose_check: boolean;
  final_time_check: boolean;
  final_route_check: boolean;
  pio_name_check: boolean;
  pio_usage_check: boolean;
  pio_benefit_check: boolean;
  pio_storage_check: boolean;
  pio_other_check: boolean;
};

const createDefaultForm = (): ReviewFormState => ({
  patient_identity_check: false,
  doctor_name_sign_check: false,
  prescription_date_check: false,
  medicine_data_check: false,
  dose_check: false,
  administration_route_check: false,
  drug_interaction_check: false,
  duplication_check: false,
  contraindication_check: false,
  allergy_check: false,
  final_patient_check: false,
  final_medicine_check: false,
  final_dose_check: false,
  final_time_check: false,
  final_route_check: false,
  pio_name_check: false,
  pio_usage_check: false,
  pio_benefit_check: false,
  pio_storage_check: false,
  pio_other_check: false,
});

const formatRupiah = (value: number) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Number.isFinite(value) ? value : 0);

const getUnitPrice = (item: any): number =>
  Number(item?.unit_price ?? item?.price ?? item?.medicine?.selling_price ?? 0);

export function PharmacyReview({
  visitId,
  readOnly = false,
  onInitialReviewSaved,
}: PharmacyReviewProps) {
  const { toast } = useToast();
  const { hasPermission } = usePermission();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [orders, setOrders] = useState<MedicineOrder[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<MedicineOrder | null>(null);
  const [existingReview, setExistingReview] = useState<PrescriptionReview | null>(null);
  const [initialModalOpen, setInitialModalOpen] = useState(false);
  const [finalModalOpen, setFinalModalOpen] = useState(false);
  const [_initialModalLocked, setInitialModalLocked] = useState(false);
  const [pendingFinalReviewToken, setPendingFinalReviewToken] = useState<string | null>(null);
  const [reviewForm, setReviewForm] = useState<ReviewFormState>(createDefaultForm());

  const canReview = hasPermission("pharmacy.review");
  const activeItems = selectedOrder?.items?.filter((item) => item.status !== "cancelled") || [];
  const grandTotal = activeItems.reduce(
    (total, item) => total + getUnitPrice(item) * Number(item.quantity || 0),
    0,
  );
  const patient =
    selectedOrder?.source_visit?.registration?.patient || selectedOrder?.registration?.patient;

  const initialReviewCompleted = existingReview?.initial_review_completed || false;
  const finalReviewCompleted = existingReview?.final_review_completed || false;

  const initialLocked =
    readOnly ||
    initialReviewCompleted ||
    selectedOrder?.status === "reviewed" ||
    selectedOrder?.status === "preparing" ||
    selectedOrder?.status === "partial" ||
    selectedOrder?.status === "ready" ||
    selectedOrder?.status === "delivered" ||
    selectedOrder?.status === "completed";
  const finalLocked =
    readOnly || selectedOrder?.status === "delivered" || selectedOrder?.status === "completed";

  const initialChecklistCompleted = useMemo(
    () =>
      reviewForm.patient_identity_check &&
      reviewForm.doctor_name_sign_check &&
      reviewForm.prescription_date_check &&
      reviewForm.medicine_data_check &&
      reviewForm.dose_check &&
      reviewForm.administration_route_check &&
      reviewForm.drug_interaction_check &&
      reviewForm.duplication_check &&
      reviewForm.contraindication_check &&
      reviewForm.allergy_check,
    [reviewForm],
  );

  const finalVerificationCompleted = useMemo(
    () =>
      reviewForm.final_patient_check &&
      reviewForm.final_medicine_check &&
      reviewForm.final_dose_check &&
      reviewForm.final_time_check &&
      reviewForm.final_route_check,
    [reviewForm],
  );

  const pioCompleted = useMemo(
    () =>
      reviewForm.pio_name_check ||
      reviewForm.pio_usage_check ||
      reviewForm.pio_benefit_check ||
      reviewForm.pio_storage_check ||
      reviewForm.pio_other_check,
    [reviewForm],
  );

  useEffect(() => {
    void loadOrders();
  }, [visitId]);

  useEffect(() => {
    const handleRefreshOrders = () => {
      void loadOrders({
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
    if (!selectedOrder) return;
    void loadReview(selectedOrder.id);
  }, [selectedOrder]);

  useEffect(() => {
    const handleFooterAction = (event: Event) => {
      const customEvent = event as CustomEvent<{
        tabId: string;
        action: "save" | "final";
        handled: boolean;
      }>;
      if (customEvent.detail?.tabId !== "prescription-review") return;
      customEvent.detail.handled = true;

      if (!selectedOrder) {
        toast({
          variant: "destructive",
          title: "Error",
          description: "Tidak ada order obat yang dapat ditelaah.",
        });
        return;
      }

      if (!initialReviewCompleted) {
        setInitialModalOpen(true);
        return;
      }

      setFinalModalOpen(true);
    };

    window.addEventListener(FOOTER_ACTION_EVENT, handleFooterAction as EventListener);
    return () => {
      window.removeEventListener(FOOTER_ACTION_EVENT, handleFooterAction as EventListener);
    };
  }, [selectedOrder, toast, initialReviewCompleted]);

  useEffect(() => {
    const handleReviewRequest = (event: Event) => {
      const customEvent = event as CustomEvent<{
        mode?: "initial" | "final";
        lock?: boolean;
        token?: string;
      }>;
      const mode = customEvent.detail?.mode || "initial";
      if (mode === "final" && initialReviewCompleted) {
        setInitialModalLocked(false);
        setPendingFinalReviewToken(customEvent.detail?.token || null);
        setFinalModalOpen(true);
        return;
      }
      setInitialModalLocked(customEvent.detail?.lock === true);
      setPendingFinalReviewToken(null);
      setInitialModalOpen(true);
    };

    window.addEventListener(PHARMACY_REVIEW_REQUEST_EVENT, handleReviewRequest as EventListener);
    return () => {
      window.removeEventListener(
        PHARMACY_REVIEW_REQUEST_EVENT,
        handleReviewRequest as EventListener,
      );
    };
  }, [initialReviewCompleted]);

  const loadOrders = async (options?: { silent?: boolean; preferredOrderId?: number }) => {
    if (!options?.silent) {
      setLoading(true);
    }
    try {
      const res = await medicineOrdersApi.getAll({ pharmacy_visit_id: visitId });
      const data = res.data || [];
      setOrders(data);
      if (data.length === 0) {
        setSelectedOrder(null);
        setExistingReview(null);
        setReviewForm(createDefaultForm());
        return;
      }
      const nextSelectedOrder =
        data.find((order) => order.id === options?.preferredOrderId) || data[0];
      setSelectedOrder(nextSelectedOrder);
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
      if (review && review.id) {
        setExistingReview(review);
        setReviewForm({
          patient_identity_check: review.patient_identity_check || false,
          doctor_name_sign_check: review.doctor_name_sign_check || false,
          prescription_date_check: review.prescription_date_check || false,
          medicine_data_check: review.medicine_data_check || false,
          dose_check: review.dose_check || false,
          administration_route_check: review.administration_route_check || false,
          drug_interaction_check: review.drug_interaction_check || false,
          duplication_check: review.duplication_check || false,
          contraindication_check: review.contraindication_check || false,
          allergy_check: review.allergy_check || false,
          final_patient_check: review.final_patient_check || false,
          final_medicine_check: review.final_medicine_check || false,
          final_dose_check: review.final_dose_check || false,
          final_time_check: review.final_time_check || false,
          final_route_check: review.final_route_check || false,
          pio_name_check: review.pio_name_check || false,
          pio_usage_check: review.pio_usage_check || false,
          pio_benefit_check: review.pio_benefit_check || false,
          pio_storage_check: review.pio_storage_check || false,
          pio_other_check: review.pio_other_check || false,
        });
      } else {
        setExistingReview(null);
        setReviewForm(createDefaultForm());
      }
    } catch {
      setExistingReview(null);
      setReviewForm(createDefaultForm());
    }
  };

  const submitReview = async (
    payload: Parameters<typeof medicineOrdersApi.submitReview>[1],
    successDescription: string,
    onCommitted?: () => void,
  ) => {
    if (!selectedOrder || submitting || readOnly || !canReview) return false;

    setSubmitting(true);
    try {
      const orderId = selectedOrder.id;
      await medicineOrdersApi.submitReview(orderId, payload);
      toast({
        title: "Berhasil",
        description: successDescription,
      });
      onCommitted?.();
      void loadOrders({ preferredOrderId: orderId });
      void loadReview(orderId);
      window.dispatchEvent(new CustomEvent("refresh-print-options"));
      window.dispatchEvent(new CustomEvent("refresh-final-visit"));
      return true;
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.response?.data?.error || "Gagal menyimpan telaah resep",
      });
      return false;
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitInitialReview = async () => {
    if (!initialChecklistCompleted) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Semua checklist Telaah Awal wajib dicentang.",
      });
      return;
    }

    const success = await submitReview(
      {
        patient_identity_check: reviewForm.patient_identity_check,
        doctor_name_sign_check: reviewForm.doctor_name_sign_check,
        prescription_date_check: reviewForm.prescription_date_check,
        medicine_data_check: reviewForm.medicine_data_check,
        dose_check: reviewForm.dose_check,
        administration_route_check: reviewForm.administration_route_check,
        drug_interaction_check: reviewForm.drug_interaction_check,
        duplication_check: reviewForm.duplication_check,
        contraindication_check: reviewForm.contraindication_check,
        allergy_check: reviewForm.allergy_check,
        is_approved: true,
      },
      "Telaah Awal berhasil disimpan.",
      () => {
        setInitialModalLocked(false);
        setInitialModalOpen(false);
      },
    );
    if (success) {
      onInitialReviewSaved?.();
    }
  };

  const handleSubmitFinalReview = async () => {
    if (!initialReviewCompleted) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Telaah akhir hanya bisa diisi setelah telaah awal selesai.",
      });
      return;
    }
    if (!finalVerificationCompleted) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Lengkapi semua checklist Verifikasi Akhir.",
      });
      return;
    }
    if (!pioCompleted) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Checklist PIO minimal 1 item wajib dipilih.",
      });
      return;
    }

    const success = await submitReview(
      {
        final_patient_check: reviewForm.final_patient_check,
        final_medicine_check: reviewForm.final_medicine_check,
        final_dose_check: reviewForm.final_dose_check,
        final_time_check: reviewForm.final_time_check,
        final_route_check: reviewForm.final_route_check,
        pio_name_check: reviewForm.pio_name_check,
        pio_usage_check: reviewForm.pio_usage_check,
        pio_benefit_check: reviewForm.pio_benefit_check,
        pio_storage_check: reviewForm.pio_storage_check,
        pio_other_check: reviewForm.pio_other_check,
      },
      "Telaah Akhir berhasil disimpan.",
      () => {
        setPendingFinalReviewToken(null);
        setFinalModalOpen(false);
      },
    );
    if (success) {
      const completedToken = pendingFinalReviewToken;
      const completedOrderId = selectedOrder?.id;
      if (completedToken && completedOrderId) {
        window.setTimeout(() => {
          window.dispatchEvent(
            new CustomEvent(PHARMACY_FINAL_REVIEW_SAVED_EVENT, {
              detail: { token: completedToken, orderId: completedOrderId },
            }),
          );
        }, 220);
      }
    }
  };

  const setAllInitialChecklist = (checked: boolean) => {
    setReviewForm((prev) => ({
      ...prev,
      patient_identity_check: checked,
      doctor_name_sign_check: checked,
      prescription_date_check: checked,
      medicine_data_check: checked,
      dose_check: checked,
      administration_route_check: checked,
      drug_interaction_check: checked,
      duplication_check: checked,
      contraindication_check: checked,
      allergy_check: checked,
    }));
  };

  const setAllFinalChecklist = (checked: boolean) => {
    setReviewForm((prev) => ({
      ...prev,
      final_patient_check: checked,
      final_medicine_check: checked,
      final_dose_check: checked,
      final_time_check: checked,
      final_route_check: checked,
      pio_name_check: checked,
      pio_usage_check: checked,
      pio_benefit_check: checked,
      pio_storage_check: checked,
      pio_other_check: checked,
    }));
  };

  const renderMedicineListPanel = () => (
    <div className="flex min-h-0 flex-col rounded border border-border/70 bg-background">
      <div className="flex items-center justify-between border-b border-border/70 bg-muted/30 px-3 py-2">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          List Obat ({activeItems.length})
        </p>
        <Badge
          variant={getPharmacyOrderStatusMeta(selectedOrder?.status || "pending").variant}
          className={`h-5 px-1.5 py-0 text-[10px] ${getPharmacyOrderStatusMeta(selectedOrder?.status || "pending").className}`}
        >
          {getPharmacyOrderStatusMeta(selectedOrder?.status || "pending").label}
        </Badge>
      </div>

      <div className="overflow-auto">
        <table className="w-full table-fixed text-xs">
          <thead className="bg-muted/40">
            <tr>
              <th className="w-[35%] px-2 py-1.5 text-left font-medium">Obat</th>
              <th className="w-[25%] px-2 py-1.5 text-left font-medium">Aturan</th>
              <th className="w-[12%] px-2 py-1.5 text-right font-medium">Jumlah</th>
              <th className="w-[14%] px-2 py-1.5 text-right font-medium">Harga</th>
              <th className="w-[14%] px-2 py-1.5 text-right font-medium">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            {activeItems.map((item, index) => {
              const unitPrice = getUnitPrice(item);
              const subtotal = unitPrice * Number(item.quantity || 0);
              return (
                <tr key={item.id || index} className="border-b align-top last:border-0">
                  <td className="px-2 py-1.5">
                    <p className="break-words font-medium">{item.medicine?.name || "Obat"}</p>
                    <p className="break-words text-[11px] text-muted-foreground">
                      {item.medicine?.generic_name || "-"}
                    </p>
                    <p className="mt-1 break-words text-[11px] text-muted-foreground">
                      {item.instructions || item.notes || "-"}
                    </p>
                  </td>
                  <td className="px-2 py-1.5">
                    <p className="break-words text-[11px]">{item.dosage || "-"}</p>
                    <p className="break-words text-[11px] text-muted-foreground">
                      {item.frequency || "-"} / {item.route || "-"} / {item.duration || "-"}
                    </p>
                  </td>
                  <td className="whitespace-nowrap px-2 py-1.5 text-right font-medium">
                    {item.quantity} {item.unit}
                  </td>
                  <td className="whitespace-nowrap px-2 py-1.5 text-right font-medium">
                    {formatRupiah(unitPrice)}
                  </td>
                  <td className="whitespace-nowrap px-2 py-1.5 text-right font-medium">
                    {formatRupiah(subtotal)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-auto border-t bg-primary/5 px-3 py-2 text-right">
        <p className="text-xs text-muted-foreground">Grand Total</p>
        <p className="text-base font-semibold text-primary">{formatRupiah(grandTotal)}</p>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="p-4">
        <div className="flex items-center justify-center gap-2 py-8">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-muted-foreground">Memuat data...</span>
        </div>
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="p-4">
        <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
          <Pill className="mb-4 h-12 w-12 opacity-50" />
          <p>Tidak ada order obat untuk visit ini</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {orders.length > 1 && (
        <div className="border border-border/70 bg-background p-3">
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
      )}

      <div className="border border-dashed bg-background p-8">
        <div className="mx-auto flex max-w-xl flex-col items-center gap-3 text-center">
          <FileCheck className="h-10 w-10 text-muted-foreground" />
          {!initialReviewCompleted ? (
            <>
              <p className="text-base font-semibold">Telaah Awal belum diselesaikan</p>
              <p className="text-sm text-muted-foreground">
                Checklist Telaah Awal wajib diselesaikan dahulu sebelum proses farmasi berikutnya.
              </p>
              <Button
                size="sm"
                className="rounded-none"
                onClick={() => setInitialModalOpen(true)}
                disabled={readOnly || !canReview}
              >
                Buka Modal Telaah Awal
              </Button>
            </>
          ) : (
            <>
              <p className="text-base font-semibold">
                Telaah Awal selesai{finalReviewCompleted ? " dan Telaah Akhir sudah lengkap" : ""}
              </p>
              <p className="text-sm text-muted-foreground">
                {!finalReviewCompleted
                  ? "Telaah Akhir akan muncul dari tombol footer saat proses penyerahan obat."
                  : "Data telaah sudah lengkap dan siap untuk proses penyerahan obat."}
              </p>
            </>
          )}
        </div>
      </div>

      <Dialog
        open={initialModalOpen}
        onOpenChange={(open) => {
          setInitialModalOpen(open);
        }}
      >
        <DialogContent
          className="w-[calc(100vw-1rem)] sm:max-w-[96vw] 2xl:max-w-[1400px] max-h-[94vh] overflow-hidden"
        >
          <DialogHeader>
            <DialogTitle>Telaah Awal Resep</DialogTitle>
            <DialogDescription>
              Lengkapi checklist Telaah Awal sebelum melanjutkan proses farmasi.
            </DialogDescription>
          </DialogHeader>

          <div className="grid min-h-0 grid-cols-3 gap-4">
            <div className="col-span-2 min-h-0 max-h-[62vh] min-w-0">
              {renderMedicineListPanel()}
            </div>
            <div className="col-span-1 space-y-3 rounded border border-border/60 p-3 max-h-[62vh] overflow-y-auto min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Checklist Telaah Awal</p>
              <div className="rounded border border-border/60 bg-muted/20 p-2 text-xs">
                <p><span className="text-muted-foreground">Nama Pasien:</span> {patient?.nama_lengkap || "-"}</p>
                <p><span className="text-muted-foreground">No. RM:</span> {patient?.no_rm || "-"}</p>
                <p><span className="text-muted-foreground">Order:</span> {selectedOrder?.order_number || "-"}</p>
                <p><span className="text-muted-foreground">Dokter:</span> {selectedOrder?.prescriber?.nama_lengkap || "-"}</p>
              </div>
              <div className="flex justify-end">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 rounded-none px-2 text-xs"
                  onClick={() => setAllInitialChecklist(!initialChecklistCompleted)}
                  disabled={initialLocked || !canReview}
                >
                  {initialChecklistCompleted ? "Hapus Semua" : "Checklist Semua"}
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="flex items-center gap-2"><Checkbox checked={reviewForm.patient_identity_check} onCheckedChange={(v) => setReviewForm((p) => ({ ...p, patient_identity_check: v === true }))} disabled={initialLocked} /><Label className="text-xs">Lengkap Identitas Pasien</Label></div>
                <div className="flex items-center gap-2"><Checkbox checked={reviewForm.doctor_name_sign_check} onCheckedChange={(v) => setReviewForm((p) => ({ ...p, doctor_name_sign_check: v === true }))} disabled={initialLocked} /><Label className="text-xs">Lengkap Nama & Paraf Dokter</Label></div>
                <div className="flex items-center gap-2"><Checkbox checked={reviewForm.prescription_date_check} onCheckedChange={(v) => setReviewForm((p) => ({ ...p, prescription_date_check: v === true }))} disabled={initialLocked} /><Label className="text-xs">Tanggal Resep</Label></div>
                <div className="flex items-center gap-2"><Checkbox checked={reviewForm.medicine_data_check} onCheckedChange={(v) => setReviewForm((p) => ({ ...p, medicine_data_check: v === true }))} disabled={initialLocked} /><Label className="text-xs">Nama Obat, Bentuk & Kekuatan Sediaan</Label></div>
                <div className="flex items-center gap-2"><Checkbox checked={reviewForm.dose_check} onCheckedChange={(v) => setReviewForm((p) => ({ ...p, dose_check: v === true }))} disabled={initialLocked} /><Label className="text-xs">Dosis & Jumlah Obat</Label></div>
                <div className="flex items-center gap-2"><Checkbox checked={reviewForm.administration_route_check} onCheckedChange={(v) => setReviewForm((p) => ({ ...p, administration_route_check: v === true }))} disabled={initialLocked} /><Label className="text-xs">Cara Pemakaian</Label></div>
                <div className="flex items-center gap-2"><Checkbox checked={reviewForm.drug_interaction_check} onCheckedChange={(v) => setReviewForm((p) => ({ ...p, drug_interaction_check: v === true }))} disabled={initialLocked} /><Label className="text-xs">Interaksi Obat</Label></div>
                <div className="flex items-center gap-2"><Checkbox checked={reviewForm.duplication_check} onCheckedChange={(v) => setReviewForm((p) => ({ ...p, duplication_check: v === true }))} disabled={initialLocked} /><Label className="text-xs">Duplikasi</Label></div>
                <div className="flex items-center gap-2"><Checkbox checked={reviewForm.contraindication_check} onCheckedChange={(v) => setReviewForm((p) => ({ ...p, contraindication_check: v === true }))} disabled={initialLocked} /><Label className="text-xs">Kontra Indikasi</Label></div>
                <div className="flex items-center gap-2"><Checkbox checked={reviewForm.allergy_check} onCheckedChange={(v) => setReviewForm((p) => ({ ...p, allergy_check: v === true }))} disabled={initialLocked} /><Label className="text-xs">Alergi / Reaksi Obat Tidak Diinginkan</Label></div>
              </div>
              {/* {!initialChecklistCompleted && !initialLocked && (
                <p className="rounded bg-amber-50 p-2 text-sm text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                  Semua checklist Telaah Awal wajib dicentang.
                </p>
              )} */}
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" className="rounded-none" onClick={() => setInitialModalOpen(false)}>
              Tutup
            </Button>
            <Button type="button" className="rounded-none" onClick={handleSubmitInitialReview} disabled={submitting || initialLocked || !canReview}>
              {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
              Simpan Telaah Awal
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={finalModalOpen} onOpenChange={setFinalModalOpen}>
        <DialogContent className="w-[calc(100vw-1rem)] sm:max-w-[96vw] 2xl:max-w-[1400px] max-h-[94vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle>Telaah Akhir</DialogTitle>
            <DialogDescription>
              Lengkapi Verifikasi Akhir dan PIO sebelum obat diserahkan.
            </DialogDescription>
          </DialogHeader>

          <div className="grid min-h-0 grid-cols-3 gap-4">
            <div className="col-span-2 min-h-0 max-h-[62vh] min-w-0">
              {renderMedicineListPanel()}
            </div>
            <div className="col-span-1 space-y-3 rounded border border-border/60 p-3 max-h-[62vh] overflow-y-auto min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Checklist Telaah Akhir</p>
              <div className="rounded border border-border/60 bg-muted/20 p-2 text-xs">
                <p><span className="text-muted-foreground">Nama Pasien:</span> {patient?.nama_lengkap || "-"}</p>
                <p><span className="text-muted-foreground">No. RM:</span> {patient?.no_rm || "-"}</p>
                <p><span className="text-muted-foreground">Order:</span> {selectedOrder?.order_number || "-"}</p>
                <p><span className="text-muted-foreground">Dokter:</span> {selectedOrder?.prescriber?.nama_lengkap || "-"}</p>
              </div>
              <div className="flex justify-end">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 rounded-none px-2 text-xs"
                  onClick={() => setAllFinalChecklist(!(finalVerificationCompleted && pioCompleted))}
                  disabled={finalLocked || !canReview || !initialReviewCompleted}
                >
                  {finalVerificationCompleted && pioCompleted ? "Hapus Semua" : "Checklist Semua"}
                </Button>
              </div>
              <div className="text-xs font-medium text-muted-foreground">Verifikasi Akhir</div>
              <div className="grid grid-cols-2 gap-2">
                <div className="flex items-center gap-2"><Checkbox checked={reviewForm.final_patient_check} onCheckedChange={(v) => setReviewForm((p) => ({ ...p, final_patient_check: v === true }))} disabled={finalLocked || !initialReviewCompleted} /><Label className="text-xs">Benar Pasien</Label></div>
                <div className="flex items-center gap-2"><Checkbox checked={reviewForm.final_medicine_check} onCheckedChange={(v) => setReviewForm((p) => ({ ...p, final_medicine_check: v === true }))} disabled={finalLocked || !initialReviewCompleted} /><Label className="text-xs">Benar Obat</Label></div>
                <div className="flex items-center gap-2"><Checkbox checked={reviewForm.final_dose_check} onCheckedChange={(v) => setReviewForm((p) => ({ ...p, final_dose_check: v === true }))} disabled={finalLocked || !initialReviewCompleted} /><Label className="text-xs">Benar Dosis</Label></div>
                <div className="flex items-center gap-2"><Checkbox checked={reviewForm.final_time_check} onCheckedChange={(v) => setReviewForm((p) => ({ ...p, final_time_check: v === true }))} disabled={finalLocked || !initialReviewCompleted} /><Label className="text-xs">Benar Waktu Pemberian</Label></div>
                <div className="flex items-center gap-2"><Checkbox checked={reviewForm.final_route_check} onCheckedChange={(v) => setReviewForm((p) => ({ ...p, final_route_check: v === true }))} disabled={finalLocked || !initialReviewCompleted} /><Label className="text-xs">Benar Rute Pemberian</Label></div>
              </div>

              <div className="pt-2 text-xs font-medium text-muted-foreground">PIO</div>
              <div className="grid grid-cols-2 gap-2">
                <div className="flex items-center gap-2"><Checkbox checked={reviewForm.pio_name_check} onCheckedChange={(v) => setReviewForm((p) => ({ ...p, pio_name_check: v === true }))} disabled={finalLocked || !initialReviewCompleted} /><Label className="text-xs">Nama Obat</Label></div>
                <div className="flex items-center gap-2"><Checkbox checked={reviewForm.pio_usage_check} onCheckedChange={(v) => setReviewForm((p) => ({ ...p, pio_usage_check: v === true }))} disabled={finalLocked || !initialReviewCompleted} /><Label className="text-xs">Cara Pakai</Label></div>
                <div className="flex items-center gap-2"><Checkbox checked={reviewForm.pio_benefit_check} onCheckedChange={(v) => setReviewForm((p) => ({ ...p, pio_benefit_check: v === true }))} disabled={finalLocked || !initialReviewCompleted} /><Label className="text-xs">Kegunaan</Label></div>
                <div className="flex items-center gap-2"><Checkbox checked={reviewForm.pio_storage_check} onCheckedChange={(v) => setReviewForm((p) => ({ ...p, pio_storage_check: v === true }))} disabled={finalLocked || !initialReviewCompleted} /><Label className="text-xs">Penyimpanan</Label></div>
                <div className="flex items-center gap-2"><Checkbox checked={reviewForm.pio_other_check} onCheckedChange={(v) => setReviewForm((p) => ({ ...p, pio_other_check: v === true }))} disabled={finalLocked || !initialReviewCompleted} /><Label className="text-xs">Lain-lain</Label></div>
              </div>

              {initialReviewCompleted && (!finalVerificationCompleted || !pioCompleted) && !finalLocked && (
                <div className="flex items-center gap-2 rounded bg-blue-50 p-2 text-sm text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                  <Clock className="h-4 w-4" />
                  <span>Lengkapi Verifikasi Akhir (semua) dan checklist PIO (minimal 1).</span>
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" className="rounded-none" onClick={() => setFinalModalOpen(false)}>
              Tutup
            </Button>
            <Button type="button" className="rounded-none" onClick={handleSubmitFinalReview} disabled={submitting || finalLocked || !canReview || !initialReviewCompleted}>
              {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
              Simpan Telaah Akhir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="flex flex-wrap items-center gap-2">
        <Badge
          variant={getPharmacyOrderStatusMeta(selectedOrder?.status || "pending").variant}
          className={getPharmacyOrderStatusMeta(selectedOrder?.status || "pending").className}
        >
          {getPharmacyOrderStatusMeta(selectedOrder?.status || "pending").label}
        </Badge>
        {initialReviewCompleted && (
          <Badge variant="outline">
            <CheckCircle2 className="mr-1 h-3 w-3" />
            Telaah Awal Selesai
          </Badge>
        )}
        {finalReviewCompleted && (
          <Badge variant="outline">
            <CheckCircle2 className="mr-1 h-3 w-3" />
            Telaah Akhir Selesai
          </Badge>
        )}
      </div>
    </div>
  );
}
