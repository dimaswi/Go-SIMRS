import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Trash2, Package, Pill, Calendar } from "lucide-react";
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

  const useCommercialLayout = showPrice || showBatch || showExpiry;
  const useCompactPurchaseHeader = compactMode && useCommercialLayout;
  const formatCurrency = (value: number) => `Rp ${value.toLocaleString("id-ID")}`;
  const getConversionFactor = (item: SelectedItemWithQty) => Math.max(1, Number(item.conversion_factor || item.large_to_small_factor || 1));

  // Auto-apply 11% PPN if all items currently have 0% or undefined tax in commercial purchase mode
  const hasAutoInitializedTaxRef = useRef(false);
  useEffect(() => {
    if (!useCommercialLayout || items.length === 0) return;
    if (!hasAutoInitializedTaxRef.current) {
      const allZeroOrUndefined = items.every((it) => it.tax_percent === undefined || it.tax_percent === 0);
      if (allZeroOrUndefined) {
        items.forEach((it, idx) => {
          onUpdateItem(idx, setTaxPercent(it, 11));
        });
      }
      hasAutoInitializedTaxRef.current = true;
    }
  }, [items, useCommercialLayout, onUpdateItem]);

  const totals = calculateCommercialTotals(
    items.map((item) =>
      syncPurchaseItemCommercials({
        ...item,
        tax_percent: item.tax_percent !== undefined ? item.tax_percent : 11,
      })
    )
  );

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
      <div className={cn("min-h-0 overflow-hidden rounded-lg border border-border/80 bg-background flex flex-col", scrollAreaClassName)}>
        <div className="flex-1 overflow-auto">
          {useCompactPurchaseHeader ? (
            <table className="min-w-[1650px] w-full table-fixed border-collapse text-sm">
              <thead className="sticky top-0 z-10 bg-background">
                <tr className="bg-muted/20">
                  <th rowSpan={2} className="h-9 w-[17%] min-w-[240px] border-b border-r border-border/70 px-3 text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-foreground/80">Item</th>
                  <th colSpan={3} className="h-9 border-b border-r border-border/70 px-2 text-center text-[11px] font-semibold uppercase tracking-[0.18em] text-foreground/80">QTY</th>
                  <th colSpan={3} className="h-9 border-b border-r border-border/70 px-2 text-center text-[11px] font-semibold uppercase tracking-[0.18em] text-foreground/80">Harga Satuan</th>
                  {showBatch ? (
                    <th rowSpan={2} className="h-9 w-[9.5%] min-w-[140px] border-b border-r border-border/70 px-2 text-center text-[11px] font-semibold uppercase tracking-[0.18em] text-foreground/80">No. Batch</th>
                  ) : null}
                  {showExpiry ? (
                    <th rowSpan={2} className="h-9 w-[10.5%] min-w-[155px] border-b border-r border-border/70 px-2 text-center text-[11px] font-semibold uppercase tracking-[0.18em] text-foreground/80">EXD</th>
                  ) : null}
                  <th colSpan={2} className="h-9 border-b border-r border-border/70 px-2 text-center text-[11px] font-semibold uppercase tracking-[0.18em] text-foreground/80">Diskon</th>
                  <th colSpan={2} className="h-9 border-b border-r border-border/70 px-2 text-center text-[11px] font-semibold uppercase tracking-[0.18em] text-foreground/80">PPN</th>
                  <th rowSpan={2} className="h-9 w-[8.5%] min-w-[110px] border-b border-r border-border/70 px-2 text-center text-[11px] font-semibold uppercase tracking-[0.18em] text-foreground/80">Total Harga</th>
                  <th rowSpan={2} className="h-9 w-[4%] min-w-[45px] border-b border-border/70 px-2 text-center text-[11px] font-semibold uppercase tracking-[0.18em] text-foreground/80">Aksi</th>
                </tr>
                <tr className="bg-muted/10">
                  <th className="h-8 w-[3.5%] min-w-[55px] border-b border-r border-border/70 px-2 text-center text-[11px] font-medium text-foreground/80">Besar</th>
                  <th className="h-8 w-[3.5%] min-w-[55px] border-b border-r border-border/70 px-2 text-center text-[11px] font-medium text-foreground/80">Isi</th>
                  <th className="h-8 w-[4.5%] min-w-[65px] border-b border-r border-border/70 px-2 text-center text-[11px] font-medium text-foreground/80">Jumlah</th>
                  <th className="h-8 w-[5.5%] min-w-[85px] border-b border-r border-border/70 px-2 text-center text-[11px] font-medium text-foreground/80">Besar</th>
                  <th className="h-8 w-[5.5%] min-w-[85px] border-b border-r border-border/70 px-2 text-center text-[11px] font-medium text-foreground/80">Kecil</th>
                  <th className="h-8 w-[6.5%] min-w-[95px] border-b border-r border-border/70 px-2 text-center text-[11px] font-medium text-foreground/80">Subtotal</th>
                  <th className="h-8 w-[4%] min-w-[60px] border-b border-r border-border/70 px-2 text-center text-[11px] font-medium text-foreground/80">Persen (%)</th>
                  <th className="h-8 w-[6%] min-w-[85px] border-b border-r border-border/70 px-2 text-center text-[11px] font-medium text-foreground/80">Rupiah (Rp.)</th>
                  <th className="h-8 w-[5.5%] min-w-[80px] border-b border-r border-border/70 px-2 text-center text-[11px] font-medium text-foreground/80">Persen (%)</th>
                  <th className="h-8 w-[6%] min-w-[85px] border-b border-r border-border/70 px-2 text-center text-[11px] font-medium text-foreground/80">Rupiah (Rp.)</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, index) => {
                  const baseNormalizedItem = syncPurchaseItemCommercials(item);
                  const rawUnitLarge = (item.unit_large || "").trim();
                  const factor = getConversionFactor(item);
                  const hasDualUnit = enableDualUnit && (item.type === "medicine" || factor > 1 || !!rawUnitLarge);
                  const stockAvailable = showStock && typeof item.current_stock === "number";

                  let quantityLarge = Math.max(0, Number(item.quantity_large ?? (baseNormalizedItem.quantity && factor > 0 ? Math.round((baseNormalizedItem.quantity / factor) * 100) / 100 : 1)));
                  const resolvedQty = hasDualUnit
                    ? Math.max(0, Math.round(quantityLarge * factor))
                    : Math.max(1, Number(baseNormalizedItem.quantity || 0));

                  const normalizedItem = syncPurchaseItemCommercials({
                    ...baseNormalizedItem,
                    quantity: resolvedQty,
                    quantity_large: hasDualUnit ? quantityLarge : resolvedQty,
                    quantity_small: 0,
                    conversion_factor: factor,
                    unit_small: item.unit_small || item.unit,
                  });

                  const priceSmall = Math.max(0, Number(normalizedItem.unit_price || 0));
                  const priceLarge = hasDualUnit ? priceSmall * factor : priceSmall;
                  const priceTotal = priceSmall * normalizedItem.quantity;

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
                          <div className="min-w-0 space-y-0.5 flex-1">
                            <p className="truncate text-xs font-semibold leading-4 text-foreground">{item.name}</p>
                            <div className="flex flex-wrap items-center gap-1.5 pt-0.5 text-[11px]">
                              
                              <span className="text-muted-foreground font-medium">{item.unit}</span>
                              {stockAvailable ? (
                                <>
                                  <span className="text-muted-foreground">•</span>
                                  <span className={cn(item.current_stock! > 0 ? "text-emerald-700 font-medium" : "text-rose-700 font-medium")}>
                                    stok {item.current_stock}
                                  </span>
                                </>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* QTY Besar */}
                      <td className="border-b border-r border-border/60 px-1.5 py-1.5">
                        <Input
                          type="number"
                          min={0}
                          value={hasDualUnit ? quantityLarge : normalizedItem.quantity}
                          onChange={(e) => {
                            const rawLarge = Math.max(0, parseFloat(e.target.value) || 0);
                            const nextQty = hasDualUnit ? Math.round(rawLarge * factor) : rawLarge;
                            onUpdateItem(index, syncPurchaseItemCommercials({
                              ...normalizedItem,
                              quantity_large: rawLarge,
                              quantity_small: 0,
                              quantity: Math.max(0, nextQty),
                            }));
                          }}
                          className="h-8 border-border/70 bg-background px-2 text-right text-xs font-medium"
                          title="Jumlah satuan besar (misal: Box)"
                        />
                      </td>

                      {/* QTY Isi (Faktor Konversi) */}
                      <td className="border-b border-r border-border/60 px-1.5 py-1.5">
                        <Input
                          type="number"
                          min={1}
                          value={factor}
                          disabled={!hasDualUnit}
                          onChange={(e) => {
                            const nextFactor = Math.max(1, parseInt(e.target.value) || 1);
                            const nextQty = Math.round(quantityLarge * nextFactor);
                            onUpdateItem(index, syncPurchaseItemCommercials({
                              ...normalizedItem,
                              conversion_factor: nextFactor,
                              large_to_small_factor: nextFactor,
                              quantity: Math.max(0, nextQty),
                            }));
                          }}
                          className="h-8 border-border/70 bg-background px-2 text-right text-xs font-medium disabled:opacity-60"
                          title="Isi satuan kecil per satuan besar (misal: 1 Box = 20 Tablet)"
                        />
                      </td>

                      {/* QTY Jumlah (Total Satuan Kecil = Besar x Isi) */}
                      <td className="border-b border-r border-border/60 px-1.5 py-1.5">
                        <Input
                          type="number"
                          min={0}
                          value={normalizedItem.quantity}
                          onChange={(e) => {
                            const rawQty = Math.max(0, parseInt(e.target.value) || 0);
                            const nextLarge = factor > 0 ? Math.round((rawQty / factor) * 100) / 100 : rawQty;
                            onUpdateItem(index, syncPurchaseItemCommercials({
                              ...normalizedItem,
                              quantity_large: nextLarge,
                              quantity_small: 0,
                              quantity: rawQty,
                            }));
                          }}
                          className="h-8 border-border/70 bg-muted/20 px-2 text-right text-xs font-bold text-foreground"
                          title="Total jumlah dalam satuan kecil (Besar x Isi)"
                        />
                      </td>

                      {/* Harga Satuan Besar */}
                      <td className="border-b border-r border-border/60 px-1.5 py-1.5">
                        <Input
                          type="number"
                          min={0}
                          value={Number.isFinite(priceLarge) ? Math.round(priceLarge) : 0}
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

                      {/* Harga Satuan Kecil */}
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

                      {/* Subtotal Bruto */}
                      <td className="border-b border-r border-border/60 px-1.5 py-1.5">
                        <Input
                          type="number"
                          value={Number.isFinite(priceTotal) ? Math.round(priceTotal) : 0}
                          readOnly
                          className="h-8 border-border/70 bg-muted/20 px-2 text-right text-xs font-medium text-foreground"
                        />
                      </td>

                      {showBatch ? (
                        <td className="border-b border-r border-border/60 px-2 py-1.5 min-w-[140px]">
                          <Input
                            placeholder="No. Batch"
                            value={(item as any).batch_number || ""}
                            onChange={(e) => onUpdateItem(index, { batch_number: e.target.value } as any)}
                            className="h-8 border-border/70 bg-background px-2.5 text-xs font-mono"
                          />
                        </td>
                      ) : null}

                      {showExpiry ? (
                        <td className="border-b border-r border-border/60 px-2 py-1.5 min-w-[155px]">
                          <div className="relative flex items-center w-full">
                            <Input
                              type="date"
                              id={`expiry_date_${index}`}
                              value={(item as any).expiry_date || ""}
                              onChange={(e) => onUpdateItem(index, { expiry_date: e.target.value } as any)}
                              className="h-8 w-full border-border/70 bg-background pl-2 pr-8 text-xs font-mono [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:right-0 [&::-webkit-calendar-picker-indicator]:w-8 [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:z-10"
                            />
                            <button
                              type="button"
                              tabIndex={-1}
                              onClick={(e) => {
                                e.preventDefault();
                                const el = document.getElementById(`expiry_date_${index}`) as HTMLInputElement;
                                if (el) {
                                  if (typeof el.showPicker === "function") {
                                    try {
                                      el.showPicker();
                                    } catch {
                                      el.focus();
                                    }
                                  } else {
                                    el.focus();
                                  }
                                }
                              }}
                              className="absolute right-1 flex h-6 w-6 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-muted hover:text-foreground cursor-pointer"
                              title="Pilih tanggal di kalender"
                            >
                              <Calendar className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      ) : null}

                      {/* Diskon % */}
                      <td className="border-b border-r border-border/60 px-1.5 py-1.5">
                        <Input
                          type="number"
                          min={0}
                          max={100}
                          value={normalizedItem.discount_percent || 0}
                          onChange={(e) => onUpdateItem(index, setDiscountPercent(normalizedItem, parseFloat(e.target.value) || 0))}
                          className="h-8 border-border/70 bg-background px-2 text-right text-xs"
                        />
                      </td>

                      {/* Diskon Rp */}
                      <td className="border-b border-r border-border/60 px-1.5 py-1.5">
                        <Input
                          type="number"
                          min={0}
                          value={normalizedItem.discount_amount || 0}
                          onChange={(e) => onUpdateItem(index, setDiscountAmount(normalizedItem, parseFloat(e.target.value) || 0))}
                          className="h-8 border-border/70 bg-background px-2 text-right text-xs"
                        />
                      </td>

                      {/* PPN % */}
                      <td className="border-b border-r border-border/60 px-1.5 py-1.5">
                        <div className="flex items-center gap-1">
                          <Input
                            type="number"
                            min={0}
                            max={100}
                            value={normalizedItem.tax_percent ?? 0}
                            onChange={(e) => onUpdateItem(index, setTaxPercent(normalizedItem, parseFloat(e.target.value) || 0))}
                            className="h-8 border-border/70 bg-background px-1.5 text-right text-xs"
                          />
                          <button
                            type="button"
                            title={normalizedItem.tax_percent === 11 ? "Hapus PPN (0%)" : "Pasang PPN 11%"}
                            onClick={() => onUpdateItem(index, setTaxPercent(normalizedItem, normalizedItem.tax_percent === 11 ? 0 : 11))}
                            className={cn(
                              "h-7 px-1.5 rounded text-[10px] font-bold transition-colors border shrink-0",
                              normalizedItem.tax_percent === 11
                                ? "bg-sky-100 text-sky-800 border-sky-300"
                                : "bg-muted/40 text-muted-foreground border-border/60 hover:bg-muted"
                            )}
                          >
                            11%
                          </button>
                        </div>
                      </td>

                      {/* PPN Rp */}
                      <td className="border-b border-r border-border/60 px-1.5 py-1.5">
                        <Input
                          type="number"
                          min={0}
                          value={normalizedItem.tax_amount || 0}
                          onChange={(e) => onUpdateItem(index, setTaxAmount(normalizedItem, parseFloat(e.target.value) || 0))}
                          className="h-8 border-border/70 bg-background px-1.5 text-right text-xs"
                        />
                      </td>

                      {/* Total Harga */}
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
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4 rounded-md border border-border/70 bg-muted/15 px-3 py-2.5">
        <div className="space-y-1.5 text-xs text-muted-foreground">
          <div>
            Total: <span className="font-semibold text-foreground">{items.length} jenis</span> ({totals.totalQuantity} item)
          </div>
          {useCommercialLayout && showPrice ? (
            <div className="flex flex-wrap items-center gap-2 text-[11px]">
              <span className="font-semibold text-foreground">Tarif PPN Faktur:</span>
              <Button
                type="button"
                size="sm"
                variant={items.length > 0 && items.every((it) => (it.tax_percent ?? 11) === 11) ? "default" : "outline"}
                className={cn(
                  "h-6 px-2.5 text-[10px] font-semibold",
                  items.length > 0 && items.every((it) => (it.tax_percent ?? 11) === 11)
                    ? "bg-sky-600 hover:bg-sky-700 text-white"
                    : "border-sky-300 bg-sky-50 text-sky-800 hover:bg-sky-100"
                )}
                onClick={() => {
                  items.forEach((it, idx) => {
                    onUpdateItem(idx, setTaxPercent(it, 11));
                  });
                }}
              >
                ✓ PPN 11% (Otomatis)
              </Button>
              <Button
                type="button"
                size="sm"
                variant={items.length > 0 && items.every((it) => it.tax_percent === 0) ? "secondary" : "ghost"}
                className="h-6 px-2 text-[10px] text-muted-foreground hover:text-foreground"
                onClick={() => {
                  items.forEach((it, idx) => {
                    onUpdateItem(idx, setTaxPercent(it, 0));
                  });
                }}
              >
                Non-PPN (0%)
              </Button>
            </div>
          ) : null}
        </div>
        {useCommercialLayout && showPrice ? (
          <div className="grid gap-1 min-w-[260px] text-right text-xs">
            <div className="flex justify-between text-muted-foreground">
              <span>Subtotal (DPP Kotor):</span>
              <span className="font-medium text-foreground">{formatCurrency(totals.subtotal)}</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>Total Diskon:</span>
              <span className="font-medium text-rose-600">- {formatCurrency(totals.discount)}</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>DPP Netto:</span>
              <span className="font-medium text-foreground">{formatCurrency(Math.max(0, totals.subtotal - totals.discount))}</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>PPN (11%):</span>
              <span className="font-medium text-sky-700">+ {formatCurrency(totals.tax)}</span>
            </div>
            <div className="flex justify-between border-t border-border/70 pt-1 text-sm font-bold text-primary">
              <span>Grand Total:</span>
              <span>{formatCurrency(totals.grandTotal)}</span>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
