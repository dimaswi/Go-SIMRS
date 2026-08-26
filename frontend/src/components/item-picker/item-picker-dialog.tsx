import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Search, Loader2, Package, Pill, Check, X, Sparkles, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useDebounce } from "@/hooks/use-debounce";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  calculateCommercialTotals,
  calculateLineTotal,
  setDiscountAmount,
  setDiscountPercent,
  setTaxAmount,
  setTaxPercent,
  syncPurchaseItemCommercials,
} from "./purchase-item-commercials";
import type { FetchItemsParams, FetchItemsResult, PaginationMeta } from "./fetch-purchase-items";

export interface SelectableItem {
  id: number;
  code: string;
  name: string;
  unit: string;
  unit_large?: string;
  large_to_small_factor?: number;
  type: "inventory" | "medicine";
  category?: string;
  current_stock?: number;
  price?: number;
  is_active?: boolean;
}

export interface SelectedItemWithQty extends SelectableItem {
  quantity: number;
  quantity_large?: number;
  quantity_small?: number;
  unit_small?: string;
  conversion_factor?: number;
  unit_price?: number;
  discount_percent?: number;
  discount_amount?: number;
  tax_percent?: number;
  tax_amount?: number;
  batch_number?: string;
  expiry_date?: string;
  notes?: string;
}

interface ItemPickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: string;
  selectedItems: SelectedItemWithQty[];
  onConfirm: (items: SelectedItemWithQty[]) => void;
  showPrice?: boolean;
  showStock?: boolean;
  enforceStockLimit?: boolean;
  defaultTab?: "inventory" | "medicine" | "all";
  showTabs?: boolean;
  enableDualUnit?: boolean;
  loading?: boolean;
  // Client mode: pass items array directly (backward compat)
  items?: SelectableItem[];
  // Server mode: pass fetch callback for paginated server-side search
  fetchItems?: (params: FetchItemsParams) => Promise<FetchItemsResult>;
}

export function ItemPickerDialog({
  open,
  onOpenChange,
  title = "Pilih Item",
  description = "Pilih item yang ingin ditambahkan",
  items,
  loading: externalLoading = false,
  selectedItems: initialSelectedItems,
  onConfirm,
  showPrice = false,
  showStock = true,
  enforceStockLimit = true,
  defaultTab = "all",
  showTabs = true,
  enableDualUnit = false,
  fetchItems,
}: ItemPickerDialogProps) {
  const isServerMode = !!fetchItems;

  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState<string>(defaultTab);
  const [tempSelected, setTempSelected] = useState<Map<string, SelectedItemWithQty>>(new Map());

  // Server mode state
  const [serverItems, setServerItems] = useState<SelectableItem[]>([]);
  const [serverMeta, setServerMeta] = useState<PaginationMeta | null>(null);
  const [serverLoading, setServerLoading] = useState(false);
  const [page, setPage] = useState(1);

  const debouncedSearch = useDebounce(searchTerm, 300);

  // Ref for virtualizer scroll container
  const scrollRef = useRef<HTMLDivElement>(null);

  // Initialize temp selection from initial selected items
  useEffect(() => {
    if (open) {
      const map = new Map<string, SelectedItemWithQty>();
      initialSelectedItems.forEach((item) => {
        const key = `${item.type}_${item.id}`;
        map.set(key, item);
      });
      setTempSelected(map);
      setSearchTerm("");
      setPage(1);
    }
  }, [open, initialSelectedItems]);

  // Server mode: fetch items when search, page, or tab changes
  useEffect(() => {
    if (!isServerMode || !open) return;

    let cancelled = false;
    setServerLoading(true);

    const typeFilter = showTabs && activeTab !== "all" ? (activeTab as "inventory" | "medicine") : undefined;

    fetchItems({
      search: debouncedSearch,
      page,
      limit: 20,
      type: typeFilter,
    })
      .then((result) => {
        if (!cancelled) {
          setServerItems(result.data);
          setServerMeta(result.meta);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          console.error("Failed to fetch items:", err);
          setServerItems([]);
        }
      })
      .finally(() => {
        if (!cancelled) setServerLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isServerMode, open, debouncedSearch, page, activeTab, showTabs, fetchItems]);

  // Reset page when search or tab changes (server mode)
  useEffect(() => {
    if (isServerMode) {
      setPage(1);
    }
  }, [debouncedSearch, activeTab, isServerMode]);

  // Resolved display items (mode-agnostic)
  const displayItems = useMemo(() => {
    if (isServerMode) {
      return serverItems.filter(item => item.is_active !== false);
    }
    // Client-side filtering
    let filtered = (items || []).filter(item => item.is_active !== false);
    if (activeTab !== "all") {
      filtered = filtered.filter((item) => item.type === activeTab);
    }
    if (debouncedSearch) {
      const search = debouncedSearch.toLowerCase();
      filtered = filtered.filter(
        (item) =>
          item.name.toLowerCase().includes(search) ||
          item.code.toLowerCase().includes(search)
      );
    }
    return filtered;
  }, [isServerMode, serverItems, items, activeTab, debouncedSearch]);

  // Tab counts (client mode only â€” server mode shows total from meta)
  const inventoryCount = useMemo(() => {
    if (isServerMode) return null;
    return (items || []).filter((i) => i.type === "inventory").length;
  }, [items, isServerMode]);
  const medicineCount = useMemo(() => {
    if (isServerMode) return null;
    return (items || []).filter((i) => i.type === "medicine").length;
  }, [items, isServerMode]);
  const allCount = useMemo(() => {
    if (isServerMode) return serverMeta?.total ?? null;
    return (items || []).length;
  }, [items, isServerMode, serverMeta]);

  const isLoading = externalLoading || serverLoading;

  // Virtualizer
  const showCommercialFields = showPrice;
  const rowVirtualizer = useVirtualizer({
    count: displayItems.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => (showCommercialFields ? 52 : 44),
    overscan: 8,
  });

  // Fix for virtualizer not rendering initially in animated Dialog
  const [, setForceRender] = useState(0);
  useEffect(() => {
    if (open) {
      // Force a re-render after dialog animation completes
      const timer1 = setTimeout(() => setForceRender(1), 50);
      const timer2 = setTimeout(() => setForceRender(2), 200);
      return () => {
        clearTimeout(timer1);
        clearTimeout(timer2);
      };
    }
  }, [open]);

  const toggleItem = useCallback((item: SelectableItem) => {
    const key = `${item.type}_${item.id}`;
    setTempSelected((prev) => {
      const newMap = new Map(prev);
      if (newMap.has(key)) {
        newMap.delete(key);
      } else {
        newMap.set(key, {
          ...item,
          quantity: 1,
          unit_price: item.price || 0,
          discount_percent: 0,
          discount_amount: 0,
          tax_percent: 0,
          tax_amount: 0,
          batch_number: "",
          expiry_date: "",
          notes: "",
        });
      }
      return newMap;
    });
  }, []);

  const updateSelectedItem = useCallback((item: SelectableItem, updates: Partial<SelectedItemWithQty>) => {
    const key = `${item.type}_${item.id}`;
    setTempSelected((prev) => {
      const existing = prev.get(key);
      if (!existing) return prev;
      const newMap = new Map(prev);
      newMap.set(key, syncPurchaseItemCommercials({ ...existing, ...updates }));
      return newMap;
    });
  }, []);

  const handleConfirm = () => {
    onConfirm(Array.from(tempSelected.values()));
    onOpenChange(false);
  };

  const handleSelectAll = () => {
    const newMap = new Map(tempSelected);
    displayItems.forEach((item) => {
      if (item.is_active === false) return; // Skip inactive items
      const key = `${item.type}_${item.id}`;
      if (!newMap.has(key)) {
        newMap.set(key, {
          ...item,
          quantity: 1,
          unit_price: item.price || 0,
          discount_percent: 0,
          discount_amount: 0,
          tax_percent: 0,
          tax_amount: 0,
          batch_number: "",
          expiry_date: "",
          notes: "",
        });
      }
    });
    setTempSelected(newMap);
  };

  const handleDeselectAll = () => {
    const newMap = new Map(tempSelected);
    displayItems.forEach((item) => {
      const key = `${item.type}_${item.id}`;
      newMap.delete(key);
    });
    setTempSelected(newMap);
    setSearchTerm("");
    setActiveTab(defaultTab);
  };

  const isSelected = (item: SelectableItem) => {
    return tempSelected.has(`${item.type}_${item.id}`);
  };

  const getSelectedQuantity = (item: SelectableItem) => {
    return tempSelected.get(`${item.type}_${item.id}`)?.quantity || 1;
  };

  const getSelectedPrice = (item: SelectableItem) => {
    return tempSelected.get(`${item.type}_${item.id}`)?.unit_price || 0;
  };

  const getConversionFactor = (item: SelectableItem) => Math.max(1, Number(item.large_to_small_factor || 1));
  const hasDualUnit = (item: SelectableItem) => enableDualUnit && item.type === "medicine" && !!item.unit_large && getConversionFactor(item) > 1;

  const getMaxQuantity = (item: SelectableItem) => {
    if (!enforceStockLimit) {
      return Number.MAX_SAFE_INTEGER;
    }

    if (typeof item.current_stock === "number" && item.current_stock > 0) {
      return item.current_stock;
    }

    return 1;
  };

  const filteredTotals = useMemo(() => {
    return calculateCommercialTotals(Array.from(tempSelected.values()).filter((selectedItem) => {
      if (activeTab !== "all" && selectedItem.type !== activeTab) {
        return false;
      }
      if (!debouncedSearch) {
        return true;
      }
      const search = debouncedSearch.toLowerCase();
      return selectedItem.name.toLowerCase().includes(search) || selectedItem.code.toLowerCase().includes(search);
    }));
  }, [activeTab, debouncedSearch, tempSelected]);

  const formatCurrency = (value: number) => `Rp ${value.toLocaleString("id-ID")}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[82vh] w-[95vw] max-w-[1320px] flex-col overflow-hidden border border-border/70 bg-background p-0">
        <div className="border-b border-border/70 bg-muted/10 px-4 py-3 pr-14">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                <Sparkles className="h-3.5 w-3.5" />
                {showCommercialFields ? "Konfigurasi Item Pembelian" : "Pilih Item Permintaan"}
              </div>
              <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
              <DialogDescription className="max-w-3xl text-xs text-muted-foreground">
                {description}
              </DialogDescription>
            </div>

            <div className="flex max-w-full flex-wrap items-center gap-2">
              <Badge variant="secondary" className="h-7 px-3 text-[10px]">
                {isServerMode ? (serverMeta ? `${serverMeta.total} total` : "...") : `${displayItems.length} item tampil`}
              </Badge>
              <Badge variant="outline" className="h-7 px-3 text-[10px]">
                {tempSelected.size} dipilih
              </Badge>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2.5">
            <div className="relative min-w-[280px] flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Cari nama atau kode item..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="h-9 rounded-none border-border/70 bg-background pl-10 pr-4 text-sm"
              />
            </div>

            <Button variant="outline" size="sm" className="h-8 rounded-none px-3 text-[11px]" onClick={handleSelectAll}>
              <Check className="mr-2 h-4 w-4" />
              Pilih Semua
            </Button>
            <Button variant="outline" size="sm" className="h-8 rounded-none px-3 text-[11px]" onClick={handleDeselectAll}>
              <X className="mr-2 h-4 w-4" />
              Reset Filter Ini
            </Button>
          </div>

          {showTabs ? (
            <div className="mt-3 flex items-end gap-4 border-b border-border/70">
              {[
                { value: "all", label: isServerMode ? "Semua Item" : `Semua Item (${allCount})` },
                { value: "inventory", label: isServerMode ? "Inventaris" : `Inventaris (${inventoryCount})` },
                { value: "medicine", label: isServerMode ? "Obat" : `Obat (${medicineCount})` },
              ].map((tab) => (
                <button
                  key={tab.value}
                  type="button"
                  onClick={() => setActiveTab(tab.value)}
                  className={cn(
                    "relative -mb-px border-b-2 px-1 pb-2 text-xs font-medium transition-colors",
                    activeTab === tab.value
                      ? "border-foreground text-foreground"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-4 py-3">
          {isLoading && displayItems.length === 0 ? (
            <div className="flex flex-1 items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : displayItems.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center border border-dashed border-border/70 bg-muted/10 text-muted-foreground">
              <Package className="mb-3 h-10 w-10 opacity-50" />
              <p className="text-sm">Tidak ada item ditemukan pada filter ini.</p>
            </div>
          ) : (
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden border border-border/70 bg-background">
              <div
                ref={scrollRef}
                className={cn("min-h-0 flex-1 overflow-auto", showCommercialFields ? "max-h-[44vh]" : "max-h-[46vh]")}
              >
                {isLoading && displayItems.length === 0 && (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                )}
                <table className={cn("w-full border-collapse text-sm", showCommercialFields ? "min-w-[1180px]" : "w-full")}>
                  <thead className="sticky top-0 z-20 shadow-sm ring-1 ring-border/50">
                    <tr className="bg-muted/30">
                      <th className="h-9 w-12 border-b border-r border-border/70 bg-background px-2 text-left">
                        <span className="sr-only">Pilih</span>
                      </th>
                      <th className="h-9 border-b border-r border-border/70 bg-background px-3 text-left text-[10px] font-semibold uppercase tracking-[0.18em] text-foreground/80">Nama Barang</th>
                      {showStock ? (
                        <th className="h-9 w-28 border-b border-r border-border/70 bg-background px-2 text-center text-[10px] font-semibold uppercase tracking-[0.18em] text-foreground/80">Stok</th>
                      ) : null}
                      {showCommercialFields ? (
                        <>
                          <th className="h-9 w-24 border-b border-r border-border/70 bg-background px-2 text-left text-[10px] font-semibold uppercase tracking-[0.18em] text-foreground/80">Batch</th>
                          <th className="h-9 w-24 border-b border-r border-border/70 bg-background px-2 text-left text-[10px] font-semibold uppercase tracking-[0.18em] text-foreground/80">Exp</th>
                        </>
                      ) : null}
                      <th className={cn("h-9 border-b border-r border-border/70 bg-background px-2 text-right text-[10px] font-semibold uppercase tracking-[0.18em] text-foreground/80", showCommercialFields && enableDualUnit ? "w-44" : "w-32")}>Qty</th>
                      {showCommercialFields ? (
                        <>
                          <th className="h-9 w-28 border-b border-r border-border/70 bg-background px-2 text-right text-[10px] font-semibold uppercase tracking-[0.18em] text-foreground/80">Harga</th>
                          <th className="h-9 w-20 border-b border-r border-border/70 bg-background px-2 text-right text-[10px] font-semibold uppercase tracking-[0.18em] text-foreground/80">Disc %</th>
                          <th className="h-9 w-28 border-b border-r border-border/70 bg-background px-2 text-right text-[10px] font-semibold uppercase tracking-[0.18em] text-foreground/80">Disc Rp</th>
                          <th className="h-9 w-20 border-b border-r border-border/70 bg-background px-2 text-right text-[10px] font-semibold uppercase tracking-[0.18em] text-foreground/80">PPN %</th>
                          <th className="h-9 w-28 border-b border-r border-border/70 bg-background px-2 text-right text-[10px] font-semibold uppercase tracking-[0.18em] text-foreground/80">PPN Rp</th>
                          <th className="h-9 w-32 border-b border-border/70 bg-background px-2 text-right text-[10px] font-semibold uppercase tracking-[0.18em] text-foreground/80">Total</th>
                        </>
                      ) : (
                        <th className="h-9 w-32 border-b border-border/70 bg-background px-3 text-left text-[10px] font-semibold uppercase tracking-[0.18em] text-foreground/80">Tipe</th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                      {rowVirtualizer.getVirtualItems().length > 0 && (
                        <tr>
                          <td style={{ height: rowVirtualizer.getVirtualItems()[0]?.start ?? 0, padding: 0, border: 0 }} colSpan={99} />
                        </tr>
                      )}
                      {rowVirtualizer.getVirtualItems().map((virtualRow: any) => {
                        const item = displayItems[virtualRow.index];
                        if (!item) return null;
                        const selected = isSelected(item);
                        const isLastRow = virtualRow.index === displayItems.length - 1;
                        const maxQuantity = getMaxQuantity(item);
                        // Only compute commercial fields for selected items
                        const selectedItem = tempSelected.get(`${item.type}_${item.id}`) || {
                          ...item,
                          quantity: 1,
                          quantity_large: 0,
                          quantity_small: 0,
                          unit_small: item.unit,
                          conversion_factor: getConversionFactor(item),
                          unit_price: item.price || 0,
                          discount_percent: 0,
                          discount_amount: 0,
                          tax_percent: 0,
                          tax_amount: 0,
                          batch_number: "",
                          expiry_date: "",
                          notes: "",
                        } as SelectedItemWithQty;
                        const dualUnit = hasDualUnit(item);
                        const factor = getConversionFactor(item);
                        let qtyLarge = Math.max(0, Number(selectedItem.quantity_large || 0));
                        let qtySmall = Math.max(0, Number(selectedItem.quantity_small || 0));
                        if (dualUnit && qtyLarge === 0 && qtySmall === 0 && (selectedItem.quantity || 0) > 0) {
                          qtyLarge = Math.floor((selectedItem.quantity || 0) / factor);
                          qtySmall = (selectedItem.quantity || 0) % factor;
                        }

                        return (
                          <tr
                            key={`${item.type}_${item.id}`}
                            data-index={virtualRow.index}
                            ref={rowVirtualizer.measureElement}
                            className={cn(
                              "transition-colors hover:bg-muted/10", 
                              selected && "bg-muted/20",
                              item.is_active === false && "opacity-50 grayscale"
                            )}
                          >
                            <td className={cn("w-12 border-r border-border/60 px-2 py-1.5 align-middle", !isLastRow && "border-b border-border/60")}>
                              <Checkbox 
                                disabled={item.is_active === false}
                                checked={selected} 
                                onCheckedChange={() => item.is_active !== false && toggleItem(item)} 
                              />
                            </td>
                            <td className={cn("border-r border-border/60 px-3 py-1.5 align-middle", !isLastRow && "border-b border-border/60")}>
                              <div className="flex items-start gap-2.5">
                                <div className={cn(
                                  "mt-0.5 flex h-7 w-7 items-center justify-center rounded-full border",
                                  item.type === "medicine"
                                    ? "border-sky-200 bg-sky-50 text-sky-700"
                                    : "border-emerald-200 bg-emerald-50 text-emerald-700"
                                )}>
                                  {item.type === "medicine" ? <Pill className="h-3.5 w-3.5" /> : <Package className="h-3.5 w-3.5" />}
                                </div>
                                <div className="min-w-0 space-y-0.5">
                                  <div className="flex items-center gap-2">
                                    <p className="truncate text-sm font-medium leading-tight">{item.name}</p>
                                    {showStock && item.current_stock !== undefined ? (
                                      <Badge
                                        variant="outline"
                                        className={cn(
                                          "text-[10px]",
                                          item.current_stock > 0
                                            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                            : "border-rose-200 bg-rose-50 text-rose-700"
                                        )}
                                      >
                                        {item.current_stock > 0 ? `Stok ${item.current_stock}` : "Stok habis"}
                                      </Badge>
                                    ) : null}
                                    {item.is_active === false && (
                                      <Badge variant="outline" className="border-rose-200 bg-rose-50 text-rose-700 text-[10px]">
                                        Tidak Aktif
                                      </Badge>
                                    )}
                                  </div>
                                  <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                                    <span className="font-mono">{item.code}</span>
                                    <span>|</span>
                                    <span>{item.unit}</span>
                                    {dualUnit ? (
                                      <>
                                        <span>|</span>
                                        <span>{item.unit_large} x{factor}</span>
                                      </>
                                    ) : null}
                                    {showPrice && item.price !== undefined ? <span>Default {formatCurrency(item.price)}</span> : null}
                                  </div>
                                </div>
                              </div>
                            </td>
                            {showStock ? (
                              <td className={cn("border-r border-border/60 px-2 py-1.5 align-middle text-center text-[11px] text-muted-foreground", showCommercialFields ? "w-[96px]" : "w-[120px]", !isLastRow && "border-b border-border/60")}>
                                {item.current_stock?.toLocaleString("id-ID") ?? "-"}
                              </td>
                            ) : null}
                            {showCommercialFields ? (
                              <>
                                <td className={cn("border-r border-border/60 px-2 py-1.5 align-middle", !isLastRow && "border-b border-border/60")}>
                                  <Input
                                    value={selectedItem.batch_number || ""}
                                    disabled={!selected}
                                    onChange={(e) => updateSelectedItem(item, { batch_number: e.target.value })}
                                    className="h-7 border-0 bg-transparent px-0 text-[11px] shadow-none disabled:opacity-40"
                                    placeholder="-"
                                  />
                                </td>
                                <td className={cn("border-r border-border/60 px-2 py-1.5 align-middle", !isLastRow && "border-b border-border/60")}>
                                  <Input
                                    type="date"
                                    value={selectedItem.expiry_date || ""}
                                    disabled={!selected}
                                    onChange={(e) => updateSelectedItem(item, { expiry_date: e.target.value })}
                                    className="h-7 border-0 bg-transparent px-0 text-[11px] shadow-none disabled:opacity-40"
                                  />
                                </td>
                              </>
                            ) : null}
                            <td className={cn("border-r border-border/60 px-2 py-1.5 align-middle", !isLastRow && "border-b border-border/60")}>
                              {dualUnit ? (
                                <div className="space-y-1">
                                  <div className="grid grid-cols-[1fr_1fr] gap-1">
                                    <Input
                                      type="number"
                                      min={0}
                                      disabled={!selected}
                                      value={selected ? qtyLarge : ""}
                                      onChange={(e) => {
                                        const rawLarge = Math.max(0, Number(e.target.value) || 0);
                                        const nextLarge = showStock ? Math.min(Math.floor(maxQuantity / factor), rawLarge) : rawLarge;
                                        let nextQty = (nextLarge * factor) + qtySmall;
                                        if (showStock) nextQty = Math.min(maxQuantity, nextQty);
                                        const nextSmall = showStock ? Math.max(0, nextQty - (nextLarge * factor)) : qtySmall;
                                        updateSelectedItem(item, {
                                          quantity_large: nextLarge,
                                          quantity_small: nextSmall,
                                          quantity: Math.max(0, nextQty),
                                          conversion_factor: factor,
                                          unit_small: item.unit,
                                        });
                                      }}
                                      className="h-7 border-0 bg-transparent px-0 text-right text-[11px] shadow-none disabled:opacity-40"
                                      placeholder="0"
                                    />
                                    <Input
                                      type="number"
                                      min={0}
                                      disabled={!selected}
                                      value={selected ? qtySmall : ""}
                                      onChange={(e) => {
                                        const rawSmall = Math.max(0, Number(e.target.value) || 0);
                                        const maxSmall = showStock ? Math.max(0, maxQuantity - (qtyLarge * factor)) : Number.MAX_SAFE_INTEGER;
                                        const nextSmall = Math.min(rawSmall, maxSmall);
                                        let nextQty = (qtyLarge * factor) + nextSmall;
                                        if (showStock) nextQty = Math.min(maxQuantity, nextQty);
                                        updateSelectedItem(item, {
                                          quantity_large: qtyLarge,
                                          quantity_small: nextSmall,
                                          quantity: Math.max(0, nextQty),
                                          conversion_factor: factor,
                                          unit_small: item.unit,
                                        });
                                      }}
                                      className="h-7 border-0 bg-transparent px-0 text-right text-[11px] shadow-none disabled:opacity-40"
                                      placeholder="0"
                                    />
                                  </div>
                                  <p className="text-[10px] text-muted-foreground text-right">
                                    {item.unit_large} + {item.unit}
                                    {showStock && enforceStockLimit ? ` | maks ${maxQuantity}` : ""}
                                  </p>
                                </div>
                              ) : (
                                <Input
                                  type="number"
                                  min={1}
                                  max={showStock ? maxQuantity : undefined}
                                  disabled={!selected}
                                  value={selected ? getSelectedQuantity(item) : ""}
                                  onChange={(e) =>
                                    updateSelectedItem(
                                      item,
                                      {
                                        quantity: showStock
                                          ? Math.min(maxQuantity, Math.max(1, Number(e.target.value) || 1))
                                          : Math.max(1, Number(e.target.value) || 1),
                                      }
                                    )
                                  }
                                  className="h-7 border-0 bg-transparent px-0 text-right text-[11px] shadow-none disabled:opacity-40"
                                  placeholder="0"
                                />
                              )}
                            </td>
                            {showCommercialFields ? (
                              <>
                                <td className={cn("border-r border-border/60 px-2 py-1.5 align-middle", !isLastRow && "border-b border-border/60")}>
                                  <Input
                                    type="number"
                                    min={0}
                                    disabled={!selected}
                                    value={selected ? getSelectedPrice(item) : ""}
                                    onChange={(e) => updateSelectedItem(item, { unit_price: Math.max(0, Number(e.target.value) || 0) })}
                                    className="h-7 border-0 bg-transparent px-0 text-right text-[11px] shadow-none disabled:opacity-40"
                                    placeholder="0"
                                  />
                                </td>
                                <td className={cn("border-r border-border/60 px-2 py-1.5 align-middle", !isLastRow && "border-b border-border/60")}>
                                  <Input
                                    type="number"
                                    min={0}
                                    disabled={!selected}
                                    value={selected ? selectedItem.discount_percent || 0 : ""}
                                    onChange={(e) => updateSelectedItem(item, setDiscountPercent(selectedItem, Number(e.target.value) || 0))}
                                    className="h-7 border-0 bg-transparent px-0 text-right text-[11px] shadow-none disabled:opacity-40"
                                    placeholder="0"
                                  />
                                </td>
                                <td className={cn("border-r border-border/60 px-2 py-1.5 align-middle", !isLastRow && "border-b border-border/60")}>
                                  <Input
                                    type="number"
                                    min={0}
                                    disabled={!selected}
                                    value={selected ? selectedItem.discount_amount || 0 : ""}
                                    onChange={(e) => updateSelectedItem(item, setDiscountAmount(selectedItem, Number(e.target.value) || 0))}
                                    className="h-7 border-0 bg-transparent px-0 text-right text-[11px] shadow-none disabled:opacity-40"
                                    placeholder="0"
                                  />
                                </td>
                                <td className={cn("border-r border-border/60 px-2 py-1.5 align-middle", !isLastRow && "border-b border-border/60")}>
                                  <Input
                                    type="number"
                                    min={0}
                                    disabled={!selected}
                                    value={selected ? selectedItem.tax_percent || 0 : ""}
                                    onChange={(e) => updateSelectedItem(item, setTaxPercent(selectedItem, Number(e.target.value) || 0))}
                                    className="h-7 border-0 bg-transparent px-0 text-right text-[11px] shadow-none disabled:opacity-40"
                                    placeholder="0"
                                  />
                                </td>
                                <td className={cn("border-r border-border/60 px-2 py-1.5 align-middle", !isLastRow && "border-b border-border/60")}>
                                  <Input
                                    type="number"
                                    min={0}
                                    disabled={!selected}
                                    value={selected ? selectedItem.tax_amount || 0 : ""}
                                    onChange={(e) => updateSelectedItem(item, setTaxAmount(selectedItem, Number(e.target.value) || 0))}
                                    className="h-7 border-0 bg-transparent px-0 text-right text-[11px] shadow-none disabled:opacity-40"
                                    placeholder="0"
                                  />
                                </td>
                                <td className={cn("px-2 py-1.5 text-right text-xs font-semibold", !isLastRow && "border-b border-border/60")}>
                                  {selected ? formatCurrency(calculateLineTotal(selectedItem)) : "-"}
                                </td>
                              </>
                            ) : (
                              <td className={cn("px-2 py-1.5 align-middle text-[11px] text-muted-foreground", !isLastRow && "border-b border-border/60")}>
                                <div className="space-y-1">
                                  <Badge variant="outline" className="text-[10px]">
                                    {item.type === "inventory" ? "Inventaris" : "Obat"}
                                  </Badge>
                                  {showStock && item.current_stock !== undefined && enforceStockLimit ? (
                                    <p className={cn("text-[11px]", selectedItem.quantity >= maxQuantity ? "text-amber-700" : "text-muted-foreground")}>
                                      Maks. {maxQuantity} {item.unit}
                                    </p>
                                  ) : null}
                                </div>
                              </td>
                            )}
                          </tr>
                        );
                      })}
                      {rowVirtualizer.getVirtualItems().length > 0 && (
                        <tr>
                          <td
                            style={{
                              height:
                                rowVirtualizer.getTotalSize() -
                                (rowVirtualizer.getVirtualItems().at(-1)?.end ?? 0),
                              padding: 0,
                              border: 0,
                            }}
                            colSpan={99}
                          />
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

              {/* Pagination (server mode) */}
              {isServerMode && serverMeta && serverMeta.total_pages > 1 && (
                <div className="flex items-center justify-between border-t border-border/70 bg-muted/10 px-3 py-2">
                  <span className="text-[11px] text-muted-foreground">
                    Halaman {serverMeta.page} dari {serverMeta.total_pages} ({serverMeta.total} item)
                  </span>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 rounded-none px-2 text-[11px]"
                      disabled={serverMeta.page <= 1 || serverLoading}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                    >
                      <ChevronLeft className="mr-1 h-3.5 w-3.5" />
                      Sebelumnya
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 rounded-none px-2 text-[11px]"
                      disabled={serverMeta.page >= serverMeta.total_pages || serverLoading}
                      onClick={() => setPage((p) => p + 1)}
                    >
                      Berikutnya
                      <ChevronRight className="ml-1 h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              )}

              <div className="border-t border-border/70 bg-muted/10 px-3 py-2.5">
                {showCommercialFields ? (
                  <div className="grid gap-3 text-sm md:grid-cols-[1fr_auto]">
                    <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
                      <span>{tempSelected.size} item siap ditambahkan</span>
                      <span>{filteredTotals.totalQuantity.toLocaleString("id-ID")} total qty terpilih</span>
                      <span>Subtotal terpilih {formatCurrency(filteredTotals.subtotal)}</span>
                    </div>
                    <div className="grid min-w-[240px] gap-0.5 text-right text-[11px]">
                      <div className="flex items-center justify-between gap-6"><span className="text-muted-foreground">Jumlah</span><span className="font-medium">{formatCurrency(filteredTotals.subtotal)}</span></div>
                      <div className="flex items-center justify-between gap-6"><span className="text-muted-foreground">Diskon</span><span className="font-medium text-rose-600">{formatCurrency(filteredTotals.discount)}</span></div>
                      <div className="flex items-center justify-between gap-6"><span className="text-muted-foreground">PPN</span><span className="font-medium text-sky-700">{formatCurrency(filteredTotals.tax)}</span></div>
                      <div className="flex items-center justify-between gap-6 border-t border-border/70 pt-1 text-xs"><span className="font-semibold">Total</span><span className="font-semibold">{formatCurrency(filteredTotals.grandTotal)}</span></div>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
                    <span>{tempSelected.size} item siap ditambahkan</span>
                    <span>{filteredTotals.totalQuantity.toLocaleString("id-ID")} total qty terpilih</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-border/70 bg-background px-4 py-3">
          <div className="text-xs text-muted-foreground">
            {showCommercialFields
              ? "Gunakan checkbox untuk memilih item, lalu isi nilai komersial langsung di tabel."
              : "Pilih item dengan checkbox lalu tentukan jumlah yang ingin diminta langsung di tabel."}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" className="rounded-none" onClick={() => onOpenChange(false)}>
              Batal
            </Button>
            <Button className="rounded-none" onClick={handleConfirm} disabled={tempSelected.size === 0}>
              <Check className="mr-2 h-4 w-4" />
              Simpan {tempSelected.size} Item
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
