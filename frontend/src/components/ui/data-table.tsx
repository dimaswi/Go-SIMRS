"use client"

import * as React from "react"
import type {
  ColumnDef,
  ColumnFiltersState,
  SortingState,
  VisibilityState,
} from "@tanstack/react-table"
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table"
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Search } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

// Helper untuk baca pageIndex dari localStorage
function getStoredPageIndex(tableId: string): number {
  if (!tableId) return 0
  try {
    const stored = localStorage.getItem(`dt_page_${tableId}`)
    if (stored) {
      const parsed = parseInt(stored, 10)
      if (!isNaN(parsed) && parsed >= 0) return parsed
    }
  } catch { }
  return 0
}

// Helper untuk simpan pageIndex ke localStorage
function setStoredPageIndex(tableId: string, pageIndex: number) {
  if (!tableId) return
  try {
    localStorage.setItem(`dt_page_${tableId}`, String(pageIndex))
  } catch { }
}

// Helper untuk baca pageSize dari localStorage
function getStoredPageSize(tableId: string, defaultSize: number): number {
  if (!tableId) return defaultSize
  try {
    const stored = localStorage.getItem(`dt_size_${tableId}`)
    if (stored) {
      const parsed = parseInt(stored, 10)
      if (!isNaN(parsed) && parsed > 0) return parsed
    }
  } catch { }
  return defaultSize
}

// Helper untuk simpan pageSize ke localStorage
function setStoredPageSize(tableId: string, pageSize: number) {
  if (!tableId) return
  try {
    localStorage.setItem(`dt_size_${tableId}`, String(pageSize))
  } catch { }
}

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[]
  data: TData[]
  searchPlaceholder?: string
  showColumnVisibility?: boolean
  showPagination?: boolean
  showSearch?: boolean
  pageSize?: number
  meta?: Record<string, unknown>
  // ID untuk persist pagination - jika diberikan, pagination akan disimpan ke localStorage
  tableId?: string
  // Initial sorting state
  initialSorting?: SortingState
  // Initial column visibility
  initialColumnVisibility?: VisibilityState
  // Legacy props untuk backward compatibility
  pageIndex?: number
  onPageIndexChange?: (pageIndex: number) => void
  // Extra element rendered inline with the search input (e.g. room filter)
  searchSlot?: React.ReactNode
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
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = React.useState<SortingState>(initialSorting)
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([])
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>(initialColumnVisibility)
  const [rowSelection, setRowSelection] = React.useState({})

  // State untuk globalFilter - initialize dari localStorage jika ada tableId
  const [globalFilter, setGlobalFilter] = React.useState<string>(() => {
    if (tableId) {
      try {
        const stored = localStorage.getItem(`dt_search_${tableId}`)
        return stored || ""
      } catch { }
    }
    return ""
  })

  // State untuk pageSize - initialize dari localStorage jika ada tableId
  const [pageSize, setPageSize] = React.useState(() => {
    if (tableId) {
      return getStoredPageSize(tableId, defaultPageSize)
    }
    return defaultPageSize
  })

  // State untuk pageIndex - initialize dari localStorage jika ada tableId
  const [internalPageIndex, setInternalPageIndex] = React.useState(() => {
    if (tableId) {
      return getStoredPageIndex(tableId)
    }
    return 0
  })

  // Save search filter to localStorage when it changes
  React.useEffect(() => {
    if (tableId) {
      try {
        localStorage.setItem(`dt_search_${tableId}`, globalFilter)
      } catch { }
    }
  }, [globalFilter, tableId])

  // Determine the actual pageIndex to use
  const rawPageIndex = controlledPageIndex ?? internalPageIndex

  // Validate pageIndex doesn't exceed available pages
  // Only validate if we have data - don't reset to 0 when data is empty (loading state)
  const totalPages = Math.ceil(data.length / pageSize)
  const maxPage = Math.max(0, totalPages - 1)
  const pageIndex = data.length > 0 ? Math.min(rawPageIndex, maxPage) : rawPageIndex

  // Handle page change
  const handlePageChange = React.useCallback((newPageIndex: number) => {
    // Simpan ke localStorage jika ada tableId
    if (tableId) {
      setStoredPageIndex(tableId, newPageIndex)
    }

    // Update state
    if (onPageIndexChange) {
      onPageIndexChange(newPageIndex)
    } else {
      setInternalPageIndex(newPageIndex)
    }
  }, [tableId, onPageIndexChange])

  // Handle page size change - reset to page 0 and persist
  const handlePageSizeChange = React.useCallback((newSize: number) => {
    setPageSize(newSize)
    if (tableId) {
      setStoredPageSize(tableId, newSize)
    }
    handlePageChange(0)
  }, [handlePageChange, tableId])

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
    globalFilterFn: "includesString",
    meta,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
      globalFilter,
      pagination: { pageIndex, pageSize },
    },
  })

  return (
    <div className="flex flex-col flex-1 w-full bg-background">
      {/* Search and Controls Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-0 py-3 bg-card">
        <div className="flex items-center gap-2 flex-1">
          {showSearch && (
            <div className="relative w-full max-w-sm">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={searchPlaceholder}
                value={globalFilter ?? ""}
                onChange={(event) => setGlobalFilter(event.target.value)}
                className="pl-9 h-9 w-full bg-background transition-colors focus-visible:ring-1"
              />
            </div>
          )}
          {searchSlot}
        </div>
      </div>

      {/* Table Area */}
      <div className="w-full overflow-auto" style={{ maxHeight: 'calc(100vh - 280px)' }}>
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="hover:bg-transparent">
                {headerGroup.headers.map((header) => {
                  return (
                    <TableHead
                      key={header.id}
                      className="sticky top-0 bg-slate-50 dark:bg-slate-900/95 z-10 shadow-[0_1px_0_0_hsl(var(--border))]"
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                    </TableHead>
                  )
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center text-muted-foreground"
                >
                  Tidak ada data.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {showPagination && (
        <div className="flex items-center justify-between px-0 py-3 bg-background">
          <div className="flex items-center space-x-2">
            <p className="text-sm text-muted-foreground">Baris per halaman</p>
            <Select
              value={String(pageSize)}
              onValueChange={(value) => handlePageSizeChange(Number(value))}
            >
              <SelectTrigger className="h-8 w-[70px] bg-background">
                <SelectValue placeholder={String(pageSize)} />
              </SelectTrigger>
              <SelectContent side="top">
                {[5, 10, 20, 30, 50, 100].map((size) => (
                  <SelectItem key={size} value={String(size)}>
                    {size}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center space-x-4 lg:space-x-6">
            <div className="flex items-center justify-center text-sm font-medium text-muted-foreground">
              Total {data.length} baris
            </div>
            <div className="flex items-center justify-center text-sm font-medium text-muted-foreground hidden sm:flex">
              Halaman {pageIndex + 1} dari {Math.max(1, totalPages)}
            </div>
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                className="hidden h-8 w-8 p-0 lg:flex bg-background"
                onClick={() => handlePageChange(0)}
                disabled={pageIndex === 0}
              >
                <span className="sr-only">Go to first page</span>
                <ChevronsLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                className="h-8 w-8 p-0 bg-background"
                onClick={() => handlePageChange(pageIndex - 1)}
                disabled={pageIndex === 0}
              >
                <span className="sr-only">Go to previous page</span>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                className="h-8 w-8 p-0 bg-background"
                onClick={() => handlePageChange(pageIndex + 1)}
                disabled={pageIndex >= maxPage}
              >
                <span className="sr-only">Go to next page</span>
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                className="hidden h-8 w-8 p-0 lg:flex bg-background"
                onClick={() => handlePageChange(maxPage)}
                disabled={pageIndex >= maxPage}
              >
                <span className="sr-only">Go to last page</span>
                <ChevronsRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Helper function untuk membuat select column (checkbox)
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
  }
}

export { type ColumnDef } from "@tanstack/react-table"
