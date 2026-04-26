import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
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

function getStringValue(item: BPJSApotekDPHOItem, keys: string[]) {
  for (const key of keys) {
    const value = item[key];
    if (typeof value === "string" && value.trim() !== "") {
      return value;
    }
  }

  return "-";
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

export function DPHOMappingField({ valueCode, valueName, onChange, onClear, disabled = false }: DPHOMappingFieldProps) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<BPJSApotekDPHOItem[]>([]);
  const [search, setSearch] = useState("");
  const [warning, setWarning] = useState("");

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

  const filteredItems = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) {
      return items;
    }

    return items.filter((item) => {
      const searchableText = [item.kodeobat, item.namaobat, item.generik].join(" ").toLowerCase();
      return searchableText.includes(keyword);
    });
  }, [items, search]);

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
        <DialogContent className="max-w-7xl">
          <DialogHeader>
            <DialogTitle>Mapping Obat ke Referensi DPHO</DialogTitle>
            <DialogDescription>
              Data DPHO dimuat penuh dari BPJS lalu difilter di modal ini agar pencarian tetap cepat walau respons BPJS tidak berbasis parameter.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="flex-1">
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Cari kode obat, nama obat, atau generik DPHO..."
                  className="h-9"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                {loading ? "Memuat DPHO..." : `${filteredItems.length} dari ${items.length} obat DPHO`}
              </p>
            </div>

            {warning ? (
              <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                {warning}
              </div>
            ) : null}

            <ScrollArea className="h-[520px] rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[130px]">Kode</TableHead>
                    <TableHead className="min-w-[260px]">Nama Obat</TableHead>
                    <TableHead className="w-[90px] text-center">Obat PRB</TableHead>
                    <TableHead className="w-[100px] text-center">Obat Kronis</TableHead>
                    <TableHead className="w-[90px] text-center">Obat Kemo</TableHead>
                    <TableHead className="w-[110px]">Tgl Tayang</TableHead>
                    <TableHead className="w-[110px]">Tgl Mulai</TableHead>
                    <TableHead className="w-[110px]">Tgl Akhir</TableHead>
                    <TableHead className="w-[100px]">Stok</TableHead>
                    <TableHead className="w-[90px]">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={10} className="py-10 text-center">
                        <Loader2 className="mx-auto h-6 w-6 animate-spin" />
                      </TableCell>
                    </TableRow>
                  ) : filteredItems.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={10} className="py-10 text-center text-muted-foreground">
                        Data DPHO tidak ditemukan.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredItems.map((item) => (
                      <TableRow key={item.kodeobat}>
                        <TableCell className="font-mono text-xs">{item.kodeobat}</TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <p className="text-sm font-medium leading-5">{item.namaobat}</p>
                            <p className="text-xs text-muted-foreground">{item.generik || "-"}</p>
                          </div>
                        </TableCell>
                        <TableCell className="text-center"><Checkbox checked={isTruthyFlag(item.prb)} disabled /></TableCell>
                        <TableCell className="text-center"><Checkbox checked={isTruthyFlag(item.kronis)} disabled /></TableCell>
                        <TableCell className="text-center"><Checkbox checked={isTruthyFlag(item.kemo)} disabled /></TableCell>
                        <TableCell>{getStringValue(item, ["tgltayang", "tgl_tayang", "tglTayang"])}</TableCell>
                        <TableCell>{getStringValue(item, ["tglmulai", "tgl_mulai", "tglMulai"])}</TableCell>
                        <TableCell>{getStringValue(item, ["tglakhir", "tgl_akhir", "tglAkhir"])}</TableCell>
                        <TableCell>{getStringValue(item, ["stok"])}</TableCell>
                        <TableCell>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              onChange({ code: item.kodeobat, name: item.namaobat });
                              setOpen(false);
                            }}
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
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}