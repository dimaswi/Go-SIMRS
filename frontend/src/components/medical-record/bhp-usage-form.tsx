import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { Loader2, PackageOpen, Plus, Pencil, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
  const totalQty = useMemo(() => records.reduce((sum, item) => sum + (item.quantity || 0), 0), [records]);
  const totalNominal = useMemo(() => records.reduce((sum, item) => sum + (item.subtotal || 0), 0), [records]);

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

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <>
      <div className="space-y-3">
        <div className="rounded-lg border border-border/70 bg-background overflow-hidden">
          <div className="border-b border-border/70 bg-muted/30 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <PackageOpen className="h-3.5 w-3.5" />
                Penggunaan BHP
              </span>
              {!readOnly && (
                <Button onClick={openAddDialog} size="sm" className="h-6 px-2 py-0 text-[10px]">
                  <Plus className="mr-1 h-3.5 w-3.5" />Tambah
                </Button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 border-b border-border/70 bg-muted/10 px-4 py-2.5 text-xs md:grid-cols-4">
            <div>
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Total Entry</p>
              <p className="text-base font-semibold">{totalRows}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Total Qty</p>
              <p className="text-base font-semibold">{totalQty}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Jenis BHP</p>
              <p className="text-base font-semibold">{breakdown.length}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Total Nilai</p>
              <p className="text-base font-semibold text-emerald-600">{formatCurrency(totalNominal)}</p>
            </div>
          </div>

          {breakdown.length > 0 && (
            <div className="border-b border-border/70 px-4 py-3">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Breakdown Per Bahan</p>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b bg-muted/30 text-muted-foreground">
                      <th className="px-3 py-1.5 text-left font-medium">Bahan</th>
                      <th className="px-3 py-1.5 text-right font-medium">Qty</th>
                      <th className="px-3 py-1.5 text-right font-medium">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {breakdown.map((item) => (
                      <tr key={item.inventory_id} className="border-b last:border-b-0">
                        <td className="px-3 py-1.5">{item.name}</td>
                        <td className="px-3 py-1.5 text-right">{item.quantity} {item.unit}</td>
                        <td className="px-3 py-1.5 text-right">{formatCurrency(item.subtotal)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b bg-muted/50 text-muted-foreground">
                  <th className="px-4 py-2 text-left font-medium">Waktu</th>
                  <th className="px-4 py-2 text-left font-medium">Bahan</th>
                  <th className="px-4 py-2 text-right font-medium">Qty</th>
                  <th className="px-4 py-2 text-right font-medium">Harga</th>
                  <th className="px-4 py-2 text-right font-medium">Subtotal</th>
                  <th className="px-4 py-2 text-left font-medium">Catatan</th>
                  {!readOnly && <th className="px-4 py-2 text-right font-medium">Aksi</th>}
                </tr>
              </thead>
              <tbody>
                {records.length > 0 ? (
                  records.map((record) => (
                    <tr key={record.id} className="border-b transition-colors hover:bg-muted/20">
                      <td className="px-4 py-2">
                        {record.used_at ? format(new Date(record.used_at), "dd MMM yyyy HH:mm", { locale: localeId }) : "-"}
                      </td>
                      <td className="px-4 py-2">
                        <div className="font-medium">{record.inventory?.name || "-"}</div>
                        <div className="text-[11px] text-muted-foreground">{record.inventory?.code || "-"}</div>
                      </td>
                      <td className="px-4 py-2 text-right">{record.quantity} {record.unit}</td>
                      <td className="px-4 py-2 text-right">{formatCurrency(record.unit_price || 0)}</td>
                      <td className="px-4 py-2 text-right font-semibold">{formatCurrency(record.subtotal || 0)}</td>
                      <td className="px-4 py-2">{record.notes || "-"}</td>
                      {!readOnly && (
                        <td className="px-4 py-2">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 rounded-none text-muted-foreground hover:text-foreground"
                              onClick={() => openEditDialog(record)}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 rounded-none text-destructive hover:bg-destructive/10"
                              onClick={() => handleDelete(record.id)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={readOnly ? 6 : 7} className="px-4 py-10 text-center text-muted-foreground">
                      <div className="flex flex-col items-center gap-2">
                        <PackageOpen className="h-10 w-10 opacity-40" />
                        <p className="text-sm font-medium">Belum ada penggunaan BHP</p>
                        <p className="text-xs">Tambahkan data pemakaian bahan habis pakai untuk kunjungan ini.</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="!max-w-lg !rounded-none [&>button]:hidden">
          <DialogHeader className="border-b pb-3 flex flex-row items-center justify-between">
            <DialogTitle className="flex items-center gap-2 text-sm uppercase tracking-wider text-muted-foreground">
              <PackageOpen className="h-4 w-4" />
              {editingId ? "Edit Penggunaan BHP" : "Tambah Penggunaan BHP"}
            </DialogTitle>
            <Button variant="ghost" size="icon" onClick={() => setIsDialogOpen(false)} className="h-6 w-6 rounded-none">
              <X className="h-4 w-4" />
            </Button>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Item BHP</Label>
              <Combobox
                options={itemOptions}
                value={inventoryId}
                onValueChange={(value) => setInventoryId(value || "")}
                placeholder="Pilih item BHP"
                searchPlaceholder="Cari BHP..."
                emptyText="Tidak ada stok BHP di ruangan ini"
                className="h-9"
              />
              {selectedItem && (
                <p className="text-xs text-muted-foreground">
                  Stok: <span className="font-semibold text-foreground">{selectedItem.current_stock} {selectedItem.unit}</span>
                  {" - "}
                  Harga: <span className="font-semibold text-foreground">{formatCurrency(selectedItem.price)}</span>
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Jumlah</Label>
                <Input
                  type="number"
                  min={1}
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Waktu Pakai</Label>
                <Input
                  type="datetime-local"
                  value={usedAt}
                  onChange={(e) => setUsedAt(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Catatan</Label>
              <Input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="h-9 text-xs"
                placeholder="Opsional"
              />
            </div>
          </div>

          <div className="border-t pt-3 flex justify-end gap-2">
            <Button variant="outline" className="rounded-none text-xs h-9" onClick={() => setIsDialogOpen(false)}>Batal</Button>
            <Button className="rounded-none text-xs h-9" onClick={handleSave} disabled={submitting}>
              {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PackageOpen className="mr-2 h-4 w-4" />}Simpan
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

