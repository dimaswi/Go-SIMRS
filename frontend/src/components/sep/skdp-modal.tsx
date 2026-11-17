import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { type ColumnDef } from "@/components/ui/data-table-utils";
import { Badge } from "@/components/ui/badge";
import { Loader2, RefreshCw, Calendar, CalendarDays, ClipboardList } from "lucide-react";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { cn } from "@/lib/utils";

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

  const columns: ColumnDef<SKDPData>[] = [
    {
      id: "noSuratKontrol",
      accessorFn: (row) => row.noSuratKontrol || "",
      header: () => <span className="text-[11px] font-semibold uppercase tracking-wider">No. Surat Kontrol</span>,
      cell: ({ row }) => <span className="font-mono text-xs font-semibold">{row.original.noSuratKontrol}</span>,
    },
    {
      id: "jenis",
      accessorFn: (row) => row.jnsPelayanan || "",
      header: () => <span className="text-[11px] font-semibold uppercase tracking-wider">Jenis</span>,
      cell: ({ row }) => (
        <Badge variant="outline" className="text-[10px]">
          {row.original.jnsPelayanan === "Rawat Inap" ? "RI" : "RJ"}
        </Badge>
      ),
    },
    {
      id: "tglRencanaKontrol",
      accessorFn: (row) => row.tglRencanaKontrol || "",
      header: () => <span className="text-[11px] font-semibold uppercase tracking-wider">Tgl. Kontrol</span>,
      cell: ({ row }) => (
        <div className="flex items-center gap-1 text-xs font-medium">
          <CalendarDays className="h-3 w-3 text-muted-foreground" />
          {formatDate(row.original.tglRencanaKontrol)}
        </div>
      ),
    },
    {
      id: "poliTujuan",
      accessorFn: (row) => `${row.namaPoliTujuan || ""} ${row.poliTujuan || ""}`,
      header: () => <span className="text-[11px] font-semibold uppercase tracking-wider">Poli Tujuan</span>,
      cell: ({ row }) => (
        <span className="text-xs font-medium">
          {row.original.namaPoliTujuan}
          {row.original.poliTujuan && row.original.poliTujuan !== "-" && (
            <span className="text-muted-foreground ml-1">({row.original.poliTujuan})</span>
          )}
        </span>
      ),
    },
    {
      id: "namaDokter",
      accessorFn: (row) => row.namaDokter || "",
      header: () => <span className="text-[11px] font-semibold uppercase tracking-wider">Dokter</span>,
      cell: ({ row }) => <span className="text-xs">{row.original.namaDokter || "-"}</span>,
    },
    {
      id: "terbitSEP",
      accessorFn: (row) => row.terbitSEP || "Belum",
      header: () => <span className="text-[11px] font-semibold uppercase tracking-wider">Status</span>,
      cell: ({ row }) => {
        const isBelum = row.original.terbitSEP === "Belum" || !row.original.terbitSEP;
        return (
          <Badge
            variant="outline"
            className={cn(
              "text-[10px] border-0",
              isBelum ? "bg-emerald-500/15 text-emerald-700" : "bg-destructive/15 text-destructive"
            )}
          >
            {row.original.terbitSEP || "Belum"}
          </Badge>
        );
      },
    },
    {
      id: "actions",
      header: () => <span className="text-[11px] font-semibold uppercase tracking-wider">Aksi</span>,
      cell: ({ row }) => (
        <Button
          size="sm"
          variant="outline"
          className="h-7 px-2.5 text-xs"
          onClick={() => handleSelect(row.original)}
          disabled={row.original.terbitSEP === "Sudah"}
        >
          Pilih
        </Button>
      ),
    },
  ];

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="flex max-h-[85vh] max-w-5xl flex-col gap-0 overflow-hidden p-0">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-neutral-50/40 dark:bg-neutral-900/20 px-5 py-3.5 pr-12">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center border border-neutral-200 dark:border-neutral-800 bg-background">
              <Calendar className="h-4 w-4 text-foreground" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-foreground">Daftar Surat Kontrol (SKDP)</h3>
              <p className="text-xs text-muted-foreground">
                Peserta &bull; <span className="font-mono">{noKartu}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={bulan}
              onChange={(e) => setBulan(e.target.value)}
              className="h-8 border border-input bg-background px-2 py-1 text-xs text-foreground rounded-md focus:outline-none focus:ring-1 focus:ring-ring"
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
              className="h-8 border border-input bg-background px-2 py-1 text-xs text-foreground rounded-md focus:outline-none focus:ring-1 focus:ring-ring"
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
              className="h-8 px-3 text-xs"
            >
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <RefreshCw className="h-3.5 w-3.5 mr-1.5" />}
              Cari
            </Button>
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-14">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              <p className="text-sm font-medium text-foreground mt-2">Mengambil data surat kontrol...</p>
              <p className="text-xs text-muted-foreground mt-0.5">Mengambil daftar surat kontrol dari BPJS.</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-14 text-center px-4">
              <ClipboardList className="h-7 w-7 text-destructive/60 mb-2" />
              <p className="text-sm font-medium text-destructive">Data surat kontrol tidak tersedia</p>
              <p className="text-xs text-muted-foreground mt-1">{error}</p>
            </div>
          ) : (
            <DataTable
              columns={columns}
              data={skdpList}
              searchPlaceholder="Cari no. surat kontrol, poli, atau dokter..."
              pageSize={10}
              hideRowCount
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
