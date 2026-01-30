import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { DataTable } from "@/components/ui/data-table";
import { useToast } from "@/hooks/use-toast";
import {
  RefreshCw,
  Search,
  CheckCircle,
  AlertCircle,
  Link2,
  Plus,
  Trash2,
  Check,
  Loader2,
  FlaskConical,
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
import { ScrollArea } from "@/components/ui/scroll-area";

// SNOMED CT codes untuk kategori prosedur
// Kode standar dari SNOMED International untuk SatuSehat
const SNOMED_CODES = {
  // Kategori prosedur
  LABORATORY_PROCEDURE: "108252007",  // Laboratory procedure
  IMAGING: "363679005",               // Imaging (procedure)
} as const;

export function LoincMappingTab() {
  const { toast } = useToast();

  // Data states
  const [loincMappings, setLoincMappings] = useState<ProcedureLoincMapping[]>([]);
  const [loincStats, setLoincStats] = useState<LoincMappingStats | null>(null);
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

  // Search SNOMED CT - Category (procedure types)
  // Minimal 3 karakter untuk mengurangi beban server (1.1 juta data)
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
  // Minimal 3 karakter untuk mengurangi beban server
  const handleSearchSnomedSpecimen = async (query: string) => {
    setSnomedSpecimenQuery(query);
    if (query.length < 3) {
      setSnomedSpecimenResults([]);
      return;
    }
    setSearchingSnomedSpecimen(true);
    try {
      // Search SNOMED term directly
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
  // Minimal 3 karakter untuk mengurangi beban server
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

  const loadData = async () => {
    setLoading(true);
    try {
      const [statsRes, mappingsRes, unmappedRes] = await Promise.all([
        loincStatsApi.getStats(),
        loincMappingApi.getAll({ limit: 100 }),
        loincStatsApi.getUnmapped({ limit: 100 }),
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

  const handleSearchLoinc = async (query: string) => {
    setLoincSearchQuery(query);
    // Minimal 4 karakter untuk mengurangi beban server
    if (query.length < 4) {
      setLoincResults([]);
      return;
    }
    
    setSearchingLoinc(true);
    try {
      // Determine class type based on selected procedure type
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
    
    // Auto-fill form with LOINC data (sesuai struktur Kemkes IHS)
    const isRadiology = loinc.kategori_pemeriksaan === "Radiologi";
    const categoryCode = isRadiology ? SNOMED_CODES.IMAGING : SNOMED_CODES.LABORATORY_PROCEDURE;
    const categoryDisplay = isRadiology ? "Imaging" : "Laboratory procedure";
    
    // Gunakan nama_pemeriksaan (Indonesia) atau display (English)
    const displayName = loinc.nama_pemeriksaan || loinc.display;
    
    setNewMapping({
      ...newMapping,
      loinc_code: loinc.code,  // Dari LoincMaster.code
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

  const openMappingDialog = (procedure: UnmappedProcedure) => {
    setSelectedProcedure(procedure);
    
    // Clear all form states - user harus search sendiri
    setNewMapping({
      procedure_id: procedure.id,
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
    
    // Clear all search states
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
  const mappingColumns: ColumnDef<ProcedureLoincMapping>[] = [
    {
      accessorKey: "procedure.name",
      header: "Prosedur",
      cell: ({ row }) => (
        <div>
          <p className="font-medium text-sm">{row.original.procedure?.name}</p>
          <p className="text-xs text-muted-foreground">{row.original.procedure?.code}</p>
        </div>
      ),
    },
    {
      accessorKey: "loinc_code",
      header: "LOINC",
      cell: ({ row }) => (
        <div>
          <code className="text-xs bg-blue-100 dark:bg-blue-900 px-1 rounded">
            {row.original.loinc_code}
          </code>
          <p className="text-xs text-muted-foreground mt-1 truncate max-w-[150px]">
            {row.original.loinc_display}
          </p>
        </div>
      ),
    },
    {
      accessorKey: "snomed_category_code",
      header: "Kategori",
      cell: ({ row }) => (
        <Badge variant="secondary" className="text-xs">
          {row.original.snomed_category_display || row.original.snomed_category_code}
        </Badge>
      ),
    },
    {
      accessorKey: "is_verified",
      header: "Status",
      cell: ({ row }) => (
        <Badge
          variant={row.original.is_verified ? "default" : "outline"}
          className={row.original.is_verified ? "bg-green-600 hover:bg-green-700 text-xs" : "text-xs"}
        >
          {row.original.is_verified ? "Verified" : "Pending"}
        </Badge>
      ),
    },
    {
      id: "actions",
      cell: ({ row }) => (
        <div className="flex items-center gap-1">
          {!row.original.is_verified && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2"
              onClick={() => handleVerifyMapping(row.original.id)}
              disabled={verifying === row.original.id}
            >
              {verifying === row.original.id ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Check className="h-3 w-3" />
              )}
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-red-500 hover:text-red-700"
            onClick={() => handleDeleteMapping(row.original.id)}
            disabled={deleting === row.original.id}
          >
            {deleting === row.original.id ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Trash2 className="h-3 w-3" />
            )}
          </Button>
        </div>
      ),
    },
  ];

  const unmappedColumns: ColumnDef<UnmappedProcedure>[] = [
    {
      accessorKey: "name",
      header: "Nama Prosedur",
      cell: ({ row }) => (
        <div>
          <p className="font-medium text-sm">{row.original.name}</p>
          <div className="flex items-center gap-2 mt-1">
            <code className="text-xs bg-muted px-1 rounded">{row.original.code}</code>
            <Badge variant="outline" className="text-xs capitalize">
              {row.original.procedure_type}
            </Badge>
          </div>
        </div>
      ),
    },
    {
      accessorKey: "procedure_group",
      header: "Grup",
      cell: ({ row }) => (
        <span className="text-xs text-muted-foreground capitalize">
          {row.original.procedure_group?.replace(/_/g, " ")}
        </span>
      ),
    },
    {
      id: "actions",
      cell: ({ row }) => (
        <Button
          variant="outline"
          size="sm"
          className="h-7"
          onClick={() => openMappingDialog(row.original)}
        >
          <Plus className="h-3 w-3 mr-1" />
          Mapping
        </Button>
      ),
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
      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <FlaskConical className="h-4 w-4 text-blue-500" />
              Total Prosedur
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{loincStats?.total_procedures || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Lab: {loincStats?.total_procedures_lab || 0} | Rad: {loincStats?.total_procedures_rad || 0}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Link2 className="h-4 w-4 text-green-500" />
              Sudah Mapping
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loincStats?.total_mapped || 0}
              <span className="text-sm font-normal text-muted-foreground ml-1">
                ({loincStats?.mapped_percentage?.toFixed(1) || 0}%)
              </span>
            </div>
            <Progress
              value={loincStats?.mapped_percentage || 0}
              className="mt-2"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-emerald-500" />
              Terverifikasi
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loincStats?.total_verified || 0}
              <span className="text-sm font-normal text-muted-foreground ml-1">
                ({loincStats?.verified_percentage?.toFixed(1) || 0}%)
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">Siap untuk SatuSehat</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-orange-500" />
              Belum Mapping
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {loincStats?.total_unmapped || 0}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Perlu dipetakan ke LOINC</p>
          </CardContent>
        </Card>
      </div>

      {/* Two Column Layout */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Mapped Procedures */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Link2 className="h-4 w-4" />
                Mapping LOINC ({loincMappings.length})
              </span>
              <Button variant="outline" size="sm" onClick={loadData}>
                <RefreshCw className="h-3 w-3 mr-1" />
                Refresh
              </Button>
            </CardTitle>
            <CardDescription>
              Prosedur yang sudah dipetakan ke kode LOINC untuk ServiceRequest
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <DataTable
              columns={mappingColumns}
              data={loincMappings}
              searchPlaceholder="Cari nama prosedur atau kode LOINC..."
              pageSize={5}
              tableId="loinc-mappings"
            />
          </CardContent>
        </Card>

        {/* Unmapped Procedures */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-orange-500" />
              Prosedur Belum Mapping ({unmappedProcedures.length})
            </CardTitle>
            <CardDescription>
              Prosedur Lab/Radiologi yang perlu dipetakan ke LOINC untuk ServiceRequest
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <DataTable
              columns={unmappedColumns}
              data={unmappedProcedures}
              searchPlaceholder="Cari nama prosedur..."
              pageSize={5}
              tableId="unmapped-procedures"
            />
          </CardContent>
        </Card>
      </div>

      {/* Info Box */}
      <Card className="bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800">
        <CardContent className="pt-4">
          <div className="flex gap-3">
            <div className="flex-shrink-0">
              <AlertCircle className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                Tentang LOINC & SNOMED CT untuk ServiceRequest
              </p>
              <p className="text-sm text-blue-700 dark:text-blue-300">
                <strong>LOINC</strong> (Logical Observation Identifiers Names and Codes) digunakan untuk mengidentifikasi 
                jenis pemeriksaan laboratorium atau radiologi. <strong>SNOMED CT</strong> digunakan untuk kategori 
                (Laboratory/Imaging), jenis spesimen (darah, urin, dll), dan lokasi tubuh (untuk radiologi).
                <br /><br />
                Referensi LOINC: <a 
                  href="https://loinc.org/search/" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="underline"
                >loinc.org</a>
                {" | "}
                SNOMED Browser: <a 
                  href="https://browser.ihtsdotools.org/" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="underline"
                >browser.ihtsdotools.org</a>
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Mapping Dialog */}
      <Dialog open={mappingDialogOpen} onOpenChange={setMappingDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Mapping LOINC untuk Prosedur</DialogTitle>
            <DialogDescription>
              {selectedProcedure && (
                <span>
                  Petakan <strong>{selectedProcedure.name}</strong> ({selectedProcedure.code}) 
                  ke kode LOINC dan SNOMED CT
                </span>
              )}
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="flex-1 overflow-auto pr-4">
            <div className="space-y-6 py-2">
              {/* LOINC Search - Searchable with Detail */}
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
                  <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <span className="font-semibold text-green-800">LOINC Terpilih</span>
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
                  <div className="grid grid-cols-2 gap-3">
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

              {/* SNOMED Category - Search from Database */}
              <div className="space-y-3">
                <Label className="text-sm font-medium">Kategori SNOMED CT *</Label>
                <p className="text-xs text-muted-foreground">
                  Cari dari 1.1 juta data SNOMED CT Kemkes. Ketik minimal 3 karakter.
                  <br />
                  <span className="text-orange-600">⚠️ SNOMED CT menggunakan terminologi internasional (Bahasa Inggris)</span>
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

              {/* SNOMED Specimen - Search from Database */}
              <div className="space-y-3">
                <Label className="text-sm font-medium">Jenis Spesimen (Opsional)</Label>
                <p className="text-xs text-muted-foreground">
                  Ketik minimal 3 karakter dalam Bahasa Inggris (contoh: blood, urine, serum)
                </p>
                <div className="relative">
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        value={snomedSpecimenQuery}
                        onChange={(e) => handleSearchSnomedSpecimen(e.target.value)}
                        placeholder="Cari: blood, urine, serum..."
                        className="pl-9"
                      />
                      {searchingSnomedSpecimen && (
                        <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin" />
                      )}
                    </div>
                  </div>
                  {snomedSpecimenResults.length > 0 && (
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
                            {snomedSpecimenResults.map((snomed) => (
                              <tr
                                key={snomed.pk_id}
                                onClick={() => handleSelectSnomedSpecimen(snomed)}
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
                {newMapping.snomed_specimen_code && (
                  <div className="flex items-center gap-2 p-2 bg-muted rounded text-sm">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <span className="font-mono text-xs">{newMapping.snomed_specimen_code}</span>
                    <span>-</span>
                    <span>{newMapping.snomed_specimen_display}</span>
                  </div>
                )}
              </div>

              {/* SNOMED Body Site - Search from Database */}
              <div className="space-y-3">
                <Label className="text-sm font-medium">Lokasi Tubuh (Opsional)</Label>
                <p className="text-xs text-muted-foreground">
                  Ketik minimal 3 karakter dalam Bahasa Inggris (contoh: thorax, kidney, liver)
                </p>
                <div className="relative">
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        value={snomedBodysiteQuery}
                        onChange={(e) => handleSearchSnomedBodysite(e.target.value)}
                        placeholder="Cari: thorax, brain, kidney..."
                        className="pl-9"
                      />
                      {searchingSnomedBodysite && (
                        <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin" />
                      )}
                    </div>
                  </div>
                  {snomedBodysiteResults.length > 0 && (
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
                            {snomedBodysiteResults.map((snomed) => (
                              <tr
                                key={snomed.pk_id}
                                onClick={() => handleSelectSnomedBodysite(snomed)}
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
                {newMapping.snomed_bodysite_code && (
                  <div className="flex items-center gap-2 p-2 bg-muted rounded text-sm">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <span className="font-mono text-xs">{newMapping.snomed_bodysite_code}</span>
                    <span>-</span>
                    <span>{newMapping.snomed_bodysite_display}</span>
                  </div>
                )}
              </div>

              {/* Notes */}
              <div className="space-y-3">
                <Label className="text-sm font-medium">Catatan (Opsional)</Label>
                <Textarea
                  value={newMapping.notes}
                  onChange={(e) => setNewMapping({ ...newMapping, notes: e.target.value })}
                  placeholder="Catatan tambahan tentang mapping ini..."
                  rows={2}
                />
              </div>

              {/* Preview - Sesuai struktur Kemkes IHS */}
              {selectedLoinc && (
                <div className="p-3 bg-muted/50 rounded-lg space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">Preview Data LOINC (Kemkes IHS):</p>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div><span className="text-muted-foreground">Kategori:</span> {selectedLoinc.kategori_pemeriksaan}</div>
                    <div><span className="text-muted-foreground">Spesimen:</span> {selectedLoinc.spesimen || "-"}</div>
                    <div><span className="text-muted-foreground">Component:</span> {selectedLoinc.component}</div>
                    <div><span className="text-muted-foreground">System:</span> {selectedLoinc.system}</div>
                    {selectedLoinc.satuan && (
                      <div><span className="text-muted-foreground">Satuan:</span> {selectedLoinc.satuan}</div>
                    )}
                    {selectedLoinc.tipe_hasil_pemeriksaan && (
                      <div><span className="text-muted-foreground">Tipe Hasil:</span> {selectedLoinc.tipe_hasil_pemeriksaan}</div>
                    )}
                    {selectedLoinc.display && (
                      <div className="col-span-2">
                        <span className="text-muted-foreground">Display (EN):</span> {selectedLoinc.display}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>

          <DialogFooter className="pt-4 border-t">
            <Button
              variant="outline"
              onClick={() => setMappingDialogOpen(false)}
            >
              Batal
            </Button>
            <Button
              onClick={handleSaveMapping}
              disabled={savingMapping || !newMapping.loinc_code || !newMapping.loinc_display || !newMapping.snomed_category_code}
            >
              {savingMapping ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Menyimpan...
                </>
              ) : (
                <>
                  <Check className="h-4 w-4 mr-2" />
                  Simpan Mapping
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
