import { useState, useEffect, useCallback, type ComponentType, type ReactNode } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { setPageTitle } from "@/lib/page-title";
import {
  distributionsApi,
  type StockDistribution,
} from "@/lib/api/stock-requests";
import { Loader2, Package, Pill, Truck, ArrowLeft } from "lucide-react";
import { PageShell, PageHeader, PageContent } from '@/components/layout/page-shell';

interface EditItem {
  id: number;
  inventory_id?: number;
  medicine_id?: number;
  name: string;
  code: string;
  unit: string;
  quantity: number;
  batch_number: string;
  expiry_date: string;
  notes: string;
}

function SectionPanel({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: ComponentType<{ className?: string }>;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <div className="border border-border/70 bg-background/95 shadow-sm">
      <div className="border-b border-border/70 bg-muted/20 px-4 py-3">
        <div className="flex items-start gap-3">
          <div className="border border-border/70 bg-background p-2">
            <Icon className="h-4 w-4 text-muted-foreground" />
          </div>
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">{title}</div>
            <p className="mt-1 text-xs text-muted-foreground">{description}</p>
          </div>
        </div>
      </div>
      <div className="p-3 sm:p-4 space-y-4">{children}</div>
    </div>
  );
}

export default function DistributionEdit() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [distribution, setDistribution] = useState<StockDistribution | null>(null);
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<EditItem[]>([]);

  const loadData = useCallback(async () => {
    try {
      const response = await distributionsApi.getById(Number(id));
      const data = response.data.data as StockDistribution;

      // Check if editable (only pending status)
      if (data.status !== "pending") {
        toast({
          variant: "destructive",
          title: "Error",
          description: "Distribusi yang sudah diproses tidak dapat diedit.",
        });
        navigate(`/distributions/${id}`);
        return;
      }

      setDistribution(data);
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
          quantity: item.quantity,
          batch_number: item.batch_number || "",
          expiry_date: item.expiry_date?.split("T")[0] || "",
          notes: item.notes || "",
        };
      });
      setItems(editItems);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Gagal memuat data distribusi.",
      });
      navigate("/distributions");
    } finally {
      setLoading(false);
    }
  }, [id, navigate, toast]);

  useEffect(() => {
    setPageTitle("Edit Distribusi");
    loadData();
  }, [loadData]);

  const handleItemChange = (itemId: number, field: string, value: any) => {
    setItems(
      items.map((item) =>
        item.id === itemId ? { ...item, [field]: value } : item
      )
    );
  };

  const handleSubmit = async () => {
    // Validate quantities
    for (const item of items) {
      if (item.quantity <= 0) {
        toast({
          variant: "destructive",
          title: "Error",
          description: `Jumlah untuk ${item.name} harus lebih dari 0.`,
        });
        return;
      }
    }

    setSubmitting(true);
    try {
      await distributionsApi.update(Number(id), {
        notes,
        items: items.map((item) => ({
          id: item.id,
          inventory_id: item.inventory_id,
          medicine_id: item.medicine_id,
          batch_number: item.batch_number || undefined,
          expiry_date: item.expiry_date || undefined,
          quantity: item.quantity,
          unit: item.unit,
          notes: item.notes,
        })),
      });

      toast({
        variant: "success",
        title: "Berhasil",
        description: "Distribusi berhasil diperbarui.",
      });
      navigate(`/distributions/${id}`);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.response?.data?.error || "Gagal memperbarui distribusi.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!distribution) {
    return null;
  }

  return (
    <PageShell>
      <PageHeader
        title="Edit Distribusi"
        description="Sesuaikan jumlah, batch, dan catatan distribusi selama pengiriman belum selesai diproses."
        icon={Truck}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => navigate(`/distributions/${id}`)}>
              <ArrowLeft className="h-4 w-4" />
              Kembali
            </Button>
            <Button size="sm" onClick={handleSubmit} disabled={submitting}>
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Simpan Perubahan
            </Button>
          </div>
        }
      >
        <div className="flex flex-wrap gap-2 pb-3">
          <div className="border border-border/70 bg-background px-2 py-1 text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">Distribusi pending dapat diedit</div>
          <div className="border border-border/70 bg-background px-2 py-1 text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">Batch dan exp tetap terbuka</div>
          <div className="border border-border/70 bg-background px-2 py-1 text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">Catatan mudah diperbarui</div>
        </div>
      </PageHeader>

      <PageContent className="flex-none pb-8">
        <div className="mb-4 grid gap-3 lg:grid-cols-3">
          <div className="border border-border/70 bg-gradient-to-br from-background via-background to-sky-50/40 px-4 py-3 shadow-sm"><div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">No. Distribusi</div><div className="mt-1 text-sm font-semibold text-foreground">{distribution.distribution_number}</div></div>
          <div className="border border-border/70 bg-gradient-to-br from-background via-background to-emerald-50/40 px-4 py-3 shadow-sm"><div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Jumlah Item</div><div className="mt-1 text-sm font-semibold text-foreground">{items.length} item</div></div>
          <div className="border border-border/70 bg-gradient-to-br from-background via-background to-amber-50/50 px-4 py-3 shadow-sm"><div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Status</div><div className="mt-1 text-sm font-semibold text-foreground">{distribution.status}</div></div>
        </div>

      <div className="flex-1 space-y-6 [&_label]:tracking-[0.01em] [&_input]:h-11 [&_[role=combobox]]:h-11">
        {/* Info */}
        <SectionPanel icon={Truck} title="Informasi Distribusi" description="Ringkasan nomor distribusi, rute ruangan, status, dan catatan pengiriman.">
          <div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">No. Distribusi</p>
                <p className="font-medium font-mono">{distribution.distribution_number}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Dari Ruangan</p>
                <p className="font-medium">{distribution.from_room?.name}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Ke Ruangan</p>
                <p className="font-medium">{distribution.to_room?.name}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Status</p>
                <Badge variant="outline">{distribution.status}</Badge>
              </div>
            </div>
            
            {/* Notes */}
            <div className="border-t border-border/70 mt-4 pt-4">
              <Label className="text-xs text-muted-foreground mb-2 block">Catatan</Label>
              <Textarea
                placeholder="Catatan tambahan..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </div>
        </SectionPanel>

        {/* Items */}
        <SectionPanel icon={Package} title="Daftar Item" description="Sesuaikan jumlah, batch, tanggal kedaluwarsa, dan catatan per item distribusi.">
        <div className="space-y-4">
          <div className="overflow-hidden border border-border/80 bg-background">
            <table className="w-full table-fixed border-collapse text-sm">
              <thead className="bg-background">
                <tr className="bg-muted/20">
                  <th className="h-9 w-[14%] border-b border-r border-border/70 px-3 text-left text-[10px] font-semibold uppercase tracking-[0.16em] text-foreground/80">Kode</th>
                  <th className="h-9 w-[24%] border-b border-r border-border/70 px-3 text-left text-[10px] font-semibold uppercase tracking-[0.16em] text-foreground/80">Nama</th>
                  <th className="h-9 w-[10%] border-b border-r border-border/70 px-2 text-center text-[10px] font-semibold uppercase tracking-[0.16em] text-foreground/80">Qty</th>
                  <th className="h-9 w-[14%] border-b border-r border-border/70 px-3 text-left text-[10px] font-semibold uppercase tracking-[0.16em] text-foreground/80">Batch</th>
                  <th className="h-9 w-[14%] border-b border-r border-border/70 px-3 text-left text-[10px] font-semibold uppercase tracking-[0.16em] text-foreground/80">Exp. Date</th>
                  <th className="h-9 w-[10%] border-b border-r border-border/70 px-2 text-center text-[10px] font-semibold uppercase tracking-[0.16em] text-foreground/80">Satuan</th>
                  <th className="h-9 border-b border-border/70 px-3 text-left text-[10px] font-semibold uppercase tracking-[0.16em] text-foreground/80">Catatan</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} className="transition-colors hover:bg-muted/10">
                    <td className="border-b border-r border-border/60 px-3 py-1.5 align-middle font-mono text-[11px] text-muted-foreground">{item.code}</td>
                    <td className="border-b border-r border-border/60 px-3 py-1.5 align-middle">
                      <div className="flex items-center gap-2">
                        {item.inventory_id ? (
                          <Package className="h-4 w-4 text-blue-500" />
                        ) : (
                          <Pill className="h-4 w-4 text-green-500" />
                        )}
                        <span className="text-xs font-medium">{item.name}</span>
                      </div>
                    </td>
                    <td className="border-b border-r border-border/60 px-2 py-1.5 align-middle">
                      <Input
                        type="number"
                        min={1}
                        value={item.quantity}
                        onChange={(e) =>
                          handleItemChange(
                            item.id,
                            "quantity",
                            parseInt(e.target.value) || 0
                          )
                        }
                        className="h-8 text-center text-xs"
                      />
                    </td>
                    <td className="border-b border-r border-border/60 px-3 py-1.5 align-middle">
                      <Input
                        placeholder="Batch..."
                        value={item.batch_number}
                        onChange={(e) =>
                          handleItemChange(item.id, "batch_number", e.target.value)
                        }
                        className="h-8 text-xs"
                      />
                    </td>
                    <td className="border-b border-r border-border/60 px-3 py-1.5 align-middle">
                      <Input
                        type="date"
                        value={item.expiry_date}
                        onChange={(e) =>
                          handleItemChange(item.id, "expiry_date", e.target.value)
                        }
                        className="h-8 text-xs"
                      />
                    </td>
                    <td className="border-b border-r border-border/60 px-2 py-1.5 align-middle text-center text-[11px] text-muted-foreground">{item.unit}</td>
                    <td className="border-b border-border/60 px-3 py-1.5 align-middle">
                      <Input
                        placeholder="Catatan..."
                        value={item.notes}
                        onChange={(e) =>
                          handleItemChange(item.id, "notes", e.target.value)
                        }
                        className="h-8 text-xs"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </SectionPanel>

      {/* Sticky Footer Actions */}
      <div className="shrink-0 sticky bottom-0 z-10 py-3 mt-4 flex items-center justify-end gap-4 border-t border-border/70 bg-background/95 backdrop-blur">
        <Button
          variant="outline"
          onClick={() => navigate(`/distributions/${id}`)}
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
