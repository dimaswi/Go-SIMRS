import { useState, useEffect, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
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
  stockRequestsApi,
  type StockRequest,
  stockRequestStatusLabels,
  requestTypeLabels,
} from "@/lib/api/stock-requests";
import { roomsApi } from "@/lib/api/rooms";
import {
  ArrowLeft,
  Loader2,
  Package,
  Pill,
  AlertTriangle,
} from "lucide-react";

interface EditItem {
  id: string;
  original_id?: number;
  inventory_id?: number;
  medicine_id?: number;
  name: string;
  code: string;
  unit: string;
  current_stock: number;
  quantity_requested: number;
  notes: string;
  isNew?: boolean;
}

const priorityOptions: ComboboxOption[] = [
  { value: "low", label: "Rendah" },
  { value: "normal", label: "Normal" },
  { value: "high", label: "Tinggi" },
  { value: "urgent", label: "Mendesak" },
];

export default function StockRequestEdit() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [request, setRequest] = useState<StockRequest | null>(null);
  const [rooms, setRooms] = useState<ComboboxOption[]>([]);
  const [depoRooms, setDepoRooms] = useState<ComboboxOption[]>([]);

  const [formData, setFormData] = useState({
    from_room_id: 0,
    to_room_id: 0,
    priority: "normal",
    required_date: "",
    reason: "",
    notes: "",
  });

  const [items, setItems] = useState<EditItem[]>([]);

  const loadData = useCallback(async () => {
    try {
      const [requestRes, roomsRes] = await Promise.all([
        stockRequestsApi.getById(Number(id)),
        roomsApi.getAll({ limit: 100 }),
      ]);

      const requestData = requestRes.data.data as StockRequest;
      
      // Check if editable (only draft or pending status)
      if (requestData.status !== "draft" && requestData.status !== "pending") {
        toast({
          variant: "destructive",
          title: "Error",
          description: "Permintaan yang sudah diproses tidak dapat diedit.",
        });
        navigate(`/stock-requests/${id}`);
        return;
      }

      setRequest(requestData);

      // Set form data
      setFormData({
        from_room_id: requestData.from_room_id,
        to_room_id: requestData.to_room_id,
        priority: requestData.priority,
        required_date: requestData.required_date?.split("T")[0] || "",
        reason: requestData.reason || "",
        notes: requestData.notes || "",
      });

      // Map existing items
      const existingItems: EditItem[] = (requestData.items || []).map((item) => {
        const itemData = item.inventory || item.medicine;
        return {
          id: `existing_${item.id}`,
          original_id: item.id,
          inventory_id: item.inventory_id,
          medicine_id: item.medicine_id,
          name: itemData?.name || "",
          code: itemData?.code || "",
          unit: item.unit || itemData?.unit || "",
          current_stock: itemData?.current_stock || 0,
          quantity_requested: item.quantity_requested,
          notes: item.notes || "",
          isNew: false,
        };
      });
      setItems(existingItems);

      // Set rooms
      const allRooms = roomsRes.data.data || [];
      setRooms(
        allRooms.map((r: any) => ({
          value: r.id.toString(),
          label: `${r.code} - ${r.name}`,
        }))
      );

      const depoTypes = [
        "depo_farmasi",
        "gudang_farmasi",
        "farmasi_rawat_jalan",
        "farmasi_rawat_inap",
        "farmasi_ugd",
      ];
      const depos = allRooms.filter((r: any) => depoTypes.includes(r.room_type));
      setDepoRooms(
        depos.map((r: any) => ({
          value: r.id.toString(),
          label: `${r.code} - ${r.name}`,
        }))
      );
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Gagal memuat data.",
      });
      navigate("/stock-requests");
    } finally {
      setLoading(false);
    }
  }, [id, toast, navigate]);

  useEffect(() => {
    setPageTitle("Edit Permintaan Stok");
    loadData();
  }, [loadData]);

  const handleSubmit = async () => {
    if (!formData.from_room_id || !formData.to_room_id) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Pilih ruangan asal dan tujuan.",
      });
      return;
    }

    if (items.length === 0) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Tambahkan minimal satu item.",
      });
      return;
    }

    setSubmitting(true);
    try {
      // Update basic info
      await stockRequestsApi.update(Number(id), {
        priority: formData.priority,
        required_date: formData.required_date || undefined,
        reason: formData.reason,
        notes: formData.notes,
      });

      toast({
        variant: "success",
        title: "Berhasil",
        description: "Permintaan stok berhasil diperbarui.",
      });
      navigate(`/stock-requests/${id}`);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description:
          error.response?.data?.error || "Gagal memperbarui permintaan.",
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

  if (!request) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <AlertTriangle className="h-12 w-12 text-destructive" />
        <p className="text-muted-foreground">Data tidak ditemukan</p>
        <Button onClick={() => navigate("/stock-requests")}>
          Kembali ke Daftar
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col p-4">
      <div className="flex items-center gap-4">
        <Button
          variant="outline"
          size="icon"
          onClick={() => navigate(`/stock-requests/${id}`)}
          className="h-9 w-9"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-semibold">Edit Permintaan Stok</h1>
            <Badge className="bg-yellow-100 text-yellow-800">
              {stockRequestStatusLabels[request.status]}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {request.request_number} • {requestTypeLabels[request.request_type]}
          </p>
        </div>
      </div>

      <div className="rounded-lg border p-6 space-y-6">
          {/* Info Box */}
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <p className="text-sm text-blue-700 dark:text-blue-300">
              <strong>Catatan:</strong> Anda hanya dapat mengubah prioritas, tanggal dibutuhkan, alasan, dan catatan.
              Untuk mengubah item, Anda perlu membatalkan permintaan ini dan membuat yang baru.
            </p>
          </div>

          {/* Form Fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label>Ruangan Pemohon</Label>
              <Combobox
                options={rooms}
                value={formData.from_room_id.toString()}
                onValueChange={() => {}}
                placeholder="Pilih ruangan"
                disabled
              />
            </div>

            <div className="space-y-2">
              <Label>Depo/Gudang Tujuan</Label>
              <Combobox
                options={depoRooms}
                value={formData.to_room_id.toString()}
                onValueChange={() => {}}
                placeholder="Pilih depo/gudang"
                disabled
              />
            </div>

            <div className="space-y-2">
              <Label>Prioritas</Label>
              <Combobox
                options={priorityOptions}
                value={formData.priority}
                onValueChange={(value) =>
                  setFormData({ ...formData, priority: value })
                }
                placeholder="Pilih prioritas"
              />
            </div>

            <div className="space-y-2">
              <Label>Tanggal Dibutuhkan</Label>
              <Input
                type="date"
                value={formData.required_date}
                onChange={(e) =>
                  setFormData({ ...formData, required_date: e.target.value })
                }
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label>Alasan Permintaan</Label>
              <Input
                placeholder="Alasan permintaan..."
                value={formData.reason}
                onChange={(e) =>
                  setFormData({ ...formData, reason: e.target.value })
                }
              />
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

          {/* Items Section (Read Only) */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label className="text-base font-semibold">Daftar Item (Tidak dapat diubah)</Label>
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Kode</TableHead>
                  <TableHead>Nama</TableHead>
                  <TableHead>Stok Saat Ini</TableHead>
                  <TableHead>Qty Diminta</TableHead>
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
                    <TableCell>{item.current_stock}</TableCell>
                    <TableCell className="font-medium">{item.quantity_requested}</TableCell>
                    <TableCell>{item.unit}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {item.notes || "-"}
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
              onClick={() => navigate(`/stock-requests/${id}`)}
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
