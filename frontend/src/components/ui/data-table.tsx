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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
  } catch {}

  return 0;
}

function setStoredPageIndex(tableId: string, pageIndex: number) {
  if (!tableId) return;

  try {
    localStorage.setItem(`dt_page_${tableId}`, String(pageIndex));
  } catch {}
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
  } catch {}

  return defaultSize;
}

function setStoredPageSize(tableId: string, pageSize: number) {
  if (!tableId) return;

  try {
    localStorage.setItem(`dt_size_${tableId}`, String(pageSize));
  } catch {}
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
  searchSlot?: React.ReactNode;
  className?: string;
}

export function DataTable<TData, TValue>({
  columns,
  data,
  searchPlaceholder = "Search...",
  showPagination = true,
  showSearch = true,
  pageSize: defaultPageSize = 10,
  meta,
  tableId,
  initialSorting = [],
  initialColumnVisibility = {},
  pageIndex: controlledPageIndex,
  onPageIndexChange,
  searchSlot,
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
    } catch {}
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
      setGlobalFilter(value);
      handlePageChange(0);
    },
    [handlePageChange],
  );

  const pageIndex = controlledPageIndex ?? internalPageIndex;

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
      // Recursively flatten all string values from the row's original data
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
      globalFilter,
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

  return (
    <div className={cn("flex w-full flex-col", className)}>
      {(showSearch || searchSlot) && (
        <div className="flex flex-wrap items-center gap-1.5 py-2">
          {showSearch && (
            <div className="relative w-full max-w-[240px] min-w-0">
              <Search className="pointer-events-none absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder={searchPlaceholder}
                value={globalFilter}
                onChange={(event) => handleSearchChange(event.target.value)}
                className="h-7 w-full bg-background pl-7 pr-7 text-xs"
              />
              {globalFilter && (
                <button
                  type="button"
                  onClick={() => handleSearchChange("")}
                  className="absolute right-1 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  aria-label="Hapus pencarian"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          )}

          {searchSlot}

          <span className="ml-auto whitespace-nowrap text-[11px] tabular-nums text-muted-foreground">
            {filteredCount.toLocaleString("id-ID")}
            {filteredCount !== totalCount && (
              <span className="text-muted-foreground/60">
                {" "}
                / {totalCount.toLocaleString("id-ID")}
              </span>
            )}{" "}
            baris
          </span>
        </div>
      )}

      <div className="rounded-md border-b">
        <div className="relative max-h-[calc(100dvh-400px)] overflow-y-auto">
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <TableHead
                      key={header.id}
                      className="sticky top-0 z-50 bg-background shadow-[inset_0_1px_0_hsl(var(--border)),inset_0_-1px_0_hsl(var(--border))]"
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext(),
                          )}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>

            <TableBody>
              {table.getRowModel().rows.length ? (
                table.getRowModel().rows.map((row) => {
                  const subRowRenderer = (meta as Record<string, unknown>)
                    ?.renderSubRow as
                    | ((data: TData) => React.ReactNode)
                    | undefined;
                  return (
                    <React.Fragment key={row.id}>
                      <TableRow data-state={row.getIsSelected() && "selected"}>
                        {row.getVisibleCells().map((cell) => (
                          <TableCell key={cell.id}>
                            {flexRender(
                              cell.column.columnDef.cell,
                              cell.getContext(),
                            )}
                          </TableCell>
                        ))}
                      </TableRow>
                      {subRowRenderer && subRowRenderer(row.original)}
                    </React.Fragment>
                  );
                })
              ) : (
                <TableRow className="even:bg-transparent odd:bg-transparent hover:bg-transparent">
                  <TableCell
                    colSpan={columns.length}
                    className="h-32 text-center text-sm text-muted-foreground"
                  >
                    Tidak ada data yang ditemukan.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {showPagination && (
        <div className="sticky bottom-4 z-10 flex items-center justify-between gap-3 bg-background py-1.5 px-2 rounded-md">
          <div className="flex items-center gap-1.5">
            <span className="whitespace-nowrap text-[11px] text-muted-foreground">
              Baris/hal
            </span>
            <Select
              value={String(pageSize)}
              onValueChange={(value) => handlePageSizeChange(Number(value))}
            >
              <SelectTrigger className="h-7 w-[56px] bg-background text-[11px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent side="top">
                {[10, 20, 30, 50, 100].map((size) => (
                  <SelectItem
                    key={size}
                    value={String(size)}
                    className="text-[11px]"
                  >
                    {size}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-1.5">
            <div className="flex items-center gap-0.5">
              <Button
                variant="outline"
                size="icon"
                className="h-6 w-6"
                onClick={() => handlePageChange(0)}
                disabled={pageIndex <= 0}
              >
                <span className="sr-only">Halaman pertama</span>
                <ChevronsLeft className="h-3 w-3" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-6 w-6"
                onClick={() => handlePageChange(pageIndex - 1)}
                disabled={pageIndex <= 0}
              >
                <span className="sr-only">Halaman sebelumnya</span>
                <ChevronLeft className="h-3 w-3" />
              </Button>
              <span className="whitespace-nowrap px-1.5 text-[11px] tabular-nums text-muted-foreground">
                {Math.min(pageIndex + 1, totalPages)} / {totalPages}
              </span>
              <Button
                variant="outline"
                size="icon"
                className="h-6 w-6"
                onClick={() => handlePageChange(pageIndex + 1)}
                disabled={pageIndex >= maxPage}
              >
                <span className="sr-only">Halaman berikutnya</span>
                <ChevronRight className="h-3 w-3" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-6 w-6"
                onClick={() => handlePageChange(maxPage)}
                disabled={pageIndex >= maxPage}
              >
                <span className="sr-only">Halaman terakhir</span>
                <ChevronsRight className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function createSelectColumn<TData>(): ColumnDef<TData> {
  return {
    id: "select",
    header: ({ table }) => (
      <input
        type="checkbox"
        checked={table.getIsAllPageRowsSelected()}
        onChange={table.getToggleAllPageRowsSelectedHandler()}
        className="cursor-pointer"
      />
    ),
    cell: ({ row }) => (
      <input
        type="checkbox"
        checked={row.getIsSelected()}
        onChange={row.getToggleSelectedHandler()}
        className="cursor-pointer"
      />
    ),
    enableSorting: false,
    enableHiding: false,
  };
}

export { type ColumnDef } from "@tanstack/react-table";
