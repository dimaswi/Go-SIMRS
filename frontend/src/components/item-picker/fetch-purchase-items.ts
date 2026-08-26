import { medicinesApi } from "@/lib/api/medicines";
import { inventoriesApi } from "@/lib/api/inventories";
import type { SelectableItem } from "./item-picker-dialog";

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}

export interface FetchItemsParams {
  search: string;
  page: number;
  limit: number;
  type?: "inventory" | "medicine";
}

export interface FetchItemsResult {
  data: SelectableItem[];
  meta: PaginationMeta;
}

/**
 * Fetches medicines and inventories from the server in parallel,
 * merges them into a unified SelectableItem[] for the item picker.
 * Used by purchase create/edit pages in "server" mode.
 */
export async function fetchPurchaseItems(
  params: FetchItemsParams
): Promise<FetchItemsResult> {
  const { search, page, limit, type } = params;

  const fetchMed = !type || type === "medicine";
  const fetchInv = !type || type === "inventory";

  // When fetching both types, split the limit so the combined result
  // stays close to the requested page size.
  const perTypeLimit = fetchMed && fetchInv ? Math.ceil(limit / 2) : limit;

  const emptyResult = {
    data: { data: [], meta: { total: 0, page: 1, limit: perTypeLimit, total_pages: 0 } },
  };

  const [medRes, invRes] = await Promise.all([
    fetchMed
      ? medicinesApi.getAll({ search, page, limit: perTypeLimit })
      : Promise.resolve(emptyResult),
    fetchInv
      ? inventoriesApi.getAll({ search, page, limit: perTypeLimit })
      : Promise.resolve(emptyResult),
  ]);

  const medicines = medRes.data?.data || [];
  const inventories = invRes.data?.data || [];

  // Map to SelectableItem
  const medItems: SelectableItem[] = medicines.map((med: any) => ({
    id: med.id,
    code: med.code,
    name: med.name,
    unit: med.unit,
    unit_large: med.unit_large,
    large_to_small_factor: med.large_to_small_factor || 1,
    type: "medicine" as const,
    category: med.category,
    current_stock: med.current_stock,
    price: med.purchase_price ?? med.price ?? 0,
    is_active: med.is_active,
  }));

  const invItems: SelectableItem[] = inventories.map((inv: any) => ({
    id: inv.id,
    code: inv.code,
    name: inv.name,
    unit: inv.unit,
    type: "inventory" as const,
    category: inv.category,
    current_stock: inv.current_stock,
    price: inv.purchase_price ?? inv.price ?? 0,
    is_active: inv.is_active,
  }));

  const merged = [...invItems, ...medItems];

  // Combine pagination meta
  const medMeta = medRes.data?.meta || { total: 0, page: 1, limit: perTypeLimit, total_pages: 0 };
  const invMeta = invRes.data?.meta || { total: 0, page: 1, limit: perTypeLimit, total_pages: 0 };
  const totalRecords = medMeta.total + invMeta.total;
  const effectiveLimit = fetchMed && fetchInv ? limit : perTypeLimit;

  return {
    data: merged,
    meta: {
      total: totalRecords,
      page,
      limit: effectiveLimit,
      total_pages: Math.max(1, Math.ceil(totalRecords / effectiveLimit)),
    },
  };
}
