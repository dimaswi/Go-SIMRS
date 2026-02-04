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
import { Badge } from "@/components/ui/badge";
import { Loader2, RefreshCw, Calendar } from "lucide-react";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";

export interface SKDPData {
  noSuratKontrol: string;
  jnsPelayanan: string;       // "Rawat Inap" / "Rawat Jalan"
  jnsKontrol: string;
  namaJnsKontrol: string;
  tglRencanaKontrol: string;
  tglTerbitKontrol: string;
  noSepAsalKontrol: string;
  poliAsal: string;
  namaPoliAsal: string;
  poliTujuan: string;
  namaPoliTujuan: string;
  kodePoliTujuan: string;     // Alias untuk poliTujuan
  tglSEP: string;
  kodeDokter: string;
  namaDokter: string;
  noKartu: string;
  nama: string;
  terbitSEP: string;          // "Belum" / "Sudah"
}

interface SKDPModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  noKartu: string;
  onFetch: (bulan?: string, tahun?: string) => Promise<SKDPData[]>;
  onSelect: (skdp: SKDPData) => void;
}

export function SKDPModal({
  open,
  onOpenChange,
  noKartu,
  onFetch,
  onSelect,
}: SKDPModalProps) {
  const [loading, setLoading] = useState(false);
  const [skdpList, setSkdpList] = useState<SKDPData[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [bulan, setBulan] = useState(format(new Date(), "MM"));
  const [tahun, setTahun] = useState(format(new Date(), "yyyy"));

  // Fetch SKDP saat modal dibuka
  useEffect(() => {
    if (open && noKartu) {
      fetchSKDP();
    }
  }, [open, noKartu]);

  const fetchSKDP = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await onFetch(bulan, tahun);
      setSkdpList(data || []);
      if (!data || data.length === 0) {
        setError("Tidak ada surat kontrol untuk periode ini");
      }
    } catch (err: any) {
      setError(err.message || "Gagal mengambil data surat kontrol");
      setSkdpList([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = (skdp: SKDPData) => {
    onSelect(skdp);
    onOpenChange(false);
  };

  const handleClose = () => {
    onOpenChange(false);
    setSkdpList([]);
    setError(null);
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "-";
    try {
      return format(new Date(dateStr), "dd MMM yyyy", { locale: idLocale });
    } catch {
      return dateStr;
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-6xl max-h-[85vh] flex flex-col">
        <DialogHeader className="flex flex-row items-center justify-between">
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Daftar Surat Kontrol (SKDP) - {noKartu}
          </DialogTitle>
          <div className="flex items-center gap-2">
            <select
              value={bulan}
              onChange={(e) => setBulan(e.target.value)}
              className="border rounded px-2 py-1 text-sm"
            >
              {Array.from({ length: 12 }, (_, i) => {
                const month = String(i + 1).padStart(2, "0");
                return (
                  <option key={month} value={month}>
                    {format(new Date(2020, i, 1), "MMMM", { locale: idLocale })}
                  </option>
                );
              })}
            </select>
            <select
              value={tahun}
              onChange={(e) => setTahun(e.target.value)}
              className="border rounded px-2 py-1 text-sm"
            >
              {Array.from({ length: 5 }, (_, i) => {
                const year = String(new Date().getFullYear() - 2 + i);
                return (
                  <option key={year} value={year}>
                    {year}
                  </option>
                );
              })}
            </select>
            <Button 
              size="sm" 
              variant="outline" 
              onClick={fetchSKDP}
              disabled={loading}
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              <span className="ml-2">Cari</span>
            </Button>
          </div>
        </DialogHeader>

        <ScrollArea className="flex-1 h-[500px] border rounded-md">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[180px]">No. Surat Kontrol</TableHead>
                <TableHead className="w-[80px]">Jenis</TableHead>
                <TableHead className="w-[100px]">Tgl Kontrol</TableHead>
                <TableHead>Poli Tujuan</TableHead>
                <TableHead>Dokter</TableHead>
                <TableHead className="w-[80px]">Status</TableHead>
                <TableHead className="w-[80px]">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">Mengambil data surat kontrol...</p>
                  </TableCell>
                </TableRow>
              ) : error ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                    {error}
                  </TableCell>
                </TableRow>
              ) : skdpList.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                    Tidak ada surat kontrol
                  </TableCell>
                </TableRow>
              ) : (
                skdpList.map((skdp, idx) => (
                  <TableRow key={idx} className="cursor-pointer hover:bg-muted/50">
                    <TableCell className="font-mono text-xs">
                      {skdp.noSuratKontrol}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {skdp.jnsPelayanan === "Rawat Inap" ? "RI" : "RJ"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      {formatDate(skdp.tglRencanaKontrol)}
                    </TableCell>
                    <TableCell className="text-sm">
                      <div>
                        <span className="font-medium">{skdp.namaPoliTujuan}</span>
                        <span className="text-xs text-muted-foreground ml-1">({skdp.poliTujuan})</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">
                      {skdp.namaDokter || "-"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={skdp.terbitSEP === "Belum" ? "secondary" : "default"} className="text-xs">
                        {skdp.terbitSEP || "Belum"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant="default"
                        onClick={() => handleSelect(skdp)}
                        disabled={skdp.terbitSEP === "Sudah"}
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
      </DialogContent>
    </Dialog>
  );
}
