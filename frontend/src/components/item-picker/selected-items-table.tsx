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
  showStock?: boolean;
  enforceStockLimit?: boolean;
  enableDualUnit?: boolean;
  compactMode?: boolean;
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
  showStock = true,
  enforceStockLimit = true,
  enableDualUnit = false,
  compactMode = false,
}: SelectedItemsTableProps) {
  void onRemoveMultiple;

  const totals = calculateCommercialTotals(items.map((item) => syncPurchaseItemCommercials(item)));
  const formatCurrency = (value: number) => `Rp ${value.toLocaleString("id-ID")}`;
  const useCommercialLayout = showPrice || showBatch || showExpiry;
  const useCompactPurchaseHeader = compactMode && useCommercialLayout;

  const getConversionFactor = (item: SelectedItemWithQty) => Math.max(1, Number(item.conversion_factor || item.large_to_small_factor || 1));

  const getMaxQuantity = (item: SelectedItemWithQty) => {
    if (!enforceStockLimit) return Number.MAX_SAFE_INTEGER;
    if (typeof item.current_stock === "number" && item.current_stock > 0) return item.current_stock;
    return 1;
  };

  if (items.length === 0) {
    return (
      <div className="rounded-md border py-12 text-center text-muted-foreground">
        <Package className="mx-auto mb-2 h-10 w-10 opacity-50" />
        <p className="text-sm">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className={cn("space-y-2", className)}>
      <div className={cn("min-h-0 overflow-hidden rounded-lg border border-border/80 bg-background", scrollAreaClassName)}>
        <ScrollArea className="h-full">
          {useCompactPurchaseHeader ? (
            <table className="min-w-[1450px] w-full table-fixed border-collapse text-sm">
              <thead className="sticky top-0 z-10 bg-background">
                <tr className="bg-muted/20">
                  <th rowSpan={2} className="h-9 w-[24%] border-b border-r border-border/70 px-3 text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-foreground/80">Item</th>
                  {showBatch ? (
                    <th rowSpan={2} className="h-9 w-[10%] border-b border-r border-border/70 px-2 text-center text-[11px] font-semibold uppercase tracking-[0.18em] text-foreground/80">No.Batch</th>
                  ) : null}
                  <th colSpan={3} className="h-9 border-b border-r border-border/70 px-2 text-center text-[11px] font-semibold uppercase tracking-[0.18em] text-foreground/80">QTY</th>
                  <th colSpan={3} className="h-9 border-b border-r border-border/70 px-2 text-center text-[11px] font-semibold uppercase tracking-[0.18em] text-foreground/80">Harga Satuan</th>
                  {showExpiry ? (
                    <th rowSpan={2} className="h-9 w-[9%] border-b border-r border-border/70 px-2 text-center text-[11px] font-semibold uppercase tracking-[0.18em] text-foreground/80">Exd</th>
                  ) : null}
                  <th colSpan={2} className="h-9 border-b border-r border-border/70 px-2 text-center text-[11px] font-semibold uppercase tracking-[0.18em] text-foreground/80">Diskon</th>
                  <th rowSpan={2} className="h-9 w-[9%] border-b border-r border-border/70 px-2 text-center text-[11px] font-semibold uppercase tracking-[0.18em] text-foreground/80">Total Harga</th>
                  <th rowSpan={2} className="h-9 w-[4.5%] border-b border-border/70 px-2 text-center text-[11px] font-semibold uppercase tracking-[0.18em] text-foreground/80">Aksi</th>
                </tr>
                <tr className="bg-muted/10">
                  <th className="h-8 w-[5%] border-b border-r border-border/70 px-2 text-center text-[11px] font-medium text-foreground/80">Besar</th>
                  <th className="h-8 w-[5%] border-b border-r border-border/70 px-2 text-center text-[11px] font-medium text-foreground/80">Kecil</th>
                  <th className="h-8 w-[5%] border-b border-r border-border/70 px-2 text-center text-[11px] font-medium text-foreground/80">Jumlah</th>
                  <th className="h-8 w-[6.5%] border-b border-r border-border/70 px-2 text-center text-[11px] font-medium text-foreground/80">Besar</th>
                  <th className="h-8 w-[6.5%] border-b border-r border-border/70 px-2 text-center text-[11px] font-medium text-foreground/80">Kecil</th>
                  <th className="h-8 w-[6.5%] border-b border-r border-border/70 px-2 text-center text-[11px] font-medium text-foreground/80">Jumlah</th>
                  <th className="h-8 w-[6.5%] border-b border-r border-border/70 px-2 text-center text-[11px] font-medium text-foreground/80">Persen (%)</th>
                  <th className="h-8 w-[7.5%] border-b border-r border-border/70 px-2 text-center text-[11px] font-medium text-foreground/80">Rupiah (Rp.)</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, index) => {
                  const baseNormalizedItem = syncPurchaseItemCommercials(item);
                  const factor = getConversionFactor(item);
                  const hasDualUnit = enableDualUnit && item.type === "medicine" && !!item.unit_large && factor > 1;
                  const maxQuantity = getMaxQuantity(item);
                  const stockAvailable = showStock && typeof item.current_stock === "number";

                  let quantityLarge = Math.max(0, Number(item.quantity_large || 0));
                  let quantitySmall = Math.max(0, Number(item.quantity_small || 0));
                  if (hasDualUnit && quantityLarge === 0 && quantitySmall === 0 && (baseNormalizedItem.quantity || 0) > 0) {
                    quantityLarge = Math.floor((baseNormalizedItem.quantity || 0) / factor);
                    quantitySmall = (baseNormalizedItem.quantity || 0) % factor;
                  }

                  const resolvedQty = hasDualUnit
                    ? (quantityLarge * factor) + quantitySmall
                    : Math.max(1, Number(baseNormalizedItem.quantity || 0));

                  const normalizedItem = syncPurchaseItemCommercials({
                    ...baseNormalizedItem,
                    quantity: resolvedQty,
                    quantity_large: hasDualUnit ? quantityLarge : resolvedQty,
                    quantity_small: hasDualUnit ? quantitySmall : 0,
                    conversion_factor: factor,
                    unit_small: item.unit_small || item.unit,
                  });

                  const priceSmall = Math.max(0, Number(normalizedItem.unit_price || 0));
                  const priceLarge = hasDualUnit ? priceSmall * factor : priceSmall;
                  const priceTotal = priceSmall * normalizedItem.quantity;
                  const qtyLargeUnit = hasDualUnit ? (item.unit_large || "besar") : item.unit;
                  const qtySmallUnit = item.unit_small || item.unit;

                  return (
                    <tr key={`${item.type}_${item.id}_${index}`} className="align-middle transition-colors hover:bg-muted/10">
                      <td className="border-b border-r border-border/60 px-3 py-1.5">
                        <div className="flex items-start gap-2">
                          <div
                            className={cn(
                              "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border",
                              item.type === "medicine"
                                ? "border-blue-200 bg-blue-50"
                                : "border-emerald-200 bg-emerald-50"
                            )}
                          >
                            {item.type === "medicine" ? (
                              <Pill className="h-3 w-3 text-blue-600" />
                            ) : (
                              <Package className="h-3 w-3 text-emerald-600" />
                            )}
                          </div>
                          <div className="min-w-0 space-y-0.5">
                            <p className="truncate text-xs font-semibold leading-4 text-foreground">{item.name}</p>
                            <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                              <span className="font-mono">{item.code}</span>
                              <span>|</span>
                              <span>{qtyLargeUnit}</span>
                              <span>/</span>
                              <span>{qtySmallUnit}</span>
                              {stockAvailable ? (
                                <>
                                  <span>|</span>
                                  <span className={cn(item.current_stock! > 0 ? "text-emerald-700" : "text-rose-700")}>
                                    stok {item.current_stock}
                                  </span>
                                </>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      </td>

                      {showBatch ? (
                        <td className="border-b border-r border-border/60 px-2 py-1.5">
                          <Input
                            placeholder="-"
                            value={(item as any).batch_number || ""}
                            onChange={(e) => onUpdateItem(index, { batch_number: e.target.value } as any)}
                            className="h-8 border-border/70 bg-background px-2 text-xs"
                          />
                        </td>
                      ) : null}

                      <td className="border-b border-r border-border/60 px-1.5 py-1.5">
                        <Input
                          type="number"
                          min={0}
                          value={hasDualUnit ? quantityLarge : normalizedItem.quantity}
                          onChange={(e) => {
                            const rawLarge = Math.max(0, parseInt(e.target.value) || 0);
                            if (hasDualUnit) {
                              const nextLarge = enforceStockLimit ? Math.min(Math.floor(maxQuantity / factor), rawLarge) : rawLarge;
                              let nextQty = (nextLarge * factor) + quantitySmall;
                              if (enforceStockLimit) nextQty = Math.min(maxQuantity, nextQty);
                              onUpdateItem(index, syncPurchaseItemCommercials({
                                ...normalizedItem,
                                quantity_large: nextLarge,
                                quantity_small: enforceStockLimit ? Math.max(0, nextQty - (nextLarge * factor)) : quantitySmall,
                                quantity: Math.max(0, nextQty),
                              }));
                              return;
                            }
                            const qty = enforceStockLimit ? Math.min(maxQuantity, Math.max(1, rawLarge || 1)) : Math.max(1, rawLarge || 1);
                            onUpdateItem(index, syncPurchaseItemCommercials({
                              ...normalizedItem,
                              quantity: qty,
                              quantity_large: qty,
                              quantity_small: 0,
                            }));
                          }}
                          className="h-8 border-border/70 bg-background px-2 text-right text-xs"
                        />
                      </td>

                      <td className="border-b border-r border-border/60 px-1.5 py-1.5">
                        <Input
                          type="number"
                          min={0}
                          value={hasDualUnit ? quantitySmall : 0}
                          disabled={!hasDualUnit}
                          onChange={(e) => {
                            if (!hasDualUnit) return;
                            const rawSmall = Math.max(0, parseInt(e.target.value) || 0);
                            const maxSmall = enforceStockLimit
                              ? Math.max(0, maxQuantity - (quantityLarge * factor))
                              : Number.MAX_SAFE_INTEGER;
                            const nextSmall = Math.min(rawSmall, maxSmall);
                            let nextQty = (quantityLarge * factor) + nextSmall;
                            if (enforceStockLimit) nextQty = Math.min(maxQuantity, nextQty);
                            onUpdateItem(index, syncPurchaseItemCommercials({
                              ...normalizedItem,
                              quantity_large: quantityLarge,
                              quantity_small: nextSmall,
                              quantity: Math.max(0, nextQty),
                            }));
                          }}
                          className="h-8 border-border/70 bg-background px-2 text-right text-xs disabled:opacity-60"
                        />
                      </td>

                      <td className="border-b border-r border-border/60 px-1.5 py-1.5">
                        <Input
                          type="number"
                          value={normalizedItem.quantity}
                          readOnly
                          className="h-8 border-border/70 bg-muted/10 px-2 text-right text-xs"
                        />
                      </td>

                      <td className="border-b border-r border-border/60 px-1.5 py-1.5">
                        <Input
                          type="number"
                          min={0}
                          value={Number.isFinite(priceLarge) ? priceLarge : 0}
                          onChange={(e) => {
                            const raw = Math.max(0, Number(e.target.value) || 0);
                            const nextSmall = hasDualUnit ? raw / factor : raw;
                            onUpdateItem(index, syncPurchaseItemCommercials({
                              ...normalizedItem,
                              unit_price: nextSmall,
                            }));
                          }}
                          className="h-8 border-border/70 bg-background px-2 text-right text-xs"
                        />
                      </td>

                      <td className="border-b border-r border-border/60 px-1.5 py-1.5">
                        <Input
                          type="number"
                          min={0}
                          value={priceSmall}
                          onChange={(e) => {
                            const raw = Math.max(0, Number(e.target.value) || 0);
                            onUpdateItem(index, syncPurchaseItemCommercials({
                              ...normalizedItem,
                              unit_price: raw,
                            }));
                          }}
                          className="h-8 border-border/70 bg-background px-2 text-right text-xs"
                        />
                      </td>

                      <td className="border-b border-r border-border/60 px-1.5 py-1.5">
                        <Input
                          type="number"
                          value={Number.isFinite(priceTotal) ? priceTotal : 0}
                          readOnly
                          className="h-8 border-border/70 bg-muted/10 px-2 text-right text-xs"
                        />
                      </td>

                      {showExpiry ? (
                        <td className="border-b border-r border-border/60 px-2 py-1.5">
                          <Input
                            type="date"
                            value={(item as any).expiry_date || ""}
                            onChange={(e) => onUpdateItem(index, { expiry_date: e.target.value } as any)}
                            className="h-8 border-border/70 bg-background px-2 text-xs"
                          />
                        </td>
                      ) : null}

                      <td className="border-b border-r border-border/60 px-1.5 py-1.5">
                        <Input
                          type="number"
                          min={0}
                          value={normalizedItem.discount_percent || 0}
                          onChange={(e) => onUpdateItem(index, setDiscountPercent(normalizedItem, parseFloat(e.target.value) || 0))}
                          className="h-8 border-border/70 bg-background px-2 text-right text-xs"
                        />
                      </td>

                      <td className="border-b border-r border-border/60 px-1.5 py-1.5">
                        <Input
                          type="number"
                          min={0}
                          value={normalizedItem.discount_amount || 0}
                          onChange={(e) => onUpdateItem(index, setDiscountAmount(normalizedItem, parseFloat(e.target.value) || 0))}
                          className="h-8 border-border/70 bg-background px-2 text-right text-xs"
                        />
                      </td>

                      <td className="border-b border-r border-border/60 px-2 py-1.5">
                        <div className="rounded-md bg-muted/15 px-2 py-1.5 text-right text-xs font-semibold text-foreground">
                          {formatCurrency(calculateLineTotal(normalizedItem))}
                        </div>
                      </td>

                      <td className="border-b border-border/60 px-2 py-1.5">
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
          ) : (
            <table className="w-full table-fixed border-collapse text-sm">
              <thead className="sticky top-0 z-10 bg-background">
                <tr className="bg-muted/20">
                  <th className="h-9 w-[40%] border-b border-r border-border/70 px-3 text-left text-[10px] font-semibold uppercase tracking-[0.18em] text-foreground/80">Item</th>
                  <th className="h-9 w-[16%] border-b border-r border-border/70 px-2 text-center text-[10px] font-semibold uppercase tracking-[0.18em] text-foreground/80">Qty</th>
                  <th className="h-9 w-[14%] border-b border-r border-border/70 px-2 text-center text-[10px] font-semibold uppercase tracking-[0.18em] text-foreground/80">Satuan</th>
                  {showStock ? (
                    <th className="h-9 w-[16%] border-b border-r border-border/70 px-2 text-center text-[10px] font-semibold uppercase tracking-[0.18em] text-foreground/80">Stok</th>
                  ) : null}
                  <th className={cn("h-9 border-b border-border/70 px-2 text-center text-[10px] font-semibold uppercase tracking-[0.18em] text-foreground/80", showStock ? "w-[14%]" : "w-[22%]")}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, index) => {
                  const normalizedItem = syncPurchaseItemCommercials(item);
                  const maxQuantity = getMaxQuantity(item);
                  const stockAvailable = showStock && typeof item.current_stock === "number";
                  return (
                    <tr key={`${item.type}_${item.id}_${index}`} className="transition-colors hover:bg-muted/10">
                      <td className="border-b border-r border-border/60 px-3 py-1.5 align-middle">
                        <div className="flex items-center gap-2">
                          {item.type === "medicine" ? (
                            <Pill className="h-3.5 w-3.5 text-blue-600" />
                          ) : (
                            <Package className="h-3.5 w-3.5 text-emerald-600" />
                          )}
                          <div className="min-w-0">
                            <p className="truncate text-xs font-semibold text-foreground">{item.name}</p>
                            <p className="font-mono text-[11px] text-muted-foreground">{item.code}</p>
                          </div>
                        </div>
                      </td>
                      <td className="border-b border-r border-border/60 px-2 py-1.5 align-middle">
                        <Input
                          type="number"
                          min={1}
                          max={enforceStockLimit ? maxQuantity : undefined}
                          value={normalizedItem.quantity}
                          onChange={(e) =>
                            onUpdateItem(
                              index,
                              syncPurchaseItemCommercials({
                                ...normalizedItem,
                                quantity: enforceStockLimit
                                  ? Math.min(maxQuantity, Math.max(1, parseInt(e.target.value) || 1))
                                  : Math.max(1, parseInt(e.target.value) || 1),
                              })
                            )
                          }
                          className="h-8 border-border/70 bg-background px-2 text-center text-xs"
                        />
                      </td>
                      <td className="border-b border-r border-border/60 px-2 py-1.5 align-middle text-center text-[11px] text-muted-foreground">
                        {item.unit}
                      </td>
                      {showStock ? (
                        <td className="border-b border-r border-border/60 px-2 py-1.5 align-middle text-center text-[11px]">
                          <span className={cn(stockAvailable && normalizedItem.quantity >= maxQuantity ? "text-amber-700" : "text-muted-foreground")}>
                            {stockAvailable ? `Maks. ${maxQuantity}` : "-"}
                          </span>
                        </td>
                      ) : null}
                      <td className="border-b border-border/60 px-2 py-1.5 align-middle">
                        <div className="flex justify-center">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onRemoveItem(index)}>
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </ScrollArea>
      </div>

      <div className="flex items-center justify-between rounded-md border border-border/70 bg-muted/15 px-3 py-2">
        <div className="text-xs text-muted-foreground">
          Total: <span className="font-medium text-foreground">{items.length} jenis</span> ({totals.totalQuantity} item)
        </div>
        {useCommercialLayout && showPrice ? (
          <div className="grid gap-0.5 text-right text-[11px]">
            <p className="text-muted-foreground">Jumlah: <span className="font-medium text-foreground">{formatCurrency(totals.subtotal)}</span></p>
            <p className="text-muted-foreground">Diskon: <span className="font-medium text-rose-600">{formatCurrency(totals.discount)}</span></p>
            <p className="text-muted-foreground">PPN: <span className="font-medium text-sky-700">{formatCurrency(totals.tax)}</span></p>
            <p className="text-xs font-bold text-primary">Total: {formatCurrency(totals.grandTotal)}</p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
