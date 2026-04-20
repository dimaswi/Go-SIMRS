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
import { Loader2, Save, CheckCircle2, User, Clock } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  procedureOrdersApi,
} from "@/lib/api";
import type {
  ProcedureOrder,
  ProcedureOrderItem,
  ProcedureParameter,
} from "@/lib/api/procedure-orders";

interface ConsultationFormProps {
  visitId: number;
  readOnly?: boolean;
  rmDuplicateMode?: boolean;
  apiAdapter?: Pick<
    typeof procedureOrdersApi,
    "getAll" | "saveResults" | "complete"
  >;
  duplicateDoctorOptions?: { id: number; name: string }[];
  onUpdateDuplicateOrderMeta?: (
    runtimeOrderId: number,
    updates: { fake_date?: string; doctor_name?: string },
  ) => void;
}

export function ConsultationForm({
  visitId,
  readOnly = false,
  rmDuplicateMode = false,
  apiAdapter,
  duplicateDoctorOptions = [],
  onUpdateDuplicateOrderMeta,
}: ConsultationFormProps) {
  const { toast } = useToast();
  const { hasPermission } = usePermission();
  const canPerform = hasPermission("procedure_orders.perform");
  const orderApi = apiAdapter || procedureOrdersApi;
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [order, setOrder] = useState<ProcedureOrder | null>(null);
  const [inlineResults, setInlineResults] = useState<Record<number, Record<number, string>>>({});
  const [doctorModalOpen, setDoctorModalOpen] = useState(false);
  const [dateModalOpen, setDateModalOpen] = useState(false);
  const [doctorSearch, setDoctorSearch] = useState("");
  const [pendingDoctorName, setPendingDoctorName] = useState("");
  const [pendingOrderDate, setPendingOrderDate] = useState("");

  useEffect(() => {
    loadConsultation();
  }, [visitId, apiAdapter]);

  const loadConsultation = async () => {
    setLoading(true);
    try {
      const orderRes = await orderApi.getAll({ target_visit_id: visitId, order_type: "consultation" });

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

  // In RM-duplicate mode the top-level "Simpan RM Duplikat" button handles persisting data,
  // so we hide the per-section Simpan button by treating the form as locked.
  const isLocked = readOnly || rmDuplicateMode || !canPerform || order?.status === "completed";

  useEffect(() => {
    if (!order) return;
    setPendingDoctorName(order.ordered_by?.nama_lengkap || "");
    setPendingOrderDate((order.created_at || "").replace(" ", "T").slice(0, 16));
    setDoctorSearch("");
  }, [order]);

  const applyDuplicateDoctor = (doctorName: string) => {
    if (!order) return;
    const nextDoctor = doctorName.trim();
    setOrder((prev) =>
      prev
        ? {
            ...prev,
            ordered_by: nextDoctor
              ? { id: 0, nama_lengkap: nextDoctor }
              : undefined,
          }
        : prev,
    );
    onUpdateDuplicateOrderMeta?.(order.id, {
      doctor_name: nextDoctor,
    });
    setDoctorModalOpen(false);
  };

  const applyDuplicateDate = () => {
    if (!order) return;
    const nextDate = pendingOrderDate ? `${pendingOrderDate}:00` : "";
    if (!nextDate) {
      setDateModalOpen(false);
      return;
    }
    setOrder((prev) =>
      prev
        ? {
            ...prev,
            created_at: nextDate,
            updated_at: nextDate,
          }
        : prev,
    );
    onUpdateDuplicateOrderMeta?.(order.id, {
      fake_date: nextDate,
    });
    setDateModalOpen(false);
  };

  const getStatusDotClass = (status?: string) => {
    switch (status) {
      case "completed":
        return "bg-emerald-500";
      case "in_progress":
        return "bg-blue-500";
      case "pending":
        return "bg-amber-500";
      case "cancelled":
        return "bg-rose-500";
      default:
        return "bg-zinc-400";
    }
  };

  const getOrderStatusLabel = (status?: string) => {
    switch (status) {
      case "completed":
        return "Selesai";
      case "in_progress":
        return "Dikerjakan";
      case "pending":
        return "Menunggu";
      case "cancelled":
        return "Dibatalkan";
      default:
        return status || "Unknown";
    }
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

      await orderApi.saveResults(order.id, {
        result_summary: "",
        conclusion: "",
        suggestion: "",
        items: mappedItems,
      });

      await orderApi.complete(order.id);

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
      <div className="pt-2">
        {order && (
          <div className="mb-2 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2 text-[11px] p-1.5 bg-muted/50 rounded items-center">
              <div className="flex items-center gap-1">
                <User className="h-3 w-3 text-muted-foreground" />
                <span className="font-medium truncate">
                  {order.source_visit?.registration?.patient?.nama_lengkap ||
                    order.registration?.patient?.nama_lengkap ||
                    "-"}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-muted-foreground shrink-0">RM:</span>
                <span className="font-medium">
                  {order.source_visit?.registration?.patient?.no_rm ||
                    order.registration?.patient?.no_rm ||
                    "-"}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-muted-foreground shrink-0">Dokter:</span>
                {rmDuplicateMode ? (
                  <span className="inline-flex items-center gap-1">
                    <span className="font-medium">{order.ordered_by?.nama_lengkap || "-"}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5"
                      title="Pilih dokter"
                      onClick={() => {
                        setPendingDoctorName(order.ordered_by?.nama_lengkap || "");
                        setDoctorSearch("");
                        setDoctorModalOpen(true);
                      }}
                    >
                      <User className="h-3 w-3" />
                    </Button>
                  </span>
                ) : (
                  order.ordered_by?.nama_lengkap || "-"
                )}
              </div>
              <div className="flex items-center gap-1">
                <Clock className="h-3 w-3 text-muted-foreground" />
                {rmDuplicateMode ? (
                  <span className="inline-flex items-center gap-1">
                    <span className="font-medium">
                      {order.created_at
                        ? new Date(order.created_at).toLocaleString("id-ID")
                        : "-"}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5"
                      title="Set tanggal order"
                      onClick={() => {
                        setPendingOrderDate((order.created_at || "").replace(" ", "T").slice(0, 16));
                        setDateModalOpen(true);
                      }}
                    >
                      <Clock className="h-3 w-3" />
                    </Button>
                  </span>
                ) : (
                  <span>
                    {order.created_at ? new Date(order.created_at).toLocaleString("id-ID") : "-"}
                  </span>
                )}
              </div>
            </div>

            {order.clinical_notes && (
              <div className="p-2 bg-yellow-50 border border-yellow-200 rounded text-xs">
                <span className="font-medium text-yellow-800">Catatan Klinis:</span>
                <span className="ml-1">{order.clinical_notes}</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
              <div className="p-2 rounded border bg-muted/30">
                <span className="text-muted-foreground">No. Order</span>
                <p className="font-medium mt-0.5">{order.order_number || "-"}</p>
              </div>
              <div className="p-2 rounded border bg-muted/30">
                <span className="text-muted-foreground">Item Selesai</span>
                <p className="font-medium mt-0.5">
                  {(order.items || []).filter((item) => item.status === "completed").length}/
                  {(order.items || []).length}
                </p>
              </div>
              <div className="p-2 rounded border bg-muted/30">
                <span className="text-muted-foreground">Status Order</span>
                <div className="mt-1">
                  <div className="flex items-center gap-1.5 font-medium">
                    <span className={cn("h-1.5 w-1.5 rounded-full", getStatusDotClass(order.status))} />
                    <span>{getOrderStatusLabel(order.status)}</span>
                  </div>
                </div>
              </div>
            </div>

            {order.diagnosis && (
              <div className="rounded bg-background/70 px-2 py-1 text-xs">
                <span className="text-muted-foreground">Diagnosis: </span>
                <span className="font-medium">{order.diagnosis}</span>
              </div>
            )}
          </div>
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

        {rmDuplicateMode && order && (
          <Dialog open={doctorModalOpen} onOpenChange={setDoctorModalOpen}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Pilih Dokter Order</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <Input
                  value={pendingDoctorName}
                  onChange={(e) => setPendingDoctorName(e.target.value)}
                  placeholder="Nama dokter"
                />
                <Input
                  value={doctorSearch}
                  onChange={(e) => setDoctorSearch(e.target.value)}
                  placeholder="Cari dari daftar dokter..."
                />
                <div className="max-h-52 overflow-y-auto rounded border divide-y">
                  <button
                    type="button"
                    className="w-full px-3 py-2 text-left text-sm hover:bg-muted"
                    onClick={() => setPendingDoctorName("")}
                  >
                    -
                  </button>
                  {duplicateDoctorOptions
                    .filter((doc) =>
                      doc.name
                        .toLowerCase()
                        .includes(doctorSearch.toLowerCase()),
                    )
                    .map((doc) => (
                      <button
                        key={doc.id}
                        type="button"
                        className="w-full px-3 py-2 text-left text-sm hover:bg-muted"
                        onClick={() => setPendingDoctorName(doc.name)}
                      >
                        {doc.name}
                      </button>
                    ))}
                </div>
                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setDoctorModalOpen(false)}
                  >
                    Batal
                  </Button>
                  <Button
                    type="button"
                    onClick={() => applyDuplicateDoctor(pendingDoctorName)}
                  >
                    Simpan
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}

        {rmDuplicateMode && order && (
          <Dialog open={dateModalOpen} onOpenChange={setDateModalOpen}>
            <DialogContent className="sm:max-w-sm">
              <DialogHeader>
                <DialogTitle>Set Tanggal Order</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <Input
                  type="datetime-local"
                  value={pendingOrderDate}
                  onChange={(e) => setPendingOrderDate(e.target.value)}
                />
                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setDateModalOpen(false)}
                  >
                    Batal
                  </Button>
                  <Button type="button" onClick={applyDuplicateDate}>
                    Simpan
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>
    </div>
  );
}
