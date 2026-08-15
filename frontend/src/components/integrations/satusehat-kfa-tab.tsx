import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/ui/data-table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Plus,
  Trash2,
  Check,
  CheckCircle,
  AlertCircle,
  Loader2,
  Search,
  Send,
} from "lucide-react";
import {
  kfaMappingApi,
  kfaStatsApi,
  kfaLookupApi,
  type MedicineKFAMapping,
  type KFAMappingStats,
  type UnmappedMedicine,
  type KFALookupResult,
} from "@/lib/api/kfa";
import type { ColumnDef } from "@tanstack/react-table";

type UnifiedMappingRecord = {
  id: string;
  medicine_id: number;
  medicine: any;
  mapping: MedicineKFAMapping | null;
  is_verified: boolean;
  status: 'unmapped' | 'mapped_pending' | 'verified';
};

export function KfaMappingTab() {
  const { toast } = useToast();

  // States
  const [kfaMappings, setKfaMappings] = useState<MedicineKFAMapping[]>([]);
  const [_kfaStats, setKfaStats] = useState<KFAMappingStats | null>(null);
  const [unmappedMedicines, setUnmappedMedicines] = useState<UnmappedMedicine[]>([]);
  const [kfaSearchQuery, setKfaSearchQuery] = useState("");
  const [kfaSearchResults, setKfaSearchResults] = useState<KFALookupResult[]>([]);
  const [selectedMedicine, setSelectedMedicine] = useState<any | null>(null);
  const [mappingDialogOpen, setMappingDialogOpen] = useState(false);

  const [newMapping, setNewMapping] = useState({
    kfa_code: "",
    kfa_name: "",
    kfa_display_name: "",
    kfa_form: "",
    kfa_strength: "",
    kfa_manufacturer: "",
    kfa_farmalkes: "",
    notes: "",
  });
  const [savingMapping, setSavingMapping] = useState(false);
  const [lookingUpKFA, setLookingUpKFA] = useState(false);
  const [sending, setSending] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadKFAData();
  }, []);

  const loadKFAData = async () => {
    setLoading(true);
    try {
      const [statsRes, mappingsRes, unmappedRes] = await Promise.all([
        kfaStatsApi.getStats(),
        kfaMappingApi.getAll({ limit: 500 }), // increased limit just in case
        kfaStatsApi.getUnmapped({ limit: 500 }),
      ]);
      setKfaStats(statsRes.data);
      setKfaMappings(mappingsRes.data.data || []);
      setUnmappedMedicines(unmappedRes.data.data || []);
    } catch (error) {
      console.error("Failed to load KFA data:", error);
    } finally {
      setLoading(false);
    }
  };

  const unifiedData = useMemo(() => {
    const data: UnifiedMappingRecord[] = [];
    unmappedMedicines.forEach(m => {
      data.push({
        id: `unmapped-${m.id}`,
        medicine_id: m.id,
        medicine: m,
        mapping: null,
        is_verified: false,
        status: 'unmapped'
      });
    });
    kfaMappings.forEach(m => {
      data.push({
        id: `mapped-${m.id}`,
        medicine_id: m.medicine_id,
        medicine: m.medicine || { id: m.medicine_id, name: (m as any).medicine?.name || 'Unknown', code: (m as any).medicine?.code || '-', generic_name: (m as any).medicine?.generic_name || '-' },
        mapping: m,
        is_verified: m.is_verified,
        status: m.is_verified ? 'verified' : 'mapped_pending'
      });
    });
    return data;
  }, [unmappedMedicines, kfaMappings]);

  const handleSearchKFA = async (query: string) => {
    setKfaSearchQuery(query);
    if (query.length < 2) {
      setKfaSearchResults([]);
      return;
    }
    try {
      const res = await kfaLookupApi.search(query);
      setKfaSearchResults(res.data.data || []);
    } catch (error) {
      console.error("Failed to search KFA:", error);
      setKfaSearchResults([]);
    }
  };

  const handleSelectKFA = (kfa: KFALookupResult) => {
    setNewMapping({
      kfa_code: kfa.kfa_code,
      kfa_name: kfa.name,
      kfa_display_name: kfa.display_name || kfa.name,
      kfa_form: kfa.dosage_form || "",
      kfa_strength: "",
      kfa_manufacturer: kfa.manufacturer || "",
      kfa_farmalkes: kfa.farmalkes || "",
      notes: "",
    });
    setKfaSearchQuery(kfa.name);
    setKfaSearchResults([]);
  };

  const handleLookupKFAByCode = async (code: string) => {
    if (!code || code.length < 5) return;
    setLookingUpKFA(true);
    try {
      const res = await kfaLookupApi.lookupByCode(code);
      if (res.data.found && res.data.data) {
        const kfa = res.data.data;
        setNewMapping({
          ...newMapping,
          kfa_code: kfa.kfa_code,
          kfa_name: kfa.name,
          kfa_display_name: kfa.display_name || kfa.name,
          kfa_form: kfa.dosage_form || "",
          kfa_manufacturer: kfa.manufacturer || "",
          kfa_farmalkes: kfa.farmalkes || "",
        });
        toast({
          variant: "success",
          title: "KFA Ditemukan",
          description: `${kfa.name} - ${kfa.manufacturer || 'N/A'}`,
        });
      }
    } catch (error: unknown) {
      const err = error as { response?: { status?: number; data?: { error?: string } } };
      if (err.response?.status === 404) {
        toast({
          variant: "destructive",
          title: "Tidak Ditemukan",
          description: "Kode KFA tidak ditemukan di SatuSehat",
        });
      } else {
        toast({
          variant: "destructive",
          title: "Gagal Lookup",
          description: err.response?.data?.error || "Gagal mencari kode KFA",
        });
      }
    } finally {
      setLookingUpKFA(false);
    }
  };

  const handleCreateMapping = async () => {
    if (!selectedMedicine || !newMapping.kfa_code) return;
    setSavingMapping(true);
    try {
      await kfaMappingApi.create({
        medicine_id: selectedMedicine.id,
        kfa_code: newMapping.kfa_code,
        kfa_name: newMapping.kfa_name,
        kfa_display_name: newMapping.kfa_display_name,
        kfa_form: newMapping.kfa_form,
        kfa_strength: newMapping.kfa_strength,
        kfa_manufacturer: newMapping.kfa_manufacturer,
        kfa_farmalkes: newMapping.kfa_farmalkes,
        notes: newMapping.notes,
      });
      toast({
        variant: "success",
        title: "Berhasil",
        description: `Mapping KFA untuk ${selectedMedicine.name} berhasil dibuat`,
      });
      setMappingDialogOpen(false);
      setSelectedMedicine(null);
      setNewMapping({
        kfa_code: "",
        kfa_name: "",
        kfa_display_name: "",
        kfa_form: "",
        kfa_strength: "",
        kfa_manufacturer: "",
        kfa_farmalkes: "",
        notes: "",
      });
      setKfaSearchQuery("");
      loadKFAData();
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string } } };
      toast({
        variant: "destructive",
        title: "Gagal",
        description: err.response?.data?.error || "Gagal membuat mapping KFA",
      });
    } finally {
      setSavingMapping(false);
    }
  };

  const handleDeleteMapping = async (mappingId: number) => {
    try {
      await kfaMappingApi.delete(mappingId);
      toast({
        variant: "success",
        title: "Berhasil",
        description: "Mapping KFA berhasil dihapus",
      });
      loadKFAData();
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string } } };
      toast({
        variant: "destructive",
        title: "Gagal",
        description: err.response?.data?.error || "Gagal menghapus mapping",
      });
    }
  };

  const handleVerifyMapping = async (mappingId: number) => {
    try {
      await kfaMappingApi.verify(mappingId);
      toast({
        variant: "success",
        title: "Berhasil",
        description: "Mapping KFA berhasil diverifikasi",
      });
      loadKFAData();
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string } } };
      toast({
        variant: "destructive",
        title: "Gagal",
        description: err.response?.data?.error || "Gagal memverifikasi mapping",
      });
    }
  };

  const handleSendMedication = async (mappingId: number) => {
    setSending(`medication-standalone-${mappingId}`);
    try {
      const res = await kfaMappingApi.sendToSatuSehat(mappingId);
      toast({
        variant: "success",
        title: "Berhasil",
        description: res.data.message || "Medication berhasil dikirim ke SatuSehat",
      });
      loadKFAData();
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string } } };
      toast({
        variant: "destructive",
        title: "Gagal",
        description: err.response?.data?.error || "Gagal mengirim Medication ke SatuSehat",
      });
    } finally {
      setSending(null);
    }
  };

  const kfaMappingColumns: ColumnDef<UnifiedMappingRecord>[] = [
    {
      accessorKey: "medicine.code",
      header: "Kode Obat",
      cell: ({ row }) => <span className="font-mono">{row.original.medicine?.code || '-'}</span>,
    },
    {
      accessorKey: "medicine.name",
      header: "Nama Obat Lokal",
      cell: ({ row }) => (
        <div>
          <p className="font-medium">{row.original.medicine?.name || '-'}</p>
          <p className="text-xs text-muted-foreground">{row.original.medicine?.generic_name}</p>
        </div>
      ),
    },
    {
      id: "kfa_mapping",
      header: "Mapping KFA",
      cell: ({ row }) => {
        const mapping = row.original.mapping;
        if (!mapping) return <span className="text-muted-foreground text-xs italic">Belum di-map</span>;

        return (
          <div>
            <span className="font-mono text-primary text-xs bg-primary/10 px-1 py-0.5 rounded">{mapping.kfa_code}</span>
            <p className="text-xs mt-1 max-w-[200px] truncate" title={mapping.kfa_name}>{mapping.kfa_name}</p>
          </div>
        );
      },
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => {
        const status = row.original.status;
        if (status === 'unmapped') {
          return (
            <Badge variant="secondary" className="bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300 font-normal">
              Belum Mapping
            </Badge>
          );
        }
        if (status === 'verified') {
          return (
            <Badge className="bg-green-100 text-green-800 gap-1 hover:bg-green-200">
              <CheckCircle className="h-3 w-3" />
              Terverifikasi
            </Badge>
          );
        }
        return (
          <Badge variant="outline" className="text-yellow-600 border-yellow-200 bg-yellow-50 gap-1">
            <AlertCircle className="h-3 w-3" />
            Menunggu Verifikasi
          </Badge>
        );
      },
    },
    {
      id: "actions",
      header: () => <div className="text-right">Aksi</div>,
      cell: ({ row }) => {
        const record = row.original;
        const mapping = record.mapping;

        return (
          <div className="text-right flex gap-2 justify-end">
            {!mapping ? (
              <Button
                variant="default"
                size="sm"
                onClick={() => {
                  setSelectedMedicine(record.medicine);
                  setNewMapping({
                    kfa_code: "",
                    kfa_name: "",
                    kfa_display_name: "",
                    kfa_form: "",
                    kfa_strength: "",
                    kfa_manufacturer: "",
                    kfa_farmalkes: "",
                    notes: "",
                  });
                  setKfaSearchQuery("");
                  setKfaSearchResults([]);
                  setMappingDialogOpen(true);
                }}
              >
                <Plus className="h-4 w-4 mr-1" /> Mapping
              </Button>
            ) : (
              <>
                {!record.is_verified && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleVerifyMapping(mapping.id)}
                    title="Verifikasi mapping"
                  >
                    <Check className="h-4 w-4" />
                  </Button>
                )}
                {!mapping.satusehat_medication_id && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleSendMedication(mapping.id)}
                    disabled={sending === `medication-standalone-${mapping.id}`}
                    title="Kirim Medication ke SatuSehat"
                  >
                    {sending === `medication-standalone-${mapping.id}` ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDeleteMapping(mapping.id)}
                  className="text-red-600 hover:text-red-700"
                  title="Hapus mapping"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </>
            )}
          </div>
        );
      },
    },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <DataTable
        columns={kfaMappingColumns}
        data={unifiedData}
        searchPlaceholder="Cari nama obat atau kode KFA..."
        pageSize={10}
        tableId="unified-kfa-mappings"
      />

      {/* Mapping Dialog */}
      <Dialog open={mappingDialogOpen} onOpenChange={setMappingDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Mapping Obat ke KFA</DialogTitle>
            <DialogDescription>
              Cari dan pilih data KFA dari SatuSehat untuk obat lokal ini.
            </DialogDescription>
          </DialogHeader>

          {selectedMedicine && (
            <div className="flex-1 overflow-y-auto pr-2 space-y-6 py-4">
              {/* Medicine Info */}
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-widest mb-1">Obat Lokal</p>
                <div className="flex items-center gap-3">
                  <p className="text-xl font-bold text-foreground">{selectedMedicine.name}</p>
                  <Badge variant="secondary" className="font-mono">{selectedMedicine.code}</Badge>
                </div>
                <div className="flex items-center gap-4 text-sm text-muted-foreground pt-1">
                  <span>Generik: <span className="font-medium text-foreground">{selectedMedicine.generic_name || '-'}</span></span>
                  <span>Bentuk: <span className="font-medium text-foreground">{selectedMedicine.form || '-'}</span></span>
                  <span>Kekuatan: <span className="font-medium text-foreground">{selectedMedicine.strength || '-'}</span></span>
                </div>
              </div>

              {/* Input Kode KFA with Auto-lookup */}
              <div className="py-2 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="kfa-code" className="text-base">Pencarian KFA</Label>
                  <p className="text-sm text-muted-foreground">
                    Cari berdasarkan nama atau masukkan kode KFA secara manual.
                  </p>

                  {/* Search box for KFA text search */}
                  <div className="relative pt-2 pb-3 border-b mb-4">
                    <Search className="absolute left-3 top-[22px] -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Ketik nama obat standar KFA..."
                      className="pl-9 h-11"
                      value={kfaSearchQuery}
                      onChange={(e) => handleSearchKFA(e.target.value)}
                    />

                    {/* Search Results Dropdown/List */}
                    {kfaSearchResults.length > 0 && (
                      <div className="absolute z-50 w-full mt-1 border rounded-md bg-popover shadow-lg max-h-60 overflow-y-auto">
                        {kfaSearchResults.map((kfa, idx) => (
                          <button
                            key={`${kfa.kfa_code}-${idx}`}
                            type="button"
                            className="w-full text-left px-4 py-3 hover:bg-muted text-sm border-b last:border-0 transition-colors"
                            onClick={() => handleSelectKFA(kfa)}
                          >
                            <p className="font-semibold text-primary">{kfa.name}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              Kode: <span className="font-mono">{kfa.kfa_code}</span> {kfa.manufacturer && `| Produsen: ${kfa.manufacturer}`}
                            </p>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <Input
                      id="kfa-code"
                      placeholder="Atau masukkan Kode KFA langsung: 93001295"
                      value={newMapping.kfa_code}
                      onChange={(e) => setNewMapping({ ...newMapping, kfa_code: e.target.value })}
                      className="flex-1 font-mono"
                    />
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => handleLookupKFAByCode(newMapping.kfa_code)}
                      disabled={!newMapping.kfa_code || newMapping.kfa_code.length < 5 || lookingUpKFA}
                    >
                      {lookingUpKFA ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <Search className="h-4 w-4 mr-2" />
                      )}
                      Lookup Kode
                    </Button>
                  </div>
                </div>

                {/* Selected KFA Display */}
                {newMapping.kfa_name && (
                  <div className="p-4 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-900 rounded-lg animate-in fade-in slide-in-from-top-2">
                    <div className="flex items-center gap-2 mb-3">
                      <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-500" />
                      <span className="font-semibold text-green-800 dark:text-green-400">Data KFA Terpilih</span>
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-xs text-muted-foreground">Nama KFA</p>
                        <p className="font-medium">{newMapping.kfa_name}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Bentuk Sediaan</p>
                        <p className="font-medium">{newMapping.kfa_form || "-"}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Pabrikan</p>
                        <p className="font-medium">{newMapping.kfa_manufacturer || "-"}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Izin Edar (Farmalkes)</p>
                        <p className="font-medium">{newMapping.kfa_farmalkes || "-"}</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Notes */}
                <div className="space-y-2 pt-2">
                  <Label htmlFor="kfa-notes">Catatan (opsional)</Label>
                  <Input
                    id="kfa-notes"
                    placeholder="Catatan tambahan untuk tim farmasi..."
                    value={newMapping.notes}
                    onChange={(e) => setNewMapping({ ...newMapping, notes: e.target.value })}
                  />
                </div>
              </div>
            </div>
          )}

          <div className="pt-4 border-t flex justify-end gap-3 mt-auto">
            <Button variant="outline" onClick={() => setMappingDialogOpen(false)}>
              Batal
            </Button>
            <Button
              onClick={handleCreateMapping}
              disabled={!newMapping.kfa_code || !newMapping.kfa_name || savingMapping}
              className="min-w-[150px]"
            >
              {savingMapping ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Check className="h-4 w-4 mr-2" />
              )}
              Simpan Mapping
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

