"use client";

import * as React from "react";
import type {
  ColumnDef,
  ColumnFiltersState,
  SortingState,
  VisibilityState,
} from "@tanstack/react-table";
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Search,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

function getStoredPageIndex(tableId: string): number {
  if (!tableId) return 0;

  try {
    const stored = localStorage.getItem(`dt_page_${tableId}`);
    if (stored) {
      const parsed = Number.parseInt(stored, 10);
      if (!Number.isNaN(parsed) && parsed >= 0) {
        return parsed;
      }
    }
  } catch {
    // Ignore localStorage access failures and fall back to defaults.
  }

  return 0;
}

function setStoredPageIndex(tableId: string, pageIndex: number) {
  if (!tableId) return;

  try {
    localStorage.setItem(`dt_page_${tableId}`, String(pageIndex));
  } catch {
    // Ignore localStorage access failures and fall back to defaults.
  }
}

function getStoredPageSize(tableId: string, defaultSize: number): number {
  if (!tableId) return defaultSize;

  try {
    const stored = localStorage.getItem(`dt_size_${tableId}`);
    if (stored) {
      const parsed = Number.parseInt(stored, 10);
      if (!Number.isNaN(parsed) && parsed > 0) {
        return parsed;
      }
    }
  } catch {
    // Ignore localStorage access failures and fall back to defaults.
  }

  return defaultSize;
}

function setStoredPageSize(tableId: string, pageSize: number) {
  if (!tableId) return;

  try {
    localStorage.setItem(`dt_size_${tableId}`, String(pageSize));
  } catch {
    // Ignore localStorage access failures and fall back to defaults.
  }
}

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  searchPlaceholder?: string;
  showPagination?: boolean;
  showSearch?: boolean;
  pageSize?: number;
  meta?: Record<string, unknown>;
  tableId?: string;
  initialSorting?: SortingState;
  initialColumnVisibility?: VisibilityState;
  pageIndex?: number;
  onPageIndexChange?: (pageIndex: number) => void;
  globalFilterValue?: string;
  onGlobalFilterValueChange?: (value: string) => void;
  searchSlot?: React.ReactNode;
  toolbarRight?: React.ReactNode;
  hideRowCount?: boolean;
  className?: string;
}

export function DataTable<TData, TValue>({
  columns,
  data,
  searchPlaceholder = "Cari data...",
  showPagination = true,
  showSearch = true,
  pageSize: defaultPageSize = 10,
  meta,
  tableId,
  initialSorting = [],
  initialColumnVisibility = {},
  pageIndex: controlledPageIndex,
  onPageIndexChange,
  globalFilterValue: controlledGlobalFilter,
  onGlobalFilterValueChange,
  searchSlot,
  toolbarRight,
  hideRowCount = false,
  className,
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = React.useState<SortingState>(initialSorting);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(
    [],
  );
  const [columnVisibility, setColumnVisibility] =
    React.useState<VisibilityState>(initialColumnVisibility);
  const [rowSelection, setRowSelection] = React.useState({});
  const [globalFilter, setGlobalFilter] = React.useState<string>(() => {
    if (!tableId) return "";

    try {
      return localStorage.getItem(`dt_search_${tableId}`) || "";
    } catch {
      return "";
    }
  });
  const [pageSize, setPageSize] = React.useState(() => {
    return tableId
      ? getStoredPageSize(tableId, defaultPageSize)
      : defaultPageSize;
  });
  const [internalPageIndex, setInternalPageIndex] = React.useState(() => {
    return tableId ? getStoredPageIndex(tableId) : 0;
  });

  React.useEffect(() => {
    if (!tableId) return;

    try {
      localStorage.setItem(`dt_search_${tableId}`, globalFilter);
    } catch {
      // Ignore localStorage access failures and keep the UI responsive.
    }
  }, [globalFilter, tableId]);

  const handlePageChange = React.useCallback(
    (newPageIndex: number) => {
      const nextPageIndex = Math.max(0, newPageIndex);

      if (tableId) {
        setStoredPageIndex(tableId, nextPageIndex);
      }

      if (onPageIndexChange) {
        onPageIndexChange(nextPageIndex);
      } else {
        setInternalPageIndex(nextPageIndex);
      }
    },
    [onPageIndexChange, tableId],
  );

  const handlePageSizeChange = React.useCallback(
    (newSize: number) => {
      setPageSize(newSize);

      if (tableId) {
        setStoredPageSize(tableId, newSize);
      }

      handlePageChange(0);
    },
    [handlePageChange, tableId],
  );

  const handleSearchChange = React.useCallback(
    (value: string) => {
      if (onGlobalFilterValueChange) {
        onGlobalFilterValueChange(value);
      } else {
        setGlobalFilter(value);
      }
      handlePageChange(0);
    },
    [handlePageChange, onGlobalFilterValueChange],
  );

  const pageIndex = controlledPageIndex ?? internalPageIndex;
  const effectiveGlobalFilter = controlledGlobalFilter ?? globalFilter;

  const table = useReactTable({
    data,
    columns,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    onGlobalFilterChange: setGlobalFilter,
    globalFilterFn: (row, _columnId, filterValue: string) => {
      if (!filterValue) return true;
      const q = filterValue.toLowerCase().trim();
      if (!q) return true;
      const extractStrings = (obj: unknown): string => {
        if (obj === null || obj === undefined) return "";
        if (typeof obj === "string") return obj.toLowerCase();
        if (typeof obj === "number" || typeof obj === "boolean")
          return String(obj).toLowerCase();
        if (Array.isArray(obj)) return obj.map(extractStrings).join(" ");
        if (typeof obj === "object")
          return Object.values(obj).map(extractStrings).join(" ");
        return "";
      };
      return extractStrings(row.original).includes(q);
    },
    meta,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
      globalFilter: effectiveGlobalFilter,
      pagination: { pageIndex, pageSize },
    },
  });

  const filteredCount = table.getFilteredRowModel().rows.length;
  const totalCount = data.length;
  const totalPages = Math.max(1, Math.ceil(filteredCount / pageSize));
  const maxPage = Math.max(0, totalPages - 1);

  React.useEffect(() => {
    if (pageIndex > maxPage) {
      handlePageChange(maxPage);
    }
  }, [handlePageChange, maxPage, pageIndex]);

  const currentRowsCount = table.getRowModel().rows.length;
  const fromRow = filteredCount === 0 ? 0 : pageIndex * pageSize + 1;
  const toRow = filteredCount === 0 ? 0 : Math.min(fromRow + currentRowsCount - 1, filteredCount);

  return (
    <div className={cn("akuntansi-datatable flex w-full flex-col bg-white dark:bg-neutral-950", className)}>
      {/* 1. Shaded Filter & Search Strip (ala Go-Akuntansi) */}
      {(showSearch || searchSlot || toolbarRight) && (
        <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50/70 dark:bg-neutral-900/40 px-4 py-2.5">
          <div className="flex flex-wrap items-center gap-2 flex-1 min-w-0">
            {showSearch && (
              <div className="relative w-full sm:w-72 min-w-0">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-neutral-400" />
                <Input
                  placeholder={searchPlaceholder}
                  value={effectiveGlobalFilter}
                  onChange={(event) => handleSearchChange(event.target.value)}
                  className="h-8 w-full rounded-none border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 pl-8 pr-7 text-xs text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 shadow-none focus-visible:ring-1 focus-visible:ring-neutral-400"
                />
                {effectiveGlobalFilter && (
                  <button
                    type="button"
                    onClick={() => handleSearchChange("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200"
                    aria-label="Hapus pencarian"
                  >
                    <X className="size-3.5" />
                  </button>
                )}
              </div>
            )}

            {searchSlot}
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {toolbarRight}
            {!hideRowCount && (
              <span className="whitespace-nowrap font-mono text-xs tabular-nums text-neutral-500">
                {filteredCount.toLocaleString("id-ID")}
                {filteredCount !== totalCount && (
                  <span className="text-neutral-400">
                    {" "}
                    / {totalCount.toLocaleString("id-ID")}
                  </span>
                )}{" "}
                baris
              </span>
            )}
          </div>
        </div>
      )}

      {/* 2. Enterprise Flat Table (ala Go-Akuntansi) */}
      <div className="w-full overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr
                key={headerGroup.id}
                className="border-b border-neutral-200 dark:border-neutral-800 bg-neutral-100/75 dark:bg-neutral-900/75 text-xs font-bold text-neutral-700 dark:text-neutral-300 uppercase tracking-wider"
              >
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    className="py-2.5 px-3 text-xs font-bold uppercase tracking-wider text-neutral-700 dark:text-neutral-300 whitespace-nowrap align-middle [&_button]:h-auto [&_button]:p-0 [&_button]:font-bold [&_button]:uppercase [&_button]:tracking-wider [&_button]:text-xs [&_button]:text-neutral-700 dark:[&_button]:text-neutral-300 [&_button]:hover:bg-transparent"
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )}
                  </th>
                ))}
              </tr>
            ))}
          </thead>

          <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
            {table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => {
                const subRowRenderer = (meta as Record<string, unknown>)
                  ?.renderSubRow as
                  | ((data: TData) => React.ReactNode)
                  | undefined;
                return (
                  <React.Fragment key={row.id}>
                    <tr
                      data-state={row.getIsSelected() && "selected"}
                      className="hover:bg-neutral-50/70 dark:hover:bg-neutral-900/50 transition-colors"
                    >
                      {row.getVisibleCells().map((cell) => (
                        <td
                          key={cell.id}
                          className="py-2.5 px-3 text-xs sm:text-sm text-neutral-800 dark:text-neutral-200 align-middle"
                        >
                          {flexRender(
                            cell.column.columnDef.cell,
                            cell.getContext(),
                          )}
                        </td>
                      ))}
                    </tr>
                    {subRowRenderer && subRowRenderer(row.original)}
                  </React.Fragment>
                );
              })
            ) : (
              <tr>
                <td
                  colSpan={columns.length}
                  className="py-12 text-center font-mono text-xs italic text-neutral-400"
                >
                  Tidak ada data yang sesuai kriteria pencarian.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* 3. Card Footer Pagination Bar (ala Go-Akuntansi) */}
      {showPagination && (
        <div className="p-3 px-4 border-t border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-neutral-600 dark:text-neutral-400">
          <div className="flex flex-wrap items-center gap-2">
            <span>Baris per halaman:</span>
            <select
              value={pageSize}
              onChange={(e) => handlePageSizeChange(Number(e.target.value))}
              className="h-7 border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 px-2 text-xs text-neutral-900 dark:text-neutral-100 rounded-none shadow-none cursor-pointer outline-none"
            >
              {[10, 20, 30, 50, 100].map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
            <span className="font-mono text-neutral-400 ml-1">
              Menampilkan {fromRow} - {toRow} dari {filteredCount.toLocaleString("id-ID")} data
            </span>
          </div>

          <div className="flex items-center gap-1 font-mono self-end sm:self-center">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 w-7 p-0 rounded-none border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-50 shadow-none disabled:opacity-40"
              onClick={() => handlePageChange(0)}
              disabled={pageIndex <= 0}
              title="Halaman Pertama"
            >
              <ChevronsLeft className="size-3.5" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 w-7 p-0 rounded-none border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-50 shadow-none disabled:opacity-40"
              onClick={() => handlePageChange(pageIndex - 1)}
              disabled={pageIndex <= 0}
              title="Halaman Sebelumnya"
            >
              <ChevronLeft className="size-3.5" />
            </Button>

            <span className="px-2 text-xs font-semibold text-neutral-900 dark:text-neutral-100">
              Hal {Math.min(pageIndex + 1, totalPages)} dari {totalPages}
            </span>

            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 w-7 p-0 rounded-none border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-50 shadow-none disabled:opacity-40"
              onClick={() => handlePageChange(pageIndex + 1)}
              disabled={pageIndex >= maxPage}
              title="Halaman Selanjutnya"
            >
              <ChevronRight className="size-3.5" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 w-7 p-0 rounded-none border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-50 shadow-none disabled:opacity-40"
              onClick={() => handlePageChange(maxPage)}
              disabled={pageIndex >= maxPage}
              title="Halaman Terakhir"
            >
              <ChevronsRight className="size-3.5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
