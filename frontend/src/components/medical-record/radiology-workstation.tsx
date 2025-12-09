import { useState, useEffect } from "react";
import { usePermission } from "@/hooks/usePermission";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
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
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2,
  FileImage,
  Play,
  Save,
  CheckCircle2,
  AlertCircle,
  User,
  Clock,
} from "lucide-react";
import { procedureOrdersApi, PROCEDURE_ORDER_STATUS } from "@/lib/api";
import type { ProcedureOrder } from "@/lib/api/procedure-orders";

interface RadiologyWorkstationProps {
  visitId: number;
  readOnly?: boolean;
}

export function RadiologyWorkstation({ visitId, readOnly: _readOnly = false }: RadiologyWorkstationProps) {
  const { toast } = useToast();
  const { hasPermission } = usePermission();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [orders, setOrders] = useState<ProcedureOrder[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<ProcedureOrder | null>(null);
  const [showResultDialog, setShowResultDialog] = useState(false);

  // Result form state
  const [resultSummary, setResultSummary] = useState("");
  const [conclusion, setConclusion] = useState("");
  const [suggestion, setSuggestion] = useState("");
  const [isCritical, setIsCritical] = useState(false);
  const [criticalNotes, setCriticalNotes] = useState("");
  const [itemResults, setItemResults] = useState<Record<number, Record<number, string>>>({});

  const canPerform = hasPermission("procedure_orders.perform");

  useEffect(() => {
    loadOrders();
  }, [visitId]);

  const loadOrders = async () => {
    setLoading(true);
    try {
      const res = await procedureOrdersApi.getAll({
        target_visit_id: visitId,
        order_type: "radiology",
      });
      setOrders(res.data || []);
      // Select first pending/in_progress order
      const activeOrder = (res.data || []).find(
        (o: ProcedureOrder) => o.status === "pending" || o.status === "in_progress"
      );
      if (activeOrder) {
        setSelectedOrder(activeOrder);
        initializeResults(activeOrder);
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

  const initializeResults = (order: ProcedureOrder) => {
    // Initialize item results from existing data or empty
    const results: Record<number, Record<number, string>> = {};
    order.items?.forEach((item) => {
      results[item.id!] = {};
      item.procedure?.parameters?.forEach((param) => {
        const existingResult = item.results?.find(
          (r) => r.procedure_parameter_id === param.id
        );
        results[item.id!][param.id] = existingResult?.value || "";
      });
    });
    setItemResults(results);
    setResultSummary(order.result_summary || "");
    setConclusion(order.conclusion || "");
    setSuggestion(order.suggestion || "");
    setIsCritical(order.is_critical || false);
    setCriticalNotes(order.critical_notes || "");
  };

  const handleStartOrder = async () => {
    if (!selectedOrder) return;

    try {
      const res = await procedureOrdersApi.start(selectedOrder.id);
      setSelectedOrder(res.data);
      toast({
        title: "Berhasil",
        description: "Pemeriksaan dimulai",
      });
      loadOrders();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.response?.data?.error || "Gagal memulai pemeriksaan",
      });
    }
  };

  const handleSaveResults = async () => {
    if (!selectedOrder) return;

    setSubmitting(true);
    try {
      const items = selectedOrder.items?.map((item) => ({
        item_id: item.id!,
        notes: "",
        results: Object.entries(itemResults[item.id!] || {}).map(([paramId, value]) => ({
          parameter_id: Number(paramId),
          value: value,
        })),
      })) || [];

      const res = await procedureOrdersApi.saveResults(selectedOrder.id, {
        result_summary: resultSummary,
        conclusion: conclusion,
        suggestion: suggestion,
        is_critical: isCritical,
        critical_notes: criticalNotes,
        items,
      });

      setSelectedOrder(res.data);
      toast({
        title: "Berhasil",
        description: "Hasil pemeriksaan berhasil disimpan",
      });

      setShowResultDialog(false);
      loadOrders();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.response?.data?.error || "Gagal menyimpan hasil",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleCompleteOrder = async () => {
    if (!selectedOrder) return;

    setSubmitting(true);
    try {
      await procedureOrdersApi.complete(selectedOrder.id);

      toast({
        title: "Berhasil",
        description: "Order selesai",
      });

      loadOrders();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.response?.data?.error || "Gagal menyelesaikan order",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const updateItemResult = (itemId: number, paramId: number, value: string) => {
    setItemResults((prev) => ({
      ...prev,
      [itemId]: {
        ...prev[itemId],
        [paramId]: value,
      },
    }));
  };

  const getStatusBadge = (status: string) => {
    const config = PROCEDURE_ORDER_STATUS[status as keyof typeof PROCEDURE_ORDER_STATUS] || {
      label: status,
      variant: "secondary" as const,
    };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="text-center text-muted-foreground">
            <FileImage className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Tidak ada order radiologi untuk dikerjakan</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Order Selection */}
      {orders.length > 1 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Pilih Order</CardTitle>
          </CardHeader>
          <CardContent>
            <Select
              value={selectedOrder?.id.toString()}
              onValueChange={(val) => {
                const order = orders.find((o) => o.id === Number(val));
                if (order) {
                  setSelectedOrder(order);
                  initializeResults(order);
                }
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Pilih order" />
              </SelectTrigger>
              <SelectContent>
                {orders.map((order) => (
                  <SelectItem key={order.id} value={order.id.toString()}>
                    {order.order_number} - {getStatusBadge(order.status)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>
      )}

      {/* Selected Order Details */}
      {selectedOrder && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  <FileImage className="h-5 w-5" />
                  {selectedOrder.order_number}
                </CardTitle>
                <CardDescription>
                  Order dari {selectedOrder.source_room?.name}
                </CardDescription>
              </div>
              {getStatusBadge(selectedOrder.status)}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Patient Info */}
            <div className="grid grid-cols-2 gap-4 text-sm p-3 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">
                  {selectedOrder.source_visit?.registration?.patient?.nama_lengkap || 
                   selectedOrder.registration?.patient?.nama_lengkap || "-"}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">No. RM:</span>{" "}
                {selectedOrder.source_visit?.registration?.patient?.no_rm || 
                 selectedOrder.registration?.patient?.no_rm || "-"}
              </div>
              <div>
                <span className="text-muted-foreground">Dokter:</span>{" "}
                {selectedOrder.ordered_by?.nama_lengkap || "-"}
              </div>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                {new Date(selectedOrder.created_at).toLocaleString("id-ID")}
              </div>
            </div>

            {/* Clinical Notes */}
            {selectedOrder.clinical_notes && (
              <div className="p-3 bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 rounded-lg">
                <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200 mb-1">
                  Catatan Klinis:
                </p>
                <p className="text-sm">{selectedOrder.clinical_notes}</p>
              </div>
            )}

            {/* Procedures List */}
            <div>
              <p className="text-sm font-medium mb-2">Pemeriksaan:</p>
              <div className="space-y-2">
                {selectedOrder.items?.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-3 rounded-lg border bg-card"
                  >
                    <div>
                      <p className="font-medium">{item.procedure?.name}</p>
                      {item.procedure?.description && (
                        <p className="text-sm text-muted-foreground">
                          {item.procedure.description}
                        </p>
                      )}
                    </div>
                    <Badge
                      variant={item.status === "completed" ? "default" : "secondary"}
                    >
                      {item.status === "completed" ? "Selesai" : "Menunggu"}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>

            {/* Action Buttons */}
            {canPerform && selectedOrder.status !== "completed" && (
              <div className="flex gap-2 pt-4 border-t">
                {selectedOrder.status === "pending" && (
                  <Button onClick={handleStartOrder}>
                    <Play className="h-4 w-4 mr-2" />
                    Mulai Pemeriksaan
                  </Button>
                )}
                {(selectedOrder.status === "in_progress" || selectedOrder.status === "pending") && (
                  <>
                    <Button variant="outline" onClick={() => setShowResultDialog(true)}>
                      <Save className="h-4 w-4 mr-2" />
                      Input/Edit Hasil
                    </Button>
                    <Button onClick={handleCompleteOrder} disabled={submitting}>
                      {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                      <CheckCircle2 className="h-4 w-4 mr-2" />
                      Selesaikan
                    </Button>
                  </>
                )}
              </div>
            )}

            {/* Completed Results */}
            {selectedOrder.status === "completed" && (
              <div className="p-4 bg-green-50 dark:bg-green-950 border border-green-200 rounded-lg">
                <p className="font-medium text-green-700 dark:text-green-300 flex items-center gap-2 mb-3">
                  <CheckCircle2 className="h-5 w-5" />
                  Hasil Pemeriksaan
                </p>
                
                {/* Detail Results per Item */}
                {selectedOrder.items?.map((item) => (
                  <div key={item.id} className="mb-4 border-b pb-4 last:border-0">
                    <h4 className="font-semibold mb-2">{item.procedure?.name}</h4>
                    {item.results && item.results.length > 0 ? (
                      <div className="space-y-2">
                        {item.results.map((result) => (
                          <div key={result.id} className="grid grid-cols-[150px_1fr] gap-2">
                            <span className="text-sm font-medium text-muted-foreground">
                              {result.procedure_parameter?.name}:
                            </span>
                            <span className="text-sm whitespace-pre-wrap">{result.value}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground italic">Tidak ada hasil parameter</p>
                    )}
                  </div>
                ))}
                
                {selectedOrder.result_summary && (
                  <div className="mb-3">
                    <span className="text-sm font-medium">Hasil:</span>
                    <p className="whitespace-pre-wrap">{selectedOrder.result_summary}</p>
                  </div>
                )}
                {selectedOrder.conclusion && (
                  <div className="mb-3">
                    <span className="text-sm font-medium">Kesan:</span>
                    <p className="whitespace-pre-wrap">{selectedOrder.conclusion}</p>
                  </div>
                )}
                {selectedOrder.suggestion && (
                  <div>
                    <span className="text-sm font-medium">Saran:</span>
                    <p className="whitespace-pre-wrap">{selectedOrder.suggestion}</p>
                  </div>
                )}
                {selectedOrder.is_critical && (
                  <div className="mt-3 p-3 bg-red-100 dark:bg-red-900 rounded">
                    <span className="text-red-700 dark:text-red-300 font-bold flex items-center gap-2">
                      <AlertCircle className="h-5 w-5" />
                      NILAI KRITIS
                    </span>
                    <p className="text-sm mt-1">{selectedOrder.critical_notes}</p>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Result Input Dialog */}
      <Dialog open={showResultDialog} onOpenChange={setShowResultDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Input Hasil Radiologi</DialogTitle>
          </DialogHeader>

          <div className="space-y-6">
            {/* Per-Item Parameters */}
            {selectedOrder?.items?.map((item) => (
              <div key={item.id} className="border rounded-lg p-4">
                <h4 className="font-medium mb-3">{item.procedure?.name}</h4>
                <div className="space-y-3">
                  {item.procedure?.parameters?.map((param) => (
                    <div key={param.id}>
                      <Label>
                        {param.name}
                        {param.is_required && <span className="text-red-500">*</span>}
                      </Label>
                      {param.input_type === "textarea" ? (
                        <Textarea
                          value={itemResults[item.id!]?.[param.id] || ""}
                          onChange={(e) =>
                            updateItemResult(item.id!, param.id, e.target.value)
                          }
                          placeholder={param.description}
                          rows={3}
                        />
                      ) : param.input_type === "checkbox" ? (
                        <div className="flex items-center gap-2 mt-1">
                          <Checkbox
                            checked={itemResults[item.id!]?.[param.id] === "true"}
                            onCheckedChange={(checked) =>
                              updateItemResult(item.id!, param.id, checked ? "true" : "false")
                            }
                          />
                          <span className="text-sm">{param.description || param.name}</span>
                        </div>
                      ) : (
                        <Input
                          type={param.input_type === "number" ? "number" : "text"}
                          value={itemResults[item.id!]?.[param.id] || ""}
                          onChange={(e) =>
                            updateItemResult(item.id!, param.id, e.target.value)
                          }
                          placeholder={param.description}
                        />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}

            {/* General Results */}
            <div className="border-t pt-4 space-y-4">
              <div>
                <Label>Hasil Pemeriksaan</Label>
                <Textarea
                  value={resultSummary}
                  onChange={(e) => setResultSummary(e.target.value)}
                  placeholder="Deskripsi hasil pemeriksaan..."
                  rows={4}
                />
              </div>

              <div>
                <Label>Kesan</Label>
                <Textarea
                  value={conclusion}
                  onChange={(e) => setConclusion(e.target.value)}
                  placeholder="Kesan/kesimpulan..."
                  rows={3}
                />
              </div>

              <div>
                <Label>Saran</Label>
                <Textarea
                  value={suggestion}
                  onChange={(e) => setSuggestion(e.target.value)}
                  placeholder="Saran untuk dokter pengirim..."
                  rows={2}
                />
              </div>

              <div className="flex items-center gap-2">
                <Checkbox
                  checked={isCritical}
                  onCheckedChange={(checked) => setIsCritical(checked as boolean)}
                />
                <Label className="text-red-600 font-medium">
                  <AlertCircle className="h-4 w-4 inline mr-1" />
                  Nilai Kritis
                </Label>
              </div>

              {isCritical && (
                <div>
                  <Label>Catatan Nilai Kritis</Label>
                  <Textarea
                    value={criticalNotes}
                    onChange={(e) => setCriticalNotes(e.target.value)}
                    placeholder="Jelaskan temuan kritis..."
                    rows={2}
                    className="border-red-300"
                  />
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowResultDialog(false)}>
              Batal
            </Button>
            <Button onClick={handleSaveResults} disabled={submitting}>
              {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              <Save className="h-4 w-4 mr-2" />
              Simpan Hasil
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
