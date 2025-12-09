import { useState, useEffect } from "react";
import { usePermission } from "@/hooks/usePermission";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
  TestTube,
  Play,
  Save,
  CheckCircle2,

  User,
  Clock,
  ArrowUp,
  ArrowDown,
  AlertTriangle,
} from "lucide-react";
import { procedureOrdersApi, PROCEDURE_ORDER_STATUS } from "@/lib/api";
import type { ProcedureOrder, ProcedureOrderItem, ProcedureParameter } from "@/lib/api/procedure-orders";

interface LaboratoryWorkstationProps {
  visitId: number;
  readOnly?: boolean;
}

export function LaboratoryWorkstation({ visitId, readOnly: _readOnly = false }: LaboratoryWorkstationProps) {
  const { toast } = useToast();
  const { hasPermission } = usePermission();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [orders, setOrders] = useState<ProcedureOrder[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<ProcedureOrder | null>(null);
  const [showResultDialog, setShowResultDialog] = useState(false);
  const [selectedItem, setSelectedItem] = useState<ProcedureOrderItem | null>(null);

  // Result form state
  const [itemResults, setItemResults] = useState<Record<number, string>>({});
  const [itemNotes, setItemNotes] = useState("");

  const canPerform = hasPermission("procedure_orders.perform");

  useEffect(() => {
    loadOrders();
  }, [visitId]);

  const loadOrders = async () => {
    setLoading(true);
    try {
      const res = await procedureOrdersApi.getAll({
        target_visit_id: visitId,
        order_type: "laboratory",
      });
      setOrders(res.data || []);
      // Select first pending/in_progress order
      const activeOrder = (res.data || []).find(
        (o: ProcedureOrder) => o.status === "pending" || o.status === "in_progress"
      );
      if (activeOrder) {
        setSelectedOrder(activeOrder);
      } else if (res.data?.length > 0) {
        setSelectedOrder(res.data[0]);
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

  const openItemResult = (item: ProcedureOrderItem) => {
    setSelectedItem(item);
    // Initialize results from existing data
    const results: Record<number, string> = {};
    item.procedure?.parameters?.forEach((param) => {
      const existing = item.results?.find((r) => r.procedure_parameter_id === param.id);
      results[param.id] = existing?.value || "";
    });
    setItemResults(results);
    setItemNotes(item.notes || "");
    setShowResultDialog(true);
  };

  const handleSaveItemResult = async () => {
    if (!selectedOrder || !selectedItem) return;

    setSubmitting(true);
    try {
      const items = [
        {
          item_id: selectedItem.id!,
          notes: itemNotes,
          results: Object.entries(itemResults).map(([paramId, value]) => ({
            parameter_id: Number(paramId),
            value: value,
          })),
        },
      ];

      // Use saveResults instead of submitResults to avoid completing the order
      const res = await procedureOrdersApi.saveResults(selectedOrder.id, { items });
      setSelectedOrder(res.data);

      toast({
        title: "Berhasil",
        description: "Hasil pemeriksaan disimpan",
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

  const getStatusBadge = (status: string) => {
    const config = PROCEDURE_ORDER_STATUS[status as keyof typeof PROCEDURE_ORDER_STATUS] || {
      label: status,
      variant: "secondary" as const,
    };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const getValueIndicator = (value: string, param: ProcedureParameter) => {
    if (!param.normal_min && !param.normal_max) return null;

    const numValue = parseFloat(value);
    if (isNaN(numValue)) return null;

    if (param.normal_min !== undefined && numValue < param.normal_min) {
      // Check critical
      if (param.critical_min !== undefined && numValue <= param.critical_min) {
        return (
          <span className="inline-flex items-center gap-1 text-red-600 font-bold">
            <ArrowDown className="h-4 w-4" />
            <AlertTriangle className="h-4 w-4" />
            Kritis
          </span>
        );
      }
      return (
        <span className="inline-flex items-center text-orange-600">
          <ArrowDown className="h-4 w-4" /> Low
        </span>
      );
    }

    if (param.normal_max !== undefined && numValue > param.normal_max) {
      // Check critical
      if (param.critical_max !== undefined && numValue >= param.critical_max) {
        return (
          <span className="inline-flex items-center gap-1 text-red-600 font-bold">
            <ArrowUp className="h-4 w-4" />
            <AlertTriangle className="h-4 w-4" />
            Kritis
          </span>
        );
      }
      return (
        <span className="inline-flex items-center text-orange-600">
          <ArrowUp className="h-4 w-4" /> High
        </span>
      );
    }

    return (
      <span className="text-green-600 font-medium">Normal</span>
    );
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
            <TestTube className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Tidak ada order laboratorium untuk dikerjakan</p>
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
                  <TestTube className="h-5 w-5" />
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

            {/* Action Buttons */}
            {canPerform && selectedOrder.status === "pending" && (
              <Button onClick={handleStartOrder}>
                <Play className="h-4 w-4 mr-2" />
                Mulai Pemeriksaan
              </Button>
            )}

            {/* Lab Results Table */}
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>Pemeriksaan</TableHead>
                    <TableHead>Parameter</TableHead>
                    <TableHead>Hasil</TableHead>
                    <TableHead>Nilai Normal</TableHead>
                    <TableHead>Satuan</TableHead>
                    <TableHead>Status</TableHead>
                    {canPerform && selectedOrder.status !== "completed" && (
                      <TableHead className="text-right">Aksi</TableHead>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {selectedOrder.items?.map((item) => {
                    const parameters = item.procedure?.parameters || [];
                    const rowSpan = Math.max(parameters.length, 1);

                    return parameters.length > 0 ? (
                      parameters.map((param, paramIdx) => {
                        const result = item.results?.find(
                          (r) => r.procedure_parameter_id === param.id
                        );
                        const value = result?.value || "";

                        return (
                          <TableRow key={`${item.id}-${param.id}`}>
                            {paramIdx === 0 && (
                              <>
                                <TableCell
                                  rowSpan={rowSpan}
                                  className="font-medium align-top border-r"
                                >
                                  {item.procedure?.name}
                                </TableCell>
                              </>
                            )}
                            <TableCell>{param.name}</TableCell>
                            <TableCell
                            className={
                              value && param.normal_min !== undefined && param.normal_max !== undefined
                                ? parseFloat(value) < param.normal_min ||
                                    parseFloat(value) > param.normal_max
                                    ? "font-bold text-orange-600"
                                    : ""
                                  : ""
                              }
                            >
                              {value || "-"}
                            </TableCell>
                            <TableCell className="text-muted-foreground text-sm">
                              {param.normal_min && param.normal_max
                                ? `${param.normal_min} - ${param.normal_max}`
                                : param.normal_min
                                ? `≥ ${param.normal_min}`
                                : param.normal_max
                                ? `≤ ${param.normal_max}`
                                : "-"}
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {param.unit || "-"}
                            </TableCell>
                            <TableCell>
                              {value ? getValueIndicator(value, param) : "-"}
                            </TableCell>
                            {paramIdx === 0 &&
                              canPerform &&
                              selectedOrder.status !== "completed" && (
                                <TableCell
                                  rowSpan={rowSpan}
                                  className="text-right align-top border-l"
                                >
                                  <Button
                                    size="sm"
                                    variant={item.status === "completed" ? "outline" : "default"}
                                    onClick={() => openItemResult(item)}
                                  >
                                    {item.status === "completed" ? "Edit" : "Input"}
                                  </Button>
                                </TableCell>
                              )}
                          </TableRow>
                        );
                      })
                    ) : (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">
                          {item.procedure?.name}
                        </TableCell>
                        <TableCell colSpan={4} className="text-muted-foreground">
                          Tidak ada parameter
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">{item.status}</Badge>
                        </TableCell>
                        {canPerform && selectedOrder.status !== "completed" && (
                          <TableCell className="text-right">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => openItemResult(item)}
                            >
                              Selesai
                            </Button>
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            {/* Complete Order Button */}
            {canPerform && (selectedOrder.status === "in_progress" || selectedOrder.status === "pending") && (
              <div className="flex justify-end pt-4 border-t">
                <Button onClick={handleCompleteOrder} disabled={submitting}>
                  {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Selesaikan Order
                </Button>
              </div>
            )}

            {/* Completed Notice */}
            {selectedOrder.status === "completed" && (
              <div className="p-4 bg-green-50 dark:bg-green-950 border border-green-200 rounded-lg">
                <p className="font-medium text-green-700 dark:text-green-300 flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5" />
                  Pemeriksaan Selesai
                </p>
                {selectedOrder.performed_by && (
                  <p className="text-sm text-muted-foreground mt-1">
                    Oleh: {selectedOrder.performed_by.nama_lengkap}
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Item Result Dialog */}
      <Dialog open={showResultDialog} onOpenChange={setShowResultDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              Input Hasil - {selectedItem?.procedure?.name}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {selectedItem?.procedure?.parameters?.map((param) => (
              <div key={param.id}>
                <Label>
                  {param.name}
                  {param.is_required && <span className="text-red-500">*</span>}
                  {param.unit && (
                    <span className="text-muted-foreground ml-1">({param.unit})</span>
                  )}
                </Label>
                {param.normal_min || param.normal_max ? (
                  <p className="text-xs text-muted-foreground mb-1">
                    Nilai normal:{" "}
                    {param.normal_min && param.normal_max
                      ? `${param.normal_min} - ${param.normal_max}`
                      : param.normal_min
                      ? `≥ ${param.normal_min}`
                      : `≤ ${param.normal_max}`}
                  </p>
                ) : null}
                <Input
                  type={param.input_type === "number" ? "number" : "text"}
                  value={itemResults[param.id] || ""}
                  onChange={(e) =>
                    setItemResults((prev) => ({
                      ...prev,
                      [param.id]: e.target.value,
                    }))
                  }
                  placeholder={param.description}
                  step={param.input_type === "number" ? "any" : undefined}
                />
                {itemResults[param.id] && (
                  <div className="mt-1">
                    {getValueIndicator(itemResults[param.id], param)}
                  </div>
                )}
              </div>
            ))}

            <div>
              <Label>Catatan</Label>
              <Textarea
                value={itemNotes}
                onChange={(e) => setItemNotes(e.target.value)}
                placeholder="Catatan tambahan (opsional)"
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowResultDialog(false)}>
              Batal
            </Button>
            <Button onClick={handleSaveItemResult} disabled={submitting}>
              {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              <Save className="h-4 w-4 mr-2" />
              Simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
