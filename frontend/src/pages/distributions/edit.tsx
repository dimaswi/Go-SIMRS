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
  distributionsApi,
  type StockDistribution,
} from "@/lib/api/stock-requests";
import { Loader2, Package, Pill } from "lucide-react";

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
    <div className="flex flex-1 flex-col px-4">

      <div className="flex-1 space-y-6 [&_label]:tracking-[0.01em] [&_input]:h-11 [&_[role=combobox]]:h-11">
        {/* Info */}
        <div className="border border-border/70">
          <div className="border-b border-border/70 bg-muted/30 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Informasi Distribusi
          </div>
          <div className="p-3 sm:p-4">
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
        </div>

        {/* Items */}
        <div className="border border-border/70">
        <div className="border-b border-border/70 bg-muted/30 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Daftar Item
        </div>
        <div className="p-3 sm:p-4 space-y-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Kode</TableHead>
                <TableHead>Nama</TableHead>
                <TableHead className="text-center">Qty</TableHead>
                <TableHead>Batch</TableHead>
                <TableHead>Exp. Date</TableHead>
                <TableHead>Satuan</TableHead>
                <TableHead>Catatan</TableHead>
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
                  <TableCell>
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
                      className="w-20 text-center"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      placeholder="Batch..."
                      value={item.batch_number}
                      onChange={(e) =>
                        handleItemChange(item.id, "batch_number", e.target.value)
                      }
                      className="w-24"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="date"
                      value={item.expiry_date}
                      onChange={(e) =>
                        handleItemChange(item.id, "expiry_date", e.target.value)
                      }
                      className="w-36"
                    />
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
      </div>

      {/* Sticky Footer Actions */}
      <div className="shrink-0 sticky bottom-0 z-10 py-3 mt-4 flex items-center justify-end gap-4 border-t bg-background">
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
    </div>
  );
}
