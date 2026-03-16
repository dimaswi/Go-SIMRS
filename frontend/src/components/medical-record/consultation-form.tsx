import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { usePermission } from "@/hooks/usePermission";
import { cn } from "@/lib/utils";
import { Loader2, Save, CheckCircle2 } from "lucide-react";
import {
  procedureOrdersApi,
  PROCEDURE_ORDER_STATUS,
} from "@/lib/api";
import type {
  ProcedureOrder,
  ProcedureOrderItem,
  ProcedureParameter,
} from "@/lib/api/procedure-orders";

interface ConsultationFormProps {
  visitId: number;
  readOnly?: boolean;
}

export function ConsultationForm({ visitId, readOnly = false }: ConsultationFormProps) {
  const { toast } = useToast();
  const { hasPermission } = usePermission();
  const canPerform = hasPermission("procedure_orders.perform");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [order, setOrder] = useState<ProcedureOrder | null>(null);
  const [inlineResults, setInlineResults] = useState<Record<number, Record<number, string>>>({});

  useEffect(() => {
    loadConsultation();
  }, [visitId]);

  const loadConsultation = async () => {
    setLoading(true);
    try {
      const orderRes = await procedureOrdersApi.getAll({ target_visit_id: visitId, order_type: "consultation" });

      const orders = orderRes.data || [];
      const activeOrder =
        orders.find((item) => item.status === "in_progress" || item.status === "pending") ||
        orders[0] ||
        null;
      setOrder(activeOrder);

      if (activeOrder?.items?.length) {
        const mappedResults: Record<number, Record<number, string>> = {};
        activeOrder.items.forEach((item) => {
          const itemId = item.id;
          if (!itemId) return;
          mappedResults[itemId] = {};
          item.procedure?.parameters?.forEach((param) => {
            const paramId = param.id;
            if (!paramId) return;
            const existingResult = item.results?.find((r) => r.procedure_parameter_id === paramId);
            mappedResults[itemId][paramId] = existingResult?.value || "";
          });
        });
        setInlineResults(mappedResults);
      } else {
        setInlineResults({});
      }
    } catch (error: any) {
      if (error.response?.status !== 404) {
        console.error("Error loading consultation:", error);
      }
    } finally {
      setLoading(false);
    }
  };

  const isLocked = readOnly || !canPerform || order?.status === "completed";

  const getConsultationStatusLabel = (status?: string) => {
    if (!status) return "-";
    const key = status as keyof typeof PROCEDURE_ORDER_STATUS;
    return PROCEDURE_ORDER_STATUS[key]?.label || status;
  };

  const updateInlineResult = (itemId: number, paramId: number, value: string) => {
    setInlineResults((prev) => ({
      ...prev,
      [itemId]: {
        ...(prev[itemId] || {}),
        [paramId]: value,
      },
    }));
  };

  const parseSelectOptions = (param: ProcedureParameter): string[] => {
    if (!param.options) return [];
    try {
      const parsed = JSON.parse(param.options);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return param.options
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
    }
  };

  const renderInlineInput = (item: ProcedureOrderItem, param: ProcedureParameter) => {
    const itemId = item.id || 0;
    const value = inlineResults[itemId]?.[param.id] || "";

    if (isLocked) {
      return <span className="text-sm">{value || "-"}</span>;
    }

    if (param.input_type === "textarea") {
      return (
        <Textarea
          value={value}
          onChange={(e) => updateInlineResult(itemId, param.id, e.target.value)}
          className="min-h-[56px] text-xs"
          placeholder="Isi hasil..."
        />
      );
    }

    if (param.input_type === "number") {
      return (
        <Input
          type="number"
          value={value}
          onChange={(e) => updateInlineResult(itemId, param.id, e.target.value)}
          className="h-7 text-xs"
          placeholder="0"
        />
      );
    }

    if (param.input_type === "select") {
      const options = parseSelectOptions(param);
      return (
        <Select
          value={value}
          onValueChange={(selected) => updateInlineResult(itemId, param.id, selected)}
        >
          <SelectTrigger className="h-7 min-w-[120px] text-xs">
            <SelectValue placeholder="Pilih" />
          </SelectTrigger>
          <SelectContent>
            {options.map((option) => (
              <SelectItem key={option} value={option}>
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    }

    if (param.input_type === "checkbox") {
      return (
        <Select
          value={value || "false"}
          onValueChange={(selected) => updateInlineResult(itemId, param.id, selected)}
        >
          <SelectTrigger className="h-7 min-w-[92px] text-xs">
            <SelectValue placeholder="Pilih" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="true">Ya</SelectItem>
            <SelectItem value="false">Tidak</SelectItem>
          </SelectContent>
        </Select>
      );
    }

    return (
      <Input
        value={value}
        onChange={(e) => updateInlineResult(itemId, param.id, e.target.value)}
        className="h-7 text-xs"
        placeholder="Isi hasil..."
      />
    );
  };

  const hasAnyResultInput = useMemo(() => {
    return Object.values(inlineResults).some((itemMap) =>
      Object.values(itemMap || {}).some((value) => String(value || "").trim() !== "")
    );
  }, [inlineResults]);

  const handleSave = async () => {
    if (!order) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Order konsultasi tidak ditemukan untuk visit ini",
      });
      return;
    }

    if (!hasAnyResultInput) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Isi minimal satu hasil parameter tindakan konsultasi",
      });
      return;
    }

    setSaving(true);
    try {
      const mappedItems = (order.items || [])
        .filter((item) => item.id && item.status !== "cancelled")
        .map((item) => {
          const itemId = item.id as number;
          const results = (item.procedure?.parameters || [])
            .map((param) => {
              const rawValue = inlineResults[itemId]?.[param.id] ?? "";
              const value = String(rawValue).trim();
              if (value === "") return null;

              const payload: {
                parameter_id: number;
                value: string;
                numeric_value?: number;
                notes?: string;
              } = {
                parameter_id: param.id,
                value,
              };

              if (param.input_type === "number") {
                const numeric = Number(value);
                if (!Number.isNaN(numeric)) {
                  payload.numeric_value = numeric;
                }
              }

              return payload;
            })
            .filter((result): result is NonNullable<typeof result> => Boolean(result));

          return {
            item_id: itemId,
            notes: item.notes || "",
            results,
          };
        });

      await procedureOrdersApi.saveResults(order.id, {
        result_summary: "",
        conclusion: "",
        suggestion: "",
        items: mappedItems,
      });

      await procedureOrdersApi.complete(order.id);

      toast({
        title: "Berhasil",
        description: "Hasil konsultasi berhasil disimpan",
      });

      window.dispatchEvent(new CustomEvent("refresh-print-options"));
      window.dispatchEvent(new CustomEvent("refresh-final-visit"));

      await loadConsultation();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.response?.data?.error || "Gagal menyimpan hasil konsultasi",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-2 border-b pb-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="font-medium text-sm">Pengisian Konsultasi</p>
            {order && (
              <p className="text-xs text-muted-foreground">Order: {order.order_number}</p>
            )}
          </div>

          {!canPerform && (
            <Badge variant="destructive">Butuh permission: procedure_orders.perform</Badge>
          )}
        </div>
      </div>
      <div>
        {order && (
          <>
            <div className="mb-2 rounded-lg border bg-muted/30 p-2">
              <div className="mb-1.5 flex items-center gap-2 text-xs font-semibold">Indikasi Konsultasi</div>
              <div className="grid grid-cols-1 gap-x-6 gap-y-1 text-xs lg:grid-cols-2">
                {order && (
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-muted-foreground">Status</div>
                    <div>
                      <Badge variant={PROCEDURE_ORDER_STATUS[order.status as keyof typeof PROCEDURE_ORDER_STATUS]?.variant || "secondary"}>
                        {getConsultationStatusLabel(order.status)}
                      </Badge>
                    </div>
                  </div>
                )}
                <div className="flex items-center justify-between gap-2">
                  <div className="text-muted-foreground">No. Order</div>
                  <div className="font-medium">{order.order_number || "-"}</div>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <div className="text-muted-foreground">Dokter Pengirim</div>
                  <div className="font-medium">{order.ordered_by?.nama_lengkap || "-"}</div>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <div className="text-muted-foreground">Prioritas</div>
                  <div>
                    <Badge variant={order.priority === "urgent" || order.priority === "cito" ? "destructive" : "outline"}>
                      {order.priority === "urgent" || order.priority === "cito"
                        ? String(order.priority).toUpperCase()
                        : "Normal"}
                    </Badge>
                  </div>
                </div>
              </div>
              <div className="mt-1.5 space-y-1 text-xs">
                <div className="rounded bg-background/70 px-2 py-1">
                  <span className="text-muted-foreground">Diagnosis: </span>
                  <span className="font-medium">{order.diagnosis || "-"}</span>
                </div>
                {order.clinical_notes && (
                  <div className="rounded bg-background/70 px-2 py-1">
                    <span className="text-muted-foreground">Alasan Konsultasi: </span>
                    <div className="mt-0.5 max-h-8 overflow-auto whitespace-pre-wrap font-medium leading-4">
                      {order.clinical_notes}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {!order && (
          <div className="bg-muted/40 border rounded-lg p-4 mb-6 text-sm text-muted-foreground">
            Tidak ada order konsultasi aktif untuk visit ini.
          </div>
        )}

        {order && (
          <div className="mb-2 space-y-2">
            <div className="flex items-center gap-2 font-medium text-sm">
              <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
              Parameter Tindakan Konsultasi
            </div>
            <div className="rounded-lg border">
              <div className="max-h-[62vh] overflow-auto">
                <Table className="min-w-[760px]">
                <TableHeader>
                  <TableRow className="sticky top-0 bg-muted/80 backdrop-blur-sm">
                    <TableHead className="text-[11px]">Tindakan</TableHead>
                    <TableHead className="text-[11px]">Parameter</TableHead>
                    <TableHead className="text-[11px]">Hasil</TableHead>
                    <TableHead className="text-[11px]">Normal</TableHead>
                    <TableHead className="text-[11px]">Satuan</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(order.items || []).map((item) => {
                    const parameters = item.procedure?.parameters || [];
                    const rowSpan = Math.max(parameters.length, 1);

                    if (parameters.length === 0) {
                      return (
                        <TableRow key={item.id || item.procedure_id}>
                          <TableCell className="py-2 text-xs font-medium">{item.procedure?.name || "-"}</TableCell>
                          <TableCell colSpan={4} className="py-2 text-xs text-muted-foreground italic">
                            Tindakan ini belum punya parameter
                          </TableCell>
                        </TableRow>
                      );
                    }

                    return parameters.map((param, index) => (
                      <TableRow key={`${item.id || item.procedure_id}-${param.id}`}>
                        {index === 0 && (
                          <TableCell rowSpan={rowSpan} className="align-top border-r py-2">
                            <div className="text-xs font-medium">{item.procedure?.name || "-"}</div>
                            <div className="text-[11px] text-muted-foreground">{item.procedure?.code || ""}</div>
                          </TableCell>
                        )}
                        <TableCell className="py-1.5 text-xs">
                          <span className={cn(param.is_required ? "font-medium" : "")}>{param.name}</span>
                          {param.is_required && <span className="text-destructive ml-1">*</span>}
                        </TableCell>
                        <TableCell className="min-w-[200px] py-1">{renderInlineInput(item, param)}</TableCell>
                        <TableCell className="py-1 text-xs text-muted-foreground">
                          {param.normal_text ||
                            (param.normal_min !== undefined && param.normal_max !== undefined
                              ? `${param.normal_min} - ${param.normal_max}`
                              : "-")}
                        </TableCell>
                        <TableCell className="py-1 text-xs text-muted-foreground">{param.unit || "-"}</TableCell>
                      </TableRow>
                    ));
                  })}
                </TableBody>
              </Table>
              </div>
            </div>
          </div>
        )}

        {isLocked && (
          <div className="bg-muted/50 border border-muted rounded-md p-3 text-sm text-muted-foreground">
            <p>
              {readOnly
                ? "Mode baca saja - Hasil konsultasi tidak dapat diubah"
                : order?.status === "completed"
                  ? "Order konsultasi sudah selesai - hasil tidak dapat diubah"
                  : "Anda tidak memiliki akses untuk menyimpan hasil order konsultasi"}
            </p>
          </div>
        )}

        {!isLocked && (
          <div className="mt-2 flex justify-end">
            <Button onClick={handleSave} disabled={saving || !order}>
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Menyimpan...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Simpan
                </>
              )}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
