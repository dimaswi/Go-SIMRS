import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Label } from "@/components/ui/label";
import { Check, ChevronsUpDown, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { bpjsApi, type Room } from "@/lib/api";
import { vclaimApi } from "@/lib/api/vclaim";
import type { BPJSPoliMapping, BPJSReferensiPoli } from "@/lib/api/bpjs";
import { useToast } from "@/hooks/use-toast";

interface BpjsPoliMappingDialogProps {
  room: Room;
  poliMapping: BPJSPoliMapping | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function BpjsPoliMappingDialog({
  room,
  poliMapping,
  open,
  onOpenChange,
  onSuccess,
}: BpjsPoliMappingDialogProps) {
  const { toast } = useToast();

  const [bpjsPolis, setBpjsPolis] = useState<BPJSReferensiPoli[]>([]);
  const [loadingPolis, setLoadingPolis] = useState(false);
  const [searchPoli, setSearchPoli] = useState("");
  const [selectedPoli, setSelectedPoli] = useState<BPJSReferensiPoli | null>(
    poliMapping ? { kdpoli: poliMapping.kode_poli_bpjs, nmpoli: poliMapping.nama_poli_bpjs } : null
  );
  const [poliPopoverOpen, setPoliPopoverOpen] = useState(false);
  const [savingPoli, setSavingPoli] = useState(false);

  if (open && poliMapping && !selectedPoli) {
    setSelectedPoli({ kdpoli: poliMapping.kode_poli_bpjs, nmpoli: poliMapping.nama_poli_bpjs });
  }

  const handleSearchPoli = async (query: string) => {
    setSearchPoli(query);
    if (query.length < 3) return;

    const normalizedQuery = query.toLowerCase().replace(/poli\s+/g, "");
    
    try {
      setLoadingPolis(true);
      const response = await vclaimApi.searchPoli(normalizedQuery);
      const normalizedPolis: BPJSReferensiPoli[] = (response.data.data || []).map((item: any) => ({
        kdpoli: item.kode,
        nmpoli: item.nama,
      }));
      setBpjsPolis(normalizedPolis);
    } catch (error: any) {
      console.error(error);
    } finally {
      setLoadingPolis(false);
    }
  };

  const uniquePolis = useMemo(() => {
    const seen = new Map<string, BPJSReferensiPoli>();
    for (const p of bpjsPolis) {
      if (!seen.has(p.kdpoli)) seen.set(p.kdpoli, p);
    }
    return Array.from(seen.values());
  }, [bpjsPolis]);

  const handleSavePoli = async () => {
    if (!selectedPoli) return;
    try {
      setSavingPoli(true);
      if (poliMapping) {
        await bpjsApi.updatePoliMapping(poliMapping.id, {
          kode_poli_bpjs: selectedPoli.kdpoli,
          nama_poli_bpjs: selectedPoli.nmpoli,
        });
        toast({ variant: "success", title: "Berhasil!", description: "Mapping poli berhasil diupdate." });
      } else {
        await bpjsApi.createPoliMapping({
          room_id: room.id!,
          kode_poli_bpjs: selectedPoli.kdpoli,
          nama_poli_bpjs: selectedPoli.nmpoli,
        });
        toast({ variant: "success", title: "Berhasil!", description: "Mapping poli berhasil dibuat." });
      }
      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Gagal menyimpan",
        description: error.response?.data?.error || "Gagal menyimpan mapping poli.",
      });
    } finally {
      setSavingPoli(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Mapping Poli BPJS</DialogTitle>
          <DialogDescription>
            Hubungkan ruangan {room.name} dengan referensi Poli dari BPJS (VClaim/HFIS).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Poli BPJS</Label>
            <Popover open={poliPopoverOpen} onOpenChange={setPoliPopoverOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={poliPopoverOpen}
                  className="w-full justify-between"
                >
                  {selectedPoli ? `${selectedPoli.kdpoli} - ${selectedPoli.nmpoli}` : "Cari poli (min. 3 huruf)..."}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-full p-0" align="start">
                <Command shouldFilter={false}>
                  <CommandInput 
                    placeholder="Ketik nama poli..." 
                    value={searchPoli}
                    onValueChange={handleSearchPoli}
                  />
                  <CommandList>
                    <CommandEmpty>
                      {loadingPolis ? (
                        <div className="flex items-center justify-center p-4">
                          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground mr-2" />
                          <span className="text-sm text-muted-foreground">Mencari...</span>
                        </div>
                      ) : (
                        "Poli tidak ditemukan."
                      )}
                    </CommandEmpty>
                    <CommandGroup>
                      {uniquePolis.map((poli) => (
                        <CommandItem
                          key={poli.kdpoli}
                          value={poli.kdpoli}
                          onSelect={() => {
                            setSelectedPoli(poli);
                            setPoliPopoverOpen(false);
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              selectedPoli?.kdpoli === poli.kdpoli ? "opacity-100" : "opacity-0"
                            )}
                          />
                          {poli.kdpoli} - {poli.nmpoli}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={savingPoli}>
            Batal
          </Button>
          <Button onClick={handleSavePoli} disabled={!selectedPoli || savingPoli}>
            {savingPoli && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Simpan Mapping
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
