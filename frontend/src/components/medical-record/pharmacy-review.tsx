import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { usePermission } from "@/hooks/usePermission";
import {
  Loader2,
  FileCheck,
  Pill,
  User,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
} from "lucide-react";
import { medicineOrdersApi } from "@/lib/api";
import type { MedicineOrder, PrescriptionReview } from "@/lib/api";

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

export function PharmacyReview({ visitId, readOnly = false }: PharmacyReviewProps) {
  const { toast } = useToast();
  const { hasPermission } = usePermission();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [orders, setOrders] = useState<MedicineOrder[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<MedicineOrder | null>(null);
  const [existingReview, setExistingReview] = useState<PrescriptionReview | null>(null);
  const [hasDecided, setHasDecided] = useState(false);

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
    if (selectedOrder) {
      loadReview(selectedOrder.id);
    }
  }, [selectedOrder]);

  const loadOrders = async () => {
    setLoading(true);
    try {
      const res = await medicineOrdersApi.getAll({ pharmacy_visit_id: visitId });
      const data = res.data || [];
      setOrders(data);
      if (data.length > 0) {
        setSelectedOrder(data[0]);
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

  if (loading) {
    return (
      <Card className="shadow-md">
        <CardHeader className="border-b bg-muted/50">
          <CardTitle className="text-lg">Telaah Resep</CardTitle>
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
          <CardTitle className="text-lg">Telaah Resep</CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
            <Pill className="h-12 w-12 mb-4 opacity-50" />
            <p>Tidak ada order obat untuk visit ini</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const patient = selectedOrder?.source_visit?.registration?.patient;
  const canReview = hasPermission('pharmacy.review');
  
  // Check if order is already reviewed
  const isAlreadyReviewed = selectedOrder?.status === 'reviewed' || 
    selectedOrder?.status === 'preparing' || 
    selectedOrder?.status === 'ready' || 
    selectedOrder?.status === 'delivered' ||
    selectedOrder?.status === 'completed';
  
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
  
  return (
    <Card className="shadow-md">
      <CardHeader className="border-b bg-muted/30 py-3 px-4">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <FileCheck className="h-4 w-4" />
          Telaah Resep
        </CardTitle>
        <CardDescription>
          Verifikasi dan telaah keamanan resep sebelum penyiapan obat
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

          {/* Order Items Table */}
          <div className="border rounded-lg">
            <div className="p-3 border-b bg-muted/30">
              <Label className="text-sm font-semibold flex items-center gap-2">
                <Pill className="h-4 w-4" />
                Daftar Obat ({selectedOrder.items?.filter(i => i.status !== 'cancelled').length || 0} item)
              </Label>
            </div>
            <div className="p-0">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="py-2 px-3 text-left font-medium">Nama Obat</th>
                    <th className="py-2 px-3 text-left font-medium">Dosis</th>
                    <th className="py-2 px-3 text-left font-medium">Frekuensi</th>
                    <th className="py-2 px-3 text-left font-medium">Rute</th>
                    <th className="py-2 px-3 text-left font-medium">Durasi</th>
                    <th className="py-2 px-3 text-right font-medium">Jumlah</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedOrder.items?.filter(i => i.status !== 'cancelled').map((item, index) => (
                    <tr key={item.id || index} className="border-b last:border-0">
                      <td className="py-3 px-3">
                        <p className="font-medium">{item.medicine?.name || "Obat"}</p>
                        <p className="text-xs text-muted-foreground">{item.medicine?.generic_name}</p>
                        {item.instructions && (
                          <p className="text-xs text-blue-600 mt-1">"{item.instructions}"</p>
                        )}
                      </td>
                      <td className="py-3 px-3">{item.dosage}</td>
                      <td className="py-3 px-3">{item.frequency}</td>
                      <td className="py-3 px-3">{item.route}</td>
                      <td className="py-3 px-3">{item.duration}</td>
                      <td className="py-3 px-3 text-right font-medium">{item.quantity} {item.unit}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Review Form */}
          <div className="border rounded-lg">
            <div className="p-3 border-b bg-muted/30">
              <Label className="text-sm font-semibold flex items-center gap-2">
                <FileCheck className="h-4 w-4" />
                Formulir Telaah Resep
                {existingReview && (
                  <Badge variant="outline" className="ml-2">
                    <Clock className="h-3 w-3 mr-1" />
                    Sudah ditelaah
                  </Badge>
                )}
              </Label>
            </div>
            <div className="p-3 space-y-4">
              {/* Checklist Items */}
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="drug_interaction"
                    checked={reviewForm.drug_interaction_check}
                    onCheckedChange={(checked) =>
                      setReviewForm({ ...reviewForm, drug_interaction_check: checked as boolean })
                    }
                    disabled={readOnly || isAlreadyReviewed}
                  />
                  <Label htmlFor="drug_interaction" className="text-sm">
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
                  <Label htmlFor="dose_check" className="text-sm">
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
                  <Label htmlFor="duplication_check" className="text-sm">
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
                  <Label htmlFor="allergy_check" className="text-sm">
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
                  <Label htmlFor="contraindication_check" className="text-sm">
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
                  <Label htmlFor="indication_check" className="text-sm">
                    Cek Indikasi
                  </Label>
                </div>
              </div>

              <Separator />

              {/* Warnings */}
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
                  rows={2}
                  disabled={readOnly || isAlreadyReviewed}
                />
              </div>

              {/* Suggestion */}
              <div className="space-y-2">
                <Label htmlFor="suggestion">Saran untuk Dokter (jika perlu)</Label>
                <Textarea
                  id="suggestion"
                  placeholder="Saran perubahan resep untuk dokter..."
                  value={reviewForm.suggestion}
                  onChange={(e) => setReviewForm({ ...reviewForm, suggestion: e.target.value })}
                  rows={2}
                  disabled={readOnly || isAlreadyReviewed}
                />
              </div>

              {/* Notes */}
              <div className="space-y-2">
                <Label htmlFor="notes">Catatan Tambahan</Label>
                <Textarea
                  id="notes"
                  placeholder="Catatan lainnya..."
                  value={reviewForm.notes}
                  onChange={(e) => setReviewForm({ ...reviewForm, notes: e.target.value })}
                  rows={2}
                  disabled={readOnly || isAlreadyReviewed}
                />
              </div>

              <Separator />

              {/* Approval */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
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
                    <span>Pilih Setuju atau Tidak Setuju untuk melanjutkan</span>
                  </div>
                )}

                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant={isAlreadyApproved || (hasDecided && reviewForm.is_approved) ? "default" : "outline"}
                    className="flex-1"
                    onClick={async () => {
                      if (!selectedOrder || submitting || isAlreadyApproved) return;
                      const newForm = { ...reviewForm, is_approved: true };
                      setReviewForm(newForm);
                      setHasDecided(true);
                      
                      // Auto submit when clicking Setuju
                      setSubmitting(true);
                      try {
                        await medicineOrdersApi.submitReview(selectedOrder.id, newForm);
                        toast({
                          title: "Berhasil",
                          description: "Telaah resep disetujui",
                        });
                        loadOrders();
                        // Trigger refresh on final visit
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
                    }}
                    disabled={!canApprove || submitting || readOnly}
                  >
                    {submitting && reviewForm.is_approved && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    {isAlreadyApproved ? "Sudah Disetujui" : "Setuju"}
                  </Button>
                  <Button
                    type="button"
                    variant={hasDecided && !reviewForm.is_approved && !isAlreadyApproved ? "destructive" : "outline"}
                    className="flex-1"
                    onClick={async () => {
                      if (!selectedOrder || submitting || isAlreadyApproved) return;
                      const newForm = { ...reviewForm, is_approved: false };
                      setReviewForm(newForm);
                      setHasDecided(true);
                      
                      // Auto submit when clicking Tidak Setuju
                      setSubmitting(true);
                      try {
                        await medicineOrdersApi.submitReview(selectedOrder.id, newForm);
                        toast({
                          variant: "destructive",
                          title: "Berhasil",
                          description: "Telaah resep tidak disetujui",
                        });
                        loadOrders();
                        // Trigger refresh on final visit
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
                    }}
                    disabled={!canReview || isAlreadyReviewed || isAlreadyApproved || submitting || readOnly}
                  >
                    {submitting && !reviewForm.is_approved && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    <XCircle className="h-4 w-4 mr-2" />
                    Tidak Setuju
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}          </div>
        </ScrollArea>      </CardContent>
    </Card>
  );
}
