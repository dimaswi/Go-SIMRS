import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, RefreshCw } from "lucide-react";

export interface RujukanData {
  noKunjungan: string;
  tglKunjungan: string;
  provPerujuk: {
    kode: string;
    nama: string;
  };
  diagnosa: {
    kode: string;
    nama: string;
  };
  keluhan?: string;
  poliRujukan: {
    kode: string;
    nama: string;
  };
  pelayanan?: {
    kode: string;
    nama: string;
  };
  tglRujukanBerakhir?: string;
}

interface RujukanModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  noKartu: string;
  onFetch: () => Promise<RujukanData[]>;
  onSelect: (rujukan: RujukanData) => void;
}

export function RujukanModal({
  open,
  onOpenChange,
  noKartu,
  onFetch,
  onSelect,
}: RujukanModalProps) {
  const [loading, setLoading] = useState(false);
  const [rujukanList, setRujukanList] = useState<RujukanData[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Fetch rujukan saat modal dibuka
  useEffect(() => {
    if (open && noKartu) {
      fetchRujukan();
    }
  }, [open, noKartu]);

  const fetchRujukan = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await onFetch();
      setRujukanList(data || []);
      if (!data || data.length === 0) {
        setError("Tidak ada rujukan aktif untuk peserta ini");
      }
    } catch (err: any) {
      setError(err.message || "Gagal mengambil data rujukan");
      setRujukanList([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = (rujukan: RujukanData) => {
    onSelect(rujukan);
    onOpenChange(false);
  };

  const handleClose = () => {
    onOpenChange(false);
    setRujukanList([]);
    setError(null);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-5xl max-h-[85vh] flex flex-col">
        <DialogHeader className="flex flex-row items-center justify-between">
          <DialogTitle>
            Daftar Rujukan - {noKartu}
          </DialogTitle>
          <Button 
            size="sm" 
            variant="outline" 
            onClick={fetchRujukan}
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            <span className="ml-2">Refresh</span>
          </Button>
        </DialogHeader>

        <ScrollArea className="flex-1 h-[500px] border rounded-md">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[180px]">No. Rujukan</TableHead>
                <TableHead className="w-[100px]">Tanggal</TableHead>
                <TableHead className="w-[100px]">Berlaku s/d</TableHead>
                <TableHead>Diagnosa</TableHead>
                <TableHead className="w-[120px]">Poli Rujukan</TableHead>
                <TableHead>PPK Perujuk</TableHead>
                <TableHead className="w-[80px]">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">Mengambil data rujukan...</p>
                  </TableCell>
                </TableRow>
              ) : error ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                    {error}
                  </TableCell>
                </TableRow>
              ) : rujukanList.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                    Tidak ada rujukan aktif
                  </TableCell>
                </TableRow>
              ) : (
                rujukanList.map((rujukan) => (
                  <TableRow key={rujukan.noKunjungan} className="cursor-pointer hover:bg-muted/50">
                    <TableCell className="font-mono text-xs">{rujukan.noKunjungan}</TableCell>
                    <TableCell>{rujukan.tglKunjungan}</TableCell>
                    <TableCell>{rujukan.tglRujukanBerakhir || "-"}</TableCell>
                    <TableCell>
                      <div>
                        <span className="font-medium">{rujukan.diagnosa?.kode || "-"}</span>
                        <br />
                        <span className="text-xs text-muted-foreground">{rujukan.diagnosa?.nama || ""}</span>
                      </div>
                    </TableCell>
                    <TableCell>{rujukan.poliRujukan?.nama || "-"}</TableCell>
                    <TableCell>{rujukan.provPerujuk?.nama || "-"}</TableCell>
                    <TableCell>
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => handleSelect(rujukan)}
                      >
                        Pilih
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </ScrollArea>

        {rujukanList.length > 0 && (
          <p className="text-xs text-muted-foreground mt-2">
            Ditemukan {rujukanList.length} rujukan aktif
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
