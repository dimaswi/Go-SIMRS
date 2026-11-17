import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { type ColumnDef } from "@/components/ui/data-table-utils";
import { CalendarDays, Loader2, RefreshCw, ShieldCheck } from "lucide-react";

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

  const columns: ColumnDef<RujukanData>[] = [
    {
      id: "noKunjungan",
      accessorFn: (row) => row.noKunjungan || "",
      header: () => <span className="text-[11px] font-semibold uppercase tracking-wider">No. Rujukan</span>,
      cell: ({ row }) => <span className="font-mono text-xs font-semibold">{row.original.noKunjungan}</span>,
    },
    {
      id: "diagnosa",
      accessorFn: (row) => `${row.diagnosa?.kode || ""} ${row.diagnosa?.nama || ""}`,
      header: () => <span className="text-[11px] font-semibold uppercase tracking-wider">Diagnosa</span>,
      cell: ({ row }) => (
        <div className="text-xs text-muted-foreground max-w-[240px] truncate">
          <span className="font-medium text-foreground">{row.original.diagnosa?.kode || "-"}</span> - {row.original.diagnosa?.nama || "Diagnosa tidak tersedia"}
        </div>
      ),
    },
    {
      id: "tanggal",
      accessorFn: (row) => row.tglKunjungan || "",
      header: () => <span className="text-[11px] font-semibold uppercase tracking-wider">Tanggal</span>,
      cell: ({ row }) => (
        <div className="space-y-0.5 text-xs">
          <div className="flex items-center gap-1 font-medium text-foreground">
            <CalendarDays className="h-3 w-3 text-muted-foreground" />
            {row.original.tglKunjungan}
          </div>
          <div className="text-[11px] text-muted-foreground">s/d {row.original.tglRujukanBerakhir || "-"}</div>
        </div>
      ),
    },
    {
      id: "poli",
      accessorFn: (row) => row.poliRujukan?.nama || "",
      header: () => <span className="text-[11px] font-semibold uppercase tracking-wider">Poli</span>,
      cell: ({ row }) => <span className="text-xs font-medium">{row.original.poliRujukan?.nama || "-"}</span>,
    },
    {
      id: "faskes",
      accessorFn: (row) => row.provPerujuk?.nama || "",
      header: () => <span className="text-[11px] font-semibold uppercase tracking-wider">Faskes</span>,
      cell: ({ row }) => <span className="text-xs">{row.original.provPerujuk?.nama || "-"}</span>,
    },
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
      <DialogContent className="flex max-h-[85vh] max-w-5xl flex-col gap-0 overflow-hidden p-0">
        <div className="flex items-center justify-between gap-3 border-b bg-neutral-50/40 dark:bg-neutral-900/20 px-5 py-3.5 pr-12">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center border border-neutral-200 dark:border-neutral-800 bg-background">
              <ShieldCheck className="h-4 w-4 text-foreground" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-foreground">Daftar Rujukan</h3>
              <p className="text-xs text-muted-foreground">
                Peserta &bull; <span className="font-mono">{noKartu}</span>
              </p>
            </div>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={fetchRujukan}
            disabled={loading}
            className="h-8 px-3 text-xs shrink-0"
          >
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <RefreshCw className="h-3.5 w-3.5 mr-1.5" />}
            Refresh
          </Button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-14">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              <p className="text-sm font-medium text-foreground mt-2">Mengambil data rujukan...</p>
              <p className="text-xs text-muted-foreground mt-0.5">Mengambil daftar rujukan aktif peserta dari BPJS.</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-14 text-center px-4">
              <ShieldCheck className="h-7 w-7 text-destructive/60 mb-2" />
              <p className="text-sm font-medium text-destructive">Data rujukan tidak tersedia</p>
              <p className="text-xs text-muted-foreground mt-1">{error}</p>
            </div>
          ) : (
            <DataTable
              columns={columns}
              data={rujukanList}
              searchPlaceholder="Cari no. rujukan, diagnosa, poli, atau faskes..."
              pageSize={10}
              hideRowCount
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
