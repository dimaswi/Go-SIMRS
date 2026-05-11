import { useState, useEffect, useCallback, type ComponentType, type ReactNode } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { PageShell, PageHeader, PageContent } from "@/components/layout/page-shell";
import { useToast } from "@/hooks/use-toast";
import { setPageTitle } from "@/lib/page-title";
import { cn } from "@/lib/utils";
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
  className,
  headerClassName,
  contentClassName,
}: {
  icon: ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  headerClassName?: string;
  contentClassName?: string;
}) {
  return (
    <div className={cn("border border-border/70 bg-background/95", className)}>
      <div className={cn("border-b border-border/70 bg-muted/20 px-2.5 py-2 sm:px-3", headerClassName)}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="border border-border/70 bg-background p-1.5">
              <Icon className="h-4 w-4 text-muted-foreground" />
            </div>
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">{title}</div>
              {description ? <p className="mt-1 text-xs text-muted-foreground">{description}</p> : null}
            </div>
          </div>
          {actions}
        </div>
      </div>
      <div className={cn("space-y-3 p-2.5 sm:p-3", contentClassName)}>{children}</div>
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
    <PageShell className="lg:overflow-hidden">
      <PageHeader
        title="Edit Stock Opname"
        description="Sesuaikan catatan dan hasil hitung fisik sebelum opname diselesaikan."
        actions={
          <Button variant="outline" size="sm" onClick={() => navigate(`/stock-opname/${id}`)}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Kembali
          </Button>
        }
      />
      <PageContent className="min-h-0 overflow-hidden pb-3">
        <div className="grid min-h-0 flex-1 gap-3 [&_label]:text-[10px] [&_label]:uppercase [&_label]:tracking-[0.08em] [&_label]:text-muted-foreground [&_input]:h-8 lg:grid-cols-[minmax(320px,380px)_minmax(0,1fr)] xl:grid-cols-[minmax(330px,390px)_minmax(0,1fr)]">
          <div className="min-h-0 overflow-hidden">
            <div className="flex h-full min-h-0 flex-col gap-3 overflow-y-auto pr-1">
              <SectionPanel
                icon={Building2}
                title="Ringkasan Opname"
                description="Status, nomor opname, ruangan."
                actions={
                  <Badge variant="outline" className="h-5 px-2 text-[10px]">
                    {stockOpnameStatusLabels[stockOpname.status] || stockOpname.status}
                  </Badge>
                }
              >
                <div className="space-y-3 border-b border-border/70 pb-3">
                  <p className="font-mono text-sm text-muted-foreground">{stockOpname.opname_number}</p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <p className="text-xs text-muted-foreground">Ruangan</p>
                      <p className="text-sm font-medium">{stockOpname.room?.name}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Tanggal</p>
                      <p className="text-sm font-medium">{new Date(stockOpname.opname_date).toLocaleDateString("id-ID")}</p>
                    </div>
                    <div className="sm:col-span-2">
                      <p className="text-xs text-muted-foreground">Dibuat oleh</p>
                      <p className="text-sm font-medium">{stockOpname.conducted_by?.full_name || "-"}</p>
                    </div>
                  </div>
                </div>
              </SectionPanel>

              <SectionPanel
                icon={FileText}
                title="Catatan & Statistik"
                description="Gunakan ringkasan selisih untuk cepat melihat item mana yang surplus, defisit, atau sudah sesuai."
              >
                <div className="grid gap-3 sm:grid-cols-3">
                  <SummaryCue label="Surplus" value={`${stats.surplus} item`} tone="from-emerald-50 via-background to-background" />
                  <SummaryCue label="Defisit" value={`${stats.deficit} item`} tone="from-rose-50 via-background to-background" />
                  <SummaryCue label="Sesuai" value={`${stats.match} item`} tone="from-blue-50 via-background to-background" />
                </div>

                <div className="space-y-1 pt-1">
                  <Label>Catatan</Label>
                  <Textarea className="min-h-[110px] resize-none" placeholder="Catatan stock opname..." value={notes} onChange={(e) => setNotes(e.target.value)} />
                </div>
              </SectionPanel>
            </div>
          </div>

          <div className="flex min-h-0 flex-col overflow-hidden">
            <SectionPanel
              icon={ClipboardList}
              title="Daftar Item"
              description="Perbarui stok aktual per item dan gunakan indikator selisih untuk menandai anomali yang perlu ditinjau."
              className="flex min-h-0 flex-1 flex-col overflow-hidden"
              headerClassName="px-2.5 py-2 sm:px-3"
              contentClassName="flex min-h-0 flex-1 flex-col overflow-hidden px-2.5 py-2.5 sm:px-3"
            >
              <div className="min-h-0 flex-1 overflow-hidden rounded-lg border border-border/80 bg-background">
                <ScrollArea className="h-full">
                  <table className="w-full table-fixed border-collapse text-sm">
                    <thead className="sticky top-0 z-10 bg-background">
                      <tr className="bg-muted/20">
                        <th className="h-9 w-[28%] border-b border-r border-border/70 px-3 text-left text-[10px] font-semibold uppercase tracking-[0.18em] text-foreground/80">Item</th>
                        <th className="h-9 w-[16%] border-b border-r border-border/70 px-3 text-left text-[10px] font-semibold uppercase tracking-[0.18em] text-foreground/80">Tipe</th>
                        <th className="h-9 w-[14%] border-b border-r border-border/70 px-3 text-left text-[10px] font-semibold uppercase tracking-[0.18em] text-foreground/80">Sistem</th>
                        <th className="h-9 w-[18%] border-b border-r border-border/70 px-3 text-left text-[10px] font-semibold uppercase tracking-[0.18em] text-foreground/80">Aktual</th>
                        <th className="h-9 w-[12%] border-b border-r border-border/70 px-3 text-left text-[10px] font-semibold uppercase tracking-[0.18em] text-foreground/80">Selisih</th>
                        <th className="h-9 w-[12%] border-b border-border/70 px-3 text-left text-[10px] font-semibold uppercase tracking-[0.18em] text-foreground/80">Catatan</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((item) => (
                        <tr
                          key={item.id}
                          className={
                            item.difference === 0
                              ? "bg-emerald-50/30"
                              : item.difference > 0
                              ? "bg-blue-50/30"
                              : "bg-rose-50/30"
                          }
                        >
                          <td className="border-b border-r border-border/60 px-3 py-2.5 align-top">
                            <div className="flex items-start gap-2">
                              {item.inventory_id ? (
                                <Package className="mt-0.5 h-4 w-4 text-blue-500" />
                              ) : (
                                <Pill className="mt-0.5 h-4 w-4 text-green-500" />
                              )}
                              <div className="min-w-0 space-y-0.5">
                                <p className="text-xs font-semibold leading-4 text-foreground">{item.name}</p>
                                <p className="font-mono text-[11px] leading-4 text-muted-foreground">{item.code}</p>
                                <p className="text-[11px] leading-4 text-muted-foreground">Satuan: {item.unit}</p>
                              </div>
                            </div>
                          </td>
                          <td className="border-b border-r border-border/60 px-3 py-2.5 align-top">
                            <Badge variant="outline" className="text-[10px]">
                              {item.inventory_id ? "Inventaris" : "Obat"}
                            </Badge>
                          </td>
                          <td className="border-b border-r border-border/60 px-3 py-2.5 align-top text-[11px] text-muted-foreground">
                            <span className="font-medium text-foreground">{item.system_stock}</span> {item.unit}
                          </td>
                          <td className="border-b border-r border-border/60 px-3 py-2.5 align-top">
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
                              className="w-full max-w-[120px] text-center"
                            />
                          </td>
                          <td className="border-b border-r border-border/60 px-3 py-2.5 align-top">
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
                                  ? "flex w-fit items-center gap-1 border-blue-200 bg-blue-50 text-blue-700"
                                  : item.difference < 0
                                  ? "flex w-fit items-center gap-1 border-rose-200 bg-rose-50 text-rose-700"
                                  : "flex w-fit items-center gap-1 border-emerald-200 bg-emerald-50 text-emerald-700"
                              }
                            >
                              {item.difference !== 0 && <AlertTriangle className="h-3 w-3" />}
                              {item.difference > 0 ? "+" : ""}
                              {item.difference}
                            </Badge>
                          </td>
                          <td className="border-b border-border/60 px-3 py-2.5 align-top">
                            <Input
                              placeholder="Catatan..."
                              value={item.notes}
                              onChange={(e) => handleItemChange(item.id, "notes", e.target.value)}
                              className="w-full"
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </ScrollArea>
              </div>

              <div className="mt-2 flex shrink-0 items-center justify-end gap-2 border-t border-border/70 pt-2.5">
                <Button size="sm" variant="outline" onClick={() => navigate(`/stock-opname/${id}`)}>
                  Batal
                </Button>
                <Button size="sm" onClick={handleSubmit} disabled={submitting}>
                  {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Simpan Perubahan
                </Button>
              </div>
            </SectionPanel>
          </div>
        </div>
      </PageContent>
    </PageShell>
  );
}
