import { useEffect, useMemo, useRef, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { DataTable } from "@/components/ui/data-table";
import { useToast } from "@/hooks/use-toast";
import { bpjsApi, type BPJSApotekDPHOItem } from "@/lib/api/bpjs";
import { Database, Loader2, Search, Unlink2 } from "lucide-react";

interface DPHOMappingFieldProps {
  valueCode: string;
  valueName: string;
  onChange: (mapping: { code: string; name: string }) => void;
  onClear: () => void;
  disabled?: boolean;
}

function normalizeDPHOList(payload: unknown): BPJSApotekDPHOItem[] {
  if (Array.isArray(payload)) {
    return payload as BPJSApotekDPHOItem[];
  }

  if (payload && typeof payload === "object") {
    const typedPayload = payload as { list?: unknown };
    if (Array.isArray(typedPayload.list)) {
      return typedPayload.list as BPJSApotekDPHOItem[];
    }
  }

  return [];
}

function getRawStringValue(item: BPJSApotekDPHOItem, keys: string[]) {
  for (const key of keys) {
    const value = item[key];
    if (typeof value === "string" && value.trim() !== "") {
      return value;
    }
  }

  return "-";
}

function getStringValue(item: BPJSApotekDPHOItem, keys: string[]) {
  const value = getRawStringValue(item, keys);
  return value === "-" ? "" : value;
}

function isTruthyFlag(value: unknown) {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    return value.trim().toLowerCase() === "true" || value.trim() === "1";
  }

  if (typeof value === "number") {
    return value === 1;
  }

  return false;
}

type NormalizedDPHOItem = {
  source: BPJSApotekDPHOItem;
  kodeObat: string;
  namaObat: string;
  generik: string;
  prb: unknown;
  kronis: unknown;
  kemo: unknown;
  searchableText: string;
};

export function DPHOMappingField({ valueCode, valueName, onChange, onClear, disabled = false }: DPHOMappingFieldProps) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<BPJSApotekDPHOItem[]>([]);
  const [search, setSearch] = useState("");
  const [warning, setWarning] = useState("");
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open || items.length > 0 || loading) {
      return;
    }

    const fetchDPHO = async () => {
      setLoading(true);
      try {
        const response = await bpjsApi.apotekGetReferensiDPHO();
        setItems(normalizeDPHOList(response.data.data));
        setWarning(response.data.warning || "");
      } catch (error: any) {
        toast({
          variant: "destructive",
          title: "Gagal memuat DPHO",
          description: error?.response?.data?.error || "Referensi DPHO BPJS tidak berhasil dimuat.",
        });
        setOpen(false);
      } finally {
        setLoading(false);
      }
    };

    fetchDPHO();
  }, [items.length, loading, open, toast]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const timeoutId = window.setTimeout(() => {
      searchInputRef.current?.focus();
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [open]);

  const normalizedItems = useMemo<NormalizedDPHOItem[]>(() => {
    return items.map((item) => ({
      source: item,
      kodeObat:
        getStringValue(item, ["kodeobat", "kode_obat", "kodeObat", "kdobat", "kd_obat"]) ||
        "Tidak ada kode",
      namaObat:
        getStringValue(item, ["namaobat", "nama_obat", "namaObat", "nmobat", "nm_obat"]) ||
        "Tidak ada nama",
      generik: getStringValue(item, ["generik", "nama_generik", "nm_generik"]),
      prb: item.prb ?? item.isprb ?? item.is_prb,
      kronis: item.kronis ?? item.iskronis ?? item.is_kronis,
      kemo: item.kemo ?? item.iskemo ?? item.is_kemo,
      searchableText: [
        getStringValue(item, ["kodeobat", "kode_obat", "kodeObat", "kdobat", "kd_obat"]),
        getStringValue(item, ["namaobat", "nama_obat", "namaObat", "nmobat", "nm_obat"]),
        getStringValue(item, ["generik", "nama_generik", "nm_generik"]),
      ]
        .join(" ")
        .toLowerCase(),
    }));
  }, [items]);

  const filteredCount = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) {
      return normalizedItems.length;
    }

    return normalizedItems.filter((item) => item.searchableText.includes(keyword)).length;
  }, [normalizedItems, search]);

  const columns = useMemo<ColumnDef<NormalizedDPHOItem>[]>(
    () => [
      {
        accessorKey: "kodeObat",
        header: "Kode",
        cell: ({ row }) => <span className="font-mono text-xs">{row.original.kodeObat}</span>,
      },
      {
        accessorKey: "namaObat",
        header: "Nama Obat",
        cell: ({ row }) => (
          <div className="space-y-1">
            <p className="text-sm font-medium leading-5">{row.original.namaObat}</p>
            <p className="text-xs text-muted-foreground">{row.original.generik || "-"}</p>
          </div>
        ),
      },
      {
        id: "prb",
        header: "Obat PRB",
        cell: ({ row }) => (
          <div className="text-center">
            <Checkbox checked={isTruthyFlag(row.original.prb)} disabled />
          </div>
        ),
      },
      {
        id: "kronis",
        header: "Obat Kronis",
        cell: ({ row }) => (
          <div className="text-center">
            <Checkbox checked={isTruthyFlag(row.original.kronis)} disabled />
          </div>
        ),
      },
      {
        id: "kemo",
        header: "Obat Kemo",
        cell: ({ row }) => (
          <div className="text-center">
            <Checkbox checked={isTruthyFlag(row.original.kemo)} disabled />
          </div>
        ),
      },
      {
        id: "tgl_tayang",
        header: "Tgl Tayang",
        cell: ({ row }) => getRawStringValue(row.original.source, ["tgltayang", "tgl_tayang", "tglTayang"]),
      },
      {
        id: "tgl_mulai",
        header: "Tgl Mulai",
        cell: ({ row }) => getRawStringValue(row.original.source, ["tglmulai", "tgl_mulai", "tglMulai"]),
      },
      {
        id: "tgl_akhir",
        header: "Tgl Akhir",
        cell: ({ row }) => getRawStringValue(row.original.source, ["tglakhir", "tgl_akhir", "tglAkhir"]),
      },
      {
        id: "stok",
        header: "Stok",
        cell: ({ row }) => getRawStringValue(row.original.source, ["stok"]),
      },
      {
        id: "aksi",
        header: "Aksi",
        cell: ({ row }) => (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => {
              onChange({ code: row.original.kodeObat, name: row.original.namaObat });
              setOpen(false);
            }}
          >
            Pilih
          </Button>
        ),
      },
    ],
    [onChange]
  );

  return (
    <div className="space-y-4 rounded-lg border p-4">
      <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
        <div>
          <h4 className="text-sm font-medium flex items-center gap-2">
            <Database className="h-4 w-4 text-muted-foreground" />
            Mapping Obat BPJS DPHO
          </h4>
          <p className="text-xs text-muted-foreground">
            Pilih satu referensi DPHO BPJS untuk ditautkan ke master obat ini.
          </p>
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={() => setOpen(true)} disabled={disabled}>
            <Search className="mr-2 h-4 w-4" />
            Pilih DPHO
          </Button>
          <Button type="button" variant="ghost" onClick={onClear} disabled={disabled || !valueCode}>
            <Unlink2 className="mr-2 h-4 w-4" />
            Kosongkan
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label className="text-xs font-medium">Kode Obat DPHO</Label>
          <Input value={valueCode} readOnly placeholder="Belum dipilih" className="h-9 font-mono text-sm" />
        </div>
        <div className="space-y-2">
          <Label className="text-xs font-medium">Nama Obat DPHO</Label>
          <Input value={valueName} readOnly placeholder="Belum dipilih" className="h-9 text-sm" />
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[92vh] max-w-7xl overflow-hidden p-0">
          <DialogHeader className="px-6 pt-6">
            <DialogTitle>Mapping Obat ke Referensi DPHO</DialogTitle>
            <DialogDescription>
              Data DPHO dimuat penuh dari BPJS lalu difilter di modal ini agar pencarian tetap cepat walau respons BPJS tidak berbasis parameter.
            </DialogDescription>
          </DialogHeader>

          <div className="flex min-h-0 flex-1 flex-col space-y-4 px-6 pb-6">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="flex-1">
                <Input
                  ref={searchInputRef}
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Cari kode obat, nama obat, atau generik DPHO..."
                  className="h-9"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                {loading
                  ? "Memuat DPHO..."
                  : `${filteredCount} dari ${items.length} obat DPHO (hasil dari data yang sudah di-fetch)`}
              </p>
            </div>

            {warning ? (
              <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                {warning}
              </div>
            ) : null}

            {loading ? (
              <div className="rounded-md border py-10">
                <Loader2 className="mx-auto h-6 w-6 animate-spin" />
              </div>
            ) : (
              <DataTable
                columns={columns}
                data={normalizedItems}
                showSearch={false}
                pageSize={20}
                tableId="dpho-mapping-modal"
                globalFilterValue={search}
                onGlobalFilterValueChange={setSearch}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
