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
import { usePermission } from "@/hooks/usePermission";
import { cn } from "@/lib/utils";
import { Loader2, Save, User, Clock } from "lucide-react";
import { OrderDetailInfoButton } from "./order-detail-info-button";
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
          <div className="mb-4 flex items-center justify-end">
            <OrderDetailInfoButton
              title="Detail Order Konsultasi"
              tooltip="Lihat detail order konsultasi"
            >
              <table className="w-full table-fixed text-xs">
                <tbody>
                  <tr className="border-b">
                    <td className="py-1.5 text-muted-foreground w-28 align-top">Nama Pasien</td>
                    <td className="py-1.5 font-medium break-words">
                      {order.source_visit?.registration?.patient?.nama_lengkap ||
                        order.registration?.patient?.nama_lengkap ||
                        "-"}
                    </td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-1.5 text-muted-foreground w-28 align-top">No. RM</td>
                    <td className="py-1.5 font-medium break-words">
                      {order.source_visit?.registration?.patient?.no_rm ||
                        order.registration?.patient?.no_rm ||
                        "-"}
                    </td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-1.5 text-muted-foreground w-28 align-top">Dokter</td>
                    <td className="py-1.5 font-medium break-words">
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
                    </td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-1.5 text-muted-foreground w-28 align-top">Tanggal Order</td>
                    <td className="py-1.5 font-medium break-words">
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
                    </td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-1.5 text-muted-foreground w-28 align-top">No. Order</td>
                    <td className="py-1.5 font-medium break-words">{order.order_number || "-"}</td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-1.5 text-muted-foreground align-top">Jumlah Item</td>
                    <td className="py-1.5 font-medium break-words">
                      {(order.items || []).filter((item) => item.status === "completed").length}/
                      {(order.items || []).length} selesai
                    </td>
                  </tr>
                  {order.diagnosis && (
                    <tr className="border-b">
                      <td className="py-1.5 text-muted-foreground align-top">Diagnosis</td>
                      <td className="py-1.5 font-medium break-words">{order.diagnosis}</td>
                    </tr>
                  )}
                  {order.clinical_notes && (
                    <tr>
                      <td className="py-1.5 text-muted-foreground align-top">Catatan Klinis</td>
                      <td className="py-1.5 font-medium break-words">{order.clinical_notes}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </OrderDetailInfoButton>
          </div>
        )}

        {order && (
          <div className="border border-border/70 bg-background mb-4">
            <div className="p-3 sm:p-4 space-y-4">
              <div className="space-y-2 pt-2">
                <div className="border border-border/70 overflow-x-auto">
                  <div className="max-h-[62vh] overflow-auto">
                    <table className="w-full min-w-[760px] text-left text-xs">
                      <thead className="bg-muted/50 border-b border-border/70">
                        <tr>
                          <th className="py-2 px-3 font-medium">Tindakan</th>
                          <th className="py-2 px-3 font-medium">Parameter</th>
                          <th className="py-2 px-3 font-medium">Hasil</th>
                          <th className="py-2 px-3 font-medium">Normal</th>
                          <th className="py-2 px-3 font-medium">Satuan</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(order.items || []).map((item) => {
                          const parameters = item.procedure?.parameters || [];
                          const rowSpan = Math.max(parameters.length, 1);

                          if (parameters.length === 0) {
                            return (
                              <tr key={item.id || item.procedure_id} className="border-b last:border-0 hover:bg-muted/50 transition-colors">
                                <td className="py-2 px-3 text-xs font-medium border-r border-border/70">{item.procedure?.name || "-"}</td>
                                <td colSpan={4} className="py-2 px-3 text-xs text-muted-foreground italic">
                                  Tindakan ini belum punya parameter
                                </td>
                              </tr>
                            );
                          }

                          return parameters.map((param, index) => (
                            <tr key={`${item.id || item.procedure_id}-${param.id}`} className="border-b last:border-0 hover:bg-muted/50 transition-colors">
                              {index === 0 && (
                                <td rowSpan={rowSpan} className="align-top border-r border-border/70 py-2 px-3">
                                  <div className="text-xs font-medium">{item.procedure?.name || "-"}</div>
                                  <div className="text-[11px] text-muted-foreground">{item.procedure?.code || ""}</div>
                                </td>
                              )}
                              <td className="py-2 px-3 text-xs">
                                <span className={cn(param.is_required ? "font-medium" : "")}>{param.name}</span>
                                {param.is_required && <span className="text-destructive ml-1">*</span>}
                              </td>
                              <td className="min-w-[200px] py-2 px-3">{renderInlineInput(item, param)}</td>
                              <td className="py-2 px-3 text-xs text-muted-foreground">
                                {param.normal_text ||
                                  (param.normal_min !== undefined && param.normal_max !== undefined
                                    ? `${param.normal_min} - ${param.normal_max}`
                                    : "-")}
                              </td>
                              <td className="py-2 px-3 text-xs text-muted-foreground">{param.unit || "-"}</td>
                            </tr>
                          ));
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {!order && (
          <div className="bg-muted/40 border rounded-lg p-4 mb-6 text-sm text-muted-foreground">
            Tidak ada order konsultasi aktif untuk visit ini.
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
