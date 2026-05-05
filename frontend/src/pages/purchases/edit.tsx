import { useState, useEffect, useCallback } from "react";
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
import { useToast } from "@/hooks/use-toast";
import { setPageTitle } from "@/lib/page-title";
import {
  purchasesApi,
  purchaseStatusLabels,
  type Purchase,
} from "@/lib/api/stock-requests";
import { Loader2, Package, Pill } from "lucide-react";

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
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!purchase) {
    return null;
  }

  return (
    <div className="flex flex-1 flex-col px-4">

      <div className="flex-1 space-y-6 [&_label]:tracking-[0.01em] [&_input]:h-11 [&_[role=combobox]]:h-11">
        {/* Supplier Info */}
        <div className="border border-border/70">
          <div className="border-b border-border/70 bg-muted/30 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Informasi Pembelian & Supplier
          </div>
          <div className="p-3 sm:p-4 space-y-4">
            <div className="flex items-center gap-4 mb-4">
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
          </div>
        </div>

        {/* Destination Room Info */}
        <div className="border border-border/70">
          <div className="border-b border-border/70 bg-muted/30 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Informasi Tujuan & Tanggal
          </div>
          <div className="p-3 sm:p-4 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
        </div>

        {/* Items (Read-only) */}
        <div className="border border-border/70">
          <div className="border-b border-border/70 bg-muted/30 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground flex items-center justify-between">
            <span>Daftar Item</span>
            <span className="normal-case tracking-normal font-normal opacity-70">* Item tidak dapat diubah</span>
          </div>
          <div className="p-3 sm:p-4 space-y-4">

            <Table>
              <TableHeader>
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
        </div>

        {/* Sticky Footer Actions */}
        <div className="shrink-0 sticky bottom-0 z-10 py-3 mt-4 flex items-center justify-end gap-2 border-t bg-background">
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
  );
}
