"use client"

import * as React from "react"
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react"
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

export interface SimpleColumn<T> {
  key: string
  header: string | React.ReactNode
  cell: (row: T) => React.ReactNode
  searchable?: boolean
}

interface SimpleTableProps<T> {
  columns: SimpleColumn<T>[]
  data: T[]
  searchPlaceholder?: string
  pageSize?: number
  storageKey?: string
}

export function SimpleTable<T>({
  columns,
  data,
  searchPlaceholder = "Cari...",
  pageSize: initialPageSize = 10,
  storageKey,
}: SimpleTableProps<T>) {
  // Initialize state from localStorage
  const [currentPage, setCurrentPage] = React.useState(() => {
    if (storageKey) {
      try {
        const saved = localStorage.getItem(`${storageKey}_page`)
        if (saved) {
          const parsed = parseInt(saved, 10)
          if (!isNaN(parsed) && parsed >= 0) {
            return parsed
          }
        }
      } catch { }
    }
    return 0
  })

  const [pageSize, setPageSize] = React.useState(() => {
    if (storageKey) {
      try {
        const saved = localStorage.getItem(`${storageKey}_size`)
        if (saved) {
          const parsed = parseInt(saved, 10)
          if (!isNaN(parsed) && parsed > 0) {
            return parsed
          }
        }
      } catch { }
    }
    return initialPageSize
  })

  const [searchTerm, setSearchTerm] = React.useState("")

  // Filter data based on search
  const filteredData = React.useMemo(() => {
    if (!searchTerm.trim()) return data

    const lowerSearch = searchTerm.toLowerCase()
    return data.filter((row) => {
      // Search through all searchable columns
      return columns.some((col) => {
        if (col.searchable === false) return false
        const cellContent = col.cell(row)
        if (typeof cellContent === 'string') {
          return cellContent.toLowerCase().includes(lowerSearch)
        }
        if (typeof cellContent === 'number') {
          return cellContent.toString().includes(lowerSearch)
        }
        // For React elements, we can't easily search, skip
        return false
      })
    })
  }, [data, searchTerm, columns])

  // Calculate pagination
  const totalPages = Math.ceil(filteredData.length / pageSize)
  const validCurrentPage = Math.min(currentPage, Math.max(0, totalPages - 1))

  // Update if page is out of bounds
  React.useEffect(() => {
    if (currentPage !== validCurrentPage && validCurrentPage >= 0) {
      setCurrentPage(validCurrentPage)
    }
  }, [currentPage, validCurrentPage])

  const startIndex = validCurrentPage * pageSize
  const endIndex = startIndex + pageSize
  const paginatedData = filteredData.slice(startIndex, endIndex)

  // Save to localStorage when page changes
  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage)
    if (storageKey) {
      try {
        localStorage.setItem(`${storageKey}_page`, String(newPage))
      } catch { }
    }
  }

  const handlePageSizeChange = (newSize: string) => {
    const size = parseInt(newSize, 10)
    setPageSize(size)
    setCurrentPage(0)
    if (storageKey) {
      try {
        localStorage.setItem(`${storageKey}_size`, newSize)
        localStorage.setItem(`${storageKey}_page`, '0')
      } catch { }
    }
  }

  // Reset page when search changes
  React.useEffect(() => {
    if (searchTerm) {
      setCurrentPage(0)
      if (storageKey) {
        try {
          localStorage.setItem(`${storageKey}_page`, '0')
        } catch { }
      }
    }
  }, [searchTerm, storageKey])

  return (
    <div className="w-full flex flex-col gap-0">
      {/* Search */}
      <div className="flex items-center py-3">
        <Input
          placeholder={searchPlaceholder}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="max-w-sm h-8 text-sm"
        />
      </div>

      {/* Table */}
      <div>
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((column) => (
                <TableHead key={column.key}>{column.header}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedData.length > 0 ? (
              paginatedData.map((row, rowIndex) => (
                <TableRow key={rowIndex}>
                  {columns.map((column) => (
                    <TableCell key={column.key}>{column.cell(row)}</TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-32 text-center text-sm text-muted-foreground">
                  Tidak ada data yang ditemukan.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="sticky bottom-0 z-10 flex items-center justify-between gap-3 bg-background py-1.5">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Baris/hal</span>
          <Select value={String(pageSize)} onValueChange={handlePageSizeChange}>
            <SelectTrigger className="h-7 w-[60px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="5" className="text-xs">5</SelectItem>
              <SelectItem value="10" className="text-xs">10</SelectItem>
              <SelectItem value="20" className="text-xs">20</SelectItem>
              <SelectItem value="50" className="text-xs">50</SelectItem>
              <SelectItem value="100" className="text-xs">100</SelectItem>
            </SelectContent>
          </Select>
          <span className="text-xs text-muted-foreground">
            Total {filteredData.length.toLocaleString("id-ID")} baris
          </span>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground hidden sm:inline">
            Hal. {validCurrentPage + 1} / {Math.max(1, totalPages)}
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7"
              onClick={() => handlePageChange(0)}
              disabled={validCurrentPage === 0}
            >
              <ChevronsLeft className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7"
              onClick={() => handlePageChange(validCurrentPage - 1)}
              disabled={validCurrentPage === 0}
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7"
              onClick={() => handlePageChange(validCurrentPage + 1)}
              disabled={validCurrentPage >= totalPages - 1}
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7"
              onClick={() => handlePageChange(totalPages - 1)}
              disabled={validCurrentPage >= totalPages - 1}
            >
              <ChevronsRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
