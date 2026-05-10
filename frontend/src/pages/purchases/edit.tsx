import { useState, useEffect, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Building2, FileText, Loader2, MapPin, Package, Pill } from "lucide-react";

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
import { SectionPanel } from "@/components/layout/section-panel";
import { useToast } from "@/hooks/use-toast";
import { setPageTitle } from "@/lib/page-title";
import {
  purchasesApi,
  purchaseStatusLabels,
  type Purchase,
} from "@/lib/api/stock-requests";

interface EditItem {
  id: number;
  inventory_id?: number;
  medicine_id?: number;
  name: string;
  code: string;
  unit: string;
  quantity_ordered: number;
  unit_price: number;
  notes: string;
}

export default function PurchaseEdit() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [purchase, setPurchase] = useState<Purchase | null>(null);

  const [formData, setFormData] = useState({
    supplier_name: "",
    supplier_contact: "",
    notes: "",
  });

  const [items, setItems] = useState<EditItem[]>([]);

  const loadData = useCallback(async () => {
    try {
      const response = await purchasesApi.getById(Number(id));
      const data = response.data.data as Purchase;

      // Check if editable (only draft or pending status)
      if (data.status !== "draft" && data.status !== "pending") {
        toast({
          variant: "destructive",
          title: "Error",
          description: "Pembelian yang sudah diproses tidak dapat diedit.",
        });
        navigate(`/purchases/${id}`);
        return;
      }

      setPurchase(data);
      setFormData({
        supplier_name: data.supplier_name,
        supplier_contact: data.supplier_contact || "",
        notes: data.notes || "",
      });

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
          quantity_ordered: item.quantity_ordered,
          unit_price: item.unit_price,
          notes: item.notes || "",
        };
      });
      setItems(editItems);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Gagal memuat data pembelian.",
      });
      navigate("/purchases");
    } finally {
      setLoading(false);
    }
  }, [id, navigate, toast]);

  useEffect(() => {
    setPageTitle("Edit Pembelian");
    loadData();
  }, [loadData]);

  // Note: Items are read-only after purchase is created
  // This function is kept for potential future use
  // const handleItemChange = (itemId: number, field: string, value: any) => {
  //   setItems(
  //     items.map((item) =>
  //       item.id === itemId ? { ...item, [field]: value } : item
  //     )
  //   );
  // };

  // Calculate totals
  const calculateTotal = () => {
    return items.reduce(
      (sum, item) => sum + item.quantity_ordered * item.unit_price,
      0
    );
  };

  const handleSubmit = async () => {
    if (!formData.supplier_name.trim()) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Nama supplier harus diisi.",
      });
      return;
    }

    setSubmitting(true);
    try {
      await purchasesApi.update(Number(id), {
        supplier_name: formData.supplier_name,
        supplier_contact: formData.supplier_contact || undefined,
        notes: formData.notes || undefined,
      });

      toast({
        variant: "success",
        title: "Berhasil",
        description: "Pembelian berhasil diperbarui.",
      });
      navigate(`/purchases/${id}`);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.response?.data?.error || "Gagal memperbarui pembelian.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <PageShell>
        <PageHeader
          title="Edit Pembelian"
          description="Perbarui informasi supplier dan catatan pembelian yang masih bisa diubah."
        />
        <PageContent className="flex-none pb-8">
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        </PageContent>
      </PageShell>
    );
  }

  if (!purchase) {
    return null;
  }

  return (
    <PageShell className="lg:overflow-hidden">
      <PageHeader
        title="Edit Pembelian"
        description="Perbarui informasi supplier dan catatan pada pembelian yang masih bisa diedit."
        actions={
          <Button variant="outline" onClick={() => navigate(`/purchases/${id}`)}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Kembali
          </Button>
        }
      />
      <PageContent className="min-h-0 overflow-hidden pb-6">
        <div className="grid min-h-0 flex-1 gap-6 [&_label]:tracking-[0.01em] [&_input]:h-11 [&_[role=combobox]]:h-11 lg:grid-cols-[minmax(240px,20%)_minmax(0,1fr)]">
          <div className="space-y-6 lg:overflow-hidden">
            <SectionPanel
              icon={Building2}
              title="Informasi Pembelian & Supplier"
              description="Nomor pembelian dan status tetap menjadi referensi, sedangkan data supplier masih dapat diperbarui."
            >
              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground">No. Pembelian</p>
                    <p className="text-sm font-medium font-mono">{purchase.purchase_number}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Status</p>
                    <Badge variant="outline" className="mt-0.5">
                      {purchaseStatusLabels[purchase.status] || purchase.status}
                    </Badge>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Nama Supplier *</Label>
                  <Input
                    placeholder="Nama supplier..."
                    value={formData.supplier_name}
                    onChange={(e) =>
                      setFormData({ ...formData, supplier_name: e.target.value })
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label>Kontak Supplier</Label>
                  <Input
                    placeholder="Telepon/email supplier..."
                    value={formData.supplier_contact}
                    onChange={(e) =>
                      setFormData({ ...formData, supplier_contact: e.target.value })
                    }
                  />
                </div>
              </div>
            </SectionPanel>

            <SectionPanel
              icon={MapPin}
              title="Informasi Tujuan & Catatan"
              description="Lokasi tujuan dan tanggal pembelian ditampilkan sebagai konteks, sedangkan catatan masih bisa disesuaikan."
            >
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-muted-foreground">Ruangan Tujuan</p>
                  <p className="font-medium">{purchase.to_room?.name}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Tanggal Pembelian</p>
                  <p className="font-medium">
                    {purchase.order_date ? new Date(purchase.order_date).toLocaleDateString("id-ID") : "-"}
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Catatan</Label>
                  <Textarea
                    placeholder="Catatan tambahan..."
                    value={formData.notes}
                    onChange={(e) =>
                      setFormData({ ...formData, notes: e.target.value })
                    }
                  />
                </div>
              </div>
            </SectionPanel>
          </div>

          <div className="flex min-h-0 flex-col gap-6 overflow-hidden">
            <SectionPanel
              icon={FileText}
              title="Daftar Item"
              description="Item pembelian asli ditampilkan sebagai referensi dan tidak dapat diubah dari halaman ini."
              actions={<span className="text-xs text-muted-foreground">Item tidak dapat diubah</span>}
              className="flex min-h-0 flex-1 flex-col overflow-hidden"
              contentClassName="flex min-h-0 flex-1 flex-col overflow-hidden p-0"
            >
              <div className="min-h-0 flex-1 overflow-auto">
                <Table>
                  <TableHeader className="sticky top-0 z-10 bg-background">
                    <TableRow>
                      <TableHead>Kode</TableHead>
                      <TableHead>Nama</TableHead>
                      <TableHead className="text-center">Qty</TableHead>
                      <TableHead className="text-right">Harga</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead>Satuan</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((item) => (
                      <TableRow key={item.id}>
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
                          {item.quantity_ordered}
                        </TableCell>
                        <TableCell className="text-right">
                          Rp {item.unit_price.toLocaleString("id-ID")}
                        </TableCell>
                        <TableCell className="text-right">
                          Rp {(item.quantity_ordered * item.unit_price).toLocaleString("id-ID")}
                        </TableCell>
                        <TableCell>{item.unit}</TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="font-semibold">
                      <TableCell colSpan={4} className="text-right">
                        Total
                      </TableCell>
                      <TableCell className="text-right">
                        Rp {calculateTotal().toLocaleString("id-ID")}
                      </TableCell>
                      <TableCell />
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </SectionPanel>

            <div className="flex shrink-0 items-center justify-end gap-2 border-t bg-background pt-3">
              <Button
                variant="outline"
                onClick={() => navigate(`/purchases/${id}`)}
              >
                Batal
              </Button>
              <Button onClick={handleSubmit} disabled={submitting}>
                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Simpan Perubahan
              </Button>
            </div>
          </div>
        </div>
      </PageContent>
    </PageShell>
  );
}
