import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CalendarDays, Loader2, RefreshCw, ShieldCheck } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  BPJSSectionHeader,
  BPJSSheetHero,
} from "./bpjs-sheet-chrome";

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
      <DialogContent className="flex max-h-[85vh] max-w-5xl flex-col gap-0 overflow-hidden rounded-none border border-border/70 p-0">
        <BPJSSheetHero
          eyebrow="Bridging BPJS"
          title="Daftar Rujukan"
          description={<><span className="font-medium">Peserta</span> • <span className="font-mono text-xs">{noKartu}</span></>}
          icon={ShieldCheck}
          meta={
            <Button
              size="sm"
              variant="outline"
              onClick={fetchRujukan}
              disabled={loading}
              className="h-8 rounded-none border-border/70 px-3"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              <span className="ml-2">Refresh</span>
            </Button>
          }
        />

        <ScrollArea className="flex-1">
          <div className="space-y-4 p-6">
            <BPJSSectionHeader
              eyebrow="Selection"
              title="Rujukan Aktif"
            />

            <div className="mt-4 flex min-h-0 flex-col">
              <div className="max-h-[400px] overflow-y-auto rounded-md border border-border/70">
                <Table containerClassName="border-0 rounded-none">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[130px]">No. Rujukan</TableHead>
                      <TableHead>Diagnosa</TableHead>
                      <TableHead className="w-[110px]">Tanggal</TableHead>
                      <TableHead className="w-[100px]">Poli</TableHead>
                      <TableHead>Faskes</TableHead>
                      <TableHead className="w-[70px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-12">
                          <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                          <p className="text-[15px] font-medium text-foreground mt-3">Mengambil data rujukan...</p>
                          <p className="text-[13px] text-muted-foreground mt-1">Sistem sedang mengambil daftar rujukan aktif peserta dari BPJS.</p>
                        </TableCell>
                      </TableRow>
                    )}
                    
                    {!loading && error && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-12">
                          <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10">
                            <ShieldCheck className="h-5 w-5 text-destructive" />
                          </div>
                          <p className="text-[15px] font-medium text-destructive">Data rujukan tidak tersedia</p>
                          <p className="text-[13px] text-muted-foreground mt-1">{error}</p>
                        </TableCell>
                      </TableRow>
                    )}
                    
                    {!loading && !error && rujukanList.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-12">
                          <ShieldCheck className="h-8 w-8 text-muted-foreground/30 mx-auto mb-3" />
                          <p className="text-[15px] font-medium text-foreground">Tidak ada rujukan aktif</p>
                          <p className="text-[13px] text-muted-foreground mt-1">Belum ada rujukan yang bisa dipilih untuk peserta ini.</p>
                        </TableCell>
                      </TableRow>
                    )}
                    
                    {!loading && !error && rujukanList.length > 0 && rujukanList.map((rujukan) => (
                      <TableRow key={rujukan.noKunjungan} className="cursor-pointer hover:bg-muted/50" onClick={() => handleSelect(rujukan)}>
                        <TableCell>
                          <div className="font-mono text-xs font-semibold text-foreground">{rujukan.noKunjungan}</div>
                        </TableCell>
                        <TableCell>
                          <div className="text-xs text-muted-foreground">
                            <span className="font-medium text-foreground">{rujukan.diagnosa?.kode || "-"}</span> - {rujukan.diagnosa?.nama || "Diagnosa tidak tersedia"}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <div className="flex items-center gap-1.5 text-xs font-medium text-foreground">
                              <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
                              {rujukan.tglKunjungan}
                            </div>
                            <div className="text-[11px] text-muted-foreground">
                              s/d {rujukan.tglRujukanBerakhir || "-"}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm font-medium text-foreground">{rujukan.poliRujukan?.nama || "-"}</div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm font-medium text-foreground">{rujukan.provPerujuk?.nama || "-"}</div>
                        </TableCell>
                        <TableCell>
                          <Button size="sm" variant="outline" className="rounded-none border-border/70" onClick={(e) => { e.stopPropagation(); handleSelect(rujukan); }}>
                            Pilih
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>
        </ScrollArea>

        {rujukanList.length > 0 && (
          <p className="border-t border-border/70 px-6 py-3 text-xs text-muted-foreground">
            Ditemukan {rujukanList.length} rujukan aktif
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
