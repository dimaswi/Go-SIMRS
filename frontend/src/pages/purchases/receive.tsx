import { useState, useEffect, useCallback, type ComponentType, type ReactNode } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  PackageCheck,
  CheckCheck,
  Pill,
  Package,
  ArrowLeft,
  Info,
} from "lucide-react";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { PageShell, PageHeader, PageContent } from "@/components/layout/page-shell";
import { useToast } from "@/hooks/use-toast";
import { setPageTitle } from "@/lib/page-title";
import { cn } from "@/lib/utils";
import {
  purchasesApi,
  type Purchase,
  type PurchaseItem,
} from "@/lib/api/stock-requests";

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
    <div className={cn("border border-border/70 bg-background/95", className)}>
      <div className={cn("border-b border-border/70 bg-muted/20 px-2.5 py-2 sm:px-3", headerClassName)}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="border border-border/70 bg-background p-1.5">
              <Icon className="h-4 w-4 text-muted-foreground" />
            </div>
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">{title}</div>
              {description ? (
                <p className="mt-1 text-xs text-muted-foreground">{description}</p>
              ) : null}
            </div>
          </div>
          {actions}
        </div>
      </div>
      <div className={cn("p-2.5 sm:p-3", contentClassName)}>{children}</div>
    </div>
  );
}

const formSchema = z.object({
  receive_date: z.string().min(1, "Tanggal penerimaan wajib diisi"),
  notes: z.string().optional(),
  items: z.array(
    z.object({
      id: z.number(),
      selected: z.boolean(),
      quantity_received: z.number().min(0, "Jumlah tidak valid"),
      quantity_large_received: z.number().min(0, "Jumlah besar tidak valid").optional(),
      quantity_small_received: z.number().min(0, "Jumlah kecil tidak valid").optional(),
      batch_number: z.string().optional(),
      expiry_date: z.string().optional(),
      // Original data for display
      item_name: z.string(),
      item_code: z.string().optional(),
      item_type: z.enum(["medicine", "inventory"]),
      unit: z.string(),
      unit_large: z.string().optional(),
      unit_small: z.string().optional(),
      conversion_factor: z.number().min(1).optional(),
      quantity_ordered: z.number(),
      already_received: z.number(),
      remaining: z.number(),
    })
  ),
});

type FormValues = z.infer<typeof formSchema>;

const toInputDate = (value?: string) => (value ? value.slice(0, 10) : "");

export default function PurchaseReceive() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [purchase, setPurchase] = useState<Purchase | null>(null);
  const [bulkBatchNumber, setBulkBatchNumber] = useState("");
  const [bulkExpiryDate, setBulkExpiryDate] = useState("");

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      receive_date: new Date().toISOString().split("T")[0],
      notes: "",
      items: [],
    },
  });

  const { fields } = useFieldArray({
    control: form.control,
    name: "items",
  });

  const watchItems = form.watch("items");

  const loadData = useCallback(async () => {
    if (!id) return;

    setLoading(true);
    try {
      const response = await purchasesApi.getById(parseInt(id));
      const data = response.data.data;
      setPurchase(data);
      setPageTitle(`Terima Barang - ${data.purchase_number}`);

      // Set form defaults
      if (data.items) {
        form.setValue(
          "items",
          data.items.map((item: PurchaseItem) => {
            const remaining =
              item.quantity_ordered - (item.quantity_received || 0);
            const factor = Math.max(1, Number(item.conversion_factor || 1));
            const remainingLarge = Math.floor(remaining / factor);
            const remainingSmall = remaining % factor;
            const itemName =
              item.inventory?.name || item.medicine?.name || "Unknown";
            const itemCode = item.inventory?.code || item.medicine?.code;
            const itemType = item.medicine_id ? "medicine" : "inventory";

            return {
              id: item.id,
              selected: remaining > 0,
              quantity_received: remaining,
              batch_number: item.batch_number || "",
              expiry_date: toInputDate(item.expiry_date),
              item_name: itemName,
              item_code: itemCode || "",
              item_type: itemType as "medicine" | "inventory",
              unit: item.unit || "pcs",
              unit_large: item.unit_large || "",
              unit_small: item.unit_small || item.unit || "pcs",
              conversion_factor: factor,
              quantity_large_received: remainingLarge,
              quantity_small_received: remainingSmall,
              quantity_ordered: item.quantity_ordered,
              already_received: item.quantity_received || 0,
              remaining: remaining,
            };
          })
        );
      }
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
  }, [id, toast, navigate, form]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Select all items with remaining quantity
  const handleSelectAll = () => {
    const currentItems = form.getValues("items");
    const allSelected = currentItems
      .filter((item) => item.remaining > 0)
      .every((item) => item.selected);

    form.setValue(
      "items",
      currentItems.map((item) => ({
        ...item,
        selected: item.remaining > 0 ? !allSelected : false,
      }))
    );
  };

  // Fill all selected items with remaining quantity
  const handleFillAll = () => {
    const currentItems = form.getValues("items");
    form.setValue(
      "items",
      currentItems.map((item) => ({
        ...item,
        quantity_received: item.selected ? item.remaining : item.quantity_received,
      }))
    );
  };

  // Apply batch number to all selected medicines
  const handleApplyBatchToSelected = (batchNumber: string) => {
    const currentItems = form.getValues("items");
    form.setValue(
      "items",
      currentItems.map((item) => ({
        ...item,
        batch_number:
          item.selected && item.item_type === "medicine"
            ? batchNumber
            : item.batch_number,
      }))
    );
  };

  // Apply expiry date to all selected medicines
  const handleApplyExpiryToSelected = (expiryDate: string) => {
    const currentItems = form.getValues("items");
    form.setValue(
      "items",
      currentItems.map((item) => ({
        ...item,
        expiry_date:
          item.selected && item.item_type === "medicine"
            ? expiryDate
            : item.expiry_date,
      }))
    );
  };

  const onSubmit = async (values: FormValues) => {
    if (!id) return;

    const resolveItemReceiveQty = (item: FormValues["items"][number]) => {
      const factor = Math.max(1, Number(item.conversion_factor || 1));
      const hasLargeUnit = item.item_type === "medicine" && !!item.unit_large && factor > 1;
      if (hasLargeUnit) {
        const qtyLarge = Math.max(0, Number(item.quantity_large_received || 0));
        const qtySmall = Math.max(0, Number(item.quantity_small_received || 0));
        return (qtyLarge * factor) + qtySmall;
      }
      return Math.max(0, Number(item.quantity_received || 0));
    };

    // Filter only selected items with quantity > 0
    const itemsToReceive = values.items.filter(
      (item) => item.selected && resolveItemReceiveQty(item) > 0
    );

    if (itemsToReceive.length === 0) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Pilih minimal satu item untuk diterima.",
      });
      return;
    }

    setSubmitting(true);
    try {
      const cleanedItems = itemsToReceive.map((item) => ({
        id: item.id,
        quantity_received: resolveItemReceiveQty(item),
        quantity_large_received: item.item_type === "medicine" ? Math.max(0, Number(item.quantity_large_received || 0)) : undefined,
        quantity_small_received: item.item_type === "medicine" ? Math.max(0, Number(item.quantity_small_received || 0)) : undefined,
        batch_number: item.batch_number || undefined,
        expiry_date: item.expiry_date || undefined,
      }));

      await purchasesApi.receive(parseInt(id), {
        notes: values.notes,
        items: cleanedItems,
      });

      toast({
        title: "Berhasil",
        description: `${itemsToReceive.length} item berhasil diterima.`,
      });
      navigate(`/purchases/${id}`);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Gagal menerima barang.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const resolveDisplayReceived = (item?: FormValues["items"][number]) => {
    if (!item) return 0;
    const factor = Math.max(1, Number(item.conversion_factor || 1));
    const hasLargeUnit = item.item_type === "medicine" && !!item.unit_large && factor > 1;
    if (hasLargeUnit) {
      const qtyLarge = Math.max(0, Number(item.quantity_large_received || 0));
      const qtySmall = Math.max(0, Number(item.quantity_small_received || 0));
      return (qtyLarge * factor) + qtySmall;
    }
    return Math.max(0, Number(item.quantity_received || 0));
  };

  // Calculate stats
  const selectedCount = watchItems?.filter((item) => item.selected).length || 0;
  const totalItems = watchItems?.length || 0;
  const itemsWithRemaining =
    watchItems?.filter((item) => item.remaining > 0).length || 0;
  const completedItems =
    watchItems?.filter((item) => item.remaining === 0).length || 0;
  const selectedMedicines =
    watchItems?.filter((item) => item.selected && item.item_type === "medicine")
      .length || 0;

  if (loading) {
    return (
      <PageShell>
        <PageHeader
          title="Terima Barang"
          description="Catat item yang sudah datang dan lengkapi informasi batch bila diperlukan."
        />
        <PageContent className="flex-none pb-8">
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <Skeleton className="h-10 w-10" />
              <Skeleton className="h-8 w-64" />
            </div>
            <Skeleton className="h-48" />
            <Skeleton className="h-96" />
          </div>
        </PageContent>
      </PageShell>
    );
  }

  if (!purchase) {
    return null;
  }

  const isFollowUpReceipt = purchase.status === "partial";
  const receivePageTitle = isFollowUpReceipt
    ? `Terima Lagi ${purchase.purchase_number}`
    : `Terima Barang ${purchase.purchase_number}`;
  const receivePageDescription = isFollowUpReceipt
    ? "Lanjutkan penerimaan item yang masih tersisa dari pembelian ini."
    : "Catat item yang datang dan selesaikan sisa penerimaan per item.";

  return (
    <PageShell className="lg:overflow-hidden">
      <PageHeader
        title={receivePageTitle}
        description={receivePageDescription}
        actions={
          <Button variant="outline" size="sm" onClick={() => navigate(`/purchases/${id}`)}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Kembali
          </Button>
        }
      />
      <PageContent className="min-h-0 overflow-hidden pb-3">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="grid min-h-0 flex-1 gap-3 [&_label]:text-[10px] [&_label]:uppercase [&_label]:tracking-[0.08em] [&_label]:text-muted-foreground [&_input]:h-8 lg:grid-cols-[minmax(320px,380px)_minmax(0,1fr)] xl:grid-cols-[minmax(330px,390px)_minmax(0,1fr)]">
            <div className="min-h-0 overflow-hidden">
              <div className="flex h-full min-h-0 flex-col gap-3 overflow-y-auto pr-1">
                <SectionPanel
                  icon={PackageCheck}
                  title="Informasi Pembelian"
                  description="Ringkasan pembelian"
                >
                  <div className="space-y-3 border-b border-border/70 pb-3">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <p className="text-xs text-muted-foreground">No. Pembelian</p>
                        <p className="font-mono text-sm font-medium">{purchase.purchase_number}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Supplier</p>
                        <p className="text-sm font-medium">{purchase.supplier_name}</p>
                      </div>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-3">
                      <div>
                        <p className="text-xs text-muted-foreground">Total Item</p>
                        <p className="text-sm font-medium">{totalItems} item</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Sudah Lengkap</p>
                        <p className="text-sm font-medium text-emerald-700">{completedItems} item</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Masih Sisa</p>
                        <p className="text-sm font-medium text-amber-700">{itemsWithRemaining} item</p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3 pt-3">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <FormField
                        control={form.control}
                        name="receive_date"
                        render={({ field }) => (
                          <FormItem className="space-y-1">
                            <FormLabel>Tanggal Penerimaan *</FormLabel>
                            <FormControl>
                              <Input type="date" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="notes"
                        render={({ field }) => (
                          <FormItem className="space-y-1">
                            <FormLabel>Catatan</FormLabel>
                            <FormControl>
                              <Input placeholder="Catatan penerimaan" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>
                </SectionPanel>

                <SectionPanel
                  icon={CheckCheck}
                  title="Aksi Massal"
                  description="Pilih item aktif, isi sisa otomatis, lalu terapkan batch atau exp untuk obat terpilih."
                  className="flex flex-col"
                  contentClassName="space-y-3"
                  actions={
                    <div className="flex items-center gap-1.5">
                      <Button type="button" variant="outline" size="sm" className="h-7 px-2 text-[10px]" onClick={handleSelectAll}>
                        <CheckCheck className="mr-1 h-3.5 w-3.5" />
                        {selectedCount === itemsWithRemaining ? "Batal Pilih" : "Pilih Semua"}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 px-2 text-[10px]"
                        onClick={handleFillAll}
                        disabled={selectedCount === 0}
                      >
                        <PackageCheck className="mr-1 h-3.5 w-3.5" />
                        Isi Sisa
                      </Button>
                    </div>
                  }
                >
                  {selectedMedicines > 0 ? (
                    <>
                      <Alert className="border-border/70 px-3 py-2">
                        <Info className="h-4 w-4" />
                        <AlertDescription className="text-xs leading-5">
                          <strong>{selectedMedicines} obat</strong> sedang dipilih. Batch dan tanggal kadaluarsa bisa diisi massal dari panel ini.
                        </AlertDescription>
                      </Alert>

                      <div className="grid gap-3">
                        <div className="space-y-1">
                          <label className="text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                            Batch Semua Obat Terpilih
                          </label>
                          <div className="flex gap-2">
                            <Input
                              placeholder="Masukkan batch"
                              value={bulkBatchNumber}
                              onChange={(e) => setBulkBatchNumber(e.target.value)}
                            />
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              className="h-8 px-3 text-[11px]"
                              onClick={() => {
                                if (!bulkBatchNumber) return;
                                handleApplyBatchToSelected(bulkBatchNumber);
                                toast({
                                  title: "Berhasil",
                                  description: `Batch number diterapkan ke ${selectedMedicines} obat.`,
                                });
                              }}
                            >
                              Terapkan
                            </Button>
                          </div>
                        </div>

                        <div className="space-y-1">
                          <label className="text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                            Exp. Semua Obat Terpilih
                          </label>
                          <div className="flex gap-2">
                            <Input
                              type="date"
                              value={bulkExpiryDate}
                              onChange={(e) => setBulkExpiryDate(e.target.value)}
                            />
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              className="h-8 px-3 text-[11px]"
                              onClick={() => {
                                if (!bulkExpiryDate) return;
                                handleApplyExpiryToSelected(bulkExpiryDate);
                                toast({
                                  title: "Berhasil",
                                  description: `Tanggal kadaluarsa diterapkan ke ${selectedMedicines} obat.`,
                                });
                              }}
                            >
                              Terapkan
                            </Button>
                          </div>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="rounded-md border border-dashed border-border/70 bg-muted/10 px-3 py-4 text-xs text-muted-foreground">
                      Pilih minimal satu item obat di tabel kanan agar aksi batch dan exp tersedia.
                    </div>
                  )}
                </SectionPanel>
              </div>
            </div>

            <div className="flex min-h-0 flex-col overflow-hidden">
              <SectionPanel
                icon={Package}
                title="Daftar Item"
                description={`Kelola penerimaan ${totalItems} item dari pembelian ini dalam tabel detail yang ringkas.`}
                className="flex min-h-0 flex-1 flex-col overflow-hidden"
                headerClassName="px-2.5 py-2 sm:px-3"
                contentClassName="flex min-h-0 flex-1 flex-col overflow-hidden px-2.5 py-2.5 sm:px-3"
                actions={
                    <div className="flex items-center gap-1.5">
                      <Badge variant="outline" className="h-5 px-2 text-[10px]">
                        {completedItems} / {totalItems} lengkap
                      </Badge>
                      {selectedCount > 0 && (
                        <Badge className="h-5 bg-primary px-2 text-[10px]">
                          {selectedCount} dipilih
                        </Badge>
                      )}
                    </div>
                  }
              >
                <div className="min-h-0 flex-1 overflow-hidden rounded-lg border border-border/80 bg-background">
                  <ScrollArea className="h-full">
                    <table className="w-full table-fixed border-collapse text-sm">
                      <thead className="sticky top-0 z-10 bg-background">
                        <tr className="bg-muted/20">
                          <th className="h-9 w-[7%] border-b border-r border-border/70 px-2 text-center text-[10px] font-semibold uppercase tracking-[0.18em] text-foreground/80">Pilih</th>
                          <th className="h-9 w-[31%] border-b border-r border-border/70 px-3 text-left text-[10px] font-semibold uppercase tracking-[0.18em] text-foreground/80">Item</th>
                          <th className="h-9 w-[18%] border-b border-r border-border/70 px-3 text-left text-[10px] font-semibold uppercase tracking-[0.18em] text-foreground/80">Status</th>
                          <th className="h-9 w-[30%] border-b border-r border-border/70 px-3 text-left text-[10px] font-semibold uppercase tracking-[0.18em] text-foreground/80">Detail Penerimaan</th>
                          <th className="h-9 w-[14%] border-b border-border/70 px-3 text-left text-[10px] font-semibold uppercase tracking-[0.18em] text-foreground/80">Keterangan</th>
                        </tr>
                      </thead>
                      <tbody>
                        {fields.map((field, index) => {
                          const item = watchItems?.[index];
                          const isComplete = item?.remaining === 0;
                          const isSelected = item?.selected;
                          const isMedicine = item?.item_type === "medicine";

                          return (
                            <tr
                              key={field.id}
                              className={cn(
                                "align-top transition-colors hover:bg-muted/10",
                                isComplete && "bg-muted/20",
                                isSelected && !isComplete && "bg-primary/5"
                              )}
                            >
                              <td className="border-b border-r border-border/60 px-2 py-2.5 text-center align-top">
                                <FormField
                                  control={form.control}
                                  name={`items.${index}.selected`}
                                  render={({ field: checkField }) => (
                                    <FormItem className="flex items-center justify-center">
                                      <FormControl>
                                        <Checkbox
                                          checked={checkField.value}
                                          onCheckedChange={checkField.onChange}
                                          disabled={isComplete}
                                        />
                                      </FormControl>
                                    </FormItem>
                                  )}
                                />
                              </td>
                              <td className="border-b border-r border-border/60 px-3 py-2.5 align-top">
                                <div className="flex items-start gap-2.5">
                                  <div
                                    className={cn(
                                      "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border",
                                      isComplete
                                        ? "border-emerald-200 bg-emerald-50"
                                        : isMedicine
                                          ? "border-blue-200 bg-blue-50"
                                          : "border-amber-200 bg-amber-50"
                                    )}
                                  >
                                    {isComplete ? (
                                      <PackageCheck className="h-3.5 w-3.5 text-emerald-600" />
                                    ) : isMedicine ? (
                                      <Pill className="h-3.5 w-3.5 text-blue-600" />
                                    ) : (
                                      <Package className="h-3.5 w-3.5 text-amber-600" />
                                    )}
                                  </div>
                                  <div className="min-w-0 space-y-0.5">
                                    <p className="truncate text-xs font-semibold leading-4 text-foreground">{item?.item_name}</p>
                                    {item?.item_code ? (
                                      <p className="font-mono text-[11px] leading-4 text-muted-foreground">{item.item_code}</p>
                                    ) : null}
                                    <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                                      <Badge
                                        variant="outline"
                                        className={cn(
                                          "h-5 px-1.5 text-[10px]",
                                          isMedicine ? "bg-blue-50 text-blue-700" : "bg-amber-50 text-amber-700"
                                        )}
                                      >
                                        {isMedicine ? "Obat" : "Inventaris"}
                                      </Badge>
                                      <span className="text-[11px] text-muted-foreground">Sat: {item?.unit}</span>
                                    </div>
                                  </div>
                                </div>
                              </td>
                              <td className="border-b border-r border-border/60 px-3 py-2.5 align-top">
                                <div className="space-y-1 rounded-md bg-muted/15 px-2.5 py-2 text-[11px] leading-4">
                                  <p className="text-muted-foreground">Dipesan: <span className="font-medium text-foreground">{item?.quantity_ordered} {item?.unit_small || item?.unit}</span></p>
                                  <p className="text-muted-foreground">Diterima: <span className="font-medium text-foreground">{item?.already_received}</span></p>
                                  <p className={cn("font-medium", isComplete ? "text-emerald-700" : "text-amber-700")}>
                                    Sisa: {item?.remaining}
                                  </p>
                                  {item?.item_type === "medicine" && item?.unit_large && (item?.conversion_factor || 1) > 1 ? (
                                    <p className="text-muted-foreground">
                                      Konversi: 1 {item.unit_large} = {item.conversion_factor} {item.unit_small || item.unit}
                                    </p>
                                  ) : null}
                                </div>
                              </td>
                              <td className="border-b border-r border-border/60 px-3 py-2.5 align-top">
                                {isComplete ? (
                                  <div className="rounded-md border border-dashed border-border/70 bg-muted/10 px-3 py-4 text-[11px] text-muted-foreground">
                                    Item ini sudah diterima penuh.
                                  </div>
                                ) : isSelected ? (
                                  <div className="grid gap-2 sm:grid-cols-2">
                                    {isMedicine && item?.unit_large && (item?.conversion_factor || 1) > 1 ? (
                                      <>
                                        <FormField
                                          control={form.control}
                                          name={`items.${index}.quantity_large_received`}
                                          render={({ field: qtyLargeField }) => (
                                            <FormItem className="space-y-1">
                                              <FormLabel>Qty Besar ({item.unit_large})</FormLabel>
                                              <FormControl>
                                                <Input
                                                  type="number"
                                                  min={0}
                                                  value={qtyLargeField.value ?? 0}
                                                  onChange={(e) => {
                                                    const nextLarge = Math.max(0, parseInt(e.target.value) || 0);
                                                    const factor = Math.max(1, Number(item?.conversion_factor || 1));
                                                    const smallPath = `items.${index}.quantity_small_received` as const;
                                                    const currentSmall = Math.max(0, Number(form.getValues(smallPath) || 0));
                                                    const nextTotal = (nextLarge * factor) + currentSmall;
                                                    form.setValue(`items.${index}.quantity_large_received`, nextLarge);
                                                    form.setValue(`items.${index}.quantity_received`, Math.min(item?.remaining || 0, nextTotal));
                                                  }}
                                                />
                                              </FormControl>
                                            </FormItem>
                                          )}
                                        />
                                        <FormField
                                          control={form.control}
                                          name={`items.${index}.quantity_small_received`}
                                          render={({ field: qtySmallField }) => (
                                            <FormItem className="space-y-1">
                                              <FormLabel>Qty Kecil ({item.unit_small || item.unit})</FormLabel>
                                              <FormControl>
                                                <Input
                                                  type="number"
                                                  min={0}
                                                  value={qtySmallField.value ?? 0}
                                                  onChange={(e) => {
                                                    const nextSmall = Math.max(0, parseInt(e.target.value) || 0);
                                                    const factor = Math.max(1, Number(item?.conversion_factor || 1));
                                                    const largePath = `items.${index}.quantity_large_received` as const;
                                                    const currentLarge = Math.max(0, Number(form.getValues(largePath) || 0));
                                                    const nextTotal = (currentLarge * factor) + nextSmall;
                                                    form.setValue(`items.${index}.quantity_small_received`, nextSmall);
                                                    form.setValue(`items.${index}.quantity_received`, Math.min(item?.remaining || 0, nextTotal));
                                                  }}
                                                />
                                              </FormControl>
                                            </FormItem>
                                          )}
                                        />
                                        <div className="sm:col-span-2 rounded-md border border-border/70 bg-muted/10 px-3 py-2 text-[11px] text-muted-foreground">
                                          Total diterima sesi ini: <span className="font-semibold text-foreground">{resolveDisplayReceived(item)}</span> {item?.unit_small || item?.unit}
                                        </div>
                                      </>
                                    ) : (
                                      <FormField
                                        control={form.control}
                                        name={`items.${index}.quantity_received`}
                                        render={({ field: qtyField }) => (
                                          <FormItem className="space-y-1">
                                            <FormLabel>Qty Diterima</FormLabel>
                                            <FormControl>
                                              <Input
                                                type="number"
                                                min={0}
                                                max={item?.remaining}
                                                {...qtyField}
                                                onChange={(e) => qtyField.onChange(parseInt(e.target.value) || 0)}
                                              />
                                            </FormControl>
                                          </FormItem>
                                        )}
                                      />
                                    )}

                                    {isMedicine ? (
                                      <>
                                        <FormField
                                          control={form.control}
                                          name={`items.${index}.batch_number`}
                                          render={({ field: batchField }) => (
                                            <FormItem className="space-y-1">
                                              <FormLabel>Batch</FormLabel>
                                              <FormControl>
                                                <Input placeholder="Nomor batch" {...batchField} />
                                              </FormControl>
                                            </FormItem>
                                          )}
                                        />
                                        <FormField
                                          control={form.control}
                                          name={`items.${index}.expiry_date`}
                                          render={({ field: expiryField }) => (
                                            <FormItem className="space-y-1 sm:col-span-2">
                                              <FormLabel>Tanggal Expired</FormLabel>
                                              <FormControl>
                                                <Input type="date" {...expiryField} />
                                              </FormControl>
                                            </FormItem>
                                          )}
                                        />
                                      </>
                                    ) : (
                                      <div className="rounded-md border border-dashed border-border/70 bg-muted/10 px-3 py-3 text-[11px] text-muted-foreground">
                                        Tidak memerlukan batch dan exp.
                                      </div>
                                    )}
                                  </div>
                                ) : (
                                  <div className="rounded-md border border-dashed border-border/70 bg-muted/10 px-3 py-4 text-[11px] text-muted-foreground">
                                    Centang item ini untuk mulai input penerimaan.
                                  </div>
                                )}
                              </td>
                              <td className="border-b border-border/60 px-3 py-2.5 align-top">
                                <div className="space-y-1 text-[11px] leading-4 text-muted-foreground">
                                  {isComplete ? (
                                    <p className="font-medium text-emerald-700">Lengkap</p>
                                  ) : isSelected ? (
                                    <p className="font-medium text-primary">Siap diproses</p>
                                  ) : (
                                    <p>Belum dipilih</p>
                                  )}
                                  {isMedicine ? <p>Perlu batch dan exp bila tersedia.</p> : <p>Hanya memerlukan qty diterima.</p>}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </ScrollArea>
                </div>

                <div className="mt-2 flex shrink-0 items-center justify-between border-t border-border/70 px-0 pt-2.5">
                  <p className="text-xs text-muted-foreground">{selectedCount} item akan diterima pada sesi ini</p>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => navigate(`/purchases/${id}`)}
                    >
                      Batal
                    </Button>
                    <Button size="sm" type="submit" disabled={submitting || selectedCount === 0}>
                      <PackageCheck className="mr-2 h-4 w-4" />
                      {submitting ? "Menyimpan..." : `Terima ${selectedCount} Item`}
                    </Button>
                  </div>
                </div>
              </SectionPanel>
            </div>
          </form>
        </Form>
      </PageContent>
    </PageShell>
  );
}
