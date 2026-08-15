import { useState } from "react";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { Database, Loader2, Search } from "lucide-react";
import {
  BPJS_COMPACT_FIELD_CLASS,
  BPJS_ICON_BUTTON_CLASS,
  BPJSSectionHeader,
  BPJSSheetHero,
  BPJS_SHEET_MONO_FAMILY,
} from "./bpjs-sheet-chrome";

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
  renderRow?: (item: any, columns: SearchColumn[]) => React.ReactNode;
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
  renderRow,
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

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="flex max-h-[85vh] max-w-4xl flex-col gap-0 overflow-hidden rounded-none border border-border/70 p-0">
        <BPJSSheetHero
          eyebrow="Pencarian Referensi"
          title={title}
          description="Cari data bridging BPJS dan pilih hasil yang sesuai dari daftar di bawah."
          icon={Database}
        />

        <div className="flex flex-1 flex-col overflow-hidden px-6 py-4">
          <div className="shrink-0">
            <BPJSSectionHeader eyebrow="Query" title="Pencarian" />
            {/* Search Input */}
            <div className="mt-4 flex gap-2">
              <div className="flex-1">
                <Input
                  placeholder={placeholder}
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  onKeyDown={handleKeyDown}
                  autoFocus
                  className={BPJS_COMPACT_FIELD_CLASS}
                />
              </div>
              <Button 
                onClick={handleSearch} 
                disabled={loading || keyword.length < minSearchLength}
                className={BPJS_ICON_BUTTON_CLASS}
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Search className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>

          {/* Results Table */}
          <div className="mt-4 flex min-h-0 flex-col">
          <div className="max-h-[400px] overflow-y-auto rounded-md border border-border/70">
            <Table containerClassName="border-0 rounded-none">
              <TableHeader>
                <TableRow>
                  {columns.map((col) => (
                    <TableHead key={col.key} style={{ width: col.width, fontFamily: BPJS_SHEET_MONO_FAMILY }} className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground">
                      {col.label}
                    </TableHead>
                  ))}
                  <TableHead className="w-20 text-[10px] uppercase tracking-[0.24em] text-muted-foreground" style={{ fontFamily: BPJS_SHEET_MONO_FAMILY }}>Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={columns.length + 1} className="text-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                      <p className="text-sm text-muted-foreground mt-2">Mencari...</p>
                    </TableCell>
                  </TableRow>
                ) : results.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={columns.length + 1} className="h-40 text-center align-middle">
                      <Search className="h-8 w-8 text-muted-foreground/50 mx-auto mb-3" />
                      <p className="text-[15px] font-medium text-foreground">
                        {searched ? "Tidak ada data ditemukan" : "Masukkan kata kunci"}
                      </p>
                      <p className="text-[13px] text-muted-foreground mt-1">
                        {searched ? "Coba ubah kata kunci atau gunakan istilah yang lebih spesifik." : `Minimal ${minSearchLength} karakter diperlukan sebelum pencarian dijalankan.`}
                      </p>
                    </TableCell>
                  </TableRow>
                ) : renderRow ? (
                  results.map((item) => renderRow(item, columns))
                ) : (
                  results.map((item, index) => (
                    <TableRow key={index} className="cursor-pointer hover:bg-muted/50">
                      {columns.map((col) => (
                        <TableCell key={col.key}>{item[col.key] || "-"}</TableCell>
                      ))}
                      <TableCell>
                        <Button size="sm" variant="outline" className="rounded-none border-border/70" onClick={() => handleSelect(item)}>
                          Pilih
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          </div>

          {results.length > 0 && (
            <div className="mt-4 shrink-0">
              <p className="text-xs text-muted-foreground" style={{ fontFamily: BPJS_SHEET_MONO_FAMILY }}>
                Ditemukan {results.length} data. Klik "Pilih" untuk memilih.
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
