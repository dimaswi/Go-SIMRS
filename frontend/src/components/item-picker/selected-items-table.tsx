import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Trash2, Package, Pill } from "lucide-react";
import { cn } from "@/lib/utils";
import { type SelectedItemWithQty } from "./item-picker-dialog";
import {
  calculateCommercialTotals,
  calculateLineTotal,
  setDiscountAmount,
  setDiscountPercent,
  setTaxAmount,
  setTaxPercent,
  syncPurchaseItemCommercials,
} from "./purchase-item-commercials";

interface SelectedItemsTableProps {
  items: SelectedItemWithQty[];
  onUpdateItem: (index: number, updates: Partial<SelectedItemWithQty>) => void;
  onRemoveItem: (index: number) => void;
  onRemoveMultiple: (indices: number[]) => void;
  showPrice?: boolean;
  showBatch?: boolean;
  showExpiry?: boolean;
  emptyMessage?: string;
  className?: string;
  scrollAreaClassName?: string;
}

export function SelectedItemsTable({
  items,
  onUpdateItem,
  onRemoveItem,
  onRemoveMultiple,
  showPrice = false,
  showBatch = false,
  showExpiry = false,
  emptyMessage = "Belum ada item ditambahkan",
  className,
  scrollAreaClassName,
}: SelectedItemsTableProps) {
  void onRemoveMultiple;

  const totals = calculateCommercialTotals(items.map((item) => syncPurchaseItemCommercials(item)));
  const formatCurrency = (value: number) => `Rp ${value.toLocaleString("id-ID")}`;
  const useCommercialLayout = showPrice || showBatch || showExpiry;

  const getMaxQuantity = (item: SelectedItemWithQty) => {
    if (typeof item.current_stock === "number" && item.current_stock > 0) {
      return item.current_stock;
    }

    return 1;
  };

  if (items.length === 0) {
    return (
      <div className="text-center py-12 border rounded-md text-muted-foreground">
        <Package className="h-10 w-10 mx-auto mb-2 opacity-50" />
        <p className="text-sm">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className={cn("space-y-2", className)}>
      <div className={cn("min-h-0 overflow-hidden rounded-lg border border-border/80 bg-background", scrollAreaClassName)}>
        <ScrollArea className="h-full">
          <table className="w-full table-fixed border-collapse text-sm">
            <thead className="sticky top-0 z-10 bg-background">
              <tr className="bg-muted/20">
                <th className={cn("h-9 border-b border-r border-border/70 px-3 text-left text-[10px] font-semibold uppercase tracking-[0.18em] text-foreground/80", useCommercialLayout ? "w-[26%]" : "w-[38%]")}>Item</th>
                <th className={cn("h-9 border-b border-r border-border/70 px-3 text-left text-[10px] font-semibold uppercase tracking-[0.18em] text-foreground/80", useCommercialLayout ? "w-[28%]" : "w-[48%]")}>Pembelian</th>
                {useCommercialLayout ? (
                  <>
                    <th className="h-9 w-[26%] border-b border-r border-border/70 px-3 text-left text-[10px] font-semibold uppercase tracking-[0.18em] text-foreground/80">Komersial</th>
                    <th className="h-9 w-[14%] border-b border-r border-border/70 px-3 text-left text-[10px] font-semibold uppercase tracking-[0.18em] text-foreground/80">Total</th>
                  </>
                ) : null}
                <th className={cn("h-9 border-b border-border/70 px-2 text-center text-[10px] font-semibold uppercase tracking-[0.18em] text-foreground/80", useCommercialLayout ? "w-[6%]" : "w-[14%]")}>Aksi</th>
              </tr>
            </thead>
            <tbody>
            {items.map((item, index) => {
              const normalizedItem = syncPurchaseItemCommercials(item);
              const maxQuantity = getMaxQuantity(item);
              const stockAvailable = typeof item.current_stock === "number";
              const remainingStock = stockAvailable ? Math.max(item.current_stock! - normalizedItem.quantity, 0) : null;
              return (
                <tr key={`${item.type}_${item.id}_${index}`} className="align-top transition-colors hover:bg-muted/10">
                  <td className="border-b border-r border-border/60 px-3 py-2.5 align-top">
                    <div className="flex items-start gap-2.5">
                      <div
                        className={cn(
                          "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border",
                          item.type === "medicine"
                            ? "border-blue-200 bg-blue-50"
                            : "border-emerald-200 bg-emerald-50"
                        )}
                      >
                        {item.type === "medicine" ? (
                          <Pill className="h-3.5 w-3.5 text-blue-600" />
                        ) : (
                          <Package className="h-3.5 w-3.5 text-emerald-600" />
                        )}
                      </div>
                      <div className="min-w-0 space-y-0.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate text-xs font-semibold leading-4 text-foreground">{item.name}</p>
                          {stockAvailable ? (
                            <span
                              className={cn(
                                "inline-flex items-center border px-1.5 py-0.5 text-[10px] font-medium",
                                item.current_stock! > 0
                                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                  : "border-rose-200 bg-rose-50 text-rose-700"
                              )}
                            >
                              {item.current_stock! > 0 ? `Stok ${item.current_stock}` : "Stok habis"}
                            </span>
                          ) : null}
                        </div>
                        <p className="font-mono text-[11px] leading-4 text-muted-foreground">{item.code}</p>
                        <p className="text-[11px] leading-4 text-muted-foreground">Satuan: {item.unit}</p>
                        {stockAvailable ? (
                          <p className={cn("text-[11px] leading-4", remainingStock === 0 ? "text-amber-700" : "text-muted-foreground")}>
                            {remainingStock === 0
                              ? `Qty sudah mencapai batas stok ${maxQuantity}`
                              : `Sisa stok setelah permintaan: ${remainingStock}`}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  </td>
                  <td className={cn("border-b px-3 py-2.5 align-top", useCommercialLayout ? "border-r border-border/60" : "border-r border-border/60")}>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">Qty</p>
                        <Input
                          type="number"
                          min={1}
                          max={maxQuantity}
                          value={item.quantity}
                          onChange={(e) =>
                            onUpdateItem(
                              index,
                              syncPurchaseItemCommercials({
                                ...normalizedItem,
                                quantity: Math.min(maxQuantity, Math.max(1, parseInt(e.target.value) || 1)),
                              })
                            )
                          }
                          className="h-8 border-border/70 bg-background px-2 text-center text-xs"
                        />
                        {stockAvailable ? (
                          <p className={cn("text-[11px]", normalizedItem.quantity >= maxQuantity ? "text-amber-700" : "text-muted-foreground")}>
                            Maks. {maxQuantity}
                          </p>
                        ) : null}
                      </div>
                      {showPrice ? (
                        <div className="space-y-1">
                          <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">Harga</p>
                          <Input
                            type="number"
                            min={0}
                            value={normalizedItem.unit_price || 0}
                            onChange={(e) =>
                              onUpdateItem(index, syncPurchaseItemCommercials({ ...normalizedItem, unit_price: parseFloat(e.target.value) || 0 }))
                            }
                            className="h-8 border-border/70 bg-background px-2 text-right text-xs"
                          />
                        </div>
                      ) : (
                        <div className="space-y-1">
                          <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">Status</p>
                          <div className="flex h-8 items-center rounded-md border border-border/70 bg-muted/20 px-2 text-[11px] text-muted-foreground">
                            Item aktif
                          </div>
                        </div>
                      )}
                      {showBatch && (
                        <div className="space-y-1">
                          <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">Batch</p>
                          <Input
                            placeholder="Nomor batch"
                            value={(item as any).batch_number || ""}
                            onChange={(e) =>
                              onUpdateItem(index, { batch_number: e.target.value } as any)
                            }
                            className="h-8 border-border/70 bg-background px-2 text-xs"
                          />
                        </div>
                      )}
                      {showExpiry && (
                        <div className="space-y-1">
                          <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">Exp.</p>
                          <Input
                            type="date"
                            value={(item as any).expiry_date || ""}
                            onChange={(e) =>
                              onUpdateItem(index, { expiry_date: e.target.value } as any)
                            }
                            className="h-8 border-border/70 bg-background px-2 text-xs"
                          />
                        </div>
                      )}
                    </div>
                  </td>
                  {useCommercialLayout ? (
                    <>
                      <td className="border-b border-r border-border/60 px-3 py-2.5 align-top">
                        {showPrice ? (
                          <div className="grid grid-cols-2 gap-2">
                            <div className="space-y-1">
                              <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">Disc %</p>
                              <Input
                                type="number"
                                min={0}
                                value={normalizedItem.discount_percent || 0}
                                onChange={(e) => onUpdateItem(index, setDiscountPercent(normalizedItem, parseFloat(e.target.value) || 0))}
                                className="h-8 border-border/70 bg-background px-2 text-right text-xs"
                              />
                            </div>
                            <div className="space-y-1">
                              <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">Disc Rp</p>
                              <Input
                                type="number"
                                min={0}
                                value={normalizedItem.discount_amount || 0}
                                onChange={(e) => onUpdateItem(index, setDiscountAmount(normalizedItem, parseFloat(e.target.value) || 0))}
                                className="h-8 border-border/70 bg-background px-2 text-right text-xs"
                              />
                            </div>
                            <div className="space-y-1">
                              <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">PPN %</p>
                              <Input
                                type="number"
                                min={0}
                                value={normalizedItem.tax_percent || 0}
                                onChange={(e) => onUpdateItem(index, setTaxPercent(normalizedItem, parseFloat(e.target.value) || 0))}
                                className="h-8 border-border/70 bg-background px-2 text-right text-xs"
                              />
                            </div>
                            <div className="space-y-1">
                              <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">PPN Rp</p>
                              <Input
                                type="number"
                                min={0}
                                value={normalizedItem.tax_amount || 0}
                                onChange={(e) => onUpdateItem(index, setTaxAmount(normalizedItem, parseFloat(e.target.value) || 0))}
                                className="h-8 border-border/70 bg-background px-2 text-right text-xs"
                              />
                            </div>
                          </div>
                        ) : (
                          <div className="flex h-full min-h-[72px] items-center rounded-md border border-dashed border-border/70 px-3 text-[11px] text-muted-foreground">
                            Detail harga tidak digunakan.
                          </div>
                        )}
                      </td>
                      <td className="border-b border-r border-border/60 px-3 py-2.5 align-top">
                        <div className="space-y-1 rounded-md bg-muted/15 px-2.5 py-2">
                          <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">Total Baris</p>
                          <p className="text-sm font-semibold leading-5 text-foreground">
                            {formatCurrency(calculateLineTotal(normalizedItem))}
                          </p>
                          {showPrice && (
                            <div className="space-y-0.5 text-[11px] leading-4 text-muted-foreground">
                              <p>Harga: {formatCurrency(normalizedItem.unit_price || 0)}</p>
                              <p>Disc: {formatCurrency(normalizedItem.discount_amount || 0)}</p>
                              <p>PPN: {formatCurrency(normalizedItem.tax_amount || 0)}</p>
                            </div>
                          )}
                        </div>
                      </td>
                    </>
                  ) : null}
                  <td className="border-b border-border/60 px-2 py-2.5 align-top">
                    <div className="flex justify-center">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 rounded-md border border-transparent hover:border-destructive/20 hover:bg-destructive/5"
                        onClick={() => onRemoveItem(index)}
                      >
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
            </tbody>
          </table>
        </ScrollArea>
      </div>

      <div className="flex items-center justify-between rounded-md border border-border/70 bg-muted/15 px-3 py-2">
        <div className="text-xs text-muted-foreground">
          Total: <span className="font-medium text-foreground">{items.length} jenis</span> ({totals.totalQuantity} item)
        </div>
        {useCommercialLayout && showPrice && (
          <div className="grid gap-0.5 text-right text-[11px]">
            <p className="text-muted-foreground">Jumlah: <span className="font-medium text-foreground">{formatCurrency(totals.subtotal)}</span></p>
            <p className="text-muted-foreground">Diskon: <span className="font-medium text-rose-600">{formatCurrency(totals.discount)}</span></p>
            <p className="text-muted-foreground">PPN: <span className="font-medium text-sky-700">{formatCurrency(totals.tax)}</span></p>
            <p className="text-xs font-bold text-primary">
              Total: {formatCurrency(totals.grandTotal)}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
