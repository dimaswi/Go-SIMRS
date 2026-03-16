import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { usePermission } from "@/hooks/usePermission";
import {
  Loader2,
  CheckCircle2,
  AlertCircle,
  XCircle,
} from "lucide-react";
import { visitsApi, medicineOrdersApi, procedureOrdersApi, medicalRecordsApi } from "@/lib/api";
import type { MedicineOrder, ProcedureOrder } from "@/lib/api";

interface FinalVisitProps {
  visitId: number;
  type: "pharmacy" | "radiology" | "laboratory" | "consultation" | "surgery";
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

export function FinalVisit({ visitId, type, onVisitUpdate }: FinalVisitProps) {
  const { toast } = useToast();
  const { hasPermission } = usePermission();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [visit, setVisit] = useState<Visit | null>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [canFinalize, setCanFinalize] = useState(false);
  const [isFinal, setIsFinal] = useState(false);

  const permission = type === "pharmacy" ? "pharmacy.final" : "procedure_orders.final";

  useEffect(() => {
    loadData();
  }, [visitId, type]);

  // Listen for refresh events from other components
  useEffect(() => {
    const handleRefresh = () => {
      loadData();
    };
    
    window.addEventListener("refresh-print-options", handleRefresh);
    window.addEventListener("refresh-final-visit", handleRefresh);
    return () => {
      window.removeEventListener("refresh-print-options", handleRefresh);
      window.removeEventListener("refresh-final-visit", handleRefresh);
    };
  }, [visitId, type]);

  const loadData = async () => {
    setLoading(true);
    try {
      // Load visit data
      const visitRes = await visitsApi.getById(visitId);
      const visitData = visitRes.data;
      setVisit(visitData);

      // Check if already finalized
      setIsFinal(visitData.status === "completed");

      // Load orders based on type
      if (type === "pharmacy") {
        const ordersRes = await medicineOrdersApi.getAll({ pharmacy_visit_id: visitId });
        const ordersData = ordersRes.data || [];
        setOrders(ordersData);
        
        // Can finalize if all orders are delivered/cancelled/returned
        // OR if all items in each order are cancelled/delivered
        const allDelivered = ordersData.length > 0 && 
          ordersData.every((o: MedicineOrder) => {
            // Order sudah delivered/cancelled/returned
            if (o.status === "delivered" || o.status === "cancelled" || o.status === "returned") {
              return true;
            }
            // Cek jika semua item sudah cancelled atau delivered
            if (o.items && o.items.length > 0) {
              return o.items.every((item: any) => 
                item.status === "cancelled" || item.status === "delivered"
              );
            }
            return false;
          });
        setCanFinalize(allDelivered);
      } else if (type === "consultation") {
        // Consultation - primary source: consultation procedure order status
        try {
          const ordersRes = await procedureOrdersApi.getAll({
            target_visit_id: visitId,
            order_type: "consultation",
          });
          const ordersData = ordersRes.data || [];

          if (ordersData.length > 0) {
            setOrders(ordersData);

            // Can finalize if all consultation orders are completed/cancelled
            // or all items inside each order are completed.
            const allCompleted = ordersData.every((o: ProcedureOrder) =>
              o.status === "completed" ||
              o.status === "cancelled" ||
              (o.items && o.items.length > 0 && o.items.every((item) => item.status === "completed" || item.status === "cancelled"))
            );
            setCanFinalize(allCompleted);
          } else {
            // Fallback for legacy SOAP consultation without order result workflow.
            const consultationRes = await medicalRecordsApi.getConsultation(visitId);
            const consultationData = consultationRes.data;

            if (consultationData && consultationData.id) {
              setOrders([{ id: consultationData.id, order_number: "Konsultasi", status: "completed" }]);
              setCanFinalize(true);
            } else {
              setOrders([]);
              setCanFinalize(false);
            }
          }
        } catch (error) {
          // Jika gagal load data konsultasi/order, anggap belum siap final.
          setOrders([]);
          setCanFinalize(false);
        }
      } else {
        // Radiology or Laboratory
        const procedureType = type === "radiology" ? "radiology" : "laboratory";
        const ordersRes = await procedureOrdersApi.getAll({ target_visit_id: visitId, order_type: procedureType });
        const ordersData = ordersRes.data || [];
        setOrders(ordersData);
        
        // Can finalize if all orders are completed or have results
        const allCompleted = ordersData.length > 0 && 
          ordersData.every((o: ProcedureOrder) => 
            o.status === "completed" || o.status === "cancelled" ||
            (o.items && o.items.every(item => item.status === "completed"))
          );
        setCanFinalize(allCompleted);
      }
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
  };

  const handleFinalize = async () => {
    if (!hasPermission(permission)) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Anda tidak memiliki akses untuk menyelesaikan kunjungan",
      });
      return;
    }

    setSubmitting(true);
    try {
      await visitsApi.completeVisit(visitId);
      
      toast({
        title: "Berhasil",
        description: "Kunjungan berhasil diselesaikan",
      });
      
      loadData();
      // Trigger refresh print options
      window.dispatchEvent(new CustomEvent("refresh-print-options"));
      // Notify parent to refresh visit status badge
      if (onVisitUpdate) {
        onVisitUpdate();
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.response?.data?.error || "Gagal menyelesaikan kunjungan",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelFinal = async () => {
    if (!hasPermission(permission)) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Anda tidak memiliki akses untuk membatalkan final",
      });
      return;
    }

    // Check if registration is already completed
    if (visit?.registration?.status === "completed" || visit?.registration?.status === "discharged") {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Tidak dapat membatalkan final karena pasien sudah pulang",
      });
      return;
    }

    setSubmitting(true);
    try {
      await visitsApi.cancelCompleteVisit(visitId);
      
      toast({
        title: "Berhasil",
        description: "Final kunjungan berhasil dibatalkan",
      });
      
      loadData();
      // Trigger refresh print options
      window.dispatchEvent(new CustomEvent("refresh-print-options"));
      // Notify parent to refresh visit status badge
      if (onVisitUpdate) {
        onVisitUpdate();
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.response?.data?.error || "Gagal membatalkan final kunjungan",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const getTypeLabel = () => {
    switch (type) {
      case "pharmacy":
        return "Farmasi";
      case "radiology":
        return "Radiologi";
      case "laboratory":
        return "Laboratorium";
      case "consultation":
        return "Konsultasi";
    }
  };

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

  // Check if registration is completed/discharged
  const isPatientDischarged = visit?.registration?.status === "completed" || 
    visit?.registration?.status === "discharged";

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
                    ? "Semua obat harus diserahkan sebelum dapat menyelesaikan kunjungan"
                    : type === "consultation"
                    ? "Konsultasi harus dijawab sebelum dapat menyelesaikan kunjungan"
                    : "Semua tindakan harus selesai sebelum dapat menyelesaikan kunjungan"
                  }
                </span>
              </div>
            )}

            <Button
              className="w-full"
              onClick={handleFinalize}
              disabled={submitting || !canFinalize || !hasPermission(permission)}
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Memproses...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Selesaikan Kunjungan {getTypeLabel()}
                </>
              )}
            </Button>
          </>
        )}

        {isFinal && (
          <>
            <div className="flex items-center gap-2 text-green-600 dark:text-green-400 text-sm bg-green-50 dark:bg-green-950 p-3 rounded">
              <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
              <span>Kunjungan {getTypeLabel()} telah diselesaikan</span>
            </div>

            {/* Cancel Final Button - only show if patient not discharged */}
            {!isPatientDischarged && hasPermission(permission) && (
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
