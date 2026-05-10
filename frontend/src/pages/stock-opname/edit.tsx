import { useState, useEffect, useCallback, type ComponentType, type ReactNode } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PageShell, PageHeader, PageContent } from "@/components/layout/page-shell";
import { useToast } from "@/hooks/use-toast";
import { setPageTitle } from "@/lib/page-title";
import {
  stockOpnameApi,
  stockOpnameStatusLabels,
  type StockOpname,
} from "@/lib/api/stock-requests";
import { ArrowLeft, AlertTriangle, Building2, ClipboardList, FileText, Loader2, Package, Pill } from "lucide-react";

interface EditItem {
  id: number;
  inventory_id?: number;
  medicine_id?: number;
  name: string;
  code: string;
  unit: string;
  system_stock: number;
  actual_stock: number;
  difference: number;
  notes: string;
}

function SectionPanel({
  icon: Icon,
  title,
  description,
  actions,
  children,
}: {
  icon: ComponentType<{ className?: string }>;
  title: string;
  description: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="border border-border/70 bg-background/95 shadow-sm">
      <div className="border-b border-border/70 bg-muted/20 px-4 py-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="border border-border/70 bg-background p-2">
              <Icon className="h-4 w-4 text-muted-foreground" />
            </div>
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">{title}</div>
              <p className="mt-1 text-xs text-muted-foreground">{description}</p>
            </div>
          </div>
          {actions}
        </div>
      </div>
      <div className="space-y-4 p-3 sm:p-4">{children}</div>
    </div>
  );
}

function SummaryCue({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: string;
}) {
  return (
    <div className={`border border-border/70 bg-gradient-to-br px-4 py-3 ${tone}`}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-semibold text-foreground">{value}</p>
    </div>
  );
}

export default function StockOpnameEdit() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [stockOpname, setStockOpname] = useState<StockOpname | null>(null);
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<EditItem[]>([]);

  const loadData = useCallback(async () => {
    try {
      const response = await stockOpnameApi.getById(Number(id));
      const data = response.data.data as StockOpname;

      // Check if editable (only draft or in_progress status)
      if (data.status !== "draft" && data.status !== "in_progress") {
        toast({
          variant: "destructive",
          title: "Error",
          description: "Stock opname yang sudah selesai tidak dapat diedit.",
        });
        navigate(`/stock-opname/${id}`);
        return;
      }

      setStockOpname(data);
      setNotes(data.notes || "");

      // Map items
      const editItems: EditItem[] = (data.items || []).map((item) => {
        const itemData = item.inventory || item.medicine;
        return {
          id: item.id,
          inventory_id: item.inventory_id,
          medicine_id: item.medicine_id,
          name: itemData?.name || "",
          code: itemData?.code || "",
          unit: item.unit || itemData?.unit || "",
          system_stock: item.system_stock,
          actual_stock: item.physical_stock,
          difference: item.difference,
          notes: item.notes || "",
        };
      });
      setItems(editItems);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Gagal memuat data stock opname.",
      });
      navigate("/stock-opname");
    } finally {
      setLoading(false);
    }
  }, [id, navigate, toast]);

  useEffect(() => {
    setPageTitle("Edit Stock Opname");
    loadData();
  }, [loadData]);

  const handleItemChange = (itemId: number, field: string, value: any) => {
    setItems(
      items.map((item) => {
        if (item.id === itemId) {
          const updated = { ...item, [field]: value };
          if (field === "actual_stock") {
            updated.difference = value - item.system_stock;
          }
          return updated;
        }
        return item;
      })
    );
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      await stockOpnameApi.update(Number(id), {
        notes,
        items: items.map((item) => ({
          id: item.id,
          inventory_id: item.inventory_id,
          medicine_id: item.medicine_id,
          physical_stock: item.actual_stock,
          notes: item.notes,
        })),
      });

      toast({
        variant: "success",
        title: "Berhasil",
        description: "Stock opname berhasil diperbarui.",
      });
      navigate(`/stock-opname/${id}`);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.response?.data?.error || "Gagal memperbarui stock opname.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Stats
  const getDifferenceStats = () => {
    const surplus = items.filter((i) => i.difference > 0).length;
    const deficit = items.filter((i) => i.difference < 0).length;
    const match = items.filter((i) => i.difference === 0).length;
    return { surplus, deficit, match };
  };

  const stats = getDifferenceStats();

  if (loading) {
    return (
      <PageShell>
        <PageHeader title="Edit Stock Opname" description="Perbarui hasil hitung fisik dan catatan item yang masih draft atau in progress." />
        <PageContent className="flex-none pb-8">
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        </PageContent>
      </PageShell>
    );
  }

  if (!stockOpname) {
    return null;
  }

  return (
    <PageShell>
      <PageHeader
        title="Edit Stock Opname"
        description="Sesuaikan catatan dan hasil hitung fisik sebelum opname diselesaikan."
        actions={
          <Button variant="outline" onClick={() => navigate(`/stock-opname/${id}`)}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Kembali
          </Button>
        }
      />
      <PageContent className="flex-none pb-8">
        <div className="space-y-6">
          <SectionPanel
            icon={Building2}
            title="Ringkasan Opname"
            description="Status, nomor opname, ruangan, tanggal, dan petugas pencatat ditampilkan sebagai referensi kerja."
            actions={
              <Badge variant="outline">
                {stockOpnameStatusLabels[stockOpname.status] || stockOpname.status}
              </Badge>
            }
          >
            <div className="space-y-4">
              <p className="font-mono text-sm text-muted-foreground">{stockOpname.opname_number}</p>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div>
                  <p className="text-sm text-muted-foreground">Ruangan</p>
                  <p className="font-medium">{stockOpname.room?.name}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Tanggal</p>
                  <p className="font-medium">
                    {new Date(stockOpname.opname_date).toLocaleDateString("id-ID")}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Dibuat oleh</p>
                  <p className="font-medium">{stockOpname.created_by?.full_name}</p>
                </div>
              </div>
            </div>
          </SectionPanel>

          <SectionPanel
            icon={FileText}
            title="Catatan & Statistik"
            description="Gunakan ringkasan selisih untuk cepat melihat item mana yang surplus, defisit, atau sudah sesuai."
          >
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <SummaryCue label="Surplus" value={`${stats.surplus} item`} tone="from-emerald-50 via-background to-background" />
              <SummaryCue label="Defisit" value={`${stats.deficit} item`} tone="from-rose-50 via-background to-background" />
              <SummaryCue label="Sesuai" value={`${stats.match} item`} tone="from-blue-50 via-background to-background" />
            </div>

            <div className="space-y-2">
              <Label>Catatan</Label>
              <Textarea
                placeholder="Catatan stock opname..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </SectionPanel>

          <SectionPanel
            icon={ClipboardList}
            title="Daftar Item"
            description="Perbarui stok aktual per item dan gunakan indikator selisih untuk menandai anomali yang perlu ditinjau."
          >
            <div className="-mx-3 -mb-4 sm:-mx-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Kode</TableHead>
                    <TableHead>Nama</TableHead>
                    <TableHead className="text-center">Stok Sistem</TableHead>
                    <TableHead className="text-center">Stok Aktual</TableHead>
                    <TableHead className="text-center">Selisih</TableHead>
                    <TableHead>Satuan</TableHead>
                    <TableHead>Catatan</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item) => (
                    <TableRow
                      key={item.id}
                      className={
                        item.difference === 0
                          ? "bg-emerald-50/30"
                          : item.difference > 0
                          ? "bg-blue-50/30"
                          : "bg-rose-50/30"
                      }
                    >
                      <TableCell className="font-mono">{item.code}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {item.inventory_id ? (
                            <Package className="h-4 w-4 text-blue-500" />
                          ) : (
                            <Pill className="h-4 w-4 text-green-500" />
                          )}
                          {item.name}
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="secondary">{item.system_stock}</Badge>
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min={0}
                          value={item.actual_stock}
                          onChange={(e) =>
                            handleItemChange(
                              item.id,
                              "actual_stock",
                              parseInt(e.target.value) || 0
                            )
                          }
                          className="w-24 text-center"
                        />
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge
                          variant={
                            item.difference > 0
                              ? "default"
                              : item.difference < 0
                              ? "destructive"
                              : "secondary"
                          }
                          className={
                            item.difference > 0
                              ? "mx-auto flex w-fit items-center gap-1 border-blue-200 bg-blue-50 text-blue-700"
                              : item.difference < 0
                              ? "mx-auto flex w-fit items-center gap-1 border-rose-200 bg-rose-50 text-rose-700"
                              : "mx-auto flex w-fit items-center gap-1 border-emerald-200 bg-emerald-50 text-emerald-700"
                          }
                        >
                          {item.difference !== 0 && (
                            <AlertTriangle className="h-3 w-3" />
                          )}
                          {item.difference > 0 ? "+" : ""}
                          {item.difference}
                        </Badge>
                      </TableCell>
                      <TableCell>{item.unit}</TableCell>
                      <TableCell>
                        <Input
                          placeholder="Catatan..."
                          value={item.notes}
                          onChange={(e) =>
                            handleItemChange(item.id, "notes", e.target.value)
                          }
                          className="w-32"
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </SectionPanel>

          <div className="sticky bottom-0 z-10 flex justify-end gap-4 border-t bg-background py-3">
            <Button
              variant="outline"
              onClick={() => navigate(`/stock-opname/${id}`)}
            >
              Batal
            </Button>
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Simpan Perubahan
            </Button>
          </div>
        </div>
      </PageContent>
    </PageShell>
  );
}
