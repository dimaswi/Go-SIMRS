import { useCallback, useEffect, useState } from "react";
import type { SortingState, ColumnFiltersState, VisibilityState } from "@tanstack/react-table";

export interface DataTableState {
  pageIndex: number;
  pageSize: number;
  sorting: SortingState;
  columnFilters: ColumnFiltersState;
  columnVisibility: VisibilityState;
  globalFilter: string;
}

const DEFAULT_STATE: DataTableState = {
  pageIndex: 0,
  pageSize: 10,
  sorting: [],
  columnFilters: [],
  columnVisibility: {},
  globalFilter: "",
};

const STORAGE_KEY_PREFIX = "datatable_state_";

export function useDataTableState(tableId?: string, defaultPageSize: number = 10) {
  const storageKey = tableId ? `${STORAGE_KEY_PREFIX}${tableId}` : null;

  const getInitialState = useCallback((): DataTableState => {
    if (!storageKey) {
      return { ...DEFAULT_STATE, pageSize: defaultPageSize };
    }

    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const parsed = JSON.parse(stored) as Partial<DataTableState>;
        return {
          pageIndex: parsed.pageIndex ?? 0,
          pageSize: parsed.pageSize ?? defaultPageSize,
          sorting: parsed.sorting ?? [],
          columnFilters: parsed.columnFilters ?? [],
          columnVisibility: parsed.columnVisibility ?? {},
          globalFilter: parsed.globalFilter ?? "",
        };
      }
    } catch (error) {
      console.error("Error reading datatable state from localStorage:", error);
    }

    return { ...DEFAULT_STATE, pageSize: defaultPageSize };
  }, [storageKey, defaultPageSize]);

  const [state, setState] = useState<DataTableState>(getInitialState);

  // Save to localStorage when state changes
  useEffect(() => {
    if (!storageKey) return;

    try {
      localStorage.setItem(storageKey, JSON.stringify(state));
    } catch (error) {
      console.error("Error saving datatable state to localStorage:", error);
    }
  }, [storageKey, state]);

  const setPageIndex = useCallback((pageIndex: number) => {
    setState(prev => ({ ...prev, pageIndex }));
  }, []);

  const setPageSize = useCallback((pageSize: number) => {
    setState(prev => ({ ...prev, pageSize, pageIndex: 0 }));
  }, []);

  const setSorting = useCallback((sorting: SortingState | ((prev: SortingState) => SortingState)) => {
    setState(prev => ({
      ...prev,
      sorting: typeof sorting === "function" ? sorting(prev.sorting) : sorting,
    }));
  }, []);

  const setColumnFilters = useCallback((filters: ColumnFiltersState | ((prev: ColumnFiltersState) => ColumnFiltersState)) => {
    setState(prev => ({
      ...prev,
      columnFilters: typeof filters === "function" ? filters(prev.columnFilters) : filters,
    }));
  }, []);

  const setColumnVisibility = useCallback((visibility: VisibilityState | ((prev: VisibilityState) => VisibilityState)) => {
    setState(prev => ({
      ...prev,
      columnVisibility: typeof visibility === "function" ? visibility(prev.columnVisibility) : visibility,
    }));
  }, []);

  const setGlobalFilter = useCallback((filter: string) => {
    setState(prev => ({ ...prev, globalFilter: filter, pageIndex: 0 }));
  }, []);

  const resetState = useCallback(() => {
    setState({ ...DEFAULT_STATE, pageSize: defaultPageSize });
    if (storageKey) {
      localStorage.removeItem(storageKey);
    }
  }, [storageKey, defaultPageSize]);

  return {
    state,
    setPageIndex,
    setPageSize,
    setSorting,
    setColumnFilters,
    setColumnVisibility,
    setGlobalFilter,
    resetState,
  };
}
