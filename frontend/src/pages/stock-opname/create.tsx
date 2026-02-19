import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { ArrowLeft, ClipboardList, RefreshCcw, Loader2, Package, Pill } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { setPageTitle } from "@/lib/page-title";
import { stockOpnameApi, type RoomStockItem } from "@/lib/api/stock-requests";
import { api } from "@/lib/api/client";

interface Room {
  id: number;
  code: string;
  name: string;
}

const itemSchema = z.object({
  item_type: z.enum(["inventory", "medicine"]),
  inventory_id: z.number().optional(),
  medicine_id: z.number().optional(),
  system_stock: z.number().min(0, "Jumlah tidak valid"),
  actual_stock: z.number().min(0, "Jumlah tidak valid"),
  unit: z.string().optional(),
  notes: z.string().optional(),
});

const formSchema = z.object({
  room_id: z.number().min(1, "Ruangan wajib dipilih"),
  notes: z.string().optional(),
  items: z.array(itemSchema).min(1, "Minimal 1 item"),
});

type FormValues = z.infer<typeof formSchema>;

export default function StockOpnameCreate() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [loadingRoomStock, setLoadingRoomStock] = useState(false);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [roomStock, setRoomStock] = useState<RoomStockItem[]>([]);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      room_id: 0,
      notes: "",
      items: [],
    },
  });

  const { fields, replace } = useFieldArray({
    control: form.control,
    name: "items",
  });

  const loadRooms = useCallback(async () => {
    try {
      const response = await api.get("/rooms", { params: { limit: 100 } });
      setRooms(response.data.data || []);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Gagal memuat data ruangan.",
      });
    }
  }, [toast]);

  // Load room stock when room is selected
  const loadRoomStock = useCallback(async (roomId: number) => {
    if (!roomId) return;
    
    setLoadingRoomStock(true);
    try {
      const response = await stockOpnameApi.getRoomStock(roomId);
      const stockItems = response.data.data || [];
      setRoomStock(stockItems);

      // Auto-populate items from room stock
      const formItems = stockItems.map((item) => ({
        item_type: item.item_type as "inventory" | "medicine",
        inventory_id: item.inventory_id,
        medicine_id: item.medicine_id,
        system_stock: item.system_stock,
        actual_stock: item.system_stock, // Default to system stock, user will update
        unit: item.unit,
        notes: "",
      }));

      replace(formItems);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Gagal memuat stok ruangan.",
      });
    } finally {
      setLoadingRoomStock(false);
    }
  }, [toast, replace]);

  useEffect(() => {
    setPageTitle("Buat Stock Opname");
    loadRooms();
  }, [loadRooms]);

  const watchRoomId = form.watch("room_id");

  // Load room stock when room changes
  useEffect(() => {
    if (watchRoomId > 0) {
      loadRoomStock(watchRoomId);
    }
  }, [watchRoomId, loadRoomStock]);

  const onSubmit = async (values: FormValues) => {
    if (values.items.length === 0 || roomStock.length === 0) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Tidak ada item untuk di-opname. Pilih ruangan yang memiliki stok.",
      });
      return;
    }

    setSubmitting(true);
    try {
      // Use roomStock for inventory_id/medicine_id since form fields may lose them
      const payload = {
        room_id: values.room_id,
        notes: values.notes,
        items: values.items.map((item, index) => {
          const stockItem = roomStock[index];
          return {
            inventory_id: stockItem?.item_type === "inventory" ? stockItem.inventory_id : undefined,
            medicine_id: stockItem?.item_type === "medicine" ? stockItem.medicine_id : undefined,
            system_stock: stockItem?.system_stock || 0,
            physical_stock: item.actual_stock,
            unit: stockItem?.unit,
            notes: item.notes,
          };
        }),
      };
      await stockOpnameApi.create(payload);
      toast({
        title: "Berhasil",
        description: "Stock opname berhasil dibuat.",
      });
      navigate("/stock-opname");
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Gagal membuat stock opname.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Watch items for total calculation
  const watchItems = form.watch("items");

  // Calculate totals
  const totalDifference = watchItems.reduce((sum, item) => {
    return sum + ((item.actual_stock || 0) - (item.system_stock || 0));
  }, 0);

  return (
    <div className="flex flex-1 flex-col p-4">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="flex items-center gap-4">
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => navigate("/stock-opname")}
              className="h-9 w-9"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-lg font-semibold">Buat Stock Opname</h1>
              <p className="text-sm text-muted-foreground">Buat kegiatan stock opname baru</p>
            </div>
          </div>
          <div className="rounded-lg border p-6 space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="room_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Ruangan *</FormLabel>
                      <Select
                        onValueChange={(value) => field.onChange(parseInt(value))}
                        value={field.value?.toString() || ""}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Pilih ruangan" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {rooms.map((room) => (
                            <SelectItem key={room.id} value={room.id.toString()}>
                              {room.name} ({room.code})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Catatan</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Catatan tambahan (opsional)"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Items Section */}
              <div className="pt-4 border-t">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-base font-semibold">Daftar Item</h3>
                    <p className="text-sm text-muted-foreground">
                      {fields.length > 0
                        ? `${fields.length} item dari stok ruangan`
                        : "Pilih ruangan untuk melihat item yang akan diopname"}
                    </p>
                  </div>
                  {watchRoomId > 0 && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => loadRoomStock(watchRoomId)}
                      disabled={loadingRoomStock}
                    >
                      {loadingRoomStock ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <RefreshCcw className="mr-2 h-4 w-4" />
                      )}
                      Muat Ulang
                    </Button>
                  )}
                </div>
              {loadingRoomStock ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : fields.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  {watchRoomId > 0 ? (
                    <>
                      <Package className="h-12 w-12 mb-4" />
                      <p>Tidak ada stok di ruangan ini</p>
                      <p className="text-sm">Tambahkan inventaris atau obat ke ruangan terlebih dahulu</p>
                    </>
                  ) : (
                    <>
                      <ClipboardList className="h-12 w-12 mb-4" />
                      <p>Pilih ruangan untuk memulai stock opname</p>
                    </>
                  )}
                </div>
              ) : (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Tipe</TableHead>
                        <TableHead>Kode</TableHead>
                        <TableHead>Nama Item</TableHead>
                        <TableHead className="w-28 text-right">Stok Sistem</TableHead>
                        <TableHead className="w-32">Stok Fisik</TableHead>
                        <TableHead className="w-24 text-right">Selisih</TableHead>
                        <TableHead className="w-40">Catatan</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {fields.map((field, index) => {
                        const stockItem = roomStock[index];
                        const watchItem = form.watch(`items.${index}`);
                        const difference =
                          (watchItem?.actual_stock || 0) - (watchItem?.system_stock || 0);

                        return (
                          <TableRow key={field.id}>
                            <TableCell>
                              <Badge variant="outline" className="gap-1">
                                {stockItem?.item_type === "inventory" ? (
                                  <>
                                    <Package className="h-3 w-3" />
                                    Inventaris
                                  </>
                                ) : (
                                  <>
                                    <Pill className="h-3 w-3" />
                                    Obat
                                  </>
                                )}
                              </Badge>
                            </TableCell>
                            <TableCell className="font-mono text-sm">
                              {stockItem?.code || "-"}
                            </TableCell>
                            <TableCell className="font-medium">
                              {stockItem?.name || "-"}
                            </TableCell>
                            <TableCell className="text-right">
                              {watchItem?.system_stock || 0} {watchItem?.unit}
                            </TableCell>
                            <TableCell>
                              <FormField
                                control={form.control}
                                name={`items.${index}.actual_stock`}
                                render={({ field }) => (
                                  <FormItem>
                                    <FormControl>
                                      <Input
                                        type="number"
                                        min={0}
                                        className="w-24"
                                        {...field}
                                        onChange={(e) =>
                                          field.onChange(parseInt(e.target.value) || 0)
                                        }
                                      />
                                    </FormControl>
                                  </FormItem>
                                )}
                              />
                            </TableCell>
                            <TableCell className="text-right">
                              <span
                                className={`font-medium ${
                                  difference === 0
                                    ? "text-green-600"
                                    : difference > 0
                                    ? "text-blue-600"
                                    : "text-red-600"
                                }`}
                              >
                                {difference > 0 ? `+${difference}` : difference}
                              </span>
                            </TableCell>
                            <TableCell>
                              <FormField
                                control={form.control}
                                name={`items.${index}.notes`}
                                render={({ field }) => (
                                  <FormItem>
                                    <FormControl>
                                      <Input placeholder="Catatan" {...field} />
                                    </FormControl>
                                  </FormItem>
                                )}
                              />
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>

                  {/* Summary */}
                  <div className="mt-4 flex justify-end">
                    <div className="text-right">
                      <p className="text-sm text-muted-foreground">Total Selisih</p>
                      <p
                        className={`text-2xl font-bold ${
                          totalDifference === 0
                            ? "text-green-600"
                            : totalDifference > 0
                            ? "text-blue-600"
                            : "text-red-600"
                        }`}
                      >
                        {totalDifference > 0 ? `+${totalDifference}` : totalDifference}
                      </p>
                    </div>
                  </div>
                </>
              )}
              </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate("/stock-opname")}
            >
              Batal
            </Button>
            <Button type="submit" disabled={submitting}>
              <ClipboardList className="mr-2 h-4 w-4" />
              {submitting ? "Menyimpan..." : "Buat Stock Opname"}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
