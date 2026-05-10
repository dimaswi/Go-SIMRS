import { useState, useEffect, useCallback, type ComponentType, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { ArrowLeft, Building2, ClipboardList, Loader2, Package, Pill, RefreshCcw } from "lucide-react";
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
import { PageShell, PageHeader, PageContent } from "@/components/layout/page-shell";
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
  const matchedItems = watchItems.filter((item) => (item.actual_stock || 0) === (item.system_stock || 0)).length;
  const reviewedItems = watchItems.filter((item) => (item.actual_stock || 0) !== (item.system_stock || 0)).length;

  return (
    <PageShell>
      <PageHeader
        title="Buat Stock Opname"
        description="Pilih ruangan, muat stok aktif, lalu catat hasil hitung fisik per item."
        actions={
          <Button type="button" variant="outline" onClick={() => navigate("/stock-opname")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Kembali
          </Button>
        }
      />
      <PageContent className="flex-none pb-8">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <SectionPanel
              icon={Building2}
              title="Informasi Opname"
              description="Tentukan ruangan yang akan dihitung dan tambahkan catatan umum bila diperlukan."
            >
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
            </SectionPanel>

            <SectionPanel
              icon={ClipboardList}
              title="Daftar Item"
              description={fields.length > 0
                ? `${fields.length} item aktif dari stok ruangan siap dihitung fisiknya.`
                : "Pilih ruangan untuk memuat item yang akan diopname."}
              actions={watchRoomId > 0 ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => loadRoomStock(watchRoomId)}
                  disabled={loadingRoomStock}
                  className="h-7 px-2 text-[10px]"
                >
                  {loadingRoomStock ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCcw className="mr-2 h-4 w-4" />
                  )}
                  Muat Ulang
                </Button>
              ) : undefined}
            >
              {loadingRoomStock ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : fields.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
                  {watchRoomId > 0 ? (
                    <>
                      <Package className="mb-4 h-12 w-12" />
                      <p>Tidak ada stok di ruangan ini</p>
                      <p className="text-sm">Tambahkan inventaris atau obat ke ruangan terlebih dahulu</p>
                    </>
                  ) : (
                    <>
                      <ClipboardList className="mb-4 h-12 w-12" />
                      <p>Pilih ruangan untuk memulai stock opname</p>
                    </>
                  )}
                </div>
              ) : (
                <>
                  <div className="grid gap-3 md:grid-cols-3">
                    <SummaryCue label="Item Sesuai" value={`${matchedItems}`} tone="from-emerald-50 via-background to-background" />
                    <SummaryCue label="Perlu Cek Ulang" value={`${reviewedItems}`} tone="from-amber-50 via-background to-background" />
                    <SummaryCue label="Total Selisih" value={totalDifference > 0 ? `+${totalDifference}` : `${totalDifference}`} tone="from-slate-50 via-background to-background" />
                  </div>

                  <div className="-mx-3 -mb-4 sm:-mx-4">
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
                            <TableRow
                              key={field.id}
                              className={
                                difference === 0
                                  ? "bg-emerald-50/30"
                                  : difference > 0
                                  ? "bg-blue-50/30"
                                  : "bg-rose-50/30"
                              }
                            >
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
                                <div className="flex justify-end">
                                  <Badge
                                    variant="outline"
                                    className={
                                      difference === 0
                                        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                        : difference > 0
                                        ? "border-blue-200 bg-blue-50 text-blue-700"
                                        : "border-rose-200 bg-rose-50 text-rose-700"
                                    }
                                  >
                                    {difference > 0 ? `+${difference}` : difference}
                                  </Badge>
                                </div>
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
                  </div>
                </>
              )}
            </SectionPanel>

            <div className="sticky bottom-0 z-10 flex justify-end gap-2 border-t bg-background py-3">
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
      </PageContent>
    </PageShell>
  );
}
