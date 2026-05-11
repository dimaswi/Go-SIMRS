export interface PurchaseCommercialItemLike {
  quantity: number;
  unit_price?: number;
  discount_percent?: number;
  discount_amount?: number;
  tax_percent?: number;
  tax_amount?: number;
}

export interface PurchaseCommercialTotals {
  subtotal: number;
  discount: number;
  tax: number;
  grandTotal: number;
  totalQuantity: number;
}

const round2 = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

export function calculateBaseAmount(item: PurchaseCommercialItemLike) {
  return round2(Math.max(0, item.quantity || 0) * Math.max(0, item.unit_price || 0));
}

export function syncPurchaseItemCommercials<T extends PurchaseCommercialItemLike>(item: T): T {
  const subtotal = calculateBaseAmount(item);
  const discountPercent = Math.max(0, item.discount_percent || 0);
  const taxPercent = Math.max(0, item.tax_percent || 0);
  const discountAmount = round2(Math.min(subtotal, (subtotal * discountPercent) / 100));
  const taxableBase = Math.max(0, subtotal - discountAmount);
  const taxAmount = round2((taxableBase * taxPercent) / 100);

  return {
    ...item,
    discount_percent: round2(discountPercent),
    discount_amount: discountAmount,
    tax_percent: round2(taxPercent),
    tax_amount: taxAmount,
  };
}

export function setDiscountPercent<T extends PurchaseCommercialItemLike>(item: T, value: number): T {
  return syncPurchaseItemCommercials({
    ...item,
    discount_percent: Math.max(0, value || 0),
  });
}

export function setDiscountAmount<T extends PurchaseCommercialItemLike>(item: T, value: number): T {
  const subtotal = calculateBaseAmount(item);
  const amount = Math.max(0, Math.min(subtotal, value || 0));
  const percent = subtotal > 0 ? (amount / subtotal) * 100 : 0;
  return syncPurchaseItemCommercials({
    ...item,
    discount_percent: percent,
  });
}

export function setTaxPercent<T extends PurchaseCommercialItemLike>(item: T, value: number): T {
  return syncPurchaseItemCommercials({
    ...item,
    tax_percent: Math.max(0, value || 0),
  });
}

export function setTaxAmount<T extends PurchaseCommercialItemLike>(item: T, value: number): T {
  const subtotal = calculateBaseAmount(item);
  const discountAmount = round2(Math.min(subtotal, (subtotal * Math.max(0, item.discount_percent || 0)) / 100));
  const taxableBase = Math.max(0, subtotal - discountAmount);
  const amount = Math.max(0, value || 0);
  const percent = taxableBase > 0 ? (amount / taxableBase) * 100 : 0;
  return syncPurchaseItemCommercials({
    ...item,
    tax_percent: percent,
  });
}

export function calculateLineTotal(item: PurchaseCommercialItemLike) {
  const normalized = syncPurchaseItemCommercials(item);
  const subtotal = calculateBaseAmount(normalized);
  return round2(subtotal - (normalized.discount_amount || 0) + (normalized.tax_amount || 0));
}

export function calculateCommercialTotals(items: PurchaseCommercialItemLike[]): PurchaseCommercialTotals {
  return items.reduce<PurchaseCommercialTotals>(
    (accumulator, item) => {
      const normalized = syncPurchaseItemCommercials(item);
      accumulator.subtotal += calculateBaseAmount(normalized);
      accumulator.discount += normalized.discount_amount || 0;
      accumulator.tax += normalized.tax_amount || 0;
      accumulator.grandTotal += calculateLineTotal(normalized);
      accumulator.totalQuantity += normalized.quantity || 0;
      return accumulator;
    },
    { subtotal: 0, discount: 0, tax: 0, grandTotal: 0, totalQuantity: 0 }
  );
}