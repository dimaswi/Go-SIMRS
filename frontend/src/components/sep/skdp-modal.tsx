import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
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
import { Loader2, RefreshCw, Calendar, CalendarDays, ClipboardList } from "lucide-react";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { cn } from "@/lib/utils";
import {
  BPJSSectionHeader,
  BPJSSheetHero,
} from "./bpjs-sheet-chrome";

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
      <DialogContent className="flex max-h-[85vh] max-w-5xl flex-col gap-0 overflow-hidden rounded-none border border-border/70 p-0">
        <BPJSSheetHero
          eyebrow="Bridging BPJS"
          title="Daftar Surat Kontrol (SKDP)"
          description={<><span className="font-medium">Peserta</span> • <span className="font-mono text-xs">{noKartu}</span></>}
          icon={Calendar}
          meta={
            <div className="flex items-center gap-2">
              <select
                value={bulan}
                onChange={(e) => setBulan(e.target.value)}
                className="h-8 rounded-none border border-border/70 bg-background px-2 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
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
                className="h-8 rounded-none border border-border/70 bg-background px-2 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
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
                className="h-8 rounded-none border-border/70 px-3"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                <span className="ml-2">Cari</span>
              </Button>
            </div>
          }
        />

        <ScrollArea className="flex-1">
          <div className="space-y-4 p-6">
            <BPJSSectionHeader
              eyebrow="Selection"
              title="Surat Kontrol"
            />

            <div className="mt-4 flex min-h-0 flex-col">
              <div className="max-h-[400px] overflow-y-auto rounded-md border border-border/70">
                <Table containerClassName="border-0 rounded-none">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[200px] whitespace-nowrap">No. Surat Kontrol</TableHead>
                      <TableHead className="w-[70px]">Jenis</TableHead>
                      <TableHead className="w-[120px] whitespace-nowrap">Tgl. Kontrol</TableHead>
                      <TableHead className="min-w-[150px]">Poli Tujuan</TableHead>
                      <TableHead className="min-w-[180px]">Dokter</TableHead>
                      <TableHead className="w-[80px]">Status</TableHead>
                      <TableHead className="w-[80px] text-right"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading && (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-12">
                          <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                          <p className="text-[15px] font-medium text-foreground mt-3">Mengambil data surat kontrol...</p>
                          <p className="text-[13px] text-muted-foreground mt-1">Sistem sedang mengambil daftar surat kontrol dari BPJS.</p>
                        </TableCell>
                      </TableRow>
                    )}

                    {!loading && error && (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-12">
                          <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10">
                            <ClipboardList className="h-5 w-5 text-destructive" />
                          </div>
                          <p className="text-[15px] font-medium text-destructive">Data surat kontrol tidak tersedia</p>
                          <p className="text-[13px] text-muted-foreground mt-1">{error}</p>
                        </TableCell>
                      </TableRow>
                    )}

                    {!loading && !error && skdpList.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-12">
                          <ClipboardList className="h-8 w-8 text-muted-foreground/30 mx-auto mb-3" />
                          <p className="text-[15px] font-medium text-foreground">Tidak ada surat kontrol</p>
                          <p className="text-[13px] text-muted-foreground mt-1">Belum ada surat kontrol yang bisa dipilih untuk periode ini.</p>
                        </TableCell>
                      </TableRow>
                    )}

                    {!loading && !error && skdpList.length > 0 && skdpList.map((skdp, idx) => (
                      <TableRow key={idx} className={cn("cursor-pointer hover:bg-muted/50", skdp.terbitSEP === "Sudah" && "opacity-60")} onClick={() => skdp.terbitSEP !== "Sudah" && handleSelect(skdp)}>
                        <TableCell className="whitespace-nowrap">
                          <div className="text-sm font-semibold text-foreground tracking-tight">{skdp.noSuratKontrol}</div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-[10px] rounded-none whitespace-nowrap">
                            {skdp.jnsPelayanan === "Rawat Inap" ? "RI" : "RJ"}
                          </Badge>
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          <div className="flex items-center gap-1.5 text-xs font-medium text-foreground">
                            <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
                            {formatDate(skdp.tglRencanaKontrol)}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm font-medium text-foreground">
                            {skdp.namaPoliTujuan} {skdp.poliTujuan && skdp.poliTujuan !== "-" && <span className="text-xs text-muted-foreground ml-1">({skdp.poliTujuan})</span>}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm font-medium text-foreground">{skdp.namaDokter || "-"}</div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={cn(
                              "text-[10px] rounded-none whitespace-nowrap border-0",
                              skdp.terbitSEP === "Belum" || !skdp.terbitSEP
                                ? "bg-emerald-500/15 text-emerald-700"
                                : "bg-destructive/15 text-destructive"
                            )}
                          >
                            {skdp.terbitSEP || "Belum"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            className="rounded-none border-border/70"
                            onClick={(e) => { e.stopPropagation(); handleSelect(skdp); }}
                            disabled={skdp.terbitSEP === "Sudah"}
                          >
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

        {skdpList.length > 0 && (
          <p className="border-t border-border/70 px-6 py-3 text-xs text-muted-foreground">
            Ditemukan {skdpList.length} surat kontrol pada periode terpilih
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
