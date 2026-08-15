import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/ui/data-table";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Search,
  CheckCircle,
  AlertCircle,
  Plus,
  Trash2,
  Check,
  Loader2,
  Scan,
} from "lucide-react";
import {
  loincMasterApi,
  snomedMasterApi,
  loincMappingApi,
  loincStatsApi,
  type ProcedureLoincMapping,
  type LoincMappingStats,
  type UnmappedProcedure,
  type LoincMaster,
  type SnomedMaster,
  type CreateProcedureLoincMappingRequest,
} from "@/lib/api/loinc";
import type { ColumnDef } from "@tanstack/react-table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

// SNOMED CT codes untuk kategori prosedur
// Kode standar dari SNOMED International untuk SatuSehat
const SNOMED_CODES = {
  // Kategori prosedur
  LABORATORY_PROCEDURE: "108252007",  // Laboratory procedure
  IMAGING: "363679005",               // Imaging (procedure)
} as const;

type UnifiedLoincMappingRecord = {
  id: string;
  procedure_id: number;
  procedure: any;
  mapping: ProcedureLoincMapping | null;
  is_verified: boolean;
  status: 'unmapped' | 'mapped_pending' | 'verified';
};

export function LoincMappingTab() {
  const { toast } = useToast();

  // Data states
  const [loincMappings, setLoincMappings] = useState<ProcedureLoincMapping[]>([]);
  const [_loincStats, setLoincStats] = useState<LoincMappingStats | null>(null);
  const [unmappedProcedures, setUnmappedProcedures] = useState<UnmappedProcedure[]>([]);

  // Master data for dropdowns
  const [loincResults, setLoincResults] = useState<LoincMaster[]>([]);

  // SNOMED search states
  const [snomedCategoryResults, setSnomedCategoryResults] = useState<SnomedMaster[]>([]);
  const [snomedSpecimenResults, setSnomedSpecimenResults] = useState<SnomedMaster[]>([]);
  const [snomedBodysiteResults, setSnomedBodysiteResults] = useState<SnomedMaster[]>([]);
  const [snomedCategoryQuery, setSnomedCategoryQuery] = useState("");
  const [snomedSpecimenQuery, setSnomedSpecimenQuery] = useState("");
  const [snomedBodysiteQuery, setSnomedBodysiteQuery] = useState("");
  const [searchingSnomedCategory, setSearchingSnomedCategory] = useState(false);
  const [searchingSnomedSpecimen, setSearchingSnomedSpecimen] = useState(false);
  const [searchingSnomedBodysite, setSearchingSnomedBodysite] = useState(false);

  // Dialog states
  const [mappingDialogOpen, setMappingDialogOpen] = useState(false);
  const [selectedProcedure, setSelectedProcedure] = useState<UnmappedProcedure | null>(null);
  const [loincSearchQuery, setLoincSearchQuery] = useState("");
  const [selectedLoinc, setSelectedLoinc] = useState<LoincMaster | null>(null);

  // Form states
  const [newMapping, setNewMapping] = useState<Partial<CreateProcedureLoincMappingRequest>>({
    procedure_id: 0,
    loinc_code: "",
    loinc_display: "",
    snomed_category_code: "",
    snomed_category_display: "",
    snomed_specimen_code: "",
    snomed_specimen_display: "",
    snomed_bodysite_code: "",
    snomed_bodysite_display: "",
    notes: "",
  });

  // Loading states
  const [loading, setLoading] = useState(true);
  const [savingMapping, setSavingMapping] = useState(false);
  const [searchingLoinc, setSearchingLoinc] = useState(false);
  const [verifying, setVerifying] = useState<number | null>(null);
  const [deleting, setDeleting] = useState<number | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [statsRes, mappingsRes, unmappedRes] = await Promise.all([
        loincStatsApi.getStats(),
        loincMappingApi.getAll({ limit: 500 }),
        loincStatsApi.getUnmapped({ limit: 500 }),
      ]);
      setLoincStats(statsRes.data);
      setLoincMappings(mappingsRes.data.data || []);
      setUnmappedProcedures(unmappedRes.data.data || []);
    } catch (error) {
      console.error("Failed to load LOINC data:", error);
      toast({
        variant: "destructive",
        title: "Gagal Memuat Data",
        description: "Gagal memuat data mapping LOINC",
      });
    } finally {
      setLoading(false);
    }
  };

  const unifiedData = useMemo(() => {
    const data: UnifiedLoincMappingRecord[] = [];
    unmappedProcedures.forEach(p => {
      data.push({
        id: `unmapped-${p.id}`,
        procedure_id: p.id,
        procedure: p,
        mapping: null,
        is_verified: false,
        status: 'unmapped'
      });
    });
    loincMappings.forEach(m => {
      data.push({
        id: `mapped-${m.id}`,
        procedure_id: m.procedure_id,
        procedure: m.procedure || { id: m.procedure_id, name: (m as any).procedure?.name || 'Unknown', code: (m as any).procedure?.code || '-', procedure_type: (m as any).procedure?.procedure_type || 'Unknown' },
        mapping: m,
        is_verified: m.is_verified,
        status: m.is_verified ? 'verified' : 'mapped_pending'
      });
    });
    return data;
  }, [unmappedProcedures, loincMappings]);

  // Search SNOMED CT - Category (procedure types)
  const handleSearchSnomedCategory = async (query: string) => {
    setSnomedCategoryQuery(query);
    if (query.length < 3) {
      setSnomedCategoryResults([]);
      return;
    }
    setSearchingSnomedCategory(true);
    try {
      const res = await snomedMasterApi.search(query, 20);
      setSnomedCategoryResults(res.data.data || []);
    } catch (error) {
      console.error("Failed to search SNOMED category:", error);
      setSnomedCategoryResults([]);
    } finally {
      setSearchingSnomedCategory(false);
    }
  };

  // Search SNOMED CT - Specimen
  const handleSearchSnomedSpecimen = async (query: string) => {
    setSnomedSpecimenQuery(query);
    if (query.length < 3) {
      setSnomedSpecimenResults([]);
      return;
    }
    setSearchingSnomedSpecimen(true);
    try {
      const res = await snomedMasterApi.search(query, 20);
      setSnomedSpecimenResults(res.data.data || []);
    } catch (error) {
      console.error("Failed to search SNOMED specimen:", error);
      setSnomedSpecimenResults([]);
    } finally {
      setSearchingSnomedSpecimen(false);
    }
  };

  // Search SNOMED CT - Body Site
  const handleSearchSnomedBodysite = async (query: string) => {
    setSnomedBodysiteQuery(query);
    if (query.length < 3) {
      setSnomedBodysiteResults([]);
      return;
    }
    setSearchingSnomedBodysite(true);
    try {
      const res = await snomedMasterApi.search(query, 20);
      setSnomedBodysiteResults(res.data.data || []);
    } catch (error) {
      console.error("Failed to search SNOMED body site:", error);
      setSnomedBodysiteResults([]);
    } finally {
      setSearchingSnomedBodysite(false);
    }
  };

  // Select SNOMED from search results
  const handleSelectSnomedCategory = (snomed: SnomedMaster) => {
    setNewMapping({
      ...newMapping,
      snomed_category_code: snomed.conceptId,
      snomed_category_display: snomed.term,
    });
    setSnomedCategoryQuery(snomed.term);
    setSnomedCategoryResults([]);
  };

  const handleSelectSnomedSpecimen = (snomed: SnomedMaster) => {
    setNewMapping({
      ...newMapping,
      snomed_specimen_code: snomed.conceptId,
      snomed_specimen_display: snomed.term,
    });
    setSnomedSpecimenQuery(snomed.term);
    setSnomedSpecimenResults([]);
  };

  const handleSelectSnomedBodysite = (snomed: SnomedMaster) => {
    setNewMapping({
      ...newMapping,
      snomed_bodysite_code: snomed.conceptId,
      snomed_bodysite_display: snomed.term,
    });
    setSnomedBodysiteQuery(snomed.term);
    setSnomedBodysiteResults([]);
  };

  const handleSearchLoinc = async (query: string) => {
    setLoincSearchQuery(query);
    if (query.length < 4) {
      setLoincResults([]);
      return;
    }

    setSearchingLoinc(true);
    try {
      const classType = selectedProcedure?.procedure_type === "radiology" ? "radiology" : "laboratory";
      const res = await loincMasterApi.search(query, classType);
      setLoincResults(res.data.data || []);
    } catch (error) {
      console.error("Failed to search LOINC:", error);
      setLoincResults([]);
    } finally {
      setSearchingLoinc(false);
    }
  };

  const handleSelectLoinc = (loinc: LoincMaster) => {
    setSelectedLoinc(loinc);

    // Auto-fill form with LOINC data
    const isRadiology = loinc.kategori_pemeriksaan === "Radiologi";
    const categoryCode = isRadiology ? SNOMED_CODES.IMAGING : SNOMED_CODES.LABORATORY_PROCEDURE;
    const categoryDisplay = isRadiology ? "Imaging" : "Laboratory procedure";

    const displayName = loinc.nama_pemeriksaan || loinc.display;

    setNewMapping({
      ...newMapping,
      loinc_code: loinc.code,
      loinc_display: displayName,
      snomed_category_code: categoryCode,
      snomed_category_display: categoryDisplay,
    });

    setLoincSearchQuery(displayName);
    setLoincResults([]);
  };

  const handleLookupLoincByCode = async (code: string) => {
    if (!code || code.length < 3) return;

    setSearchingLoinc(true);
    try {
      const res = await loincMasterApi.lookupByCode(code);
      if (res.data.found && res.data.data) {
        handleSelectLoinc(res.data.data);
        const displayName = res.data.data.nama_pemeriksaan || res.data.data.display;
        toast({
          variant: "success",
          title: "LOINC Ditemukan",
          description: displayName,
        });
      }
    } catch (error: unknown) {
      const err = error as { message?: string };
      toast({
        variant: "destructive",
        title: "Tidak Ditemukan",
        description: err.message || "Kode LOINC tidak ditemukan",
      });
    } finally {
      setSearchingLoinc(false);
    }
  };

  const handleSaveMapping = async () => {
    if (!selectedProcedure || !newMapping.loinc_code || !newMapping.loinc_display || !newMapping.snomed_category_code) {
      toast({
        variant: "destructive",
        title: "Validasi Gagal",
        description: "Kode LOINC, Display Name, dan Kategori wajib diisi",
      });
      return;
    }

    setSavingMapping(true);
    try {
      await loincMappingApi.create(newMapping as CreateProcedureLoincMappingRequest);
      toast({
        variant: "success",
        title: "Berhasil",
        description: "Mapping LOINC berhasil disimpan",
      });
      setMappingDialogOpen(false);
      setSelectedProcedure(null);
      loadData();
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string } } };
      toast({
        variant: "destructive",
        title: "Gagal Menyimpan",
        description: err.response?.data?.error || "Gagal menyimpan mapping",
      });
    } finally {
      setSavingMapping(false);
    }
  };

  const handleVerifyMapping = async (id: number) => {
    setVerifying(id);
    try {
      await loincMappingApi.verify(id);
      toast({
        variant: "success",
        title: "Berhasil",
        description: "Mapping berhasil diverifikasi",
      });
      loadData();
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string } } };
      toast({
        variant: "destructive",
        title: "Gagal Verifikasi",
        description: err.response?.data?.error || "Gagal memverifikasi mapping",
      });
    } finally {
      setVerifying(null);
    }
  };

  const handleDeleteMapping = async (id: number) => {
    setDeleting(id);
    try {
      await loincMappingApi.delete(id);
      toast({
        variant: "success",
        title: "Berhasil",
        description: "Mapping berhasil dihapus",
      });
      loadData();
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string } } };
      toast({
        variant: "destructive",
        title: "Gagal Menghapus",
        description: err.response?.data?.error || "Gagal menghapus mapping",
      });
    } finally {
      setDeleting(null);
    }
  };

  // Column definitions
  const mappingColumns: ColumnDef<UnifiedLoincMappingRecord>[] = [
    {
      accessorKey: "procedure.name",
      header: "Prosedur",
      cell: ({ row }) => (
        <div>
          <p className="font-medium text-sm">{row.original.procedure?.name}</p>
          <div className="flex gap-2 items-center mt-1">
            <p className="text-xs text-muted-foreground font-mono">{row.original.procedure?.code}</p>
            <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 capitalize">{row.original.procedure?.procedure_type}</Badge>
          </div>
        </div>
      ),
    },
    {
      id: "loinc_mapping",
      header: "LOINC",
      cell: ({ row }) => {
        const mapping = row.original.mapping;
        if (!mapping) return <span className="text-muted-foreground text-xs italic">Belum di-map</span>;

        return (
          <div>
            <code className="text-xs bg-blue-100 dark:bg-blue-900 px-1 rounded">
              {mapping.loinc_code}
            </code>
            <p className="text-xs text-muted-foreground mt-1 truncate max-w-[150px]" title={mapping.loinc_display}>
              {mapping.loinc_display}
            </p>
          </div>
        );
      },
    },
    {
      id: "snomed_category",
      header: "Kategori",
      cell: ({ row }) => {
        const mapping = row.original.mapping;
        if (!mapping) return <span>-</span>;

        return (
          <Badge variant="secondary" className="text-xs">
            {mapping.snomed_category_display || mapping.snomed_category_code}
          </Badge>
        );
      }
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
                  setSelectedProcedure(record.procedure);
                  setNewMapping({
                    procedure_id: record.procedure.id,
                    loinc_code: "",
                    loinc_display: "",
                    snomed_category_code: "",
                    snomed_category_display: "",
                    snomed_specimen_code: "",
                    snomed_specimen_display: "",
                    snomed_bodysite_code: "",
                    snomed_bodysite_display: "",
                    notes: "",
                  });
                  setLoincSearchQuery("");
                  setSelectedLoinc(null);
                  setLoincResults([]);
                  setSnomedCategoryQuery("");
                  setSnomedCategoryResults([]);
                  setSnomedSpecimenQuery("");
                  setSnomedSpecimenResults([]);
                  setSnomedBodysiteQuery("");
                  setSnomedBodysiteResults([]);
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
                    className="px-2"
                    onClick={() => handleVerifyMapping(mapping.id)}
                    disabled={verifying === mapping.id}
                    title="Verifikasi mapping"
                  >
                    {verifying === mapping.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Check className="h-4 w-4" />
                    )}
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  className="px-2 text-red-600 hover:text-red-700"
                  onClick={() => handleDeleteMapping(mapping.id)}
                  disabled={deleting === mapping.id}
                  title="Hapus mapping"
                >
                  {deleting === mapping.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
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
        columns={mappingColumns}
        data={unifiedData}
        searchPlaceholder="Cari nama prosedur atau kode LOINC..."
        pageSize={10}
        tableId="unified-loinc-mappings"
      />

      {/* Mapping Dialog */}
      <Dialog open={mappingDialogOpen} onOpenChange={setMappingDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col p-0">
          <DialogHeader className="p-6 pb-2 shrink-0">
            <DialogTitle>Mapping LOINC & SNOMED CT</DialogTitle>
            <DialogDescription>
              Cari dan pilih data standar LOINC serta atribut SNOMED CT untuk prosedur ini.
            </DialogDescription>
          </DialogHeader>

          {selectedProcedure && (
            <div className="flex-1 overflow-y-auto p-4 pt-2">
              <div className="max-w-2xl mx-auto space-y-6">
                {/* Procedure Info */}
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-widest">Prosedur Lokal</p>
                  <div className="flex items-center gap-3">
                    <p className="text-xl font-bold text-foreground">{selectedProcedure.name}</p>
                    <Badge variant="outline" className="font-mono">{selectedProcedure.code}</Badge>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground pt-1">
                    {selectedProcedure.procedure_group && (
                      <span className="capitalize">Grup: <span className="font-medium text-foreground">{selectedProcedure.procedure_group.replace(/_/g, " ")}</span></span>
                    )}
                  </div>
                </div>

                {/* LOINC Mapping Area */}
                <div className="py-2">
                  <div className="space-y-3">
                    <Label className="text-sm font-medium">Kode LOINC *</Label>
                    <p className="text-xs text-muted-foreground">
                      Cari dari data LOINC Kemkes. Ketik minimal 4 karakter (contoh: "gluko", "darah", "urine").
                    </p>
                    <div className="relative">
                      <div className="flex gap-2">
                        <div className="flex-1 relative">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input
                            placeholder="Ketik nama pemeriksaan: glukosa, hemoglobin, kolesterol..."
                            className="pl-9"
                            value={loincSearchQuery}
                            onChange={(e) => handleSearchLoinc(e.target.value)}
                          />
                          {searchingLoinc && (
                            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin" />
                          )}
                        </div>
                        <Button
                          variant="outline"
                          onClick={() => handleLookupLoincByCode(newMapping.loinc_code || "")}
                          disabled={searchingLoinc || !newMapping.loinc_code}
                          title="Lookup by LOINC code"
                        >
                          <Scan className="h-4 w-4" />
                        </Button>
                      </div>

                      {/* Search Results Table with Scroll */}
                      {loincResults.length > 0 && (
                        <div className="absolute z-50 w-full mt-1 border rounded-md bg-popover shadow-lg">
                          <div className="max-h-64 overflow-y-auto">
                            <table className="w-full text-sm">
                              <thead className="bg-muted sticky top-0">
                                <tr className="border-b">
                                  <th className="text-left p-2 font-medium">Kode LOINC</th>
                                  <th className="text-left p-2 font-medium">Nama Pemeriksaan</th>
                                  <th className="text-left p-2 font-medium">Spesimen</th>
                                  <th className="text-left p-2 font-medium">Kategori</th>
                                </tr>
                              </thead>
                              <tbody>
                                {loincResults.map((loinc) => (
                                  <tr
                                    key={loinc.id}
                                    onClick={() => handleSelectLoinc(loinc)}
                                    className="border-b hover:bg-accent cursor-pointer"
                                  >
                                    <td className="p-2">
                                      <span className="font-mono font-semibold text-blue-600">{loinc.code}</span>
                                    </td>
                                    <td className="p-2">
                                      <div className="font-medium">{loinc.nama_pemeriksaan}</div>
                                      {loinc.display && loinc.display !== loinc.nama_pemeriksaan && (
                                        <div className="text-xs text-muted-foreground italic">{loinc.display}</div>
                                      )}
                                    </td>
                                    <td className="p-2 text-muted-foreground">
                                      {loinc.spesimen || "-"}
                                    </td>
                                    <td className="p-2">
                                      <Badge variant="outline" className="text-xs">
                                        {loinc.kategori_pemeriksaan || "Lab"}
                                      </Badge>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Selected LOINC Display */}
                    {selectedLoinc && (
                      <div className="p-3 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-900 rounded-lg">
                        <div className="flex items-center gap-2 mb-2">
                          <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-500" />
                          <span className="font-semibold text-green-800 dark:text-green-400">LOINC Terpilih</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div>
                            <span className="text-muted-foreground">Kode:</span>{" "}
                            <span className="font-mono font-semibold">{selectedLoinc.code}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Kategori:</span>{" "}
                            <span>{selectedLoinc.kategori_pemeriksaan}</span>
                          </div>
                          <div className="col-span-2">
                            <span className="text-muted-foreground">Nama:</span>{" "}
                            <span className="font-medium">{selectedLoinc.nama_pemeriksaan}</span>
                          </div>
                          {selectedLoinc.spesimen && (
                            <div>
                              <span className="text-muted-foreground">Spesimen:</span>{" "}
                              <span>{selectedLoinc.spesimen}</span>
                            </div>
                          )}
                          {selectedLoinc.satuan && (
                            <div>
                              <span className="text-muted-foreground">Satuan:</span>{" "}
                              <span>{selectedLoinc.satuan}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Manual input fallback */}
                    {!selectedLoinc && (newMapping.loinc_code || newMapping.loinc_display) && (
                      <div className="grid grid-cols-2 gap-3 mt-2">
                        <div>
                          <Label className="text-xs">Kode LOINC (manual)</Label>
                          <Input
                            value={newMapping.loinc_code}
                            onChange={(e) => setNewMapping({ ...newMapping, loinc_code: e.target.value })}
                            placeholder="contoh: 2339-0"
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Display Name (manual)</Label>
                          <Input
                            value={newMapping.loinc_display}
                            onChange={(e) => setNewMapping({ ...newMapping, loinc_display: e.target.value })}
                            placeholder="contoh: Glucose in Blood"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* SNOMED CT Mapping Area */}
                <div className="pt-4 border-t space-y-4">

                  {/* SNOMED Category - Search from Database */}
                  <div className="space-y-3">
                    <Label className="text-sm font-medium">Kategori SNOMED CT *</Label>
                    <p className="text-xs text-muted-foreground">
                      Ketik minimal 3 karakter. <span className="text-orange-600">⚠️ Menggunakan terminologi internasional (Inggris)</span>
                    </p>
                    <div className="relative">
                      <div className="flex gap-2">
                        <div className="relative flex-1">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input
                            value={snomedCategoryQuery}
                            onChange={(e) => handleSearchSnomedCategory(e.target.value)}
                            placeholder="Cari: procedure, laboratory, imaging..."
                            className="pl-9"
                          />
                          {searchingSnomedCategory && (
                            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin" />
                          )}
                        </div>
                      </div>
                      {snomedCategoryResults.length > 0 && (
                        <div className="absolute z-50 w-full mt-1 border rounded-md bg-popover shadow-lg">
                          <div className="max-h-48 overflow-y-auto">
                            <table className="w-full text-sm">
                              <thead className="bg-muted sticky top-0">
                                <tr className="border-b">
                                  <th className="text-left p-2 font-medium w-32">Concept ID</th>
                                  <th className="text-left p-2 font-medium">Term (English)</th>
                                </tr>
                              </thead>
                              <tbody>
                                {snomedCategoryResults.map((snomed) => (
                                  <tr
                                    key={snomed.pk_id}
                                    onClick={() => handleSelectSnomedCategory(snomed)}
                                    className="border-b hover:bg-accent cursor-pointer"
                                  >
                                    <td className="p-2 font-mono text-xs text-muted-foreground">{snomed.conceptId}</td>
                                    <td className="p-2">{snomed.term}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                    </div>
                    {newMapping.snomed_category_code && (
                      <div className="flex items-center gap-2 p-2 bg-muted rounded text-sm">
                        <CheckCircle className="h-4 w-4 text-green-600" />
                        <span className="font-mono text-xs">{newMapping.snomed_category_code}</span>
                        <span>-</span>
                        <span>{newMapping.snomed_category_display}</span>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-4 pt-2">
                    {/* SNOMED Specimen - Search from Database */}
                    <div className="space-y-3">
                      <Label className="text-sm font-medium">Jenis Spesimen (Opsional)</Label>
                      <div className="relative">
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input
                            value={snomedSpecimenQuery}
                            onChange={(e) => handleSearchSnomedSpecimen(e.target.value)}
                            placeholder="Cari: blood, urine, serum..."
                            className="pl-9 text-sm"
                          />
                          {searchingSnomedSpecimen && (
                            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin" />
                          )}
                        </div>
                        {snomedSpecimenResults.length > 0 && (
                          <div className="absolute z-50 w-full mt-1 border rounded-md bg-popover shadow-lg">
                            <div className="max-h-48 overflow-y-auto">
                              <table className="w-full text-xs">
                                <tbody>
                                  {snomedSpecimenResults.map((snomed) => (
                                    <tr
                                      key={snomed.pk_id}
                                      onClick={() => handleSelectSnomedSpecimen(snomed)}
                                      className="border-b hover:bg-accent cursor-pointer"
                                    >
                                      <td className="p-2">{snomed.term}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}
                      </div>
                      {newMapping.snomed_specimen_code && (
                        <div className="flex items-center gap-2 p-2 bg-muted rounded text-xs">
                          <CheckCircle className="h-3 w-3 text-green-600" />
                          <span className="truncate">{newMapping.snomed_specimen_display}</span>
                        </div>
                      )}
                    </div>

                    {/* SNOMED Body Site - Search from Database */}
                    <div className="space-y-3">
                      <Label className="text-sm font-medium">Lokasi Tubuh (Opsional)</Label>
                      <div className="relative">
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input
                            value={snomedBodysiteQuery}
                            onChange={(e) => handleSearchSnomedBodysite(e.target.value)}
                            placeholder="Cari: thorax, brain, kidney..."
                            className="pl-9 text-sm"
                          />
                          {searchingSnomedBodysite && (
                            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin" />
                          )}
                        </div>
                        {snomedBodysiteResults.length > 0 && (
                          <div className="absolute z-50 w-full mt-1 border rounded-md bg-popover shadow-lg">
                            <div className="max-h-48 overflow-y-auto">
                              <table className="w-full text-xs">
                                <tbody>
                                  {snomedBodysiteResults.map((snomed) => (
                                    <tr
                                      key={snomed.pk_id}
                                      onClick={() => handleSelectSnomedBodysite(snomed)}
                                      className="border-b hover:bg-accent cursor-pointer"
                                    >
                                      <td className="p-2">{snomed.term}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}
                      </div>
                      {newMapping.snomed_bodysite_code && (
                        <div className="flex items-center gap-2 p-2 bg-muted rounded text-xs">
                          <CheckCircle className="h-3 w-3 text-green-600" />
                          <span className="truncate">{newMapping.snomed_bodysite_display}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Notes */}
                <div className="space-y-3">
                  <Label className="text-sm font-medium">Catatan (Opsional)</Label>
                  <Textarea
                    value={newMapping.notes || ""}
                    onChange={(e) => setNewMapping({ ...newMapping, notes: e.target.value })}
                    placeholder="Catatan tambahan tentang mapping ini..."
                    rows={2}
                  />
                </div>
              </div>
            </div>
          )}

          <div className="p-6 pt-4 border-t bg-background flex justify-end gap-3 shrink-0">
            <Button variant="outline" onClick={() => setMappingDialogOpen(false)}>
              Batal
            </Button>
            <Button
              onClick={handleSaveMapping}
              disabled={!newMapping.loinc_code || !newMapping.loinc_display || !newMapping.snomed_category_code || savingMapping}
              className="min-w-[150px]"
            >
              {savingMapping ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Plus className="h-4 w-4 mr-2" />
              )}
              Simpan Mapping
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
