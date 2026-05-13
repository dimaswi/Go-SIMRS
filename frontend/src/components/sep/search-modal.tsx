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
import { ScrollArea } from "@/components/ui/scroll-area";
import { Database, Loader2, Search } from "lucide-react";
import {
  BPJS_COMPACT_FIELD_CLASS,
  BPJS_ICON_BUTTON_CLASS,
  BPJSSectionHeader,
  BPJSSheetHero,
  BPJSStatePanel,
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

        <div className="space-y-4 px-6 py-4">
          <BPJSSectionHeader eyebrow="Query" title="Pencarian" />
          {/* Search Input */}
          <div className="flex gap-2">
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

          {/* Results Table */}
          <ScrollArea className="h-[400px] border border-border/70">
            <Table>
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
                    <TableCell colSpan={columns.length + 1} className="p-0">
                      <BPJSStatePanel
                        title={searched ? "Tidak ada data ditemukan" : "Masukkan kata kunci untuk mulai mencari"}
                        description={searched ? "Coba ubah kata kunci atau gunakan istilah yang lebih spesifik." : `Minimal ${minSearchLength} karakter diperlukan sebelum pencarian dijalankan.`}
                        className="border-0"
                      />
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
          </ScrollArea>

          {results.length > 0 && (
            <p className="text-xs text-muted-foreground" style={{ fontFamily: BPJS_SHEET_MONO_FAMILY }}>
              Ditemukan {results.length} data. Klik "Pilih" untuk memilih.
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
