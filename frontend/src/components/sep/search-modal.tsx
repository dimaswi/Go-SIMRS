import { useState } from "react";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DataTable } from "@/components/ui/data-table";
import { type ColumnDef } from "@/components/ui/data-table-utils";
import { Database, Loader2, Search } from "lucide-react";

export interface SearchColumn {
  key: string;
  label: string;
  width?: string;
}

export interface SearchModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  placeholder?: string;
  columns: SearchColumn[];
  onSearch: (keyword: string) => Promise<any[]>;
  onSelect: (item: any) => void;
  minSearchLength?: number;
}

export function SearchModal({
  open,
  onOpenChange,
  title,
  placeholder = "Ketik untuk mencari...",
  columns,
  onSearch,
  onSelect,
  minSearchLength = 2,
}: SearchModalProps) {
  const [keyword, setKeyword] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [searched, setSearched] = useState(false);

  const handleSearch = async () => {
    if (keyword.length < minSearchLength) return;

    setLoading(true);
    setSearched(true);
    try {
      const data = await onSearch(keyword);
      setResults(data || []);
    } catch (error) {
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = (item: any) => {
    onSelect(item);
    onOpenChange(false);
    setKeyword("");
    setResults([]);
    setSearched(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSearch();
    }
  };

  const handleClose = () => {
    onOpenChange(false);
    setKeyword("");
    setResults([]);
    setSearched(false);
  };

  const tableColumns: ColumnDef<any>[] = [
    ...columns.map((col): ColumnDef<any> => ({
      id: col.key,
      accessorFn: (row) => (row?.[col.key] != null ? String(row[col.key]) : ""),
      header: () => <span className="text-[11px] font-semibold uppercase tracking-wider">{col.label}</span>,
      cell: ({ row }) => (
        <span className="text-xs">{row.original?.[col.key] || "-"}</span>
      ),
    })),
    {
      id: "actions",
      header: () => <span className="text-[11px] font-semibold uppercase tracking-wider">Aksi</span>,
      cell: ({ row }) => (
        <Button size="sm" variant="outline" className="h-7 px-2.5 text-xs" onClick={() => handleSelect(row.original)}>
          Pilih
        </Button>
      ),
    },
  ];

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="flex max-h-[85vh] max-w-4xl flex-col gap-0 overflow-hidden p-0">
        <div className="flex items-center gap-3 border-b bg-neutral-50/40 dark:bg-neutral-900/20 px-5 py-3.5 pr-12">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center border border-neutral-200 dark:border-neutral-800 bg-background">
            <Database className="h-4 w-4 text-foreground" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-foreground">{title}</h3>
            <p className="text-xs text-muted-foreground">Cari data bridging BPJS dan pilih hasil yang sesuai.</p>
          </div>
        </div>

        <div className="flex items-center gap-2 border-b px-5 py-3 bg-background">
          <Input
            placeholder={placeholder}
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            onKeyDown={handleKeyDown}
            autoFocus
            className="h-8 flex-1 text-xs"
          />
          <Button
            onClick={handleSearch}
            disabled={loading || keyword.length < minSearchLength}
            size="sm"
            className="h-8 px-3 text-xs shrink-0"
          >
            {loading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
            ) : (
              <Search className="h-3.5 w-3.5 mr-1.5" />
            )}
            Cari
          </Button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-14">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              <p className="text-xs text-muted-foreground mt-2">Mencari data referensi...</p>
            </div>
          ) : !searched && results.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-14 text-center px-4">
              <Search className="h-7 w-7 text-muted-foreground/40 mb-2" />
              <p className="text-sm font-medium text-foreground">Masukkan kata kunci</p>
              <p className="text-xs text-muted-foreground mt-1">
                Minimal {minSearchLength} karakter diperlukan sebelum pencarian dijalankan.
              </p>
            </div>
          ) : (
            <DataTable
              columns={tableColumns}
              data={results}
              searchPlaceholder="Filter hasil pencarian..."
              pageSize={10}
              hideRowCount
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
