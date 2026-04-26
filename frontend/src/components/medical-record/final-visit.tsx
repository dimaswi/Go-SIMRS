import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2,
  CheckCircle2,
  AlertCircle,
  XCircle,
} from "lucide-react";
import { visitsApi, medicineOrdersApi, procedureOrdersApi, medicalRecordsApi, visitProceduresApi } from "@/lib/api";
import type { MedicineOrder, ProcedureOrder } from "@/lib/api";
import type { MedicalRecordSummary } from "@/lib/api/medical-records";

const FOOTER_ACTION_EVENT = "medical-record-footer-action";

export type FinalVisitType = "pharmacy" | "radiology" | "laboratory" | "consultation" | "surgery";

interface FinalVisitProps {
  visitId: number;
  type: FinalVisitType;
  onVisitUpdate?: () => void;
}

interface Visit {
  id: number;
  visit_number: string;
  status: string;
  registration?: {
    status?: string;
  };
}

const getFinalizeBlockedMessage = (type: FinalVisitType) => {
  if (type === "pharmacy") {
    return "Semua obat harus diserahkan sebelum dapat menyelesaikan kunjungan";
  }
  if (type === "consultation") {
    return "Konsultasi harus dijawab sebelum dapat menyelesaikan kunjungan";
  }
  return "Semua tindakan harus selesai sebelum dapat menyelesaikan kunjungan";
};

const getTypeLabel = (type: FinalVisitType) => {
  switch (type) {
    case "pharmacy":
      return "Order Farmasi";
    case "radiology":
      return "Order Radiologi";
    case "laboratory":
      return "Order Laboratorium";
    case "consultation":
      return "Konsultasi";
    case "surgery":
      return "Operasi";
    default:
      return "Kunjungan";
  }
};

interface UseFinalVisitControllerOptions {
  visitId: number;
  type: FinalVisitType | null;
  onVisitUpdate?: () => void;
  enabled?: boolean;
}

export function useFinalVisitController({
  visitId,
  type,
  onVisitUpdate,
  enabled = true,
}: UseFinalVisitControllerOptions) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [visit, setVisit] = useState<Visit | null>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [canFinalize, setCanFinalize] = useState(false);
  const [isFinal, setIsFinal] = useState(false);

  const typeLabel = type ? getTypeLabel(type) : "Kunjungan";
  const blockedMessage = type ? getFinalizeBlockedMessage(type) : "";

  const loadData = useCallback(async () => {
    if (!enabled || !type || !visitId) {
      setVisit(null);
      setOrders([]);
      setCanFinalize(false);
      setIsFinal(false);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const visitRes = await visitsApi.getById(visitId);
      const visitData = visitRes.data;
      setVisit(visitData);
      setIsFinal(visitData.status === "completed");

      if (type === "pharmacy") {
        const ordersRes = await medicineOrdersApi.getAll({ pharmacy_visit_id: visitId });
        const ordersData = ordersRes.data || [];
        if (ordersData.length > 0) {
          setOrders(ordersData);

          const allDelivered = ordersData.every((o: MedicineOrder) => {
            if (o.status === "delivered" || o.status === "cancelled" || o.status === "returned") {
              return true;
            }
            if (o.items && o.items.length > 0) {
              return o.items.every((item: any) => item.status === "cancelled" || item.status === "delivered");
            }
            return false;
          });
          setCanFinalize(allDelivered);
          return;
        }

        const mrRes = await medicalRecordsApi.get(visitId);
        const summary = mrRes.data as MedicalRecordSummary;
        const directItems = (summary.visit_medicine_items || []).filter((item) => item.status !== "cancelled");

        setOrders(
          directItems.map((item) => ({
            id: item.id,
            order_number: item.medicine?.name || "Obat",
            status: item.status || "recorded",
          }))
        );
        setCanFinalize(directItems.length > 0);
        return;
      }

      if (type === "consultation") {
        try {
          const ordersRes = await procedureOrdersApi.getAll({
            target_visit_id: visitId,
            order_type: "consultation",
          });
          const ordersData = ordersRes.data || [];

          if (ordersData.length > 0) {
            setOrders(ordersData);
            const allCompleted = ordersData.every(
              (o: ProcedureOrder) =>
                o.status === "completed" ||
                o.status === "cancelled" ||
                (o.items && o.items.length > 0 && o.items.every((item) => item.status === "completed" || item.status === "cancelled"))
            );
            setCanFinalize(allCompleted);
            return;
          }

          const consultationRes = await medicalRecordsApi.getConsultation(visitId);
          const consultationData = consultationRes.data;
          if (consultationData && consultationData.id) {
            setOrders([{ id: consultationData.id, order_number: "Konsultasi", status: "completed" }]);
            setCanFinalize(true);
          } else {
            setOrders([]);
            setCanFinalize(false);
          }
        } catch {
          setOrders([]);
          setCanFinalize(false);
        }
        return;
      }

      if (type === "surgery") {
        const ordersRes = await procedureOrdersApi.getAll({ target_visit_id: visitId, order_type: "surgery" });
        const ordersData = ordersRes.data || [];
        if (ordersData.length > 0) {
          setOrders(ordersData);
          const allCompleted = ordersData.every(
            (o: ProcedureOrder) =>
              o.status === "completed" ||
              o.status === "cancelled" ||
              (o.items && o.items.every((item) => item.status === "completed" || item.status === "cancelled"))
          );
          setCanFinalize(allCompleted);
        } else {
          setOrders([]);
          setCanFinalize(false);
        }
        return;
      }

      const procedureType = type === "radiology" ? "radiology" : "laboratory";
      const ordersRes = await procedureOrdersApi.getAll({ target_visit_id: visitId, order_type: procedureType });
      const ordersData = ordersRes.data || [];
      if (ordersData.length > 0) {
        setOrders(ordersData);
        const allCompleted = ordersData.every(
          (o: ProcedureOrder) =>
            o.status === "completed" ||
            o.status === "cancelled" ||
            (o.items && o.items.every((item) => item.status === "completed" || item.status === "cancelled"))
        );
        setCanFinalize(allCompleted);
        return;
      }

      const proceduresRes = await visitProceduresApi.getAll(visitId);
      const directProcedures = (proceduresRes.data?.data || []).filter((item) => {
        if (item.status === "cancelled") {
          return false;
        }
        if (type === "radiology") {
          return item.procedure?.procedure_type === "radiology";
        }
        return item.procedure?.procedure_type === "laboratory";
      });

      setOrders(
        directProcedures.map((item) => ({
          id: item.id,
          order_number: item.procedure?.name || "Pemeriksaan",
          status: item.status,
        }))
      );
      setCanFinalize(
        directProcedures.length > 0 &&
          directProcedures.every((item) => item.status === "completed" || item.status === "cancelled")
      );
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
  }, [enabled, toast, type, visitId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    if (!enabled || !type) return;

    const handleRefresh = () => {
      void loadData();
    };

    window.addEventListener("refresh-print-options", handleRefresh);
    window.addEventListener("refresh-final-visit", handleRefresh);
    return () => {
      window.removeEventListener("refresh-print-options", handleRefresh);
      window.removeEventListener("refresh-final-visit", handleRefresh);
    };
  }, [enabled, loadData, type]);

  const handleFinalize = useCallback(async () => {
    if (!type || submitting) return false;
    if (isFinal) {
      toast({
        title: "Info",
        description: "Kunjungan sudah berstatus selesai.",
      });
      return false;
    }
    if (!canFinalize) {
      toast({
        variant: "destructive",
        title: "Error",
        description: getFinalizeBlockedMessage(type),
      });
      return false;
    }

    setSubmitting(true);
    try {
      await visitsApi.completeVisit(visitId);

      toast({
        title: "Berhasil",
        description: "Kunjungan berhasil diselesaikan",
      });

      await loadData();
      window.dispatchEvent(new CustomEvent("refresh-print-options"));
      if (onVisitUpdate) {
        onVisitUpdate();
      }
      return true;
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.response?.data?.error || "Gagal menyelesaikan kunjungan",
      });
      return false;
    } finally {
      setSubmitting(false);
    }
  }, [canFinalize, isFinal, loadData, onVisitUpdate, submitting, toast, type, visitId]);

  const handleCancelFinal = useCallback(async () => {
    if (!type) return false;
    if (visit?.registration?.status === "completed" || visit?.registration?.status === "discharged") {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Tidak dapat membatalkan final karena pasien sudah pulang",
      });
      return false;
    }

    setSubmitting(true);
    try {
      await visitsApi.cancelCompleteVisit(visitId);

      toast({
        title: "Berhasil",
        description: "Final kunjungan berhasil dibatalkan",
      });

      await loadData();
      window.dispatchEvent(new CustomEvent("refresh-print-options"));
      if (onVisitUpdate) {
        onVisitUpdate();
      }
      return true;
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.response?.data?.error || "Gagal membatalkan final kunjungan",
      });
      return false;
    } finally {
      setSubmitting(false);
    }
  }, [loadData, onVisitUpdate, toast, type, visit, visitId]);

  const isPatientDischarged = visit?.registration?.status === "completed" || visit?.registration?.status === "discharged";
  const canShowFinalizeAction = Boolean(type) && !loading && !isFinal && canFinalize;
  const canShowCancelAction = Boolean(type) && !loading && isFinal && !isPatientDischarged;

  return {
    loading,
    submitting,
    visit,
    orders,
    canFinalize,
    isFinal,
    typeLabel,
    blockedMessage,
    isPatientDischarged,
    canShowFinalizeAction,
    canShowCancelAction,
    loadData,
    handleFinalize,
    handleCancelFinal,
  };
}

export function FinalVisit({ visitId, type, onVisitUpdate }: FinalVisitProps) {
  const {
    loading,
    submitting,
    orders,
    canFinalize,
    isFinal,
    typeLabel,
    blockedMessage,
    isPatientDischarged,
    handleFinalize,
    handleCancelFinal,
  } = useFinalVisitController({ visitId, type, onVisitUpdate });

  const getFooterTabId = () => {
    switch (type) {
      case "pharmacy":
        return "pharmacy-final";
      case "radiology":
        return "radiology-final";
      case "laboratory":
        return "laboratory-final";
      case "consultation":
        return "consultation-final";
      case "surgery":
        return "surgery-final";
      default:
        return "";
    }
  };

  useEffect(() => {
    const handleFooterAction = (event: Event) => {
      const customEvent = event as CustomEvent<{
        tabId: string;
        action: "save" | "final";
        handled: boolean;
      }>;
      if (customEvent.detail?.tabId !== getFooterTabId()) return;
      customEvent.detail.handled = true;
      void handleFinalize();
    };

    window.addEventListener(FOOTER_ACTION_EVENT, handleFooterAction as EventListener);
    return () => {
      window.removeEventListener(FOOTER_ACTION_EVENT, handleFooterAction as EventListener);
    };
  }, [handleFinalize, isFinal, type]);

  const getOrderStatusLabel = (status: string) => {
    const labels: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
      pending: { label: "Menunggu", variant: "secondary" },
      reviewed: { label: "Ditelaah", variant: "default" },
      preparing: { label: "Disiapkan", variant: "default" },
      ready: { label: "Siap", variant: "default" },
      delivered: { label: "Diserahkan", variant: "default" },
      completed: { label: "Selesai", variant: "default" },
      cancelled: { label: "Dibatalkan", variant: "destructive" },
      returned: { label: "Return", variant: "outline" },
      in_progress: { label: "Proses", variant: "default" },
    };
    return labels[status] || { label: status, variant: "secondary" };
  };

  if (loading) {
    return (
      <div>
        <div className="p-3 sm:p-4">
          <div className="flex items-center justify-center py-8 gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-muted-foreground">Memuat data...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="space-y-4 p-3 sm:p-4">
        {/* Status */}
        <div className="border rounded-lg p-4 bg-muted/30">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm font-medium">Status Kunjungan</span>
            {isFinal ? (
              <Badge variant="default" className="bg-green-600">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                Selesai
              </Badge>
            ) : (
              <Badge variant="secondary">
                <AlertCircle className="h-3 w-3 mr-1" />
                Belum Selesai
              </Badge>
            )}
          </div>

          {/* Orders Summary */}
          <div className="space-y-2">
            <span className="text-sm font-medium">Ringkasan Order:</span>
            {orders.length === 0 ? (
              <p className="text-sm text-muted-foreground">Tidak ada order</p>
            ) : (
              <div className="space-y-1">
                {orders.map((order: any) => (
                  <div key={order.id} className="flex flex-wrap items-center justify-between gap-2 text-sm bg-background p-2 rounded">
                    <span>{order.order_number}</span>
                    <Badge variant={getOrderStatusLabel(order.status).variant}>
                      {getOrderStatusLabel(order.status).label}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        {!isFinal && (
          <>
            {!canFinalize && (
              <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 text-sm bg-amber-50 dark:bg-amber-950 p-3 rounded">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                <span>
                  {type === "pharmacy" 
                    ? blockedMessage
                    : blockedMessage
                  }
                </span>
              </div>
            )}
            <div className="rounded border border-dashed px-3 py-2 text-sm text-muted-foreground">
              Gunakan tombol Final di footer untuk menyelesaikan kunjungan {typeLabel}.
            </div>
          </>
        )}

        {isFinal && (
          <>
            <div className="flex items-center gap-2 text-green-600 dark:text-green-400 text-sm bg-green-50 dark:bg-green-950 p-3 rounded">
              <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
              <span>Kunjungan {typeLabel} telah diselesaikan</span>
            </div>

            {/* Cancel Final Button - only show if patient not discharged */}
            {!isPatientDischarged && (
              <Button
                variant="destructive"
                className="w-full"
                onClick={handleCancelFinal}
                disabled={submitting}
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Memproses...
                  </>
                ) : (
                  <>
                    <XCircle className="h-4 w-4 mr-2" />
                    Batalkan Final
                  </>
                )}
              </Button>
            )}

            {isPatientDischarged && (
              <div className="flex items-center gap-2 text-muted-foreground text-sm bg-muted p-3 rounded">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                <span>Final tidak dapat dibatalkan karena pasien sudah pulang</span>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
