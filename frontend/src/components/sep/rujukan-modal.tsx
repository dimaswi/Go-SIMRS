import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CalendarDays, ChevronRight, Loader2, MapPin, RefreshCw, ShieldCheck } from "lucide-react";
import {
  BPJS_MUTED_PANEL_CLASS,
  BPJS_PANEL_CLASS,
  BPJSSectionHeader,
  BPJSSheetHero,
  BPJSStatePanel,
  BPJS_SHEET_MONO_FAMILY,
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

        <div className="border-b border-border/70 px-6 py-3">
          <BPJSSectionHeader
            eyebrow="Selection"
            title="Rujukan Aktif"
            action={
              rujukanList.length > 0 ? (
                <Badge variant="outline" className="rounded-none text-[10px] uppercase tracking-[0.18em]" style={{ fontFamily: BPJS_SHEET_MONO_FAMILY }}>
                  {rujukanList.length} data
                </Badge>
              ) : null
            }
          />
        </div>

        <ScrollArea className="flex-1 px-6 py-4">
          <div className="space-y-3">
            {loading ? (
              <BPJSStatePanel
                icon={<Loader2 className="h-4 w-4 animate-spin" />}
                title="Mengambil data rujukan..."
                description="Sistem sedang mengambil daftar rujukan aktif peserta dari BPJS."
              />
            ) : error ? (
              <BPJSStatePanel tone="danger" title="Data rujukan tidak tersedia" description={error} />
            ) : rujukanList.length === 0 ? (
              <BPJSStatePanel title="Tidak ada rujukan aktif" description="Belum ada rujukan yang bisa dipilih untuk peserta ini." />
            ) : (
              rujukanList.map((rujukan) => (
                <div key={rujukan.noKunjungan} className={`${BPJS_PANEL_CLASS} overflow-hidden`}>
                  <div className="grid gap-px bg-border/70 lg:grid-cols-[1.2fr_0.8fr_1.1fr_1fr_auto]">
                    <div className="space-y-3 bg-background px-4 py-4">
                      <div className="space-y-1">
                        <div className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground" style={{ fontFamily: BPJS_SHEET_MONO_FAMILY }}>
                          No. Rujukan
                        </div>
                        <div className="font-mono text-xs font-semibold text-foreground">{rujukan.noKunjungan}</div>
                      </div>
                      <div className="space-y-1 text-sm">
                        <div className="font-medium text-foreground">{rujukan.diagnosa?.kode || "-"}</div>
                        <div className="text-xs leading-relaxed text-muted-foreground">{rujukan.diagnosa?.nama || "Diagnosa tidak tersedia"}</div>
                      </div>
                    </div>

                    <div className="space-y-3 bg-background px-4 py-4">
                      <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                        <CalendarDays className="h-4 w-4 text-muted-foreground" />
                        {rujukan.tglKunjungan}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Berlaku s/d {rujukan.tglRujukanBerakhir || "-"}
                      </div>
                    </div>

                    <div className="space-y-1 bg-background px-4 py-4">
                      <div className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground" style={{ fontFamily: BPJS_SHEET_MONO_FAMILY }}>
                        Poli Rujukan
                      </div>
                      <div className="text-sm font-medium text-foreground">{rujukan.poliRujukan?.nama || "-"}</div>
                    </div>

                    <div className="space-y-1 bg-background px-4 py-4">
                      <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.24em] text-muted-foreground" style={{ fontFamily: BPJS_SHEET_MONO_FAMILY }}>
                        <MapPin className="h-3.5 w-3.5" />
                        PPK Perujuk
                      </div>
                      <div className="text-sm font-medium text-foreground">{rujukan.provPerujuk?.nama || "-"}</div>
                    </div>

                    <div className={`${BPJS_MUTED_PANEL_CLASS} flex items-center justify-end border-0 px-4 py-4`}>
                      <Button size="sm" variant="outline" className="rounded-none border-border/70" onClick={() => handleSelect(rujukan)}>
                        Pilih
                        <ChevronRight className="ml-1 h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))
            )}
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
