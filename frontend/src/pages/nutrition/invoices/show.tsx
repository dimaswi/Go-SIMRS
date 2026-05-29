import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Loader2, Pencil, ReceiptText } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageContent, PageHeader, PageShell } from "@/components/layout/page-shell";
import { useToast } from "@/hooks/use-toast";
import { nutritionIngredientInvoiceApi, nutritionIngredientUnitLabels, type NutritionIngredientInvoice } from "@/lib/api/nutrition";
import { setPageTitle } from "@/lib/page-title";
import { NutritionSectionPanel } from "../shared-page-chrome";

const formatDate = (value?: string) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("id-ID");
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(value || 0);

export default function NutritionInvoiceShow() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [invoice, setInvoice] = useState<NutritionIngredientInvoice | null>(null);

  useEffect(() => {
    setPageTitle("Detail Faktur Bahan Gizi");
    loadData();
  }, [id]);

  const loadData = async () => {
    try {
      const res = await nutritionIngredientInvoiceApi.getById(Number(id));
      setInvoice(res.data.data || null);
    } catch {
      toast({ variant: "destructive", title: "Error!", description: "Gagal memuat detail faktur bahan gizi." });
      navigate("/nutrition/invoices");
    } finally {
      setLoading(false);
    }
  };

  if (loading || !invoice) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <PageShell>
      <PageHeader
        title={invoice.invoice_number}
        description="Rincian faktur bahan gizi untuk kebutuhan audit dan laporan pembelian."
        icon={ReceiptText}
        actions={(
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => navigate("/nutrition/invoices")}>
              <ArrowLeft className="h-4 w-4" />
              Kembali
            </Button>
            <Button size="sm" variant="outline" onClick={() => navigate(`/nutrition/invoices/${invoice.id}/edit`)}>
              <Pencil className="h-4 w-4" />
              Edit
            </Button>
          </div>
        )}
      >
        <div className="flex flex-wrap gap-2 pb-3">
          <div className="border border-border/70 bg-background px-2 py-1 font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">{invoice.code}</div>
          <div className="border border-border/70 bg-background px-2 py-1 text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">{formatDate(invoice.invoice_date)}</div>
          <Badge variant="secondary">{invoice.items?.length || 0} bahan</Badge>
        </div>
      </PageHeader>

      <PageContent className="flex-none pb-8 space-y-6">
        <NutritionSectionPanel title="Informasi Faktur" description="Nomor faktur, tanggal, supplier, dan total nominal faktur.">
          <div className="grid grid-cols-1 gap-3 text-sm md:grid-cols-2">
            <div className="flex justify-between"><span className="text-muted-foreground">Kode Internal</span><span className="font-mono">{invoice.code}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Nomor Faktur</span><span className="font-medium">{invoice.invoice_number}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Tanggal Faktur</span><span>{formatDate(invoice.invoice_date)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Supplier</span><span>{invoice.supplier_name || "-"}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Total Faktur</span><span className="font-semibold">{formatCurrency(invoice.total_amount || 0)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Petugas Input</span><span>{invoice.received_by?.nama_lengkap || "-"}</span></div>
          </div>
          {invoice.notes && (
            <div className="border-t pt-2 text-sm text-muted-foreground">{invoice.notes}</div>
          )}
        </NutritionSectionPanel>

        <NutritionSectionPanel title="Rincian Bahan" description="Daftar bahan yang tercatat dalam faktur ini.">
          {invoice.items && invoice.items.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b bg-muted/30 text-left">
                    <th className="px-3 py-2">Bahan</th>
                    <th className="px-3 py-2">Qty Kemasan</th>
                    <th className="px-3 py-2">Berat/Kemasan</th>
                    <th className="px-3 py-2">Total Berat</th>
                    <th className="px-3 py-2">Harga/Kemasan</th>
                    <th className="px-3 py-2">Subtotal</th>
                    <th className="px-3 py-2">Catatan</th>
                  </tr>
                </thead>
                <tbody>
                  {invoice.items.map((item) => (
                    <tr key={item.id} className="border-b">
                      <td className="px-3 py-2">
                        <div className="font-medium">{item.ingredient?.name || `#${item.ingredient_id}`}</div>
                        <div className="text-xs text-muted-foreground">{item.ingredient?.code || "-"}</div>
                      </td>
                      <td className="px-3 py-2">
                        {item.quantity} {item.unit || "kemasan"}
                      </td>
                      <td className="px-3 py-2">{item.unit_weight || 0} {nutritionIngredientUnitLabels[item.weight_unit] || item.weight_unit || "-"}</td>
                      <td className="px-3 py-2">{item.total_weight || 0} {nutritionIngredientUnitLabels[item.weight_unit] || item.weight_unit || "-"}</td>
                      <td className="px-3 py-2">{formatCurrency(item.unit_price || 0)}</td>
                      <td className="px-3 py-2 font-medium">{formatCurrency(item.line_total || 0)}</td>
                      <td className="px-3 py-2 text-muted-foreground">{item.notes || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
              Belum ada item bahan pada faktur ini.
            </div>
          )}
        </NutritionSectionPanel>
      </PageContent>
    </PageShell>
  );
}
