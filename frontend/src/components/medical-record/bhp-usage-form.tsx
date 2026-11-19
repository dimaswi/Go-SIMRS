import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { Loader2, PackageOpen, Plus, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Combobox } from "@/components/ui/combobox";
import { useToast } from "@/hooks/use-toast";
import { bhpUsageApi, type BHPUsageAvailableItem, type BHPUsageRecord } from "@/lib/api";
import { emitMedicalRecordTabIndicator } from "./tab-indicator";

interface BHPUsageFormProps {
  visitId: number;
  readOnly?: boolean;
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(value || 0);

const toLocalInput = (value?: string | Date) => {
  if (!value) return "";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

export function BHPUsageForm({ visitId, readOnly = false }: BHPUsageFormProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [records, setRecords] = useState<BHPUsageRecord[]>([]);
  const [availableItems, setAvailableItems] = useState<BHPUsageAvailableItem[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  const [inventoryId, setInventoryId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [usedAt, setUsedAt] = useState("");
  const [notes, setNotes] = useState("");

  const selectedItem = useMemo(
    () => availableItems.find((item) => String(item.inventory_id) === inventoryId),
    [availableItems, inventoryId],
  );

  const itemOptions = useMemo(
    () =>
      availableItems.map((item) => ({
        value: String(item.inventory_id),
        label: `${item.name} (${item.current_stock} ${item.unit})`,
      })),
    [availableItems],
  );

  const totalRows = records.length;

  const breakdown = useMemo(() => {
    const grouped = new Map<number, { inventory_id: number; name: string; unit: string; quantity: number; subtotal: number }>();
    records.forEach((record) => {
      const id = record.inventory_id;
      const current = grouped.get(id) || {
        inventory_id: id,
        name: record.inventory?.name || "BHP",
        unit: record.unit || record.inventory?.unit || "",
        quantity: 0,
        subtotal: 0,
      };
      current.quantity += record.quantity || 0;
      current.subtotal += record.subtotal || 0;
      grouped.set(id, current);
    });
    return Array.from(grouped.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [records]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [usageRes, itemRes] = await Promise.all([
        bhpUsageApi.getAll(visitId),
        bhpUsageApi.getAvailableItems(visitId),
      ]);
      setRecords(usageRes.data?.data || []);
      setAvailableItems(itemRes.data?.data || []);
    } catch {
      toast({
        title: "Gagal",
        description: "Data penggunaan BHP tidak dapat dimuat.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, [visitId]);

  useEffect(() => {
    emitMedicalRecordTabIndicator("bhp-usage", totalRows > 0 ? String(totalRows) : "");
  }, [totalRows]);

  const resetForm = () => {
    setEditingId(null);
    setInventoryId("");
    setQuantity("1");
    setUsedAt(toLocalInput(new Date()));
    setNotes("");
  };

  const openAddDialog = () => {
    resetForm();
    setIsDialogOpen(true);
  };

  const openEditDialog = (record: BHPUsageRecord) => {
    setEditingId(record.id);
    setInventoryId(String(record.inventory_id));
    setQuantity(String(record.quantity || 1));
    setUsedAt(toLocalInput(record.used_at));
    setNotes(record.notes || "");
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    const qty = Number(quantity);
    if (!inventoryId || !Number.isFinite(qty) || qty <= 0) {
      toast({
        title: "Validasi gagal",
        description: "Pilih item BHP dan isi jumlah yang valid.",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        inventory_id: Number(inventoryId),
        quantity: qty,
        unit_price: selectedItem?.price || 0,
        used_at: usedAt ? new Date(usedAt).toISOString() : undefined,
        notes: notes.trim() || undefined,
      };

      if (editingId) {
        await bhpUsageApi.update(visitId, editingId, payload);
      } else {
        await bhpUsageApi.create(visitId, payload);
      }

      setIsDialogOpen(false);
      resetForm();
      await loadData();
      toast({
        title: "Berhasil",
        description: editingId ? "Penggunaan BHP berhasil diperbarui." : "Penggunaan BHP berhasil ditambahkan.",
      });
    } catch (error: any) {
      toast({
        title: "Gagal",
        description: error?.response?.data?.error || "Gagal menyimpan penggunaan BHP.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm("Hapus data penggunaan BHP ini?")) return;
    try {
      await bhpUsageApi.delete(visitId, id);
      await loadData();
      toast({
        title: "Berhasil",
        description: "Data penggunaan BHP berhasil dihapus.",
      });
    } catch (error: any) {
      toast({
        title: "Gagal",
        description: error?.response?.data?.error || "Gagal menghapus data penggunaan BHP.",
        variant: "destructive",
      });
    }
  };

  const totalSubtotal = useMemo(
    () => records.reduce((sum, record) => sum + (record.subtotal || 0), 0),
    [records],
  );

  if (loading) {
    return (
      <div className="-mx-4 sm:-mx-5 -my-4 sm:-my-5 p-6 sm:p-8 flex items-center justify-center min-h-[220px]">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="-mx-4 sm:-mx-5 -my-4 sm:-my-5 divide-y divide-neutral-200 dark:divide-neutral-800 border-b border-neutral-200 dark:border-neutral-800">
      {/* Header Section */}
      <div className="p-4 sm:p-5 flex flex-wrap items-center justify-between gap-3">
        <div className="border-l-2 border-neutral-900 dark:border-neutral-100 pl-2.5">
          <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-900 dark:text-neutral-100">
            Penggunaan Penunjang / BHP
          </h3>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Catat pemakaian bahan habis pakai dan alat penunjang selama kunjungan.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 px-2.5 py-1 text-[11px] font-mono text-muted-foreground">
            {totalRows} item • {formatCurrency(totalSubtotal)}
          </span>
          {!readOnly && (
            <Button
              type="button"
              onClick={openAddDialog}
              className="h-8 rounded-none text-xs gap-1.5 bg-neutral-900 hover:bg-neutral-800 text-white dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
            >
              <Plus className="h-3.5 w-3.5" />
              Tambah BHP
            </Button>
          )}
        </div>
      </div>

      {/* Breakdown Section */}
      {breakdown.length > 0 && (
        <div className="p-4 sm:p-5 space-y-2.5">
          <div className="border-l-2 border-neutral-900 dark:border-neutral-100 pl-2.5 text-xs font-bold uppercase tracking-wider text-neutral-900 dark:text-neutral-100">
            Ringkasan Per Bahan
          </div>
          <div className="border border-neutral-200 dark:border-neutral-800 overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 text-[11px] uppercase tracking-wider text-muted-foreground">
                  <th className="px-3 py-2 text-left font-semibold">Bahan</th>
                  <th className="px-3 py-2 text-right font-semibold">Qty</th>
                  <th className="px-3 py-2 text-right font-semibold">Subtotal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
                {breakdown.map((item) => (
                  <tr key={item.inventory_id} className="hover:bg-neutral-50/50 dark:hover:bg-neutral-900/30">
                    <td className="px-3 py-2 font-medium">{item.name}</td>
                    <td className="px-3 py-2 text-right font-mono">
                      {item.quantity} {item.unit}
                    </td>
                    <td className="px-3 py-2 text-right font-mono font-semibold">
                      {formatCurrency(item.subtotal)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Usage List Section */}
      <div className="p-4 sm:p-5 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="border-l-2 border-neutral-900 dark:border-neutral-100 pl-2.5 text-xs font-bold uppercase tracking-wider text-neutral-900 dark:text-neutral-100">
            Riwayat Pemakaian BHP
          </div>
          <span className="text-[11px] font-mono text-muted-foreground">{records.length} entri</span>
        </div>

        {records.length > 0 ? (
          <div className="border border-neutral-200 dark:border-neutral-800 overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 text-[11px] uppercase tracking-wider text-muted-foreground">
                  <th className="px-3 py-2 text-left font-semibold">Waktu</th>
                  <th className="px-3 py-2 text-left font-semibold">Bahan</th>
                  <th className="px-3 py-2 text-right font-semibold">Qty</th>
                  <th className="px-3 py-2 text-right font-semibold">Harga</th>
                  <th className="px-3 py-2 text-right font-semibold">Subtotal</th>
                  <th className="px-3 py-2 text-left font-semibold">Catatan</th>
                  {!readOnly && <th className="px-3 py-2 text-right font-semibold">Aksi</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
                {records.map((record) => (
                  <tr key={record.id} className="transition-colors hover:bg-neutral-50/50 dark:hover:bg-neutral-900/30">
                    <td className="px-3 py-2.5 font-mono text-[11px] text-muted-foreground whitespace-nowrap">
                      {record.used_at ? format(new Date(record.used_at), "dd MMM yyyy HH:mm", { locale: localeId }) : "-"}
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="font-medium text-foreground">{record.inventory?.name || "-"}</div>
                      <div className="text-[11px] font-mono text-muted-foreground">{record.inventory?.code || "-"}</div>
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono whitespace-nowrap">
                      {record.quantity} {record.unit}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono whitespace-nowrap">
                      {formatCurrency(record.unit_price || 0)}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono font-semibold whitespace-nowrap">
                      {formatCurrency(record.subtotal || 0)}
                    </td>
                    <td className="px-3 py-2.5 text-muted-foreground">{record.notes || "-"}</td>
                    {!readOnly && (
                      <td className="px-3 py-2.5">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 rounded-none text-muted-foreground hover:text-foreground"
                            onClick={() => openEditDialog(record)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 rounded-none text-destructive hover:bg-destructive/10"
                            onClick={() => handleDelete(record.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="border border-dashed border-neutral-300 dark:border-neutral-700 py-8 px-4 flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <PackageOpen className="h-4 w-4 opacity-60 shrink-0" />
            <span>Belum ada penggunaan BHP — tambahkan data pemakaian bahan habis pakai untuk kunjungan ini.</span>
          </div>
        )}
      </div>

      {/* Add / Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-lg rounded-none p-0 gap-0 border-neutral-200 dark:border-neutral-800 overflow-hidden flex flex-col">
          <DialogHeader className="px-4 py-3 border-b border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="size-8 bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 flex items-center justify-center shrink-0">
                <PackageOpen className="h-4 w-4" />
              </div>
              <div className="text-left min-w-0">
                <DialogTitle className="text-sm font-bold uppercase tracking-tight">
                  {editingId ? "Edit Penggunaan BHP" : "Tambah Penggunaan BHP"}
                </DialogTitle>
                <DialogDescription className="text-xs mt-0.5">
                  Pilih item BHP ruangan, jumlah pemakaian, waktu pakai, dan catatan bila perlu.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="p-4 sm:p-5 space-y-4 [&_input]:h-9 [&_[role=combobox]]:h-9 [&_input]:rounded-none [&_textarea]:rounded-none [&_[role=combobox]]:rounded-none [&_input]:text-xs [&_[role=combobox]]:text-xs">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Item BHP *</Label>
              <Combobox
                options={itemOptions}
                value={inventoryId}
                onValueChange={(value) => setInventoryId(value || "")}
                placeholder="Pilih item BHP"
                searchPlaceholder="Cari BHP..."
                emptyText="Tidak ada stok BHP di ruangan ini"
                className="w-full"
              />
            </div>

            {selectedItem && (
              <div className="border border-neutral-200 dark:border-neutral-800 border-l-4 border-l-neutral-900 dark:border-l-neutral-100 bg-neutral-50/60 dark:bg-neutral-900/40 px-3 py-2 flex items-center justify-between gap-2 text-xs">
                <span className="text-muted-foreground">
                  Stok tersedia:{" "}
                  <strong className="text-foreground font-mono">
                    {selectedItem.current_stock} {selectedItem.unit}
                  </strong>
                </span>
                <span className="text-muted-foreground">
                  Harga:{" "}
                  <strong className="text-foreground font-mono">
                    {formatCurrency(selectedItem.price)}
                  </strong>
                </span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Jumlah *</Label>
                <Input
                  type="number"
                  min={1}
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Waktu Pakai</Label>
                <Input
                  type="datetime-local"
                  value={usedAt}
                  onChange={(e) => setUsedAt(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Catatan</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="min-h-[68px] resize-none text-xs rounded-none"
                placeholder="Catatan pemakaian BHP (opsional)..."
              />
            </div>
          </div>

          <DialogFooter className="px-4 sm:px-5 py-3 border-t border-neutral-200 dark:border-neutral-800 bg-neutral-50/60 dark:bg-neutral-900/40 shrink-0 gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 rounded-none px-4 text-xs"
              onClick={() => setIsDialogOpen(false)}
            >
              Batal
            </Button>
            <Button
              type="button"
              size="sm"
              className="h-8 rounded-none px-4 text-xs bg-neutral-900 hover:bg-neutral-800 text-white dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
              onClick={handleSave}
              disabled={submitting}
            >
              {submitting ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <PackageOpen className="mr-1.5 h-3.5 w-3.5" />
              )}
              Simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

