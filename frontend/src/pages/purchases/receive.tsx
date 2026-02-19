import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  ArrowLeft,
  PackageCheck,
  CheckCheck,
  Pill,
  Package,
  AlertTriangle,
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
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { setPageTitle } from "@/lib/page-title";
import { cn } from "@/lib/utils";
import {
  purchasesApi,
  type Purchase,
  type PurchaseItem,
} from "@/lib/api/stock-requests";

const formSchema = z.object({
  receive_date: z.string().min(1, "Tanggal penerimaan wajib diisi"),
  notes: z.string().optional(),
  items: z.array(
    z.object({
      id: z.number(),
      selected: z.boolean(),
      quantity_received: z.number().min(0, "Jumlah tidak valid"),
      batch_number: z.string().optional(),
      expiry_date: z.string().optional(),
      // Original data for display
      item_name: z.string(),
      item_code: z.string().optional(),
      item_type: z.enum(["medicine", "inventory"]),
      unit: z.string(),
      quantity_ordered: z.number(),
      already_received: z.number(),
      remaining: z.number(),
    })
  ),
});

type FormValues = z.infer<typeof formSchema>;

export default function PurchaseReceive() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [purchase, setPurchase] = useState<Purchase | null>(null);

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
            const itemName =
              item.inventory?.name || item.medicine?.name || "Unknown";
            const itemCode = item.inventory?.code || item.medicine?.code;
            const itemType = item.medicine_id ? "medicine" : "inventory";

            return {
              id: item.id,
              selected: remaining > 0,
              quantity_received: remaining,
              batch_number: "",
              expiry_date: "",
              item_name: itemName,
              item_code: itemCode || "",
              item_type: itemType as "medicine" | "inventory",
              unit: item.unit || "pcs",
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

    // Filter only selected items with quantity > 0
    const itemsToReceive = values.items.filter(
      (item) => item.selected && item.quantity_received > 0
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
        quantity_received: item.quantity_received,
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
      <div className="flex flex-1 flex-col p-4">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10" />
          <Skeleton className="h-8 w-64" />
        </div>
        <Skeleton className="h-48" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (!purchase) {
    return null;
  }

  return (
    <div className="flex flex-1 flex-col p-4">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => navigate(`/purchases/${id}`)}
                className="h-9 w-9"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div className="space-y-1">
                <h1 className="text-lg font-semibold">
                  Terima Barang
                </h1>
                <p className="text-sm text-muted-foreground">
                  Pembelian: {purchase.purchase_number} •{" "}
                  {purchase.supplier_name}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline">
                {completedItems} / {totalItems} Lengkap
              </Badge>
              {selectedCount > 0 && (
                <Badge className="bg-primary">
                  {selectedCount} dipilih
                </Badge>
              )}
            </div>
          </div>

          <div className="rounded-lg border p-6 space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="receive_date"
                  render={({ field }) => (
                    <FormItem>
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
                    <FormItem>
                      <FormLabel>Catatan</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Catatan penerimaan (opsional)"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
          </div>

          {/* Bulk Actions Card */}
          <div className="rounded-lg border">
            <div className="flex items-center justify-between px-6 py-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium">
                  Aksi Massal
                </h3>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleSelectAll}
                  >
                    <CheckCheck className="h-4 w-4 mr-1" />
                    {selectedCount === itemsWithRemaining
                      ? "Batal Pilih Semua"
                      : "Pilih Semua"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleFillAll}
                    disabled={selectedCount === 0}
                  >
                    <PackageCheck className="h-4 w-4 mr-1" />
                    Isi Sisa ke Terpilih
                  </Button>
                </div>
              </div>
            </div>
            {selectedMedicines > 0 && (
              <div className="px-6 pb-6">
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertDescription>
                    <strong>{selectedMedicines} obat</strong> terpilih. Anda
                    dapat mengisi batch number dan tanggal kadaluarsa secara
                    massal.
                  </AlertDescription>
                </Alert>
                <div className="grid gap-4 md:grid-cols-2 mt-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">
                      Batch Number untuk Semua Obat Terpilih
                    </label>
                    <div className="flex gap-2">
                      <Input
                        placeholder="Masukkan batch number..."
                        id="bulk-batch"
                      />
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                          const input = document.getElementById(
                            "bulk-batch"
                          ) as HTMLInputElement;
                          if (input?.value) {
                            handleApplyBatchToSelected(input.value);
                            toast({
                              title: "Berhasil",
                              description: `Batch number diterapkan ke ${selectedMedicines} obat.`,
                            });
                          }
                        }}
                      >
                        Terapkan
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">
                      Tanggal Kadaluarsa untuk Semua Obat Terpilih
                    </label>
                    <div className="flex gap-2">
                      <Input type="date" id="bulk-expiry" />
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                          const input = document.getElementById(
                            "bulk-expiry"
                          ) as HTMLInputElement;
                          if (input?.value) {
                            handleApplyExpiryToSelected(input.value);
                            toast({
                              title: "Berhasil",
                              description: `Tanggal kadaluarsa diterapkan ke ${selectedMedicines} obat.`,
                            });
                          }
                        }}
                      >
                        Terapkan
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Items Card */}
          <div className="rounded-lg border">
            <div className="px-6 py-4">
              <h3 className="text-sm font-medium">
                Daftar Item ({totalItems})
              </h3>
              <p className="text-sm text-muted-foreground">
                Centang item yang akan diterima, lalu masukkan jumlah
              </p>
            </div>
            <div className="p-0">
              <ScrollArea className="h-[500px]">
                <div className="divide-y">
                  {fields.map((field, index) => {
                    const item = watchItems?.[index];
                    const isComplete = item?.remaining === 0;
                    const isSelected = item?.selected;
                    const isMedicine = item?.item_type === "medicine";

                    return (
                      <div
                        key={field.id}
                        className={cn(
                          "p-4 transition-colors",
                          isComplete && "bg-muted/30",
                          isSelected && !isComplete && "bg-primary/5"
                        )}
                      >
                        <div className="flex items-start gap-4">
                          {/* Checkbox */}
                          <div className="pt-1">
                            <FormField
                              control={form.control}
                              name={`items.${index}.selected`}
                              render={({ field: checkField }) => (
                                <FormItem>
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
                          </div>

                          {/* Icon */}
                          <div
                            className={cn(
                              "flex h-10 w-10 items-center justify-center rounded-full shrink-0",
                              isComplete
                                ? "bg-green-100"
                                : isMedicine
                                ? "bg-blue-100"
                                : "bg-purple-100"
                            )}
                          >
                            {isComplete ? (
                              <PackageCheck className="h-5 w-5 text-green-600" />
                            ) : isMedicine ? (
                              <Pill className="h-5 w-5 text-blue-600" />
                            ) : (
                              <Package className="h-5 w-5 text-purple-600" />
                            )}
                          </div>

                          {/* Item Info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-medium">{item?.item_name}</p>
                              <Badge
                                variant="outline"
                                className={cn(
                                  "text-[10px]",
                                  isMedicine
                                    ? "bg-blue-50 text-blue-700"
                                    : "bg-purple-50 text-purple-700"
                                )}
                              >
                                {isMedicine ? "Obat" : "Inventaris"}
                              </Badge>
                              {isComplete && (
                                <Badge className="bg-green-100 text-green-800 text-[10px]">
                                  Lengkap
                                </Badge>
                              )}
                            </div>
                            {item?.item_code && (
                              <p className="text-xs text-muted-foreground">
                                {item.item_code}
                              </p>
                            )}

                            {/* Quantity Info */}
                            <div className="flex items-center gap-4 mt-2 text-sm">
                              <span>
                                Dipesan:{" "}
                                <strong>
                                  {item?.quantity_ordered} {item?.unit}
                                </strong>
                              </span>
                              <span>
                                Diterima:{" "}
                                <strong>{item?.already_received}</strong>
                              </span>
                              {!isComplete && (
                                <span className="text-orange-600">
                                  Sisa: <strong>{item?.remaining}</strong>
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Input Fields */}
                          {!isComplete && isSelected && (
                            <div className="flex flex-col gap-2 w-[280px]">
                              <FormField
                                control={form.control}
                                name={`items.${index}.quantity_received`}
                                render={({ field: qtyField }) => (
                                  <FormItem>
                                    <div className="flex items-center gap-2">
                                      <FormLabel className="text-xs w-16 shrink-0">
                                        Jumlah
                                      </FormLabel>
                                      <FormControl>
                                        <Input
                                          type="number"
                                          min={0}
                                          max={item?.remaining}
                                          className="h-8"
                                          {...qtyField}
                                          onChange={(e) =>
                                            qtyField.onChange(
                                              parseInt(e.target.value) || 0
                                            )
                                          }
                                        />
                                      </FormControl>
                                    </div>
                                  </FormItem>
                                )}
                              />

                              {isMedicine && (
                                <>
                                  <FormField
                                    control={form.control}
                                    name={`items.${index}.batch_number`}
                                    render={({ field: batchField }) => (
                                      <FormItem>
                                        <div className="flex items-center gap-2">
                                          <FormLabel className="text-xs w-16 shrink-0">
                                            Batch
                                          </FormLabel>
                                          <FormControl>
                                            <Input
                                              placeholder="Batch no."
                                              className="h-8"
                                              {...batchField}
                                            />
                                          </FormControl>
                                        </div>
                                      </FormItem>
                                    )}
                                  />
                                  <FormField
                                    control={form.control}
                                    name={`items.${index}.expiry_date`}
                                    render={({ field: expiryField }) => (
                                      <FormItem>
                                        <div className="flex items-center gap-2">
                                          <FormLabel className="text-xs w-16 shrink-0">
                                            Exp.
                                          </FormLabel>
                                          <FormControl>
                                            <Input
                                              type="date"
                                              className="h-8"
                                              {...expiryField}
                                            />
                                          </FormControl>
                                        </div>
                                      </FormItem>
                                    )}
                                  />
                                </>
                              )}
                            </div>
                          )}

                          {!isComplete && !isSelected && (
                            <div className="w-[280px] flex items-center justify-center text-muted-foreground text-sm">
                              <AlertTriangle className="h-4 w-4 mr-2" />
                              Centang untuk menerima
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            </div>
          </div>

          {/* Actions */}
          <Separator />
          <div className="flex justify-between items-center">
            <p className="text-sm text-muted-foreground">
              {selectedCount} item akan diterima
            </p>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate(`/purchases/${id}`)}
              >
                Batal
              </Button>
              <Button type="submit" disabled={submitting || selectedCount === 0}>
                <PackageCheck className="mr-2 h-4 w-4" />
                {submitting ? "Menyimpan..." : `Terima ${selectedCount} Item`}
              </Button>
            </div>
          </div>
        </form>
      </Form>
    </div>
  );
}
