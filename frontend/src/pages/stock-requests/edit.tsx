import { useState, useEffect, useCallback, type ComponentType, type ReactNode } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { setPageTitle } from "@/lib/page-title";
import { cn } from "@/lib/utils";
import {
  stockRequestsApi,
  type StockRequest,
  stockRequestStatusLabels,
  requestTypeLabels,
} from "@/lib/api/stock-requests";
import { roomsApi } from "@/lib/api/rooms";
import {
  Loader2,
  Package,
  Pill,
  AlertTriangle,
  ClipboardList,
} from "lucide-react";
import { PageShell, PageHeader, PageContent } from "@/components/layout/page-shell";

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
    <section className={cn("space-y-4", className)}>
      <div className={cn("border-b border-neutral-200 dark:border-neutral-800 pb-2.5", headerClassName)}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <Icon className="h-4 w-4 text-neutral-500 mt-0.5 shrink-0" />
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-neutral-800 dark:text-neutral-200">{title}</div>
              {description ? <p className="mt-0.5 text-[11px] font-mono text-neutral-500">{description}</p> : null}
            </div>
          </div>
          {actions}
        </div>
      </div>
      <div className={cn("space-y-3", contentClassName)}>{children}</div>
    </section>
  );
}

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
          label: r.name,
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
          label: r.name,
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
    <PageShell>
      <PageHeader
        icon={ClipboardList}
        title="Edit Permintaan Stok"
        description="Perbarui prioritas, waktu kebutuhan, dan catatan permintaan tanpa mengubah item yang sudah diajukan."
        onBack={() => navigate(`/stock-requests/${id}`)}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" onClick={handleSubmit} disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Simpan Perubahan
            </Button>
          </div>
        }
      />

      <PageContent>
        <div className="grid gap-6 items-start [&_label]:text-[10px] [&_label]:uppercase [&_label]:tracking-[0.08em] [&_label]:text-muted-foreground [&_input]:h-8 [&_[role=combobox]]:h-8 lg:grid-cols-[380px_minmax(0,1fr)] xl:grid-cols-[400px_minmax(0,1fr)]">
          <div>
            <div className="flex flex-col gap-6">
              <SectionPanel
                icon={ClipboardList}
                title="Informasi Dasar"
                description=""
              >
                <div className="space-y-3 border-b border-border/70 pb-3">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <p className="text-xs text-muted-foreground">No. Permintaan</p>
                      <p className="font-mono text-sm font-medium">{request.request_number}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Tipe Permintaan</p>
                      <p className="text-sm font-medium">{requestTypeLabels[request.request_type]}</p>
                    </div>
                    <div className="sm:col-span-2">
                      <p className="text-xs text-muted-foreground">Status</p>
                      <Badge className="mt-1 bg-yellow-100 text-yellow-800">
                        {stockRequestStatusLabels[request.status]}
                      </Badge>
                    </div>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label>Ruangan Pemohon</Label>
                    <Combobox
                      options={rooms}
                      value={formData.from_room_id.toString()}
                      onValueChange={() => { }}
                      placeholder="Pilih ruangan"
                      disabled
                      className="h-8"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label>Depo/Gudang Tujuan</Label>
                    <Combobox
                      options={depoRooms}
                      value={formData.to_room_id.toString()}
                      onValueChange={() => { }}
                      placeholder="Pilih depo/gudang"
                      disabled
                      className="h-8"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label>Prioritas</Label>
                    <Combobox
                      options={priorityOptions}
                      value={formData.priority}
                      onValueChange={(value) => setFormData({ ...formData, priority: value })}
                      placeholder="Pilih prioritas"
                      searchPlaceholder="Cari prioritas..."
                      emptyText="Prioritas tidak ditemukan"
                      className="h-8"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label>Tanggal Dibutuhkan</Label>
                    <Input
                      type="date"
                      value={formData.required_date}
                      onChange={(e) => setFormData({ ...formData, required_date: e.target.value })}
                    />
                  </div>

                  <div className="space-y-1 sm:col-span-2">
                    <Label>Alasan Permintaan</Label>
                    <Input
                      placeholder="Alasan permintaan"
                      value={formData.reason}
                      onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <Label>Catatan</Label>
                  <Textarea
                    placeholder="Catatan tambahan"
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    className="min-h-[96px] resize-none"
                  />
                </div>
              </SectionPanel>

              <SectionPanel
                icon={request.request_type === "inventory" ? Package : Pill}
                title="Ringkasan Permintaan"
                description=""
              >
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="border border-border/70 bg-gradient-to-br from-background via-background to-sky-50/40 px-3 py-3">
                    <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Nomor</div>
                    <div className="mt-1 text-sm font-medium text-foreground">{request.request_number}</div>
                  </div>
                  <div className="border border-border/70 bg-gradient-to-br from-background via-background to-emerald-50/40 px-3 py-3">
                    <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Item Diajukan</div>
                    <div className="mt-1 text-sm font-medium text-foreground">{items.length} item</div>
                  </div>
                  <div className="border border-border/70 bg-gradient-to-br from-background via-background to-amber-50/50 px-3 py-3">
                    <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Prioritas</div>
                    <div className="mt-1 text-sm font-medium text-foreground">{priorityOptions.find((option) => option.value === formData.priority)?.label || formData.priority}</div>
                  </div>
                </div>
              </SectionPanel>
            </div>
          </div>

          <div className="flex flex-col lg:border-l lg:border-neutral-200 dark:lg:border-neutral-800 lg:pl-6">
            <SectionPanel
              icon={request.request_type === "inventory" ? Package : Pill}
              title="Daftar Item"
              description="Item permintaan asli ditampilkan sebagai referensi dan tidak dapat diubah dari halaman edit ini."
            >
              <div className="overflow-x-auto border border-neutral-200 dark:border-neutral-800 bg-background">
                <ScrollArea className="max-h-[560px]">
                  <table className="w-full table-fixed border-collapse text-sm">
                    <thead className="sticky top-0 z-10 bg-background">
                      <tr className="bg-muted/20">
                        <th rowSpan={2} className="h-9 w-[30%] border-b border-r border-border/70 px-3 text-left text-[10px] font-semibold uppercase tracking-[0.18em] text-foreground/80">Item</th>
                        <th rowSpan={2} className="h-9 w-[14%] border-b border-r border-border/70 px-2 text-center text-[10px] font-semibold uppercase tracking-[0.18em] text-foreground/80">Tipe</th>
                        <th colSpan={2} className="h-9 border-b border-r border-border/70 px-2 text-center text-[10px] font-semibold uppercase tracking-[0.18em] text-foreground/80">QTY</th>
                        <th rowSpan={2} className="h-9 w-[10%] border-b border-r border-border/70 px-2 text-center text-[10px] font-semibold uppercase tracking-[0.18em] text-foreground/80">Sat</th>
                        <th rowSpan={2} className="h-9 w-[14%] border-b border-border/70 px-3 text-left text-[10px] font-semibold uppercase tracking-[0.18em] text-foreground/80">Catatan</th>
                      </tr>
                      <tr className="bg-muted/10">
                        <th className="h-8 w-[16%] border-b border-r border-border/70 px-2 text-center text-[10px] font-medium text-foreground/80">Stok</th>
                        <th className="h-8 w-[14%] border-b border-r border-border/70 px-2 text-center text-[10px] font-medium text-foreground/80">Diminta</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((item) => (
                        <tr key={item.id} className="transition-colors hover:bg-muted/10">
                          <td className="border-b border-r border-border/60 px-3 py-1.5 align-middle">
                            <div className="flex items-start gap-2">
                              {item.inventory_id ? (
                                <Package className="mt-0.5 h-4 w-4 text-blue-500" />
                              ) : (
                                <Pill className="mt-0.5 h-4 w-4 text-green-500" />
                              )}
                              <div className="min-w-0 space-y-0.5">
                                <p className="text-xs font-semibold leading-4 text-foreground">{item.name}</p>
                                <p className="font-mono text-[11px] leading-4 text-muted-foreground">{item.code}</p>
                              </div>
                            </div>
                          </td>
                          <td className="border-b border-r border-border/60 px-2 py-1.5 align-middle text-center">
                            <Badge variant="outline" className="text-[10px]">
                              {item.inventory_id ? "Inventaris" : "Obat"}
                            </Badge>
                          </td>
                          <td className="border-b border-r border-border/60 px-2 py-1.5 align-middle text-center text-[11px] text-muted-foreground">
                            {item.current_stock}
                          </td>
                          <td className="border-b border-r border-border/60 px-2 py-1.5 align-middle text-center text-sm font-medium text-foreground">
                            {item.quantity_requested}
                          </td>
                          <td className="border-b border-r border-border/60 px-2 py-1.5 align-middle text-center text-[11px] text-muted-foreground">
                            {item.unit}
                          </td>
                          <td className="border-b border-border/60 px-3 py-1.5 align-middle text-[11px] text-muted-foreground">
                            {item.notes || "-"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </ScrollArea>
              </div>

              <div className="mt-2 flex shrink-0 items-center justify-end gap-2 border-t border-border/70 pt-2.5">
                <Button size="sm" variant="outline" onClick={() => navigate(`/stock-requests/${id}`)}>
                  Batal
                </Button>
              </div>
            </SectionPanel>
          </div>
        </div>
      </PageContent>
    </PageShell>
  );
}
