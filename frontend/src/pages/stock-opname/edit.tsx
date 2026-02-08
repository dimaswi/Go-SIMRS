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
  stockOpnameApi,
  stockOpnameStatusLabels,
  type StockOpname,
} from "@/lib/api/stock-requests";
import { ArrowLeft, Loader2, Package, Pill, AlertTriangle } from "lucide-react";

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
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!stockOpname) {
    return null;
  }

  return (
    <div className="flex flex-1 flex-col gap-4 p-6">
      <div className="flex items-center gap-4">
        <Button
          variant="outline"
          size="icon"
          onClick={() => navigate(`/stock-opname/${id}`)}
          className="h-9 w-9"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-semibold">Edit Stock Opname</h1>
            <Badge variant="outline">
              {stockOpnameStatusLabels[stockOpname.status] || stockOpname.status}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">{stockOpname.opname_number}</p>
        </div>
      </div>

      <div className="rounded-lg border p-6 space-y-6">
          {/* Info */}
          <div className="bg-muted/50 rounded-lg p-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-green-50 dark:bg-green-900/20 p-3 rounded-lg">
              <p className="text-sm text-green-600 dark:text-green-400">Surplus</p>
              <p className="text-xl font-bold text-green-700 dark:text-green-300">
                {stats.surplus} item
              </p>
            </div>
            <div className="bg-red-50 dark:bg-red-900/20 p-3 rounded-lg">
              <p className="text-sm text-red-600 dark:text-red-400">Defisit</p>
              <p className="text-xl font-bold text-red-700 dark:text-red-300">
                {stats.deficit} item
              </p>
            </div>
            <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg">
              <p className="text-sm text-blue-600 dark:text-blue-400">Sesuai</p>
              <p className="text-xl font-bold text-blue-700 dark:text-blue-300">
                {stats.match} item
              </p>
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label>Catatan</Label>
            <Textarea
              placeholder="Catatan stock opname..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          {/* Items */}
          <div className="space-y-4">
            <Label className="text-base font-semibold">Daftar Item</Label>

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
                        className="flex items-center gap-1 w-fit mx-auto"
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

          {/* Actions */}
          <div className="flex justify-end gap-4 pt-4 border-t">
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
    </div>
  );
}
